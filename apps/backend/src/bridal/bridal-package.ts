import type { TenantPrismaClient } from '../database/types';

/**
 * Adiciona à noiva (como 'event') os serviços do pacote que ela ainda não tem e, para os
 * serviços com teste incluso (package_services.includes_trial, 261108-n2o), também a linha
 * 'trial' — para o teste aparecer no agendamento do grupo.
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
    select: { serviceId: true, includesTrial: true },
  });
  const current = await tx.bridalMemberService.findMany({
    where: { groupMemberId: bride.id },
    select: { serviceId: true, purpose: true, sortOrder: true },
  });
  const has = new Set(current.map((c) => `${c.serviceId}|${c.purpose}`));
  const missing: { serviceId: string; purpose: 'event' | 'trial' }[] = [];
  const seen = new Set<string>();
  const push = (serviceId: string, purpose: 'event' | 'trial') => {
    const k = `${serviceId}|${purpose}`;
    if (has.has(k) || seen.has(k)) return;
    seen.add(k);
    missing.push({ serviceId, purpose });
  };
  for (const s of pkgServices) {
    push(s.serviceId, 'event');
    if (s.includesTrial) push(s.serviceId, 'trial');
  }
  if (missing.length === 0) return;
  const maxSort = current.reduce((m, c) => Math.max(m, c.sortOrder), -1);
  await tx.bridalMemberService.createMany({
    data: missing.map((m, i) => ({
      organizationId: orgId,
      groupMemberId: bride.id,
      serviceId: m.serviceId,
      purpose: m.purpose,
      sortOrder: maxSort + 1 + i,
    })),
    skipDuplicates: true,
  });
}
