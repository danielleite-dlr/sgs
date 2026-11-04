import { Injectable } from '@nestjs/common';
import { BLOCKING_STATUSES } from '../../appointments/appointment-status';
import { ContractSettingsService } from '../../contracts/contract-settings.service';
import type { TenantPrismaClient } from '../../database/types';
import { professionalServesCategory } from '../../identity/member-categories';
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

    const already = await tx.appointment.count({
      where: { bridalGroupId: groupId, purpose: 'event', status: { in: [...BLOCKING_STATUSES] } },
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
        services: { where: { purpose: 'event' }, orderBy: { sortOrder: 'asc' } },
      },
    });
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
    const services = await tx.service.findMany({ where: { id: { in: serviceIds } } });
    const serviceById = new Map(services.map((s) => [s.id, s]));

    const proRows = await tx.member.findMany({
      where: { isProfessional: true, status: 'active', deletedAt: null },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      select: { id: true, displayName: true },
    });
    const eligibleByService = new Map<string, string[]>();
    const usedPros = new Set<string>();
    for (const sid of serviceIds) {
      const cat = serviceById.get(sid)?.categoryId;
      const ok: string[] = [];
      if (cat) {
        for (const p of proRows) {
          if (await professionalServesCategory(tx, p.id, cat)) ok.push(p.id);
        }
      }
      eligibleByService.set(sid, ok);
      ok.forEach((id) => usedPros.add(id));
    }
    const pros = proRows.filter((p) => usedPros.has(p.id));

    const eff = await this.settings.getEffective(tx, orgId);
    const eventDate = group.eventDate.toISOString().slice(0, 10);
    const win = await tx.$queryRaw<{ s: Date; e: Date }[]>`
      SELECT (${eventDate}::date + ${eff.scheduleDayStart}::time) AT TIME ZONE o.timezone AS s,
             (${eventDate}::date + ${eff.scheduleDayEnd}::time) AT TIME ZONE o.timezone AS e
      FROM organizations o LIMIT 1`;
    const dayStart = win[0].s;
    const dayEnd = win[0].e;

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
      refs.set(ref, { groupMemberId: m.id, clientName: m.client.fullName, role });
      return {
        ref,
        role,
        services: m.services.map((s) => ({
          serviceId: s.serviceId,
          label: serviceById.get(s.serviceId)?.name ?? 'Serviço',
          durationMinutes: serviceById.get(s.serviceId)?.defaultDurationMinutes ?? 0,
          eligibleProfessionalIds: eligibleByService.get(s.serviceId) ?? [],
        })),
      };
    });

    const ctx: ScheduleContext = {
      eventDate,
      readyBy: (group.readyBy ?? dayEnd).toISOString(),
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
      travelBeforeMinutes: external ? group.travelMinutesBefore : 0,
      travelAfterMinutes: external ? group.travelMinutesAfter : 0,
      persons,
      professionals: pros.map((p, i) => ({ id: p.id, label: `prof_${i + 1}` })),
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
