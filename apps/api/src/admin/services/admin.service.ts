import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as dns from 'dns';
import { promisify } from 'util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { ProvisioningService } from '../../provisioning/provisioning.service';
import { CreateDomainDto } from '../dto/create-domain.dto';
import { CreateMailboxDto } from '../dto/create-mailbox.dto';
import { UpdateMailboxDto } from '../dto/update-mailbox.dto';
import { CreateAliasDto } from '../dto/create-alias.dto';
import { ProvisionJobType, ActorType } from '@prisma/client';

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private provisioning: ProvisioningService,
  ) {}

  // =========================================================================
  // DOMAINS
  // =========================================================================

  async createDomain(dto: CreateDomainDto, adminId: string) {
    const domainName = dto.name.toLowerCase().trim();

    const existing = await this.prisma.domain.findFirst({
      where: { name: domainName, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`Domain ${domainName} already exists`);
    }

    const domain = await this.prisma.domain.create({
      data: {
        name: domainName,
        isActive: true,
        dkimSelector: 'mailhive',
      },
    });

    // Enqueue provisioning job to generate DKIM keys and deploy to Rspamd
    await this.provisioning.enqueueJob(ProvisionJobType.CREATE_DOMAIN, {
      domainId: domain.id,
      domainName: domain.name,
      selector: 'mailhive',
    });

    await this.logAudit(ActorType.ADMIN, adminId, 'domain.create', 'Domain', domain.id, {
      name: domain.name,
    });

    return domain;
  }

  async listDomains(page = 1, pageSize = 50, search?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = { deletedAt: null };

    if (search) {
      where.name = { contains: search.toLowerCase() };
    }

    const [domains, total] = await Promise.all([
      this.prisma.domain.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          _count: {
            select: { mailboxes: { where: { deletedAt: null } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.domain.count({ where }),
    ]);

    return {
      data: domains.map((d) => ({
        ...d,
        mailboxCount: d._count.mailboxes,
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getDomain(id: string) {
    const domain = await this.prisma.domain.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: { mailboxes: { where: { deletedAt: null } }, aliases: true },
        },
      },
    });
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }
    return domain;
  }

  async deleteDomain(id: string, adminId: string) {
    const domain = await this.getDomain(id);

    await this.prisma.domain.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.logAudit(ActorType.ADMIN, adminId, 'domain.delete', 'Domain', id, {
      name: domain.name,
    });

    return { success: true };
  }

  async getDomainDnsRecords(id: string) {
    const domain = await this.getDomain(id);
    const mailHost = process.env.MAIL_HOSTNAME || 'mail.example.test';
    const selector = domain.dkimSelector || 'mailhive';

    return {
      domain: domain.name,
      records: {
        mx: {
          type: 'MX',
          host: domain.name,
          value: mailHost,
          priority: 10,
          verified: domain.mxVerified,
        },
        spf: {
          type: 'TXT',
          host: domain.name,
          value: `v=spf1 mx ~all`,
          verified: domain.spfVerified,
        },
        dkim: {
          type: 'TXT',
          host: `${selector}._domainkey.${domain.name}`,
          value: domain.dkimPublicKey ? `v=DKIM1; k=rsa; p=${domain.dkimPublicKey}` : null,
          verified: domain.dkimVerified,
        },
        dmarc: {
          type: 'TXT',
          host: `_dmarc.${domain.name}`,
          value: `v=DMARC1; p=quarantine; rua=mailto:postmaster@${domain.name}`,
          verified: domain.dmarcVerified,
        },
        ptr: {
          description: 'Reverse DNS (rDNS) pointing to your mail server hostname',
          recommendedValue: mailHost,
        },
        mtaSts: {
          description: 'MTA Strict Transport Security',
          policyHost: `mta-sts.${domain.name}`,
          txtRecord: `v=STSv1; id=2026112001`,
        },
      },
      isFullyVerified: domain.isVerified,
    };
  }

  async verifyDomainDns(id: string) {
    const domain = await this.getDomain(id);
    let mxVerified = false;
    let spfVerified = false;
    let dkimVerified = false;
    let dmarcVerified = false;

    // Verify MX
    try {
      const records = await resolveMx(domain.name);
      const expectedHost = process.env.MAIL_HOSTNAME || 'mail.example.test';
      mxVerified = records.some((r) => r.exchange.toLowerCase().includes(expectedHost.toLowerCase()));
    } catch (e) {
      mxVerified = false;
    }

    // Verify SPF
    try {
      const txtRecords = await resolveTxt(domain.name);
      const joined = txtRecords.flat().join(' ');
      spfVerified = joined.includes('v=spf1');
    } catch (e) {
      spfVerified = false;
    }

    // Verify DKIM
    try {
      const selector = domain.dkimSelector || 'mailhive';
      const dkimTxt = await resolveTxt(`${selector}._domainkey.${domain.name}`);
      const joined = dkimTxt.flat().join('');
      dkimVerified = joined.includes('v=DKIM1') && !!domain.dkimPublicKey && joined.includes(domain.dkimPublicKey);
    } catch (e) {
      dkimVerified = false;
    }

    // Verify DMARC
    try {
      const dmarcTxt = await resolveTxt(`_dmarc.${domain.name}`);
      const joined = dmarcTxt.flat().join('');
      dmarcVerified = joined.includes('v=DMARC1');
    } catch (e) {
      dmarcVerified = false;
    }

    const isVerified = mxVerified && spfVerified && dkimVerified;

    const updated = await this.prisma.domain.update({
      where: { id },
      data: {
        mxVerified,
        spfVerified,
        dkimVerified,
        dmarcVerified,
        isVerified,
      },
    });

    return updated;
  }

  // =========================================================================
  // MAILBOXES
  // =========================================================================

  async createMailbox(dto: CreateMailboxDto, adminId: string) {
    const domain = await this.prisma.domain.findFirst({
      where: { id: dto.domainId, deletedAt: null },
    });
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    const localPart = dto.localPart.toLowerCase().trim();
    const email = `${localPart}@${domain.name}`;

    const existing = await this.prisma.mailbox.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`Mailbox ${email} already exists`);
    }

    // Hash with Dovecot-compatible Argon2id
    const passwordHash = await this.authService.hashPassword(dto.password);
    const quotaBytes = dto.quotaBytes || 1073741824; // 1 GB

    const mailbox = await this.prisma.mailbox.create({
      data: {
        localPart,
        domainId: domain.id,
        email,
        passwordHash,
        displayName: dto.displayName || localPart,
        quotaBytes: BigInt(quotaBytes),
        isActive: true,
      },
    });

    // Create system labels for the mailbox
    const defaultLabels = ['Inbox', 'Starred', 'Sent', 'Drafts', 'Spam', 'Trash', 'All Mail'];
    await Promise.all(
      defaultLabels.map((name) =>
        this.prisma.label.create({
          data: {
            mailboxId: mailbox.id,
            name,
            isSystem: true,
          },
        }),
      ),
    );

    // Enqueue BullMQ job to create Maildir with vmail:vmail permissions
    const jobRecord = await this.provisioning.enqueueJob(ProvisionJobType.CREATE_MAILBOX, {
      mailboxId: mailbox.id,
      email: mailbox.email,
      domain: domain.name,
      localPart: mailbox.localPart,
    });

    await this.logAudit(ActorType.ADMIN, adminId, 'mailbox.create', 'Mailbox', mailbox.id, {
      email: mailbox.email,
      domain: domain.name,
    });

    return {
      mailbox: {
        id: mailbox.id,
        email: mailbox.email,
        localPart: mailbox.localPart,
        domainId: mailbox.domainId,
        displayName: mailbox.displayName,
        quotaBytes: Number(mailbox.quotaBytes),
        isActive: mailbox.isActive,
        createdAt: mailbox.createdAt,
      },
      jobId: jobRecord.id,
    };
  }

  async listMailboxes(page = 1, pageSize = 50, domainId?: string, search?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = { deletedAt: null };

    if (domainId) {
      where.domainId = domainId;
    }
    if (search) {
      where.OR = [
        { email: { contains: search.toLowerCase() } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [mailboxes, total] = await Promise.all([
      this.prisma.mailbox.findMany({
        where,
        skip,
        take: pageSize,
        include: { domain: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mailbox.count({ where }),
    ]);

    return {
      data: mailboxes.map((m) => {
        const quota = Number(m.quotaBytes);
        const used = Number(m.usedBytes);
        const percent = quota > 0 ? Math.round((used / quota) * 100) : 0;
        return {
          id: m.id,
          email: m.email,
          localPart: m.localPart,
          domainId: m.domainId,
          domainName: m.domain.name,
          displayName: m.displayName,
          quotaBytes: quota,
          usedBytes: used,
          quotaPercent: percent,
          isActive: m.isActive,
          lastLoginAt: m.lastLoginAt,
          createdAt: m.createdAt,
        };
      }),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getMailbox(id: string) {
    const mailbox = await this.prisma.mailbox.findFirst({
      where: { id, deletedAt: null },
      include: { domain: true },
    });
    if (!mailbox) {
      throw new NotFoundException('Mailbox not found');
    }
    return {
      ...mailbox,
      quotaBytes: Number(mailbox.quotaBytes),
      usedBytes: Number(mailbox.usedBytes),
    };
  }

  async updateMailbox(id: string, dto: UpdateMailboxDto, adminId: string) {
    const mailbox = await this.getMailbox(id);
    const updateData: any = {};

    if (dto.displayName !== undefined) updateData.displayName = dto.displayName;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.quotaBytes !== undefined) {
      updateData.quotaBytes = BigInt(dto.quotaBytes);
      await this.provisioning.enqueueJob(ProvisionJobType.UPDATE_QUOTA, {
        mailboxId: id,
        quotaBytes: dto.quotaBytes,
      });
    }
    if (dto.password) {
      updateData.passwordHash = await this.authService.hashPassword(dto.password);
      await this.provisioning.enqueueJob(ProvisionJobType.UPDATE_PASSWORD, {
        mailboxId: id,
      });
    }

    const updated = await this.prisma.mailbox.update({
      where: { id },
      data: updateData,
    });

    await this.logAudit(ActorType.ADMIN, adminId, 'mailbox.update', 'Mailbox', id, {
      changes: Object.keys(updateData),
    });

    return {
      ...updated,
      quotaBytes: Number(updated.quotaBytes),
      usedBytes: Number(updated.usedBytes),
    };
  }

  async deleteMailbox(id: string, adminId: string) {
    const mailbox = await this.getMailbox(id);

    await this.prisma.mailbox.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.provisioning.enqueueJob(ProvisionJobType.DELETE_MAILBOX, {
      mailboxId: id,
      domain: mailbox.domain.name,
      localPart: mailbox.localPart,
    });

    await this.logAudit(ActorType.ADMIN, adminId, 'mailbox.delete', 'Mailbox', id, {
      email: mailbox.email,
    });

    return { success: true };
  }

  // =========================================================================
  // ALIASES
  // =========================================================================

  async createAlias(dto: CreateAliasDto, adminId: string) {
    const mailbox = await this.prisma.mailbox.findFirst({
      where: { id: dto.destinationMailboxId, deletedAt: null },
      include: { domain: true },
    });
    if (!mailbox) {
      throw new NotFoundException('Destination mailbox not found');
    }

    const sourceAddress = dto.sourceAddress.toLowerCase().trim();
    const existing = await this.prisma.alias.findUnique({
      where: { sourceAddress },
    });
    if (existing) {
      throw new ConflictException(`Alias ${sourceAddress} already exists`);
    }

    const alias = await this.prisma.alias.create({
      data: {
        sourceAddress,
        destinationMailboxId: mailbox.id,
        domainId: mailbox.domainId,
        isActive: true,
      },
      include: { destinationMailbox: true },
    });

    await this.logAudit(ActorType.ADMIN, adminId, 'alias.create', 'Alias', alias.id, {
      source: alias.sourceAddress,
      destination: mailbox.email,
    });

    return alias;
  }

  async listAliases(page = 1, pageSize = 50, domainId?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = domainId ? { domainId } : {};

    const [aliases, total] = await Promise.all([
      this.prisma.alias.findMany({
        where,
        skip,
        take: pageSize,
        include: { destinationMailbox: true, domain: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.alias.count({ where }),
    ]);

    return {
      data: aliases.map((a) => ({
        id: a.id,
        sourceAddress: a.sourceAddress,
        destinationMailboxId: a.destinationMailboxId,
        destinationEmail: a.destinationMailbox.email,
        domainId: a.domainId,
        domainName: a.domain.name,
        isActive: a.isActive,
        createdAt: a.createdAt,
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async deleteAlias(id: string, adminId: string) {
    const alias = await this.prisma.alias.findUnique({ where: { id } });
    if (!alias) {
      throw new NotFoundException('Alias not found');
    }

    await this.prisma.alias.delete({ where: { id } });

    await this.logAudit(ActorType.ADMIN, adminId, 'alias.delete', 'Alias', id, {
      source: alias.sourceAddress,
    });

    return { success: true };
  }

  // =========================================================================
  // AUDIT LOGS
  // =========================================================================

  async getAuditLogs(page = 1, pageSize = 50, action?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = action ? { action } : {};

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  private async logAudit(
    actorType: ActorType,
    actorId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: any,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorType,
          actorId,
          action,
          resourceType,
          resourceId,
          details,
        },
      });
    } catch (e: any) {
      this.logger.warn(`Failed to write audit log: ${e.message}`);
    }
  }
}
