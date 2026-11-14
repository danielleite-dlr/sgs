import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import type { TenantPrismaClient } from '../../database/types';
import { professionalServesCategory } from '../../identity/member-categories';
import { BridalError, mapBridalError, type BridalUserError } from '../bridal-errors';
import { loadPackageTimelineTx } from '../../catalog/packages/package-timeline';
import {
  brideWindows,
  computeTimeline,
  defaultBrideLabel,
  formatDdMm,
  parseDepartureTime,
  TimelineDomainError,
  type TimelineResult,
} from './timeline-domain';
import { findAdoptableBrideAppointmentsTx, findSlotConflictsTx } from './timeline-conflicts';
import { findCompanionIssuesTx, type TimelineCompanionIssue } from './timeline-guard';

export interface BridalTimelineInput {
  groupId: string;
  packageId: string;
  departureTime: string;
  brideLabel?: string | null;
  makeProfessionalId?: string | null;
  hairProfessionalId?: string | null;
}

export interface BuiltTimelineSlot {
  kind: 'make' | 'hair';
  stepName: string;
  serviceId: string | null;
  serviceName: string | null;
  professionalId: string | null;
  professionalName: string | null;
  startsAt: Date;
  endsAt: Date;
}

export interface BuiltTimelineConflict {
  stepName: string;
  professionalName: string;
  startsAt: Date;
  endsAt: Date;
  blockedBy: string;
}

export interface BuiltTimeline {
  group: {
    id: string;
    eventDate: string;
    brideMemberId: string;
    brideClientId: string;
    brideFullName: string;
  };
  packageId: string;
  packageName: string;
  departureTime: string;
  departureAt: Date;
  brideLabel: string;
  makeProfessionalId: string | null;
  hairProfessionalId: string | null;
  result: TimelineResult;
  registryStartsAt: Date | null;
  registryLabel: string | null;
  slots: BuiltTimelineSlot[];
  conflicts: BuiltTimelineConflict[];
  missing: string[];
  canConfirm: boolean;
  /** agendamentos da noiva já ligados ao cronograma atual ou adotáveis (ignorados na checagem de conflito) */
  ownAppointmentIds: string[];
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

async function loadProfessional(
  tx: TenantPrismaClient,
  id: string | null | undefined,
): Promise<{ id: string; displayName: string } | null> {
  if (!id) return null;
  return tx.member.findFirst({
    where: { id, status: 'active', deletedAt: null, isProfessional: true },
    select: { id: true, displayName: true },
  });
}

/** Cálculo do cronograma no servidor (compartilhado entre simulação e confirmação). Lança BridalError. */
export async function buildTimelineTx(
  tx: TenantPrismaClient,
  _orgId: string,
  input: BridalTimelineInput,
): Promise<BuiltTimeline> {
  const group = await tx.bridalGroup.findFirst({
    where: { id: input.groupId },
    include: {
      members: { include: { client: { select: { fullName: true } } } },
    },
  });
  if (!group) throw new BridalError('NOT_FOUND', 'Grupo não encontrado.', 'groupId');
  if (group.status !== 'active') {
    throw new BridalError('GROUP_NOT_ACTIVE', 'O grupo não está ativo.', 'groupId');
  }
  const bride = group.members.find((m) => m.role === 'bride');
  if (!bride) throw new BridalError('NO_BRIDE', 'O grupo não tem noiva cadastrada.', 'groupId');
  if (!group.eventDate) {
    throw new BridalError('NO_EVENT_DATE', 'O grupo não tem data do evento.', 'groupId');
  }
  const eventDay = group.eventDate.toISOString().slice(0, 10);

  const pkg = await tx.package.findFirst({ where: { id: input.packageId, deletedAt: null } });
  if (!pkg) throw new BridalError('NOT_FOUND', 'Pacote não encontrado.', 'packageId');
  const steps = await loadPackageTimelineTx(tx, pkg.id);

  let departureMinutes: number;
  try {
    departureMinutes = parseDepartureTime(input.departureTime);
  } catch (e) {
    if (e instanceof TimelineDomainError) {
      throw new BridalError(e.code, e.message, 'departureTime');
    }
    throw e;
  }
  const brideLabel = input.brideLabel?.trim() || defaultBrideLabel(bride.client.fullName);

  const missing: string[] = [];
  const make = await loadProfessional(tx, input.makeProfessionalId);
  const hair = await loadProfessional(tx, input.hairProfessionalId);
  if (input.makeProfessionalId && !make) {
    missing.push('A profissional escolhida para make não está ativa.');
  }
  if (input.hairProfessionalId && !hair) {
    missing.push('A profissional escolhida para penteado não está ativa.');
  }

  let result: TimelineResult;
  try {
    result = computeTimeline({
      packageName: pkg.name,
      brideLabel,
      eventDateDdMm: formatDdMm(eventDay),
      departureMinutes,
      steps,
      makeProfessionalName: make ? firstName(make.displayName) : null,
      hairProfessionalName: hair ? firstName(hair.displayName) : null,
    });
  } catch (e) {
    if (e instanceof TimelineDomainError) {
      throw new BridalError(
        e.code,
        e.message,
        e.code === 'INVALID_DEPARTURE' ? 'departureTime' : 'packageId',
      );
    }
    throw e;
  }

  const dep = await tx.$queryRaw<{ d: Date; day_start: Date; day_end: Date }[]>`
    SELECT ((${eventDay}::date + ${input.departureTime}::time) AT TIME ZONE o.timezone) AS d,
           ((${eventDay}::date + time '00:00') AT TIME ZONE o.timezone) AS day_start,
           ((${eventDay}::date + time '00:00' + interval '1 day') AT TIME ZONE o.timezone) AS day_end
    FROM organizations o LIMIT 1`;
  if (!dep[0]) throw new BridalError('NOT_FOUND', 'Organização não encontrada.');
  const departureAt = dep[0].d;
  const toInstant = (m: number) =>
    new Date(departureAt.getTime() - (departureMinutes - m) * 60000);

  const registryStartsAt =
    result.registryStartMinutes != null ? toInstant(result.registryStartMinutes) : null;

  const windows = brideWindows(result);
  const serviceIds = windows.map((w) => w.serviceId).filter((x): x is string => !!x);
  const services = serviceIds.length
    ? await tx.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, name: true, categoryId: true },
      })
    : [];
  const svcById = new Map(services.map((s) => [s.id, s]));

  const slots: BuiltTimelineSlot[] = windows.map((w) => {
    const row = result.rows.find((r) => r.kind === w.kind && r.minutes === w.startMinutes);
    const pro = w.kind === 'make' ? make : hair;
    return {
      kind: w.kind,
      stepName: row?.name ?? w.kind,
      serviceId: w.serviceId,
      serviceName: w.serviceId ? (svcById.get(w.serviceId)?.name ?? null) : null,
      professionalId: pro?.id ?? null,
      professionalName: pro ? firstName(pro.displayName) : null,
      startsAt: toInstant(w.startMinutes),
      endsAt: toInstant(w.endMinutes),
    };
  });

  const own = new Set<string>();
  const current = await tx.bridalTimeline.findFirst({ where: { groupId: group.id } });
  for (const id of [current?.makeAppointmentId, current?.hairAppointmentId]) {
    if (id) own.add(id);
  }
  for (const s of slots) {
    if (!s.serviceId) continue;
    const adoptable = await findAdoptableBrideAppointmentsTx(tx, {
      groupId: group.id,
      brideClientId: bride.clientId,
      serviceId: s.serviceId,
      eventDayStart: dep[0].day_start,
      eventDayEnd: dep[0].day_end,
    });
    for (const a of adoptable) own.add(a.id);
  }
  const ownAppointmentIds = [...own];

  const conflicts: BuiltTimelineConflict[] = [];
  for (const s of slots) {
    if (!s.professionalId) continue;
    const list = await findSlotConflictsTx(tx, {
      professionalId: s.professionalId,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      ignoreAppointmentIds: ownAppointmentIds,
      ignoreGroupId: group.id,
    });
    for (const blockedBy of list) {
      conflicts.push({
        stepName: s.stepName,
        professionalName: s.professionalName ?? '',
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        blockedBy,
      });
    }
  }

  const make1 = slots.find((s) => s.kind === 'make');
  const hair1 = slots.find((s) => s.kind === 'hair');
  if (!make1) missing.push('O pacote não tem etapa de make.');
  if (!hair1) missing.push('O pacote não tem etapa de penteado.');
  if (make1 && !make1.serviceId) {
    missing.push('A etapa de make não está ligada a um serviço do pacote.');
  }
  if (hair1 && !hair1.serviceId) {
    missing.push('A etapa de penteado não está ligada a um serviço do pacote.');
  }
  if (!input.makeProfessionalId) missing.push('Escolha a profissional de make.');
  if (!input.hairProfessionalId) missing.push('Escolha a profissional de penteado.');
  for (const s of slots) {
    if (!s.professionalId || !s.serviceId) continue;
    const svc = svcById.get(s.serviceId);
    if (!svc) continue;
    if (!(await professionalServesCategory(tx, s.professionalId, svc.categoryId))) {
      missing.push(`${s.professionalName} não atende ${svc.name}.`);
    }
  }
  if (registryStartsAt == null) {
    missing.push('O pacote não tem etapa de início do registro (fotos/making of).');
  }

  return {
    group: {
      id: group.id,
      eventDate: eventDay,
      brideMemberId: bride.id,
      brideClientId: bride.clientId,
      brideFullName: bride.client.fullName,
    },
    packageId: pkg.id,
    packageName: pkg.name,
    departureTime: input.departureTime,
    departureAt,
    brideLabel,
    makeProfessionalId: make?.id ?? null,
    hairProfessionalId: hair?.id ?? null,
    result,
    registryStartsAt,
    registryLabel: result.registryName,
    slots,
    conflicts,
    missing,
    canConfirm: missing.length === 0 && conflicts.length === 0,
    ownAppointmentIds,
  };
}

export interface TimelineRowView {
  time: string;
  minutes: number;
  name: string;
  label: string;
  kind: string | null;
  professionalName: string | null;
  isExtra: boolean;
  isRegistry: boolean;
}

const rowView = (r: TimelineRowView): TimelineRowView => ({
  time: r.time,
  minutes: r.minutes,
  name: r.name,
  label: r.label,
  kind: r.kind,
  professionalName: r.professionalName,
  isExtra: r.isExtra,
  isRegistry: r.isRegistry,
});

export function previewView(b: BuiltTimeline) {
  return {
    groupId: b.group.id,
    packageId: b.packageId,
    packageName: b.packageName,
    departureTime: b.departureTime,
    brideLabel: b.brideLabel,
    makeProfessionalId: b.makeProfessionalId,
    hairProfessionalId: b.hairProfessionalId,
    rows: b.result.rows.map(rowView),
    text: b.result.text,
    warnings: b.result.warnings,
    registryStartsAt: b.registryStartsAt,
    brideSlots: b.slots,
    conflicts: b.conflicts,
    missing: b.missing,
    canConfirm: b.canConfirm,
  };
}

export interface BridalTimelinePreviewPayload {
  preview: ReturnType<typeof previewView> | null;
  errors: BridalUserError[];
}

function toErrors(e: unknown): BridalUserError[] {
  const m = mapBridalError(e);
  if (!m) throw e;
  return [m];
}

@Injectable()
export class BridalTimelineService {
  constructor(private readonly tenant: TenantContextService) {}

  async preview(orgId: string, input: BridalTimelineInput): Promise<BridalTimelinePreviewPayload> {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const built = await buildTimelineTx(tx, orgId, input);
        return { preview: previewView(built), errors: [] };
      });
    } catch (e) {
      return { preview: null, errors: toErrors(e) };
    }
  }

  async get(orgId: string, groupId: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const t = await tx.bridalTimeline.findFirst({
        where: { groupId },
      });
      if (!t) return null;
      const by = t.confirmedBy
        ? await tx.member.findFirst({
            where: { id: t.confirmedBy },
            select: { displayName: true },
          })
        : null;
      const companionIssues: TimelineCompanionIssue[] = await findCompanionIssuesTx(tx, groupId);
      return {
        id: t.id,
        groupId: t.groupId,
        packageId: t.packageId,
        packageName: t.packageName,
        departureTime: t.departureTime,
        brideLabel: t.brideLabel,
        makeProfessionalId: t.makeProfessionalId,
        hairProfessionalId: t.hairProfessionalId,
        rows: t.rows,
        text: t.text,
        warnings: t.warnings,
        registryStartsAt: t.registryStartsAt,
        registryLabel: t.registryLabel,
        confirmedAt: t.confirmedAt,
        confirmedByName: by?.displayName ?? null,
        version: t.version,
        companionIssues,
      };
    });
  }

  /** Stub até o 04.2-06. */
  confirm() {
    return {
      timeline: null,
      conflicts: [],
      errors: [{ code: 'NOT_IMPLEMENTED', message: 'Em construção.', field: null }],
    };
  }
}
