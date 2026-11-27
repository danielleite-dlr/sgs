import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { MOVABLE_STATUSES } from '../../appointments/appointment-status';
import { moveAppointmentTx } from '../../appointments/appointment-move';
import { acquireScheduleLocks, mapSchedulingError } from '../../appointments/scheduling-guard';
import { recordAudit } from '../../common/audit-log';
import {
  BRIDAL_SCHEDULE_TX_OPTIONS,
  createBridalScheduleTx,
  rebuildTravelBlocksTx,
} from '../bridal-schedule';
import { syncContractCoverageTx } from '../bridal-coverage';
import { TenantContextService } from '../../database/tenant-context.service';
import { PushEventsService } from '../../push/push-events.service';
import type { TenantPrismaClient } from '../../database/types';
import {
  ASSISTANT_NOT_SCHEDULABLE_CODE,
  NOT_ASSISTANT_ROLE_WHERE,
  assistantNotSchedulableMessage,
  isAssistantRole,
} from '../../identity/assistant-role';
import { professionalServesCategory } from '../../identity/member-categories';
import { loadRankingDataTx } from '../../scheduling/professional-ranking-data';
import { pickBest, type RankCandidate } from '../../scheduling/professional-ranking';
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
  /** "HH:MM" de "Acompanhantes prontas até"; undefined = mantém; ''/null = igual ao make-off (11 D-14) */
  companionsReadyTime?: string | null;
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
  /** true = profissional sugerida pelo sistema (11 D-06) */
  suggested: boolean;
  isFixed: boolean | null;
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
  /** limites do dia do evento no fuso do salão (usados na adoção) */
  eventDayStart: Date;
  eventDayEnd: Date;
  /** "Acompanhantes prontas até" vindo do input já convertido (undefined = não veio) */
  companionsReadyBy: Date | null | undefined;
  /** grupo de debutante: mensagens de tela dizem "noiva/debutante" */
  isDebutante: boolean;
}

const COMPANIONS_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

async function loadProfessional(
  tx: TenantPrismaClient,
  id: string | null | undefined,
): Promise<{
  id: string;
  displayName: string;
  servesBridal: boolean;
  isFixed: boolean;
} | null> {
  if (!id) return null;
  const found = await tx.member.findFirst({
    where: { id, status: 'active', deletedAt: null, isProfessional: true },
    select: {
      id: true,
      displayName: true,
      servesBridal: true,
      isFixed: true,
      role: { select: { name: true } },
    },
  });
  if (!found) return null;
  const { role, ...professional } = found;
  if (isAssistantRole(role?.name)) {
    throw new BridalError(
      ASSISTANT_NOT_SCHEDULABLE_CODE,
      assistantNotSchedulableMessage(professional.displayName),
      'professionalId',
    );
  }
  return professional;
}

/** Cálculo do cronograma no servidor (compartilhado entre simulação e confirmação). Lança BridalError. */
export async function buildTimelineTx(
  tx: TenantPrismaClient,
  _orgId: string,
  input: BridalTimelineInput,
  opts: { autoSuggest?: boolean } = {},
): Promise<BuiltTimeline> {
  const group = await tx.bridalGroup.findFirst({
    where: { id: input.groupId },
    include: {
      members: { include: { client: { select: { fullName: true } } } },
    },
  });
  if (!group) throw new BridalError('NOT_FOUND', 'Grupo não encontrado.', 'groupId');
  const isDebutante = group.eventKind === 'debutante';
  const principal = isDebutante ? 'debutante' : 'noiva';
  if (group.status !== 'active') {
    throw new BridalError('GROUP_NOT_ACTIVE', 'O grupo não está ativo.', 'groupId');
  }
  const bride = group.members.find((m) => m.role === 'bride');
  if (!bride)
    throw new BridalError('NO_BRIDE', `O grupo não tem ${principal} cadastrada.`, 'groupId');
  if (!group.eventDate) {
    throw new BridalError('NO_EVENT_DATE', 'O grupo não tem data do evento.', 'groupId');
  }
  const eventDay = group.eventDate.toISOString().slice(0, 10);

  const pkg = await tx.package.findFirst({
    where: { id: input.packageId, deletedAt: null },
  });
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

  const compute = (makeName: string | null, hairName: string | null) =>
    computeTimeline({
      packageName: pkg.name,
      brideLabel,
      eventDateDdMm: formatDdMm(eventDay),
      departureMinutes,
      steps,
      makeProfessionalName: makeName,
      hairProfessionalName: hairName,
    });
  let result: TimelineResult;
  try {
    result = compute(
      make ? firstName(make.displayName) : null,
      hair ? firstName(hair.displayName) : null,
    );
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

  const readyTime = input.companionsReadyTime?.trim() || null;
  if (readyTime && !COMPANIONS_TIME_RE.test(readyTime)) {
    throw new BridalError(
      'INVALID_COMPANIONS_READY_TIME',
      'Horário "acompanhantes prontas até" inválido.',
      'companionsReadyTime',
    );
  }
  const dep = await tx.$queryRaw<
    {
      d: Date;
      day_start: Date;
      day_end: Date;
      tz: string;
      ready: Date | null;
    }[]
  >`
    SELECT ((${eventDay}::date + ${input.departureTime}::time) AT TIME ZONE o.timezone) AS d,
           o.timezone AS tz,
           (CASE WHEN ${readyTime}::text IS NULL THEN NULL
                 ELSE (${eventDay}::date + ${readyTime}::text::time) AT TIME ZONE o.timezone END) AS ready,
           ((${eventDay}::date + time '00:00') AT TIME ZONE o.timezone) AS day_start,
           ((${eventDay}::date + time '00:00' + interval '1 day') AT TIME ZONE o.timezone) AS day_end
    FROM organizations o LIMIT 1`;
  if (!dep[0]) throw new BridalError('NOT_FOUND', 'Organização não encontrada.');
  const departureAt = dep[0].d;
  const orgTz = dep[0].tz;
  // undefined = não veio (mantém); null = limpar; Date = novo limite
  const companionsReadyBy: Date | null | undefined =
    input.companionsReadyTime === undefined ? undefined : (dep[0].ready ?? null);
  const toInstant = (m: number) => new Date(departureAt.getTime() - (departureMinutes - m) * 60000);

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
      suggested: false,
      isFixed: pro ? pro.isFixed : null,
    };
  });

  const own = new Set<string>();
  const current = await tx.bridalTimeline.findFirst({
    where: { groupId: group.id },
  });
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

  // Pré-sugestão (11 D-06, revoga 04.2 D-03): só na simulação e só onde o studio não escolheu.
  let makeId = make?.id ?? null;
  let hairId = hair?.id ?? null;
  const extraWarnings: TimelineResult['warnings'] = [];
  if (opts.autoSuggest) {
    const toSuggest = slots.filter(
      (s) =>
        s.serviceId &&
        !s.professionalId &&
        (s.kind === 'make' ? !input.makeProfessionalId : !input.hairProfessionalId),
    );
    if (toSuggest.length > 0) {
      const marked = await tx.member.findMany({
        where: {
          isProfessional: true,
          status: 'active',
          deletedAt: null,
          servesBridal: true,
          ...NOT_ASSISTANT_ROLE_WHERE,
          // a assistente do próprio grupo nunca é sugerida (Pitfall 9)
          ...(group.assistantMemberId ? { id: { not: group.assistantMemberId } } : {}),
        },
        select: {
          id: true,
          displayName: true,
          isFixed: true,
          servesBridal: true,
        },
      });
      const ranking = await loadRankingDataTx(tx, {
        professionalIds: marked.map((m) => m.id),
        dayStart: dep[0].day_start,
        dayEnd: dep[0].day_end,
        excludeAppointmentIds: ownAppointmentIds,
      });
      const hhmm = (d: Date) =>
        new Intl.DateTimeFormat('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: orgTz,
        }).format(d);
      let warnedNoBridal = false;
      // make primeiro, depois penteado: os minutos da escolhida no make contam no penteado
      for (const s of [...toSuggest].sort((a) => (a.kind === 'make' ? -1 : 1))) {
        const svc = svcById.get(s.serviceId!);
        if (!svc) continue;
        const eligible: typeof marked = [];
        for (const m of marked) {
          if (await professionalServesCategory(tx, m.id, svc.categoryId)) eligible.push(m);
        }
        if (eligible.length === 0) {
          if (!warnedNoBridal) {
            warnedNoBridal = true;
            extraWarnings.push({
              code: 'NO_BRIDAL_PROFESSIONAL',
              message:
                'Nenhuma profissional está marcada como "Atende noiva/debutante". Marque em Profissionais para o sistema sugerir make e penteado.',
            });
          }
          continue;
        }
        const cands: (RankCandidate & { displayName: string })[] = [];
        for (const m of eligible) {
          const busy = await findSlotConflictsTx(tx, {
            professionalId: m.id,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            ignoreAppointmentIds: ownAppointmentIds,
            ignoreGroupId: group.id,
          });
          cands.push({
            id: m.id,
            displayName: m.displayName,
            isFixed: m.isFixed,
            servesBridal: m.servesBridal,
            dayMinutes: ranking.dayMinutes.get(m.id) ?? 0,
            lastAssignedAt: ranking.lastAssignedAt.get(m.id) ?? null,
            free: busy.length === 0,
          });
        }
        const best = pickBest(cands, { bridal: true });
        if (!best) {
          extraWarnings.push({
            code: 'NO_FREE_PROFESSIONAL',
            message: `Nenhuma profissional que atende noiva/debutante está livre para ${
              s.kind === 'make' ? 'a make' : 'o penteado'
            } das ${hhmm(s.startsAt)}–${hhmm(s.endsAt)}.`,
          });
          continue;
        }
        s.professionalId = best.id;
        s.professionalName = firstName(best.displayName);
        s.suggested = true;
        s.isFixed = best.isFixed;
        if (s.kind === 'make') makeId = best.id;
        else hairId = best.id;
        const spent = Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60000);
        const mine = ranking.dayMinutes.get(best.id) ?? 0;
        ranking.dayMinutes.set(best.id, mine + spent);
      }
      const nameOf = (kind: 'make' | 'hair') => {
        const sl = slots.find((x) => x.kind === kind);
        return sl?.professionalName ?? null;
      };
      result = compute(nameOf('make'), nameOf('hair'));
    }
  }
  if (extraWarnings.length > 0) {
    result = { ...result, warnings: [...result.warnings, ...extraWarnings] };
  }

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
  if (!makeId) missing.push('Escolha a profissional de make.');
  if (!hairId) missing.push('Escolha a profissional de penteado.');
  // D-19: a escolhida pelo studio precisa atender noiva/debutante
  for (const p of [make, hair]) {
    if (p && !p.servesBridal) {
      missing.push(
        `${firstName(p.displayName)} não atende noiva/debutante. Marque em Profissionais ou escolha outra.`,
      );
    }
  }
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
    makeProfessionalId: makeId,
    hairProfessionalId: hairId,
    result,
    registryStartsAt,
    registryLabel: result.registryName,
    slots,
    conflicts,
    missing,
    canConfirm: missing.length === 0 && conflicts.length === 0,
    ownAppointmentIds,
    eventDayStart: dep[0].day_start,
    eventDayEnd: dep[0].day_end,
    companionsReadyBy,
    isDebutante,
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

async function loadTimelineViewTx(tx: TenantPrismaClient, groupId: string) {
  const t = await tx.bridalTimeline.findFirst({ where: { groupId } });
  if (!t) return null;
  const by = t.confirmedBy
    ? await tx.member.findFirst({
        where: { id: t.confirmedBy },
        select: { displayName: true },
      })
    : null;
  const companionIssues: TimelineCompanionIssue[] = await findCompanionIssuesTx(tx, groupId);
  const grp = await tx.bridalGroup.findFirst({
    where: { id: groupId },
    select: { companionsReadyBy: true },
  });
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
    companionsReadyBy: grp?.companionsReadyBy ?? null,
  };
}

/** Lançado dentro da transação para desfazer tudo quando há profissional ocupada. */
class TimelineConflictError extends Error {
  constructor(public readonly conflicts: BuiltTimelineConflict[]) {
    super('TIMELINE_CONFLICT');
  }
}

export interface BridalTimelineConfirmPayload {
  timeline: Awaited<ReturnType<typeof loadTimelineViewTx>>;
  conflicts: BuiltTimelineConflict[];
  errors: BridalUserError[];
}

const overlaps = (a0: Date, a1: Date, b0: Date, b1: Date) => a0 < b1 && b0 < a1;

@Injectable()
export class BridalTimelineService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly push: PushEventsService,
  ) {}

  async preview(orgId: string, input: BridalTimelineInput): Promise<BridalTimelinePreviewPayload> {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const built = await buildTimelineTx(tx, orgId, input, {
          autoSuggest: true,
        });
        const current =
          built.companionsReadyBy === undefined
            ? (
                await tx.bridalGroup.findFirst({
                  where: { id: built.group.id },
                  select: { companionsReadyBy: true },
                })
              )?.companionsReadyBy
            : built.companionsReadyBy;
        return {
          preview: {
            ...previewView(built),
            companionsReadyBy: current ?? null,
          },
          errors: [],
        };
      });
    } catch (e) {
      return { preview: null, errors: toErrors(e) };
    }
  }

  async get(orgId: string, groupId: string) {
    return this.tenant.runWithTenant(orgId, (tx) => loadTimelineViewTx(tx, groupId));
  }

  /** Ok do studio (D-02, D-06): recalcula no servidor e cria/move/adota make e penteado da noiva. */
  async confirm(
    orgId: string,
    memberId: string,
    input: BridalTimelineInput,
  ): Promise<BridalTimelineConfirmPayload> {
    try {
      // Só os atendimentos CRIADOS avisam; mover/adotar (reconfirmar) é remarcação (D-11).
      const createdIds: string[] = [];
      const result = await this.tenant.runWithTenant(
        orgId,
        (tx) => {
          createdIds.length = 0; // a transação pode ser repetida
          return confirmTimelineTx(tx, orgId, memberId, input, createdIds);
        },
        BRIDAL_SCHEDULE_TX_OPTIONS,
      );
      if (result.errors.length === 0 && createdIds.length > 0) {
        try {
          this.push.enqueue({
            kind: 'bridal.scheduled',
            orgId,
            actorMemberId: memberId,
            appointmentIds: [...createdIds],
          });
        } catch {
          // PushEventsService já não lança; cinto de segurança.
        }
      }
      return result;
    } catch (e) {
      if (e instanceof TimelineConflictError) {
        return {
          timeline: null,
          conflicts: e.conflicts,
          errors: [
            {
              code: 'TIMELINE_CONFLICT',
              message: 'Há profissional ocupada no horário da noiva.',
              field: null,
            },
          ],
        };
      }
      const m = mapBridalError(e) ?? mapSchedulingError(e);
      if (!m) throw e;
      return { timeline: null, conflicts: [], errors: [m] };
    }
  }
}

async function confirmTimelineTx(
  tx: TenantPrismaClient,
  orgId: string,
  memberId: string,
  input: BridalTimelineInput,
  createdOut: string[] = [],
): Promise<BridalTimelineConfirmPayload> {
  const b = await buildTimelineTx(tx, orgId, input);
  if (b.missing.length > 0) {
    throw new BridalError('TIMELINE_INCOMPLETE', b.missing.join(' '), null);
  }
  if (b.conflicts.length > 0) throw new TimelineConflictError(b.conflicts);

  const groupId = b.group.id;
  const existing = await tx.bridalTimeline.findFirst({ where: { groupId } });
  if (existing) {
    await tx.$queryRaw`SELECT id FROM bridal_timelines WHERE group_id = ${groupId}::uuid FOR UPDATE`;
  }

  // Alvos: agendamento ligado (ainda movível), adoção (D-06) ou criação.
  const movable = MOVABLE_STATUSES as readonly string[];
  const linkedIds = [existing?.makeAppointmentId, existing?.hairAppointmentId].filter(
    (x): x is string => !!x,
  );
  const linked = linkedIds.length
    ? await tx.appointment.findMany({
        where: { id: { in: linkedIds } },
        select: {
          id: true,
          professionalId: true,
          startsAt: true,
          endsAt: true,
          status: true,
        },
      })
    : [];
  const linkedById = new Map(linked.map((a) => [a.id, a]));

  interface Target {
    slot: BuiltTimelineSlot;
    id: string | null;
    adopted: boolean;
    cur: { professionalId: string; startsAt: Date; endsAt: Date } | null;
  }
  const targets: Target[] = [];
  for (const slot of b.slots) {
    const linkedId =
      slot.kind === 'make' ? existing?.makeAppointmentId : existing?.hairAppointmentId;
    const lk = linkedId ? linkedById.get(linkedId) : undefined;
    if (lk && movable.includes(lk.status)) {
      targets.push({ slot, id: lk.id, adopted: false, cur: lk });
      continue;
    }
    const adoptable = await findAdoptableBrideAppointmentsTx(tx, {
      groupId,
      brideClientId: b.group.brideClientId,
      serviceId: slot.serviceId!,
      eventDayStart: b.eventDayStart,
      eventDayEnd: b.eventDayEnd,
    });
    if (adoptable.length > 1) {
      throw new BridalError(
        'TIMELINE_AMBIGUOUS_APPOINTMENTS',
        `${b.isDebutante ? 'A debutante' : 'A noiva'} tem ${adoptable.length} agendamentos de ${slot.serviceName} neste evento; cancele os que sobram antes de confirmar.`,
        null,
      );
    }
    const one = adoptable[0];
    targets.push(
      one
        ? { slot, id: one.id, adopted: true, cur: one }
        : { slot, id: null, adopted: false, cur: null },
    );
  }

  await acquireScheduleLocks(tx, orgId, [
    b.makeProfessionalId!,
    b.hairProfessionalId!,
    ...targets.filter((t) => t.cur).map((t) => t.cur!.professionalId),
  ]);
  // Deslocamentos do próprio grupo seriam vistos como TIME_BLOCKED; são reconstruídos adiante.
  await tx.timeBlock.deleteMany({
    where: { bridalGroupId: groupId, kind: 'deslocamento' },
  });

  // Ordem dos movimentos: make antes do penteado, salvo cruzamento com o intervalo atual do outro.
  const toMove = targets.filter((t) => t.id);
  if (toMove.length === 2) {
    const [first, second] = toMove as [Target, Target];
    const blocks = (a: Target, other: Target) =>
      other.cur != null &&
      other.cur.professionalId === a.slot.professionalId &&
      overlaps(a.slot.startsAt, a.slot.endsAt, other.cur.startsAt, other.cur.endsAt);
    if (blocks(first, second)) {
      if (blocks(second, first)) {
        throw new BridalError(
          'TIMELINE_REORDER_CONFLICT',
          'Não foi possível reorganizar make e penteado; cancele um dos agendamentos da noiva e confirme de novo.',
          null,
        );
      }
      toMove.reverse();
    }
  }
  for (const t of toMove) {
    if (t.adopted) {
      await tx.appointment.update({
        where: { id: t.id! },
        data: { bridalGroupId: groupId, purpose: 'event' },
      });
    }
    await moveAppointmentTx(
      tx,
      orgId,
      memberId,
      {
        id: t.id!,
        professionalId: t.slot.professionalId!,
        startsAt: t.slot.startsAt,
        endsAt: t.slot.endsAt,
      },
      { fromTimeline: true },
    );
  }

  const toCreate = targets.filter((t) => !t.id);
  const created: string[] = [];
  const idByKind = new Map<string, string>(
    targets.filter((t) => t.id).map((t) => [t.slot.kind, t.id!]),
  );
  if (toCreate.length > 0) {
    const res = await createBridalScheduleTx(tx, orgId, memberId, {
      groupId,
      items: toCreate.map((t) => ({
        groupMemberId: b.group.brideMemberId,
        serviceId: t.slot.serviceId!,
        professionalId: t.slot.professionalId!,
        startsAt: t.slot.startsAt,
        endsAt: t.slot.endsAt,
        purpose: 'event',
      })),
    });
    const rows = await tx.appointment.findMany({
      where: { id: { in: res.appointmentIds } },
      select: { id: true, serviceId: true },
    });
    for (const t of toCreate) {
      const r = rows.find((x) => x.serviceId === t.slot.serviceId);
      if (r) {
        idByKind.set(t.slot.kind, r.id);
        created.push(r.id);
      }
    }
  }

  createdOut.push(...created);
  await syncContractCoverageTx(tx, orgId, groupId);
  await rebuildTravelBlocksTx(tx, orgId, memberId, groupId);

  const make = b.slots.find((s) => s.kind === 'make')!;
  const hair = b.slots.find((s) => s.kind === 'hair')!;
  const version = existing ? existing.version + 1 : 1;
  const data = {
    packageId: b.packageId,
    packageName: b.packageName,
    departureTime: b.departureTime,
    departureAt: b.departureAt,
    registryStartsAt: b.registryStartsAt!,
    registryLabel: b.registryLabel ?? '',
    brideLabel: b.brideLabel,
    makeProfessionalId: make.professionalId,
    hairProfessionalId: hair.professionalId,
    makeServiceId: make.serviceId,
    hairServiceId: hair.serviceId,
    makeStartsAt: make.startsAt,
    makeEndsAt: make.endsAt,
    hairStartsAt: hair.startsAt,
    hairEndsAt: hair.endsAt,
    makeAppointmentId: idByKind.get('make') ?? null,
    hairAppointmentId: idByKind.get('hair') ?? null,
    rows: b.result.rows as unknown as Prisma.InputJsonValue,
    text: b.result.text,
    warnings: b.result.warnings as unknown as Prisma.InputJsonValue,
    confirmedBy: memberId,
    confirmedAt: new Date(),
    version,
  };
  await tx.bridalTimeline.upsert({
    where: { groupId },
    create: { organizationId: orgId, groupId, ...data },
    update: data,
  });

  await tx.bridalGroup.update({
    where: { id: groupId },
    data: {
      readyBy: b.departureAt,
      ...(b.companionsReadyBy !== undefined ? { companionsReadyBy: b.companionsReadyBy } : {}),
    },
  });

  await recordAudit(tx, {
    orgId,
    actorMemberId: memberId,
    action: existing ? 'bridal.timeline.reconfirm' : 'bridal.timeline.confirm',
    entityType: 'bridal_group',
    entityId: groupId,
    metadata: {
      version,
      packageId: b.packageId,
      departureTime: b.departureTime,
      makeAppointmentId: idByKind.get('make') ?? null,
      hairAppointmentId: idByKind.get('hair') ?? null,
      companionsReadyBy:
        b.companionsReadyBy === undefined
          ? 'mantido'
          : (b.companionsReadyBy?.toISOString() ?? null),
      adopted: targets.filter((t) => t.adopted).map((t) => t.id),
      created,
    },
  });

  return {
    timeline: await loadTimelineViewTx(tx, groupId),
    conflicts: [],
    errors: [],
  };
}
