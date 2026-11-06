import { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { NATIVE_SELECT_CLASS } from '@/lib/field-classes';
import {
  CreateTimeBlockMutation,
  type CreateTimeBlockResult,
} from '../../api/appointments.api';
import { brDateToIso, maskDateBR, maskTime } from '../../lib/input-masks';
import { MANUAL_TIME_BLOCK_KINDS } from '../../lib/operations-labels';
import type { ScheduleProfessional } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionals: ScheduleProfessional[];
  defaultDate: Date;
  defaultProfessionalId?: string;
  onCreated: () => void;
}

function dateToBr(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function parseTime(t: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
}

const SELECT_CLASS = `${NATIVE_SELECT_CLASS} mt-xs`;
const LABEL_CLASS = 'text-xs font-semibold text-neutral-700';

export function TimeBlockDialog({
  open,
  onOpenChange,
  professionals,
  defaultDate,
  defaultProfessionalId,
  onCreated,
}: Props) {
  const [kind, setKind] = useState<string>('folga');
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId ?? '');
  const [dateBr, setDateBr] = useState(() => dateToBr(defaultDate));
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [createBlock, { loading }] = useMutation<CreateTimeBlockResult>(CreateTimeBlockMutation);

  useEffect(() => {
    if (open) {
      setDateBr(dateToBr(defaultDate));
      setProfessionalId(defaultProfessionalId ?? '');
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isHoliday = kind === 'feriado';

  function pickKind(value: string) {
    setKind(value);
    setAllDay(value === 'folga' || value === 'feriado');
  }

  function close() {
    setNote('');
    setStart('');
    setEnd('');
    setError('');
    onOpenChange(false);
  }

  async function submit() {
    setError('');
    const iso = brDateToIso(dateBr);
    if (!iso) return setError('Data inválida.');
    if (!isHoliday && !professionalId) return setError('Escolha o profissional.');
    const [y, mo, d] = iso.split('-').map(Number);
    let startsAt: Date;
    let endsAt: Date;
    if (allDay) {
      startsAt = new Date(y, mo - 1, d, 0, 0);
      endsAt = new Date(y, mo - 1, d + 1, 0, 0);
    } else {
      const s = parseTime(start);
      const e = parseTime(end);
      if (s === null || e === null) return setError('Hora inválida.');
      if (e <= s) return setError('O fim deve ser depois do início.');
      startsAt = new Date(y, mo - 1, d, Math.floor(s / 60), s % 60);
      endsAt = new Date(y, mo - 1, d, Math.floor(e / 60), e % 60);
    }
    try {
      const res = await createBlock({
        variables: {
          input: {
            kind,
            professionalId: isHoliday ? null : professionalId,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            allDay,
            note: note.trim() || null,
          },
        },
      });
      const errors = res.data?.createTimeBlock.errors ?? [];
      if (errors.length > 0) return setError(errors[0].message);
      toast.success('Bloqueio criado.');
      close();
      onCreated();
    } catch {
      setError('Não foi possível criar o bloqueio. Tente novamente.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-[480px]">
        <DialogTitle className="text-base font-bold text-neutral-800">Bloquear horário</DialogTitle>
        <DialogDescription className="sr-only">
          Crie uma folga, intervalo, feriado ou indisponibilidade na agenda.
        </DialogDescription>
        <RadioGroup value={kind} onValueChange={pickKind} aria-label="Tipo de bloqueio">
          {MANUAL_TIME_BLOCK_KINDS.map((k) => (
            <div key={k.value} className="flex items-center gap-sm">
              <RadioGroupItem
                id={`block-kind-${k.value}`}
                value={k.value}
                data-testid={`block-kind-${k.value}`}
              />
              <Label
                htmlFor={`block-kind-${k.value}`}
                className="flex items-center gap-xs text-sm text-neutral-800"
              >
                <span
                  aria-hidden="true"
                  className={cn('inline-block h-3 w-3 rounded-sm border', k.className)}
                />
                {k.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        {isHoliday ? (
          <p className="text-xs text-neutral-600">
            O feriado vale para o salão inteiro, todos os profissionais.
          </p>
        ) : (
          <div>
            <Label className={LABEL_CLASS} htmlFor="block-professional">
              Profissional
            </Label>
            <select
              id="block-professional"
              data-testid="block-professional"
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Selecione…</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label className={LABEL_CLASS} htmlFor="block-date">
            Data
          </Label>
          <Input
            id="block-date"
            data-testid="block-date"
            value={dateBr}
            onChange={(e) => setDateBr(maskDateBR(e.target.value))}
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            maxLength={10}
            className="mt-xs"
          />
        </div>
        <div className="flex items-center gap-sm">
          <input
            id="block-all-day"
            data-testid="block-all-day"
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-4 w-4 accent-primary-500"
          />
          <Label htmlFor="block-all-day" className="text-sm text-neutral-800">
            Dia inteiro
          </Label>
        </div>
        {!allDay && (
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label className={LABEL_CLASS} htmlFor="block-start">
                Início
              </Label>
              <Input
                id="block-start"
                data-testid="block-start"
                value={start}
                onChange={(e) => setStart(maskTime(e.target.value))}
                placeholder="HH:mm"
                inputMode="numeric"
                maxLength={5}
                className="mt-xs"
              />
            </div>
            <div>
              <Label className={LABEL_CLASS} htmlFor="block-end">
                Fim
              </Label>
              <Input
                id="block-end"
                data-testid="block-end"
                value={end}
                onChange={(e) => setEnd(maskTime(e.target.value))}
                placeholder="HH:mm"
                inputMode="numeric"
                maxLength={5}
                className="mt-xs"
              />
            </div>
          </div>
        )}
        <div>
          <Label className={LABEL_CLASS} htmlFor="block-note">
            Observação <span className="font-normal text-neutral-600">(opcional)</span>
          </Label>
          <Textarea
            id="block-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            rows={2}
            className="mt-xs resize-none"
          />
        </div>
        {error && (
          <p role="alert" data-testid="block-error" className="text-sm text-error-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-xs">
          <Button variant="outline" size="sm" onClick={close}>
            Cancelar
          </Button>
          <Button size="sm" data-testid="block-submit" disabled={loading} onClick={() => void submit()}>
            {loading ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
