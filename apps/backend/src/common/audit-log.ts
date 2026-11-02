import type { Prisma } from '@prisma/client';
import type { TenantPrismaClient } from '../database/types';

/**
 * Grava uma linha em audit_log (append-only). Sempre dentro da transação do
 * chamador (`tx`): a auditoria faz ROLLBACK junto com a operação auditada.
 */
export async function recordAudit(
  tx: TenantPrismaClient,
  a: {
    orgId: string;
    actorMemberId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      organizationId: a.orgId,
      actorMemberId: a.actorMemberId,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      reason: a.reason ?? null,
      metadata: (a.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
