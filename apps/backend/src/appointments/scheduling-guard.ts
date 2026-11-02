import {
  lockOrgShared,
  lockProfessional,
  isExclusionViolation,
  isLockTimeout,
  setLockTimeout,
} from "../database/advisory-lock";
import { ComandaError } from "../comandas/comanda-items";
import type { TenantPrismaClient } from "../database/types";
import { CreditError } from "../financial/client-credit";
import { BLOCKING_STATUSES } from "./appointment-status";

export const SLOT_TAKEN_MESSAGE =
  "Horário já reservado por outra pessoa — escolha outro slot";

/** Timeout da transação > LOCK_TIMEOUT_MS, para o 55P03 chegar antes do "Transaction already closed". */
export const SCHEDULE_TX_OPTIONS = { timeout: 10000, maxWait: 5000 };

export class SchedulingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly field: string | null = null,
  ) {
    super(message);
  }
}

const KIND_LABELS: Record<string, string> = {
  folga: "folga",
  intervalo: "intervalo",
  feriado: "feriado",
  indisponibilidade: "indisponibilidade",
};

/**
 * lock_timeout + lock compartilhado da org + lock de cada profissional distinto
 * em ordem lexicográfica (sem deadlock ao mover entre raias).
 */
export async function acquireScheduleLocks(
  tx: TenantPrismaClient,
  orgId: string,
  professionalIds: string[],
): Promise<void> {
  await setLockTimeout(tx);
  await lockOrgShared(tx, orgId);
  for (const id of [...new Set(professionalIds)].sort()) {
    await lockProfessional(tx, orgId, id);
  }
}

export async function assertSlotFree(
  tx: TenantPrismaClient,
  args: {
    professionalId: string;
    startsAt: Date;
    endsAt: Date;
    ignoreAppointmentId?: string;
  },
): Promise<void> {
  const block = await tx.timeBlock.findFirst({
    where: {
      OR: [{ professionalId: args.professionalId }, { professionalId: null }],
      startsAt: { lt: args.endsAt },
      endsAt: { gt: args.startsAt },
    },
    select: { kind: true },
  });
  if (block) {
    throw new SchedulingError(
      "TIME_BLOCKED",
      `Profissional indisponível neste horário (${KIND_LABELS[block.kind] ?? block.kind}).`,
      "startsAt",
    );
  }
  const conflict = await tx.appointment.findFirst({
    where: {
      professionalId: args.professionalId,
      status: { in: [...BLOCKING_STATUSES] },
      startsAt: { lt: args.endsAt },
      endsAt: { gt: args.startsAt },
      ...(args.ignoreAppointmentId
        ? { id: { not: args.ignoreAppointmentId } }
        : {}),
    },
    select: { id: true },
  });
  if (conflict) {
    throw new SchedulingError("SLOT_TAKEN", SLOT_TAKEN_MESSAGE, "startsAt");
  }
}

export function mapSchedulingError(
  e: unknown,
): { code: string; message: string; field: string | null } | null {
  if (e instanceof SchedulingError) {
    return { code: e.code, message: e.message, field: e.field };
  }
  if (e instanceof ComandaError) {
    return { code: e.code, message: e.message, field: e.field };
  }
  if (e instanceof CreditError) {
    return { code: e.code, message: e.message, field: null };
  }
  if (isLockTimeout(e) || isExclusionViolation(e)) {
    return { code: "SLOT_TAKEN", message: SLOT_TAKEN_MESSAGE, field: "startsAt" };
  }
  return null;
}
