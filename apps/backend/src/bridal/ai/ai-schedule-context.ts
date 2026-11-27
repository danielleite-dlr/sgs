import { NOT_ASSISTANT_ROLE_WHERE } from '../../identity/assistant-role';
import { Injectable } from '@nestjs/common';
import { BLOCKING_STATUSES } from '../../appointments/appointment-status';
import { ContractSettingsService } from '../../contracts/contract-settings.service';
import type { TenantPrismaClient } from '../../database/types';
import { professionalServesCategory } from '../../identity/member-categories';
import { compareCandidates, rotationRanks } from '../../scheduling/professional-ranking';
import { loadRankingDataTx } from '../../scheduling/professional-ranking-data';
import { BridalError } from '../bridal-errors';
import type { ScheduleContext } from './ai-schedule.schema';

export const MAX_AI_PERSONS = 12;
export const MAX_AI_SERVICES_PER_PERSON = 10;

export interface AiScheduleBuild {
  ctx: ScheduleContext;
  /** ref (p1..pN) -> dados reais, que NUNCA vão para o prompt. */
  refs: Map<string, { groupMemberId: string; clientName: string; role: 'bride' | 'companion' }>;
  /** id do profissional -> nome real (somente para a UI). */
  profLabels: Map<string, string>;
  serviceNames: Map<string, string>;
}

@Injectable()
export class AiScheduleContextBuilder {
  constructor(private readonly settings: ContractSettingsService) {}

  async build(tx: TenantPrismaClient, orgId: string, groupId: string): Promise<AiScheduleBuild> {
    const group = await tx.bridalGroup.findFirst({ where: { id: groupId } });
    if (!group) throw new BridalError('NOT_FOUND', 'Grupo não encontrado.', 'groupId');
    if (group.status !== 'active') {
      throw new BridalError('GROUP_NOT_ACTIVE', 'O grupo não está ativo.', 'groupId');
    }

    // Cronograma confirmado (fase 4.2): os agendamentos da noiva não bloqueiam a sugestão.
    const timeline = await tx.bridalTimeline.findFirst({
      where: { groupId },
      select: {
        registryStartsAt: true,
        makeAppointmentId: true,
        hairAppointmentId: true,
        makeServiceId: true,
        hairServiceId: true,
      },
    });
    const linkedIds = [timeline?.makeAppointmentId, timeline?.hairAppointmentId].filter(
      Boolean,
    ) as string[];
    const already = await tx.appointment.count({
      where: {
        bridalGroupId: groupId,
        purpose: 'event',
        status: { in: [...BLOCKING_STATUSES] },
        ...(linkedIds.length ? { id: { notIn: linkedIds } } : {}),
      },
    });
    if (already > 0) {
      throw new BridalError(
        'ALREADY_SCHEDULED',
        'O evento já tem agendamentos; cancele-os antes de pedir uma nova sugestão.',
        'groupId',
      );
    }

    const members = await tx.bridalGroupMember.findMany({
      where: { groupId },
      include: {
        client: { select: { fullName: true } },
        services: {
          where: { purpose: 'event' },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (timeline) {
      const done = new Set<string>();
      if (timeline.makeAppointmentId && timeline.makeServiceId) done.add(timeline.makeServiceId);
      if (timeline.hairAppointmentId && timeline.hairServiceId) done.add(timeline.hairServiceId);
      for (const m of members) {
        if (m.role === 'bride') m.services = m.services.filter((s) => !done.has(s.serviceId));
      }
    }
    members.sort((a, b) => {
      if (a.role !== b.role) return a.role === 'bride' ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });
    const withServices = members.filter((m) => m.services.length > 0);
    if (withServices.length === 0) {
      throw new BridalError(
        'NO_PLANNED_SERVICES',
        'Nenhuma pessoa do grupo tem serviços planejados para o evento.',
        'groupId',
      );
    }
    if (
      withServices.length > MAX_AI_PERSONS ||
      withServices.some((m) => m.services.length > MAX_AI_SERVICES_PER_PERSON)
    ) {
      throw new BridalError(
        'CONTEXT_TOO_LARGE',
        `A sugestão por IA aceita até ${MAX_AI_PERSONS} pessoas e ${MAX_AI_SERVICES_PER_PERSON} serviços por pessoa.`,
        'groupId',
      );
    }

    const serviceIds = [
      ...new Set(withServices.flatMap((m) => m.services.map((s) => s.serviceId))),
    ];
    const services = await tx.service.findMany({
      where: { id: { in: serviceIds } },
    });
    const serviceById = new Map(services.map((s) => [s.id, s]));

    const proRows = await tx.member.findMany({
      where: {
        isProfessional: true,
        status: 'active',
        deletedAt: null,
        ...NOT_ASSISTANT_ROLE_WHERE,
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        displayName: true,
        isFixed: true,
        servesBridal: true,
      },
    });
    const eligibleByService = new Map<string, string[]>();
    for (const sid of serviceIds) {
      const cat = serviceById.get(sid)?.categoryId;
      const ok: string[] = [];
      if (cat) {
        for (const p of proRows) {
          if (await professionalServesCategory(tx, p.id, cat)) ok.push(p.id);
        }
      }
      eligibleByService.set(sid, ok);
    }
    // Elegíveis por pessoa: a assistente do grupo não atende (D-19, Pitfall 9) e serviço
    // da noiva/debutante só com quem atende noiva (D-02/D-17).
    const servesBridalById = new Map(proRows.map((p) => [p.id, p.servesBridal]));
    const eligibleFor = (sid: string, role: 'bride' | 'companion'): string[] =>
      (eligibleByService.get(sid) ?? []).filter(
        (id) => id !== group.assistantMemberId && (role !== 'bride' || servesBridalById.get(id)),
      );
    const usedPros = new Set<string>();
    for (const m of withServices) {
      const role = m.role === 'bride' ? 'bride' : 'companion';
      for (const s of m.services) eligibleFor(s.serviceId, role).forEach((id) => usedPros.add(id));
    }
    const prosUnordered = proRows.filter((p) => usedPros.has(p.id));

    const eff = await this.settings.getEffective(tx, orgId);
    const eventDate = group.eventDate.toISOString().slice(0, 10);
    const win = await tx.$queryRaw<{ s: Date; e: Date }[]>`
      SELECT (${eventDate}::date + ${eff.scheduleDayStart}::time) AT TIME ZONE o.timezone AS s,
             (${eventDate}::date + ${eff.scheduleDayEnd}::time) AT TIME ZONE o.timezone AS e
      FROM organizations o LIMIT 1`;
    const dayStart = win[0].s;
    const dayEnd = win[0].e;

    // Ranking do dia do evento (D-10/D-11), ignorando os agendamentos do próprio grupo.
    const groupAppts = await tx.appointment.findMany({
      where: {
        bridalGroupId: groupId,
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { id: true },
    });
    const rank = await loadRankingDataTx(tx, {
      professionalIds: prosUnordered.map((p) => p.id),
      dayStart,
      dayEnd,
      excludeAppointmentIds: groupAppts.map((a) => a.id),
    });
    const rot = rotationRanks(
      prosUnordered.map((p) => ({
        id: p.id,
        lastAssignedAt: rank.lastAssignedAt.get(p.id) ?? null,
      })),
    );
    // A lista vai ao modelo já na ordem de preferência, antes de gerar os rótulos prof_N.
    const rankOf = (p: (typeof prosUnordered)[number]) => ({
      id: p.id,
      isFixed: p.isFixed,
      servesBridal: p.servesBridal,
      free: true,
      dayMinutes: rank.dayMinutes.get(p.id) ?? 0,
      lastAssignedAt: rot.get(p.id) ?? 0,
    });
    const pros = [...prosUnordered].sort((a, b) => compareCandidates(rankOf(a), rankOf(b)));

    const proIds = pros.map((p) => p.id);
    const busy: ScheduleContext['busy'] = [];
    if (proIds.length > 0) {
      const appts = await tx.appointment.findMany({
        where: {
          professionalId: { in: proIds },
          status: { in: [...BLOCKING_STATUSES] },
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
        select: { professionalId: true, startsAt: true, endsAt: true },
      });
      for (const a of appts) {
        busy.push({
          professionalId: a.professionalId,
          startsAt: a.startsAt.toISOString(),
          endsAt: a.endsAt.toISOString(),
        });
      }
      const blocks = await tx.timeBlock.findMany({
        where: {
          OR: [{ professionalId: { in: proIds } }, { professionalId: null }],
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
          NOT: { bridalGroupId: groupId },
        },
        select: { professionalId: true, startsAt: true, endsAt: true },
      });
      for (const b of blocks) {
        const targets = b.professionalId ? [b.professionalId] : proIds;
        for (const professionalId of targets) {
          busy.push({
            professionalId,
            startsAt: b.startsAt.toISOString(),
            endsAt: b.endsAt.toISOString(),
          });
        }
      }
    }

    const external = group.locationKind === 'external';
    const refs: AiScheduleBuild['refs'] = new Map();
    const persons: ScheduleContext['persons'] = withServices.map((m, i) => {
      const ref = `p${i + 1}`;
      const role = m.role === 'bride' ? 'bride' : 'companion';
      refs.set(ref, {
        groupMemberId: m.id,
        clientName: m.client.fullName,
        role,
      });
      return {
        ref,
        role,
        services: m.services.map((s) => ({
          serviceId: s.serviceId,
          label: serviceById.get(s.serviceId)?.name ?? 'Serviço',
          durationMinutes: serviceById.get(s.serviceId)?.defaultDurationMinutes ?? 0,
          eligibleProfessionalIds: eligibleFor(s.serviceId, role),
        })),
      };
    });

    const readyLimit = group.readyBy ?? dayEnd;
    const readyBy =
      timeline && timeline.registryStartsAt < readyLimit ? timeline.registryStartsAt : readyLimit;
    // Limite das acompanhantes (D-14/D-21): usado sempre, com ou sem cronograma.
    let companionReadyBy = readyBy;
    if (group.companionsReadyBy && group.companionsReadyBy < companionReadyBy) {
      companionReadyBy = group.companionsReadyBy;
    }
    const ctx: ScheduleContext = {
      eventDate,
      readyBy: readyBy.toISOString(),
      companionReadyBy: companionReadyBy.toISOString(),
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
      travelBeforeMinutes: external ? group.travelMinutesBefore : 0,
      travelAfterMinutes: external ? group.travelMinutesAfter : 0,
      persons,
      professionals: pros.map((p, i) => ({
        id: p.id,
        label: `prof_${i + 1}`,
        isFixed: p.isFixed,
        dayMinutes: rank.dayMinutes.get(p.id) ?? 0,
        rotationRank: rot.get(p.id) ?? 0,
      })),
      busy,
    };
    return {
      ctx,
      refs,
      profLabels: new Map(pros.map((p) => [p.id, p.displayName])),
      serviceNames: new Map(services.map((s) => [s.id, s.name])),
    };
  }
}
