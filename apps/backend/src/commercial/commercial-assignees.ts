import { loadAccessManyTx } from '../authz/access/access.service';
import type { TenantPrismaClient } from '../database/types';

/** Membros ativos que podem ser responsáveis no Comercial: Leads ou Pipeline ligados (fase 10, substitui a lista por papel). */
export async function eligibleAssigneeIds(
  tx: TenantPrismaClient,
  orgId: string,
): Promise<Set<string>> {
  const members = await tx.member.findMany({
    where: { organizationId: orgId, status: 'active', deletedAt: null },
    select: { id: true },
  });
  const access = await loadAccessManyTx(
    tx,
    members.map((m) => m.id),
  );
  const out = new Set<string>();
  for (const [id, a] of access) {
    if (a.items.get('comercial-leads')?.enabled || a.items.get('comercial-pipeline')?.enabled) {
      out.add(id);
    }
  }
  return out;
}
