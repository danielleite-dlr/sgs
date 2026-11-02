/**
 * Regra ÚNICA de pago/falta/troco da comanda (D-07). O frontend espelha esta
 * regra em `features/operations/lib/money.ts computePaymentSummary`.
 */

/** Sem voucher (D-09): só os 5 métodos manuais + crédito do cliente. */
export const CASH_METHODS = [
  'cash',
  'pix',
  'credit_card',
  'debit_card',
  'transfer',
] as const;

export const CLIENT_CREDIT_METHOD = 'client_credit';

export const PAYMENT_METHODS = [...CASH_METHODS, CLIENT_CREDIT_METHOD] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentCents = { method: string; cents: number };

export interface ComandaTotals {
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  changeCents: number;
  cashCents: number;
  creditCents: number;
  nonCreditCents: number;
  canClose: boolean;
  error: 'INSUFFICIENT_PAYMENT' | 'INVALID_CHANGE' | null;
}

export function computeComandaTotals(
  totalCents: number,
  payments: PaymentCents[],
): ComandaTotals {
  const sum = (pred: (p: PaymentCents) => boolean) =>
    payments.filter(pred).reduce((acc, p) => acc + p.cents, 0);
  const paidCents = sum(() => true);
  const cashCents = sum((p) => p.method === 'cash');
  const creditCents = sum((p) => p.method === CLIENT_CREDIT_METHOD);
  const remainingCents = Math.max(0, totalCents - paidCents);
  const changeCents = Math.max(0, paidCents - totalCents);
  // Troco só sai do dinheiro físico: o excedente tem de caber no que entrou em espécie.
  const error =
    paidCents < totalCents
      ? 'INSUFFICIENT_PAYMENT'
      : changeCents > cashCents
        ? 'INVALID_CHANGE'
        : null;
  return {
    totalCents,
    paidCents,
    remainingCents,
    changeCents,
    cashCents,
    creditCents,
    nonCreditCents: paidCents - creditCents,
    canClose: error === null,
    error,
  };
}
