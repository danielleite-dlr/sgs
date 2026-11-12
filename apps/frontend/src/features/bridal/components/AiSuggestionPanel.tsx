import { useEffect, useMemo, useState } from 'react';
import { useApolloClient, useMutation } from '@apollo/client';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ProfessionalsForServiceQuery,
  type ProfessionalsForServiceResult,
} from '@/features/operations/api/appointments.api';
import {
  ConfirmBridalScheduleMutation,
  SuggestBridalScheduleMutation,
  type AiScheduleSuggestion,
  type ConfirmBridalScheduleResult,
  type SuggestBridalScheduleResult,
} from '../api/ai-schedule.api';
import {
  ScheduleBridalEventMutation,
  type BridalGroupData,
  type BridalGroupPayload,
  type BridalUserError,
} from '../api/bridal.api';
import { useBridalPermission } from '../bridal-permissions';
import { FALLBACK_REASON_LABEL, errorMessage, formatEventDate } from '../lib/bridal-labels';
import {
  depositsToInput,
  findRowConflicts,
  isRowComplete,
  rowsToScheduleItems,
  suggestionToRows,
  toZoned,
  type DepositDraft,
  type ScheduleRow,
} from '../lib/schedule-rows';
import { BridalScheduleEditor, type ProfessionalOption } from './BridalScheduleEditor';

interface Props {
  group: BridalGroupData;
  /** Chamado depois de gravar a agenda (refetch do grupo). */
  onScheduled: () => void;
}

type Mode = 'idle' | 'ai' | 'manual';

export function AiSuggestionPanel({ group, onScheduled }: Props) {
  const client = useApolloClient();
  const canSuggest = useBridalPermission('bridal.aiSuggest');
  const canWrite = useBridalPermission('bridal.write');
  const [mode, setMode] = useState<Mode>('idle');
  const [suggestion, setSuggestion] = useState<AiScheduleSuggestion | null>(null);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [deposits, setDeposits] = useState<DepositDraft[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [professionals, setProfessionals] = useState<Record<string, ProfessionalOption[]>>({});

  const [suggest, { loading: suggesting }] =
    useMutation<SuggestBridalScheduleResult>(SuggestBridalScheduleMutation);
  const [confirm, { loading: confirming }] =
    useMutation<ConfirmBridalScheduleResult>(ConfirmBridalScheduleMutation);
  const [scheduleManual, { loading: scheduling }] = useMutation<{
    scheduleBridalEvent: BridalGroupPayload;
  }>(ScheduleBridalEventMutation);

  const appointments = (group.appointments ?? []).filter((a) => a.status !== 'cancelled');
  const hasSchedule = appointments.length > 0;

  const serviceIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.serviceId))).sort(),
    [rows],
  );
  const serviceKey = serviceIds.join(',');

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

  const hasConflict = findRowConflicts(rows).size > 0;
  const allComplete = rows.length > 0 && rows.every(isRowComplete);
  const busy = confirming || scheduling;

  const depositMembers = group.members
    .filter((m) => !m.coveredByContract)
    .map((m) => ({ id: m.id, name: m.clientName }));

  async function runSuggest() {
    setErrors([]);
    try {
      const res = await suggest({ variables: { groupId: group.id } });
      const payload = res.data?.suggestBridalSchedule;
      if (!payload || payload.errors.length > 0 || !payload.suggestion) {
        setErrors((payload?.errors ?? []).map(errorMessage));
        if (!payload?.errors.length) setErrors(['Não foi possível montar a sugestão.']);
        return;
      }
      setSuggestion(payload.suggestion);
      setRows(suggestionToRows(payload.suggestion));
      setMode('ai');
    } catch {
      setErrors(['Não foi possível montar a sugestão. Tente novamente.']);
    }
  }

  function startManual() {
    const date = group.eventDate.slice(0, 10);
    const manual: ScheduleRow[] = [];
    for (const m of group.members) {
      // Só os serviços do dia do evento, como a sugestão IA: o teste (purpose 'trial') tem
      // data própria e, incluído aqui, duplicava make e penteado da noiva.
      for (const s of m.services.filter((x) => x.purpose === 'event')) {
        manual.push({
          key: `${m.id}-${s.serviceId}-${manual.length}`,
          groupMemberId: m.id,
          personLabel: m.clientName,
          role: m.role,
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          professionalId: '',
          durationMinutes: s.durationMinutes,
          date,
          start: '',
          end: '',
        });
      }
    }
    setSuggestion(null);
    setRows(manual);
    setErrors(manual.length === 0 ? [errorMessage({ code: 'NO_PLANNED_SERVICES', message: '' })] : []);
    setMode('manual');
  }

  async function submit() {
    setErrors([]);
    const items = rowsToScheduleItems(rows);
    const deps = depositsToInput(deposits);
    try {
      let errs: BridalUserError[];
      if (mode === 'ai') {
        const res = await confirm({
          variables: { input: { groupId: group.id, items, deposits: deps } },
        });
        errs = res.data?.confirmBridalSchedule.errors ?? [];
      } else {
        const res = await scheduleManual({
          variables: { input: { groupId: group.id, items, deposits: deps } },
        });
        errs = res.data?.scheduleBridalEvent.errors ?? [];
      }
      if (errs.length > 0) {
        setErrors(errs.map(errorMessage)); // mantém as linhas editadas
        return;
      }
      toast.success('Agenda do evento criada');
      setMode('idle');
      setRows([]);
      onScheduled();
    } catch {
      setErrors(['Não foi possível gravar a agenda. Tente novamente.']);
    }
  }

  if (hasSchedule) {
    return (
      <section aria-label="Agenda do evento" className="space-y-sm">
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-700">
              <tr>
                <th className="p-sm">Pessoa</th>
                <th className="p-sm">Serviço</th>
                <th className="p-sm">Profissional</th>
                <th className="p-sm">Horário</th>
                <th className="p-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id} className="border-t border-neutral-200" data-testid={`appt-${a.id}`}>
                  <td className="p-sm">{a.clientName}</td>
                  <td className="p-sm">{a.serviceName}</td>
                  <td className="p-sm">{a.professionalName}</td>
                  <td className="p-sm">
                    {formatEventDate(toZoned(a.startsAt).date)} {toZoned(a.startsAt).time}–
                    {toZoned(a.endsAt).time}
                  </td>
                  <td className="p-sm">
                    {a.status}
                    {a.covered && (
                      <Badge variant="outline" className="ml-xs">
                        Coberto pelo contrato
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Agenda do evento" className="space-y-sm" aria-busy={suggesting}>
      <p className="text-sm text-neutral-700">Nada é gravado na agenda até você confirmar.</p>

      {mode === 'idle' && group.status === 'active' && (
        <div className="flex flex-wrap gap-sm">
          {canSuggest && (
            <Button type="button" onClick={runSuggest} disabled={suggesting} data-testid="ai-suggest">
              <Sparkles className="mr-xs h-4 w-4" aria-hidden="true" />
              Sugerir agenda IA
            </Button>
          )}
          {canWrite && (
            <Button type="button" variant="outline" onClick={startManual} data-testid="ai-manual">
              Montar manualmente
            </Button>
          )}
        </div>
      )}
      {suggesting && (
        <p role="status" className="text-sm text-neutral-700">
          Montando sugestão…
        </p>
      )}

      {mode !== 'idle' && (
        <div className="space-y-sm">
          {mode === 'ai' && suggestion && (
            <div className="flex flex-wrap items-center gap-sm" data-testid="ai-origin">
              {suggestion.source === 'claude' ? (
                <Badge variant="success">
                  Sugestão da IA{suggestion.model ? ` (${suggestion.model})` : ''}
                </Badge>
              ) : (
                <>
                  <Badge variant="warning">Sugestão simples</Badge>
                  {suggestion.fallbackReason && (
                    <span className="text-sm text-neutral-700">
                      {FALLBACK_REASON_LABEL[suggestion.fallbackReason] ?? suggestion.fallbackReason}
                    </span>
                  )}
                </>
              )}
              {suggestion.cached && <span className="text-xs text-neutral-600">(do cache)</span>}
            </div>
          )}
          {mode === 'ai' && suggestion && suggestion.unscheduled.length > 0 && (
            <p role="status" className="text-sm text-warning" data-testid="ai-unscheduled">
              Sem horário livre para:{' '}
              {suggestion.unscheduled.map((u) => `${u.personLabel} — ${u.serviceName}`).join('; ')}
            </p>
          )}
          {mode === 'ai' &&
            suggestion?.warnings.map((w) => (
              <p key={w} className="text-sm text-neutral-700">
                {w}
              </p>
            ))}

          <BridalScheduleEditor
            rows={rows}
            onChange={setRows}
            professionalsByService={professionals}
            depositMembers={depositMembers}
            deposits={deposits}
            onDepositsChange={setDeposits}
          />

          <div className="flex flex-wrap gap-sm">
            <Button
              type="button"
              onClick={submit}
              disabled={busy || hasConflict || !allComplete}
              data-testid="ai-confirm"
            >
              Confirmar agenda
            </Button>
            {mode === 'ai' && canSuggest && (
              <Button
                type="button"
                variant="outline"
                onClick={runSuggest}
                disabled={suggesting}
                data-testid="ai-regenerate"
              >
                Gerar de novo
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMode('idle');
                setRows([]);
                setErrors([]);
              }}
            >
              Descartar
            </Button>
          </div>
        </div>
      )}

      <div aria-live="polite" role="alert" className="text-sm text-error" data-testid="ai-errors">
        {errors.map((e) => (
          <p key={e}>{e}</p>
        ))}
      </div>
    </section>
  );
}
