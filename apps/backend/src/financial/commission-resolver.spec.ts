import {
  categoryChain,
  computeCommission,
  resolveCommissionRule,
  type ItemForRule,
  type RuleLite,
} from './commission-resolver';

const rule = (id: string, over: Partial<RuleLite>): RuleLite => ({
  id,
  scopeType: 'default',
  kind: 'percentage',
  value: '10',
  ...over,
});

const svc = (over: Partial<ItemForRule> = {}): ItemForRule => ({
  kind: 'service',
  memberId: 'proA',
  serviceId: 'S1',
  categoryChain: ['C1'],
  ...over,
});

const rules: RuleLite[] = [
  rule('ms', { scopeType: 'member_service', memberId: 'proA', serviceId: 'S1' }),
  rule('sv', { scopeType: 'service', serviceId: 'S1' }),
  rule('cat', { scopeType: 'category', categoryId: 'C1' }),
  rule('def', { scopeType: 'default' }),
];

describe('resolveCommissionRule', () => {
  it('member_service vence para o profissional dono', () => {
    expect(resolveCommissionRule(rules, svc())?.rule.id).toBe('ms');
  });
  it('service vence para outro profissional', () => {
    expect(resolveCommissionRule(rules, svc({ memberId: 'proB' }))?.rule.id).toBe('sv');
  });
  it('categoria vence quando não há regra de serviço', () => {
    expect(
      resolveCommissionRule(rules, svc({ memberId: 'proB', serviceId: 'S2' }))?.rule.id,
    ).toBe('cat');
  });
  it('categoria do pai quando a filha não tem regra', () => {
    const r = [rule('pai', { scopeType: 'category', categoryId: 'P' })];
    const m = resolveCommissionRule(r, svc({ categoryChain: ['F', 'P'] }));
    expect(m?.rule.id).toBe('pai');
    expect(m?.matchedCategoryId).toBe('P');
  });
  it('filha vence o pai', () => {
    const r = [
      rule('pai', { scopeType: 'category', categoryId: 'P' }),
      rule('filha', { scopeType: 'category', categoryId: 'F' }),
    ];
    expect(resolveCommissionRule(r, svc({ categoryChain: ['F', 'P'] }))?.rule.id).toBe('filha');
  });
  it('só default', () => {
    expect(
      resolveCommissionRule([rule('def', {})], svc({ serviceId: 'X', categoryChain: [] }))?.rule
        .id,
    ).toBe('def');
  });
  it('nenhuma regra -> null', () => {
    expect(resolveCommissionRule([], svc())).toBeNull();
  });
  it('produto: product > default; regra de serviço nunca casa', () => {
    const r = [
      rule('sv', { scopeType: 'service', serviceId: 'P1' }),
      rule('pr', { scopeType: 'product', productId: 'P1' }),
      rule('def', {}),
    ];
    const item: ItemForRule = { kind: 'product', memberId: 'proA', productId: 'P1', categoryChain: [] };
    expect(resolveCommissionRule(r, item)?.rule.id).toBe('pr');
    expect(resolveCommissionRule(r, { ...item, productId: 'P2' })?.rule.id).toBe('def');
    expect(resolveCommissionRule([r[0]], item)).toBeNull();
  });
  it('ignora regras apagadas', () => {
    const r = [
      rule('ms', { scopeType: 'member_service', memberId: 'proA', serviceId: 'S1', deletedAt: new Date() }),
      rule('sv', { scopeType: 'service', serviceId: 'S1' }),
    ];
    expect(resolveCommissionRule(r, svc())?.rule.id).toBe('sv');
  });
});

describe('categoryChain', () => {
  it('filha -> pai', () => {
    expect(categoryChain('filha', new Map([['filha', 'pai'], ['pai', null]]))).toEqual([
      'filha',
      'pai',
    ]);
  });
  it('ciclo termina', () => {
    expect(categoryChain('a', new Map([['a', 'b'], ['b', 'a']]))).toEqual(['a', 'b']);
  });
  it('sem categoria', () => {
    expect(categoryChain(null, new Map())).toEqual([]);
  });
});

describe('computeCommission', () => {
  const pct = (v: string) => ({ rule: rule('r', { kind: 'percentage', value: v }) });
  it('percentual simples', () => {
    expect(computeCommission(pct('40'), { listUnitCents: 10000, quantity: 1, chargedCents: 10000 }))
      .toMatchObject({ baseCents: 10000, amountCents: 4000, noRule: false });
  });
  it('pacote: base é o preço cheio (D-23)', () => {
    expect(computeCommission(pct('40'), { listUnitCents: 10000, quantity: 1, chargedCents: 9000 }))
      .toMatchObject({ baseCents: 10000, chargedCents: 9000, amountCents: 4000 });
  });
  it('arredonda half-up', () => {
    expect(computeCommission(pct('33.3333'), { listUnitCents: 10000, quantity: 1, chargedCents: 10000 }).amountCents).toBe(3333);
  });
  it('fixo por unidade', () => {
    const fixed = { rule: rule('r', { kind: 'fixed', value: '15.0000' }) };
    expect(computeCommission(fixed, { listUnitCents: 5000, quantity: 2, chargedCents: 10000 }).amountCents).toBe(3000);
  });
  it('sem regra: zero e noRule (D-24)', () => {
    expect(computeCommission(null, { listUnitCents: 5000, quantity: 2, chargedCents: 10000 })).toEqual({
      baseCents: 10000,
      chargedCents: 10000,
      amountCents: 0,
      noRule: true,
    });
  });
});
