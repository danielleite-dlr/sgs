import { BLOCKING_STATUSES, MOVABLE_STATUSES } from '../../appointments/appointment-status';
import type { TenantPrismaClient } from '../../database/types';
import { orgTimezone } from '../bridal-schedule';

const KIND_LABELS: Record<string, string> = {
  folga: 'folga',
  intervalo: 'intervalo',
  feriado: 'feriado',
  indisponibilidade: 'indisponibilidade',
  deslocamento: 'deslocamento',
};

function hhmm(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
}

/**
 * Mesmas condições do assertSlotFree, mas não lança: devolve a descrição de quem/o que ocupa.
 * Os deslocamentos do próprio grupo (ignoreGroupId) são reconstruídos pela confirmação.
 */
export async function findSlotConflictsTx(
  tx: TenantPrismaClient,
  a: {
    professionalId: string;
    startsAt: Date;
    endsAt: Date;
    ignoreAppointmentIds: string[];
    ignoreGroupId?: string | null;
  },
): Promise<string[]> {
  const tz = await orgTimezone(tx);
  const found: { at: Date; text: string }[] = [];

  const blocks = await tx.timeBlock.findMany({
    where: {
      AND: [
        { OR: [{ professionalId: a.professionalId }, { professionalId: null }] },
        ...(a.ignoreGroupId
          ? [{ OR: [{ bridalGroupId: null }, { bridalGroupId: { not: a.ignoreGroupId } }] }]
          : []),
      ],
      startsAt: { lt: a.endsAt },
      endsAt: { gt: a.startsAt },
    },
    select: { kind: true, startsAt: true },
  });
  for (const b of blocks) {
    found.push({ at: b.startsAt, text: `Bloqueio: ${KIND_LABELS[b.kind] ?? b.kind}` });
  }

  const appts = await tx.appointment.findMany({
    where: {
      professionalId: a.professionalId,
      status: { in: [...BLOCKING_STATUSES] },
      startsAt: { lt: a.endsAt },
      endsAt: { gt: a.startsAt },
      ...(a.ignoreAppointmentIds.length > 0 ? { id: { notIn: a.ignoreAppointmentIds } } : {}),
    },
    select: {
      startsAt: true,
      endsAt: true,
      client: { select: { fullName: true } },
      service: { select: { name: true } },
    },
  });
  for (const p of appts) {
    found.push({
      at: p.startsAt,
      text: `${p.client.fullName} — ${p.service.name} (${hhmm(p.startsAt, tz)}–${hhmm(p.endsAt, tz)})`,
    });
  }
  return found.sort((x, y) => x.at.getTime() - y.at.getTime()).map((f) => f.text);
}

/**
 * Agendamentos da noiva que a confirmação vai mover/adotar. FONTE ÚNICA: usada na simulação
 * (ownAppointmentIds) e na confirmação (04.2-06).
 */
export async function findAdoptableBrideAppointmentsTx(
  tx: TenantPrismaClient,
  a: {
    groupId: string;
    brideClientId: string;
    serviceId: string;
    eventDayStart: Date;
    eventDayEnd: Date;
  },
): Promise<
  {
    id: string;
    professionalId: string;
    startsAt: Date;
    endsAt: Date;
    bridalGroupId: string | null;
  }[]
> {
  return tx.appointment.findMany({
    where: {
      clientId: a.brideClientId,
      serviceId: a.serviceId,
      status: { in: [...MOVABLE_STATUSES] },
      OR: [
        { bridalGroupId: a.groupId, purpose: 'event' },
        { bridalGroupId: null, startsAt: { gte: a.eventDayStart, lt: a.eventDayEnd } },
      ],
    },
    select: { id: true, professionalId: true, startsAt: true, endsAt: true, bridalGroupId: true },
    orderBy: { startsAt: 'asc' },
  });
}
