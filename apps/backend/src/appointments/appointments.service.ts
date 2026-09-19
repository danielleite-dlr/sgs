import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenantContextService } from "../database/tenant-context.service";

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

const errorPayload = (
  code: string,
  message: string,
  field?: string,
): AppointmentPayload => ({
  appointment: null,
  errors: [{ code, message, field: field ?? null }],
});

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
 * AppointmentsService — tenant-isolated professional schedule.
 *
 * Reference rows are checked inside the same RLS-scoped transaction. The
 * database exclusion constraint is a second line of defense for concurrent
 * creates that pass the application-level conflict check at the same time.
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

    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.appointment.findMany({
        where: {
          startsAt: { lt: interval.endsAt },
          endsAt: { gt: interval.startsAt },
          ...(filters.professionalId
            ? { professionalId: filters.professionalId }
            : {}),
        },
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
        include: { professional: true, client: true, service: true },
      }),
    );
  }

  async create(
    orgId: string,
    input: CreateAppointmentInput,
  ): Promise<AppointmentPayload> {
    const interval = parseAppointmentInterval(input.startsAt, input.endsAt);
    if (!interval) {
      return errorPayload(
        "INVALID_INTERVAL",
        "O fim do agendamento deve ser posterior ao início.",
        "endsAt",
      );
    }

    return this.tenant.runWithTenant(orgId, async (tx) => {
      const [professional, client, service] = await Promise.all([
        tx.member.findFirst({
          where: {
            id: input.professionalId,
            status: "active",
            deletedAt: null,
            isProfessional: true,
          },
        }),
        tx.client.findFirst({ where: { id: input.clientId, deletedAt: null } }),
        tx.service.findFirst({
          where: { id: input.serviceId, deletedAt: null },
        }),
      ]);

      if (!professional) {
        return errorPayload(
          "PROFESSIONAL_NOT_FOUND",
          "Profissional ativo não encontrado.",
          "professionalId",
        );
      }
      if (!client) {
        return errorPayload(
          "CLIENT_NOT_FOUND",
          "Cliente ativo não encontrado.",
          "clientId",
        );
      }
      if (!service) {
        return errorPayload(
          "SERVICE_NOT_FOUND",
          "Serviço ativo não encontrado.",
          "serviceId",
        );
      }

      const conflict = await tx.appointment.findFirst({
        where: {
          professionalId: input.professionalId,
          status: { in: ["scheduled", "confirmed"] },
          startsAt: { lt: interval.endsAt },
          endsAt: { gt: interval.startsAt },
        },
        select: { id: true },
      });
      if (conflict) {
        return errorPayload(
          "PROFESSIONAL_UNAVAILABLE",
          "O profissional já possui um agendamento neste intervalo.",
          "professionalId",
        );
      }

      try {
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
          include: { professional: true, client: true, service: true },
        });
        return { appointment, errors: [] };
      } catch (error) {
        // PostgreSQL's exclusion constraint (23P01) protects against a race
        // after the read above. Prisma may expose it as P2004 or its database code.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2004" || error.meta?.code === "23P01")
        ) {
          return errorPayload(
            "PROFESSIONAL_UNAVAILABLE",
            "O profissional já possui um agendamento neste intervalo.",
            "professionalId",
          );
        }
        throw error;
      }
    });
  }
}
