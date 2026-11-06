import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
