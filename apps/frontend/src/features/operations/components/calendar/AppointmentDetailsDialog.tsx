import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { isPathEnabled } from '@/config/features';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import {
  UpdateAppointmentStatusMutation,
  type AppointmentData,
  type UpdateAppointmentStatusResult,
} from '../../api/appointments.api';
import { APPOINTMENT_STATUS_LABELS, COMANDA_STATUS_LABELS } from '../../lib/operations-labels';
import { CancelAppointmentDialog } from './CancelAppointmentDialog';
import { comandaHrefFromAgenda, type AgendaView } from '../../lib/agenda-link';
import { formatHM } from './types';

interface Props {
  appointment: AppointmentData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  onChanged: () => void;
  agendaDate?: Date;
  agendaView?: AgendaView;
}

export function AppointmentDetailsDialog({
  appointment,
  open,
  onOpenChange,
  canWrite,
  onChanged,
  agendaDate,
  agendaView,
}: Props) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [updateStatus, { loading }] =
    useMutation<UpdateAppointmentStatusResult>(UpdateAppointmentStatusMutation);

  if (!appointment) return null;
  const start = new Date(appointment.startsAt);
  const end = new Date(appointment.endsAt);
  const status = appointment.status;
  const hasDeposit = Number(appointment.depositAmount) > 0;
  const canConfirm = status === 'scheduled';
  const canStart = status === 'scheduled' || status === 'confirmed';
  const canCancel = status !== 'cancelled' && status !== 'completed' && status !== 'no_show';
  const comandaLinkEnabled = Boolean(appointment.comandaId) && isPathEnabled('/comanda');

  async function change(next: 'confirmed' | 'in_progress') {
    if (!appointment) return;
    try {
      const res = await updateStatus({
        variables: { input: { id: appointment.id, status: next } },
      });
      const errors = res.data?.updateAppointmentStatus.errors ?? [];
      if (errors.length > 0) {
        toast.error(errors[0].message);
        return;
      }
      toast.success(next === 'confirmed' ? 'Agendamento confirmado.' : 'Atendimento iniciado.');
      onChanged();
      onOpenChange(false);
    } catch {
      toast.error('Não foi possível atualizar o agendamento. Tente novamente.');
    }
  }

  const rows: [string, string][] = [
    ['Cliente', appointment.client.fullName],
    ['Serviço', appointment.service.name],
    ['Profissional', appointment.professional.displayName],
    [
      'Data e hora',
      `${start.toLocaleDateString('pt-BR')} ${formatHM(start)} às ${formatHM(end)}`,
    ],
    ['Status', APPOINTMENT_STATUS_LABELS[status] ?? status],
  ];
  if (hasDeposit) rows.push(['Sinal', `R$ ${formatCurrencyDisplay(appointment.depositAmount)}`]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="appointment-details" className="max-w-[460px]">
          <DialogTitle className="text-base font-bold text-neutral-800">
            Detalhes do agendamento
          </DialogTitle>
          <DialogDescription className="sr-only">
            Dados do agendamento e ações disponíveis.
          </DialogDescription>
          <dl className="grid grid-cols-[110px_1fr] gap-x-sm gap-y-xs text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-neutral-600">{k}</dt>
                <dd className="font-medium text-neutral-900">{v}</dd>
              </div>
            ))}
            {appointment.comandaCode && (
              <div className="contents">
                <dt className="text-neutral-600">Comanda</dt>
                <dd className="font-medium text-neutral-900">
                  <span data-testid="appointment-comanda-code">{appointment.comandaCode}</span>
                  {appointment.comandaStatus && (
                    <span className="ml-xs text-neutral-600">
                      ({COMANDA_STATUS_LABELS[appointment.comandaStatus] ?? appointment.comandaStatus})
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
          {appointment.notes && (
            <p className="text-sm text-neutral-700 rounded-md bg-neutral-50 p-sm">
              {appointment.notes}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-xs">
            {comandaLinkEnabled && (
              <Button asChild variant="outline" size="sm">
                <Link
                  to={comandaHrefFromAgenda(
                    appointment.comandaId as string,
                    agendaDate ?? start,
                    agendaView ?? 'day',
                  )}
                  data-testid="appointment-open-comanda"
                >
                  Abrir comanda
                </Link>
              </Button>
            )}
            {canWrite && canConfirm && (
              <Button
                variant="outline"
                size="sm"
                data-testid="appointment-confirm"
                disabled={loading}
                onClick={() => void change('confirmed')}
              >
                Confirmar
              </Button>
            )}
            {canWrite && canStart && (
              <Button
                size="sm"
                data-testid="appointment-start"
                disabled={loading}
                onClick={() => void change('in_progress')}
              >
                Iniciar atendimento
              </Button>
            )}
            {canWrite && canCancel && (
              <Button
                variant="destructive"
                size="sm"
                data-testid="appointment-cancel"
                onClick={() => setCancelOpen(true)}
              >
                Cancelar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <CancelAppointmentDialog
        appointment={appointment}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onCancelled={() => {
          onChanged();
          onOpenChange(false);
        }}
      />
    </>
  );
}
