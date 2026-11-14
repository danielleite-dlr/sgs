import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { MoveAppointmentMutation, type AppointmentData } from '../api/appointments.api';
import { useMoveAppointment } from '../hooks/useMoveAppointment';
import { TimelineOverrideHost } from '../components/TimelineOverrideHost';
import {
  isOverridableTimelineError,
  requestTimelineOverride,
} from '../lib/timeline-override';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const START = new Date(2026, 10, 4, 10, 0);
const NEW_START = new Date(2026, 10, 4, 12, 0);

const appointment: AppointmentData = {
  id: 'a1',
  professionalId: 'p1',
  clientId: 'c1',
  serviceId: 's1',
  serviceVariantId: null,
  comandaId: null,
  comandaCode: null,
  comandaStatus: null,
  depositAmount: '0.00',
  startsAt: START.toISOString(),
  endsAt: new Date(2026, 10, 4, 11, 0).toISOString(),
  status: 'scheduled',
  notes: null,
  cancelReason: null,
  cancelReasonTag: null,
  cancelledAt: null,
  client: { id: 'c1', fullName: 'Ana' },
  professional: { id: 'p1', displayName: 'Bia' },
  service: { id: 's1', name: 'Corte', defaultDurationMinutes: 60, category: null },
};

const target = { professionalId: 'p2', professionalName: 'Carla', startsAt: NEW_START };
const baseInput = { id: 'a1', professionalId: 'p2', startsAt: NEW_START.toISOString() };

function errorMock(code: string, message: string): MockedResponse {
  return {
    request: { query: MoveAppointmentMutation, variables: { input: baseInput } },
    result: {
      data: {
        moveAppointment: {
          __typename: 'AppointmentPayload',
          appointment: null,
          errors: [{ __typename: 'UserError', code, message, field: null }],
        },
      },
    },
  };
}

const MSG = 'A acompanhante só pode ficar depois do registro da noiva.';

function setup(mocks: MockedResponse[]) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks}>
      <>
        {children}
        <TimelineOverrideHost />
      </>
    </MockedProvider>
  );
  const r = renderHook(() => useMoveAppointment(), { wrapper });
  return r;
}

describe('override do cronograma ao mover', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => useAuthStore.setState({ roleName: null }));

  it('MANAGER: mostra o diálogo, exige motivo e reenvia com timelineOverride', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    let resentWith: unknown = null;
    const hook = setup([
      errorMock('TIMELINE_AFTER_REGISTRY', MSG),
      {
        request: { query: MoveAppointmentMutation },
        variableMatcher: (v) => {
          resentWith = v.input.timelineOverride;
          return true;
        },
        result: {
          data: {
            moveAppointment: {
              __typename: 'AppointmentPayload',
              appointment: {
                ...appointment,
                __typename: 'Appointment',
                professionalId: 'p2',
                professional: { __typename: 'Member', id: 'p2', displayName: 'Carla' },
                client: { __typename: 'Client', ...appointment.client },
                service: { __typename: 'Service', ...appointment.service },
                startsAt: NEW_START.toISOString(),
                endsAt: new Date(2026, 10, 4, 13, 0).toISOString(),
              },
              errors: [],
            },
          },
        },
      },
    ]);
    let done: Promise<boolean> | undefined;
    act(() => {
      done = hook.result.current(appointment, target);
    });
    expect(await screen.findByTestId('override-message')).toHaveTextContent(MSG);
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'pedido da noiva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Forçar mesmo assim' }));
    expect(await done).toBe(true);
    expect(resentWith).toEqual({ reason: 'pedido da noiva' });
    expect(toast.success).toHaveBeenCalledWith('Agendamento movido.');
  });

  it('ATTENDANT: sem diálogo, só a mensagem do servidor', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    const hook = setup([errorMock('TIMELINE_AFTER_REGISTRY', MSG)]);
    let ok = true;
    await act(async () => {
      ok = await hook.result.current(appointment, target);
    });
    expect(ok).toBe(false);
    expect(screen.queryByTestId('override-message')).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(`Não foi possível mover: ${MSG}`);
  });

  it('TIMELINE_LINKED_APPOINTMENT como ADMIN: sem diálogo de override', async () => {
    useAuthStore.setState({ roleName: 'ADMIN' });
    const linked = 'Este horário da noiva vem do Cronograma do dia. Mude por lá.';
    const hook = setup([errorMock('TIMELINE_LINKED_APPOINTMENT', linked)]);
    await act(async () => {
      await hook.result.current(appointment, target);
    });
    expect(screen.queryByTestId('override-message')).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(`Não foi possível mover: ${linked}`);
  });

  it('motivo curto mantém o botão desabilitado e Cancelar não reenvia', async () => {
    useAuthStore.setState({ roleName: 'ADMIN' });
    const hook = setup([errorMock('TIMELINE_PROFESSIONAL_WITH_BRIDE', MSG)]);
    let done: Promise<boolean> | undefined;
    act(() => {
      done = hook.result.current(appointment, target);
    });
    await screen.findByTestId('override-message');
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'ab' } });
    expect(screen.getByRole('button', { name: 'Forçar mesmo assim' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await done).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(`Não foi possível mover: ${MSG}`);
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('requestTimelineOverride (usado também pelo novo agendamento)', () => {
  it('resolve com o motivo trimado e com null ao cancelar', async () => {
    render(<TimelineOverrideHost />);
    let p!: Promise<string | null>;
    act(() => {
      p = requestTimelineOverride('Profissional da noiva neste horário.');
    });
    fireEvent.change(await screen.findByLabelText('Motivo'), { target: { value: '  cliente pediu ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Forçar mesmo assim' }));
    expect(await p).toBe('cliente pediu');
    await waitFor(() => expect(screen.queryByTestId('override-message')).toBeNull());

    act(() => {
      p = requestTimelineOverride('de novo');
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await p).toBeNull();
  });

  it('só TIMELINE_AFTER_REGISTRY e TIMELINE_PROFESSIONAL_WITH_BRIDE aceitam override', () => {
    expect(isOverridableTimelineError({ code: 'TIMELINE_AFTER_REGISTRY' })).toBe(true);
    expect(isOverridableTimelineError({ code: 'TIMELINE_PROFESSIONAL_WITH_BRIDE' })).toBe(true);
    for (const code of ['TIMELINE_LINKED_APPOINTMENT', 'OVERRIDE_FORBIDDEN', 'SLOT_TAKEN']) {
      expect(isOverridableTimelineError({ code })).toBe(false);
    }
    expect(isOverridableTimelineError(null)).toBe(false);
  });
});
