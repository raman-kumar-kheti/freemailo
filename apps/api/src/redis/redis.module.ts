import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6380),
          password: config.get<string>('REDIS_PASSWORD'),
          maxRetriesPerRequest: null,
        },
      }),
    }),
  ],
  providers: [RedisService],
  exports: [BullModule, RedisService],
})
export class RedisModule {}
export { RedisService } from './redis.service';
