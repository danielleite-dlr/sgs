import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { ProfessionalsForServiceQuery } from '@/features/operations/api/appointments.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { ScheduleBridalEventMutation, type BridalAppointmentData } from '../api/bridal.api';
import { AiSuggestionPanel } from '../components/AiSuggestionPanel';
import { BridalTrialCard } from '../components/BridalTrialCard';
import { trialRowsFor } from '../lib/trial-rows';
import { group, member } from './bridal-fixtures';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const svc = (id: string, serviceId: string, serviceName: string, purpose: string) => ({
  __typename: 'BridalMemberService',
  id,
  serviceId,
  serviceName,
  durationMinutes: 60,
  purpose,
});

const appt = (p: Partial<BridalAppointmentData> & { id: string }): BridalAppointmentData => ({
  groupMemberId: 'm1',
  clientName: 'Ewelly',
  serviceName: 'Maquiagem noiva',
  professionalId: 'p1',
  professionalName: 'Jessica Seixas',
  startsAt: '2026-11-20T11:00:00.000Z',
  endsAt: '2026-11-20T12:00:00.000Z',
  status: 'scheduled',
  purpose: 'event',
  covered: false,
  comandaId: null,
  comandaStatus: null,
  ...p,
});

const bride = member({
  id: 'm1',
  role: 'bride',
  clientName: 'Ewelly',
  services: [
    svc('s1', 'make', 'Maquiagem noiva', 'event'),
    svc('s2', 'make', 'Maquiagem noiva', 'trial'),
  ],
});
const companion = member({
  id: 'm2',
  clientName: 'Mãe',
  services: [svc('s3', 'make', 'Maquiagem noiva', 'event')],
});

const baseGroup = (appointments: BridalAppointmentData[] = []) =>
  group({
    id: 'g1',
    eventDate: '2026-11-20',
    members: [bride, companion],
    appointments,
  });

const profsMock: MockedResponse = {
  request: { query: ProfessionalsForServiceQuery },
  variableMatcher: () => true,
  maxUsageCount: 20,
  result: {
    data: {
      professionalsForService: [
        { __typename: 'Member', id: 'p1', displayName: 'Jessica Seixas', isFixed: true },
        { __typename: 'Member', id: 'p9', displayName: 'A definir', isFixed: false },
      ],
    },
  },
};

function renderCard(g = baseGroup(), extra: MockedResponse[] = []) {
  return render(
    <MockedProvider mocks={[profsMock, ...extra]}>
      <MemoryRouter>
        <BridalTrialCard group={g} onScheduled={() => undefined} />
      </MemoryRouter>
    </MockedProvider>,
  );
}

afterEach(() => {
  useAuthStore.setState({ roleName: null });
});

describe('BridalTrialCard', () => {
  it('grupo sem serviço de teste não renderiza nada', () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    const { container } = renderCard(
      group({ id: 'g2', members: [member({ id: 'm1', services: [svc('s1', 'x', 'X', 'event')] })] }),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('"Agendar teste" monta só a linha do serviço de teste da noiva', () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderCard();
    fireEvent.click(screen.getByTestId('trial-start'));
    expect(screen.getAllByTestId(/^schedule-row-\d+$/)).toHaveLength(1);
    expect(screen.getByTestId('schedule-row-0')).toHaveTextContent('Ewelly');
  });

  it('D-19: a consulta da linha da noiva vai com bridal: true', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    const seen: { serviceId: string; bridal: boolean }[] = [];
    const spy: MockedResponse = {
      request: { query: ProfessionalsForServiceQuery },
      variableMatcher: (v) => {
        seen.push(v as { serviceId: string; bridal: boolean });
        return true;
      },
      maxUsageCount: 20,
      result: { data: { professionalsForService: [] } },
    };
    render(
      <MockedProvider mocks={[spy]}>
        <MemoryRouter>
          <BridalTrialCard group={baseGroup()} onScheduled={() => undefined} />
        </MemoryRouter>
      </MockedProvider>,
    );
    fireEvent.click(screen.getByTestId('trial-start'));
    await waitFor(() => expect(seen).toContainEqual({ serviceId: 'make', bridal: true }));
    expect(await screen.findByTestId('row-0-bride-empty')).toBeInTheDocument();
  });

  it('D-01: pré-preenche a profissional do evento ativo; sem evento ou cancelado fica em branco', () => {
    expect(trialRowsFor(baseGroup([appt({ id: 'e1', professionalId: 'p7' })]))[0]).toMatchObject({
      professionalId: 'p7',
      purpose: 'trial',
      date: '',
    });
    expect(trialRowsFor(baseGroup())[0].professionalId).toBe('');
    expect(
      trialRowsFor(baseGroup([appt({ id: 'e1', professionalId: 'p7', status: 'cancelled' })]))[0]
        .professionalId,
    ).toBe('');
  });

  it('sem evento agendado o botão continua disponível (não bloqueia o teste)', () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderCard(baseGroup());
    expect(screen.getByTestId('trial-start')).toBeEnabled();
  });

  it('data começa vazia; data igual ou depois do evento é recusada; antes habilita o envio', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    let sent: { input: { groupId: string; items: Record<string, unknown>[] } } | null = null;
    renderCard(baseGroup([appt({ id: 'e1', professionalId: 'p1' })]), [
      {
        request: { query: ScheduleBridalEventMutation },
        variableMatcher: (v) => {
          sent = v as typeof sent;
          return true;
        },
        result: {
          data: {
            scheduleBridalEvent: {
              __typename: 'BridalSchedulePayload',
              appointmentIds: [],
              group: null,
              errors: [],
            },
          },
        },
      },
    ]);
    fireEvent.click(screen.getByTestId('trial-start'));
    expect(screen.getByTestId('trial-date')).toHaveValue('');
    expect(screen.getByTestId('trial-confirm')).toBeDisabled();

    await waitFor(() =>
      expect(screen.getByTestId('row-0-prof').querySelectorAll('option').length).toBeGreaterThan(2),
    );
    fireEvent.change(screen.getByTestId('row-0-start'), { target: { value: '10:00' } });

    fireEvent.change(screen.getByTestId('trial-date'), { target: { value: '2026-11-20' } });
    expect(screen.getByTestId('trial-date-error')).toHaveTextContent(
      'O teste deve ser antes do dia do evento.',
    );
    expect(screen.getByTestId('trial-confirm')).toBeDisabled();

    fireEvent.change(screen.getByTestId('trial-date'), { target: { value: '2026-11-17' } });
    expect(screen.queryByTestId('trial-date-error')).toBeNull();
    expect(screen.getByTestId('trial-confirm')).toBeEnabled();

    fireEvent.click(screen.getByTestId('trial-confirm'));
    await waitFor(() => expect(sent).not.toBeNull());
    const input = sent!.input;
    expect(input.groupId).toBe('g1');
    expect(input.items).toHaveLength(1);
    expect(input.items[0]).toMatchObject({
      groupMemberId: 'm1',
      serviceId: 'make',
      professionalId: 'p1',
      purpose: 'trial',
      startsAt: '2026-11-17T13:00:00.000Z',
      endsAt: '2026-11-17T14:00:00.000Z',
    });
    expect(input).not.toHaveProperty('deposits');
  });

  it('teste já agendado mostra Agendado com data, horário e profissional e some o botão', () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderCard(
      baseGroup([
        appt({
          id: 't1',
          purpose: 'trial',
          startsAt: '2026-11-17T14:00:00.000Z',
          endsAt: '2026-11-17T15:00:00.000Z',
        }),
      ]),
    );
    const entry = screen.getByTestId('trial-entry-m1-make');
    expect(within(entry).getByText('Agendado', { exact: true })).toBeInTheDocument();
    expect(entry).toHaveTextContent('17/11/2026 11:00–12:00 · Jessica Seixas');
    expect(screen.queryByTestId('trial-start')).toBeNull();
  });

  it('teste sem agendamento mostra Pendente', () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderCard();
    expect(screen.getByText('Pendente', { exact: true })).toBeInTheDocument();
  });

  it('erro do servidor aparece em alerta e mantém as linhas', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderCard(baseGroup([appt({ id: 'e1', professionalId: 'p1' })]), [
      {
        request: { query: ScheduleBridalEventMutation },
        variableMatcher: () => true,
        result: {
          data: {
            scheduleBridalEvent: {
              __typename: 'BridalSchedulePayload',
              appointmentIds: [],
              group: null,
              errors: [
                {
                  __typename: 'UserError',
                  code: 'TRIAL_ALREADY_SCHEDULED',
                  message: 'x',
                  field: 'items',
                },
              ],
            },
          },
        },
      },
    ]);
    fireEvent.click(screen.getByTestId('trial-start'));
    await waitFor(() =>
      expect(screen.getByTestId('row-0-prof').querySelectorAll('option').length).toBeGreaterThan(2),
    );
    fireEvent.change(screen.getByTestId('row-0-start'), { target: { value: '10:00' } });
    fireEvent.change(screen.getByTestId('trial-date'), { target: { value: '2026-11-17' } });
    fireEvent.click(screen.getByTestId('trial-confirm'));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('O teste deste serviço já está agendado.'),
    );
    expect(screen.getAllByTestId(/^schedule-row-\d+$/)).toHaveLength(1);
  });
});

describe('AiSuggestionPanel com só o teste agendado', () => {
  it('continua oferecendo o agendamento do evento', () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    render(
      <MockedProvider mocks={[profsMock]}>
        <MemoryRouter>
          <AiSuggestionPanel
            group={baseGroup([appt({ id: 't1', purpose: 'trial' })])}
            onScheduled={() => undefined}
          />
        </MemoryRouter>
      </MockedProvider>,
    );
    expect(screen.getByTestId('ai-manual')).toBeInTheDocument();
  });
});
