/**
 * Assistente da noiva (fase 09.1): vínculo no grupo + bloqueio de agenda.
 *
 * Modelo: a assistente é uma profissional ativa com `isBridalAssistant`. Vinculá-la grava
 * `assistant_member_id` (com o snapshot da diária vigente, D-08) e cria UM `time_blocks`
 * `acompanhamento` all-day no dia do evento (fuso da org). O bloqueio não é appointment, então
 * não entra em comanda/relatório; `assertSlotFree` e `TimeBlocksService.create` já recusam
 * qualquer coisa sobre ele (D-14). Aqui NÃO há notificação à assistente (D-02).
 * Tudo roda na transação do chamador.
 */
import { BLOCKING_STATUSES } from '../appointments/appointment-status';
import {
  SchedulingError,
  acquireScheduleLocks,
  assertSlotFree,
} from '../appointments/scheduling-guard';
import type { Prisma } from '@prisma/client';
import { loadBridalAssistantDailyRate } from '../catalog/packages/bridal-assistant-rate';
import { recordAudit } from '../common/audit-log';
import type { TenantPrismaClient } from '../database/types';
import {
  BRIDAL_ASSISTANT_BLOCK_KIND,
  assistantAccrualItemName,
  assistantBlockNote,
  assistantIneligibilityReason,
  type AssistantGroupLike,
} from './bridal-assistant-rules';
import { BridalError } from './bridal-errors';
import { orgTimezone } from './bridal-schedule';

export interface DayBounds {
  startsAt: Date;
  endsAt: Date;
}

/** [00:00, 24:00) do dia do evento no fuso da org (Pitfall 5). */
export async function eventDayBoundsTx(
  tx: TenantPrismaClient,
  eventDateYmd: string,
): Promise<DayBounds> {
  const tz = await orgTimezone(tx);
  const rows = await tx.$queryRaw<{ s: Date; e: Date }[]>`
    SELECT ((${eventDateYmd}::date)::timestamp AT TIME ZONE ${tz}) AS s,
           (((${eventDateYmd}::date) + 1)::timestamp AT TIME ZONE ${tz}) AS e`;
  return { startsAt: rows[0].s, endsAt: rows[0].e };
}

export interface AssistantGroup extends AssistantGroupLike {
  id: string;
  name: string;
  eventDateYmd: string;
  assistantMemberId: string | null;
  brideName: string | null;
  brideClientId: string | null;
}

export async function loadAssistantGroupTx(
  tx: TenantPrismaClient,
  groupId: string,
): Promise<AssistantGroup | null> {
  const g = await tx.bridalGroup.findFirst({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      status: true,
      eventKind: true,
      locationKind: true,
      eventDate: true,
      assistantMemberId: true,
      package: { select: { includesBridalAssistant: true, deletedAt: true } },
      members: {
        where: { role: 'bride' },
        select: { clientId: true, client: { select: { fullName: true } } },
        take: 1,
      },
    },
  });
  if (!g) return null;
  const bride = g.members[0] ?? null;
  return {
    id: g.id,
    name: g.name,
    status: g.status,
    eventKind: g.eventKind,
    locationKind: g.locationKind,
    pkg: g.package,
    eventDateYmd: g.eventDate.toISOString().slice(0, 10),
    assistantMemberId: g.assistantMemberId,
    brideName: bride?.client.fullName ?? null,
    brideClientId: bride?.clientId ?? null,
  };
}

/** Comanda do dia da noiva (evento) já fechada: o vínculo não retroage (D-17). */
export async function eventComandaClosedTx(
  tx: TenantPrismaClient,
  groupId: string,
  brideClientId: string | null,
): Promise<boolean> {
  if (!brideClientId) return false;
  const n = await tx.appointment.count({
    where: {
      bridalGroupId: groupId,
      clientId: brideClientId,
      OR: [{ purpose: 'event' }, { purpose: null }],
      comanda: { status: 'closed' },
    },
  });
  return n > 0;
}

function formatBr(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

/** Vincula ou troca a assistente do grupo (D-13); idempotente se já for ela. */
export async function setAssistantTx(
  tx: TenantPrismaClient,
  orgId: string,
  actorId: string,
  groupId: string,
  assistantId: string,
): Promise<void> {
  const g = await loadAssistantGroupTx(tx, groupId);
  if (!g) throw new BridalError('NOT_FOUND', 'Grupo não encontrado.', 'groupId');
  const motivo = assistantIneligibilityReason(g);
  if (motivo) {
    throw new BridalError(
      'ASSISTANT_NOT_ALLOWED',
      `Este grupo não tem assistente: ${motivo}.`,
      'groupId',
    );
  }
  const assistant = await tx.member.findFirst({
    where: { id: assistantId, status: 'active', isProfessional: true, isBridalAssistant: true },
    select: { id: true, displayName: true },
  });
  if (!assistant) {
    throw new BridalError(
      'NOT_A_BRIDAL_ASSISTANT',
      'Escolha uma profissional com a função Assistente da Noiva.',
      'memberId',
    );
  }
  if (await eventComandaClosedTx(tx, groupId, g.brideClientId)) {
    throw new BridalError(
      'EVENT_COMANDA_CLOSED',
      'A comanda do dia da noiva já foi fechada; reabra a comanda para trocar a assistente.',
      'groupId',
    );
  }
  if (g.assistantMemberId === assistantId) return;

  await acquireScheduleLocks(
    tx,
    orgId,
    [assistantId, g.assistantMemberId].filter((x): x is string => !!x),
  );
  await tx.timeBlock.deleteMany({
    where: { bridalGroupId: groupId, kind: BRIDAL_ASSISTANT_BLOCK_KIND },
  });
  const day = await eventDayBoundsTx(tx, g.eventDateYmd);
  try {
    await assertSlotFree(tx, { professionalId: assistantId, ...day });
  } catch (e) {
    if (e instanceof SchedulingError) {
      throw new BridalError(
        'ASSISTANT_BUSY',
        `${assistant.displayName} não está livre em ${formatBr(g.eventDateYmd)}: ${e.message}`,
        'memberId',
      );
    }
    throw e;
  }
  await tx.timeBlock.create({
    data: {
      organizationId: orgId,
      professionalId: assistantId,
      kind: BRIDAL_ASSISTANT_BLOCK_KIND,
      startsAt: day.startsAt,
      endsAt: day.endsAt,
      allDay: true,
      note: assistantBlockNote(g.brideName ?? g.name),
      bridalGroupId: groupId,
      createdBy: actorId,
    },
  });
  // D-08: a diária vigente fica guardada no vínculo; mudanças futuras não a alteram.
  const dailyRate = await loadBridalAssistantDailyRate(tx);
  await tx.bridalGroup.update({
    where: { id: groupId },
    data: {
      assistantMemberId: assistantId,
      assistantDailyRate: dailyRate,
      assistantLinkedAt: new Date(),
    },
  });
  await recordAudit(tx, {
    orgId,
    actorMemberId: actorId,
    action: 'bridal.assistant.set',
    entityType: 'bridal_group',
    entityId: groupId,
    metadata: { assistantId, previousAssistantId: g.assistantMemberId, dailyRate },
  });
}

/** Remove a assistente (manual ou por o grupo deixar de ser elegível) e libera a agenda. */
export async function clearAssistantTx(
  tx: TenantPrismaClient,
  orgId: string,
  actorId: string,
  groupId: string,
  reason: 'manual' | 'ineligible',
): Promise<{ removedName: string | null }> {
  const g = await loadAssistantGroupTx(tx, groupId);
  if (!g) throw new BridalError('NOT_FOUND', 'Grupo não encontrado.', 'groupId');
  if (reason === 'manual' && (await eventComandaClosedTx(tx, groupId, g.brideClientId))) {
    throw new BridalError(
      'EVENT_COMANDA_CLOSED',
      'A comanda do dia da noiva já foi fechada; reabra a comanda para trocar a assistente.',
      'groupId',
    );
  }
  let removedName: string | null = null;
  if (g.assistantMemberId) {
    await acquireScheduleLocks(tx, orgId, [g.assistantMemberId]);
    const m = await tx.member.findFirst({
      where: { id: g.assistantMemberId },
      select: { displayName: true },
    });
    removedName = m?.displayName ?? null;
  }
  await tx.timeBlock.deleteMany({
    where: { bridalGroupId: groupId, kind: BRIDAL_ASSISTANT_BLOCK_KIND },
  });
  if (!g.assistantMemberId) return { removedName: null };
  await tx.bridalGroup.update({
    where: { id: groupId },
    data: { assistantMemberId: null, assistantDailyRate: null, assistantLinkedAt: null },
  });
  await recordAudit(tx, {
    orgId,
    actorMemberId: actorId,
    action: 'bridal.assistant.clear',
    entityType: 'bridal_group',
    entityId: groupId,
    reason,
    metadata: { previousAssistantId: g.assistantMemberId },
  });
  return { removedName };
}

export interface AssistantCandidate {
  memberId: string;
  displayName: string;
  available: boolean;
  reason: string | null;
  current: boolean;
}

const KIND_TITLES: Record<string, string> = {
  folga: 'Folga',
  intervalo: 'Intervalo',
  feriado: 'Feriado',
  indisponibilidade: 'Indisponibilidade',
  deslocamento: 'Deslocamento',
};

/** Todas as assistentes ativas, com disponibilidade no dia do grupo (D-15). */
export async function assistantCandidatesTx(
  tx: TenantPrismaClient,
  groupId: string,
): Promise<AssistantCandidate[]> {
  const g = await loadAssistantGroupTx(tx, groupId);
  if (!g) return [];
  const day = await eventDayBoundsTx(tx, g.eventDateYmd);
  const assistants = await tx.member.findMany({
    where: { status: 'active', isProfessional: true, isBridalAssistant: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: 'asc' },
  });
  if (assistants.length === 0) return [];
  const ids = assistants.map((a) => a.id);
  const blocks = await tx.timeBlock.findMany({
    where: {
      OR: [{ professionalId: { in: ids } }, { professionalId: null }],
      startsAt: { lt: day.endsAt },
      endsAt: { gt: day.startsAt },
      NOT: { bridalGroupId: groupId },
    },
    select: { professionalId: true, kind: true },
  });
  const appts = await tx.appointment.findMany({
    where: {
      professionalId: { in: ids },
      status: { in: [...BLOCKING_STATUSES] },
      startsAt: { lt: day.endsAt },
      endsAt: { gt: day.startsAt },
    },
    select: { professionalId: true },
  });
  return assistants.map((a) => {
    const mine = blocks.filter((b) => b.professionalId === a.id || b.professionalId === null);
    const escort = mine.find((b) => b.kind === BRIDAL_ASSISTANT_BLOCK_KIND);
    const other = mine.find((b) => b.kind !== BRIDAL_ASSISTANT_BLOCK_KIND);
    let reason: string | null = null;
    if (escort) reason = 'Já acompanha outra noiva neste dia';
    else if (appts.some((x) => x.professionalId === a.id)) reason = 'Tem atendimento neste dia';
    else if (other) {
      reason = `Bloqueio na agenda neste dia (${KIND_TITLES[other.kind] ?? other.kind})`;
    }
    return {
      memberId: a.id,
      displayName: a.displayName,
      available: reason === null,
      reason,
      current: a.id === g.assistantMemberId,
    };
  });
}

/**
 * Repasse da diária da assistente (09.1 D-11): accrual avulso em commission_records.
 * comanda_item_id recebe o id do GRUPO (coluna sem FK por design; Pitfall 1) e o snapshot
 * marca kind 'bridal_assistant'. Não mexe no total, pagamentos, caixa nem estoque da comanda.
 * Paga uma vez só: grupo com accrual vivo (sem reversal) não gera outro (Pitfall 6).
 */
export async function bridalAssistantAccrualsTx(
  tx: TenantPrismaClient,
  args: { orgId: string; comandaId: string; cycle: number; now: Date },
): Promise<Prisma.CommissionRecordCreateManyInput[]> {
  const { orgId, comandaId, cycle, now } = args;
  const rows = await tx.$queryRaw<
    { id: string; name: string; assistant_member_id: string; rate: string }[]
  >`
    SELECT g.id, g.name, g.assistant_member_id, g.assistant_daily_rate::text AS rate
      FROM bridal_groups g
     WHERE g.status = 'active' AND g.assistant_member_id IS NOT NULL AND g.assistant_daily_rate > 0
       AND EXISTS (SELECT 1 FROM appointments a
                     JOIN bridal_group_members m
                       ON m.group_id = g.id AND m.role = 'bride' AND m.client_id = a.client_id
                    WHERE a.comanda_id = ${comandaId}::uuid AND a.bridal_group_id = g.id
                      AND COALESCE(a.purpose, 'event') = 'event')
       AND NOT EXISTS (SELECT 1 FROM commission_records r
                        WHERE r.comanda_item_id = g.id AND r.kind = 'accrual'
                          AND NOT EXISTS (SELECT 1 FROM commission_records v
                                           WHERE v.reverses_record_id = r.id))`;
  return rows.map((g) => ({
    organizationId: orgId,
    comandaId,
    comandaItemId: g.id,
    memberId: g.assistant_member_id,
    kind: 'accrual',
    cycle,
    baseAmount: g.rate,
    chargedAmount: '0.00',
    ruleId: null,
    ruleKind: 'fixed',
    ruleValue: g.rate,
    noRule: false,
    calculatedAmount: g.rate,
    ruleSnapshot: {
      kind: 'bridal_assistant',
      bridalGroupId: g.id,
      itemName: assistantAccrualItemName(g.name),
      dailyRate: g.rate,
      quantity: 1,
      fixedPer: 'unit',
      noRule: false,
    },
    calculatedAt: now,
  }));
}

/** Depois de editar o grupo: remove a assistente se ficou inelegível (D-05) ou move o bloqueio. */
export async function syncAssistantAfterUpdateTx(
  tx: TenantPrismaClient,
  orgId: string,
  actorId: string,
  groupId: string,
  previousEventDateYmd: string,
): Promise<string | null> {
  const g = await loadAssistantGroupTx(tx, groupId);
  if (!g || !g.assistantMemberId) return null;
  const motivo = assistantIneligibilityReason(g);
  if (motivo) {
    const { removedName } = await clearAssistantTx(tx, orgId, actorId, groupId, 'ineligible');
    return `A assistente ${removedName ?? ''} foi removida e a agenda dela no dia foi liberada (${motivo}).`;
  }
  if (g.eventDateYmd === previousEventDateYmd) return null;

  await acquireScheduleLocks(tx, orgId, [g.assistantMemberId]);
  await tx.timeBlock.deleteMany({
    where: { bridalGroupId: groupId, kind: BRIDAL_ASSISTANT_BLOCK_KIND },
  });
  const day = await eventDayBoundsTx(tx, g.eventDateYmd);
  try {
    await assertSlotFree(tx, { professionalId: g.assistantMemberId, ...day });
  } catch (e) {
    if (e instanceof SchedulingError) {
      const m = await tx.member.findFirst({
        where: { id: g.assistantMemberId },
        select: { displayName: true },
      });
      throw new BridalError(
        'ASSISTANT_BUSY_ON_NEW_DATE',
        `A assistente ${m?.displayName ?? ''} já está ocupada em ${formatBr(g.eventDateYmd)}. ` +
          'Troque a assistente antes de mudar a data.',
        'eventDate',
      );
    }
    throw e;
  }
  await tx.timeBlock.create({
    data: {
      organizationId: orgId,
      professionalId: g.assistantMemberId,
      kind: BRIDAL_ASSISTANT_BLOCK_KIND,
      startsAt: day.startsAt,
      endsAt: day.endsAt,
      allDay: true,
      note: assistantBlockNote(g.brideName ?? g.name),
      bridalGroupId: groupId,
      createdBy: actorId,
    },
  });
  return null;
}
