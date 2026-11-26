import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { MembersQuery } from '@/features/catalog/api/members.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { AppointmentsQuery, TimeBlocksQuery } from '../api/appointments.api';
import { SchedulePage } from '../pages/SchedulePage';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Fase 7, plano 07-05 (D-14): ?agendamento= abre o atendimento no dia da URL.

const at = (d: Date, h: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0).toISOString();

const appointment = (id: string, day: Date, clientName: string) => ({
  __typename: 'Appointment',
  id,
  professionalId: 'p1',
  clientId: `c-${id}`,
  serviceId: 's1',
  serviceVariantId: null,
  comandaId: null,
  comandaCode: null,
  comandaStatus: null,
  depositAmount: '0.00',
  startsAt: at(day, 14),
  endsAt: at(day, 15),
  status: 'scheduled',
  notes: null,
  cancelReason: null,
  cancelReasonTag: null,
  cancelledAt: null,
  bridalGroupId: null,
  bridalGroupName: null,
  bridalEventKind: null,
  bridalRole: null,
  client: { __typename: 'Client', id: `c-${id}`, fullName: clientName },
  professional: { __typename: 'Member', id: 'p1', displayName: 'Bia Souza' },
  service: {
    __typename: 'Service',
    id: 's1',
    name: 'Corte',
    defaultDurationMinutes: 60,
    category: { __typename: 'ServiceCategory', id: 'cat1', name: 'Cabelo' },
  },
});

const DAY20 = new Date(2026, 10, 20);
const DAY21 = new Date(2026, 10, 21);

let navigateRef: ReturnType<typeof useNavigate>;
function Probe() {
  navigateRef = useNavigate();
  const loc = useLocation();
  return <div data-testid="search">{loc.search}</div>;
}

function renderAt(url: string) {
  useAuthStore.setState({ roleName: 'ADMIN', memberId: 'x' });
  const members = [
    {
      id: 'p1',
      displayName: 'Bia Souza',
      email: 'p1@x.com',
      roleName: 'PROFESSIONAL',
      seniorityTier: null,
      isProfessional: true,
    },
  ];
  const all = [
    appointment('a1', DAY20, 'Joana Prado'),
    appointment('a2', DAY21, 'Karina Melo'),
  ];
  const mocks: MockedResponse[] = [
    { request: { query: MembersQuery }, result: { data: { members } }, maxUsageCount: 20 },
    {
      request: { query: AppointmentsQuery },
      variableMatcher: () => true,
      result: (vars: { startsAt: string; endsAt: string }) => ({
        data: {
          appointments: all.filter(
            (a) => new Date(a.startsAt) >= new Date(vars.startsAt) && new Date(a.startsAt) < new Date(vars.endsAt),
          ),
        },
      }),
      maxUsageCount: 20,
    },
    {
      request: { query: TimeBlocksQuery },
      variableMatcher: () => true,
      result: { data: { timeBlocks: [] } },
      maxUsageCount: 20,
    },
  ];
  const utils = render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={[url]}>
        <Probe />
        <SchedulePage />
      </MemoryRouter>
    </MockedProvider>,
  );
  // A agenda abre com o menu de filtros recolhido (quick 261126-f22).
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar filtros' }));
  return utils;
}

afterEach(cleanup);

describe('agenda: deep link do push (D-14)', () => {
  it('abre o atendimento do parâmetro e remove o parâmetro da URL', async () => {
    renderAt('/agenda?data=2026-11-20&visao=day&agendamento=a1');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Joana Prado')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('search').textContent).not.toContain('agendamento');
    });
    expect(screen.getByTestId('search').textContent).toContain('data=2026-11-20');
  });

  it('id inexistente não abre diálogo e limpa o parâmetro', async () => {
    renderAt('/agenda?data=2026-11-20&visao=day&agendamento=inexistente');
    await waitFor(() => {
      expect(screen.getByTestId('search').textContent).not.toContain('agendamento');
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('com a página montada, nova URL troca o dia e abre o outro atendimento', async () => {
    renderAt('/agenda?data=2026-11-20&visao=day');
    await screen.findAllByRole('button', { name: 'Bia Souza — visível' });
    await act(async () => {
      navigateRef('/agenda?data=2026-11-21&visao=day&agendamento=a2');
    });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Karina Melo')).toBeInTheDocument();
  });
});
