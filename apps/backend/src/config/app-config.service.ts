import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from './env.schema';

/**
 * Typed wrapper around ConfigService for SGS application configuration.
 * Provides typed access to all environment variables validated by env.schema.ts.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get directDatabaseUrl(): string {
    return this.config.get('DIRECT_DATABASE_URL', { infer: true });
  }

  get redisUrl(): string {
    return this.config.get('REDIS_URL', { infer: true });
  }

  get meilisearchUrl(): string {
    return this.config.get('MEILISEARCH_URL', { infer: true });
  }

  get meilisearchKey(): string {
    return this.config.get('MEILISEARCH_KEY', { infer: true });
  }

  get jwtSecret(): string {
    return this.config.get('JWT_SECRET', { infer: true });
  }

  get jwtRefreshSecret(): string {
    return this.config.get('JWT_REFRESH_SECRET', { infer: true });
  }

  get jwtAccessExpiresIn(): string {
    return this.config.get('JWT_ACCESS_EXPIRES_IN', { infer: true });
  }

  get jwtRefreshExpiresIn(): string {
    return this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true });
  }

  get resendApiKey(): string | undefined {
    return this.config.get('RESEND_API_KEY', { infer: true });
  }

  get emailFrom(): string {
    return this.config.get('EMAIL_FROM', { infer: true });
  }

  get frontendUrl(): string {
    return this.config.get('FRONTEND_URL', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }
}
