import { Prisma } from "@prisma/client";
import type { TenantPrismaClient } from "./types";

/**
 * Locks de agenda. Apenas locks de TRANSAÇÃO (`pg_advisory_xact_*`): locks de
 * sessão são proibidos com PgBouncer em transaction mode.
 */
const NS = "sgs:sched";
export const LOCK_TIMEOUT_MS = 3000;

export const orgLockKey = (orgId: string) => `${NS}:org:${orgId}`;
export const professionalLockKey = (orgId: string, professionalId: string) =>
  `${NS}:pro:${orgId}:${professionalId}`;

export async function setLockTimeout(
  tx: TenantPrismaClient,
  ms = LOCK_TIMEOUT_MS,
): Promise<void> {
  // ms é número interno, nunca input do usuário.
  await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${Math.trunc(ms)}ms'`);
}

export async function lockOrgShared(
  tx: TenantPrismaClient,
  orgId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${orgLockKey(orgId)}, 0))`;
}

export async function lockOrgExclusive(
  tx: TenantPrismaClient,
  orgId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${orgLockKey(orgId)}, 0))`;
}

export async function lockProfessional(
  tx: TenantPrismaClient,
  orgId: string,
  professionalId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${professionalLockKey(orgId, professionalId)}, 0))`;
}

/** SQLSTATE vindo de erro do Prisma (meta.code em raw queries; mensagem como fallback). */
export function isPgError(e: unknown, sqlstate: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const metaCode = (e.meta as { code?: string } | undefined)?.code;
  return metaCode === sqlstate || e.message.includes(sqlstate);
}

export const isLockTimeout = (e: unknown): boolean => isPgError(e, "55P03");

export const isExclusionViolation = (e: unknown): boolean =>
  isPgError(e, "23P01") ||
  (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2004");
