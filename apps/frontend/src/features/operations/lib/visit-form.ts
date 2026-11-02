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

export function buildCreateVisitInput(v: VisitFormValues): BuildResult {
  if (!v.clientId) return { ok: false, error: 'Escolha o cliente.' };
  if (v.lines.length === 0) return { ok: false, error: 'Inclua ao menos um serviço.' };
  const iso = brDateToIso(v.date);
  if (!iso) return { ok: false, error: 'Data inválida.' };
  const [y, mo, d] = iso.split('-').map(Number);

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
    const start = new Date(y, mo - 1, d, t.h, t.m, 0, 0);
    const end = new Date(start.getTime() + line.durationMinutes * 60_000);
    items.push({
      serviceId: line.serviceId,
      serviceVariantId: line.variantId,
      professionalId: line.professionalId,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
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
    lines.push({
      serviceId: s.serviceId,
      variantId: null,
      professionalId,
      time: cursor,
      durationMinutes: s.defaultDurationMinutes,
    });
    cursor = addMinutes(cursor, s.defaultDurationMinutes);
  }
  return lines;
}

/** Fase 2 D-07: sugere a variante pela senioridade do profissional. */
export function suggestVariant(
  variants: { id: string; seniorityTier: string | null }[],
  tier: string | null,
): string | null {
  if (!tier) return null;
  return variants.find((v) => v.seniorityTier === tier)?.id ?? null;
}
