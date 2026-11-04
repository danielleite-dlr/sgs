import { canSeeCatalogCosts, computePackageCosts } from './catalog-costs';
import { PackagesResolver } from './packages/packages.resolver';
import { ServicesResolver } from './services/services.resolver';

describe('catalog-costs', () => {
  describe('computePackageCosts', () => {
    it('soma custo dos serviços × quantidade + itens de custo (pacote ESSENCE)', () => {
      const r = computePackageCosts({
        price: '1955.00',
        services: [
          { quantity: 1, service: { costPrice: '400.00' } }, // make noiva
          { quantity: 1, service: { costPrice: '400.00' } }, // penteado noiva
        ],
        costItems: [{ cost: '200.00' }, { cost: '40.00' }, { cost: '200.00' }],
      });
      expect(r).toEqual({ totalCost: '1240.00', profit: '715.00', profitPercent: '36.57' });
    });

    it('respeita a quantidade do serviço', () => {
      const r = computePackageCosts({
        price: '100',
        services: [{ quantity: 3, service: { costPrice: '10.10' } }],
        costItems: [],
      });
      expect(r.totalCost).toBe('30.30');
      expect(r.profit).toBe('69.70');
    });

    it('lucro negativo quando o custo passa do preço', () => {
      const r = computePackageCosts({
        price: '100.00',
        services: [],
        costItems: [{ cost: '150.00' }],
      });
      expect(r.profit).toBe('-50.00');
      expect(r.profitPercent).toBe('-50.00');
    });

    it('preço zero não divide por zero', () => {
      const r = computePackageCosts({ price: '0', services: [], costItems: [] });
      expect(r.profitPercent).toBe('0.00');
    });

    it('serviço sem custo conta como zero', () => {
      const r = computePackageCosts({
        price: '50.00',
        services: [{ quantity: 1, service: { costPrice: null } }],
        costItems: [],
      });
      expect(r.totalCost).toBe('0.00');
    });
  });

  describe('canSeeCatalogCosts', () => {
    it.each([
      ['ADMIN', true],
      ['MANAGER', true],
      ['ATTENDANT', false],
      ['PROFESSIONAL', false],
      ['DESCONHECIDO', false],
    ])('%s -> %s', (role, expected) => {
      expect(canSeeCatalogCosts(role)).toBe(expected);
    });

    it('sem papel -> false', () => {
      expect(canSeeCatalogCosts(undefined)).toBe(false);
      expect(canSeeCatalogCosts(null)).toBe(false);
    });
  });

  describe('field resolvers escondem custo por papel', () => {
    const admin = { organizationId: 'o', memberId: 'm', roleName: 'ADMIN' };
    const pro = { organizationId: 'o', memberId: 'm', roleName: 'PROFESSIONAL' };
    const pkgResolver = new PackagesResolver({} as never);
    const svcResolver = new ServicesResolver({} as never);
    const pkg = {
      costItems: [{ id: '1', name: 'Lanche', cost: '200.00', displayOrder: 0 }],
      totalCost: '1240.00',
      profit: '715.00',
      profitPercent: '36.57',
    };

    it('ADMIN vê custos do pacote', () => {
      expect(pkgResolver.totalCost(pkg, admin)).toBe('1240.00');
      expect(pkgResolver.profit(pkg, admin)).toBe('715.00');
      expect(pkgResolver.profitPercent(pkg, admin)).toBe('36.57');
      expect(pkgResolver.costItems(pkg, admin)).toHaveLength(1);
    });

    it('PROFESSIONAL recebe null nos custos do pacote', () => {
      expect(pkgResolver.totalCost(pkg, pro)).toBeNull();
      expect(pkgResolver.profit(pkg, pro)).toBeNull();
      expect(pkgResolver.profitPercent(pkg, pro)).toBeNull();
      expect(pkgResolver.costItems(pkg, pro)).toBeNull();
    });

    it('custo do serviço: ADMIN formatado, PROFESSIONAL null', () => {
      const decimal = { toFixed: (n: number) => (400).toFixed(n) };
      expect(svcResolver.costPrice({ costPrice: decimal }, admin)).toBe('400.00');
      expect(svcResolver.costPrice({ costPrice: '120' }, admin)).toBe('120.00');
      expect(svcResolver.costPrice({ costPrice: decimal }, pro)).toBeNull();
      expect(svcResolver.costPrice({ costPrice: decimal }, null)).toBeNull();
    });
  });
});
