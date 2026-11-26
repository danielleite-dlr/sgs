import { Prisma } from '@prisma/client';
import type { TenantPrismaClient } from '../database/types';
import { BLOCKING_STATUSES } from '../appointments/appointment-status';

/**
 * Fase 11 (D-10/D-11): dados do ranking vindos do banco. Somente leitura:
 * o revezamento é derivado dos agendamentos, nada é gravado ao consultar.
 */

/** Janela do revezamento: só olha agendamentos dos últimos 90 dias. */
const ROTATION_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RankingData {
  /** id -> minutos agendados no dia (0 se nada) */
  dayMinutes: Map<string, number>;
  /** id -> epoch ms do max(created_at) ou null (nunca recebeu) */
  lastAssignedAt: Map<string, number | null>;
}

export async function loadRankingDataTx(
  tx: TenantPrismaClient,
  a: {
    professionalIds: string[];
    dayStart: Date;
    dayEnd: Date;
    excludeAppointmentIds?: string[];
    now?: Date;
  },
): Promise<RankingData> {
  const dayMinutes = new Map<string, number>();
  const lastAssignedAt = new Map<string, number | null>();
  if (a.professionalIds.length === 0) return { dayMinutes, lastAssignedAt };
  for (const id of a.professionalIds) {
    dayMinutes.set(id, 0);
    lastAssignedAt.set(id, null);
  }
  const statuses = [...BLOCKING_STATUSES] as string[];
  const exclude = a.excludeAppointmentIds ?? [];
  const now = a.now ?? new Date();
  const since = new Date(now.getTime() - ROTATION_WINDOW_DAYS * DAY_MS);

  const minutes = await tx.$queryRaw<{ professional_id: string; minutes: number }[]>(Prisma.sql`
    SELECT professional_id,
           COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(ends_at, ${a.dayEnd}) - GREATEST(starts_at, ${a.dayStart}))) / 60), 0)::int AS minutes
    FROM appointments
    WHERE professional_id = ANY(${a.professionalIds}::uuid[])
      AND status = ANY(${statuses}::text[])
      AND starts_at < ${a.dayEnd}
      AND ends_at > ${a.dayStart}
      AND id <> ALL(${exclude}::uuid[])
    GROUP BY professional_id`);
  for (const r of minutes) dayMinutes.set(r.professional_id, Number(r.minutes));

  const last = await tx.$queryRaw<{ professional_id: string; last: Date }[]>(Prisma.sql`
    SELECT professional_id, MAX(created_at) AS last
    FROM appointments
    WHERE professional_id = ANY(${a.professionalIds}::uuid[])
      AND status = ANY(${statuses}::text[])
      AND starts_at >= ${since}
    GROUP BY professional_id`);
  for (const r of last) lastAssignedAt.set(r.professional_id, new Date(r.last).getTime());

  return { dayMinutes, lastAssignedAt };
}

/** Ids ocupados (agendamento ou bloqueio) no intervalo; bloqueio do salão ocupa todas. */
export async function loadBusyInIntervalTx(
  tx: TenantPrismaClient,
  a: {
    professionalIds: string[];
    startsAt: Date;
    endsAt: Date;
    ignoreAppointmentIds?: string[];
    ignoreGroupId?: string | null;
  },
): Promise<Set<string>> {
  const busy = new Set<string>();
  if (a.professionalIds.length === 0) return busy;

  const appts = await tx.appointment.findMany({
    where: {
      professionalId: { in: a.professionalIds },
      status: { in: [...BLOCKING_STATUSES] },
      startsAt: { lt: a.endsAt },
      endsAt: { gt: a.startsAt },
      ...(a.ignoreAppointmentIds?.length ? { id: { notIn: a.ignoreAppointmentIds } } : {}),
    },
    select: { professionalId: true },
  });
  for (const x of appts) busy.add(x.professionalId);

  const blocks = await tx.timeBlock.findMany({
    where: {
      OR: [{ professionalId: { in: a.professionalIds } }, { professionalId: null }],
      startsAt: { lt: a.endsAt },
      endsAt: { gt: a.startsAt },
      ...(a.ignoreGroupId
        ? { AND: [{ OR: [{ bridalGroupId: null }, { bridalGroupId: { not: a.ignoreGroupId } }] }] }
        : {}),
    },
    select: { professionalId: true },
  });
  for (const b of blocks) {
    if (b.professionalId) busy.add(b.professionalId);
    else for (const id of a.professionalIds) busy.add(id);
  }
  return busy;
}
