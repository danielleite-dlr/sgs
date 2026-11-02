import { Injectable } from "@nestjs/common";
import { fromCents, toCents } from "../common/money";
import type { TenantPrismaClient } from "../database/types";
import { TenantContextService } from "../database/tenant-context.service";
import { professionalServesCategory } from "../identity/member-categories";
import {
  BLOCKING_STATUSES,
  CANCELLABLE_STATUSES,
  MOVABLE_STATUSES,
  SETTABLE_STATUSES,
  canTransition,
} from "./appointment-status";
import {
  SCHEDULE_TX_OPTIONS,
  SchedulingError,
  acquireScheduleLocks,
  assertSlotFree,
  mapSchedulingError,
} from "./scheduling-guard";

export interface CreateAppointmentInput {
  professionalId: string;
  clientId: string;
  serviceId: string;
  startsAt: Date | string;
  endsAt: Date | string;
  notes?: string | null;
}

export interface AppointmentUserError {
  code: string;
  message: string;
  field?: string | null;
}

type AppointmentPayload = {
  appointment: Record<string, unknown> | null;
  errors: AppointmentUserError[];
};

export const CANCEL_REASON_TAGS = [
  "cliente_desmarcou",
  "profissional_doente",
  "no_show",
] as const;

const APPOINTMENT_INCLUDE = {
  professional: true,
  client: true,
  service: true,
} as const;

/** depositAmount sempre com 2 casas (Decimal do Prisma serializa sem zeros). */
export function serializeAppointment<T extends { depositAmount?: unknown }>(
  row: T,
): T & { depositAmount: string } {
  return {
    ...row,
    depositAmount: fromCents(
      toCents((row.depositAmount ?? 0) as string | number),
    ),
  };
}

const ok = (row: { depositAmount?: unknown }): AppointmentPayload => ({
  appointment: serializeAppointment(row) as unknown as Record<string, unknown>,
  errors: [],
});

const fail = (e: unknown): AppointmentPayload => {
  const m = mapSchedulingError(e);
  if (m) return { appointment: null, errors: [m] };
  throw e;
};

/** Returns parsed dates only when they describe a non-empty valid interval. */
export function parseAppointmentInterval(
  startsAt: Date | string,
  endsAt: Date | string,
): { startsAt: Date; endsAt: Date } | null {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return null;
  }
  return { startsAt: start, endsAt: end };
}

/**
 * AppointmentsService — agenda concorrente por profissional.
 *
 * Toda escrita abre transação, trava (org compartilhado + profissional) antes
 * de ler conflitos e lança SchedulingError dentro da transação (ROLLBACK);
 * a tradução para payload acontece fora. A exclusion constraint é rede de
 * segurança (23P01 -> SLOT_TAKEN).
 */
@Injectable()
export class AppointmentsService {
  constructor(private readonly tenant: TenantContextService) {}

  async list(
    orgId: string,
    filters: {
      startsAt: Date | string;
      endsAt: Date | string;
      professionalId?: string;
    },
  ) {
    const interval = parseAppointmentInterval(filters.startsAt, filters.endsAt);
    if (!interval) return [];

    const rows = await this.tenant.runWithTenant(orgId, (tx) =>
      tx.appointment.findMany({
        where: {
          startsAt: { lt: interval.endsAt },
          endsAt: { gt: interval.startsAt },
          ...(filters.professionalId
            ? { professionalId: filters.professionalId }
            : {}),
        },
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
        include: APPOINTMENT_INCLUDE,
      }),
    );
    return rows.map(serializeAppointment);
  }

  async create(
    orgId: string,
    input: CreateAppointmentInput,
  ): Promise<AppointmentPayload> {
    const interval = parseAppointmentInterval(input.startsAt, input.endsAt);
    if (!interval) {
      return {
        appointment: null,
        errors: [
          {
            code: "INVALID_INTERVAL",
            message: "O fim do agendamento deve ser posterior ao início.",
            field: "endsAt",
          },
        ],
      };
    }

    return this.tenant
      .runWithTenant(
        orgId,
        async (tx) => {
          await acquireScheduleLocks(tx, orgId, [input.professionalId]);

          const [professional, client, service] = await Promise.all([
            tx.member.findFirst({
              where: {
                id: input.professionalId,
                status: "active",
                deletedAt: null,
                isProfessional: true,
              },
            }),
            tx.client.findFirst({
              where: { id: input.clientId, deletedAt: null },
            }),
            tx.service.findFirst({
              where: { id: input.serviceId, deletedAt: null },
            }),
          ]);

          if (!professional) {
            throw new SchedulingError(
              "PROFESSIONAL_NOT_FOUND",
              "Profissional ativo não encontrado.",
              "professionalId",
            );
          }
          if (!client) {
            throw new SchedulingError(
              "CLIENT_NOT_FOUND",
              "Cliente ativo não encontrado.",
              "clientId",
            );
          }
          if (!service) {
            throw new SchedulingError(
              "SERVICE_NOT_FOUND",
              "Serviço ativo não encontrado.",
              "serviceId",
            );
          }
          if (
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

          await assertSlotFree(tx, {
            professionalId: input.professionalId,
            startsAt: interval.startsAt,
            endsAt: interval.endsAt,
          });

          const appointment = await tx.appointment.create({
            data: {
              organizationId: orgId,
              professionalId: input.professionalId,
              clientId: input.clientId,
              serviceId: input.serviceId,
              startsAt: interval.startsAt,
              endsAt: interval.endsAt,
              notes: input.notes ?? null,
            },
            include: APPOINTMENT_INCLUDE,
          });
          return ok(appointment);
        },
        SCHEDULE_TX_OPTIONS,
      )
      .catch(fail);
  }

  async move(
    orgId: string,
    _memberId: string,
    input: { id: string; professionalId: string; startsAt: Date | string },
  ): Promise<AppointmentPayload> {
    const newStart = new Date(input.startsAt);
    if (Number.isNaN(newStart.getTime())) {
      return {
        appointment: null,
        errors: [
          {
            code: "INVALID_INTERVAL",
            message: "Horário inválido.",
            field: "startsAt",
          },
        ],
      };
    }

    return this.tenant
      .runWithTenant(
        orgId,
        async (tx) => {
          const peek = await tx.appointment.findFirst({
            where: { id: input.id },
            select: { professionalId: true },
          });
          if (!peek) throw notFound();

          await acquireScheduleLocks(tx, orgId, [
            peek.professionalId,
            input.professionalId,
          ]);
          await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${input.id}::uuid FOR UPDATE`;
          const current = await tx.appointment.findFirst({
            where: { id: input.id },
          });
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
          if (!isIn(MOVABLE_STATUSES, current.status)) {
            throw new SchedulingError(
              "INVALID_STATUS",
              "Este agendamento não pode ser movido.",
              "id",
            );
          }

          const professionalChanged =
            current.professionalId !== input.professionalId;
          if (professionalChanged) {
            const professional = await tx.member.findFirst({
              where: {
                id: input.professionalId,
                status: "active",
                deletedAt: null,
                isProfessional: true,
              },
            });
            if (!professional) {
              throw new SchedulingError(
                "PROFESSIONAL_NOT_FOUND",
                "Profissional ativo não encontrado.",
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
          const newEnd = new Date(newStart.getTime() + duration);
          await assertSlotFree(tx, {
            professionalId: input.professionalId,
            startsAt: newStart,
            endsAt: newEnd,
            ignoreAppointmentId: current.id,
          });

          const updated = await tx.appointment.update({
            where: { id: current.id },
            data: {
              professionalId: input.professionalId,
              startsAt: newStart,
              endsAt: newEnd,
            },
            include: APPOINTMENT_INCLUDE,
          });

          if (current.comandaId && professionalChanged) {
            // D-13: a comissão segue quem atende.
            await tx.comandaItem.updateMany({
              where: {
                appointmentId: current.id,
                comanda: { status: "open" },
              },
              data: { professionalId: input.professionalId },
            });
          }
          return ok(updated);
        },
        SCHEDULE_TX_OPTIONS,
      )
      .catch(fail);
  }

  async updateStatus(
    orgId: string,
    input: { id: string; status: string },
  ): Promise<AppointmentPayload> {
    return this.tenant
      .runWithTenant(orgId, async (tx) => {
        await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${input.id}::uuid FOR UPDATE`;
        const current = await tx.appointment.findFirst({
          where: { id: input.id },
        });
        if (!current) throw notFound();
        if (
          !isIn(SETTABLE_STATUSES, input.status) ||
          !canTransition(current.status, input.status)
        ) {
          throw new SchedulingError(
            "INVALID_STATUS_TRANSITION",
            "Mudança de status não permitida.",
            "status",
          );
        }
        const updated = await tx.appointment.update({
          where: { id: current.id },
          data: { status: input.status },
          include: APPOINTMENT_INCLUDE,
        });
        return ok(updated);
      })
      .catch(fail);
  }

  async cancel(
    orgId: string,
    memberId: string,
    input: { id: string; reason: string; reasonTag?: string | null },
  ): Promise<AppointmentPayload> {
    const reason = (input.reason ?? "").trim();
    if (reason.length < 3) {
      return {
        appointment: null,
        errors: [
          {
            code: "REASON_REQUIRED",
            message: "Informe o motivo do cancelamento.",
            field: "reason",
          },
        ],
      };
    }
    const tag = input.reasonTag ?? null;
    if (tag !== null && !isIn(CANCEL_REASON_TAGS, tag)) {
      return {
        appointment: null,
        errors: [
          {
            code: "INVALID_REASON_TAG",
            message: "Motivo padrão inválido.",
            field: "reasonTag",
          },
        ],
      };
    }

    return this.tenant
      .runWithTenant(orgId, async (tx) => {
        await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${input.id}::uuid FOR UPDATE`;
        const current = await tx.appointment.findFirst({
          where: { id: input.id },
        });
        if (!current) throw notFound();
        if (!isIn(CANCELLABLE_STATUSES, current.status)) {
          throw new SchedulingError(
            "INVALID_STATUS",
            "Este agendamento não pode ser cancelado.",
            "id",
          );
        }

        if (current.comandaId) {
          await this.releaseComanda(tx, current.id, current.comandaId, reason);
        }

        const updated = await tx.appointment.update({
          where: { id: current.id },
          data: {
            status: tag === "no_show" ? "no_show" : "cancelled",
            cancelReason: reason,
            cancelReasonTag: tag,
            cancelledAt: new Date(),
            cancelledBy: memberId,
          },
          include: APPOINTMENT_INCLUDE,
        });
        return ok(updated);
      })
      .catch(fail);
  }

  /**
   * Cancelar um agendamento ligado a comanda: comanda fechada bloqueia;
   * remove os itens do agendamento e cancela a comanda quando nada sobra.
   * O sinal NÃO é tocado (já é crédito do cliente — D-03/D-15).
   */
  private async releaseComanda(
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
}

const notFound = () =>
  new SchedulingError("NOT_FOUND", "Agendamento não encontrado.", "id");

function isIn<T extends string>(list: readonly T[], v: string): v is T {
  return (list as readonly string[]).includes(v);
}
