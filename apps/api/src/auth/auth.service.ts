import {
  createMailClient,
  closeMailClient,
} from "../mail/services/mail-connection";
import { accessTokenSeconds, refreshTokenSeconds } from "./token-lifetime";
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
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
      adminId = tokenRecord.adminUserId;
      payload = {
        sub: tokenRecord.adminUser.id,
        email: tokenRecord.adminUser.email,
        role: tokenRecord.adminUser.role,
        isMailbox: false,
        isAdmin: true,
      };
    } else if (tokenRecord.mailboxId && tokenRecord.mailbox) {
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
}
