import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n/index';
import { PacoteForm } from '../components/PacoteForm';
import { PackageCostSummary } from '../components/PackageCostSummary';
import { computeProfit } from '../utils/package-profit';
import { ServicesQuery } from '../api/servicos.api';
import { UpdatePackageMutation, PackagesQuery } from '../api/pacotes.api';

const MAKE = '11111111-1111-4111-8111-111111111111';
const PENTEADO = '22222222-2222-4222-8222-222222222222';

const svc = (id: string, name: string, costPrice: string) => ({
  id,
  name,
  categoryId: 'c1',
  category: { id: 'c1', name: 'Noivas', parentId: null },
  basePrice: '500.00',
  costPrice,
  defaultDurationMinutes: 60,
  displayOrder: 0,
  coverImageUrl: null,
  pricingVariants: [],
});

function setup(spy: ReturnType<typeof vi.fn>) {
  const mocks = [
    {
      request: { query: ServicesQuery },
      result: {
        data: { services: [svc(MAKE, 'Make noiva', '400.00'), svc(PENTEADO, 'Penteado noiva', '400.00')] },
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
