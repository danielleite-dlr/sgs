import { z } from 'zod';

export const CancellationPolicySchema = z.object({
  version: z.literal(1),
  clientCancels: z.literal('retain_all_paid'),
  studioCancels: z.literal('refund_all'),
  clause: z.string().trim().min(10).max(5000),
});

export type CancellationPolicy = z.infer<typeof CancellationPolicySchema>;

export const DEFAULT_CANCELLATION_CLAUSE =
  'Em caso de cancelamento solicitado pela CONTRATANTE, os valores já pagos, inclusive a entrada, não serão devolvidos e ficam retidos a título de multa. Em caso de cancelamento pelo CONTRATADO, todos os valores pagos, inclusive a entrada, serão devolvidos integralmente.';

export function buildPolicySnapshot(clause: string | null): CancellationPolicy {
  return CancellationPolicySchema.parse({
    version: 1,
    clientCancels: 'retain_all_paid',
    studioCancels: 'refund_all',
    clause: clause ?? DEFAULT_CANCELLATION_CLAUSE,
  });
}

/** D-22: só dois casos, sem faixas por antecedência. */
export function computeCancellationSettlement(input: {
  party: 'client' | 'studio';
  paidCents: number;
}): { retainedCents: number; refundCents: number } {
  if (input.paidCents < 0) throw new RangeError('NEGATIVE');
  return input.party === 'client'
    ? { retainedCents: input.paidCents, refundCents: 0 }
    : { retainedCents: 0, refundCents: input.paidCents };
}
