import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { AdminModule } from './admin/admin.module';
import { MailModule } from './mail/mail.module';
import { SettingsModule } from './settings/settings.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? ['.env'] : ['.env', '../../.env', '.env.dev', '../../.env.dev'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 30, // 30 req/sec burst
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 200, // 200 req/min standard
      },
    ]),
    PrismaModule,
    RedisModule,
    ProvisioningModule,
    AuthModule,
    AdminModule,
    MailModule,
    SettingsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

