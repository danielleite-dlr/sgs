import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { CashForecastQuery } from '../api/forecast.api';
import { PrevisaoPage } from '../pages/PrevisaoPage';

const item = (over: Record<string, unknown>) => ({
  __typename: 'ForecastItem',
  date: '2026-11-06',
  kind: 'appointment',
  direction: 'in',
  amount: '100.00',
  label: 'Item',
  refId: null,
  overdue: false,
  noRule: false,
  withoutProfessional: false,
  ...over,
});

const bucket = (start: string, end: string) => ({
  __typename: 'ForecastBucket',
  start,
  end,
  inflow: '300.00',
  outflow: '100.00',
  balance: '200.00',
  overdueInflow: '0.00',
});

const data = {
  __typename: 'CashForecast',
  from: '2026-11-05',
  to: '2026-11-19',
  timezone: 'America/Sao_Paulo',
  inflowTotal: '300.00',
  outflowTotal: '100.00',
  balance: '200.00',
  overdueInflowTotal: '50.00',
  noRuleCount: 2,
  withoutProfessionalCount: 1,
  buckets: [bucket('2026-11-05', '2026-11-12'), bucket('2026-11-12', '2026-11-19')],
  items: [
    item({ kind: 'appointment', label: 'Corte da Ana' }),
    item({ kind: 'contract_installment', label: 'Parcela 2/3', overdue: true }),
    item({ kind: 'contract_balance', label: 'Restante noiva' }),
    item({
      kind: 'commission',
      direction: 'out',
      label: 'Comissão Bia',
      withoutProfessional: true,
      noRule: true,
    }),
    item({ kind: 'fixed_expense', direction: 'out', label: 'Aluguel', date: '2026-11-07' }),
  ],
};

function renderPage() {
  return render(
    <MockedProvider
      mocks={[
        {
          request: { query: CashForecastQuery },
          variableMatcher: () => true,
          result: { data: { cashForecast: data } },
        },
      ]}
    >
      <MemoryRouter>
        <PrevisaoPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('PrevisaoPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'ADMIN', permissions: [] });
  });

  it('mostra origens, marcações, aviso e semana vazia', async () => {
    renderPage();
    expect(await screen.findByText('Semana 1 · 05/11 – 11/11')).toBeInTheDocument();
    for (const t of ['Agendamento', 'Parcela de contrato', 'Restante de contrato', 'Comissão', 'Despesa fixa']) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('em atraso').length).toBeGreaterThan(0);
    expect(screen.getByText('estimada — sem profissional definido')).toBeInTheDocument();
    expect(screen.getByText('sem regra de comissão')).toBeInTheDocument();
    expect(screen.getByText(/2 comissão\(ões\) sem regra cadastrada/)).toBeInTheDocument();
    expect(screen.getByText('Nada previsto nesta semana.')).toBeInTheDocument();
  });

  it('ATTENDANT vê mensagem de falta de permissão', () => {
    useAuthStore.setState({ roleName: 'ATTENDANT', permissions: [] });
    renderPage();
    expect(screen.getByText('Você não tem acesso ao financeiro.')).toBeInTheDocument();
  });
});
