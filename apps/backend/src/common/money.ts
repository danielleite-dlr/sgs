import { Prisma } from '@prisma/client';

export type MoneyLike = string | number | Prisma.Decimal;

/** "80.50" | Decimal | 80.5 -> 8050 (centavos inteiros, half-up). */
export function toCents(v: MoneyLike): number {
  return new Prisma.Decimal(v)
    .mul(100)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}

/** 8050 -> "80.50"; aceita negativo. */
export function fromCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const int = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${int}.${frac}`;
}

/** Entrada de API: so "^\d+(\.\d{1,2})?$" -> centavos; senao null. */
export function parseMoneyInput(s: string): number | null {
  if (typeof s !== 'string' || !/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return toCents(s);
}

/**
 * Rateia `totalCents` proporcional a `weights` (centavos). Floor em cada parte e
 * o resto vai no ultimo elemento; pesos todos zero -> tudo no ultimo.
 */
export function splitProportional(weights: number[], totalCents: number): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((w) => (sum === 0 ? 0 : Math.floor((w * totalCents) / sum)));
  const assigned = parts.slice(0, -1).reduce((a, b) => a + b, 0);
  parts[parts.length - 1] = totalCents - assigned;
  return parts;
}
