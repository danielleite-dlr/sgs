import type { TenantPrismaClient } from "../database/types";
import { BLOCKING_STATUSES, CANCELLABLE_STATUSES } from "./appointment-status";
import { SchedulingError } from "./scheduling-guard";

/**
 * Cancelar um agendamento ligado a comanda: comanda fechada bloqueia;
 * remove os itens do agendamento e cancela a comanda quando nada sobra.
 * O sinal NÃO é tocado (já é crédito do cliente — D-03/D-15).
 */
export async function releaseComandaTx(
  tx: TenantPrismaClient,
  appointmentId: string,
  comandaId: string,
  reason: string,
): Promise<void> {
  const rows = await tx.$queryRaw<{ status: string }[]>`
      SELECT status FROM comandas WHERE id = ${comandaId}::uuid FOR UPDATE`;
  const status = rows[0]?.status;
  if (!status) return;
  if (status === "closed") {
    throw new SchedulingError(
      "COMANDA_CLOSED",
      "Reabra a comanda antes de cancelar este agendamento.",
      "id",
    );
  }
  if (status !== "open") return;

  const otherActive = await tx.appointment.count({
    where: {
      comandaId,
      id: { not: appointmentId },
      status: { in: [...BLOCKING_STATUSES] },
    },
  });
  const payments = await tx.comandaPayment.count({ where: { comandaId } });
  if (otherActive === 0 && payments > 0) {
    throw new SchedulingError(
      "COMANDA_HAS_PAYMENTS",
      "Remova os pagamentos da comanda antes de cancelar.",
      "id",
    );
  }

  await tx.comandaItem.deleteMany({ where: { appointmentId, comandaId } });
  await tx.$executeRaw`
      UPDATE comandas SET total = COALESCE((SELECT SUM(total) FROM comanda_items WHERE comanda_id = ${comandaId}::uuid), 0)
      WHERE id = ${comandaId}::uuid`;
  const remainingItems = await tx.comandaItem.count({ where: { comandaId } });
  if (remainingItems === 0 && otherActive === 0) {
    await tx.$executeRaw`
        UPDATE comandas SET status = 'cancelled', cancelled_at = now(), cancel_reason = ${reason}
        WHERE id = ${comandaId}::uuid`;
  }
}

/** Corpo transacional do cancelamento (compartilhado com o cancelamento do grupo de noivas). */
export async function cancelAppointmentTx(
  tx: TenantPrismaClient,
  a: {
    appointmentId: string;
    memberId: string;
    reason: string;
    reasonTag?: string | null;
  },
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${a.appointmentId}::uuid FOR UPDATE`;
  const current = await tx.appointment.findFirst({
    where: { id: a.appointmentId },
  });
  if (!current) {
    throw new SchedulingError("NOT_FOUND", "Agendamento não encontrado.", "id");
  }
  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(current.status)) {
    throw new SchedulingError(
      "INVALID_STATUS",
      "Este agendamento não pode ser cancelado.",
      "id",
    );
  }
  if (current.comandaId) {
    await releaseComandaTx(tx, current.id, current.comandaId, a.reason);
  }
  const tag = a.reasonTag ?? null;
  await tx.appointment.update({
    where: { id: current.id },
    data: {
      status: tag === "no_show" ? "no_show" : "cancelled",
      cancelReason: a.reason,
      cancelReasonTag: tag,
      cancelledAt: new Date(),
      cancelledBy: a.memberId,
    },
  });
}
