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
  await adminPrisma.$disconnect();
  await appPrisma.$disconnect();
});
