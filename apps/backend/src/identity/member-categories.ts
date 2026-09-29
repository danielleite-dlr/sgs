import type { TenantPrismaClient } from '../database/types';

const MAX_DEPTH = 32;

/**
 * Regra pura: o profissional atende a categoria do serviço quando a categoria
 * é uma das vinculadas OU descendente de uma vinculada. Sem nenhum vínculo,
 * atende tudo (fallback para ninguém sumir da agenda).
 *
 * `parentById` mapeia categoria -> pai (null na raiz). Um ciclo acidental em
 * parentId não entra em loop (visited set + limite de profundidade).
 */
export function memberServesCategory(
  memberCategoryIds: readonly string[],
  serviceCategoryId: string,
  parentById: ReadonlyMap<string, string | null>,
): boolean {
  if (memberCategoryIds.length === 0) return true;
  const linked = new Set(memberCategoryIds);
  const visited = new Set<string>();
  let current: string | null | undefined = serviceCategoryId;
  for (let depth = 0; current && depth < MAX_DEPTH; depth += 1) {
    if (linked.has(current)) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    current = parentById.get(current);
  }
  return false;
}

/** Carrega o mapa categoria -> pai da organização atual (sob RLS). */
export async function loadCategoryParents(
  tx: TenantPrismaClient,
): Promise<Map<string, string | null>> {
  // Soft-deletadas ficam no mapa: a hierarquia do serviço não deve quebrar
  // se um pai for apagado.
  const rows = await tx.category.findMany({
    select: { id: true, parentId: true },
  });
  return new Map(rows.map((r) => [r.id, r.parentId]));
}

/** Carrega os vínculos do profissional e aplica a regra. Sem vínculos: true. */
export async function professionalServesCategory(
  tx: TenantPrismaClient,
  memberId: string,
  serviceCategoryId: string,
): Promise<boolean> {
  const links = await tx.memberCategory.findMany({
    // Vínculo com categoria apagada não conta (sem vínculos válidos = atende tudo).
    where: { memberId, category: { deletedAt: null } },
    select: { categoryId: true },
  });
  if (links.length === 0) return true;
  const parents = await loadCategoryParents(tx);
  return memberServesCategory(
    links.map((l) => l.categoryId),
    serviceCategoryId,
    parents,
  );
}
