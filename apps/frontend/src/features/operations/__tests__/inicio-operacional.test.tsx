import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import DashboardPage from '@/pages/DashboardPage';
import { AppointmentsQuery } from '../api/appointments.api';
import { ComandasQuery } from '../api/comandas.api';
import { DashboardContractsQuery } from '../api/dashboard.api';
import { FinancialSummaryQuery } from '../api/financial.api';
import { CashForecastQuery } from '../api/forecast.api';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => (
      <div style={{ width: 600, height: 180 }}>{children}</div>
    ),
  };
});

const appt = (id: string, status: string, startsAt: string, endsAt: string, client: string) => ({
  __typename: 'Appointment',
  id,
  professionalId: 'p1',
  clientId: 'c9',
  serviceId: 's1',
  serviceVariantId: null,
  comandaId: null,
  comandaCode: null,
  comandaStatus: null,
  depositAmount: '0.00',
  startsAt,
  endsAt,
  status,
  notes: null,
  cancelReason: null,
  cancelReasonTag: null,
  cancelledAt: null,
  client: { __typename: 'Client', id: `c9-${id}`, fullName: client },
  professional: { __typename: 'Member', id: 'p1', displayName: 'Beatriz Viana' },
  service: {
    __typename: 'Service',
    id: 's1',
    name: 'Maquiagem Festa',
    defaultDurationMinutes: 45,
    category: null,
  },
});

const APPTS = [
  appt('a1', 'confirmed', '2026-11-12T14:30:00.000Z', '2026-11-12T15:15:00.000Z', 'CLARA MENDES'),
  appt('a2', 'completed', '2026-11-12T12:00:00.000Z', '2026-11-12T13:00:00.000Z', 'Ana Done'),
  appt('a3', 'in_progress', '2026-11-12T13:00:00.000Z', '2026-11-12T14:00:00.000Z', 'Bia Andamento'),
  appt('a4', 'cancelled', '2026-11-12T16:00:00.000Z', '2026-11-12T17:00:00.000Z', 'Cancelada'),
];

const COMANDA = {
  __typename: 'Comanda',
  id: 'cm1',
  code: 'C-2026-0042',
  status: 'open',
  clientId: 'c1',
  client: { __typename: 'Client', id: 'c1', fullName: 'SOFIA DRUMMOND', phone: null },
  openedAt: '2026-11-12T10:00:00.000Z',
  closedAt: null,
  closeCycle: 0,
  total: '290.00',
  covered: '0.00',
  owed: '290.00',
  paid: '0.00',
  remaining: '290.00',
  change: '0.00',
  canClose: false,
  closeError: null,
  clientCreditBalance: '0.00',
  appointmentIds: [],
  hasCommissionWarnings: false,
  items: [
    {
      __typename: 'ComandaItem',
      id: 'i1',
      kind: 'service',
      serviceId: 's1',
      productId: null,
      packageId: null,
      appointmentId: null,
      serviceVariantId: null,
      professionalId: 'p1',
      professional: { __typename: 'Member', id: 'p1', displayName: 'Beatriz Viana' },
      name: 'Design de Sobrancelhas',
      quantity: 1,
      listUnitPrice: '290.00',
      unitPrice: '290.00',
      total: '290.00',
      contractId: null,
      contractCode: null,
    },
  ],
  payments: [],
  commissions: [],
};

const CONTRACTS = [
  {
    __typename: 'Contract',
    id: 'k1',
    code: 'CT-1',
    status: 'active',
    groupId: 'g1',
    eventDate: '2026-11-28',
    eventKind: 'casamento',
    brideName: 'FERNANDA DINIZ',
    totalAmount: '1000.00',
    paid: '800.00',
    settled: false,
  },
  {
    __typename: 'Contract',
    id: 'k2',
    code: 'CT-2',
    status: 'active',
    groupId: 'g2',
    eventDate: '2026-11-14',
    eventKind: 'casamento',
    brideName: 'MARIANA SILVEIRA',
    totalAmount: '2000.00',
    paid: '2000.00',
    settled: true,
  },
];

const SUMMARY = {
  __typename: 'FinancialSummary',
  from: '2026-11-12',
  to: '2026-11-13',
  timezone: 'America/Sao_Paulo',
  granularity: 'day',
  billedTotal: '4850.00',
  contractBilledTotal: '0.00',
  receivedTotal: '100.00',
  closedComandas: 14,
  averageTicket: '346.40',
  commissionsTotal: '0.00',
  buckets: [],
  receivedByMethod: [],
};

const FORECAST = {
  __typename: 'CashForecast',
  from: '2026-11-12',
  to: '2026-12-12',
  timezone: 'America/Sao_Paulo',
  inflowTotal: '0.00',
  outflowTotal: '0.00',
  balance: '0.00',
  overdueInflowTotal: '0.00',
  professionalOutflowTotal: '0.00',
  operationalOutflowTotal: '0.00',
  fixedOutflowTotal: '0.00',
  noRuleCount: 0,
  withoutProfessionalCount: 0,
  buckets: [],
  items: [],
};

const m = (query: unknown, data: Record<string, unknown> | Error): MockedResponse => ({
  request: { query: query as never },
  variableMatcher: () => true,
  maxUsageCount: 10,
  ...(data instanceof Error ? { error: data } : { result: { data } }),
});

const mocks = (over: MockedResponse[] = []): MockedResponse[] => [
  ...over,
  m(AppointmentsQuery, { appointments: APPTS }),
  m(ComandasQuery, { comandas: [COMANDA] }),
  m(FinancialSummaryQuery, { financialSummary: SUMMARY }),
  m(DashboardContractsQuery, { contracts: CONTRACTS }),
  m(CashForecastQuery, { cashForecast: FORECAST }),
];

function renderPage(list: MockedResponse[] = mocks()) {
  return render(
    <MockedProvider mocks={list}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('Início operacional', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'ADMIN', permissions: [] });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-12T12:00:00-03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('faixa de KPIs com dados reais', async () => {
    renderPage();
    expect(await screen.findByTestId('kpi-appointments-total')).toHaveTextContent('3');
    expect(screen.getByText(/1 concluídos • 1 em andamento • 1 pendentes/)).toBeInTheDocument();
    expect(await screen.findByTestId('kpi-billed-value')).toHaveTextContent('R$ 4.850,00');
    expect(screen.getByTestId('kpi-ticket-value')).toHaveTextContent('R$ 346,40');
    expect(screen.getByText('Base: 14 comandas fechadas')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-brides-month')).toHaveTextContent('2');
    expect(screen.getByText('no mês • 1 nesta semana')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
  });

  it('próximos atendimentos com borda de status e links', async () => {
    renderPage();
    const bloco = await screen.findByTestId('upcoming-appointments');
    const linhas = await within(bloco).findAllByTestId('appointment-row');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent('10:00');
    expect(linhas[0]).toHaveTextContent('Bia Andamento');
    expect(linhas[1]).toHaveTextContent('11:30');
    expect(linhas[1]).toHaveTextContent('Clara Mendes');
    expect(linhas[0].style.borderLeftColor).not.toBe('');
    expect(within(bloco).getByRole('link', { name: 'Ver agenda' })).toHaveAttribute('href', '/agenda');
  });

  it('comandas em aberto e contratos levam às telas de detalhe', async () => {
    renderPage();
    const comandas = await screen.findByTestId('open-comandas');
    const linhas = await within(comandas).findAllByTestId('comanda-row');
    expect(linhas[0]).toHaveTextContent('R$ 290,00');
    expect(within(linhas[0]).getByRole('link', { name: 'C-2026-0042' })).toHaveAttribute('href', '/comanda/cm1');
    expect(within(comandas).getByRole('link', { name: 'Ver todas as comandas' })).toHaveAttribute('href', '/comanda');
    const contratos = await screen.findByTestId('upcoming-contracts');
    const cts = await within(contratos).findAllByTestId('contract-row');
    expect(cts[0]).toHaveAttribute('href', '/contratos/k2');
    expect(cts[0]).toHaveTextContent('Casamento em 2 dias');
    expect(cts[1]).toHaveTextContent('Fernanda Diniz');
    expect(cts[1]).toHaveTextContent('80% quitado');
    expect(within(cts[1]).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
    expect(within(contratos).getByRole('link', { name: 'Ver todos' })).toHaveAttribute('href', '/contratos');
  });

  it('sem financial.read não há R$ nos blocos nem chamada de FinancialSummary', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT', permissions: [] });
    const resumo = vi.fn();
    const semFin = mocks().map((x) =>
      x.request.query === FinancialSummaryQuery
        ? { ...x, result: () => (resumo(), { data: { financialSummary: SUMMARY } }) }
        : x,
    );
    renderPage(semFin);
    await screen.findByTestId('kpi-appointments-total');
    const comandas = await screen.findByTestId('open-comandas');
    await within(comandas).findAllByTestId('comanda-row');
    await screen.findAllByTestId('contract-row');
    const strip = screen.getByTestId('day-kpi-strip');
    for (const id of ['upcoming-appointments', 'open-comandas', 'upcoming-contracts']) {
      expect(screen.getByTestId(id).textContent).not.toContain('R$');
    }
    expect(strip.textContent).not.toContain('R$');
    expect(screen.queryByTestId('kpi-billed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kpi-ticket')).not.toBeInTheDocument();
    expect(screen.queryByText(/quitado/)).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Total' })).not.toBeInTheDocument();
    expect(resumo).not.toHaveBeenCalled();
  });

  it('sem contract.read somem o KPI de noivas e o bloco de contratos', async () => {
    useAuthStore.setState({ roleName: 'PROFESSIONAL', permissions: [] });
    const contratos = vi.fn();
    const lista = mocks().map((x) =>
      x.request.query === DashboardContractsQuery
        ? { ...x, result: () => (contratos(), { data: { contracts: CONTRACTS } }) }
        : x,
    );
    renderPage(lista);
    await screen.findByTestId('kpi-appointments-total');
    expect(screen.queryByTestId('kpi-brides')).not.toBeInTheDocument();
    expect(screen.queryByTestId('upcoming-contracts')).not.toBeInTheDocument();
    expect(contratos).not.toHaveBeenCalled();
  });

  it('estados vazios por bloco', async () => {
    renderPage([
      m(AppointmentsQuery, { appointments: [] }),
      m(ComandasQuery, { comandas: [] }),
      m(DashboardContractsQuery, { contracts: [] }),
      ...mocks(),
    ]);
    expect(await screen.findByText('Nenhum atendimento pendente hoje')).toBeInTheDocument();
    expect(await screen.findByText('Nenhuma comanda em aberto')).toBeInTheDocument();
    expect(await screen.findByText('Nenhum contrato com evento próximo')).toBeInTheDocument();
  });

  it('carregando mostra skeleton e erro de um bloco não derruba os outros', async () => {
    renderPage([m(ComandasQuery, new Error('falhou')), ...mocks()]);
    expect(screen.getByTestId('open-comandas-loading')).toBeInTheDocument();
    expect(await screen.findByText(/Não foi possível carregar as comandas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('kpi-appointments-total')).toHaveTextContent('3'));
    expect(await screen.findAllByTestId('appointment-row')).toHaveLength(2);
    expect(screen.getByTestId('forecast-card')).toBeInTheDocument();
  });

  it('tentar novamente refaz a consulta e mostra a comanda', async () => {
    const erro = { ...m(ComandasQuery, new Error('falhou')), maxUsageCount: 1 };
    const user = userEvent.setup({ advanceTimers: () => {} });
    renderPage([erro, ...mocks()]);
    await user.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('link', { name: 'C-2026-0042' })).toBeInTheDocument();
  });
});
