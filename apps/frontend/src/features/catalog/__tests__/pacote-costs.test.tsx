import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n/index';
import { PacoteForm } from '../components/PacoteForm';
import { PackageCostSummary } from '../components/PackageCostSummary';
import { computeProfit, professionalCost } from '../utils/package-profit';
import { CommissionRulesQuery } from '../api/comissoes.api';
import { CategoriesQuery } from '../api/categorias.api';
import { ServicesQuery } from '../api/servicos.api';
import { UpdatePackageMutation, PackagesQuery } from '../api/pacotes.api';

const MAKE = '11111111-1111-4111-8111-111111111111';
const PENTEADO = '22222222-2222-4222-8222-222222222222';

const LIMPEZA = '33333333-3333-4333-8333-333333333333';

const svc = (id: string, name: string, categoryId = 'c1') => ({
  id,
  name,
  categoryId,
  category: { id: categoryId, name: 'Noivas', parentId: null },
  basePrice: '500.00',
  defaultDurationMinutes: 60,
  displayOrder: 0,
  coverImageUrl: null,
  pricingVariants: [],
});

const ruleRow = (r: Record<string, unknown>) => ({
  id: Math.random().toString(),
  member: null,
  service: null,
  category: null,
  product: null,
  createdAt: '2026-11-04T00:00:00Z',
  updatedAt: '2026-11-04T00:00:00Z',
  ...r,
});

// Make: comissão fixa do serviço 400; Penteado: herda a comissão da categoria (400);
// a regra por profissional (999) não entra no custo do pacote.
const RULES = [
  ruleRow({ scopeType: 'service', kind: 'fixed', value: '400', service: { id: MAKE, name: 'Make noiva' } }),
  ruleRow({ scopeType: 'category', kind: 'fixed', value: '400', category: { id: 'c-pent', name: 'Penteados' } }),
  ruleRow({
    scopeType: 'member_service',
    kind: 'fixed',
    value: '999',
    service: { id: MAKE, name: 'Make noiva' },
    member: { id: 'm1', displayName: 'Ana' },
  }),
];

function setup(
  spy: ReturnType<typeof vi.fn>,
  extraServices: Array<{ serviceId: string; quantity: number }> = [],
) {
  const mocks = [
    {
      request: { query: ServicesQuery },
      result: {
        data: {
          services: [
            svc(MAKE, 'Make noiva'),
            svc(PENTEADO, 'Penteado noiva', 'c-pent'),
            svc(LIMPEZA, 'Limpeza de pele', 'c-est'),
          ],
        },
      },
      maxUsageCount: 10,
    },
    {
      request: { query: CommissionRulesQuery },
      result: { data: { commissionRules: RULES } },
      maxUsageCount: 10,
    },
    {
      request: { query: CategoriesQuery },
      result: {
        data: {
          categories: [
            { id: 'c1', name: 'Maquiagem', parentId: null, displayOrder: 0, coverImageUrl: null, children: [] },
            { id: 'c-pent', name: 'Penteados', parentId: null, displayOrder: 1, coverImageUrl: null, children: [] },
            { id: 'c-est', name: 'Estética', parentId: null, displayOrder: 2, coverImageUrl: null, children: [] },
          ],
        },
      },
      maxUsageCount: 10,
    },
    { request: { query: PackagesQuery }, result: { data: { packages: [] } }, maxUsageCount: 10 },
    {
      request: { query: UpdatePackageMutation },
      variableMatcher: (vars: Record<string, unknown>) => {
        spy(vars);
        return true;
      },
      result: { data: { updatePackage: { package: null, errors: [] } } },
    },
  ];
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <PacoteForm
        onClose={() => {}}
        initial={{
          id: 'p1',
          name: 'ESSENCE',
          price: '1955.00',
          services: [
            { serviceId: MAKE, quantity: 1 },
            { serviceId: PENTEADO, quantity: 1 },
            ...extraServices,
          ],
          costItems: [
            { name: 'Lanche', cost: '200.00' },
            { name: 'Champagne', cost: '40.00' },
          ],
        }}
      />
    </MockedProvider>,
  );
}

describe('computeProfit', () => {
  it('ESSENCE: custo 1.240, preço 1.955 -> lucro 715 (36,57%)', () => {
    const r = computeProfit('1240.00', '1955.00');
    expect(r.profit).toBe(715);
    expect(r.percent.toFixed(2)).toBe('36.57');
  });

  it('preço zero não divide por zero', () => {
    expect(computeProfit('10', '0').percent).toBe(0);
  });
});

describe('professionalCost', () => {
  const parents = new Map<string, string | null>([['filha', 'pai'], ['pai', null]]);
  const s = { id: 'svc', categoryId: 'filha', basePrice: '300.00' };
  it('fixo do serviço, por unidade', () => {
    expect(professionalCost(s, 2, [{ scopeType: 'service', kind: 'fixed', value: '120', service: { id: 'svc' } }], parents)).toEqual({ cost: 240, hasRule: true });
  });
  it('categoria pai, depois padrão', () => {
    expect(professionalCost(s, 1, [{ scopeType: 'category', kind: 'fixed', value: '50', category: { id: 'pai' } }], parents).cost).toBe(50);
    expect(professionalCost(s, 1, [{ scopeType: 'default', kind: 'percentage', value: '40' }], parents).cost).toBe(120);
  });
  it('sem regra -> 0 e hasRule false', () => {
    expect(professionalCost(s, 1, [], parents)).toEqual({ cost: 0, hasRule: false });
  });
});

describe('PackageCostSummary', () => {
  it('mostra custo, lucro e percentual formatados', () => {
    render(<PackageCostSummary totalCost="1240.00" packagePrice="1955.00" />);
    const box = screen.getByTestId('package-cost-summary');
    expect(within(box).getByText(/1\.240,00/)).toBeInTheDocument();
    expect(within(box).getByText(/715,00/)).toBeInTheDocument();
    expect(within(box).getByText('36,57%')).toBeInTheDocument();
  });
});

describe('PacoteForm — custos do pacote', () => {
  it('calcula custo ao vivo (serviços + itens) e envia costItems', async () => {
    const spy = vi.fn();
    setup(spy);

    // 400 + 400 (serviços) + 200 + 40 (itens) = 1.040 antes de adicionar o assistente
    await waitFor(() =>
      expect(within(screen.getByTestId('package-cost-summary')).getByText(/1\.040,00/)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /adicionar custo/i }));
    fireEvent.change(screen.getByLabelText('Item de custo 3'), { target: { value: 'Assistente' } });
    fireEvent.change(screen.getByLabelText('Custo do item 3'), { target: { value: '20000' } });

    const box = screen.getByTestId('package-cost-summary');
    await waitFor(() => expect(within(box).getByText(/1\.240,00/)).toBeInTheDocument());
    expect(within(box).getByText('36,57%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const input = (spy.mock.calls[0][0] as { input: { costItems: unknown } }).input;
    expect(input.costItems).toEqual([
      { name: 'Lanche', cost: '200.00' },
      { name: 'Champagne', cost: '40.00' },
      { name: 'Assistente', cost: '200.00' },
    ]);
  });

  it('item de custo sem nome mostra erro e não envia', async () => {
    const spy = vi.fn();
    setup(spy);
    fireEvent.click(screen.getByRole('button', { name: /adicionar custo/i }));
    fireEvent.change(screen.getByLabelText('Custo do item 3'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(screen.getByText('Informe o item.')).toBeInTheDocument());
    expect(spy).not.toHaveBeenCalled();
  });

  it('serviço sem comissão aparece no aviso e conta R$ 0', async () => {
    setup(vi.fn(), [{ serviceId: LIMPEZA, quantity: 1 }]);
    await waitFor(() =>
      expect(screen.getByText(/Sem comissão cadastrada \(conta R\$ 0\): Limpeza de pele/)).toBeInTheDocument(),
    );
    expect(within(screen.getByTestId('package-professional-cost')).getByText(/800,00/)).toBeInTheDocument();
  });

  it('remover item de custo recalcula', async () => {
    const spy = vi.fn();
    setup(spy);
    fireEvent.click(screen.getByRole('button', { name: 'Remover item de custo 1' }));
    // 400 + 400 + 40 = 840
    await waitFor(() =>
      expect(within(screen.getByTestId('package-cost-summary')).getByText(/840,00/)).toBeInTheDocument(),
    );
  });
});
