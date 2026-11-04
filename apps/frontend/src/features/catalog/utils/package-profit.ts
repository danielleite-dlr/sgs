/** Lucro = preço − custo total; % sobre o preço do pacote. */
export function computeProfit(totalCost: string | number, packagePrice: string | number) {
  const cost = Number(totalCost) || 0;
  const price = Number(packagePrice) || 0;
  const profit = price - cost;
  const percent = price === 0 ? 0 : (profit / price) * 100;
  return { cost, price, profit, percent };
}

export interface CommissionRuleLite {
  scopeType: 'member_service' | 'service' | 'category' | 'product' | 'default';
  kind: 'fixed' | 'percentage';
  value: string;
  service?: { id: string } | null;
  category?: { id: string } | null;
}

/**
 * Repasse à profissional de uma linha do pacote — espelha o backend
 * (catalog-costs.ts / commission-resolver.ts): serviço > categoria (filha→raiz)
 * > padrão; fixo por unidade, percentual sobre o preço cheio. Regras por
 * profissional não entram (o pacote não tem profissional).
 */
export function professionalCost(
  service: { id: string; categoryId: string | null; basePrice: string },
  quantity: number,
  rules: CommissionRuleLite[],
  parents: ReadonlyMap<string, string | null>,
): { cost: number; hasRule: boolean } {
  let rule = rules.find((r) => r.scopeType === 'service' && r.service?.id === service.id);
  const seen = new Set<string>();
  let cat: string | null | undefined = service.categoryId;
  while (!rule && cat && !seen.has(cat)) {
    seen.add(cat);
    const c = cat;
    rule = rules.find((r) => r.scopeType === 'category' && r.category?.id === c);
    cat = parents.get(c);
  }
  rule ??= rules.find((r) => r.scopeType === 'default');
  if (!rule) return { cost: 0, hasRule: false };
  const value = Number(rule.value) || 0;
  // Igual ao backend: percentual arredonda sobre o total da linha; fixo é por unidade
  const cents =
    rule.kind === 'percentage'
      ? Math.round((Math.round(Number(service.basePrice) * 100) * quantity * value) / 100)
      : Math.round(value * 100) * quantity;
  return { cost: cents / 100, hasRule: true };
}
