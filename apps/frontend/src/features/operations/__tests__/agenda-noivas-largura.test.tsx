import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { MembersQuery } from '@/features/catalog/api/members.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  AppointmentsQuery,
  TimeBlocksQuery,
  type AppointmentData,
} from '../api/appointments.api';
import { SchedulePage } from '../pages/SchedulePage';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// quick 261112-cko: filtro por noiva, profissionais na largura toda e rolagem da grade.

const today = new Date();
const at = (h: number) =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate(), h).toISOString();

const NAMES = ['Ana Make', 'Bia Pente', 'Cris Make', 'Duda Pente', 'Eva Make'];
const members = NAMES.map((displayName, i) => ({
  __typename: 'Member',
  id: `p${i + 1}`,
  displayName,
  email: `p${i + 1}@x.com`,
  roleName: 'PROFESSIONAL',
  seniorityTier: null,
  isProfessional: true,
}));

function appt(
  id: string,
  pro: string,
  h: number,
  client: string,
  bridal?: { group: string; name: string; role: 'bride' | 'companion' },
): AppointmentData {
  return {
    __typename: 'Appointment',
    id,
    professionalId: pro,
    clientId: `c-${client}`,
    serviceId: 's1',
    serviceVariantId: null,
    comandaId: null,
    comandaCode: null,
    comandaStatus: null,
    depositAmount: '0.00',
    startsAt: at(h),
    endsAt: at(h + 1),
    status: 'scheduled',
    notes: null,
    cancelReason: null,
    cancelReasonTag: null,
    cancelledAt: null,
    bridalGroupId: bridal?.group ?? null,
    bridalGroupName: bridal?.name ?? null,
    bridalEventKind: bridal ? 'noiva' : null,
    bridalRole: bridal?.role ?? null,
    client: { __typename: 'Client', id: `c-${client}`, fullName: client },
    professional: {
      __typename: 'Member',
      id: pro,
      displayName: NAMES[Number(pro.slice(1)) - 1],
    },
    service: {
      __typename: 'Service',
      id: 's1',
      name: 'Make',
      defaultDurationMinutes: 60,
      category: null,
    },
  } as AppointmentData;
}

const NATHA = { group: 'g1', name: 'Noiva Nathá', role: 'bride' as const };
const appointments = [
  appt('a1', 'p4', 8, 'Nathá', NATHA),
  appt('a2', 'p5', 9, 'Izabel', { ...NATHA, role: 'companion' }),
  appt('a3', 'p4', 10, 'Sheyla', { group: 'g2', name: 'Noiva Sheyla', role: 'bride' }),
  appt('a4', 'p2', 11, 'Social'),
];

function renderSchedule() {
  useAuthStore.setState({ roleName: 'ADMIN', memberId: 'x' });
  const mocks: MockedResponse[] = [
    { request: { query: MembersQuery }, result: { data: { members } }, maxUsageCount: 10 },
    {
      request: { query: AppointmentsQuery },
      variableMatcher: () => true,
      result: { data: { appointments } },
      maxUsageCount: 10,
    },
    {
      request: { query: TimeBlocksQuery },
      variableMatcher: () => true,
      result: { data: { timeBlocks: [] } },
      maxUsageCount: 10,
    },
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <SchedulePage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

const laneOrder = () =>
  screen
    .getAllByTestId(/^lane-p\d$/)
    .map((el) => el.getAttribute('data-testid')!.replace('lane-', ''));

describe('noivas do dia (quick 261112-cko)', () => {
  it('um botão por noiva; filtrar mostra só a noiva, as acompanhantes e as profissionais delas', async () => {
    renderSchedule();
    const barra = await screen.findByTestId('bridal-filter');
    const natha = within(barra).getByRole('button', { name: /Noiva Nathá/ });
    expect(within(barra).getByRole('button', { name: /Noiva Sheyla/ })).toBeInTheDocument();
    // noiva + 1 acompanhante
    expect(natha).toHaveTextContent('2');
    expect(screen.getByTestId('appointment-card-a4')).toBeInTheDocument();

    fireEvent.click(natha);
    expect(natha).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('appointment-card-a1')).toBeInTheDocument();
    expect(screen.getByTestId('appointment-card-a2')).toBeInTheDocument();
    expect(screen.queryByTestId('appointment-card-a3')).toBeNull();
    expect(screen.queryByTestId('appointment-card-a4')).toBeNull();
    expect(laneOrder()).toEqual(['p4', 'p5']);

    fireEvent.click(within(barra).getByRole('button', { name: 'Todas' }));
    expect(screen.getByTestId('appointment-card-a4')).toBeInTheDocument();
  });
});

describe('profissionais na largura toda (quick 261112-cko)', () => {
  it('colunas e botões começam por quem tem atendimento no dia', async () => {
    renderSchedule();
    await screen.findByTestId('appointment-card-a1');
    expect(laneOrder()).toEqual(['p2', 'p4', 'p5', 'p1', 'p3']);
    const barra = screen.getByTestId('prof-avatars');
    const nomes = within(barra)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(nomes).toEqual(['Agenda de Bia Pente', 'Agenda de Duda Pente', 'Agenda de Eva Make', 'Agenda de Ana Make']);
    expect(barra).toHaveTextContent('+1');
  });

  it('com o menu da agenda recolhido, todas as profissionais numa linha própria, sem "+N"', async () => {
    renderSchedule();
    await screen.findByTestId('appointment-card-a1');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar filtros' }));
    const barra = screen.getByTestId('prof-avatars');
    expect(barra.className).toMatch(/\bflex-wrap\b/);
    expect(within(barra).getAllByRole('button')).toHaveLength(5);
    expect(barra).not.toHaveTextContent('+');
  });
});

describe('rolagem da grade (quick 261112-cko)', () => {
  it('contêiner com barra visível; grade sem overflow-hidden e com largura mínima pelas colunas', async () => {
    renderSchedule();
    await screen.findByTestId('appointment-card-a1');
    expect(screen.getByTestId('schedule-scroll').className).toMatch(/\boverflow-auto\b/);
    expect(screen.getByTestId('schedule-scroll').className).toMatch(/\bscrollbar-visible\b/);
    const grid = screen.getByTestId('day-grid');
    expect(grid.className).not.toMatch(/\boverflow-hidden\b/);
    // 64 px de horas + 5 colunas de 160 px (densidade M)
    expect(grid.style.minWidth).toBe('864px');
  });
});
