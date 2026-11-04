import { Input } from '@/components/ui/input';
import { DEPOSIT_METHODS } from '../lib/bridal-labels';
import {
  addMinutes,
  findRowConflicts,
  type DepositDraft,
  type ScheduleRow,
} from '../lib/schedule-rows';

export interface ProfessionalOption {
  id: string;
  name: string;
}

function durationOf(r: ScheduleRow): number {
  if (r.durationMinutes) return r.durationMinutes;
  const [sh, sm] = r.start.split(':').map(Number);
  const [eh, em] = r.end.split(':').map(Number);
  const d = eh * 60 + em - (sh * 60 + sm);
  return Number.isFinite(d) && d > 0 ? d : 60;
}

interface Props {
  rows: ScheduleRow[];
  onChange: (rows: ScheduleRow[]) => void;
  professionalsByService: Record<string, ProfessionalOption[]>;
  readOnly?: boolean;
  /** Pessoas que pagam avulso: recebem o campo opcional de sinal (D-07). */
  depositMembers?: { id: string; name: string }[];
  deposits?: DepositDraft[];
  onDepositsChange?: (d: DepositDraft[]) => void;
}

export function BridalScheduleEditor({
  rows,
  onChange,
  professionalsByService,
  readOnly,
  depositMembers = [],
  deposits = [],
  onDepositsChange,
}: Props) {
  const conflicts = findRowConflicts(rows);

  function update(i: number, patch: Partial<ScheduleRow>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function depositOf(id: string): DepositDraft {
    return deposits.find((d) => d.groupMemberId === id) ?? { groupMemberId: id, amount: '', method: 'pix' };
  }
  function setDeposit(next: DepositDraft) {
    const others = deposits.filter((d) => d.groupMemberId !== next.groupMemberId);
    onDepositsChange?.([...others, next]);
  }

  return (
    <div className="space-y-sm" data-testid="schedule-editor">
      <div className="overflow-x-auto rounded-md border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-700">
            <tr>
              <th className="p-sm">Pessoa</th>
              <th className="p-sm">Serviço</th>
              <th className="p-sm">Profissional</th>
              <th className="p-sm">Início</th>
              <th className="p-sm">Fim</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const conflict = conflicts.get(i);
              let options = professionalsByService[r.serviceId] ?? [];
              if (r.professionalId && !options.some((o) => o.id === r.professionalId)) {
                options = [...options, { id: r.professionalId, name: r.professionalName ?? 'Profissional' }];
              }
              return (
                <tr
                  key={r.key}
                  data-testid={`schedule-row-${i}`}
                  className={
                    conflict
                      ? 'border-t border-error border-l-4 bg-error/5'
                      : 'border-t border-neutral-200'
                  }
                >
                  <td className="p-sm">{r.personLabel}</td>
                  <td className="p-sm">{r.serviceName}</td>
                  <td className="p-sm">
                    <label className="sr-only" htmlFor={`row-${i}-prof`}>
                      Profissional de {r.personLabel} — {r.serviceName}
                    </label>
                    <select
                      id={`row-${i}-prof`}
                      data-testid={`row-${i}-prof`}
                      disabled={readOnly}
                      className="rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white"
                      value={r.professionalId}
                      onChange={(e) => {
                        const opt = options.find((o) => o.id === e.target.value);
                        update(i, { professionalId: e.target.value, professionalName: opt?.name });
                      }}
                    >
                      <option value="">Selecione…</option>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-sm">
                    <label className="sr-only" htmlFor={`row-${i}-start`}>
                      Início de {r.personLabel} — {r.serviceName}
                    </label>
                    <Input
                      id={`row-${i}-start`}
                      data-testid={`row-${i}-start`}
                      type="time"
                      disabled={readOnly}
                      className="w-28"
                      value={r.start}
                      onChange={(e) => {
                        const start = e.target.value;
                        update(i, {
                          start,
                          end: start ? addMinutes(start, durationOf(r)) : '',
                          durationMinutes: durationOf(r),
                        });
                      }}
                    />
                  </td>
                  <td className="p-sm" data-testid={`row-${i}-end`}>
                    {r.end || '—'}
                    {conflict && (
                      <span className="block text-xs font-semibold text-error" role="alert">
                        Conflito com a linha {conflict.map((c) => c + 1).join(', ')}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && depositMembers.length > 0 && onDepositsChange && (
        <fieldset className="rounded-md border border-neutral-200 p-sm space-y-sm">
          <legend className="px-xs text-sm font-bold text-neutral-800">
            Sinal de quem paga avulso (opcional)
          </legend>
          {depositMembers.map((m) => {
            const d = depositOf(m.id);
            return (
              <div key={m.id} className="flex flex-wrap items-end gap-sm">
                <span className="w-48 text-sm">{m.name}</span>
                <div>
                  <label className="text-xs font-semibold text-neutral-700" htmlFor={`dep-${m.id}-amount`}>
                    Valor do sinal de {m.name}
                  </label>
                  <Input
                    id={`dep-${m.id}-amount`}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="mt-xs w-28"
                    value={d.amount}
                    onChange={(e) => setDeposit({ ...d, amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-700" htmlFor={`dep-${m.id}-method`}>
                    Forma
                  </label>
                  <select
                    id={`dep-${m.id}-method`}
                    className="mt-xs block rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white"
                    value={d.method}
                    onChange={(e) => setDeposit({ ...d, method: e.target.value })}
                  >
                    {DEPOSIT_METHODS.map((mm) => (
                      <option key={mm.value} value={mm.value}>
                        {mm.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}
