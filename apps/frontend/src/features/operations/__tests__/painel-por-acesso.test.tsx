import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import DashboardPage from '@/pages/DashboardPage';
import type { AccessItemData, MyAccessData } from '@/features/access/access.api';
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
  serviceAt: null,
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


const TODOS = ['agenda', 'fin-comandas', 'fin-controle', 'fin-previsao', 'contratos'];
const PROFISSIONAL = ['agenda', 'fin-comandas'];

function accessOf(enabled: readonly string[]): MyAccessData {
  const items: AccessItemData[] = TODOS.map((id) => ({
    id,
    label: id,
    group: 'g',
    groupLabel: 'G',
    enabled: enabled.includes(id),
    defaultEnabled: enabled.includes(id),
    source: 'DEFAULT',
    adjustable: true,
    lockReason: null,
    permissions: [],
  }));
  return { memberId: 'm1', roleName: 'MANAGER', permissions: [], canManageAccess: false, items };
}

function setup() {
  const calls = {
    appts: vi.fn(() => ({ data: { appointments: APPTS } })),
    comandas: vi.fn(() => ({ data: { comandas: [COMANDA] } })),
    summary: vi.fn(() => ({ data: { financialSummary: SUMMARY } })),
    contracts: vi.fn(() => ({ data: { contracts: CONTRACTS } })),
    forecast: vi.fn(() => ({ data: { cashForecast: FORECAST } })),
  };
  const mk = (query: unknown, result: () => { data: Record<string, unknown> }): MockedResponse => ({
    request: { query: query as never },
    variableMatcher: () => true,
    maxUsageCount: 10,
    result,
  });
  const mocks = [
    mk(AppointmentsQuery, calls.appts),
    mk(ComandasQuery, calls.comandas),
    mk(FinancialSummaryQuery, calls.summary),
    mk(DashboardContractsQuery, calls.contracts),
    mk(CashForecastQuery, calls.forecast),
  ];
  render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </MockedProvider>,
  );
  return calls;
}

describe('painel inicial por acesso (fase 10)', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'MANAGER', permissions: ['financial.read', 'comanda.read'] });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-12T12:00:00-03:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
    useAuthStore.setState({ access: null });
  });

  it('fin-previsao desligado: sem ForecastCard e sem consulta CashForecast', async () => {
    useAuthStore.setState({ access: accessOf(TODOS.filter((i) => i !== 'fin-previsao')) });
    const calls = setup();
    await screen.findByTestId('upcoming-appointments');
    expect(screen.queryByTestId('forecast-card')).toBeNull();
    expect(calls.forecast).not.toHaveBeenCalled();
  });

  it('fin-controle desligado: sem KPIs financeiros e sem FinancialSummary; contratos ficam', async () => {
    useAuthStore.setState({ access: accessOf(TODOS.filter((i) => i !== 'fin-controle')) });
    const calls = setup();
    expect(await screen.findByTestId('kpi-brides-month')).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-billed')).toBeNull();
    expect(screen.queryByTestId('kpi-ticket')).toBeNull();
    expect(calls.summary).not.toHaveBeenCalled();
  });

  it('contratos desligado: sem cartão de contratos nem KPI de noivas', async () => {
    useAuthStore.setState({ access: accessOf(TODOS.filter((i) => i !== 'contratos')) });
    const calls = setup();
    await screen.findByTestId('upcoming-appointments');
    expect(screen.queryByTestId('upcoming-contracts')).toBeNull();
    expect(screen.queryByTestId('kpi-brides')).toBeNull();
    expect(calls.contracts).not.toHaveBeenCalled();
  });

  it('fin-comandas desligado some o cartão; agenda desligada some os atendimentos', async () => {
    useAuthStore.setState({ access: accessOf(TODOS.filter((i) => i !== 'fin-comandas')) });
    const a = setup();
    await screen.findByTestId('upcoming-appointments');
    expect(screen.queryByTestId('open-comandas')).toBeNull();
    expect(a.comandas).not.toHaveBeenCalled();
  });

  it('agenda desligada: sem próximos atendimentos, sem KPI de atendimentos e sem consulta', async () => {
    useAuthStore.setState({ access: accessOf(TODOS.filter((i) => i !== 'agenda')) });
    const calls = setup();
    await screen.findByTestId('open-comandas');
    expect(screen.queryByTestId('upcoming-appointments')).toBeNull();
    expect(screen.queryByTestId('kpi-appointments')).toBeNull();
    expect(calls.appts).not.toHaveBeenCalled();
  });

  it('profissional com acesso padrão vê só comandas e próximos atendimentos', async () => {
    useAuthStore.setState({ roleName: 'PROFESSIONAL', access: accessOf(PROFISSIONAL) });
    const calls = setup();
    expect(await screen.findByTestId('upcoming-appointments')).toBeInTheDocument();
    expect(await screen.findByTestId('open-comandas')).toBeInTheDocument();
    for (const id of ['forecast-card', 'upcoming-contracts', 'kpi-billed', 'kpi-brides']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    await waitFor(() => expect(calls.comandas).toHaveBeenCalled());
    expect(calls.summary).not.toHaveBeenCalled();
    expect(calls.forecast).not.toHaveBeenCalled();
    expect(calls.contracts).not.toHaveBeenCalled();
  });
});
