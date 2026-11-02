import { Prisma } from '@prisma/client';
import { toCents } from '../common/money';

const MAX_DEPTH = 32;

export type RuleLite = {
  id: string;
  scopeType: 'member_service' | 'service' | 'category' | 'product' | 'default';
  kind: 'fixed' | 'percentage';
  value: string;
  memberId?: string | null;
  serviceId?: string | null;
  categoryId?: string | null;
  productId?: string | null;
  deletedAt?: Date | null;
};

export type ItemForRule = {
  kind: 'service' | 'product';
  memberId: string;
  serviceId?: string | null;
  productId?: string | null;
  /** categoria do serviço -> raiz */
  categoryChain: string[];
};

/** Categoria do item e seus ancestrais (filha -> raiz); ciclo não gera loop. */
export function categoryChain(
  categoryId: string | null,
  parents: ReadonlyMap<string, string | null>,
): string[] {
  const chain: string[] = [];
  const visited = new Set<string>();
  let current: string | null | undefined = categoryId;
  for (let depth = 0; current && depth < MAX_DEPTH; depth += 1) {
    if (visited.has(current)) break;
    visited.add(current);
    chain.push(current);
    current = parents.get(current);
  }
  return chain;
}

/**
 * Regra mais específica para o item (Fase 2 D-18):
 * serviço: member_service > service > category (da filha à raiz) > default;
 * produto: product > default. Regras apagadas (deletedAt) são ignoradas.
 */
export function resolveCommissionRule(
  rules: RuleLite[],
  item: ItemForRule,
): { rule: RuleLite; matchedCategoryId: string | null } | null {
  const active = rules.filter((r) => !r.deletedAt);
  const find = (pred: (r: RuleLite) => boolean) => active.find(pred);

  if (item.kind === 'service') {
    const ms = find(
      (r) =>
        r.scopeType === 'member_service' &&
        r.memberId === item.memberId &&
        r.serviceId === item.serviceId,
    );
    if (ms) return { rule: ms, matchedCategoryId: null };
    const sv = find((r) => r.scopeType === 'service' && r.serviceId === item.serviceId);
    if (sv) return { rule: sv, matchedCategoryId: null };
    for (const c of item.categoryChain) {
      const cat = find((r) => r.scopeType === 'category' && r.categoryId === c);
      if (cat) return { rule: cat, matchedCategoryId: c };
    }
  } else {
    const pr = find((r) => r.scopeType === 'product' && r.productId === item.productId);
    if (pr) return { rule: pr, matchedCategoryId: null };
  }
  const def = find((r) => r.scopeType === 'default');
  return def ? { rule: def, matchedCategoryId: null } : null;
}

/**
 * Comissão sobre o preço CHEIO (D-23): base = listUnit * quantity, mesmo em item
 * de pacote (o desconto é absorvido pelo salão). `percentage` arredonda half-up;
 * `fixed` é valor fixo POR UNIDADE (fixedPer: 'unit' no snapshot). Sem regra:
 * R$ 0,00 e noRule (D-24).
 */
export function computeCommission(
  match: { rule: RuleLite } | null,
  a: { listUnitCents: number; quantity: number; chargedCents: number },
): { baseCents: number; chargedCents: number; amountCents: number; noRule: boolean } {
  const baseCents = a.listUnitCents * a.quantity;
  if (!match) {
    return { baseCents, chargedCents: a.chargedCents, amountCents: 0, noRule: true };
  }
  const { rule } = match;
  const amountCents =
    rule.kind === 'percentage'
      ? new Prisma.Decimal(baseCents)
          .mul(rule.value)
          .div(100)
          .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
          .toNumber()
      : toCents(rule.value) * a.quantity;
  return { baseCents, chargedCents: a.chargedCents, amountCents, noRule: false };
}
