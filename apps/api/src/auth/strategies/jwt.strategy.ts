import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  isMailbox: boolean;
  isAdmin: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          let token = null;
          if (req && req.cookies) {
            token = req.cookies['access_token'];
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.isAdmin) {
      const admin = await this.prisma.adminUser.findUnique({
        where: { id: payload.sub },
      });
      if (!admin) {
        throw new UnauthorizedException('Admin account not found or disabled');
      }
      return {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
        role: admin.role,
        isAdmin: true,
        isMailbox: false,
      };
    } else {
      const mailbox = await this.prisma.mailbox.findUnique({
        where: { id: payload.sub },
        include: { domain: true },
      });
      if (!mailbox || !mailbox.isActive || mailbox.deletedAt || !mailbox.domain.isActive || mailbox.domain.deletedAt) {
        throw new UnauthorizedException('Mailbox account inactive or not found');
      }
      return {
        id: mailbox.id,
        email: mailbox.email,
        displayName: mailbox.displayName,
        domainId: mailbox.domainId,
        role: 'MAILBOX',
        isAdmin: false,
        isMailbox: true,
      };
    }
  }
}
