import { recordAudit } from '../../common/audit-log';
import { BLOCKING_STATUSES } from '../../appointments/appointment-status';
import { SchedulingError } from '../../appointments/scheduling-guard';
import { resolveAccess } from '../../authz/access/access-resolve';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import type { TenantPrismaClient } from '../../database/types';
import { localDate, orgTimezone } from '../bridal-schedule';
import { formatHour } from './timeline-domain';

export interface TimelineOverrideInput {
  reason: string;
}

export type CompanionRule = 'TIMELINE_AFTER_REGISTRY' | 'TIMELINE_PROFESSIONAL_WITH_BRIDE';

export interface ConfirmedTimelineLite {
  id: string;
  groupId: string;
  brideLabel: string;
  registryStartsAt: Date;
  registryLabel: string;
  windows: {
    kind: 'make' | 'hair';
    professionalId: string | null;
    startsAt: Date;
    endsAt: Date;
  }[];
}

/** Minutos desde 00:00 locais (no fuso da org) de um instante. */
function localMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
}

/**
 * Regra das acompanhantes (D-04), pura: termina até o início do registro e não usa a
 * profissional enquanto ela está com a noiva. A regra do registro tem prioridade.
 */
export function evaluateCompanionRules(
  t: ConfirmedTimelineLite,
  a: { professionalId: string; startsAt: Date; endsAt: Date },
  timeZone: string,
): { rule: CompanionRule; message: string } | null {
  if (a.endsAt.getTime() > t.registryStartsAt.getTime()) {
    return {
      rule: 'TIMELINE_AFTER_REGISTRY',
      message: `Esta acompanhante precisa terminar até ${formatHour(
        localMinutes(t.registryStartsAt, timeZone),
      )}, quando começa "${t.registryLabel}" da noiva ${t.brideLabel}.`,
    };
  }
  for (const w of t.windows) {
    if (w.professionalId === null || w.professionalId !== a.professionalId) continue;
    if (
      a.startsAt.getTime() < w.endsAt.getTime() &&
      a.endsAt.getTime() > w.startsAt.getTime()
    ) {
      return {
        rule: 'TIMELINE_PROFESSIONAL_WITH_BRIDE',
        message: `Esta profissional está com a noiva ${t.brideLabel} das ${formatHour(
          localMinutes(w.startsAt, timeZone),
        )} às ${formatHour(localMinutes(w.endsAt, timeZone))} (${
          w.kind === 'make' ? 'make' : 'penteado'
        }).`,
      };
    }
  }
  return null;
}

/** Forçar horário fora do cronograma: permissão efetiva (papel + ajustes) do ator. */
export function canOverrideTimeline(permissions: ReadonlySet<string>): boolean {
  return permissions.has(PERMISSIONS.BRIDAL_SCHEDULE_OVERRIDE);
}

type TimelineRow = {
  id: string;
  groupId: string;
  brideLabel: string;
  registryStartsAt: Date;
  registryLabel: string;
  makeProfessionalId: string | null;
  hairProfessionalId: string | null;
  makeStartsAt: Date | null;
  makeEndsAt: Date | null;
  hairStartsAt: Date | null;
  hairEndsAt: Date | null;
};

function toLite(r: TimelineRow): ConfirmedTimelineLite {
  const windows: ConfirmedTimelineLite['windows'] = [];
  if (r.makeStartsAt && r.makeEndsAt) {
    windows.push({
      kind: 'make',
      professionalId: r.makeProfessionalId,
      startsAt: r.makeStartsAt,
      endsAt: r.makeEndsAt,
    });
  }
  if (r.hairStartsAt && r.hairEndsAt) {
    windows.push({
      kind: 'hair',
      professionalId: r.hairProfessionalId,
      startsAt: r.hairStartsAt,
      endsAt: r.hairEndsAt,
    });
  }
  return {
    id: r.id,
    groupId: r.groupId,
    brideLabel: r.brideLabel,
    registryStartsAt: r.registryStartsAt,
    registryLabel: r.registryLabel,
    windows,
  };
}

/** Cronogramas confirmados de grupos ativos em que a cliente é acompanhante, no dia local do instante. */
export async function findConfirmedTimelinesForCompanionTx(
  tx: TenantPrismaClient,
  clientId: string,
  startsAt: Date,
): Promise<ConfirmedTimelineLite[]> {
  const tz = await orgTimezone(tx);
  const day = localDate(startsAt, tz);
  const rows = await tx.bridalTimeline.findMany({
    where: {
      group: {
        status: 'active',
        eventDate: new Date(`${day}T00:00:00Z`),
        members: { some: { clientId, role: 'companion' } },
      },
    },
  });
  return rows.map(toLite);
}

export async function assertTimelineRulesTx(
  tx: TenantPrismaClient,
  a: {
    clientId: string;
    professionalId: string;
    startsAt: Date;
    endsAt: Date;
    purpose?: string | null;
    actorMemberId: string;
    override?: TimelineOverrideInput | null;
  },
): Promise<{
  overridden: null | { rule: CompanionRule; groupId: string; timelineId: string };
}> {
  if (a.purpose === 'trial') return { overridden: null };
  const timelines = await findConfirmedTimelinesForCompanionTx(tx, a.clientId, a.startsAt);
  if (timelines.length === 0) return { overridden: null };
  const tz = await orgTimezone(tx);
  for (const t of timelines) {
    const violation = evaluateCompanionRules(t, a, tz);
    if (!violation) continue;
    if (!a.override) {
      throw new SchedulingError(violation.rule, violation.message, 'startsAt');
    }
    if (a.override.reason.trim().length < 3) {
      throw new SchedulingError(
        'OVERRIDE_REASON_REQUIRED',
        'Informe o motivo para forçar o horário (mínimo 3 caracteres).',
        'timelineOverride',
      );
    }
    const actor = await tx.member.findFirst({
      where: { id: a.actorMemberId },
      select: {
        role: { select: { name: true, permissions: { select: { permission: true } } } },
        accessOverrides: { select: { itemId: true, enabled: true } },
      },
    });
    const effective = actor?.role
      ? resolveAccess({
          roleName: actor.role.name,
          rolePermissions: actor.role.permissions.map((p) => p.permission),
          overrides: actor.accessOverrides,
        }).permissions
      : new Set<string>();
    if (!canOverrideTimeline(effective)) {
      throw new SchedulingError(
        'OVERRIDE_FORBIDDEN',
        'Só Gerente ou Administrador pode forçar um horário fora do cronograma da noiva.',
        'timelineOverride',
      );
    }
    return { overridden: { rule: violation.rule, groupId: t.groupId, timelineId: t.id } };
  }
  return { overridden: null };
}

/** Grava a auditoria do override; chamar DEPOIS de criar/mover (entity_id é NOT NULL). */
export async function recordTimelineOverrideTx(
  tx: TenantPrismaClient,
  orgId: string,
  actorMemberId: string,
  appointmentId: string,
  reason: string,
  o: { rule: CompanionRule; groupId: string; timelineId: string },
): Promise<void> {
  await recordAudit(tx, {
    orgId,
    actorMemberId,
    action: 'bridal.timeline.override',
    entityType: 'appointment',
    entityId: appointmentId,
    reason: reason.trim(),
    metadata: { rule: o.rule, groupId: o.groupId, timelineId: o.timelineId },
  });
}

/** D-06: agendamento da noiva vindo do cronograma confirmado não se move pela agenda (sem override). */
export async function assertNotTimelineLinkedTx(
  tx: TenantPrismaClient,
  appointmentId: string,
): Promise<void> {
  const linked = await tx.bridalTimeline.findFirst({
    where: {
      OR: [{ makeAppointmentId: appointmentId }, { hairAppointmentId: appointmentId }],
    },
    select: { id: true },
  });
  if (linked) {
    throw new SchedulingError(
      'TIMELINE_LINKED_APPOINTMENT',
      'Este horário da noiva vem do Cronograma do dia. Para mudar, gere uma nova simulação no grupo e confirme.',
      'id',
    );
  }
}

export interface TimelineCompanionIssue {
  appointmentId: string;
  clientName: string;
  professionalName: string;
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
  rule: CompanionRule;
  message: string;
}

/** Acompanhantes já agendadas que violam o cronograma do grupo (D-04): só lista, não move nada. */
export async function findCompanionIssuesTx(
  tx: TenantPrismaClient,
  groupId: string,
): Promise<TimelineCompanionIssue[]> {
  const timeline = await tx.bridalTimeline.findFirst({ where: { groupId } });
  if (!timeline) return [];
  const group = await tx.bridalGroup.findFirst({
    where: { id: groupId },
    select: {
      eventDate: true,
      members: { where: { role: 'companion' }, select: { clientId: true } },
    },
  });
  if (!group?.eventDate) return [];
  const clientIds = group.members.map((m) => m.clientId);
  if (clientIds.length === 0) return [];

  const eventDay = group.eventDate.toISOString().slice(0, 10);
  const win = await tx.$queryRaw<{ day_start: Date; day_end: Date }[]>`
    SELECT (${eventDay}::date + time '00:00') AT TIME ZONE o.timezone AS day_start,
           (${eventDay}::date + time '00:00' + interval '1 day') AT TIME ZONE o.timezone AS day_end
    FROM organizations o LIMIT 1`;
  if (!win[0]) return [];

  const lite = toLite(timeline);
  const tz = await orgTimezone(tx);
  const excluded = [timeline.makeAppointmentId, timeline.hairAppointmentId].filter(
    (x): x is string => !!x,
  );
  const rows = await tx.appointment.findMany({
    where: {
      clientId: { in: clientIds },
      status: { in: [...BLOCKING_STATUSES] },
      startsAt: { gte: win[0].day_start, lt: win[0].day_end },
      OR: [{ purpose: null }, { purpose: 'event' }],
      ...(excluded.length > 0 ? { id: { notIn: excluded } } : {}),
    },
    include: {
      client: { select: { fullName: true } },
      professional: { select: { displayName: true } },
      service: { select: { name: true } },
    },
    orderBy: { startsAt: 'asc' },
  });

  const issues: TimelineCompanionIssue[] = [];
  for (const r of rows) {
    const v = evaluateCompanionRules(
      lite,
      { professionalId: r.professionalId, startsAt: r.startsAt, endsAt: r.endsAt },
      tz,
    );
    if (!v) continue;
    issues.push({
      appointmentId: r.id,
      clientName: r.client.fullName,
      professionalName: r.professional.displayName ?? '',
      serviceName: r.service.name,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      rule: v.rule,
      message: v.message,
    });
  }
  return issues;
}
