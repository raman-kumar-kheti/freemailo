import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import {
  createMailClient,
  closeMailClient,
  mailTlsOptions,
  masterAuth,
} from "./mail-connection";
import { PrismaService } from "../../prisma/prisma.service";
import { SendMailDto } from "../dto/send-mail.dto";

@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to create a nodemailer transporter authenticated as the user
   */
  private createTransporter(senderEmail: string): nodemailer.Transporter {
    const host = process.env.POSTFIX_HOST || "postfix";
    const port = parseInt(process.env.POSTFIX_SUBMISSION_PORT || "587", 10);
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: true,
      auth: masterAuth(senderEmail),
      tls: mailTlsOptions(),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  /**
   * Send an email and save to Sent folder
   */
  async sendMail(
    senderEmail: string,
    sendMailDto: SendMailDto,
    files?: Array<Express.Multer.File>,
  ): Promise<{ messageId: string; success: boolean; sentCopySaved: boolean }> {
    const totalBytes = (files || []).reduce(
      (total, file) => total + file.size,
      0,
    );
    if (totalBytes > 18 * 1024 * 1024)
      throw new BadRequestException("Attachments must total at most 18 MiB");
    const transporter = this.createTransporter(senderEmail);

    // If signatureId provided, fetch and append signature
    let htmlContent = sendMailDto.htmlBody;
    if (sendMailDto.signatureId) {
      const signature = await this.prisma.signature.findFirst({
        where: { id: sendMailDto.signatureId, mailbox: { email: senderEmail } },
      });
      if (!signature) throw new BadRequestException("Signature not found");
      if (signature) {
        htmlContent = `${htmlContent || ""}<br><br>${signature.body}`;
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
      this.logger.log(
        `Email sent from ${senderEmail} to ${sendMailDto.to.join(", ")} [${info.messageId}]`,
      );

      // SMTP has accepted the message. A Sent-copy failure must never encourage
      // resending the message; return a distinct status after attempting append.
      let sentCopySaved = true;
      try {
        await this.saveToSentFolder(senderEmail, mailOptions, info.messageId);
      } catch (error) {
        sentCopySaved = false;
        this.logger.error("Message accepted but Sent copy failed");
      }

      // Update contacts asynchronously for autocomplete
      this.recordContacts(senderEmail, [
        ...sendMailDto.to,
        ...(sendMailDto.cc || []),
        ...(sendMailDto.bcc || []),
      ]).catch(() => {});

      return {
        messageId: info.messageId,
        success: true,
        sentCopySaved,
      };
    } catch (err) {
      this.logger.error("Mail submission failed; please try again", err.stack);
      throw new BadRequestException("Mail submission failed; please try again");
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
    const client = createMailClient(senderEmail);

    try {
      await client.connect();

      // Render raw MIME message using nodemailer MailComposer
      const MailComposer = require("nodemailer/lib/mail-composer");
      const composer = new MailComposer({ ...mailOptions, messageId });
      const compiled = composer.compile();
      compiled.keepBcc = true;
      const rawBuffer: Buffer = await new Promise((resolve, reject) => {
        compiled.build((err: any, message: Buffer) => {
          if (err) reject(err);
          else resolve(message);
        });
      });

      await client.append("Sent", rawBuffer, ["\\Seen"]);
    } finally {
      await closeMailClient(client);
    }
  }

  /**
   * Record contacted emails for autocomplete suggestions
   */
  private async recordContacts(
    senderEmail: string,
    recipientEmails: string[],
  ): Promise<void> {
    const mailbox = await this.prisma.mailbox.findFirst({
      where: {
        email: { equals: senderEmail, mode: "insensitive" },
      },
    });

    if (!mailbox) return;

    for (const email of recipientEmails) {
      if (!email || !email.includes("@")) continue;
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
