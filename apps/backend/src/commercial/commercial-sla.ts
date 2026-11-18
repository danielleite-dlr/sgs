/**
 * Negócio atrasado (D-15): aberto, etapa com prazo, e passou sla_days desde a última
 * interação (ou da entrada na etapa, se nunca houve interação).
 *
 * SQL equivalente:
 *   status = 'open' AND s.sla_days IS NOT NULL
 *   AND now() > COALESCE(d.last_interaction_at, d.stage_entered_at) + s.sla_days * interval '1 day'
 */

export interface SlaDealInput {
  status: 'open' | 'won' | 'lost';
  slaDays: number | null;
  lastInteractionAt: Date | null;
  stageEnteredAt: Date;
}

const DAY_MS = 86_400_000;

/** Data limite do prazo, ou null se o negócio não está aberto ou a etapa não tem prazo. */
export function overdueSince(deal: SlaDealInput): Date | null {
  if (deal.status !== 'open' || deal.slaDays === null || deal.slaDays === undefined) return null;
  const base = deal.lastInteractionAt ?? deal.stageEnteredAt;
  return new Date(base.getTime() + deal.slaDays * DAY_MS);
}

export function isDealOverdue(deal: SlaDealInput, now: Date): boolean {
  const limit = overdueSince(deal);
  return limit !== null && now.getTime() > limit.getTime();
}
