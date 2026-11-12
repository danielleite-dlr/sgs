import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { ProfessionalsForServiceQuery } from '@/features/operations/api/appointments.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  ConfirmBridalScheduleMutation,
  SuggestBridalScheduleMutation,
} from '../api/ai-schedule.api';
import { AiSuggestionPanel } from '../components/AiSuggestionPanel';
import { group, member } from './bridal-fixtures';

const g = group({
  id: 'g1',
  members: [
    member({ id: 'm1', role: 'bride', clientName: 'Ana', coveredByContract: true }),
    member({ id: 'm2', clientName: 'Bia' }),
  ],
});

// 7 itens: cada um em horário próprio, profissionais p1 e p2 alternados
function item(i: number, prof: string) {
  const start = new Date(Date.UTC(2026, 11, 5, 11 + i, 0)); // 08:00 + i h em São Paulo
  return {
    __typename: 'AiScheduleItem',
    personRef: `r${i}`,
    groupMemberId: i % 2 === 0 ? 'm1' : 'm2',
    personLabel: i % 2 === 0 ? 'Ana' : 'Bia',
    role: 'bride',
    serviceId: 'sv1',
    serviceName: 'Maquiagem',
    professionalId: prof,
    professionalName: prof === 'p1' ? 'Paula' : 'Paulo',
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 60 * 60_000).toISOString(),
  };
}
const items = Array.from({ length: 7 }, (_, i) => item(i, i % 2 === 0 ? 'p1' : 'p2'));

function suggestMock(): MockedResponse {
  return {
    request: { query: SuggestBridalScheduleMutation },
    variableMatcher: () => true,
    result: {
      data: {
        suggestBridalSchedule: {
          __typename: 'AiScheduleSuggestionPayload',
          errors: [],
          suggestion: {
            __typename: 'AiScheduleSuggestion',
            id: 's1',
            source: 'heuristic',
            model: null,
            cached: false,
            fallbackReason: 'NO_API_KEY',
            items,
            unscheduled: [],
            warnings: [],
            dayStart: '2026-12-05T10:00:00.000Z',
            dayEnd: '2026-12-05T22:00:00.000Z',
            readyBy: '2026-12-05T17:00:00.000Z',
          },
        },
      },
    },
  };
}

const profsMock: MockedResponse = {
  request: { query: ProfessionalsForServiceQuery },
  variableMatcher: () => true,
  maxUsageCount: 20,
  result: {
    data: {
      professionalsForService: [
        { __typename: 'Member', id: 'p1', displayName: 'Paula' },
        { __typename: 'Member', id: 'p2', displayName: 'Paulo' },
      ],
    },
  },
};

function renderPanel(extra: MockedResponse[] = []) {
  return render(
    <MockedProvider mocks={[suggestMock(), profsMock, ...extra]}>
      <MemoryRouter>
        <AiSuggestionPanel group={g} onScheduled={() => undefined} />
      </MemoryRouter>
    </MockedProvider>,
  );
}

afterEach(() => {
  useAuthStore.setState({ roleName: null });
});

describe('AiSuggestionPanel', () => {
  it('ATTENDANT não vê o botão "Sugerir agenda IA"', () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    renderPanel();
    expect(screen.queryByText('Sugerir agenda IA')).not.toBeInTheDocument();
    expect(screen.getByText('Nada é gravado na agenda até você confirmar.')).toBeInTheDocument();
  });

  it('mostra a origem simples, edita, bloqueia conflito e confirma com 7 itens', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    let sentItems: unknown[] | null = null;
    renderPanel([
      {
        request: { query: ConfirmBridalScheduleMutation },
        variableMatcher: (v) => {
          sentItems = (v as { input: { items: unknown[] } }).input.items;
          return true;
        },
        result: {
          data: {
            confirmBridalSchedule: {
              __typename: 'BridalSchedulePayload',
              appointmentIds: [],
              group: null,
              errors: [
                {
                  __typename: 'UserError',
                  code: 'INVALID_PROPOSAL',
                  message: 'x',
                  field: null,
                },
              ],
            },
          },
        },
      },
    ]);
    fireEvent.click(screen.getByTestId('ai-suggest'));
    expect(await screen.findByText('IA não configurada — sugestão simples.')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^schedule-row-\d+$/)).toHaveLength(7);

    // linha 1 (Paulo, 09:00) passa para Paula e para 08:30: sobrepõe a linha 0 (Paula 08:00-09:00)
    await waitFor(() =>
      expect(screen.getByTestId('row-1-prof').querySelectorAll('option').length).toBeGreaterThan(2),
    );
    const confirmBtn = screen.getByTestId('ai-confirm');
    expect(confirmBtn).toBeEnabled();
    fireEvent.change(screen.getByTestId('row-1-prof'), { target: { value: 'p1' } });
    fireEvent.change(screen.getByTestId('row-1-start'), { target: { value: '08:30' } });
    expect(confirmBtn).toBeDisabled();
    expect(screen.getAllByText(/Conflito com a linha/).length).toBeGreaterThan(0);

    // desfaz
    fireEvent.change(screen.getByTestId('row-1-prof'), { target: { value: 'p2' } });
    expect(confirmBtn).toBeEnabled();

    fireEvent.click(confirmBtn);
    await waitFor(() =>
      expect(screen.getByTestId('ai-errors')).toHaveTextContent('A proposta de agenda não é válida'),
    );
    expect(sentItems).toHaveLength(7);
    // a edição continua na tela
    expect(screen.getAllByTestId(/^schedule-row-\d+$/)).toHaveLength(7);
  });

  it('"Montar manualmente" lista só os serviços do evento (sem duplicar o teste)', () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    const svc = (id: string, serviceId: string, serviceName: string, purpose: string) => ({
      __typename: 'BridalMemberService',
      id,
      serviceId,
      serviceName,
      durationMinutes: 60,
      purpose,
    });
    const withTrial = group({
      id: 'g2',
      members: [
        member({
          id: 'm1',
          role: 'bride',
          clientName: 'Ana',
          services: [
            svc('s1', 'make', 'Maquiagem', 'event'),
            svc('s2', 'hair', 'Penteado', 'event'),
            svc('s3', 'make', 'Maquiagem', 'trial'),
            svc('s4', 'hair', 'Penteado', 'trial'),
          ],
        }),
      ],
    });
    render(
      <MockedProvider mocks={[profsMock]}>
        <MemoryRouter>
          <AiSuggestionPanel group={withTrial} onScheduled={() => undefined} />
        </MemoryRouter>
      </MockedProvider>,
    );
    fireEvent.click(screen.getByTestId('ai-manual'));
    expect(screen.getAllByTestId(/^schedule-row-\d+$/)).toHaveLength(2);
  });
});
