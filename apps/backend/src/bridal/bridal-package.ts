import type { TenantPrismaClient } from '../database/types';

/**
 * Adiciona à noiva (como 'event') os serviços do pacote que ela ainda não tem.
 * Nunca remove serviços; quantity > 1 vira uma linha só (unique por serviço/propósito).
 * Não aplica MAX_SERVICES_PER_PERSON: a lista vem do catálogo, não de input manual.
 */
export async function applyPackageToBrideTx(
  tx: TenantPrismaClient,
  orgId: string,
  groupId: string,
  packageId: string,
): Promise<void> {
  const bride = await tx.bridalGroupMember.findFirst({
    where: { groupId, role: 'bride' },
    select: { id: true },
  });
  if (!bride) return;
  const pkgServices = await tx.packageService.findMany({
    where: { packageId, service: { deletedAt: null } },
    orderBy: { displayOrder: 'asc' },
    select: { serviceId: true },
  });
  const current = await tx.bridalMemberService.findMany({
    where: { groupMemberId: bride.id },
    select: { serviceId: true, purpose: true, sortOrder: true },
  });
  const hasEvent = new Set(current.filter((c) => c.purpose === 'event').map((c) => c.serviceId));
  const missing = [...new Set(pkgServices.map((s) => s.serviceId))].filter(
    (id) => !hasEvent.has(id),
  );
  if (missing.length === 0) return;
  const maxSort = current.reduce((m, c) => Math.max(m, c.sortOrder), -1);
  await tx.bridalMemberService.createMany({
    data: missing.map((serviceId, i) => ({
      organizationId: orgId,
      groupMemberId: bride.id,
      serviceId,
      purpose: 'event',
      sortOrder: maxSort + 1 + i,
    })),
    skipDuplicates: true,
  });
}
