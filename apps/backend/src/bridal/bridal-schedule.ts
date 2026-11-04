import { cancelAppointmentTx } from '../appointments/appointment-cancel';
import { CANCELLABLE_STATUSES, BLOCKING_STATUSES } from '../appointments/appointment-status';
import { parseAppointmentInterval } from '../appointments/appointments.service';
import { acquireScheduleLocks, assertSlotFree } from '../appointments/scheduling-guard';
import { createVisitTx } from '../appointments/visits';
import type { TenantPrismaClient } from '../database/types';
import { BridalError } from './bridal-errors';
import { coveragePriceMapTx } from './bridal-coverage';

/** Transação maior que a da fase 3: até 150 itens + bloqueios (Pitfall 6). */
export const BRIDAL_SCHEDULE_TX_OPTIONS = { timeout: 30000, maxWait: 5000 };

export const MAX_BRIDAL_SCHEDULE_ITEMS = 150;

export interface BridalScheduleItemInput {
  groupMemberId: string;
  serviceId: string;
  professionalId: string;
  startsAt: Date | string;
  endsAt: Date | string;
  purpose?: string | null;
}

export interface BridalDepositInput {
  groupMemberId: string;
  amount: string;
  method: string;
}

export interface BridalScheduleInput {
  groupId: string;
  items: BridalScheduleItemInput[];
  deposits?: BridalDepositInput[] | null;
}

function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

async function orgTimezone(tx: TenantPrismaClient): Promise<string> {
  const rows = await tx.$queryRaw<
    { timezone: string }[]
  >`SELECT timezone FROM organizations LIMIT 1`;
  return rows[0]?.timezone ?? 'America/Sao_Paulo';
}

/**
 * Agenda real do evento (D-03, D-07): uma visita (agendamentos + comanda) por pessoa e finalidade,
 * com cobertura do contrato (D-08), sinal de acompanhante avulsa e bloqueios de deslocamento (D-04).
 * Tudo na transação do chamador; qualquer erro desfaz tudo.
 */
export async function createBridalScheduleTx(
  tx: TenantPrismaClient,
  orgId: string,
  memberId: string,
  input: BridalScheduleInput,
): Promise<{ appointmentIds: string[] }> {
  const items = input.items ?? [];
  if (items.length === 0) {
    throw new BridalError('ITEMS_REQUIRED', 'Inclua ao menos um serviço.', 'items');
  }
  if (items.length > MAX_BRIDAL_SCHEDULE_ITEMS) {
    throw new BridalError(
      'TOO_MANY_ITEMS',
      `Máximo de ${MAX_BRIDAL_SCHEDULE_ITEMS} itens por agendamento do evento.`,
      'items',
    );
  }

  // Locks de todos os profissionais, 1x e ordenados, antes de qualquer leitura/escrita.
  await acquireScheduleLocks(
    tx,
    orgId,
    items.map((i) => i.professionalId),
  );

  const group = await tx.bridalGroup.findFirst({
    where: { id: input.groupId },
    select: { id: true, status: true, eventDate: true },
  });
  if (!group) throw new BridalError('NOT_FOUND', 'Grupo não encontrado.', 'groupId');
  if (group.status !== 'active') {
    throw new BridalError('GROUP_NOT_ACTIVE', 'O grupo não está ativo.', 'groupId');
  }
  const eventDate = group.eventDate.toISOString().slice(0, 10);
  const tz = await orgTimezone(tx);

  const members = await tx.bridalGroupMember.findMany({
    where: { groupId: group.id },
    select: { id: true, clientId: true, coveredByContract: true },
  });
  const memberById = new Map(members.map((m) => [m.id, m]));

  // Validação + agrupamento por (pessoa, finalidade), preservando a ordem de entrada.
  const buckets = new Map<
    string,
    { groupMemberId: string; purpose: 'event' | 'trial'; items: BridalScheduleItemInput[] }
  >();
  for (const item of items) {
    if (!memberById.has(item.groupMemberId)) {
      throw new BridalError(
        'MEMBER_NOT_IN_GROUP',
        'Há pessoa que não faz parte do grupo.',
        'groupMemberId',
      );
    }
    const purpose = item.purpose ?? 'event';
    if (purpose !== 'event' && purpose !== 'trial') {
      throw new BridalError('INVALID_PURPOSE', 'Finalidade do serviço inválida.', 'purpose');
    }
    const interval = parseAppointmentInterval(item.startsAt, item.endsAt);
    if (!interval) {
      throw new BridalError(
        'INVALID_INTERVAL',
        'O fim do agendamento deve ser posterior ao início.',
        'endsAt',
      );
    }
    const day = localDate(interval.startsAt, tz);
    if (purpose === 'event' && day !== eventDate) {
      throw new BridalError(
        'EVENT_DATE_MISMATCH',
        'Os serviços do evento devem ser agendados no dia do evento.',
        'startsAt',
      );
    }
    if (purpose === 'trial' && day >= eventDate) {
      throw new BridalError(
        'TRIAL_NOT_BEFORE_EVENT',
        'O teste deve ser agendado antes do dia do evento.',
        'startsAt',
      );
    }
    const key = `${item.groupMemberId}:${purpose}`;
    const bucket = buckets.get(key) ?? {
      groupMemberId: item.groupMemberId,
      purpose,
      items: [],
    };
    bucket.items.push(item);
    buckets.set(key, bucket);
  }

  // Sinal: só acompanhante NÃO coberta, só no agendamento do evento (D-07).
  const depositByMember = new Map<string, BridalDepositInput>();
  for (const d of input.deposits ?? []) {
    const m = memberById.get(d.groupMemberId);
    if (!m) {
      throw new BridalError(
        'MEMBER_NOT_IN_GROUP',
        'Há pessoa que não faz parte do grupo.',
        'deposits',
      );
    }
    if (m.coveredByContract) {
      throw new BridalError(
        'DEPOSIT_ONLY_FOR_UNCOVERED',
        'Sinal só vale para pessoa fora do contrato; o contrato já cobre esta pessoa.',
        'deposits',
      );
    }
    if (depositByMember.has(d.groupMemberId)) {
      throw new BridalError('DUPLICATE_DEPOSIT', 'Sinal repetido para a mesma pessoa.', 'deposits');
    }
    if (!buckets.has(`${d.groupMemberId}:event`)) {
      throw new BridalError(
        'DEPOSIT_WITHOUT_EVENT_ITEM',
        'O sinal precisa de um serviço do evento para a pessoa.',
        'deposits',
      );
    }
    depositByMember.set(d.groupMemberId, d);
  }

  const appointmentIds: string[] = [];
  for (const bucket of buckets.values()) {
    const m = memberById.get(bucket.groupMemberId)!;
    const coverage = m.coveredByContract
      ? await coveragePriceMapTx(tx, group.id, m.id, bucket.purpose)
      : null;
    const deposit = bucket.purpose === 'event' ? depositByMember.get(m.id) : undefined;
    const visit = await createVisitTx(tx, orgId, memberId, {
      clientId: m.clientId,
      items: bucket.items.map((i) => ({
        serviceId: i.serviceId,
        professionalId: i.professionalId,
        startsAt: i.startsAt,
        endsAt: i.endsAt,
      })),
      deposit: deposit ? { amount: deposit.amount, method: deposit.method } : null,
      bridal: { groupId: group.id, purpose: bucket.purpose, coverage },
    });
    appointmentIds.push(...visit.appointmentIds);
  }

  await rebuildTravelBlocksTx(tx, orgId, memberId, group.id);
  return { appointmentIds };
}

/**
 * Recalcula os bloqueios 'deslocamento' (D-04): antes do primeiro e depois do último
 * agendamento do evento de cada profissional. Grupo de estúdio só apaga os existentes.
 * Colisão com outro agendamento/bloqueio lança TIME_BLOCKED/SLOT_TAKEN (desfaz tudo).
 */
export async function rebuildTravelBlocksTx(
  tx: TenantPrismaClient,
  orgId: string,
  memberId: string,
  groupId: string,
): Promise<void> {
  const group = await tx.bridalGroup.findFirst({
    where: { id: groupId },
    select: {
      name: true,
      locationKind: true,
      travelMinutesBefore: true,
      travelMinutesAfter: true,
    },
  });
  if (!group) return;

  const appts = await tx.appointment.findMany({
    where: {
      bridalGroupId: groupId,
      purpose: 'event',
      status: { in: [...BLOCKING_STATUSES] },
    },
    select: { professionalId: true, startsAt: true, endsAt: true },
  });
  const profIds = [...new Set(appts.map((a) => a.professionalId))];
  if (profIds.length > 0) await acquireScheduleLocks(tx, orgId, profIds);

  await tx.timeBlock.deleteMany({ where: { bridalGroupId: groupId } });

  const before = group.travelMinutesBefore;
  const after = group.travelMinutesAfter;
  if (group.locationKind !== 'external' || before + after <= 0) return;

  const MIN = 60_000;
  for (const professionalId of profIds.sort()) {
    const mine = appts.filter((a) => a.professionalId === professionalId);
    const first = new Date(Math.min(...mine.map((a) => a.startsAt.getTime())));
    const last = new Date(Math.max(...mine.map((a) => a.endsAt.getTime())));
    const windows: { startsAt: Date; endsAt: Date }[] = [];
    if (before > 0) windows.push({ startsAt: new Date(first.getTime() - before * MIN), endsAt: first });
    if (after > 0) windows.push({ startsAt: last, endsAt: new Date(last.getTime() + after * MIN) });
    for (const w of windows) {
      await assertSlotFree(tx, { professionalId, startsAt: w.startsAt, endsAt: w.endsAt });
      await tx.timeBlock.create({
        data: {
          organizationId: orgId,
          professionalId,
          kind: 'deslocamento',
          startsAt: w.startsAt,
          endsAt: w.endsAt,
          note: `Deslocamento — ${group.name}`,
          bridalGroupId: groupId,
          createdBy: memberId,
        },
      });
    }
  }
}

/**
 * Cancela os agendamentos ativos do grupo (opcionalmente só os do contrato) e remove os
 * bloqueios de deslocamento. Comanda fechada propaga COMANDA_CLOSED. Retorna quantos cancelou.
 */
export async function cancelGroupAppointmentsTx(
  tx: TenantPrismaClient,
  orgId: string,
  memberId: string,
  a: { groupId: string; contractId?: string | null; reason: string },
): Promise<number> {
  const appts = await tx.appointment.findMany({
    where: {
      bridalGroupId: a.groupId,
      status: { in: [...CANCELLABLE_STATUSES] },
      ...(a.contractId ? { contractId: a.contractId } : {}),
    },
    select: { id: true, professionalId: true },
    orderBy: { id: 'asc' },
  });
  if (appts.length > 0) {
    await acquireScheduleLocks(
      tx,
      orgId,
      appts.map((x) => x.professionalId),
    );
  }
  for (const appt of appts) {
    await cancelAppointmentTx(tx, {
      appointmentId: appt.id,
      memberId,
      reason: a.reason,
    });
  }
  await tx.timeBlock.deleteMany({ where: { bridalGroupId: a.groupId } });
  return appts.length;
}
