import { unmaskCurrency } from '@/features/catalog/utils/currency-mask';
import type { CreateVisitInputVars } from '../api/appointments.api';
import { brDateToIso } from './input-masks';

export interface VisitLine {
  serviceId: string;
  variantId: string | null;
  professionalId: string;
  time: string;
  durationMinutes: number;
}

export interface VisitFormValues {
  clientId: string;
  date: string; // dd/mm/aaaa
  lines: VisitLine[];
  packageId: string | null;
  depositAmount: string; // máscara BR
  depositMethod: string;
  notes?: string;
}

export type BuildResult =
  | { ok: true; input: CreateVisitInputVars }
  | { ok: false; error: string };

function parseTime(time: string): { h: number; m: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

/** Data BR + hora + duração → intervalo ISO (mesma conta do envio); null se inválido. */
export function lineInterval(
  dateBr: string,
  time: string,
  durationMinutes: number,
): { startsAt: string; endsAt: string } | null {
  const iso = brDateToIso(dateBr);
  if (!iso) return null;
  const t = parseTime(time);
  if (!t) return null;
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return null;
  const [y, mo, d] = iso.split('-').map(Number);
  const start = new Date(y, mo - 1, d, t.h, t.m, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

export function buildCreateVisitInput(v: VisitFormValues): BuildResult {
  if (!v.clientId) return { ok: false, error: 'Escolha o cliente.' };
  if (v.lines.length === 0) return { ok: false, error: 'Inclua ao menos um serviço.' };
  if (!brDateToIso(v.date)) return { ok: false, error: 'Data inválida.' };

  const items: CreateVisitInputVars['items'] = [];
  for (const line of v.lines) {
    if (!line.serviceId) return { ok: false, error: 'Escolha o serviço de cada linha.' };
    if (!line.professionalId) {
      return { ok: false, error: 'Escolha o profissional de cada serviço.' };
    }
    const t = parseTime(line.time);
    if (!t) return { ok: false, error: 'Hora inválida.' };
    if (!Number.isInteger(line.durationMinutes) || line.durationMinutes <= 0) {
      return { ok: false, error: 'Informe uma duração válida.' };
    }
    const interval = lineInterval(v.date, line.time, line.durationMinutes);
    if (!interval) return { ok: false, error: 'Hora inválida.' };
    items.push({
      serviceId: line.serviceId,
      serviceVariantId: line.variantId,
      professionalId: line.professionalId,
      startsAt: interval.startsAt,
      endsAt: interval.endsAt,
    });
  }

  const amount = v.depositAmount ? unmaskCurrency(v.depositAmount) : '';
  const hasDeposit = amount !== '' && Number(amount) > 0;
  const notes = v.notes?.trim();
  return {
    ok: true,
    input: {
      clientId: v.clientId,
      items,
      packageId: v.packageId,
      deposit: hasDeposit ? { amount, method: v.depositMethod } : null,
      ...(notes ? { notes } : {}),
    },
  };
}

function addMinutes(time: string, minutes: number): string {
  const t = parseTime(time) ?? { h: 0, m: 0 };
  const total = t.h * 60 + t.m + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Pacote na linha (fase 12): D-02 expande no lugar da linha, D-04 remove só as linhas
// do pacote, D-06 sequência a partir da hora da linha, D-11 sequência do prefill.
export const PACKAGE_FALLBACK_TIME = '09:00';
/** Duração usada sem duração padrão válida: evita dois serviços no mesmo horário (D-12). */
export const PACKAGE_FALLBACK_MINUTES = 60;

function safeMinutes(m: number): number {
  return Number.isInteger(m) && m > 0 ? m : PACKAGE_FALLBACK_MINUTES;
}

/** 1 linha por serviço distinto do pacote, em sequência a partir de startTime. */
export function expandPackageLines(
  pkg: { services: { serviceId: string; quantity: number; defaultDurationMinutes: number }[] },
  startTime: string,
  professionalId = '',
): VisitLine[] {
  const seen = new Set<string>();
  const lines: VisitLine[] = [];
  let cursor = startTime;
  for (const s of pkg.services) {
    if (seen.has(s.serviceId)) continue;
    seen.add(s.serviceId);
    const minutes = safeMinutes(s.defaultDurationMinutes);
    lines.push({
      serviceId: s.serviceId,
      variantId: null,
      professionalId,
      time: cursor,
      durationMinutes: minutes,
    });
    cursor = addMinutes(cursor, minutes);
  }
  return lines;
}

/**
 * Hora de início do pacote escolhido na linha `index`: a da própria linha; sem ela, o fim da
 * linha preenchida mais próxima acima; sem nenhuma, o fallback (09:00).
 */
export function packageStartTime(
  rows: { time: string; durationMinutes: number }[],
  index: number,
  fallback = PACKAGE_FALLBACK_TIME,
): string {
  const own = rows[index];
  if (own && parseTime(own.time)) return own.time;
  for (let i = index - 1; i >= 0; i--) {
    const row = rows[i];
    if (parseTime(row.time)) return addMinutes(row.time, safeMinutes(row.durationMinutes));
  }
  return fallback;
}

/** Troca só a linha `index` pelas linhas do pacote; as de cima e de baixo ficam iguais (D-02). */
export function expandPackageAt<L>(lines: L[], index: number, expanded: L[]): L[] {
  return [...lines.slice(0, index), ...expanded, ...lines.slice(index + 1)];
}

/** Tira só as linhas do pacote; se nada sobrar, devolve uma linha vazia (D-04, D-10). */
export function removePackageLines<L extends { fromPackage: boolean }>(
  lines: L[],
  makeEmpty: () => L,
): L[] {
  const rest = lines.filter((l) => !l.fromPackage);
  return rest.length > 0 ? rest : [makeEmpty()];
}

/** Horas em sequência a partir da inicial (prefill, D-11); usado uma vez, sem cascata (D-07). */
export function sequenceTimes(startTime: string, durations: number[]): string[] {
  if (!parseTime(startTime)) return durations.map(() => '');
  const out: string[] = [];
  let cursor = startTime;
  for (const d of durations) {
    out.push(cursor);
    cursor = addMinutes(cursor, safeMinutes(d));
  }
  return out;
}

/** Fase 2 D-07: sugere a variante pela senioridade do profissional. */
export function suggestVariant(
  variants: { id: string; seniorityTier: string | null }[],
  tier: string | null,
): string | null {
  if (!tier) return null;
  return variants.find((v) => v.seniorityTier === tier)?.id ?? null;
}
