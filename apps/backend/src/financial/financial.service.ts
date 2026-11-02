import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { fromCents, toCents } from '../common/money';
import { TenantContextService } from '../database/tenant-context.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 400;
const CASH_LIMIT = 500;
const UNITS = ['day', 'week', 'month'] as const;
type Unit = (typeof UNITS)[number];

const money = (v: string | null | undefined) => fromCents(toCents(v ?? '0'));

function validateRange(from: string, to: string): void {
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    throw new BadRequestException('Datas devem estar no formato AAAA-MM-DD.');
  }
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days <= 0) {
    throw new BadRequestException('A data inicial deve ser anterior à data final.');
  }
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestException(`O período máximo é de ${MAX_RANGE_DAYS} dias.`);
  }
}

@Injectable()
export class FinancialService {
  constructor(private readonly tenant: TenantContextService) {}

  private async timezone(
    tx: Parameters<Parameters<TenantContextService['runWithTenant']>[1]>[0],
    orgId: string,
  ): Promise<string> {
    const org = await tx.organization.findUnique({ where: { id: orgId } });
    return org?.timezone ?? 'America/Sao_Paulo';
  }

  /** Dashboard D-22: Faturado (competência) + Recebido (caixa) por bucket e por método. */
  async summary(orgId: string, from: string, to: string, granularity: string) {
    validateRange(from, to);
    if (!(UNITS as readonly string[]).includes(granularity)) {
      throw new BadRequestException('Granularidade inválida (use day, week ou month).');
    }
    const unit = granularity as Unit;
    // `unit` vem do whitelist acima; Prisma.raw é seguro aqui.
    const u = Prisma.raw(`'${unit}'`);
    const step = Prisma.raw(`INTERVAL '1 ${unit}'`);

    return this.tenant.runWithTenant(orgId, async (tx) => {
      const tz = await this.timezone(tx, orgId);
      const rows = await tx.$queryRaw<
        { bucket: string; billed: string; received: string; n: number }[]
      >`
        WITH series AS (
          SELECT gs::date AS bucket
            FROM generate_series(
                   date_trunc(${u}, ${from}::date::timestamp)::date,
                   (${to}::date - 1),
                   ${step}) gs
        ), billed AS (
          SELECT date_trunc(${u}, closed_at AT TIME ZONE ${tz})::date AS bucket,
                 SUM(total) AS v, COUNT(*) AS n
            FROM comandas
           WHERE status = 'closed'
             AND closed_at >= (${from}::date)::timestamp AT TIME ZONE ${tz}
             AND closed_at <  (${to}::date)::timestamp AT TIME ZONE ${tz}
           GROUP BY 1
        ), received AS (
          SELECT date_trunc(${u}, occurred_at AT TIME ZONE ${tz})::date AS bucket,
                 SUM(amount) AS v
            FROM cash_movements
           WHERE occurred_at >= (${from}::date)::timestamp AT TIME ZONE ${tz}
             AND occurred_at <  (${to}::date)::timestamp AT TIME ZONE ${tz}
           GROUP BY 1
        )
        SELECT s.bucket::text AS bucket,
               COALESCE(b.v, 0)::text AS billed,
               COALESCE(r.v, 0)::text AS received,
               COALESCE(b.n, 0)::int AS n
          FROM series s
          LEFT JOIN billed b USING (bucket)
          LEFT JOIN received r USING (bucket)
         ORDER BY s.bucket`;

      const methods = await tx.$queryRaw<{ method: string; total: string }[]>`
        SELECT method, SUM(amount)::text AS total
          FROM cash_movements
         WHERE occurred_at >= (${from}::date)::timestamp AT TIME ZONE ${tz}
           AND occurred_at <  (${to}::date)::timestamp AT TIME ZONE ${tz}
         GROUP BY method
        HAVING SUM(amount) <> 0
         ORDER BY SUM(amount) DESC, method`;

      const comm = await tx.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(calculated_amount), 0)::text AS total
          FROM commission_records
         WHERE calculated_at >= (${from}::date)::timestamp AT TIME ZONE ${tz}
           AND calculated_at <  (${to}::date)::timestamp AT TIME ZONE ${tz}`;

      let billedCents = 0;
      let receivedCents = 0;
      let closed = 0;
      const buckets = rows.map((r) => {
        billedCents += toCents(r.billed);
        receivedCents += toCents(r.received);
        closed += Number(r.n);
        return {
          bucketStart: r.bucket,
          billed: money(r.billed),
          received: money(r.received),
          closedComandas: Number(r.n),
        };
      });

      return {
        from,
        to,
        timezone: tz,
        granularity: unit,
        billedTotal: fromCents(billedCents),
        receivedTotal: fromCents(receivedCents),
        closedComandas: closed,
        averageTicket: fromCents(closed ? Math.round(billedCents / closed) : 0),
        commissionsTotal: money(comm[0]?.total),
        buckets,
        receivedByMethod: methods.map((m) => ({ method: m.method, total: money(m.total) })),
      };
    });
  }

  async cashMovements(orgId: string, from: string, to: string) {
    validateRange(from, to);
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const tz = await this.timezone(tx, orgId);
      const rows = await tx.$queryRaw<
        {
          id: string;
          kind: string;
          method: string;
          amount: string;
          occurred_at: Date;
          comanda_id: string | null;
          comanda_code: string | null;
          appointment_id: string | null;
          client_name: string | null;
          note: string | null;
        }[]
      >`
        SELECT m.id, m.kind, m.method, m.amount::text AS amount, m.occurred_at,
               m.comanda_id, c.code AS comanda_code, m.appointment_id,
               cl.full_name AS client_name, m.note
          FROM cash_movements m
          LEFT JOIN comandas c ON c.id = m.comanda_id
          LEFT JOIN clients cl ON cl.id = m.client_id
         WHERE m.occurred_at >= (${from}::date)::timestamp AT TIME ZONE ${tz}
           AND m.occurred_at <  (${to}::date)::timestamp AT TIME ZONE ${tz}
         ORDER BY m.occurred_at DESC, m.id DESC
         LIMIT ${CASH_LIMIT}`;
      return rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        method: r.method,
        amount: money(r.amount),
        occurredAt: r.occurred_at,
        comandaId: r.comanda_id,
        comandaCode: r.comanda_code,
        appointmentId: r.appointment_id,
        clientName: r.client_name,
        note: r.note,
      }));
    });
  }

  /** Sempre exibe o snapshot da regra (Pitfall 9): nunca junta com commission_rules. */
  async commissionRecords(
    orgId: string,
    a: { from: string; to: string; memberId?: string | null },
  ) {
    validateRange(a.from, a.to);
    const memberId = a.memberId ?? null;
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const tz = await this.timezone(tx, orgId);
      const rows = await tx.$queryRaw<
        {
          id: string;
          comanda_id: string;
          comanda_code: string;
          comanda_item_id: string;
          member_id: string;
          member_name: string;
          kind: string;
          cycle: number;
          item_name: string | null;
          base_amount: string;
          charged_amount: string;
          rule_kind: string | null;
          rule_value: string | null;
          no_rule: boolean;
          calculated_amount: string;
          reversed: boolean;
          rule_snapshot: string;
          calculated_at: Date;
        }[]
      >`
        SELECT cr.id, cr.comanda_id, c.code AS comanda_code, cr.comanda_item_id,
               cr.member_id, mb.display_name AS member_name, cr.kind, cr.cycle,
               cr.rule_snapshot->>'itemName' AS item_name,
               cr.base_amount::text AS base_amount,
               cr.charged_amount::text AS charged_amount,
               cr.rule_kind, cr.rule_value::text AS rule_value, cr.no_rule,
               cr.calculated_amount::text AS calculated_amount,
               EXISTS (SELECT 1 FROM commission_records r
                        WHERE r.reverses_record_id = cr.id) AS reversed,
               cr.rule_snapshot::text AS rule_snapshot, cr.calculated_at
          FROM commission_records cr
          JOIN comandas c ON c.id = cr.comanda_id
          JOIN members mb ON mb.id = cr.member_id
         WHERE cr.calculated_at >= (${a.from}::date)::timestamp AT TIME ZONE ${tz}
           AND cr.calculated_at <  (${a.to}::date)::timestamp AT TIME ZONE ${tz}
           AND (${memberId}::uuid IS NULL OR cr.member_id = ${memberId}::uuid)
         ORDER BY cr.calculated_at DESC, cr.id DESC`;
      return rows.map((r) => ({
        id: r.id,
        comandaId: r.comanda_id,
        comandaCode: r.comanda_code,
        comandaItemId: r.comanda_item_id,
        memberId: r.member_id,
        memberName: r.member_name,
        kind: r.kind,
        cycle: r.cycle,
        itemName: r.item_name ?? '',
        baseAmount: money(r.base_amount),
        chargedAmount: money(r.charged_amount),
        ruleKind: r.rule_kind,
        ruleValue: r.rule_value,
        noRule: r.no_rule,
        calculatedAmount: money(r.calculated_amount),
        reversed: r.reversed,
        ruleSnapshot: r.rule_snapshot,
        calculatedAt: r.calculated_at,
      }));
    });
  }

  async commissionTotals(
    orgId: string,
    a: { from: string; to: string; memberId?: string | null },
  ) {
    validateRange(a.from, a.to);
    const memberId = a.memberId ?? null;
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const tz = await this.timezone(tx, orgId);
      const rows = await tx.$queryRaw<
        { member_id: string; member_name: string; total: string; records: number; no_rule: number }[]
      >`
        SELECT cr.member_id, mb.display_name AS member_name,
               SUM(cr.calculated_amount)::text AS total,
               (COUNT(*) FILTER (WHERE cr.kind = 'accrual'))::int AS records,
               (COUNT(*) FILTER (
                  WHERE cr.no_rule AND cr.kind = 'accrual'
                    AND NOT EXISTS (SELECT 1 FROM commission_records r
                                     WHERE r.reverses_record_id = cr.id)))::int AS no_rule
          FROM commission_records cr
          JOIN members mb ON mb.id = cr.member_id
         WHERE cr.calculated_at >= (${a.from}::date)::timestamp AT TIME ZONE ${tz}
           AND cr.calculated_at <  (${a.to}::date)::timestamp AT TIME ZONE ${tz}
           AND (${memberId}::uuid IS NULL OR cr.member_id = ${memberId}::uuid)
         GROUP BY cr.member_id, mb.display_name
         ORDER BY mb.display_name`;
      return rows.map((r) => ({
        memberId: r.member_id,
        memberName: r.member_name,
        total: money(r.total),
        records: r.records,
        noRuleCount: r.no_rule,
      }));
    });
  }
}
