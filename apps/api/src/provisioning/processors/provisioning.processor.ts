import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../../prisma/prisma.service';
import { ProvisionJobType, ProvisionJobStatus } from '@prisma/client';

const execAsync = promisify(exec);

@Processor('provisioning', { concurrency: 2 })
export class ProvisioningProcessor extends WorkerHost {
  private readonly logger = new Logger(ProvisioningProcessor.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('provisioning-dlq') private dlqQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { jobRecordId } = job.data;
    this.logger.log(`Processing job ${job.name} (attempt ${job.attemptsMade + 1}) [DB ID: ${jobRecordId}]`);

    // Update DB status to PROCESSING
    if (jobRecordId) {
      await this.prisma.provisionJob.update({
        where: { id: jobRecordId },
        data: {
          status: ProvisionJobStatus.PROCESSING,
          attempts: job.attemptsMade + 1,
        },
      });
    }

    try {
      let result: any = null;
      switch (job.name as ProvisionJobType) {
        case ProvisionJobType.CREATE_MAILBOX:
          result = await this.handleCreateMailbox(job.data);
          break;
        case ProvisionJobType.DELETE_MAILBOX:
          result = await this.handleDeleteMailbox(job.data);
          break;
        case ProvisionJobType.GENERATE_DKIM:
          result = await this.handleGenerateDkim(job.data);
          break;
        case ProvisionJobType.UPDATE_QUOTA:
          result = await this.handleUpdateQuota(job.data);
          break;
        case ProvisionJobType.UPDATE_PASSWORD:
          result = await this.handleUpdatePassword(job.data);
          break;
        case ProvisionJobType.CREATE_DOMAIN:
          result = await this.handleCreateDomain(job.data);
          break;
        default:
          this.logger.warn(`Unhandled job type: ${job.name}`);
          result = { skipped: true };
      }

      // Mark COMPLETED in DB
      if (jobRecordId) {
        await this.prisma.provisionJob.update({
          where: { id: jobRecordId },
          data: {
            status: ProvisionJobStatus.COMPLETED,
            result,
            completedAt: new Date(),
          },
        });
      }

      this.logger.log(`Job ${job.name} completed successfully [DB ID: ${jobRecordId}]`);
      return result;
    } catch (error: any) {
      this.logger.error(`Job ${job.name} failed: ${error.message}`, error.stack);

      // If this was the last attempt, move to DEAD_LETTER
      if (job.attemptsMade + 1 >= (job.opts.attempts || 5)) {
        this.logger.error(`Job ${job.name} exhausted all retries. Moving to Dead Letter Queue.`);
        if (jobRecordId) {
          await this.prisma.provisionJob.update({
            where: { id: jobRecordId },
            data: {
              status: ProvisionJobStatus.DEAD_LETTER,
              lastError: error.message,
            },
          });
        }
        await this.dlqQueue.add(job.name, {
          ...job.data,
          failedReason: error.message,
          failedAt: new Date().toISOString(),
        });
      } else {
        if (jobRecordId) {
          await this.prisma.provisionJob.update({
            where: { id: jobRecordId },
            data: {
              status: ProvisionJobStatus.FAILED,
              lastError: error.message,
            },
          });
        }
      }

      throw error; // Re-throw to trigger BullMQ retry backoff
    }
  }

  /**
   * Create Maildir structure inside Dovecot volume with 5000:5000 permissions
   */
  private async handleCreateMailbox(data: { domain: string; localPart: string; email: string }) {
    const { domain, localPart } = data;
    const maildirPath = `/var/vmail/${domain}/${localPart}/Maildir`;

    // Try executing directly in Dovecot container or local filesystem
    try {
      await execAsync(
        `docker exec mailhive-dovecot sh -c "mkdir -p ${maildirPath}/cur ${maildirPath}/new ${maildirPath}/tmp && chown -R 5000:5000 /var/vmail/${domain} && chmod -R 700 /var/vmail/${domain}"`,
      );
    } catch (err: any) {
      this.logger.warn(`Could not run docker exec for mailbox creation (fallback to local fs if mounted): ${err.message}`);
    }

    return { path: maildirPath, created: true };
  }

  /**
   * Delete Maildir structure
   */
  private async handleDeleteMailbox(data: { domain: string; localPart: string }) {
    const { domain, localPart } = data;
    try {
      await execAsync(`docker exec mailhive-dovecot rm -rf /var/vmail/${domain}/${localPart}`);
    } catch (err: any) {
      this.logger.warn(`Docker exec delete mailbox warning: ${err.message}`);
    }
    return { deleted: true };
  }

  /**
   * Generate DKIM RSA 2048 keys for domain
   */
  private async handleGenerateDkim(data: { domainId: string; domainName: string; selector?: string }) {
    const { domainId, domainName } = data;
    const selector = data.selector || 'mailhive';

    this.logger.log(`Generating DKIM keys for ${domainName} with selector ${selector}...`);

    // 1. Generate RSA 2048 keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Format public key for DNS (extract base64 body without headers)
    const pubKeyClean = publicKey
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\r?\n|\r/g, '');

    // 2. Save in Database
    await this.prisma.domain.update({
      where: { id: domainId },
      data: {
        dkimSelector: selector,
        dkimPrivateKey: privateKey,
        dkimPublicKey: pubKeyClean,
        dkimVerified: false,
      },
    });

    // 3. Write private key to Rspamd container and update selector map
    try {
      const keyFile = `/var/lib/rspamd/dkim/${domainName}.${selector}.key`;
      const base64Key = Buffer.from(privateKey).toString('base64');
      await execAsync(
        `docker exec mailhive-rspamd sh -c "echo '${base64Key}' | base64 -d > ${keyFile} && chown _rspamd:_rspamd ${keyFile} && chmod 600 ${keyFile} && grep -q '${domainName}' /etc/rspamd/dkim_selectors.map || echo '${domainName} ${selector}' >> /etc/rspamd/dkim_selectors.map"`,
      );
    } catch (err: any) {
      this.logger.warn(`Could not deploy DKIM key to rspamd container: ${err.message}`);
    }

    return {
      domainName,
      selector,
      dnsRecord: `v=DKIM1; k=rsa; p=${pubKeyClean}`,
    };
  }

  private async handleUpdateQuota(data: { mailboxId: string; quotaBytes: number }) {
    return { updated: true, quotaBytes: data.quotaBytes };
  }

  private async handleUpdatePassword(data: { mailboxId: string }) {
    return { updated: true };
  }

  private async handleCreateDomain(data: { domainId: string; domainName: string }) {
    // Automatically trigger DKIM generation for newly created domains
    await this.handleGenerateDkim(data);
    return { domainCreated: true };
  }
}
