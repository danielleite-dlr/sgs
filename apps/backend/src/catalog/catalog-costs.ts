import { PERMISSIONS, ROLE_PERMISSIONS } from '../authz/permissions.catalog';
import { fromCents } from '../common/money';

/**
 * Custos e lucro do catálogo só aparecem para quem pode editar o catálogo
 * (ADMIN/MANAGER). Os demais papéis leem serviços e pacotes, mas recebem null
 * nesses campos — o Service também chega aninhado em agendamentos e comandas,
 * por isso o corte é no field resolver e não na query.
 */
export function canSeeCatalogCosts(roleName: string | null | undefined): boolean {
  if (!roleName) return false;
  const perms = (ROLE_PERMISSIONS as Record<string, readonly string[]>)[roleName] ?? [];
  return perms.includes(PERMISSIONS.PACKAGE_WRITE) || perms.includes(PERMISSIONS.SERVICE_WRITE);
}

type DecimalLike = string | number | { toString(): string } | null | undefined;

/** Decimal do Prisma -> centavos inteiros (evita ponto flutuante na soma). */
export function toCents(v: DecimalLike): number {
  if (v == null) return 0;
  return Math.round(parseFloat(v.toString()) * 100);
}

export interface PackageCostSummary {
  totalCost: string;
  profit: string;
  profitPercent: string;
}

/**
 * Custo total = soma(custo do serviço × quantidade) + soma(itens de custo).
 * Lucro = preço − custo total; percentual sobre o preço (0.00 se preço 0).
 */
export function computePackageCosts(input: {
  price: DecimalLike;
  services: Array<{ quantity: number; service: { costPrice?: DecimalLike } }>;
  costItems: Array<{ cost: DecimalLike }>;
}): PackageCostSummary {
  let costCents = 0;
  for (const ps of input.services) costCents += toCents(ps.service.costPrice) * ps.quantity;
  for (const ci of input.costItems) costCents += toCents(ci.cost);
  const priceCents = toCents(input.price);
  const profitCents = priceCents - costCents;
  const percent = priceCents === 0 ? 0 : (profitCents / priceCents) * 100;
  return {
    totalCost: fromCents(costCents),
    profit: fromCents(profitCents),
    profitPercent: percent.toFixed(2),
  };
}
