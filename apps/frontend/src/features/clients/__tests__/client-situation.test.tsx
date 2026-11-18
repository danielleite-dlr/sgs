import '@/infrastructure/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { ClientHistoryQuery } from '../api/clients.api';
import type { ClientOverviewData } from '../api/clients.api';
import { ClientHistoryTab } from '../components/ClientHistoryTab';
import { ClientSituationView } from '../components/ClientSituation';

vi.mock('@/config/features', () => ({ isPathEnabled: () => true }));

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(15, 0, 0, 0);
  return d;
};
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const empty: ClientOverviewData = {
  bridalGroups: [],
  contracts: [],
  upcomingAppointments: [],
  stats: { completedCount: 0, lastVisitAt: null, totalSpent: '0.00', creditBalance: '0.00' },
};

function renderView(overview: ClientOverviewData) {
  return render(
    <MemoryRouter>
      <ClientSituationView overview={overview} />
    </MemoryRouter>,
  );
}

describe('ClientSituationView', () => {
  it('sem grupo, contrato, agendamento nem números não mostra nada', () => {
    renderView(empty);
    expect(screen.queryByTestId('client-situation')).toBeNull();
  });

  it('noiva com teste amanhã, contrato e próximo atendimento', () => {
    renderView({
      ...empty,
      bridalGroups: [
        {
          id: 'g1',
          name: 'Casamento Graziele',
          eventKind: 'noiva',
          role: 'bride',
          eventDate: iso(day(10)),
          eventTime: '16:00',
          status: 'active',
          trialDates: [day(1).toISOString()],
        },
      ],
      contracts: [
        {
          id: 'ct1',
          code: 'CT-2026-007',
          status: 'active',
          groupId: 'g1',
          groupName: 'Casamento Graziele',
          totalAmount: '8000.00',
          paid: '1000.00',
          balance: '7000.00',
          nextDueDate: '2030-01-01',
          nextDueAmount: '1400.00',
        },
      ],
      upcomingAppointments: [
        {
          id: 'a1',
          startsAt: day(1).toISOString(),
          endsAt: day(1).toISOString(),
          status: 'scheduled',
          serviceName: 'Maquiagem',
          professionalName: 'Jessica',
          kind: 'trial',
          comandaId: 'cm1',
          bridalGroupId: 'g1',
        },
      ],
    });
    const group = screen.getByTestId('client-group-g1');
    expect(within(group).getByText('Noiva')).toBeInTheDocument();
    expect(within(group).getByTestId('client-group-trial')).toHaveTextContent('Amanhã');
    expect(within(group).getByRole('link', { name: 'Abrir grupo' })).toHaveAttribute(
      'href',
      '/noivas/g1',
    );
    const contract = screen.getByTestId('client-contract-ct1');
    expect(contract).toHaveTextContent('CT-2026-007');
    expect(contract).toHaveTextContent('Saldo: R$ 7.000,00');
    expect(within(contract).getByRole('link', { name: 'Abrir contrato' })).toHaveAttribute(
      'href',
      '/contratos/ct1',
    );
    const item = screen.getByTestId('client-upcoming-item');
    expect(item).toHaveTextContent('Teste — Maquiagem · Jessica');
    expect(within(item).getByRole('link', { name: 'Abrir comanda' })).toHaveAttribute(
      'href',
      '/comanda/cm1',
    );
  });

  it('cliente comum só com números mostra os totais', () => {
    renderView({
      ...empty,
      stats: {
        completedCount: 3,
        lastVisitAt: day(-5).toISOString(),
        totalSpent: '450.00',
        creditBalance: '20.00',
      },
    });
    const stats = screen.getByTestId('client-stats');
    expect(stats).toHaveTextContent('3');
    expect(stats).toHaveTextContent('R$ 450,00');
    expect(screen.queryByTestId('client-groups')).toBeNull();
    expect(screen.queryByTestId('client-contracts')).toBeNull();
  });
});

describe('ClientHistoryTab', () => {
  const item = (over: Record<string, unknown>) => ({
    __typename: 'ClientHistoryItem',
    professionalName: null,
    ...over,
  });

  function renderTab(items: unknown[]) {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: ClientHistoryQuery,
          variables: { clientId: 'c1', filters: { kind: 'all' } },
        },
        result: { data: { clientHistory: items } },
      },
    ];
    return render(
      <MockedProvider mocks={mocks}>
        <MemoryRouter>
          <ClientHistoryTab clientId="c1" />
        </MemoryRouter>
      </MockedProvider>,
    );
  }

  it('lista os itens com valor e link', async () => {
    renderTab([
      item({
        id: 'cm1',
        occurredAt: '2026-11-10T15:00:00.000Z',
        kind: 'comanda',
        description: 'Comanda C-2026-010 — Escova',
        amount: '120.00',
        professionalName: 'Jessica',
        entityType: 'comanda',
        entityId: 'cm1',
      }),
      item({
        id: 'p1',
        occurredAt: '2026-11-01T15:00:00.000Z',
        kind: 'contract_payment',
        description: 'Pagamento do contrato CT-2026-007',
        amount: '1000.00',
        entityType: 'contract',
        entityId: 'ct1',
      }),
    ]);
    const rows = await screen.findAllByTestId('client-history-item');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Comanda C-2026-010 — Escova');
    expect(rows[0]).toHaveTextContent('R$ 120,00');
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/comanda/cm1');
    expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', '/contratos/ct1');
  });

  it('estado vazio só quando não há itens', async () => {
    renderTab([]);
    expect(await screen.findByText('Sem histórico ainda')).toBeInTheDocument();
    expect(screen.queryByTestId('client-history-item')).toBeNull();
  });
});
