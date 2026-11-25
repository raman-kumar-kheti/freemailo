import {
  createMailClient,
  closeMailClient,
} from "../mail/services/mail-connection";
import { accessTokenSeconds, refreshTokenSeconds } from "./token-lifetime";
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  Logger,
  Optional,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import * as crypto from "crypto";
import { promises as fs } from "fs";
import * as path from "path";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import { ProvisioningService } from "../provisioning/provisioning.service";
import { ProvisionJobType, ActorType } from "@prisma/client";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Optional() private provisioning?: ProvisioningService,
  ) {}

  /**
   * Helper to verify password against Argon2id hash (with or without {ARGON2ID} prefix).
   */
  async verifyPassword(
    storedHash: string,
    plainText: string,
  ): Promise<boolean> {
    try {
      const cleanHash = storedHash.startsWith("{ARGON2ID}")
        ? storedHash.replace("{ARGON2ID}", "")
        : storedHash;
      return await argon2.verify(cleanHash, plainText);
    } catch (e) {
      return false;
    }
  }

  /**
   * Hash password compatible with Dovecot {ARGON2ID}
   */
  async hashPassword(plainText: string): Promise<string> {
    const rawHash = await argon2.hash(plainText, {
      type: argon2.argon2id,
    });
    return `{ARGON2ID}${rawHash}`;
  }

  /**
   * Mailbox user login
   */
  async loginMailbox(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const mailbox = await this.prisma.mailbox.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { domain: true },
    });

    if (
      !mailbox ||
      !mailbox.isActive ||
      mailbox.deletedAt ||
      !mailbox.domain.isActive ||
      mailbox.domain.deletedAt
    ) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Dovecot is the mailbox authentication authority; database hashes are used
    // directly only for the separate administrator identity.
    const client = createMailClient(mailbox.email, dto.password);
    try {
      await client.connect();
    } catch (error) {
      if (
        error.authenticationFailed ||
        /Authentication/i.test(error.code || "")
      )
        throw new UnauthorizedException("Invalid email or password");
      throw new ServiceUnavailableException(
        "Mailbox authentication is temporarily unavailable",
      );
    } finally {
      await closeMailClient(client);
    }

    // Update last login
    await this.prisma.mailbox.update({
      where: { id: mailbox.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens({
      sub: mailbox.id,
      email: mailbox.email,
      role: "MAILBOX",
      isMailbox: true,
      isAdmin: false,
    });

    // Store refresh token
    await this.storeRefreshToken(
      mailbox.id,
      null,
      tokens.refreshToken,
      ipAddress,
      userAgent,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: accessTokenSeconds(), // 15 mins
      user: {
        id: mailbox.id,
        email: mailbox.email,
        displayName: mailbox.displayName,
        role: "MAILBOX",
        domain: mailbox.domain.name,
      },
    };
  }

  /**
   * Admin user login
   */
  async loginAdmin(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!admin) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isValid = await this.verifyPassword(admin.passwordHash, dto.password);
    if (!isValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      isMailbox: false,
      isAdmin: true,
    });

    await this.storeRefreshToken(
      null,
      admin.id,
      tokens.refreshToken,
      ipAddress,
      userAgent,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: accessTokenSeconds(),
      user: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
        role: admin.role,
      },
    };
  }

  /**
   * Token refresh with automatic rotation
   */
  async refreshTokens(
    refreshTokenStr: string,
    ipAddress?: string,
    userAgent?: string,
    expectedType?: "admin" | "mailbox",
  ) {
    if (!refreshTokenStr) {
      throw new UnauthorizedException("Refresh token missing");
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(refreshTokenStr)
      .digest("hex");

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { mailbox: { include: { domain: true } }, adminUser: true },
    });

    if (
      !tokenRecord ||
      tokenRecord.revokedAt ||
      new Date() > tokenRecord.expiresAt
    ) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    let payload: any;
    let adminId: string | null = null;
    let mailboxId: string | null = null;

    if (tokenRecord.adminUserId && tokenRecord.adminUser) {
      if (expectedType === "mailbox") {
        throw new UnauthorizedException("Mailbox refresh token required");
      }
      adminId = tokenRecord.adminUserId;
      payload = {
        sub: tokenRecord.adminUser.id,
        email: tokenRecord.adminUser.email,
        role: tokenRecord.adminUser.role,
        isMailbox: false,
        isAdmin: true,
      };
    } else if (tokenRecord.mailboxId && tokenRecord.mailbox) {
      if (expectedType === "admin") {
        throw new UnauthorizedException("Admin refresh token required");
      }
      const mailbox = tokenRecord.mailbox;
      if (
        !mailbox.isActive ||
        mailbox.deletedAt ||
        !mailbox.domain.isActive ||
        mailbox.domain.deletedAt
      ) {
        throw new UnauthorizedException("Mailbox account inactive");
      }
      mailboxId = tokenRecord.mailboxId;
      payload = {
        sub: tokenRecord.mailbox.id,
        email: tokenRecord.mailbox.email,
        role: "MAILBOX",
        isMailbox: true,
        isAdmin: false,
      };
    } else {
      throw new UnauthorizedException("Invalid token owner");
    }

    const newTokens = await this.generateTokens(payload);
    // Compare-and-set inside a transaction: concurrent use can rotate only once.
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: {
          id: tokenRecord.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1)
        throw new UnauthorizedException("Refresh token already used");
      await tx.refreshToken.create({
        data: {
          token: crypto
            .createHash("sha256")
            .update(newTokens.refreshToken)
            .digest("hex"),
          mailboxId,
          adminUserId: adminId,
          expiresAt: new Date(Date.now() + refreshTokenSeconds() * 1000),
          ipAddress,
          deviceInfo: userAgent,
        },
      });
    });

    return {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresIn: accessTokenSeconds(),
      isAdmin: Boolean(adminId),
    };
  }

  /**
   * Logout and revoke refresh token
   */
  async logout(refreshTokenStr: string) {
    if (!refreshTokenStr) return;
    const hashedToken = crypto
      .createHash("sha256")
      .update(refreshTokenStr)
      .digest("hex");
    await this.prisma.refreshToken.updateMany({
      where: { token: hashedToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async generateTokens(payload: any) {
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenSeconds(),
    });
    const refreshToken = crypto.randomBytes(40).toString("hex");
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(
    mailboxId: string | null,
    adminUserId: string | null,
    rawToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date();
    expiresAt.setTime(Date.now() + refreshTokenSeconds() * 1000); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        token: hashedToken,
        mailboxId,
        adminUserId,
        expiresAt,
        ipAddress,
        deviceInfo: userAgent,
      },
    });
  }

  /**
   * Get public active domains for mailbox registration
   */
  async getPublicDomains() {
    const domains = await this.prisma.domain.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    return { data: domains };
  }

  /**
   * Check if a proposed username is available on a specific domain
   */
  async checkAvailability(username: string, domainId: string) {
    const localPart = username.toLowerCase().trim();
    const domain = await this.prisma.domain.findFirst({
      where: { id: domainId, isActive: true, deletedAt: null },
    });
    if (!domain) {
      throw new NotFoundException("Domain not found or is inactive");
    }

    const email = `${localPart}@${domain.name}`;

    const [existingMailbox, existingAlias] = await Promise.all([
      this.prisma.mailbox.findFirst({
        where: {
          localPart,
          domainId: domain.id,
          deletedAt: null,
        },
      }),
      this.prisma.alias.findFirst({
        where: {
          sourceAddress: email,
        },
      }),
    ]);

    const available = !existingMailbox && !existingAlias;

    return {
      available,
      email,
      domain: domain.name,
      message: available
        ? "Email address is available"
        : "Email address is already in use",
    };
  }

  /**
   * Self-service mailbox user signup
   */
  async signup(dto: SignupDto, ipAddress?: string, userAgent?: string) {
    const domain = await this.prisma.domain.findFirst({
      where: { id: dto.domainId, isActive: true, deletedAt: null },
    });
    if (!domain) {
      throw new BadRequestException("Selected domain is invalid or inactive");
    }

    const localPart = dto.username.toLowerCase().trim();
    const email = `${localPart}@${domain.name}`;

    // Ensure email is not already taken by mailbox or alias
    const [existingMailbox, existingAlias] = await Promise.all([
      this.prisma.mailbox.findFirst({
        where: {
          localPart,
          domainId: domain.id,
          deletedAt: null,
        },
      }),
      this.prisma.alias.findFirst({
        where: {
          sourceAddress: email,
        },
      }),
    ]);

    if (existingMailbox || existingAlias) {
      throw new ConflictException(`Email address ${email} is already taken`);
    }

    const passwordHash = await this.hashPassword(dto.password);

    const nameParts = [dto.firstName.trim()];
    if (dto.middleName?.trim()) nameParts.push(dto.middleName.trim());
    nameParts.push(dto.lastName.trim());
    const displayName = nameParts.join(" ");

    const dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    const recoveryEmail = dto.recoveryEmail?.trim().toLowerCase() || null;

    const mailbox = await this.prisma.mailbox.create({
      data: {
        localPart,
        domainId: domain.id,
        email,
        passwordHash,
        displayName,
        firstName: dto.firstName.trim(),
        middleName: dto.middleName?.trim() || null,
        lastName: dto.lastName.trim(),
        dateOfBirth,
        recoveryEmail,
        quotaBytes: BigInt(1073741824), // 1 GB default quota
        isActive: true,
      },
      include: { domain: true },
    });

    // Create 7 standard system labels for the mailbox
    const defaultLabels = [
      "Inbox",
      "Starred",
      "Sent",
      "Drafts",
      "Spam",
      "Trash",
      "All Mail",
    ];
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

    // Enqueue BullMQ job to create Maildir with correct vmail permissions
    if (this.provisioning) {
      try {
        await this.provisioning.enqueueJob(ProvisionJobType.CREATE_MAILBOX, {
          mailboxId: mailbox.id,
          email: mailbox.email,
          domain: domain.name,
          localPart: mailbox.localPart,
        });
      } catch (err: any) {
        this.logger.warn(`Failed to enqueue provisioning job: ${err?.message}`);
      }
    }

    // Directly create the Maildir directories on the volume if path is mounted
    try {
      const vmailRoot = process.env.VMAIL_ROOT || "/var/vmail";
      for (const folder of ["cur", "new", "tmp"]) {
        await fs.mkdir(
          path.join(vmailRoot, domain.name, localPart, "Maildir", folder),
          { recursive: true, mode: 0o700 },
        );
      }
    } catch (e: any) {
      this.logger.warn(
        `Direct Maildir creation note: ${e?.message}`,
      );
    }

    // Write audit log
    try {
      await this.prisma.auditLog.create({
        data: {
          actorType: ActorType.MAILBOX,
          actorId: mailbox.id,
          action: "mailbox.signup",
          resourceType: "Mailbox",
          resourceId: mailbox.id,
          ipAddress: ipAddress || null,
          details: {
            email: mailbox.email,
            domain: domain.name,
            recoveryEmail: mailbox.recoveryEmail,
          },
        },
      });
    } catch (e: any) {
      this.logger.warn(`Failed to write signup audit log: ${e.message}`);
    }

    // Generate JWT tokens and create active session
    const tokens = await this.generateTokens({
      sub: mailbox.id,
      email: mailbox.email,
      role: "MAILBOX",
      isMailbox: true,
      isAdmin: false,
    });

    await this.storeRefreshToken(
      mailbox.id,
      null,
      tokens.refreshToken,
      ipAddress,
      userAgent,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: accessTokenSeconds(),
      user: {
        id: mailbox.id,
        email: mailbox.email,
        displayName: mailbox.displayName,
        firstName: mailbox.firstName,
        lastName: mailbox.lastName,
        role: "MAILBOX",
        domain: domain.name,
      },
    };
  }
}
