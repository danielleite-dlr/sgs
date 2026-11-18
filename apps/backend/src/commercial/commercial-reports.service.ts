import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { TenantContextService } from '../database/tenant-context.service';
import { visibilityWhere, type CommercialViewer } from './commercial-access';
import {
  COMMERCIAL_SOURCES,
  DEAL_KINDS,
  LOST_REASONS,
  isCommercialSource,
  isDealKind,
} from './commercial-constants';
import {
  conversionOf,
  dealAmount,
  money,
  orgTimezoneTx,
  sumAmounts,
  todayRangeTx,
} from './commercial-dashboard.service';
import {
  buildReportPdf,
  buildReportXlsx,
  type CommercialReportData,
  type CommercialReportRowData,
} from './commercial-export';
import { ensureDefaultStagesTx } from './commercial-stages.service';

export const REPORT_ROW_LIMIT = 5000;
const MAX_RANGE_DAYS = 366;

export interface CommercialReportFilterDto {
  from: string;
  to: string;
  assigneeMemberId?: string | null;
  stageId?: string | null;
  status?: string | null;
  kind?: string | null;
  source?: string | null;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['open', 'won', 'lost'];

const invalid = (code: string, message: string) =>
  new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT', reason: code } });

function ymdToUtcMs(ymd: string): number {
  const ms = Date.parse(`${ymd}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== ymd) {
    throw invalid('PERIOD_INVALID', 'Período inválido.');
  }
  return ms;
}

function validateFilter(f: CommercialReportFilterDto): void {
  if (!YMD.test(f.from ?? '') || !YMD.test(f.to ?? '')) {
    throw invalid('PERIOD_INVALID', 'Informe o período como AAAA-MM-DD.');
  }
  const from = ymdToUtcMs(f.from);
  const to = ymdToUtcMs(f.to);
  if (to < from) throw invalid('PERIOD_INVALID', 'A data final não pode ser anterior à inicial.');
  if ((to - from) / 86_400_000 + 1 > MAX_RANGE_DAYS) {
    throw invalid('PERIOD_INVALID', 'O período máximo é de 366 dias.');
  }
  if (f.status && !STATUSES.includes(f.status)) {
    throw invalid('STATUS_INVALID', 'Status inválido.');
  }
  if (f.kind && !isDealKind(f.kind)) throw invalid('KIND_INVALID', 'Tipo inválido.');
  if (f.source && !isCommercialSource(f.source)) {
    throw invalid('SOURCE_INVALID', 'Origem inválida.');
  }
}

const labelOf = (list: readonly { code: string; label: string }[], code: string) =>
  list.find((i) => i.code === code)?.label ?? code;

const ymd = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

@Injectable()
export class CommercialReportsService {
  constructor(private readonly tenant: TenantContextService) {}

  async report(orgId: string, viewer: CommercialViewer, filter: CommercialReportFilterDto) {
    validateFilter(filter);
    // defesa em profundidade: o relatório também respeita a visibilidade do papel
    const dealVis = visibilityWhere(viewer).deal as Prisma.CommercialDealWhereInput;

    return this.tenant.runWithTenant(orgId, async (tx) => {
      await ensureDefaultStagesTx(tx, orgId);
      const tz = await orgTimezoneTx(tx, orgId);
      const range = await tx.$queryRaw<{ s: Date; e: Date }[]>`
        SELECT (${filter.from}::date::timestamp AT TIME ZONE ${tz}) AS s,
               ((${filter.to}::date + 1)::timestamp AT TIME ZONE ${tz}) AS e`;
      const { s, e } = range[0];

      const where: Prisma.CommercialDealWhereInput = {
        AND: [
          dealVis,
          { organizationId: orgId, createdAt: { gte: s, lt: e } },
          ...(filter.assigneeMemberId ? [{ assigneeMemberId: filter.assigneeMemberId }] : []),
          ...(filter.stageId ? [{ stageId: filter.stageId }] : []),
          ...(filter.status ? [{ status: filter.status }] : []),
          ...(filter.kind ? [{ kind: filter.kind }] : []),
          ...(filter.source ? [{ source: filter.source }] : []),
        ],
      };
      const orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

      const [light, heavy, stages] = await Promise.all([
        tx.commercialDeal.findMany({
          where,
          orderBy,
          select: {
            status: true,
            stageId: true,
            assigneeMemberId: true,
            source: true,
            lostReasonCode: true,
            finalAmount: true,
            packagePrice: true,
            discountAmount: true,
          },
        }),
        tx.commercialDeal.findMany({
          where,
          orderBy,
          take: REPORT_ROW_LIMIT + 1,
          include: {
            lead: { select: { fullName: true, phone: true } },
            stage: { select: { name: true } },
            assignee: { select: { displayName: true } },
          },
        }),
        tx.commercialStage.findMany({
          where: { organizationId: orgId },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
        }),
      ]);

      const truncated = heavy.length > REPORT_ROW_LIMIT;
      const rows = heavy.slice(0, REPORT_ROW_LIMIT).map((d) => ({
        dealId: d.id,
        leadName: d.lead.fullName,
        phone: d.lead.phone,
        kind: d.kind,
        eventDate: ymd(d.eventDate),
        stageName: d.stage.name,
        status: d.status,
        assigneeName: d.assignee?.displayName ?? null,
        source: d.source,
        packageName: d.packageName,
        finalAmount: d.finalAmount === null ? null : money(d.finalAmount),
        lostReasonLabel: d.lostReasonCode ? labelOf(LOST_REASONS, d.lostReasonCode) : null,
        lostReasonText: d.lostReasonText,
        createdAt: d.createdAt,
        closedAt: d.closedAt,
      }));

      const open = light.filter((d) => d.status === 'open');
      const won = light.filter((d) => d.status === 'won');
      const lost = light.filter((d) => d.status === 'lost');

      const byStage = stages.map((st) => {
        const ds = light.filter((d) => d.stageId === st.id);
        return {
          stageId: st.id,
          name: st.name,
          color: st.color,
          kind: st.kind,
          count: ds.length,
          amount: money(sumAmounts(ds.map(dealAmount))),
        };
      });

      const assigneeIds = [...new Set(light.map((d) => d.assigneeMemberId))];
      const members = await tx.member.findMany({
        where: { id: { in: assigneeIds.filter((i): i is string => i !== null) } },
        select: { id: true, displayName: true },
      });
      const nameOf = new Map(members.map((m) => [m.id, m.displayName]));
      const byAssignee = assigneeIds
        .map((id) => {
          const ds = light.filter((d) => d.assigneeMemberId === id);
          const w = ds.filter((d) => d.status === 'won');
          return {
            memberId: id,
            name: id ? (nameOf.get(id) ?? 'Responsável removido') : 'Sem responsável',
            deals: ds.length,
            won: w.length,
            lost: ds.filter((d) => d.status === 'lost').length,
            wonAmount: money(sumAmounts(w.map(dealAmount))),
          };
        })
        .sort((a, b) => b.deals - a.deals || a.name.localeCompare(b.name, 'pt-BR'));

      const bySource = COMMERCIAL_SOURCES.map((src) => {
        const ds = light.filter((d) => d.source === src.code);
        return {
          source: src.code,
          label: src.label,
          deals: ds.length,
          won: ds.filter((d) => d.status === 'won').length,
        };
      }).filter((x) => x.deals > 0);

      const lostReasons = LOST_REASONS.map((r) => ({
        code: r.code,
        label: r.label,
        count: lost.filter((d) => d.lostReasonCode === r.code).length,
      })).filter((x) => x.count > 0);

      return {
        totals: {
          deals: light.length,
          open: open.length,
          won: won.length,
          lost: lost.length,
          openAmount: money(sumAmounts(open.map(dealAmount))),
          wonAmount: money(sumAmounts(won.map(dealAmount))),
          conversionRate: conversionOf(won.length, lost.length),
        },
        byStage,
        byAssignee,
        bySource,
        lostReasons,
        rows,
        truncated,
      };
    });
  }

  async export(
    orgId: string,
    viewer: CommercialViewer,
    filter: CommercialReportFilterDto,
    format: string,
  ) {
    if (format !== 'xlsx' && format !== 'pdf') {
      throw new GraphQLError('Formato inválido: use xlsx ou pdf.', {
        extensions: { code: 'BAD_USER_INPUT', reason: 'FORMAT_INVALID' },
      });
    }
    const report = await this.report(orgId, viewer, filter);
    const { orgName, today, stageName, assigneeName } = await this.tenant.runWithTenant(
      orgId,
      async (tx) => {
        const org = await tx.organization.findUnique({
          where: { id: orgId },
          select: { tradeName: true },
        });
        const tz = await orgTimezoneTx(tx, orgId);
        const [stage, member] = await Promise.all([
          filter.stageId
            ? tx.commercialStage.findFirst({ where: { id: filter.stageId } })
            : Promise.resolve(null),
          filter.assigneeMemberId
            ? tx.member.findFirst({ where: { id: filter.assigneeMemberId } })
            : Promise.resolve(null),
        ]);
        return {
          orgName: org?.tradeName ?? '',
          today: (await todayRangeTx(tx, tz)).ymd,
          stageName: stage?.name ?? null,
          assigneeName: member?.displayName ?? null,
        };
      },
    );

    const descricao: string[] = [];
    if (assigneeName) descricao.push(`Responsável: ${assigneeName}`);
    if (stageName) descricao.push(`Etapa: ${stageName}`);
    if (filter.status) {
      descricao.push(
        `Status: ${{ open: 'Aberto', won: 'Ganho', lost: 'Perdido' }[filter.status] ?? filter.status}`,
      );
    }
    if (filter.kind) descricao.push(`Tipo: ${labelOf(DEAL_KINDS, filter.kind)}`);
    if (filter.source) descricao.push(`Origem: ${labelOf(COMMERCIAL_SOURCES, filter.source)}`);
    if (report.truncated) descricao.push(`Limitado às primeiras ${REPORT_ROW_LIMIT} linhas`);

    const data: CommercialReportData = {
      orgName,
      geradoEm: new Date(),
      filtros: { from: filter.from, to: filter.to, descricao },
      totals: report.totals,
      byStage: report.byStage,
      byAssignee: report.byAssignee,
      bySource: report.bySource,
      lostReasons: report.lostReasons,
      rows: report.rows.map(
        (r): CommercialReportRowData => ({
          ...r,
          source: labelOf(COMMERCIAL_SOURCES, r.source),
        }),
      ),
      truncated: report.truncated,
    };

    if (format === 'xlsx') {
      const buf = await buildReportXlsx(data);
      return {
        filename: `relatorio-comercial-${today}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        base64: buf.toString('base64'),
      };
    }
    const buf = await buildReportPdf(data);
    return {
      filename: `relatorio-comercial-${today}.pdf`,
      mimeType: 'application/pdf',
      base64: buf.toString('base64'),
    };
  }
}
