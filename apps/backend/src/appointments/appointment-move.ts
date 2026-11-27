import {
  ASSISTANT_NOT_SCHEDULABLE_CODE,
  assistantNotSchedulableMessage,
  isAssistantRole,
} from "../identity/assistant-role";
import type { TenantPrismaClient } from "../database/types";
import { professionalServesCategory } from "../identity/member-categories";
import {
  assertNotTimelineLinkedTx,
  assertTimelineRulesTx,
  recordTimelineOverrideTx,
  type TimelineOverrideInput,
} from "../bridal/timeline/timeline-guard";
import { MOVABLE_STATUSES } from "./appointment-status";
import {
  SchedulingError,
  acquireScheduleLocks,
  assertSlotFree,
} from "./scheduling-guard";

const notFound = () =>
  new SchedulingError("NOT_FOUND", "Agendamento não encontrado.", "id");

/**
 * Move um agendamento (profissional e/ou horário) dentro da transação do chamador
 * (`runWithTenant(..., SCHEDULE_TX_OPTIONS)`). Reusado pela confirmação do cronograma
 * (`fromTimeline: true` dispensa a guarda do cronograma, que é quem está movendo).
 */
export async function moveAppointmentTx(
  tx: TenantPrismaClient,
  orgId: string,
  memberId: string,
  input: {
    id: string;
    professionalId: string;
    startsAt: Date;
    endsAt?: Date | null;
    timelineOverride?: TimelineOverrideInput | null;
  },
  opts?: { fromTimeline?: boolean },
): Promise<{ id: string }> {
  const newStart = input.startsAt;
  const peek = await tx.appointment.findFirst({
    where: { id: input.id },
    select: { professionalId: true },
  });
  if (!peek) throw notFound();

  await acquireScheduleLocks(tx, orgId, [peek.professionalId, input.professionalId]);
  await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${input.id}::uuid FOR UPDATE`;
  const current = await tx.appointment.findFirst({ where: { id: input.id } });
  if (!current) throw notFound();
  if (
    current.professionalId !== peek.professionalId &&
    current.professionalId !== input.professionalId
  ) {
    // Moveu para outra raia entre a leitura e o lock: o cliente deve tentar de novo.
    throw new SchedulingError(
      "SLOT_TAKEN",
      "Horário já reservado por outra pessoa — escolha outro slot",
      "startsAt",
    );
  }
  if (!(MOVABLE_STATUSES as readonly string[]).includes(current.status)) {
    throw new SchedulingError(
      "INVALID_STATUS",
      "Este agendamento não pode ser movido.",
      "id",
    );
  }
  if (!opts?.fromTimeline) {
    await assertNotTimelineLinkedTx(tx, current.id);
  }

  const professionalChanged = current.professionalId !== input.professionalId;
  if (professionalChanged) {
    const professional = await tx.member.findFirst({
      where: {
        id: input.professionalId,
        status: "active",
        deletedAt: null,
        isProfessional: true,
      },
      include: { role: { select: { name: true } } },
    });
    if (!professional) {
      throw new SchedulingError(
        "PROFESSIONAL_NOT_FOUND",
        "Profissional ativo não encontrado.",
        "professionalId",
      );
    }
    if (isAssistantRole(professional.role?.name)) {
      throw new SchedulingError(
        ASSISTANT_NOT_SCHEDULABLE_CODE,
        assistantNotSchedulableMessage(professional.displayName),
        "professionalId",
      );
    }
    const service = await tx.service.findFirst({
      where: { id: current.serviceId },
      select: { categoryId: true },
    });
    if (
      service &&
      !(await professionalServesCategory(
        tx,
        input.professionalId,
        service.categoryId,
      ))
    ) {
      throw new SchedulingError(
        "PROFESSIONAL_DOES_NOT_SERVE_CATEGORY",
        "Este profissional não atende a categoria deste serviço.",
        "professionalId",
      );
    }
  }

  const duration = current.endsAt.getTime() - current.startsAt.getTime();
  const newEnd = input.endsAt ?? new Date(newStart.getTime() + duration);
  await assertSlotFree(tx, {
    professionalId: input.professionalId,
    startsAt: newStart,
    endsAt: newEnd,
    ignoreAppointmentId: current.id,
  });

  const guard = opts?.fromTimeline
    ? { overridden: null }
    : await assertTimelineRulesTx(tx, {
        clientId: current.clientId,
        professionalId: input.professionalId,
        startsAt: newStart,
        endsAt: newEnd,
        purpose: current.purpose,
        actorMemberId: memberId,
        override: input.timelineOverride ?? null,
      });

  await tx.appointment.update({
    where: { id: current.id },
    data: {
      professionalId: input.professionalId,
      startsAt: newStart,
      endsAt: newEnd,
    },
  });

  if (guard.overridden) {
    await recordTimelineOverrideTx(
      tx,
      orgId,
      memberId,
      current.id,
      input.timelineOverride!.reason,
      guard.overridden,
    );
  }

  if (current.comandaId && professionalChanged) {
    // D-13: a comissão segue quem atende.
    await tx.comandaItem.updateMany({
      where: { appointmentId: current.id, comanda: { status: "open" } },
      data: { professionalId: input.professionalId },
    });
  }
  return { id: current.id };
}
