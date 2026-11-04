import { Injectable } from "@nestjs/common";
import { lockOrgExclusive, setLockTimeout } from "../database/advisory-lock";
import { TenantContextService } from "../database/tenant-context.service";
import { BLOCKING_STATUSES } from "./appointment-status";
import { parseAppointmentInterval } from "./appointments.service";
import {
  SCHEDULE_TX_OPTIONS,
  SchedulingError,
  acquireScheduleLocks,
  mapSchedulingError,
} from "./scheduling-guard";

export const TIME_BLOCK_KINDS = [
  "folga",
  "intervalo",
  "feriado",
  "indisponibilidade",
] as const;

/** Bloqueios gerados pelo sistema (grupo de noivas); não são criados/editados à mão. */
export const SYSTEM_TIME_BLOCK_KINDS = ["deslocamento"] as const;

export interface CreateTimeBlockInput {
  kind: string;
  professionalId?: string | null;
  startsAt: Date | string;
  endsAt: Date | string;
  allDay?: boolean | null;
  note?: string | null;
}

type TimeBlockPayload = {
  timeBlock: Record<string, unknown> | null;
  errors: { code: string; message: string; field: string | null }[];
};

const failure = (e: unknown): TimeBlockPayload => {
  const m = mapSchedulingError(e);
  if (m) return { timeBlock: null, errors: [m] };
  throw e;
};

/** Bloqueios de agenda (D-02): folga, intervalo, feriado (org-wide) e indisponibilidade. */
@Injectable()
export class TimeBlocksService {
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
      tx.timeBlock.findMany({
        where: {
          startsAt: { lt: interval.endsAt },
          endsAt: { gt: interval.startsAt },
          ...(filters.professionalId
            ? {
                OR: [
                  { professionalId: filters.professionalId },
                  { professionalId: null },
                ],
              }
            : {}),
        },
        orderBy: { startsAt: "asc" },
      }),
    );
  }

  async create(
    orgId: string,
    memberId: string,
    input: CreateTimeBlockInput,
  ): Promise<TimeBlockPayload> {
    const err = (code: string, message: string, field: string) =>
      ({ timeBlock: null, errors: [{ code, message, field }] }) as TimeBlockPayload;

    if ((SYSTEM_TIME_BLOCK_KINDS as readonly string[]).includes(input.kind)) {
      return err(
        "SYSTEM_BLOCK",
        "Bloqueio de deslocamento é gerado pelo grupo de noivas.",
        "kind",
      );
    }
    if (!(TIME_BLOCK_KINDS as readonly string[]).includes(input.kind)) {
      return err("INVALID_KIND", "Tipo de bloqueio inválido.", "kind");
    }
    const professionalId = input.professionalId ?? null;
    if ((input.kind === "feriado") !== (professionalId === null)) {
      return err(
        "INVALID_SCOPE",
        "Feriado vale para todo o salão; os demais bloqueios exigem um profissional.",
        "professionalId",
      );
    }
    const interval = parseAppointmentInterval(input.startsAt, input.endsAt);
    if (!interval) {
      return err(
        "INVALID_INTERVAL",
        "O fim do bloqueio deve ser posterior ao início.",
        "endsAt",
      );
    }

    return this.tenant
      .runWithTenant(
        orgId,
        async (tx): Promise<TimeBlockPayload> => {
          if (professionalId === null) {
            await setLockTimeout(tx);
            await lockOrgExclusive(tx, orgId);
          } else {
            await acquireScheduleLocks(tx, orgId, [professionalId]);
            const professional = await tx.member.findFirst({
              where: {
                id: professionalId,
                status: "active",
                deletedAt: null,
                isProfessional: true,
              },
              select: { id: true },
            });
            if (!professional) {
              throw new SchedulingError(
                "PROFESSIONAL_NOT_FOUND",
                "Profissional ativo não encontrado.",
                "professionalId",
              );
            }
          }

          const overlapping = await tx.appointment.count({
            where: {
              ...(professionalId ? { professionalId } : {}),
              status: { in: [...BLOCKING_STATUSES] },
              startsAt: { lt: interval.endsAt },
              endsAt: { gt: interval.startsAt },
            },
          });
          if (overlapping > 0) {
            throw new SchedulingError(
              "BLOCK_OVERLAPS_APPOINTMENT",
              `Existe(m) ${overlapping} agendamento(s) neste intervalo. Mova ou cancele antes de bloquear.`,
              "startsAt",
            );
          }

          const timeBlock = await tx.timeBlock.create({
            data: {
              organizationId: orgId,
              professionalId,
              kind: input.kind,
              startsAt: interval.startsAt,
              endsAt: interval.endsAt,
              allDay: input.allDay ?? false,
              note: input.note ?? null,
              createdBy: memberId,
            },
          });
          return { timeBlock, errors: [] };
        },
        SCHEDULE_TX_OPTIONS,
      )
      .catch(failure);
  }

  async delete(orgId: string, id: string): Promise<TimeBlockPayload> {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const found = await tx.timeBlock.findFirst({ where: { id } });
      if (!found) {
        return {
          timeBlock: null,
          errors: [
            { code: "NOT_FOUND", message: "Bloqueio não encontrado.", field: "id" },
          ],
        };
      }
      if ((SYSTEM_TIME_BLOCK_KINDS as readonly string[]).includes(found.kind)) {
        return {
          timeBlock: null,
          errors: [
            {
              code: "SYSTEM_BLOCK",
              message: "Bloqueio de deslocamento é gerado pelo grupo de noivas.",
              field: "id",
            },
          ],
        };
      }
      await tx.timeBlock.delete({ where: { id } });
      return { timeBlock: found, errors: [] };
    });
  }
}
