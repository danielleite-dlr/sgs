import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { CashMovementsQuery, FinancialSummaryQuery } from '../api/financial.api';
import { FinanceiroPage } from '../pages/FinanceiroPage';

const summary = {
  __typename: 'FinancialSummary',
  from: '2026-11-01',
  to: '2026-12-01',
  timezone: 'America/Sao_Paulo',
  granularity: 'day',
  billedTotal: '285.00',
  receivedTotal: '285.00',
  closedComandas: 1,
  averageTicket: '285.00',
  commissionsTotal: '40.00',
  buckets: [
    { __typename: 'FinancialBucket', bucketStart: '2026-11-02', billed: '285.00', received: '285.00', closedComandas: 1 },
  ],
  receivedByMethod: [{ __typename: 'MethodTotal', method: 'pix', total: '285.00' }],
};

function renderPage(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <FinanceiroPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('FinanceiroPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: ['financial.read'] });
  });

  it('mostra Faturado, Recebido e o Pix', async () => {
    renderPage([
      {
        request: { query: FinancialSummaryQuery },
        variableMatcher: () => true,
        result: { data: { financialSummary: summary } },
        maxUsageCount: 5,
      },
      {
        request: { query: CashMovementsQuery },
        variableMatcher: () => true,
        result: { data: { cashMovements: [] } },
        maxUsageCount: 5,
      },
    ]);
    expect(await screen.findByTestId('kpi-billed')).toHaveTextContent('R$ 285,00');
    expect(screen.getByTestId('kpi-received')).toHaveTextContent('R$ 285,00');
    expect(screen.getByTestId('received-method-pix')).toHaveTextContent('Pix');
    expect(screen.getByTestId('received-method-pix')).toHaveTextContent('100,0%');
  });

  it('sem financial.read mostra aviso e não consulta', () => {
    useAuthStore.setState({ permissions: [] });
    let called = false;
    renderPage([
      {
        request: { query: FinancialSummaryQuery },
        variableMatcher: () => {
          called = true;
          return true;
        },
        result: { data: { financialSummary: summary } },
      },
    ]);
    expect(screen.getByText('Você não tem acesso ao financeiro.')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('coluna Cliente dos movimentos com o nome em caixa normal (UX-16)', async () => {
    renderPage([
      {
        request: { query: FinancialSummaryQuery },
        variableMatcher: () => true,
        result: { data: { financialSummary: summary } },
        maxUsageCount: 5,
      },
      {
        request: { query: CashMovementsQuery },
        variableMatcher: () => true,
        result: {
          data: {
            cashMovements: [
              {
                __typename: 'CashMovement',
                id: 'mv1',
                kind: 'payment',
                method: 'pix',
                amount: '285.00',
                occurredAt: '2026-11-02T15:00:00.000Z',
                comandaId: 'cm1',
                comandaCode: 'CM-001',
                contractCode: null,
                appointmentId: null,
                clientName: 'joana PEREIRA',
                note: null,
              },
            ],
          },
        },
        maxUsageCount: 5,
      },
    ]);
    expect(await screen.findByText('Joana Pereira')).toBeInTheDocument();
    expect(screen.queryByText('joana PEREIRA')).toBeNull();
  });

  function mocksWith(cashMovements: unknown[]): MockedResponse[] {
    return [
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
  }

  const movement = (id: string, kind: string) => ({
    __typename: 'CashMovement',
    id,
    kind,
    method: 'pix',
    amount: '100.00',
    occurredAt: '2026-11-02T15:00:00.000Z',
    comandaId: null,
    comandaCode: null,
    contractCode: 'CT-2026-001',
    appointmentId: null,
    clientName: 'Ana Souza',
    note: null,
  });

  it('coluna Tipo em português, nunca o código interno (UX-17)', async () => {
    renderPage(mocksWith([movement('mv1', 'contract_in'), movement('mv2', 'algo_novo')]));
    expect(await screen.findByText('Entrada de contrato')).toBeInTheDocument();
    expect(screen.getByText('Outro lançamento')).toBeInTheDocument();
    expect(screen.queryByText('contract_in')).toBeNull();
    expect(screen.queryByText('algo_novo')).toBeNull();
  });

  it('cartões do topo explicam o que cada número soma (UX-18)', async () => {
    renderPage(mocksWith([]));
    await screen.findByTestId('kpi-billed');
    expect(screen.getByTestId('card-hint-faturado')).toHaveTextContent(/pagamentos de contrato/);
    const recebido = screen.getByTestId('card-hint-recebido');
    expect(recebido).toHaveTextContent(/sinais/);
    expect(recebido).toHaveTextContent(/parcelas de contrato/);
    expect(recebido).toHaveTextContent(/estornos/);
    expect(recebido).toHaveTextContent(/troco/);
    expect(screen.getByText('Comandas fechadas (sem contratos)')).toBeInTheDocument();
    expect(screen.getByTestId('card-hint-comandas')).toHaveTextContent(/contrato/);
    expect(screen.getByTestId('card-hint-ticket')).toBeInTheDocument();
    for (const id of ['faturado', 'recebido', 'comandas', 'ticket']) {
      expect(screen.getByTestId(`card-hint-${id}`)).toHaveClass('text-xs', 'text-neutral-600');
    }
  });

  it('período e Dia/Semana/Mês ficam juntos (UX-19)', async () => {
    renderPage(mocksWith([]));
    const filtros = await screen.findByTestId('financeiro-filtros');
    expect(within(filtros).getByRole('group', { name: 'Agrupar por' })).toBeInTheDocument();
    expect(within(filtros).getByTestId('granularity-week')).toBeInTheDocument();
    expect(filtros).toHaveClass('flex-col', 'gap-sm', 'md:flex-row');
    expect(filtros).not.toHaveClass('justify-between');
  });
});
