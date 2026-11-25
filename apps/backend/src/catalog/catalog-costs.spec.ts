import { computePackageCosts, professionalCostCents } from './catalog-costs';
import type { RuleLite } from '../financial/commission-resolver';
import { PackagesResolver } from './packages/packages.resolver';
import { PackageServiceItemResolver } from './packages/packages.resolver';

describe('catalog-costs', () => {
  describe('computePackageCosts', () => {
    it('soma repasses dos serviços + itens de custo (pacote ESSENCE)', () => {
      const r = computePackageCosts({
        price: '1955.00',
        serviceCostCents: [40000, 40000], // make + penteado noiva
        costItems: [{ cost: '200.00' }, { cost: '40.00' }, { cost: '200.00' }],
      });
      expect(r).toEqual({ totalCost: '1240.00', profit: '715.00', profitPercent: '36.57' });
    });

    it('lucro negativo quando o custo passa do preço', () => {
      const r = computePackageCosts({ price: '100.00', serviceCostCents: [], costItems: [{ cost: '150.00' }] });
      expect(r.profit).toBe('-50.00');
      expect(r.profitPercent).toBe('-50.00');
    });

    it('preço zero não divide por zero', () => {
      expect(computePackageCosts({ price: '0', serviceCostCents: [], costItems: [] }).profitPercent).toBe('0.00');
    });
  });

  describe('computePackageCosts — diária da assistente (09.1)', () => {
    const base = { price: '1000.00', serviceCostCents: [30000], costItems: [{ cost: '50.00' }] };

    it('soma a diária ao custo total', () => {
      expect(computePackageCosts({ ...base, assistantDailyCents: 22000 })).toEqual({
        totalCost: '570.00',
        profit: '430.00',
        profitPercent: '43.00',
      });
    });

    it('sem assistantDailyCents mantém o comportamento atual', () => {
      expect(computePackageCosts(base).totalCost).toBe('350.00');
    });

    it('diária 0 equivale a omitida', () => {
      expect(computePackageCosts({ ...base, assistantDailyCents: 0 })).toEqual(computePackageCosts(base));
    });
  });

  describe('professionalCostCents (repasse = comissão do serviço)', () => {
    const rule = (r: Partial<RuleLite>): RuleLite => ({
      id: Math.random().toString(),
      scopeType: 'service',
      kind: 'fixed',
      value: '0',
      ...r,
    });
    const line = (quantity = 1) => ({
      quantity,
      service: { id: 'svc', categoryId: 'filha', basePrice: '300.00' },
    });
    const parents = new Map<string, string | null>([['filha', 'pai'], ['pai', null]]);

    it('comissão fixa do serviço, por unidade', () => {
      const ctx = { rules: [rule({ serviceId: 'svc', value: '120' })], parents };
      expect(professionalCostCents(ctx, line(2))).toEqual({ cents: 24000, hasRule: true });
    });

    it('regra por profissional não entra (pacote não tem profissional)', () => {
      const ctx = {
        rules: [
          rule({ scopeType: 'member_service', memberId: 'm1', serviceId: 'svc', value: '999' }),
          rule({ serviceId: 'svc', value: '120' }),
        ],
        parents,
      };
      expect(professionalCostCents(ctx, line()).cents).toBe(12000);
    });

    it('cai na categoria pai e depois no padrão', () => {
      expect(
        professionalCostCents({ rules: [rule({ scopeType: 'category', categoryId: 'pai', value: '50' })], parents }, line())
          .cents,
      ).toBe(5000);
      expect(
        professionalCostCents({ rules: [rule({ scopeType: 'default', value: '10' })], parents }, line()).cents,
      ).toBe(1000);
    });

    it('percentual sobre o preço cheio do serviço', () => {
      const ctx = { rules: [rule({ serviceId: 'svc', kind: 'percentage', value: '40' })], parents };
      expect(professionalCostCents(ctx, line()).cents).toBe(12000);
    });

    it('sem regra: R$ 0 e hasRule false', () => {
      expect(professionalCostCents({ rules: [], parents }, line())).toEqual({ cents: 0, hasRule: false });
    });

    it('regra apagada é ignorada', () => {
      const ctx = { rules: [rule({ serviceId: 'svc', value: '120', deletedAt: new Date() })], parents };
      expect(professionalCostCents(ctx, line()).hasRule).toBe(false);
    });
  });

  describe('field resolvers escondem custo por papel', () => {
    // Contexto simulado: o AccessService falso devolve as permissões efetivas.
    const ctxWith = (permissions: string[]) => ({ permissions }) as never;
    const accessSvc = {
      forContext: (c: { permissions: string[] }) =>
        Promise.resolve({ permissions: new Set(c.permissions) }),
    } as never;
    const admin = ctxWith(['financial.read']);
    const pro = ctxWith(['appointment.read']);
    const pkgResolver = new PackagesResolver({} as never, accessSvc);
    const pkg = {
      costItems: [{ id: '1', name: 'Lanche', cost: '200.00', displayOrder: 0 }],
      totalCost: '1240.00',
      profit: '715.00',
      profitPercent: '36.57',
    };

    it('ADMIN vê custos do pacote', async () => {
      expect(await pkgResolver.totalCost(pkg, admin)).toBe('1240.00');
      expect(await pkgResolver.profit(pkg, admin)).toBe('715.00');
      expect(await pkgResolver.profitPercent(pkg, admin)).toBe('36.57');
      expect(await pkgResolver.costItems(pkg, admin)).toHaveLength(1);
    });

    it('PROFESSIONAL recebe null nos custos do pacote', async () => {
      expect(await pkgResolver.totalCost(pkg, pro)).toBeNull();
      expect(await pkgResolver.profit(pkg, pro)).toBeNull();
      expect(await pkgResolver.profitPercent(pkg, pro)).toBeNull();
      expect(await pkgResolver.costItems(pkg, pro)).toBeNull();
    });

    it('repasse por linha: ADMIN vê, PROFESSIONAL null', async () => {
      const r = new PackageServiceItemResolver(accessSvc);
      const l = { professionalCost: '400.00', hasCommissionRule: true };
      expect(await r.professionalCost(l, admin)).toBe('400.00');
      expect(await r.hasCommissionRule(l, admin)).toBe(true);
      expect(await r.professionalCost(l, pro)).toBeNull();
      expect(await r.hasCommissionRule(l, pro)).toBeNull();
      expect(await r.professionalCost(l, ctxWith([]))).toBeNull();
    });
  });
});
