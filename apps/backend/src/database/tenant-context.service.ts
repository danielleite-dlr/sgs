import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import type { TenantPrismaClient } from './types';

@Injectable()
export class TenantContextService {
  private readonly logger = new Logger(TenantContextService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs `fn` inside a Prisma transaction with `app.current_organization` set
   * to `organizationId` for the entirety of the transaction. The setting is
   * reset on commit/rollback because SET LOCAL is transaction-scoped.
   *
   * CRITICAL: never use bare `SET` here — that would leak across pooled connections
   * via PgBouncer transaction-mode reuse. See PITFALLS.md.
   *
   * @param organizationId - UUID of the organization to scope queries to
   * @param fn - Callback receiving the transaction-scoped Prisma client
   * @returns The value returned by fn
   */
  async runWithTenant<T>(
    organizationId: string,
    fn: (tx: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    if (!isUuid(organizationId)) {
      throw new Error(
        `runWithTenant: invalid organizationId "${organizationId}"`,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      // SET LOCAL is transaction-scoped: automatically reset on commit or rollback.
      // organizationId has already been validated as a UUID — no SQL injection risk.
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_organization = '${organizationId}'`,
      );
      return fn(tx as unknown as TenantPrismaClient);
    });
  }

  /**
   * Runs `fn` with NO tenant set — for platform-level operations such as
   * login email lookup and organization signup.
   *
   * CAUTION: tenant-scoped tables will return 0 rows (fail-closed safety).
   * Only use this for tables that are NOT tenant-scoped (users, refresh_tokens,
   * email_verification_tokens).
   *
   * @param fn - Callback receiving the transaction-scoped Prisma client
   * @returns The value returned by fn
   */
  async runWithoutTenant<T>(
    fn: (tx: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`RESET app.current_organization`);
      return fn(tx as unknown as TenantPrismaClient);
    });
  }
}

/**
 * Validates that a string matches the standard UUID v4/v7 format.
 * Used to prevent SQL injection in the SET LOCAL statement.
 */
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  );
}
