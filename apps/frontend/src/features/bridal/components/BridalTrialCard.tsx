import { useEffect, useMemo, useState } from 'react';
import { useApolloClient, useMutation } from '@apollo/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ProfessionalsForServiceQuery,
  type ProfessionalsForServiceResult,
} from '@/features/operations/api/appointments.api';
import {
  ScheduleBridalEventMutation,
  type BridalGroupData,
  type BridalGroupPayload,
} from '../api/bridal.api';
import { useBridalPermission } from '../bridal-permissions';
import { errorMessage, formatEventDate } from '../lib/bridal-labels';
import { trialEntriesFor, trialRowsFor } from '../lib/trial-rows';
import {
  findRowConflicts,
  isRowComplete,
  rowsToScheduleItems,
  toZoned,
  type ScheduleRow,
} from '../lib/schedule-rows';
import { BridalScheduleEditor, type ProfessionalOption } from './BridalScheduleEditor';

interface Props {
  group: BridalGroupData;
  /** Chamado depois de gravar o teste (refetch do grupo). */
  onScheduled: () => void;
}

/** Dia anterior a 'YYYY-MM-DD' (limite do campo de data do teste). */
function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

export function BridalTrialCard({ group, onScheduled }: Props) {
  const client = useApolloClient();
  const canWrite = useBridalPermission('bridal.write');
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [date, setDate] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [professionals, setProfessionals] = useState<Record<string, ProfessionalOption[]>>({});
  const [schedule, { loading }] = useMutation<{ scheduleBridalEvent: BridalGroupPayload }>(
    ScheduleBridalEventMutation,
  );

  const entries = trialEntriesFor(group);
  const pending = entries.filter((e) => !e.scheduled);
  const eventDay = group.eventDate.slice(0, 10);

  const serviceKey = Array.from(new Set(rows.map((r) => r.serviceId)))
    .sort()
    .join(',');
  const serviceIds = useMemo(() => (serviceKey ? serviceKey.split(',') : []), [serviceKey]);

  useEffect(() => {
    let cancelled = false;
    for (const id of serviceIds) {
      if (professionals[id]) continue;
      client
        .query<ProfessionalsForServiceResult>({
          query: ProfessionalsForServiceQuery,
          variables: { serviceId: id },
        })
        .then((res) => {
          if (cancelled) return;
          setProfessionals((prev) => ({
            ...prev,
            [id]: res.data.professionalsForService.map((p) => ({ id: p.id, name: p.displayName })),
          }));
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceKey, client]);

  if (entries.length === 0) return null;

  const dateBeforeEvent = date !== '' && date < eventDay;
  const dateTooLate = date !== '' && !dateBeforeEvent;
  const hasConflict = findRowConflicts(rows).size > 0;
  const allComplete = rows.length > 0 && rows.every(isRowComplete);
  const title = group.eventKind === 'debutante' ? 'Teste da debutante' : 'Teste da noiva';

  function start() {
    setRows(trialRowsFor(group));
    setDate('');
    setErrors([]);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setRows([]);
    setDate('');
    setErrors([]);
  }

  function changeDate(value: string) {
    setDate(value);
    setRows((prev) => prev.map((r) => ({ ...r, date: value })));
  }

  async function submit() {
    setErrors([]);
    try {
      const res = await schedule({
        variables: { input: { groupId: group.id, items: rowsToScheduleItems(rows) } },
      });
      const errs = res.data?.scheduleBridalEvent.errors ?? [];
      if (errs.length > 0) {
        setErrors(errs.map(errorMessage)); // mantém as linhas editadas
        return;
      }
      toast.success('Teste agendado');
      close();
      onScheduled();
    } catch {
      setErrors(['Não foi possível agendar o teste. Tente novamente.']);
    }
  }

  return (
    <section aria-label="Teste" className="space-y-sm" data-testid="trial-card">
      <h3 className="text-h3 font-semibold text-neutral-800">{title}</h3>
      <ul className="space-y-xs">
        {entries.map((e) => (
          <li
            key={`${e.memberId}-${e.serviceId}`}
            className="flex flex-wrap items-center gap-sm text-sm"
            data-testid={`trial-entry-${e.memberId}-${e.serviceId}`}
          >
            <span className="font-medium text-neutral-800">{e.personLabel}</span>
            <span className="text-neutral-700">{e.serviceName}</span>
            {e.scheduled ? (
              <>
                <Badge variant="success">Agendado</Badge>
                <span className="tabular-nums text-neutral-700">
                  {formatEventDate(toZoned(e.scheduled.startsAt).date)}{' '}
                  {toZoned(e.scheduled.startsAt).time}–{toZoned(e.scheduled.endsAt).time} ·{' '}
                  {e.scheduled.professionalName}
                </span>
              </>
            ) : (
              <Badge variant="warning">Pendente</Badge>
            )}
          </li>
        ))}
      </ul>

      {!open && pending.length > 0 && canWrite && group.status === 'active' && (
        <Button type="button" variant="outline" onClick={start} data-testid="trial-start">
          Agendar teste
        </Button>
      )}

      {open && (
        <div className="space-y-sm">
          <label className="flex flex-wrap items-center gap-sm text-sm text-neutral-700">
            Data do teste
            <input
              type="date"
              data-testid="trial-date"
              value={date}
              max={dayBefore(eventDay)}
              onChange={(ev) => changeDate(ev.target.value)}
              className="h-10 rounded-md border border-neutral-300 px-sm"
            />
          </label>
          {dateTooLate && (
            <p className="text-sm text-error" data-testid="trial-date-error">
              O teste deve ser antes do dia do evento.
            </p>
          )}

          <BridalScheduleEditor
            rows={rows}
            onChange={setRows}
            professionalsByService={professionals}
          />

          <div className="flex flex-wrap gap-sm">
            <Button
              type="button"
              onClick={submit}
              disabled={loading || !dateBeforeEvent || hasConflict || !allComplete}
              data-testid="trial-confirm"
            >
              Confirmar teste
            </Button>
            <Button type="button" variant="ghost" onClick={close}>
              Descartar
            </Button>
          </div>
          <div aria-live="polite" role="alert" className="text-sm text-error">
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
