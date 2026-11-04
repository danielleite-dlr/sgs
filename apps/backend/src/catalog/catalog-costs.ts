import { PERMISSIONS, ROLE_PERMISSIONS } from '../authz/permissions.catalog';
import { fromCents } from '../common/money';
import {
  categoryChain,
  computeCommission,
  resolveCommissionRule,
  type RuleLite,
} from '../financial/commission-resolver';

/**
 * Custos e lucro do catálogo só aparecem para quem pode editar o catálogo
 * (ADMIN/MANAGER). Os demais papéis leem pacotes, mas recebem null nesses
 * campos (corte nos field resolvers).
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

export interface CostContext {
  rules: RuleLite[];
  parents: ReadonlyMap<string, string | null>;
}

/** Comissões ativas + mapa de categorias (filha -> pai) para o repasse. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadCostContext(tx: any): Promise<CostContext> {
  const [ruleRows, cats] = await Promise.all([
    tx.commissionRule.findMany({ where: { deletedAt: null } }),
    tx.category.findMany({ select: { id: true, parentId: true } }),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules: RuleLite[] = ruleRows.map((r: any) => ({
    id: r.id,
    scopeType: r.scopeType,
    kind: r.kind,
    value: r.value.toString(),
    memberId: r.memberId,
    serviceId: r.serviceId,
    categoryId: r.categoryId,
    productId: r.productId,
    deletedAt: r.deletedAt,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parents = new Map<string, string | null>(cats.map((c: any) => [c.id, c.parentId]));
  return { rules, parents };
}

/**
 * Repasse à profissional de uma linha do pacote = comissão do serviço, pela
 * mesma regra do fechamento da comanda: serviço > categoria (filha→raiz) >
 * padrão, sobre o preço cheio, fixo por unidade. Sem profissional definida no
 * pacote, regras member_service (por profissional) não entram.
 */
export function professionalCostCents(
  ctx: CostContext,
  line: { quantity: number; service: { id: string; categoryId: string | null; basePrice: DecimalLike } },
): { cents: number; hasRule: boolean } {
  const match = resolveCommissionRule(ctx.rules, {
    kind: 'service',
    memberId: '',
    serviceId: line.service.id,
    categoryChain: categoryChain(line.service.categoryId, ctx.parents),
  });
  const c = computeCommission(match, {
    listUnitCents: toCents(line.service.basePrice),
    quantity: line.quantity,
    chargedCents: 0,
  });
  return { cents: c.amountCents, hasRule: !c.noRule };
}

export interface PackageCostSummary {
  totalCost: string;
  profit: string;
  profitPercent: string;
}

/**
 * Custo total = repasses das linhas de serviço + itens de custo.
 * Lucro = preço − custo total; percentual sobre o preço (0.00 se preço 0).
 */
export function computePackageCosts(input: {
  price: DecimalLike;
  serviceCostCents: number[];
  costItems: Array<{ cost: DecimalLike }>;
}): PackageCostSummary {
  let costCents = 0;
  for (const c of input.serviceCostCents) costCents += c;
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
