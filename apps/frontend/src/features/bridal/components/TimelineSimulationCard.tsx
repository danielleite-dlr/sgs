import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { BridalTimelinePreviewData, TimelineConflictData } from '../api/timeline.api';
import { SALON_TZ, toZoned } from '../lib/schedule-rows';
import { copyText } from '../lib/copy-text';
import { WARNING_LABEL } from '../lib/timeline-labels';

interface Props {
  sim: BridalTimelinePreviewData;
  index: number;
  /** Permissão do usuário para confirmar (bridal.write). */
  canConfirm: boolean;
  confirming: boolean;
  /** Já existe cronograma oficial: o botão passa a atualizar a agenda. */
  hasOfficial?: boolean;
  /** Conflitos devolvidos pelo servidor na última tentativa de confirmar esta simulação. */
  serverConflicts?: TimelineConflictData[];
  /** Mensagem de erro da última tentativa de confirmar esta simulação. */
  serverError?: string | null;
  onConfirm: () => void;
  onRemove: () => void;
}

export function TimelineSimulationCard({
  sim,
  index,
  canConfirm,
  confirming,
  hasOfficial = false,
  serverConflicts = [],
  serverError = null,
  onConfirm,
  onRemove,
}: Props) {
  const conflicts = [...sim.conflicts, ...serverConflicts];
  const disabled = !sim.canConfirm || !canConfirm || confirming;
  const reason = !canConfirm
    ? 'Você não tem permissão para confirmar o cronograma.'
    : !sim.canConfirm
      ? 'Resolva o que falta para confirmar.'
      : undefined;
  const hhmm = (iso: string) => toZoned(iso, SALON_TZ).time;

  return (
    <section
      className="rounded-md border border-neutral-200 bg-white p-md"
      data-testid={`timeline-sim-${index}`}
    >
      <header className="mb-sm flex flex-wrap items-center justify-between gap-sm">
        <h3 className="text-sm font-semibold text-neutral-900">
          Simulação {index + 1} — {sim.packageName}, saída {sim.departureTime}
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          Descartar
        </Button>
      </header>

      <ul className="mb-sm space-y-0.5 text-sm">
        {sim.rows.map((r, i) =>
          r.name === '' && r.time === '' ? (
            <li key={i} className="h-sm" aria-hidden="true" data-testid={`timeline-row-${i}`} />
          ) : (
            <li key={i} className="flex gap-sm tabular-nums" data-testid={`timeline-row-${i}`}>
              <span className="w-12 shrink-0 font-semibold">{r.time}</span>
              <span>
                {r.name}
                {r.label ? ` ${r.label}` : ''}
                {r.professionalName ? (
                  <span className="text-neutral-600"> — {r.professionalName}</span>
                ) : null}
              </span>
            </li>
          ),
        )}
      </ul>

      {sim.warnings.length > 0 && (
        <div className="mb-sm flex flex-wrap gap-xs" data-testid="timeline-warnings">
          {sim.warnings.map((w, i) => (
            <Badge key={`${w.code}-${i}`} variant="warning" title={w.message}>
              {WARNING_LABEL[w.code] ?? w.message}
            </Badge>
          ))}
        </div>
      )}

      {conflicts.length > 0 && (
        <ul className="mb-sm space-y-0.5 text-sm text-error-600" data-testid="timeline-conflicts">
          {conflicts.map((c, i) => (
            <li key={i}>
              {c.professionalName} ocupada das {hhmm(c.startsAt)} às {hhmm(c.endsAt)}: {c.blockedBy}
            </li>
          ))}
        </ul>
      )}

      {sim.missing.length > 0 && (
        <div className="mb-sm text-sm" data-testid="timeline-missing">
          <p className="font-semibold text-neutral-800">Falta para confirmar</p>
          <ul className="list-disc pl-lg text-neutral-700">
            {sim.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {serverError && (
        <p role="alert" className="mb-sm text-sm text-error-600" data-testid="timeline-error">
          {serverError}
        </p>
      )}

      <pre
        data-testid="timeline-text"
        className="mb-sm whitespace-pre-wrap rounded-md bg-neutral-50 p-sm text-sm tabular-nums"
      >
        {sim.text}
      </pre>

      <div className="flex flex-wrap gap-sm">
        <Button type="button" variant="outline" onClick={() => void copyText(sim.text)}>
          Copiar texto
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          title={reason}
          data-testid="timeline-confirm"
        >
          {hasOfficial ? 'Confirmar e atualizar a agenda' : 'Confirmar (ok do studio)'}
        </Button>
      </div>
      {reason && canConfirm && <p className="mt-xs text-xs text-neutral-600">{reason}</p>}
    </section>
  );
}
