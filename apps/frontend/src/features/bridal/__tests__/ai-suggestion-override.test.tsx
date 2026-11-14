import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { ProfessionalsForServiceQuery } from '@/features/operations/api/appointments.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  ConfirmBridalScheduleMutation,
  SuggestBridalScheduleMutation,
} from '../api/ai-schedule.api';
import { ScheduleBridalEventMutation } from '../api/bridal.api';
import { AiSuggestionPanel } from '../components/AiSuggestionPanel';
import type * as TimelineOverrideLib from '@/features/operations/lib/timeline-override';
import { group, member } from './bridal-fixtures';

const requestOverride = vi.fn<(message: string) => Promise<string | null>>();

vi.mock('@/features/operations/lib/timeline-override', async (importOriginal) => {
  const real = await importOriginal<typeof TimelineOverrideLib>();
  return { ...real, requestTimelineOverride: (m: string) => requestOverride(m) };
});

const MSG = 'A acompanhante termina depois do início do registro.';

const g = group({
  id: 'g1',
  members: [
    member({
      id: 'm1',
      role: 'bride',
      clientName: 'Ana',
      services: [
        {
          id: 's1',
          serviceId: 'sv1',
          serviceName: 'Maquiagem',
          durationMinutes: 60,
          purpose: 'event',
        },
      ],
    }),
  ],
});

const profsMock: MockedResponse = {
  request: { query: ProfessionalsForServiceQuery },
  variableMatcher: () => true,
  maxUsageCount: 20,
  result: {
    data: { professionalsForService: [{ __typename: 'Member', id: 'p1', displayName: 'Paula' }] },
  },
};

const suggestMock: MockedResponse = {
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
          fallbackReason: null,
          items: [
            {
              __typename: 'AiScheduleItem',
              personRef: 'r0',
              groupMemberId: 'm1',
              personLabel: 'Ana',
              role: 'bride',
              serviceId: 'sv1',
              serviceName: 'Maquiagem',
              professionalId: 'p1',
              professionalName: 'Paula',
              startsAt: '2026-12-05T11:00:00.000Z',
              endsAt: '2026-12-05T12:00:00.000Z',
            },
          ],
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

const timelineError = {
  __typename: 'UserError',
  code: 'TIMELINE_AFTER_REGISTRY',
  message: MSG,
  field: null,
};

/** Primeira chamada recusa pelo cronograma; a segunda (com override) é aceita. */
function twoStep(
  query: typeof ConfirmBridalScheduleMutation,
  field: 'confirmBridalSchedule' | 'scheduleBridalEvent',
  payloadType: string,
  seen: unknown[],
): MockedResponse[] {
  const body = (errors: unknown[]) => ({
    data: {
      [field]: { __typename: payloadType, appointmentIds: [], group: null, errors },
    },
  });
  return [
    {
      request: { query },
      variableMatcher: (v) => {
        const o = (v as { input: { timelineOverride?: unknown } }).input.timelineOverride;
        if (o) return false;
        seen.push(o);
        return true;
      },
      result: body([timelineError]),
    },
    {
      request: { query },
      variableMatcher: (v) => {
        const o = (v as { input: { timelineOverride?: unknown } }).input.timelineOverride;
        if (!o) return false;
        seen.push(o);
        return true;
      },
      result: body([]),
    },
  ];
}

function renderPanel(mocks: MockedResponse[], onScheduled = vi.fn()) {
  render(
    <MockedProvider mocks={[profsMock, ...mocks]}>
      <MemoryRouter>
        <AiSuggestionPanel group={g} onScheduled={onScheduled} />
      </MemoryRouter>
    </MockedProvider>,
  );
  return onScheduled;
}

async function fillManualRow() {
  fireEvent.click(screen.getByTestId('ai-manual'));
  await waitFor(() =>
    expect(screen.getByTestId('row-0-prof').querySelectorAll('option').length).toBeGreaterThan(1),
  );
  fireEvent.change(screen.getByTestId('row-0-prof'), { target: { value: 'p1' } });
  fireEvent.change(screen.getByTestId('row-0-start'), { target: { value: '14:00' } });
}

beforeEach(() => {
  requestOverride.mockReset();
});

afterEach(() => {
  useAuthStore.setState({ roleName: null });
});

describe('AiSuggestionPanel: override do cronograma da noiva', () => {
  it('manual: Gerente é convidado a forçar e a agenda é gravada com o motivo', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    requestOverride.mockResolvedValue('Noiva pediu para adiantar');
    const seen: unknown[] = [];
    const onScheduled = renderPanel(
      twoStep(ScheduleBridalEventMutation, 'scheduleBridalEvent', 'BridalGroupPayload', seen),
    );
    await fillManualRow();
    fireEvent.click(screen.getByTestId('ai-confirm'));
    await waitFor(() => expect(onScheduled).toHaveBeenCalled());
    expect(requestOverride).toHaveBeenCalledWith(MSG);
    expect(seen).toEqual([undefined, { reason: 'Noiva pediu para adiantar' }]);
    expect(screen.getByTestId('ai-errors')).toBeEmptyDOMElement();
  });

  it('IA: Administrador cancela o diálogo e a mensagem do servidor fica na tela', async () => {
    useAuthStore.setState({ roleName: 'ADMIN' });
    requestOverride.mockResolvedValue(null);
    const seen: unknown[] = [];
    const onScheduled = renderPanel([
      suggestMock,
      ...twoStep(ConfirmBridalScheduleMutation, 'confirmBridalSchedule', 'BridalSchedulePayload', seen),
    ]);
    fireEvent.click(screen.getByTestId('ai-suggest'));
    await screen.findByTestId('schedule-row-0');
    fireEvent.click(screen.getByTestId('ai-confirm'));
    await waitFor(() => expect(screen.getByTestId('ai-errors')).toHaveTextContent(MSG));
    expect(requestOverride).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([undefined]);
    expect(onScheduled).not.toHaveBeenCalled();
  });

  it('IA: com motivo, reenvia a confirmação com timelineOverride', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    requestOverride.mockResolvedValue('Combinado com a noiva');
    const seen: unknown[] = [];
    const onScheduled = renderPanel([
      suggestMock,
      ...twoStep(ConfirmBridalScheduleMutation, 'confirmBridalSchedule', 'BridalSchedulePayload', seen),
    ]);
    fireEvent.click(screen.getByTestId('ai-suggest'));
    await screen.findByTestId('schedule-row-0');
    fireEvent.click(screen.getByTestId('ai-confirm'));
    await waitFor(() => expect(onScheduled).toHaveBeenCalled());
    expect(seen).toEqual([undefined, { reason: 'Combinado com a noiva' }]);
  });

  it('Atendente não vê o diálogo: só a mensagem do servidor', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    const seen: unknown[] = [];
    renderPanel(
      twoStep(ScheduleBridalEventMutation, 'scheduleBridalEvent', 'BridalGroupPayload', seen),
    );
    await fillManualRow();
    fireEvent.click(screen.getByTestId('ai-confirm'));
    await waitFor(() => expect(screen.getByTestId('ai-errors')).toHaveTextContent(MSG));
    expect(requestOverride).not.toHaveBeenCalled();
    expect(seen).toEqual([undefined]);
  });
});
