import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { CreateSignatureDto, UpdateSignatureDto } from '../dto/signature.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { CreateLabelDto, UpdateLabelDto } from '../dto/label.dto';
import { VacationResponderDto } from '../dto/vacation.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProfile(mailboxId: string) {
    const mailbox = await this.prisma.mailbox.findUnique({
      where: { id: mailboxId },
      select: { email: true, displayName: true },
    });
    if (!mailbox) throw new NotFoundException('Mailbox not found');
    return mailbox;
  }

  async updateProfile(mailboxId: string, dto: UpdateProfileDto) {
    return this.prisma.mailbox.update({
      where: { id: mailboxId },
      data: { displayName: dto.displayName },
      select: { email: true, displayName: true },
    });
  }

  async listSignatures(mailboxId: string) {
    const signatures = await this.prisma.signature.findMany({
      where: { mailboxId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return { signatures };
  }

  async createSignature(mailboxId: string, dto: CreateSignatureDto) {
    if (dto.isDefault) {
      await this.prisma.signature.updateMany({
        where: { mailboxId },
        data: { isDefault: false },
      });
    }

    return this.prisma.signature.create({
      data: {
        mailboxId,
        name: dto.name,
        body: dto.body,
        isDefault: dto.isDefault || false,
      },
    });
  }

  async updateSignature(mailboxId: string, id: string, dto: UpdateSignatureDto) {
    const existing = await this.prisma.signature.findFirst({
      where: { id, mailboxId },
    });
    if (!existing) throw new NotFoundException('Signature not found');

    if (dto.isDefault) {
      await this.prisma.signature.updateMany({
        where: { mailboxId, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.signature.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.body && { body: dto.body }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });
  }

  async deleteSignature(mailboxId: string, id: string) {
    const existing = await this.prisma.signature.findFirst({
      where: { id, mailboxId },
    });
    if (!existing) throw new NotFoundException('Signature not found');

    await this.prisma.signature.delete({ where: { id } });
  }

  async changePassword(mailboxId: string, dto: ChangePasswordDto) {
    const mailbox = await this.prisma.mailbox.findUnique({
      where: { id: mailboxId },
    });
    if (!mailbox) throw new NotFoundException('Mailbox not found');

    // Verify current password
    let currentHash = mailbox.passwordHash;
    if (currentHash.startsWith('{ARGON2ID}')) {
      currentHash = currentHash.replace('{ARGON2ID}', '');
    }

    const isValid = await argon2.verify(currentHash, dto.currentPassword);
    if (!isValid) {
      throw new BadRequestException('Current password does not match');
    }

    // Hash new password with Argon2id format for Dovecot
    const rawHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    const formattedHash = `{ARGON2ID}${rawHash}`;

    await this.prisma.mailbox.update({
      where: { id: mailboxId },
      data: { passwordHash: formattedHash },
    });
  }

  async listLabels(mailboxId: string) {
    const labels = await this.prisma.label.findMany({
      where: { mailboxId },
      orderBy: { name: 'asc' },
    });
    return { labels };
  }

  async createLabel(mailboxId: string, dto: CreateLabelDto) {
    return this.prisma.label.create({
      data: {
        mailboxId,
        name: dto.name,
        color: dto.color,
      },
    });
  }

  async updateLabel(mailboxId: string, id: string, dto: UpdateLabelDto) {
    const existing = await this.prisma.label.findFirst({
      where: { id, mailboxId },
    });
    if (!existing) throw new NotFoundException('Label not found');

    return this.prisma.label.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
    });
  }

  async deleteLabel(mailboxId: string, id: string) {
    const existing = await this.prisma.label.findFirst({
      where: { id, mailboxId },
    });
    if (!existing) throw new NotFoundException('Label not found');
    if (existing.isSystem) throw new BadRequestException('Cannot delete a system label');

    await this.prisma.label.delete({ where: { id } });
  }

  async getVacationResponder(mailboxId: string) {
    const responder = await this.prisma.vacationResponder.findUnique({
      where: { mailboxId },
    });
    if (!responder) {
      return {
        isActive: false,
        subject: '',
        body: '',
        startDate: null,
        endDate: null,
      };
    }
    return responder;
  }

  async saveVacationResponder(mailboxId: string, dto: VacationResponderDto) {
    return this.prisma.vacationResponder.upsert({
      where: { mailboxId },
      create: {
        mailboxId,
        isActive: dto.isActive,
        subject: dto.subject,
        body: dto.body,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      update: {
        isActive: dto.isActive,
        subject: dto.subject,
        body: dto.body,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async listTrustedSenders(mailboxId: string) {
    const senders = await this.prisma.trustedSender.findMany({
      where: { mailboxId },
      orderBy: { createdAt: 'desc' },
    });
    return { senders };
  }

  async addTrustedSender(mailboxId: string, email: string) {
    return this.prisma.trustedSender.upsert({
      where: {
        mailboxId_email: {
          mailboxId,
          email: email.toLowerCase(),
        },
      },
      create: {
        mailboxId,
        email: email.toLowerCase(),
      },
      update: {},
    });
  }

  async deleteTrustedSender(mailboxId: string, id: string) {
    await this.prisma.trustedSender.deleteMany({
      where: { id, mailboxId },
    });
  }

  async getContacts(mailboxId: string, query?: string, limit = 10) {
    const whereClause: any = { mailboxId };
    if (query && query.trim()) {
      whereClause.OR = [
        { email: { contains: query.trim(), mode: 'insensitive' } },
        { displayName: { contains: query.trim(), mode: 'insensitive' } },
      ];
    }

    const contacts = await this.prisma.contact.findMany({
      where: whereClause,
      orderBy: [{ contactCount: 'desc' }, { lastContactedAt: 'desc' }],
      take: Math.min(limit, 50),
    });

    return { contacts };
  }
}
