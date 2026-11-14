export type TimelineKind = 'make' | 'hair';

export interface TimelineRuleStep {
  name: string;
  offsetMinutes: number;
  isExtra: boolean;
  kind: TimelineKind | null;
  startsRegistry: boolean;
  displayOrder: number;
  durationMinutes: number | null;
  serviceId?: string | null;
}

export interface TimelineInput {
  packageName: string;
  brideLabel: string;
  eventDateDdMm: string;
  departureMinutes: number;
  steps: TimelineRuleStep[];
  makeProfessionalName?: string | null;
  hairProfessionalName?: string | null;
}

export interface TimelineRow {
  minutes: number;
  time: string;
  name: string;
  label: string;
  kind: TimelineKind | null;
  professionalName: string | null;
  isExtra: boolean;
  isRegistry: boolean;
  durationMinutes: number | null;
  serviceId: string | null;
}

export type TimelineWarningCode =
  | 'ARRIVAL_BEFORE_06'
  | 'PROFESSIONAL_UNDEFINED'
  | 'NO_REGISTRY_STEP'
  | 'SERVICE_UNDEFINED';
export interface TimelineWarning {
  code: TimelineWarningCode;
  message: string;
}

export interface TimelineResult {
  rows: TimelineRow[];
  text: string;
  registryStartMinutes: number | null;
  registryName: string | null;
  warnings: TimelineWarning[];
}

export type TimelineDomainErrorCode =
  | 'TIMELINE_RULES_MISSING'
  | 'BEFORE_MIDNIGHT'
  | 'INVALID_DEPARTURE';
export class TimelineDomainError extends Error {
  constructor(
    public readonly code: TimelineDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const ARRIVAL_LIMIT_MINUTES = 6 * 60;
const UNDEFINED_PROFESSIONAL = '[a definir]';

export function formatHour(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  const hh = String(h).padStart(2, '0');
  return mm === 0 ? `${hh}h` : `${hh}:${String(mm).padStart(2, '0')}`;
}

export function parseDepartureTime(hhmm: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) {
    throw new TimelineDomainError('INVALID_DEPARTURE', 'Informe a saída no formato HH:MM.');
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatDdMm(isoDate: string): string {
  const [, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}`;
}

export function defaultBrideLabel(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  return first.toLocaleUpperCase('pt-BR');
}

function byOffset(a: TimelineRuleStep, b: TimelineRuleStep): number {
  return b.offsetMinutes - a.offsetMinutes || a.displayOrder - b.displayOrder;
}

function kindLabel(kind: TimelineKind): string {
  return kind === 'hair' ? 'penteado' : 'make';
}

export function computeTimeline(input: TimelineInput): TimelineResult {
  const regular = input.steps.filter((s) => !s.isExtra).sort(byOffset);
  const extras = input.steps.filter((s) => s.isExtra).sort(byOffset);
  if (regular.length === 0) {
    throw new TimelineDomainError(
      'TIMELINE_RULES_MISSING',
      'Este pacote não tem cronograma configurado. Escolha outro pacote ou configure as etapas no catálogo.',
    );
  }
  if ([...regular, ...extras].some((s) => input.departureMinutes - s.offsetMinutes < 0)) {
    throw new TimelineDomainError(
      'BEFORE_MIDNIGHT',
      'O cronograma começaria no dia anterior. Confira a saída.',
    );
  }

  const warnings: TimelineWarning[] = [];
  const professional = (kind: TimelineKind | null): string | null => {
    if (!kind) return null;
    const raw = kind === 'make' ? input.makeProfessionalName : input.hairProfessionalName;
    return raw?.trim() || null;
  };

  const toRow = (s: TimelineRuleStep): TimelineRow => {
    const minutes = input.departureMinutes - s.offsetMinutes;
    const prof = s.isExtra ? null : professional(s.kind);
    const kind = s.isExtra ? null : s.kind;
    return {
      minutes,
      time: formatHour(minutes),
      name: s.name,
      label: kind ? `${s.name} - profissional ${prof ?? UNDEFINED_PROFESSIONAL}` : s.name,
      kind,
      professionalName: prof,
      isExtra: s.isExtra,
      isRegistry: !s.isExtra && s.startsRegistry,
      durationMinutes: s.durationMinutes,
      serviceId: s.serviceId ?? null,
    };
  };

  const rows = [...regular.map(toRow), ...extras.map(toRow)];
  const mainRows = rows.filter((r) => !r.isExtra);
  const extraRows = rows.filter((r) => r.isExtra);

  const first = mainRows[0];
  if (first.minutes < ARRIVAL_LIMIT_MINUTES) {
    warnings.push({
      code: 'ARRIVAL_BEFORE_06',
      message: `A chegada calculada (${String(Math.floor(first.minutes / 60)).padStart(2, '0')}:${String(first.minutes % 60).padStart(2, '0')}) é antes das 06h. Confira a saída e o pacote antes de enviar.`,
    });
  }
  for (const row of mainRows) {
    if (!row.kind) continue;
    if (!row.professionalName) {
      warnings.push({
        code: 'PROFESSIONAL_UNDEFINED',
        message: `Falta definir a profissional de ${kindLabel(row.kind)}.`,
      });
    }
    if (!row.serviceId) {
      warnings.push({
        code: 'SERVICE_UNDEFINED',
        message: `A etapa de ${kindLabel(row.kind)} não está ligada a um serviço do pacote.`,
      });
    }
  }
  const registry = mainRows.find((r) => r.isRegistry) ?? null;
  if (!registry) {
    warnings.push({
      code: 'NO_REGISTRY_STEP',
      message: 'O pacote não tem etapa marcada como início do registro (fotos/making of).',
    });
  }

  const title = `CRONOGRAMA NOIVA ${input.brideLabel.trim().toLocaleUpperCase('pt-BR')} - ${input.eventDateDdMm} - Pacote ${input.packageName}`;
  let text = `${title}\n\n${mainRows.map((r) => `${r.time} ${r.label}`).join('\n')}`;
  if (extraRows.length > 0) {
    text += `\n\n${extraRows.map((r) => `${r.name}: ${r.time}`).join('\n')}`;
  }

  return {
    rows,
    text,
    registryStartMinutes: registry?.minutes ?? null,
    registryName: registry?.name ?? null,
    warnings,
  };
}

export function brideWindows(result: TimelineResult): {
  kind: TimelineKind;
  serviceId: string | null;
  startMinutes: number;
  endMinutes: number;
}[] {
  return result.rows
    .filter((r): r is TimelineRow & { kind: TimelineKind } => r.kind !== null)
    .map((r) => ({
      kind: r.kind,
      serviceId: r.serviceId,
      startMinutes: r.minutes,
      endMinutes: r.minutes + (r.durationMinutes ?? 0),
    }))
    .sort((a, b) => a.startMinutes - b.startMinutes);
}
