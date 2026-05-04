import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { GraphqlModule } from './graphql/graphql.module';
import { QueueModule } from './queue/queue.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { envSchema } from './config/env.schema';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: (config: Record<string, unknown>) => {
        const result = envSchema.safeParse(config);
        if (!result.success) {
          throw new Error(
            `Environment validation error:\n${result.error.issues
              .map((i) => `  ${i.path.join('.')}: ${i.message}`)
              .join('\n')}`,
          );
        }
        return result.data;
      },
    }),
    AppConfigModule,
    DatabaseModule,
    GraphqlModule,
    QueueModule,
    EmailModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
