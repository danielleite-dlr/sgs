import { toCents } from '../../common/money';

export type DepositKind = 'fixed' | 'percent';

/** Entrada em centavos: percentual (half-up) ou fixa limitada ao total. */
export function computeDepositCents(
  kind: DepositKind | null,
  value: string | null,
  totalCents: number,
): number {
  if (kind === null || value === null) return 0;
  if (kind === 'percent') return Math.round((totalCents * Number(value)) / 100);
  return Math.min(toCents(value), totalCents);
}

export function computeContractTotals(input: {
  itemsCents: number[];
  discountCents: number;
  depositCents: number;
}): { itemsTotalCents: number; totalCents: number; depositCents: number } {
  const { itemsCents, discountCents, depositCents } = input;
  if (itemsCents.some((c) => c < 0) || discountCents < 0 || depositCents < 0) {
    throw new RangeError('NEGATIVE');
  }
  const itemsTotalCents = itemsCents.reduce((a, b) => a + b, 0);
  if (discountCents > itemsTotalCents) throw new RangeError('DISCOUNT_GT_ITEMS');
  const totalCents = itemsTotalCents - discountCents;
  if (depositCents > totalCents) throw new RangeError('DEPOSIT_GT_TOTAL');
  return { itemsTotalCents, totalCents, depositCents };
}

const DAY_MS = 86_400_000;

function parseUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Dias de `from` até `to` (to - from), em calendário puro. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseUtc(to) - parseUtc(from)) / DAY_MS);
}

/** Data do evento menos N dias (calendário UTC, sem fuso). */
export function balanceDueDate(eventDate: string, daysBefore: number): string {
  return new Date(parseUtc(eventDate) - daysBefore * DAY_MS).toISOString().slice(0, 10);
}

export interface ContractStatusInput {
  status: string;
  totalCents: number;
  depositCents: number;
  /** Pagamentos assinados (estornos negativos). */
  paymentsCents: number[];
  balanceDueDate: string;
  today: string;
  depositReferenceDate: string;
  depositUnpaidDays: number;
}

export interface ContractStatusResult {
  paidCents: number;
  balanceCents: number;
  depositPaidCents: number;
  depositPendingCents: number;
  settled: boolean;
  daysToBalanceDue: number;
  balanceDueSoon: boolean;
  balanceOverdue: boolean;
  depositOverdue: boolean;
}

export function computeContractStatus(input: ContractStatusInput): ContractStatusResult {
  const paidCents = Math.max(0, input.paymentsCents.reduce((a, b) => a + b, 0));
  const depositPaidCents = Math.min(paidCents, input.depositCents);
  const depositPendingCents = input.depositCents - depositPaidCents;
  const balanceCents = Math.max(0, input.totalCents - paidCents);
  const settled = balanceCents === 0;
  const daysToBalanceDue = daysBetween(input.today, input.balanceDueDate);
  const alerts = input.status !== 'cancelled' && input.status !== 'draft';
  return {
    paidCents,
    balanceCents,
    depositPaidCents,
    depositPendingCents,
    settled,
    daysToBalanceDue,
    balanceDueSoon: alerts && !settled && daysToBalanceDue >= 0 && daysToBalanceDue <= 3,
    balanceOverdue: alerts && !settled && daysToBalanceDue < 0,
    depositOverdue:
      alerts &&
      depositPendingCents > 0 &&
      daysBetween(input.depositReferenceDate, input.today) >= input.depositUnpaidDays,
  };
}
