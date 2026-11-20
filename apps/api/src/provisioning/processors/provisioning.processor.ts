import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import * as crypto from "crypto";
import { promises as fs } from "fs";
import * as path from "path";
import { PrismaService } from "../../prisma/prisma.service";
import { ProvisionJobType, ProvisionJobStatus } from "@prisma/client";

export function mailboxPath(domain: string, localPart: string): string {
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain) ||
    !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(localPart)
  ) {
    throw new Error("Invalid mailbox storage path");
  }
  return path.join(process.env.VMAIL_ROOT || "/var/vmail", domain, localPart);
}

@Processor("provisioning", { concurrency: 2 })
export class ProvisioningProcessor extends WorkerHost {
  private readonly logger = new Logger(ProvisioningProcessor.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue("provisioning-dlq") private dlqQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { jobRecordId } = job.data;
    this.logger.log(
      `Processing job ${job.name} (attempt ${job.attemptsMade + 1}) [DB ID: ${jobRecordId}]`,
    );

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
          throw new Error(`Unsupported provisioning operation: ${job.name}`);
      }

      // Mark COMPLETED in DB
      if (jobRecordId) {
        await this.prisma.provisionJob.update({
          where: { id: jobRecordId },
          data: {
            status: ProvisionJobStatus.COMPLETED,
            result,
            completedAt: new Date(),
            lastError: null,
          },
        });
      }

      this.logger.log(
        `Job ${job.name} completed successfully [DB ID: ${jobRecordId}]`,
      );
      return result;
    } catch (error: any) {
      this.logger.error(
        `Job ${job.name} failed: ${error.message}`,
        error.stack,
      );

      // If this was the last attempt, move to DEAD_LETTER
      if (job.attemptsMade + 1 >= (job.opts.attempts || 5)) {
        this.logger.error(
          `Job ${job.name} exhausted all retries. Moving to Dead Letter Queue.`,
        );
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
  private async handleCreateMailbox(data: {
    domain: string;
    localPart: string;
    email: string;
  }) {
    const root = mailboxPath(data.domain, data.localPart);
    for (const folder of ["cur", "new", "tmp"]) {
      await fs.mkdir(path.join(root, "Maildir", folder), {
        recursive: true,
        mode: 0o700,
      });
    }
    return { path: root, created: true };
  }

  // Deactivation is immediate in SQL. Retain mail for recovery instead of an
  // unreviewable recursive delete, and make retries harmless.
  private async handleDeleteMailbox(data: {
    domain: string;
    localPart: string;
    mailboxId: string;
  }) {
    const root = mailboxPath(data.domain, data.localPart);
    if (!/^[a-z0-9_-]+$/i.test(data.mailboxId))
      throw new Error("Invalid mailbox ID");
    const archive = path.join(
      process.env.VMAIL_ROOT || "/var/vmail",
      ".deleted",
      data.mailboxId,
    );
    await fs.mkdir(path.dirname(archive), { recursive: true, mode: 0o700 });
    try {
      await fs.rename(root, archive);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return { archived: true };
  }

  /**
   * Generate DKIM RSA 2048 keys for domain
   */
  private async handleGenerateDkim(data: {
    domainId: string;
    domainName: string;
    selector?: string;
  }) {
    const { domainId, domainName } = data;
    const selector = data.selector || "mailhive";

    this.logger.log(
      `Generating DKIM keys for ${domainName} with selector ${selector}...`,
    );

    mailboxPath(domainName, "validate");
    if (!/^[a-z0-9_-]+$/i.test(selector))
      throw new Error("Invalid DKIM selector");
    const directory = process.env.DKIM_ROOT || "/var/lib/rspamd/dkim";
    await fs.mkdir(directory, { recursive: true, mode: 0o770 });
    const keyFile = path.join(directory, `${domainName}.${selector}.key`);
    let privateKey: string;
    try {
      privateKey = await fs.readFile(keyFile, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const existing = await this.prisma.domain.findUniqueOrThrow({
        where: { id: domainId },
      });
      // Preserve the existing published key on retries and migrate legacy DB keys.
      privateKey =
        existing.dkimPrivateKey ||
        crypto.generateKeyPairSync("rsa", {
          modulusLength: 2048,
          publicKeyEncoding: { type: "spki", format: "pem" },
          privateKeyEncoding: { type: "pkcs8", format: "pem" },
        }).privateKey;
      try {
        await fs.writeFile(keyFile, privateKey, { mode: 0o640, flag: "wx" });
      } catch (writeError) {
        if (writeError.code !== "EEXIST") throw writeError;
        privateKey = await fs.readFile(keyFile, "utf8");
      }
    }
    const pubKeyClean = crypto
      .createPublicKey(privateKey)
      .export({ type: "spki", format: "der" })
      .toString("base64");
    // Fixed selector avoids a shared mutable selector map and survives restarts.
    if (selector !== "mailhive")
      throw new Error("Only the mailhive DKIM selector is supported");
    await this.prisma.domain.update({
      where: { id: domainId },
      data: {
        dkimSelector: selector,
        dkimPrivateKey: null,
        dkimPublicKey: pubKeyClean,
      },
    });

    return {
      domainName,
      selector,
      dnsRecord: `v=DKIM1; k=rsa; p=${pubKeyClean}`,
    };
  }

  private async handleUpdateQuota(data: {
    mailboxId: string;
    quotaBytes: number;
  }) {
    return { updated: true, quotaBytes: data.quotaBytes };
  }

  private async handleUpdatePassword(data: { mailboxId: string }) {
    return { updated: true };
  }

  private async handleCreateDomain(data: {
    domainId: string;
    domainName: string;
  }) {
    // Automatically trigger DKIM generation for newly created domains
    await this.handleGenerateDkim(data);
    return { domainCreated: true };
  }
}
