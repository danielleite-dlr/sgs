import type { Prisma } from '@prisma/client';

/**
 * The Prisma client passed to a runWithTenant callback. It IS a transaction client.
 * Use this type instead of PrismaClient for repositories operating inside tenant scope.
 *
 * Omitting $transaction prevents callers from nesting transactions, which would
 * break the SET LOCAL scoping guarantee.
 */
export type TenantPrismaClient = Omit<Prisma.TransactionClient, '$transaction'>;
