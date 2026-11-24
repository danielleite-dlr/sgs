import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ServicesQuery } from '@/features/catalog/api/servicos.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { BridalGroupQuery, BridalGroupsQuery } from '../api/bridal.api';
import { ContractPackagesQuery } from '../api/contracts.api';
import { BridalGroupDetailPage } from '../pages/BridalGroupDetailPage';
import { BridalGroupsPage } from '../pages/BridalGroupsPage';
import { group, member } from './bridal-fixtures';

// quick 261124-n98: serviço do evento sem agendamento aparece como "Falta agendar" no grupo.

const svc = (id: string, name: string) => ({
  __typename: 'BridalMemberService',
  id: `bms-${id}`,
  serviceId: id,
  serviceName: name,
  purpose: 'event',
  durationMinutes: 60,
});

const g = group({
  id: 'g1',
  name: 'Noiva Evillyn Assis',
  eventDate: '2026-11-20',
  unscheduledServiceCount: 1,
  members: [
    member({ id: 'm1', role: 'bride', clientName: 'Evillyn Assis' }),
    member({
      id: 'm2',
      clientId: 'c-edna',
      clientName: 'Edna Maria',
      services: [svc('make', 'Maquiagem madrinha'), svc('pent', 'Penteado madrinha')] as never,
      unscheduledServiceIds: ['make'],
    }),
    member({
      id: 'm3',
      clientName: 'Maria Edileide',
      services: [svc('pent', 'Penteado madrinha')] as never,
    }),
  ],
});

const detailMocks: MockedResponse[] = [
  {
    request: { query: BridalGroupQuery },
    variableMatcher: () => true,
    maxUsageCount: 20,
    result: { data: { bridalGroup: g } },
  },
];

function AgendaProbe() {
  const loc = useLocation();
  return <p data-testid="agenda-url">{loc.search}</p>;
}

function renderDetail() {
  return render(
    <MockedProvider mocks={detailMocks}>
      <MemoryRouter initialEntries={['/noivas/g1']}>
        <Routes>
          <Route path="/noivas/:id" element={<BridalGroupDetailPage />} />
          <Route path="/agenda" element={<AgendaProbe />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

afterEach(() => {
  useAuthStore.setState({ roleName: null });
});

describe('Falta agendar no grupo', () => {
  it('mostra o serviço sem agendamento só em quem tem pendência', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderDetail();
    expect(await screen.findByTestId('unscheduled-m2')).toHaveTextContent(
      'Falta agendar: Maquiagem madrinha',
    );
    expect(screen.queryByTestId('unscheduled-m3')).toBeNull();
    expect(screen.queryByTestId('unscheduled-m1')).toBeNull();
  });

  it('Agendar abre a agenda do dia com a pessoa e o serviço que falta', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderDetail();
    fireEvent.click(await screen.findByTestId('schedule-missing-m2'));
    const p = new URLSearchParams((await screen.findByTestId('agenda-url')).textContent ?? '');
    expect(p.get('data')).toBe('2026-11-20');
    expect(p.get('novo')).toBe('1');
    expect(p.get('cliente')).toBe('c-edna');
    expect(p.get('servicos')).toBe('make');
  });

  it('sem permissão de agenda mostra o aviso sem o botão', async () => {
    useAuthStore.setState({ roleName: 'PROFESSIONAL' });
    renderDetail();
    expect(await screen.findByTestId('unscheduled-m2')).toBeInTheDocument();
    expect(screen.queryByTestId('schedule-missing-m2')).toBeNull();
  });
});

describe('Sinal na lista de grupos', () => {
  const ok = group({ id: 'g2', name: 'Noiva Bia', eventDate: '2026-12-12' });
  const mocks: MockedResponse[] = [
    {
      request: { query: BridalGroupsQuery },
      variableMatcher: () => true,
      maxUsageCount: 20,
      result: { data: { bridalGroups: [g, ok] } },
    },
    {
      request: { query: ServicesQuery },
      variableMatcher: () => true,
      maxUsageCount: 20,
      result: { data: { services: [] } },
    },
    {
      request: { query: ContractPackagesQuery },
      variableMatcher: () => true,
      maxUsageCount: 20,
      result: { data: { packages: [] } },
    },
  ];

  it('marca só o grupo com serviço sem agendar', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    render(
      <MockedProvider mocks={mocks}>
        <MemoryRouter>
          <BridalGroupsPage />
        </MemoryRouter>
      </MockedProvider>,
    );
    expect(await screen.findByTestId('group-unscheduled-g1')).toHaveTextContent(
      '1 serviço sem agendar',
    );
    expect(screen.queryByTestId('group-unscheduled-g2')).toBeNull();
  });
});
