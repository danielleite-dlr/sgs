import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { CashForecastQuery } from '../api/forecast.api';
import { ForecastCard } from '../components/ForecastCard';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => (
      <div style={{ width: 600, height: 180 }}>{children}</div>
    ),
  };
});

const forecast = (over: Record<string, unknown> = {}) => ({
  __typename: 'CashForecast',
  from: '2026-11-05',
  to: '2026-12-05',
  timezone: 'America/Sao_Paulo',
  inflowTotal: '1500.00',
  outflowTotal: '400.00',
  balance: '1100.00',
  overdueInflowTotal: '0.00',
  professionalOutflowTotal: '100.00',
  operationalOutflowTotal: '240.00',
  fixedOutflowTotal: '60.00',
  noRuleCount: 0,
  withoutProfessionalCount: 0,
  buckets: [
    {
      __typename: 'ForecastBucket',
      start: '2026-11-05',
      end: '2026-11-12',
      inflow: '1500.00',
      outflow: '400.00',
      balance: '1100.00',
      overdueInflow: '0.00',
      professionalOutflow: '100.00',
      operationalOutflow: '240.00',
      fixedOutflow: '60.00',
    },
  ],
  items: [
    {
      __typename: 'ForecastItem',
      date: '2026-11-06',
      kind: 'appointment',
      direction: 'in',
      amount: '1500.00',
      label: 'Corte',
      refId: 'a1',
      overdue: false,
      noRule: false,
      withoutProfessional: false,
      costGroup: null,
    },
  ],
  ...over,
});

function renderCard(mock: MockedResponse) {
  return render(
    <MockedProvider mocks={[mock]}>
      <MemoryRouter>
        <ForecastCard />
      </MemoryRouter>
    </MockedProvider>,
  );
}

const ok = (over: Record<string, unknown> = {}): MockedResponse => ({
  request: { query: CashForecastQuery },
  variableMatcher: () => true,
  result: { data: { cashForecast: forecast(over) } },
});

describe('ForecastCard', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'ADMIN', permissions: [] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra totais e rótulos', async () => {
    renderCard(ok());
    expect((await screen.findAllByText('R$ 1.500,00')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 400,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 1.100,00').length).toBeGreaterThan(0);
    expect(screen.getByText('Entradas previstas')).toBeInTheDocument();
    expect(screen.getByText('Saídas previstas')).toBeInTheDocument();
    expect(screen.getByText('Saldo previsto')).toBeInTheDocument();
    expect(screen.getByText('Previsão de caixa')).toBeInTheDocument();
  });

  it('mostra as saídas por grupo de custo', async () => {
    renderCard(ok());
    const groups = await screen.findByTestId('forecast-cost-groups');
    expect(within(groups).getByText('Custo profissional')).toBeInTheDocument();
    expect(within(groups).getByText('R$ 100,00')).toBeInTheDocument();
    expect(within(groups).getByText('Custo operacional')).toBeInTheDocument();
    expect(within(groups).getByText('R$ 240,00')).toBeInTheDocument();
    expect(within(groups).getByText('Custo fixo')).toBeInTheDocument();
    expect(within(groups).getByText('R$ 60,00')).toBeInTheDocument();
  });

  it('avisa o valor em atraso', async () => {
    renderCard(ok({ overdueInflowTotal: '500.00' }));
    expect(await screen.findByText('Inclui R$ 500,00 em atraso')).toBeInTheDocument();
  });

  it('estado vazio', async () => {
    renderCard(ok({ items: [], buckets: [] }));
    expect(await screen.findByText('Nenhum valor previsto nos próximos 30 dias.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cadastrar despesas fixas' })).toHaveAttribute(
      'href',
      '/financeiro/despesas-fixas',
    );
  });

  it('estado de erro', async () => {
    renderCard({
      request: { query: CashForecastQuery },
      variableMatcher: () => true,
      error: new Error('falha'),
    });
    expect(await screen.findByText(/Não foi possível carregar a previsão\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('link Ver detalhe aponta para a previsão', async () => {
    renderCard(ok());
    const link = await screen.findByRole('link', { name: 'Ver detalhe' });
    expect(link).toHaveAttribute('href', '/financeiro/previsao');
  });

  it('não renderiza para PROFESSIONAL', () => {
    useAuthStore.setState({ roleName: 'PROFESSIONAL', permissions: [] });
    renderCard(ok());
    expect(screen.queryByText('Previsão de caixa')).not.toBeInTheDocument();
  });

  it('consulta a partir de hoje no fuso de São Paulo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-06T01:30:00Z'));
    let vars: unknown;
    renderCard({
      request: { query: CashForecastQuery },
      variableMatcher: (v) => {
        vars = v;
        return true;
      },
      result: { data: { cashForecast: forecast() } },
    });
    await screen.findByText('Saldo previsto');
    await screen.findAllByText('R$ 1.100,00');
    expect(vars).toEqual({ from: '2026-11-05', to: '2026-12-05' });
  });
});
