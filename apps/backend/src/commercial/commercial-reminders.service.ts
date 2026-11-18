import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { PushEventsService } from '../push/push-events.service';
import { isManagerRole, visibilityWhere, type CommercialViewer } from './commercial-access';
import { CommercialError, mapCommercialError, type CommercialUserError } from './commercial-errors';

export interface CreateCommercialReminderDto {
  title: string;
  description?: string | null;
  dueAt: Date | string;
  leadId?: string | null;
  dealId?: string | null;
}

export interface UpdateCommercialReminderDto {
  id: string;
  title?: string | null;
  description?: string | null;
  dueAt?: Date | string | null;
}

export interface CommercialReminderFilterDto {
  status?: string | null;
  leadId?: string | null;
  dealId?: string | null;
  limit?: number | null;
  offset?: number | null;
}

/** Máximo de lembretes reivindicados por organização a cada tick. */
export const REMINDER_CLAIM_LIMIT = 200;

const INCLUDE = {
  lead: { select: { id: true, fullName: true, phone: true, email: true } },
  deal: {
    select: { id: true, kind: true, eventDate: true, stage: { select: { name: true } } },
  },
  creator: { select: { id: true, displayName: true, role: { select: { name: true } } } },
} satisfies Prisma.CommercialReminderInclude;

type ReminderRow = Prisma.CommercialReminderGetPayload<{ include: typeof INCLUDE }>;

const notFound = (field = 'id') =>
  new CommercialError('NOT_FOUND', 'Lembrete não encontrado.', field);

function validateTitle(v: string | null | undefined): string {
  const t = (v ?? '').trim();
  if (t === '') throw new CommercialError('TITLE_REQUIRED', 'Informe o título.', 'title');
  if (t.length > 160) {
    throw new CommercialError('TITLE_TOO_LONG', 'O título pode ter até 160 caracteres.', 'title');
  }
  return t;
}

function validateDue(v: Date | string | null | undefined): Date {
  const d = v instanceof Date ? v : new Date(v ?? NaN);
  if (Number.isNaN(d.getTime())) {
    throw new CommercialError('DUE_INVALID', 'Data e hora do lembrete inválidas.', 'dueAt');
  }
  return d;
}

function cleanText(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
}

@Injectable()
export class CommercialRemindersService {
  private readonly logger = new Logger(CommercialRemindersService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly pushEvents: PushEventsService,
  ) {}

  private fail<T extends object>(e: unknown, empty: T): T & { errors: CommercialUserError[] } {
    const m = mapCommercialError(e);
    if (!m) throw e;
    return { ...empty, errors: [m] };
  }

  private vis(viewer: CommercialViewer): Prisma.CommercialReminderWhereInput {
    return visibilityWhere(viewer).reminder as Prisma.CommercialReminderWhereInput;
  }

  private present(r: ReminderRow, now: Date) {
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      dueAt: r.dueAt,
      completedAt: r.completedAt,
      notifiedAt: r.notifiedAt,
      overdue: r.completedAt === null && r.dueAt.getTime() < now.getTime(),
      lead: r.lead,
      dealId: r.dealId,
      dealKind: r.deal?.kind ?? null,
      dealEventDate: r.deal?.eventDate ? r.deal.eventDate.toISOString().slice(0, 10) : null,
      dealStageName: r.deal?.stage.name ?? null,
      createdBy: r.creator
        ? { id: r.creator.id, displayName: r.creator.displayName, roleName: r.creator.role.name }
        : null,
    };
  }

  private async getOneTx(tx: TenantPrismaClient, viewer: CommercialViewer, id: string) {
    const row = await tx.commercialReminder.findFirst({
      where: { id, AND: [this.vis(viewer)] },
      include: INCLUDE,
    });
    return row ? this.present(row, new Date()) : null;
  }

  /** Fim do dia de hoje no fuso da organização (início do dia seguinte), como instante. */
  private async endOfToday(tx: TenantPrismaClient, orgId: string, now: Date): Promise<Date> {
    const org = await tx.organization.findUnique({
      where: { id: orgId },
      select: { timezone: true },
    });
    const tz = org?.timezone ?? 'America/Sao_Paulo';
    const rows = await tx.$queryRaw<{ end_of_day: Date }[]>`
      SELECT ((date_trunc('day', ${now}::timestamptz AT TIME ZONE ${tz}) + interval '1 day')
              AT TIME ZONE ${tz}) AS end_of_day`;
    return rows[0].end_of_day;
  }

  async list(orgId: string, viewer: CommercialViewer, filter?: CommercialReminderFilterDto | null) {
    const f = filter ?? {};
    const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
    const offset = Math.max(f.offset ?? 0, 0);
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const now = new Date();
      const and: Prisma.CommercialReminderWhereInput[] = [this.vis(viewer)];
      let orderBy: Prisma.CommercialReminderOrderByWithRelationInput[] = [
        { dueAt: 'asc' },
        { id: 'asc' },
      ];
      switch (f.status ?? 'pending') {
        case 'overdue':
          and.push({ completedAt: null, dueAt: { lt: now } });
          break;
        case 'today': {
          const end = await this.endOfToday(tx, orgId, now);
          and.push({ completedAt: null, dueAt: { gte: now, lt: end } });
          break;
        }
        case 'upcoming': {
          const end = await this.endOfToday(tx, orgId, now);
          and.push({ completedAt: null, dueAt: { gte: end } });
          break;
        }
        case 'done':
          and.push({ completedAt: { not: null } });
          orderBy = [{ completedAt: 'desc' }, { id: 'desc' }];
          break;
        default:
          and.push({ completedAt: null });
      }
      if (f.leadId) and.push({ leadId: f.leadId });
      if (f.dealId) and.push({ dealId: f.dealId });
      const where: Prisma.CommercialReminderWhereInput = { organizationId: orgId, AND: and };
      const [total, rows] = await Promise.all([
        tx.commercialReminder.count({ where }),
        tx.commercialReminder.findMany({
          where,
          include: INCLUDE,
          orderBy,
          take: limit,
          skip: offset,
        }),
      ]);
      return { items: rows.map((r) => this.present(r, now)), total };
    });
  }

  get(orgId: string, viewer: CommercialViewer, id: string) {
    return this.tenant.runWithTenant(orgId, (tx) => this.getOneTx(tx, viewer, id));
  }

  counts(orgId: string, viewer: CommercialViewer) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const now = new Date();
      const end = await this.endOfToday(tx, orgId, now);
      const base = { organizationId: orgId, completedAt: null } as const;
      const [overdue, today] = await Promise.all([
        tx.commercialReminder.count({
          where: { ...base, AND: [this.vis(viewer)], dueAt: { lt: now } },
        }),
        tx.commercialReminder.count({
          where: { ...base, AND: [this.vis(viewer)], dueAt: { gte: now, lt: end } },
        }),
      ]);
      return { overdue, today };
    });
  }

  async create(orgId: string, viewer: CommercialViewer, input: CreateCommercialReminderDto) {
    try {
      const title = validateTitle(input.title);
      const dueAt = validateDue(input.dueAt);
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        let leadId = input.leadId ?? null;
        const dealId = input.dealId ?? null;
        if (dealId) {
          const deal = await tx.commercialDeal.findFirst({
            where: {
              id: dealId,
              ...(visibilityWhere(viewer).deal as Prisma.CommercialDealWhereInput),
            },
            select: { leadId: true },
          });
          if (!deal) throw notFound('dealId');
          if (leadId && leadId !== deal.leadId) throw notFound('leadId');
          leadId = deal.leadId;
        } else if (leadId) {
          const lead = await tx.commercialLead.findFirst({
            where: {
              id: leadId,
              ...(visibilityWhere(viewer).lead as Prisma.CommercialLeadWhereInput),
            },
            select: { id: true },
          });
          if (!lead) throw notFound('leadId');
        }
        const row = await tx.commercialReminder.create({
          data: {
            organizationId: orgId,
            title,
            description: cleanText(input.description),
            dueAt,
            leadId,
            dealId,
            createdBy: viewer.memberId,
          },
        });
        return {
          reminder: await this.getOneTx(tx, viewer, row.id),
          errors: [] as CommercialUserError[],
        };
      });
    } catch (e) {
      return this.fail(e, { reminder: null });
    }
  }

  async update(orgId: string, viewer: CommercialViewer, input: UpdateCommercialReminderDto) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await tx.commercialReminder.findFirst({
          where: { id: input.id, AND: [this.vis(viewer)] },
        });
        if (!cur) throw notFound();
        const data: Prisma.CommercialReminderUncheckedUpdateInput = {};
        if (input.title !== undefined && input.title !== null) {
          data.title = validateTitle(input.title);
        }
        if (input.description !== undefined) data.description = cleanText(input.description);
        if (input.dueAt !== undefined && input.dueAt !== null) {
          const due = validateDue(input.dueAt);
          data.dueAt = due;
          // reagendar um lembrete já avisado faz avisar de novo na nova hora
          if (due.getTime() !== cur.dueAt.getTime()) data.notifiedAt = null;
        }
        await tx.commercialReminder.update({ where: { id: cur.id }, data });
        return {
          reminder: await this.getOneTx(tx, viewer, cur.id),
          errors: [] as CommercialUserError[],
        };
      });
    } catch (e) {
      return this.fail(e, { reminder: null });
    }
  }

  async complete(orgId: string, viewer: CommercialViewer, id: string, completed: boolean) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await tx.commercialReminder.findFirst({
          where: { id, AND: [this.vis(viewer)] },
        });
        if (!cur) throw notFound();
        await tx.commercialReminder.update({
          where: { id },
          data: { completedAt: completed ? new Date() : null },
        });
        return {
          reminder: await this.getOneTx(tx, viewer, id),
          errors: [] as CommercialUserError[],
        };
      });
    } catch (e) {
      return this.fail(e, { reminder: null });
    }
  }

  async remove(orgId: string, viewer: CommercialViewer, id: string) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await tx.commercialReminder.findFirst({
          where: { id, AND: [this.vis(viewer)] },
        });
        if (!cur) throw notFound();
        if (!isManagerRole(viewer.roleName) && cur.createdBy !== viewer.memberId) {
          throw new CommercialError(
            'FORBIDDEN_ROLE',
            'Só quem criou o lembrete ou a gestão pode excluir.',
            'id',
          );
        }
        await tx.commercialReminder.delete({ where: { id } });
        return { ok: true, errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { ok: false });
    }
  }

  /**
   * Reivindica, de forma atômica, os lembretes vencidos não concluídos e ainda não avisados
   * da organização (marca notified_at). Duas chamadas seguidas não devolvem o mesmo lembrete.
   */
  claimDueRemindersForOrg(orgId: string, now: Date): Promise<{ id: string }[]> {
    return this.tenant.runWithTenant(
      orgId,
      (tx) =>
        tx.$queryRaw<{ id: string }[]>`
        UPDATE commercial_reminders SET notified_at = ${now}
        WHERE id IN (
          SELECT id FROM commercial_reminders
          WHERE completed_at IS NULL AND notified_at IS NULL AND due_at <= ${now}
          ORDER BY due_at LIMIT ${REMINDER_CLAIM_LIMIT} FOR UPDATE SKIP LOCKED
        )
        RETURNING id::text AS id`,
    );
  }

  /** Um tick por minuto: enfileira um push commercial.reminder por lembrete vencido. */
  async tick(now: Date): Promise<{ orgs: number; notified: number }> {
    const orgs = await this.tenant.runWithoutTenant(
      (tx) =>
        tx.$queryRaw<{ organization_id: string; timezone: string }[]>`
        SELECT organization_id, timezone FROM job_list_active_orgs()`,
    );
    let notified = 0;
    for (const o of orgs) {
      try {
        const due = await this.claimDueRemindersForOrg(o.organization_id, now);
        for (const r of due) {
          this.pushEvents.enqueue({
            kind: 'commercial.reminder',
            orgId: o.organization_id,
            reminderId: r.id,
          });
          notified++;
        }
      } catch (e) {
        this.logger.error(
          `Falha nos lembretes da org ${o.organization_id}: ${(e as Error).message}`,
        );
      }
    }
    return { orgs: orgs.length, notified };
  }
}
