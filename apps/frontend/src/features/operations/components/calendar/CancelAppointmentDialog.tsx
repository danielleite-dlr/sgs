import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import {
  CancelAppointmentMutation,
  type AppointmentData,
  type CancelAppointmentResult,
} from '../../api/appointments.api';
import { CANCEL_REASON_TAGS } from '../../lib/operations-labels';

const MIN_REASON = 3;
const MAX_REASON = 400;
const NO_SHOW_REASON = 'Cliente não compareceu';

interface Props {
  appointment: AppointmentData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}

export function CancelAppointmentDialog({ appointment, open, onOpenChange, onCancelled }: Props) {
  const [reason, setReason] = useState('');
  const [tag, setTag] = useState('');
  const [cancel, { loading }] = useMutation<CancelAppointmentResult>(CancelAppointmentMutation);
  const hasDeposit = appointment !== null && Number(appointment.depositAmount) > 0;
  const valid = reason.trim().length >= MIN_REASON;

  function close() {
    setReason('');
    setTag('');
    onOpenChange(false);
  }

  function pickTag(value: string) {
    setTag(value);
    if (value === 'no_show' && reason.trim() === '') setReason(NO_SHOW_REASON);
  }

  async function submit() {
    if (!appointment || !valid) return;
    try {
      const res = await cancel({
        variables: {
          input: { id: appointment.id, reason: reason.trim(), reasonTag: tag || null },
        },
      });
      const errors = res.data?.cancelAppointment.errors ?? [];
      if (errors.length > 0) {
        toast.error(errors[0].message);
        return;
      }
      toast.success('Agendamento cancelado.');
      close();
      onCancelled();
    } catch {
      toast.error('Não foi possível cancelar o agendamento. Tente novamente.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-[480px]">
        <DialogTitle className="text-base font-bold text-neutral-800">
          Cancelar agendamento
        </DialogTitle>
        <DialogDescription className="text-sm text-neutral-600">
          {appointment
            ? `${appointment.client.fullName} — ${appointment.service.name}`
            : 'Informe o motivo do cancelamento.'}
        </DialogDescription>
        <RadioGroup value={tag} onValueChange={pickTag} aria-label="Tipo do cancelamento">
          {CANCEL_REASON_TAGS.map((t) => (
            <div key={t.value} className="flex items-center gap-sm">
              <RadioGroupItem
                id={`cancel-tag-${t.value}`}
                value={t.value}
                data-testid={`cancel-reason-tag-${t.value}`}
              />
              <Label htmlFor={`cancel-tag-${t.value}`} className="text-sm text-neutral-800">
                {t.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div>
          <Label htmlFor="cancel-reason" className="text-xs font-semibold text-neutral-700">
            Motivo
          </Label>
          <Textarea
            id="cancel-reason"
            data-testid="cancel-reason"
            aria-required="true"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
            rows={3}
            className="mt-xs resize-none"
            placeholder="Explique por que o agendamento foi cancelado (mínimo 3 caracteres)"
          />
          <p className="mt-xs text-right text-xs text-neutral-600">
            {reason.length}/{MAX_REASON}
          </p>
        </div>
        {hasDeposit && appointment && (
          <p className="text-sm text-neutral-800 rounded-md bg-warning-50 border border-warning-200 p-sm">
            O sinal de R$ {formatCurrencyDisplay(appointment.depositAmount)} continua como crédito
            do cliente.
          </p>
        )}
        <div className="flex justify-end gap-xs">
          <Button variant="outline" size="sm" onClick={close}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            data-testid="cancel-submit"
            disabled={!valid || loading}
            onClick={() => void submit()}
          >
            {loading ? 'Cancelando…' : 'Cancelar agendamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
