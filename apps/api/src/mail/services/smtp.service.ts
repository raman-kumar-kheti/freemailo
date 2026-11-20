import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMailDto } from '../dto/send-mail.dto';

@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to create a nodemailer transporter authenticated as the user
   */
  private createTransporter(senderEmail: string): nodemailer.Transporter {
    const host = process.env.POSTFIX_HOST || 'postfix';
    const port = parseInt(process.env.POSTFIX_SUBMISSION_PORT || '587', 10);
    const masterUser = process.env.DOVECOT_MASTER_USER || 'mailhive_master';
    const masterPassword = process.env.DOVECOT_MASTER_PASSWORD || 'mailhive_master_secret_2026';

    return nodemailer.createTransport({
      host,
      port,
      secure: false, // port 587 uses STARTTLS
      auth: {
        user: `${senderEmail}*${masterUser}`,
        pass: masterPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Send an email and save to Sent folder
   */
  async sendMail(
    senderEmail: string,
    sendMailDto: SendMailDto,
    files?: Array<Express.Multer.File>,
  ): Promise<{ messageId: string; success: boolean }> {
    const transporter = this.createTransporter(senderEmail);

    // If signatureId provided, fetch and append signature
    let htmlContent = sendMailDto.htmlBody || sendMailDto.textBody || '';
    if (sendMailDto.signatureId) {
      const signature = await this.prisma.signature.findUnique({
        where: { id: sendMailDto.signatureId },
      });
      if (signature) {
        htmlContent = `${htmlContent}<br><br>${signature.body}`;
      }
    }

    // Prepare attachments for nodemailer
    const attachments = (files || []).map((file) => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype,
    }));

    const mailOptions: nodemailer.SendMailOptions = {
      from: senderEmail,
      to: sendMailDto.to,
      cc: sendMailDto.cc,
      bcc: sendMailDto.bcc,
      subject: sendMailDto.subject,
      html: htmlContent,
      text: sendMailDto.textBody || undefined,
      inReplyTo: sendMailDto.inReplyTo,
      references: sendMailDto.references,
      attachments,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      this.logger.log(`Email sent from ${senderEmail} to ${sendMailDto.to.join(', ')} [${info.messageId}]`);

      // Save a copy of the sent message into the Sent IMAP folder
      this.saveToSentFolder(senderEmail, mailOptions, info.messageId).catch((err) => {
        this.logger.error(`Failed to copy message to Sent folder: ${err.message}`);
      });

      // Update contacts asynchronously for autocomplete
      this.recordContacts(senderEmail, [
        ...sendMailDto.to,
        ...(sendMailDto.cc || []),
        ...(sendMailDto.bcc || []),
      ]).catch(() => {});

      return {
        messageId: info.messageId,
        success: true,
      };
    } catch (err) {
      this.logger.error(`Failed to send email: ${err.message}`, err.stack);
      throw new BadRequestException(`Failed to send email: ${err.message}`);
    }
  }

  /**
   * Append sent message to Dovecot Sent folder
   */
  private async saveToSentFolder(
    senderEmail: string,
    mailOptions: nodemailer.SendMailOptions,
    messageId: string,
  ): Promise<void> {
    const host = process.env.DOVECOT_HOST || 'dovecot';
    const port = parseInt(process.env.DOVECOT_IMAP_PORT || '993', 10);
    const masterUser = process.env.DOVECOT_MASTER_USER || 'mailhive_master';
    const masterPassword = process.env.DOVECOT_MASTER_PASSWORD || 'mailhive_master_secret_2026';

    const client = new ImapFlow({
      host,
      port,
      secure: true,
      auth: {
        user: `${senderEmail}*${masterUser}`,
        pass: masterPassword,
      },
      tls: { rejectUnauthorized: false },
      logger: false,
    });

    try {
      await client.connect();

      // Render raw MIME message using nodemailer MailComposer
      const MailComposer = require('nodemailer/lib/mail-composer');
      const composer = new MailComposer({ ...mailOptions, messageId });
      const rawBuffer: Buffer = await new Promise((resolve, reject) => {
        composer.compile().build((err: any, message: Buffer) => {
          if (err) reject(err);
          else resolve(message);
        });
      });

      await client.append('Sent', rawBuffer, ['\\Seen']);
    } finally {
      await client.logout();
    }
  }

  /**
   * Record contacted emails for autocomplete suggestions
   */
  private async recordContacts(senderEmail: string, recipientEmails: string[]): Promise<void> {
    const mailbox = await this.prisma.mailbox.findFirst({
      where: {
        email: { equals: senderEmail, mode: 'insensitive' },
      },
    });

    if (!mailbox) return;

    for (const email of recipientEmails) {
      if (!email || !email.includes('@')) continue;
      const normalized = email.trim().toLowerCase();
      try {
        await this.prisma.contact.upsert({
          where: {
            mailboxId_email: {
              mailboxId: mailbox.id,
              email: normalized,
            },
          },
          create: {
            mailboxId: mailbox.id,
            email: normalized,
            contactCount: 1,
            lastContactedAt: new Date(),
          },
          update: {
            contactCount: { increment: 1 },
            lastContactedAt: new Date(),
          },
        });
      } catch (_) {}
    }
  }
}
