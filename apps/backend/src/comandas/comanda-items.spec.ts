import { formatComandaCode } from './comanda-code';
import type { CostContext } from '../catalog/catalog-costs';
import type { RuleLite } from '../financial/commission-resolver';
import { type PackageUnit, packageUnitWeights, prorateUnits } from './comanda-items';

describe('prorateUnits', () => {
  it('rateia proporcional ao preço cheio', () => {
    expect(prorateUnits([10000, 5000], 13500)).toEqual([9000, 4500]);
  });

  it('soma exata com o resto no último', () => {
    const parts = prorateUnits([10000, 10000, 10000], 10000);
    expect(parts).toEqual([3333, 3333, 3334]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('um único item recebe o preço do pacote', () => {
    expect(prorateUnits([8000], 6500)).toEqual([6500]);
  });

  it('pacote mais caro que a soma também fecha exato', () => {
    const parts = prorateUnits([3333, 3333, 3334], 12001);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(12001);
  });
});

const unit = (id: string, listCents: number, categoryId: string | null = null): PackageUnit => ({
  listCents,
  service: { id, categoryId, basePrice: (listCents / 100).toFixed(2) },
});

const rule = (r: Partial<RuleLite> & Pick<RuleLite, 'scopeType' | 'kind' | 'value'>): RuleLite => ({
  id: `r-${Math.random()}`,
  ...r,
});

const ctxOf = (rules: RuleLite[], parents: Array<[string, string | null]> = []): CostContext => ({
  rules,
  parents: new Map(parents),
});

describe('packageUnitWeights', () => {
  it('com preço base usa o preço cheio e ignora as regras', () => {
    const ctx = ctxOf([rule({ scopeType: 'service', serviceId: 'a', kind: 'fixed', value: '999.00' })]);
    const w = packageUnitWeights([unit('a', 10000), unit('b', 5000)], ctx);
    expect(w).toEqual([10000, 5000]);
    expect(prorateUnits(w, 13500)).toEqual([9000, 4500]);
  });

  it('caso misto mantém o atual: preço 0 fica com 0', () => {
    const ctx = ctxOf([rule({ scopeType: 'service', serviceId: 'a', kind: 'fixed', value: '50.00' })]);
    expect(packageUnitWeights([unit('a', 0), unit('b', 5000)], ctx)).toEqual([0, 5000]);
  });

  it('todos com preço 0: pondera pelo repasse fixo', () => {
    const ctx = ctxOf([
      rule({ scopeType: 'service', serviceId: 'a', kind: 'fixed', value: '120.00' }),
      rule({ scopeType: 'service', serviceId: 'b', kind: 'fixed', value: '80.00' }),
    ]);
    const w = packageUnitWeights([unit('a', 0), unit('b', 0)], ctx);
    expect(w).toEqual([12000, 8000]);
    const parts = prorateUnits(w, 280000);
    expect(parts).toEqual([168000, 112000]);
    expect(parts.reduce((x, y) => x + y, 0)).toBe(280000);
  });

  it('todos com preço 0 e regra só para um serviço: o sem repasse fica 0', () => {
    const ctx = ctxOf([rule({ scopeType: 'service', serviceId: 'a', kind: 'fixed', value: '100.00' })]);
    expect(packageUnitWeights([unit('a', 0), unit('b', 0)], ctx)).toEqual([10000, 0]);
  });

  it('todos com preço 0: regra de categoria vale pela cadeia filha → raiz', () => {
    const ctx = ctxOf(
      [rule({ scopeType: 'category', categoryId: 'root', kind: 'fixed', value: '30.00' })],
      [
        ['child', 'root'],
        ['root', null],
      ],
    );
    expect(packageUnitWeights([unit('a', 0, 'child'), unit('b', 0, null)], ctx)).toEqual([3000, 0]);
  });

  it('todos com preço 0 e sem repasse: divide igual com soma exata', () => {
    const units = [unit('a', 0), unit('b', 0), unit('c', 0)];
    const noRule = packageUnitWeights(units, ctxOf([]));
    expect(noRule).toEqual([1, 1, 1]);
    const onlyPct = packageUnitWeights(
      units,
      ctxOf([rule({ scopeType: 'default', kind: 'percentage', value: '40.00' })]),
    );
    expect(onlyPct).toEqual([1, 1, 1]);
    expect(packageUnitWeights(units, null)).toEqual([1, 1, 1]);
    const parts = prorateUnits(noRule, 280000);
    expect(parts).toEqual([93333, 93333, 93334]);
    expect(parts.reduce((x, y) => x + y, 0)).toBe(280000);
  });

  it('lista vazia', () => {
    expect(packageUnitWeights([], ctxOf([]))).toEqual([]);
  });
});

describe('formatComandaCode', () => {
  it('completa com zeros até 3 dígitos', () => {
    expect(formatComandaCode(2026, 7)).toBe('C-2026-007');
  });

  it('não corta números maiores', () => {
    expect(formatComandaCode(2026, 1234)).toBe('C-2026-1234');
  });
});
