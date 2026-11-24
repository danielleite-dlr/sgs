import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AppointmentData } from '../api/appointments.api';
import { AppointmentCard } from '../components/calendar/AppointmentCard';
import { appointmentToSchedule, getAppointmentStyle } from '../components/calendar/types';

// Card da noiva (ou debutante) na agenda leva o selo; acompanhantes e social não.

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
  bridalGroupId: 'g1',
  bridalGroupName: 'Ewelly',
  bridalEventKind: 'noiva',
  bridalRole: 'bride',
  purpose: 'event',
  client: { id: 'c1', fullName: 'Ewelly Silva' },
  professional: { id: 'p1', displayName: 'Jessica Seixas' },
  service: { id: 's1', name: 'Maquiagem noiva' },
};

function renderCard(a: AppointmentData) {
  const s = appointmentToSchedule(a);
  return render(
    <TooltipProvider>
      <AppointmentCard appointment={s} style={getAppointmentStyle(s, 48)} draggable={false} />
    </TooltipProvider>,
  );
}

describe('selo Noiva no card da agenda', () => {
  it('noiva mostra o selo "Noiva" e o aria-label cita noiva', () => {
    renderCard(base);
    expect(screen.getByTestId('appointment-bride-a1')).toHaveTextContent(/^Noiva$/);
    expect(screen.getByTestId('appointment-card-a1').getAttribute('aria-label')).toContain(', noiva');
  });

  it('debutante mostra "Debutante"', () => {
    renderCard({ ...base, bridalEventKind: 'debutante' });
    expect(screen.getByTestId('appointment-bride-a1')).toHaveTextContent(/^Debutante$/);
  });

  it('teste da noiva mostra os dois selos', () => {
    renderCard({ ...base, purpose: 'trial' });
    expect(screen.getByTestId('appointment-bride-a1')).toBeInTheDocument();
    expect(screen.getByTestId('appointment-trial-a1')).toBeInTheDocument();
  });

  it('acompanhante e atendimento social ficam sem selo', () => {
    const { unmount } = renderCard({ ...base, bridalRole: 'companion' });
    expect(screen.queryByTestId('appointment-bride-a1')).toBeNull();
    unmount();
    renderCard({ ...base, bridalGroupId: null, bridalRole: null, purpose: null });
    expect(screen.queryByTestId('appointment-bride-a1')).toBeNull();
  });
});
