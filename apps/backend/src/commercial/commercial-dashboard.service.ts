import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { visibilityWhere, type CommercialViewer } from './commercial-access';
import { overdueSince } from './commercial-sla';
import { ensureDefaultStagesTx } from './commercial-stages.service';

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/** Valor do negócio: valor final, ou preço do pacote menos desconto, ou zero. */
export function dealAmount(d: {
  finalAmount: Prisma.Decimal | null;
  packagePrice: Prisma.Decimal | null;
  discountAmount: Prisma.Decimal;
}): Prisma.Decimal {
  if (d.finalAmount !== null) return d.finalAmount;
  if (d.packagePrice !== null) return d.packagePrice.minus(d.discountAmount);
  return new Prisma.Decimal(0);
}

export const money = (d: Prisma.Decimal): string => d.toFixed(2);

export const sumAmounts = (items: Prisma.Decimal[]): Prisma.Decimal =>
  items.reduce((a, b) => a.plus(b), new Prisma.Decimal(0));

export const conversionOf = (won: number, lost: number): number | null =>
  won + lost === 0 ? null : won / (won + lost);

export async function orgTimezoneTx(tx: TenantPrismaClient, orgId: string): Promise<string> {
  const org = await tx.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  });
  return org?.timezone ?? DEFAULT_TIMEZONE;
}

/** Início do dia local da organização (hoje) e do dia seguinte, como instantes. */
export async function todayRangeTx(
  tx: TenantPrismaClient,
  tz: string,
): Promise<{ start: Date; end: Date; ymd: string }> {
  const r = await tx.$queryRaw<{ start: Date; end: Date; ymd: string }[]>`
    SELECT (date_trunc('day', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz}) AS start,
           ((date_trunc('day', now() AT TIME ZONE ${tz}) + interval '1 day') AT TIME ZONE ${tz}) AS "end",
           to_char(now() AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS ymd`;
  return r[0];
}

const FOLLOW_UP_LIMIT = 10;
const LAST_INTERACTIONS_LIMIT = 10;

@Injectable()
export class CommercialDashboardService {
  constructor(private readonly tenant: TenantContextService) {}

  async get(orgId: string, viewer: CommercialViewer, periodDays?: number | null) {
    const days = Math.min(Math.max(Math.trunc(periodDays ?? 30), 1), 365);
    const vis = visibilityWhere(viewer);
    const dealVis = vis.deal as Prisma.CommercialDealWhereInput;
    const leadVis = vis.lead as Prisma.CommercialLeadWhereInput;
    const interVis = vis.interaction as Prisma.CommercialInteractionWhereInput;
    const remVis = vis.reminder as Prisma.CommercialReminderWhereInput;

    return this.tenant.runWithTenant(orgId, async (tx) => {
      await ensureDefaultStagesTx(tx, orgId);
      const tz = await orgTimezoneTx(tx, orgId);
      const { start, end } = await todayRangeTx(tx, tz);
      const now = new Date();
      const since = new Date(now.getTime() - days * 86_400_000);
      const today = { gte: start, lt: end };

      const [
        newLeadsToday,
        newDealsToday,
        interactionsToday,
        remindersOverdue,
        remindersToday,
        openDeals,
        closedDeals,
        stages,
        lastInteractions,
      ] = await Promise.all([
        tx.commercialLead.count({ where: { AND: [leadVis, { createdAt: today }] } }),
        tx.commercialDeal.count({ where: { AND: [dealVis, { createdAt: today }] } }),
        tx.commercialInteraction.count({ where: { AND: [interVis, { occurredAt: today }] } }),
        tx.commercialReminder.count({
          where: { AND: [remVis, { completedAt: null, dueAt: { lt: now } }] },
        }),
        tx.commercialReminder.count({
          where: { AND: [remVis, { completedAt: null, dueAt: { gte: now, lt: end } }] },
        }),
        tx.commercialDeal.findMany({
          where: { AND: [dealVis, { status: 'open' }] },
          select: {
            id: true,
            leadId: true,
            kind: true,
            stageId: true,
            stageEnteredAt: true,
            lastInteractionAt: true,
            finalAmount: true,
            packagePrice: true,
            discountAmount: true,
            lead: { select: { fullName: true } },
            assignee: { select: { displayName: true } },
            stage: { select: { name: true, color: true, slaDays: true } },
          },
        }),
        tx.commercialDeal.findMany({
          where: { AND: [dealVis, { status: { in: ['won', 'lost'] }, closedAt: { gte: since } }] },
          select: {
            status: true,
            stageId: true,
            finalAmount: true,
            packagePrice: true,
            discountAmount: true,
          },
        }),
        tx.commercialStage.findMany({
          where: { organizationId: orgId },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
        }),
        tx.commercialInteraction.findMany({
          where: interVis,
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: LAST_INTERACTIONS_LIMIT,
          select: {
            id: true,
            leadId: true,
            type: true,
            notes: true,
            occurredAt: true,
            lead: { select: { fullName: true } },
            creator: { select: { displayName: true } },
          },
        }),
      ]);

      // follow-ups: negócios abertos com prazo da etapa estourado (regra de commercial-sla.ts)
      const overdue = openDeals
        .map((d) => ({
          d,
          since: overdueSince({
            status: 'open',
            slaDays: d.stage.slaDays,
            lastInteractionAt: d.lastInteractionAt,
            stageEnteredAt: d.stageEnteredAt,
          }),
        }))
        .filter((x): x is { d: (typeof openDeals)[number]; since: Date } => {
          return x.since !== null && now.getTime() > x.since.getTime();
        })
        .sort((a, b) => a.since.getTime() - b.since.getTime());

      const perStage = new Map<string, { count: number; amount: Prisma.Decimal }>();
      const bump = (stageId: string, amount: Prisma.Decimal) => {
        const cur = perStage.get(stageId) ?? { count: 0, amount: new Prisma.Decimal(0) };
        perStage.set(stageId, { count: cur.count + 1, amount: cur.amount.plus(amount) });
      };
      for (const d of openDeals) bump(d.stageId, dealAmount(d));
      for (const d of closedDeals) bump(d.stageId, dealAmount(d));

      const won = closedDeals.filter((d) => d.status === 'won');
      const lost = closedDeals.filter((d) => d.status === 'lost');

      return {
        periodDays: days,
        newLeadsToday,
        newDealsToday,
        interactionsToday,
        remindersOverdue,
        remindersToday,
        followUpsPending: overdue.length,
        followUps: overdue.slice(0, FOLLOW_UP_LIMIT).map(({ d, since: s }) => ({
          dealId: d.id,
          leadId: d.leadId,
          leadName: d.lead.fullName,
          kind: d.kind,
          stageName: d.stage.name,
          stageColor: d.stage.color,
          overdueSince: s,
          assigneeName: d.assignee?.displayName ?? null,
        })),
        lastInteractions: lastInteractions.map((i) => ({
          id: i.id,
          leadId: i.leadId,
          leadName: i.lead.fullName,
          type: i.type,
          notes: i.notes,
          occurredAt: i.occurredAt,
          createdByName: i.creator?.displayName ?? null,
        })),
        stages: stages.map((s) => {
          const agg = perStage.get(s.id);
          return {
            stageId: s.id,
            name: s.name,
            color: s.color,
            kind: s.kind,
            count: agg?.count ?? 0,
            amount: money(agg?.amount ?? new Prisma.Decimal(0)),
          };
        }),
        openAmount: money(sumAmounts(openDeals.map(dealAmount))),
        wonCount: won.length,
        wonAmount: money(sumAmounts(won.map(dealAmount))),
        lostCount: lost.length,
        conversionRate: conversionOf(won.length, lost.length),
      };
    });
  }
}
