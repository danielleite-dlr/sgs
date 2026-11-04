import { z } from 'zod';

export const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database (via PgBouncer for app, direct for migrations)
  DATABASE_URL: z
    .string()
    .url()
    .describe('PgBouncer connection string for app runtime (sgs_app role)'),
  DIRECT_URL: z
    .string()
    .url()
    .describe(
      'Direct PostgreSQL connection string for Prisma migrations (sgs_migrator role)',
    ),

  // Valkey / Redis
  REDIS_URL: z
    .string()
    .url()
    .default('redis://localhost:6379')
    .describe('Valkey/Redis connection URL for BullMQ and cache'),

  // Meilisearch
  MEILISEARCH_URL: z
    .string()
    .url()
    .default('http://localhost:7700')
    .describe('Meilisearch instance URL'),
  MEILISEARCH_KEY: z
    .string()
    .min(16)
    .describe('Meilisearch master key (min 16 chars)'),

  // JWT
  JWT_SECRET: z
    .string()
    .min(32)
    .describe('JWT access token signing secret (min 32 chars)'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32)
    .describe('JWT refresh token signing secret (min 32 chars)'),
  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .default('15m')
    .describe('JWT access token TTL (e.g. 15m)'),
  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .default('30d')
    .describe('JWT refresh token TTL (e.g. 30d)'),

  // Email (Resend)
  RESEND_API_KEY: z
    .string()
    .optional()
    .describe('Resend API key for transactional emails'),
  EMAIL_FROM: z
    .string()
    .email()
    .default('noreply@sgs.app')
    .describe('Default from address for transactional emails'),

  EMAIL_OUTBOX_DIR: z
    .string()
    .optional()
    .describe(
      'Somente dev/test/E2E: grava e-mails como JSON neste diretório em vez de enviar. Ignorado em production.',
    ),

  // Fase 4 — IA da agenda de noivas (opcional: sem chave usa a heurística)
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined))
    .describe('Anthropic API key; ausente => sugestão de agenda por heurística'),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-sonnet-5-5'),
  AI_SCHEDULE_DAILY_LIMIT: z.coerce
    .number()
    .int()
    .min(0)
    .default(20)
    .describe('Limite diário de chamadas ao Claude por organização'),
  CONTRACT_ALERTS_SCHEDULER: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true')
    .describe('Liga o agendador BullMQ dos alertas de contrato'),

  // Frontend
  FRONTEND_URL: z
    .string()
    .url()
    .default('http://localhost:5173')
    .describe('Frontend app URL for CORS and email links'),
});

export type Env = z.infer<typeof envSchema>;
