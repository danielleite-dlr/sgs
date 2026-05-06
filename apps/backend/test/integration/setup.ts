import { PrismaClient } from '@prisma/client';

/**
 * Privileged client uses DIRECT_URL (sgs_migrator, BYPASSRLS) for test setup/teardown only.
 * This client bypasses RLS so it can create and delete test data across tenants freely.
 */
export const adminPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL! } },
});

/**
 * App client uses DATABASE_URL (sgs_app via PgBouncer, transaction mode) for assertions.
 * This client is subject to RLS — it can only see data within the current tenant context.
 */
export const appPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL! } },
});

afterAll(async () => {
  // Clean up auth token rows older than reasonable thresholds to prevent
  // TokenService.rotateRefresh O(N) Argon2 scan growth across CI runs.
  await adminPrisma.$executeRawUnsafe(
    `DELETE FROM refresh_tokens WHERE issued_at < NOW() - INTERVAL '30 days'`,
  );
  await adminPrisma.$executeRawUnsafe(
    `DELETE FROM email_verification_tokens WHERE created_at < NOW() - INTERVAL '24 hours'`,
  );

  await adminPrisma.$disconnect();
  await appPrisma.$disconnect();
});
