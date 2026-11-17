import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AppointmentData } from '../api/appointments.api';
import { AppointmentCard } from '../components/calendar/AppointmentCard';
import { AppointmentDetailsDialog } from '../components/calendar/AppointmentDetailsDialog';
import { WeekGrid } from '../components/calendar/WeekGrid';
import {
  appointmentToSchedule,
  getAppointmentStyle,
  type ScheduleAppointment,
} from '../components/calendar/types';
import { weekRange } from '../lib/week-range';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/config/features', () => ({ isPathEnabled: () => false }));

// quick 261117-gn8: teste de noiva aparece na agenda com o selo "Teste".

const days = weekRange(new Date(2026, 10, 17)).days;

const base: AppointmentData = {
  id: 'a1',
  professionalId: 'p1',
  clientId: 'c1',
  serviceId: 's1',
  serviceVariantId: null,
  comandaId: null,
  comandaCode: null,
  comandaStatus: null,
  depositAmount: '0.00',
  startsAt: new Date(2026, 10, 17, 11, 0).toISOString(),
  endsAt: new Date(2026, 10, 17, 12, 30).toISOString(),
  status: 'scheduled',
  notes: null,
  cancelReason: null,
  cancelReasonTag: null,
  cancelledAt: null,
  client: { id: 'c1', fullName: 'Ewelly Silva' },
  professional: { id: 'p1', displayName: 'Jessica Seixas' },
  service: { id: 's1', name: 'Maquiagem noiva' },
};

const trial: AppointmentData = { ...base, purpose: 'trial' };
const event: AppointmentData = { ...base, id: 'a2', purpose: 'event' };

function renderCard(a: ScheduleAppointment) {
  return render(
    <TooltipProvider>
      <AppointmentCard appointment={a} style={getAppointmentStyle(a, 48)} draggable={false} />
    </TooltipProvider>,
  );
}

describe('selo Teste no card do dia', () => {
  it('trial mostra o selo e o aria-label termina com ", teste"', () => {
    renderCard(appointmentToSchedule(trial));
    expect(screen.getByTestId('appointment-trial-a1')).toHaveTextContent(/^Teste$/);
    const label = screen.getByTestId('appointment-card-a1').getAttribute('aria-label') ?? '';
    expect(label.endsWith(', teste')).toBe(true);
  });

  it('card curto (< 60 min) também mostra o selo', () => {
    const short = appointmentToSchedule({
      ...trial,
      endsAt: new Date(2026, 10, 17, 11, 30).toISOString(),
    });
    renderCard(short);
    expect(screen.getByTestId('appointment-trial-a1')).toBeInTheDocument();
  });

  it('evento e atendimento social não mostram o selo', () => {
    const { unmount } = renderCard(appointmentToSchedule(event));
    expect(screen.queryByTestId('appointment-trial-a2')).toBeNull();
    unmount();
    renderCard(appointmentToSchedule({ ...base, purpose: null }));
    expect(screen.queryByTestId('appointment-trial-a1')).toBeNull();
  });
});

describe('selo Teste na semana', () => {
  it('week-card do trial contém Teste; o do evento não', () => {
    render(
      <WeekGrid
        days={days}
        appointments={[trial, event]}
        timeBlocks={[]}
        onOpenDay={vi.fn()}
      />,
    );
    expect(screen.getByTestId('week-card-a1')).toHaveTextContent('Teste');
    expect(within(screen.getByTestId('week-card-a2')).queryByText('Teste')).toBeNull();
  });
});

describe('detalhe do atendimento', () => {
  function renderDialog(appointment: AppointmentData) {
    render(
      <MockedProvider mocks={[]}>
        <MemoryRouter>
          <AppointmentDetailsDialog
            appointment={appointment}
            open
            onOpenChange={vi.fn()}
            canWrite
            onChanged={vi.fn()}
          />
        </MemoryRouter>
      </MockedProvider>,
    );
  }

  it('trial mostra Finalidade = Teste do evento', () => {
    renderDialog(trial);
    expect(screen.getByText('Finalidade', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Teste do evento', { exact: true })).toBeInTheDocument();
  });

  it('evento e social não mostram a linha Finalidade', () => {
    renderDialog(event);
    expect(screen.queryByText('Finalidade', { exact: true })).toBeNull();
  });
});
