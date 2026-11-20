import { Module } from '@nestjs/common';
import { MailController } from './controllers/mail.controller';
import { ImapService } from './services/imap.service';
import { SmtpService } from './services/smtp.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [MailController],
  providers: [ImapService, SmtpService],
  exports: [ImapService, SmtpService],
})
export class MailModule {}
