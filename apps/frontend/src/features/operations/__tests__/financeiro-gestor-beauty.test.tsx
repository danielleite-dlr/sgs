import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { CashMovementsQuery, FinancialSummaryQuery } from '../api/financial.api';
import { FinanceiroPage } from '../pages/FinanceiroPage';
import { PeriodFilter } from '../components/PeriodFilter';
import { defaultPeriod } from '../lib/period-value';
import { CHART_COLORS, CHART_GRID_STROKE, CHART_TOOLTIP_STYLE } from '../lib/chart-theme';

const summary = {
  __typename: 'FinancialSummary',
  from: '2026-11-01',
  to: '2026-12-01',
  timezone: 'America/Sao_Paulo',
  granularity: 'day',
  billedTotal: '285.00',
  receivedTotal: '275.00',
  closedComandas: 1,
  averageTicket: '285.00',
  commissionsTotal: '40.00',
  buckets: [
    {
      __typename: 'FinancialBucket',
      bucketStart: '2026-11-02',
      billed: '285.00',
      received: '275.00',
      closedComandas: 1,
    },
  ],
  receivedByMethod: [{ __typename: 'MethodTotal', method: 'pix', total: '275.00' }],
};

const movement = (id: string, kind: string, amount: string) => ({
  __typename: 'CashMovement',
  id,
  kind,
  method: 'pix',
  amount,
  occurredAt: '2026-11-02T15:00:00.000Z',
  comandaId: null,
  comandaCode: 'C-2026-001',
  contractCode: null,
  appointmentId: null,
  clientName: 'Ana Souza',
  note: null,
});

const MOVIMENTOS = [
  movement('mv1', 'payment_in', '285.00'),
  movement('mv2', 'contract_in', '1000.00'),
  movement('mv3', 'change_out', '-10.00'),
];

function renderPage(cashMovements: unknown[] = MOVIMENTOS) {
  const mocks: MockedResponse[] = [
    {
      request: { query: FinancialSummaryQuery },
      variableMatcher: () => true,
      result: { data: { financialSummary: summary } },
      maxUsageCount: 5,
    },
    {
      request: { query: CashMovementsQuery },
      variableMatcher: () => true,
      result: { data: { cashMovements } },
      maxUsageCount: 5,
    },
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <FinanceiroPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('Financeiro no layout Gestor Beauty (06-06)', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: ['financial.read'] });
  });

  it('faixa de números densa, com rótulo em maiúsculas pequenas e valor tabular', async () => {
    renderPage();
    const faixa = await screen.findByTestId('financeiro-kpis');
    expect(faixa).toHaveClass('grid', 'grid-cols-2', 'lg:grid-cols-5', 'gap-sm');
    const cartoes = faixa.querySelectorAll('article');
    expect(cartoes).toHaveLength(5);
    cartoes.forEach((a) => {
      expect(a).toHaveClass('rounded-lg', 'border-neutral-200', 'bg-white', 'shadow-sm', 'p-sm');
      expect(a).not.toHaveClass('p-md');
      expect(a.querySelector('p')).toHaveClass('text-overline', 'uppercase', 'text-neutral-500');
    });
    for (const id of ['kpi-billed', 'kpi-received', 'kpi-closed-comandas', 'kpi-average-ticket', 'kpi-commissions']) {
      const v = screen.getByTestId(id);
      expect(v).toHaveClass('text-headline-md', 'font-semibold', 'tabular-nums', 'whitespace-nowrap');
      expect(v).not.toHaveClass('text-xl');
      expect(v).not.toHaveClass('uppercase');
    }
  });

  it('Agrupar por: 44 px e o selecionado em roxo #521873 com texto branco', async () => {
    renderPage();
    await screen.findByTestId('financeiro-kpis');
    for (const g of ['day', 'week', 'month']) {
      const b = screen.getByTestId(`granularity-${g}`);
      expect(b).toHaveClass('min-h-[44px]');
    }
    const dia = screen.getByTestId('granularity-day');
    expect(dia).toHaveAttribute('aria-pressed', 'true');
    expect(dia).toHaveClass('bg-primary-800', 'text-white');
    expect(dia).not.toHaveClass('bg-primary');
    expect(screen.getByTestId('granularity-week')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('granularity-week')).not.toHaveClass('bg-primary-800');
  });

  it('presets do período também usam o roxo de selecionado', () => {
    render(<PeriodFilter value={defaultPeriod()} onChange={() => {}} />);
    const ativo = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('aria-pressed') === 'true')!;
    expect(ativo).toHaveClass('bg-primary-800', 'text-white');
    expect(ativo).not.toHaveClass('bg-primary');
    screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'false')
      .forEach((b) => expect(b).not.toHaveClass('bg-primary-800'));
  });

  it('tabela de lançamentos densa, tipo em selo e valor com sinal à direita', async () => {
    renderPage();
    const tabela = await screen.findByTestId('cash-movements');
    expect(tabela.closest('div')).toHaveClass('hidden', 'md:block', 'rounded-lg', 'shadow-sm');
    const thead = tabela.querySelector('thead')!;
    expect(thead).toHaveClass('bg-neutral-50');
    thead.querySelectorAll('th').forEach((th) => {
      expect(th).toHaveClass('text-overline', 'uppercase', 'text-neutral-500');
    });

    const entrada = within(tabela).getByTestId('cash-movement-value-mv1');
    expect(entrada).toHaveTextContent('+ R$ 285,00');
    expect(entrada).toHaveClass('text-success-700', 'tabular-nums', 'whitespace-nowrap', 'text-right');
    const saida = within(tabela).getByTestId('cash-movement-value-mv3');
    expect(saida).toHaveTextContent('- R$ 10,00');
    expect(saida).toHaveClass('text-outflow-700');
    expect(saida).not.toHaveClass('text-error-600');

    const contrato = within(tabela).getByText('Entrada de contrato');
    expect(contrato).toHaveClass('rounded', 'bg-primary-50');
    expect(within(tabela).getByText('Pagamento')).toHaveClass('bg-neutral-100');
  });

  it('no celular os lançamentos viram cartões', async () => {
    renderPage();
    const lista = await screen.findByTestId('cash-movements-cards');
    expect(lista).toHaveClass('md:hidden');
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(3);
    expect(itens[0]).toHaveClass('rounded-lg', 'border-neutral-200', 'bg-white');
    expect(within(itens[1]).getByText('Entrada de contrato')).toBeInTheDocument();
    expect(within(itens[0]).getByText('02/11')).toBeInTheDocument();
    expect(within(itens[2]).getByText('- R$ 10,00')).toHaveClass('text-outflow-700');
    expect(within(itens[0]).getByText('+ R$ 285,00')).toHaveClass('text-success-700');
  });

  it('faixa Saldo · Entradas · Saídas soma os lançamentos do período', async () => {
    renderPage();
    const faixa = await screen.findByTestId('cash-movements-totals');
    expect(within(faixa).getByTestId('cash-totals-balance')).toHaveTextContent('R$ 1.275,00');
    const entradas = within(faixa).getByTestId('cash-totals-in');
    expect(entradas).toHaveTextContent('+ R$ 1.285,00');
    expect(entradas).toHaveClass('text-success-700', 'tabular-nums');
    const saidas = within(faixa).getByTestId('cash-totals-out');
    expect(saidas).toHaveTextContent('- R$ 10,00');
    expect(saidas).toHaveClass('text-outflow-700', 'tabular-nums');
  });

  it('sem lançamentos não mostra a faixa de saldo', async () => {
    renderPage([]);
    await screen.findByText('Nenhum lançamento no período.');
    expect(screen.queryByTestId('cash-movements-totals')).toBeNull();
  });

  it('blocos em cartão de 8 px; títulos sem serifa forçada; nada de Exportar', async () => {
    renderPage();
    await screen.findByTestId('cash-movements');
    expect(screen.getByTestId('financial-chart')).toHaveClass('rounded-lg', 'border-neutral-200', 'shadow-sm');
    screen.getAllByRole('heading', { level: 2 }).forEach((h) => {
      expect(h).toHaveClass('text-headline-sm', 'font-semibold', 'text-neutral-800');
      expect(h).not.toHaveClass('font-serif');
    });
    expect(screen.queryByText(/exportar/i)).toBeNull();
    expect(screen.queryByText(/meta/i)).toBeNull();
  });

  it('tema dos gráficos segue D-26', () => {
    expect(CHART_COLORS).toEqual({
      billed: '#521873',
      received: '#109868',
      inflow: '#109868',
      outflow: '#D85A30',
    });
    expect(CHART_GRID_STROKE).toBe('#E5E7EB');
    expect(CHART_TOOLTIP_STYLE).toMatchObject({ border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: 'none' });
  });
});
