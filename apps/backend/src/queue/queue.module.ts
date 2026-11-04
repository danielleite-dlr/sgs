import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigService } from '../config/app-config.service';

/**
 * QueueModule — registers BullMQ globally against Valkey.
 * No queue definitions in Phase 1. Future plans use @InjectQueue() to define queues.
 * Satisfies INFRA-03: BullMQ wired to Valkey 8 (Redis 7.2 binary-compatible).
 * AppConfigService is available via the global AppConfigModule.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const url = new URL(config.redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            // Credenciais opcionais via REDIS_URL (redis://[user]:senha@host:porta)
            username: url.username ? decodeURIComponent(url.username) : undefined,
            password: url.password ? decodeURIComponent(url.password) : undefined,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: { age: 3600, count: 100 },
            removeOnFail: { age: 24 * 3600 },
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
