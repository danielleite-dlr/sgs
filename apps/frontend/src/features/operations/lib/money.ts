/**
 * Dinheiro no frontend: strings decimais ("80.00") como no GraphQL; contas em
 * centavos inteiros. Mesma regra de `computeComandaTotals` do backend.
 */
export type PaymentLine = { method: string; amount: string };

export interface PaymentSummary {
  total: string;
  paid: string;
  remaining: string;
  change: string;
  canClose: boolean;
  error: 'INVALID_CHANGE' | null;
}

export function decimalToCents(v: string): number {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(v.trim());
  if (!m) throw new Error('valor inválido');
  const whole = parseInt(m[2], 10);
  const frac = parseInt((m[3] ?? '').padEnd(2, '0') || '0', 10);
  const cents = whole * 100 + frac;
  return m[1] === '-' && cents !== 0 ? -cents : cents;
}

export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

export function sumDecimals(values: string[]): string {
  return centsToDecimal(values.reduce((acc, v) => acc + decimalToCents(v), 0));
}

export function computePaymentSummary(total: string, payments: PaymentLine[]): PaymentSummary {
  const totalC = decimalToCents(total);
  const paidC = payments.reduce((acc, p) => acc + decimalToCents(p.amount), 0);
  const cashC = payments
    .filter((p) => p.method === 'cash')
    .reduce((acc, p) => acc + decimalToCents(p.amount), 0);
  const remainingC = Math.max(0, totalC - paidC);
  const changeC = Math.max(0, paidC - totalC);
  const error = changeC > cashC ? 'INVALID_CHANGE' : null;
  return {
    total: centsToDecimal(totalC),
    paid: centsToDecimal(paidC),
    remaining: centsToDecimal(remainingC),
    change: centsToDecimal(changeC),
    canClose: paidC >= totalC && error === null,
    error,
  };
}
