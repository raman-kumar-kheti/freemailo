import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { AdminModule } from './admin/admin.module';
import { MailModule } from './mail/mail.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.dev', '../../.env.dev', '.env', '../../.env'],
    }),
    PrismaModule,
    RedisModule,
    ProvisioningModule,
    AuthModule,
    AdminModule,
    MailModule,
    SettingsModule,
  ],
})
export class AppModule {}
