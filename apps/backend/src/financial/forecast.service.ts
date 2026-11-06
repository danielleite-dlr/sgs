import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { fromCents, toCents } from '../common/money';
import { TenantContextService } from '../database/tenant-context.service';
import { loadCategoryParents } from '../identity/member-categories';
import { categoryChain, computeCommission, resolveCommissionRule, type RuleLite } from './commission-resolver';
import { orgTimezone, validateRange } from './financial.service';
import {
  FORECAST_APPOINTMENT_STATUSES,
  appointmentInflowCents,
  buildWeeklyBuckets,
  contractReceivables,
  expandFixedExpenses,
  fallbackCommission,
  summarizeForecast,
  type ForecastItemCents,
} from './forecast';

interface AppointmentRow {
  id: string;
  professional_id: string;
  service_id: string;
  contract_id: string | null;
  deposit: string;
  day: string;
  service_name: string;
  base_price: string;
  category_id: string | null;
  variant_price: string | null;
  professional_name: string;
  comanda_item_count: number;
  comanda_total: string;
}

interface ContractItemRow {
  id: string;
  contract_id: string;
  service_id: string;
  quantity: number;
  base_price: string;
  category_id: string | null;
  service_name: string;
  code: string;
  event_date: string;
  scheduled: number;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class ForecastService {
  constructor(private readonly tenant: TenantContextService) {}

  async forecast(orgId: string, from: string, to: string) {
    validateRange(from, to);

    return this.tenant.runWithTenant(orgId, async (tx) => {
      const tz = await orgTimezone(tx, orgId);

      const ruleRows = await tx.commissionRule.findMany({ where: { deletedAt: null } });
      const rules: RuleLite[] = ruleRows.map((r) => ({
        id: r.id,
        scopeType: r.scopeType as RuleLite['scopeType'],
        kind: r.kind as RuleLite['kind'],
        value: r.value.toString(),
        memberId: r.memberId,
        serviceId: r.serviceId,
        categoryId: r.categoryId,
        productId: r.productId,
        deletedAt: r.deletedAt,
      }));
      const parents = await loadCategoryParents(tx);

      const items: ForecastItemCents[] = [];

      // b. Agendamentos da janela (todas as origens)
      const appts = await tx.$queryRaw<AppointmentRow[]>`
        SELECT a.id, a.professional_id, a.service_id, a.contract_id, a.deposit_amount::text AS deposit,
               (a.starts_at AT TIME ZONE ${tz})::date::text AS day,
               s.name AS service_name, s.base_price::text AS base_price, s.category_id,
               v.price::text AS variant_price, m.display_name AS professional_name,
               (SELECT COUNT(*)::int FROM comanda_items ci JOIN comandas co ON co.id = ci.comanda_id
                 WHERE ci.appointment_id = a.id AND co.status = 'open') AS comanda_item_count,
               (SELECT COALESCE(SUM(ci.total), 0)::text FROM comanda_items ci JOIN comandas co ON co.id = ci.comanda_id
                 WHERE ci.appointment_id = a.id AND co.status = 'open') AS comanda_total
          FROM appointments a
          JOIN services s ON s.id = a.service_id
          LEFT JOIN service_pricing_variants v ON v.id = a.service_variant_id
          JOIN members m ON m.id = a.professional_id
         WHERE a.status IN (${Prisma.join([...FORECAST_APPOINTMENT_STATUSES])})
           AND a.starts_at >= (${from}::date)::timestamp AT TIME ZONE ${tz}
           AND a.starts_at <  (${to}::date)::timestamp AT TIME ZONE ${tz}`;

      for (const a of appts) {
        const baseCents = toCents(a.base_price);
        const variantCents = a.variant_price == null ? null : toCents(a.variant_price);
        if (a.contract_id == null) {
          const cents = appointmentInflowCents({
            comandaItemCount: a.comanda_item_count,
            comandaItemsCents: toCents(a.comanda_total),
            variantCents,
            baseCents,
            depositCents: toCents(a.deposit),
          });
          if (cents > 0) {
            items.push({
              date: a.day,
              kind: 'appointment',
              direction: 'in',
              cents,
              label: `${a.service_name} · ${a.professional_name}`,
              refId: a.id,
              overdue: false,
              noRule: false,
              withoutProfessional: false,
            });
          }
        }
        // D-10: comissão de TODOS os agendamentos, inclusive os ligados a contrato
        const listUnitCents = variantCents ?? baseCents;
        const match = resolveCommissionRule(rules, {
          kind: 'service',
          memberId: a.professional_id,
          serviceId: a.service_id,
          categoryChain: categoryChain(a.category_id, parents),
        });
        const c = computeCommission(match, { listUnitCents, quantity: 1, chargedCents: listUnitCents });
        items.push({
          date: a.day,
          kind: 'commission',
          direction: 'out',
          cents: c.amountCents,
          label: `Comissão — ${a.professional_name} · ${a.service_name}`,
          refId: a.id,
          overdue: false,
          noRule: c.noRule,
          withoutProfessional: false,
        });
      }

      // c. Contratos ativos
      const contracts = await tx.contract.findMany({
        where: { status: 'active' },
        include: { installments: true },
      });
      const paidRows = await tx.$queryRaw<{ contract_id: string; net: string }[]>`
        SELECT contract_id, COALESCE(SUM(amount), 0)::text AS net FROM contract_payments GROUP BY contract_id`;
      const netByContract = new Map(paidRows.map((r) => [r.contract_id, toCents(r.net)]));
      for (const c of contracts) {
        items.push(
          ...contractReceivables(
            {
              contractId: c.id,
              code: c.code,
              installments: c.installments.map((i) => ({
                seq: i.seq,
                dueDate: isoDate(i.dueDate),
                cents: toCents(i.amount),
              })),
              netPaidCents: netByContract.get(c.id) ?? 0,
              depositCents: toCents(c.depositAmount),
              totalCents: toCents(c.totalAmount),
              balanceDueDate: isoDate(c.balanceDueDate),
            },
            from,
            to,
          ),
        );
      }

      // d. Itens de contrato (evento) ainda sem agendamento: sem profissional definido (D-10).
      // Itens purpose='trial' sem agendamento ficam de fora: não têm data própria.
      const ciRows = await tx.$queryRaw<ContractItemRow[]>`
        SELECT ci.id, ci.contract_id, ci.service_id, ci.quantity, s.base_price::text AS base_price, s.category_id,
               s.name AS service_name, c.code, g.event_date::text AS event_date,
               (SELECT COUNT(*) FROM appointments a
                 WHERE a.contract_id = ci.contract_id AND a.service_id = ci.service_id
                   AND a.client_id = bgm.client_id AND COALESCE(a.purpose, 'event') = 'event'
                   AND a.status NOT IN ('cancelled', 'no_show'))::int AS scheduled
          FROM contract_items ci
          JOIN contracts c ON c.id = ci.contract_id
          JOIN bridal_groups g ON g.id = c.bridal_group_id
          JOIN bridal_group_members bgm ON bgm.id = ci.group_member_id
          JOIN services s ON s.id = ci.service_id
         WHERE c.status = 'active' AND ci.purpose = 'event'
           AND g.event_date >= ${from}::date AND g.event_date < ${to}::date`;
      for (const r of ciRows) {
        const qty = Math.max(0, r.quantity - r.scheduled);
        if (qty <= 0) continue;
        const baseCents = toCents(r.base_price);
        const f = fallbackCommission(
          rules,
          { serviceId: r.service_id, categoryChain: categoryChain(r.category_id, parents) },
          { listUnitCents: baseCents, quantity: qty, chargedCents: baseCents * qty },
        );
        items.push({
          date: r.event_date,
          kind: 'commission',
          direction: 'out',
          cents: f.amountCents,
          label: `Comissão estimada — sem profissional definido · ${r.service_name} (contrato ${r.code})`,
          refId: r.contract_id,
          overdue: false,
          noRule: f.noRule,
          withoutProfessional: true,
        });
      }

      // e. Despesas fixas
      const expenses = await tx.fixedExpense.findMany({ where: { active: true } });
      items.push(
        ...expandFixedExpenses(
          expenses.map((e) => ({
            id: e.id,
            name: e.name,
            cents: toCents(e.amount),
            dueDay: e.dueDay,
            active: e.active,
          })),
          from,
          to,
        ),
      );

      // f. Ordenação, buckets e totais
      items.sort(
        (x, y) =>
          (x.date < y.date ? -1 : x.date > y.date ? 1 : 0) ||
          (x.direction === y.direction ? 0 : x.direction === 'in' ? -1 : 1) ||
          (x.label < y.label ? -1 : x.label > y.label ? 1 : 0),
      );
      const buckets = buildWeeklyBuckets(items, from, to);
      const totals = summarizeForecast(items);

      return {
        from,
        to,
        timezone: tz,
        inflowTotal: fromCents(totals.inflowCents),
        outflowTotal: fromCents(totals.outflowCents),
        balance: fromCents(totals.balanceCents),
        overdueInflowTotal: fromCents(totals.overdueInflowCents),
        noRuleCount: items.filter((i) => i.kind === 'commission' && i.noRule).length,
        withoutProfessionalCount: items.filter((i) => i.withoutProfessional).length,
        buckets: buckets.map((b) => ({
          start: b.start,
          end: b.end,
          inflow: fromCents(b.inflowCents),
          outflow: fromCents(b.outflowCents),
          balance: fromCents(b.balanceCents),
          overdueInflow: fromCents(b.overdueInflowCents),
        })),
        items: items.map((i) => ({
          date: i.date,
          kind: i.kind,
          direction: i.direction,
          amount: fromCents(i.cents),
          label: i.label,
          refId: i.refId,
          overdue: i.overdue,
          noRule: i.noRule,
          withoutProfessional: i.withoutProfessional,
        })),
      };
    });
  }
}
