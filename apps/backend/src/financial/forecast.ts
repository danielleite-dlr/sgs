import { allocateInstallments, type InstallmentInput } from '../contracts/domain/contract-math';
import { computeCommission, type RuleLite } from './commission-resolver';

/** D-13: "confirmado" para a previsão. Trocar aqui muda a previsão inteira. */
export const FORECAST_APPOINTMENT_STATUSES = ['scheduled', 'confirmed'] as const;
export const FORECAST_HORIZON_DAYS = 30;

export type ForecastKind =
  | 'appointment'
  | 'contract_installment'
  | 'contract_balance'
  | 'commission'
  | 'fixed_expense';

export interface ForecastItemCents {
  date: string; // YYYY-MM-DD local da org
  kind: ForecastKind;
  direction: 'in' | 'out';
  cents: number; // sempre >= 0
  label: string;
  refId: string | null;
  overdue: boolean; // D-09
  noRule: boolean; // comissão sem regra (R$ 0,00)
  withoutProfessional: boolean; // D-10
}

export interface ForecastBucketCents {
  start: string;
  end: string;
  inflowCents: number;
  outflowCents: number;
  balanceCents: number;
  overdueInflowCents: number;
}

const DAY_MS = 86_400_000;

function parseUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fmt(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Aritmética em UTC sobre "YYYY-MM-DD". */
export function addDaysIso(date: string, days: number): string {
  return fmt(parseUtc(date) + days * DAY_MS);
}

function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

const base = (): Pick<ForecastItemCents, 'noRule' | 'withoutProfessional'> => ({
  noRule: false,
  withoutProfessional: false,
});

export function expandFixedExpenses(
  expenses: { id: string; name: string; cents: number; dueDay: number; active: boolean }[],
  from: string,
  to: string,
): ForecastItemCents[] {
  const out: ForecastItemCents[] = [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    const last = lastDayOfMonth(y, m);
    for (const e of expenses) {
      if (!e.active) continue;
      const day = Math.min(e.dueDay, last);
      const date = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (date >= from && date < to) {
        out.push({
          date,
          kind: 'fixed_expense',
          direction: 'out',
          cents: e.cents,
          label: e.name,
          refId: e.id,
          overdue: false,
          ...base(),
        });
      }
    }
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function contractReceivables(
  c: {
    contractId: string;
    code: string;
    installments: InstallmentInput[];
    netPaidCents: number;
    depositCents: number;
    totalCents: number;
    balanceDueDate: string;
  },
  from: string,
  to: string,
): ForecastItemCents[] {
  const items: ForecastItemCents[] = [];
  const place = (dueDate: string) =>
    dueDate < from ? { date: from, overdue: true } : { date: dueDate, overdue: false };

  for (const i of allocateInstallments(c.installments, c.netPaidCents, from)) {
    if (i.pendingCents <= 0 || i.dueDate >= to) continue;
    items.push({
      ...place(i.dueDate),
      kind: 'contract_installment',
      direction: 'in',
      cents: i.pendingCents,
      label: `Contrato ${c.code} — parcela ${i.seq} do sinal`,
      refId: c.contractId,
      ...base(),
    });
  }

  const balanceCents = Math.max(0, c.totalCents - Math.max(c.netPaidCents, c.depositCents));
  if (balanceCents > 0 && c.balanceDueDate < to) {
    items.push({
      ...place(c.balanceDueDate),
      kind: 'contract_balance',
      direction: 'in',
      cents: balanceCents,
      label: `Contrato ${c.code} — restante`,
      refId: c.contractId,
      ...base(),
    });
  }
  return items;
}

/**
 * Comanda com itens vale o total dos itens (mesmo 0); sem itens (ou sem comanda)
 * usa a variante, senão o preço base. O sinal já está no caixa e é descontado.
 * Quem chama converte as strings da SQL com toCents ANTES ('0.00' é truthy).
 */
export function appointmentInflowCents(a: {
  comandaItemCount: number;
  comandaItemsCents: number;
  variantCents: number | null;
  baseCents: number;
  depositCents: number;
}): number {
  const price = a.comandaItemCount > 0 ? a.comandaItemsCents : (a.variantCents ?? a.baseCents);
  return Math.max(0, price - a.depositCents);
}

/**
 * D-10 (atendimento sem profissional definido): (1) regra default da org, se existir;
 * (2) senão, a MAIOR comissão entre as regras aplicáveis ao serviço (member_service de
 * qualquer profissional, service, category da cadeia); (3) nenhuma -> R$ 0,00 e noRule.
 */
export function fallbackCommission(
  rules: RuleLite[],
  item: { serviceId: string; categoryChain: string[] },
  amounts: { listUnitCents: number; quantity: number; chargedCents: number },
): { amountCents: number; noRule: boolean; ruleId: string | null } {
  const live = rules.filter((r) => !r.deletedAt);
  const def = live.find((r) => r.scopeType === 'default');
  if (def) {
    return {
      amountCents: computeCommission({ rule: def }, amounts).amountCents,
      noRule: false,
      ruleId: def.id,
    };
  }
  const candidates = [
    ...live.filter((r) => r.scopeType === 'member_service' && r.serviceId === item.serviceId),
    ...live.filter((r) => r.scopeType === 'service' && r.serviceId === item.serviceId),
    ...live.filter(
      (r) => r.scopeType === 'category' && !!r.categoryId && item.categoryChain.includes(r.categoryId),
    ),
  ];
  let best: { amountCents: number; ruleId: string } | null = null;
  for (const rule of candidates) {
    const amountCents = computeCommission({ rule }, amounts).amountCents;
    if (!best || amountCents > best.amountCents) best = { amountCents, ruleId: rule.id };
  }
  return best ? { ...best, noRule: false } : { amountCents: 0, noRule: true, ruleId: null };
}

export function buildWeeklyBuckets(
  items: ForecastItemCents[],
  from: string,
  to: string,
): ForecastBucketCents[] {
  const buckets: ForecastBucketCents[] = [];
  for (let start = from; start < to; start = addDaysIso(start, 7)) {
    const next = addDaysIso(start, 7);
    const end = next < to ? next : to;
    const inBucket = items.filter((i) => i.date >= start && i.date < end);
    const inflowCents = inBucket.filter((i) => i.direction === 'in').reduce((s, i) => s + i.cents, 0);
    const outflowCents = inBucket.filter((i) => i.direction === 'out').reduce((s, i) => s + i.cents, 0);
    const overdueInflowCents = inBucket
      .filter((i) => i.direction === 'in' && i.overdue)
      .reduce((s, i) => s + i.cents, 0);
    buckets.push({
      start,
      end,
      inflowCents,
      outflowCents,
      balanceCents: inflowCents - outflowCents,
      overdueInflowCents,
    });
  }
  return buckets;
}

export function summarizeForecast(items: ForecastItemCents[]): {
  inflowCents: number;
  outflowCents: number;
  balanceCents: number;
  overdueInflowCents: number;
} {
  let inflowCents = 0;
  let outflowCents = 0;
  let overdueInflowCents = 0;
  for (const i of items) {
    if (i.direction === 'in') {
      inflowCents += i.cents;
      if (i.overdue) overdueInflowCents += i.cents;
    } else {
      outflowCents += i.cents;
    }
  }
  return { inflowCents, outflowCents, balanceCents: inflowCents - outflowCents, overdueInflowCents };
}
