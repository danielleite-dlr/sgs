import type { Prisma } from '@prisma/client';

// 'bride' < 'companion' em ordem alfabética: noiva primeiro, depois por sort_order.
export const BRIDAL_GROUP_INCLUDE = {
  package: { select: { id: true, name: true } },
  members: {
    orderBy: [{ role: 'asc' }, { sortOrder: 'asc' }],
    include: {
      client: { select: { id: true, fullName: true, phone: true } },
      services: {
        orderBy: { sortOrder: 'asc' },
        include: {
          service: { select: { name: true, defaultDurationMinutes: true } },
        },
      },
    },
  },
} satisfies Prisma.BridalGroupInclude;

export type BridalGroupRow = Prisma.BridalGroupGetPayload<{
  include: typeof BRIDAL_GROUP_INCLUDE;
}>;

export const BRIDAL_APPOINTMENT_INCLUDE = {
  client: { select: { fullName: true } },
  service: { select: { name: true } },
  professional: { select: { id: true, displayName: true } },
  comanda: { select: { status: true } },
} satisfies Prisma.AppointmentInclude;

export type BridalAppointmentRow = Prisma.AppointmentGetPayload<{
  include: typeof BRIDAL_APPOINTMENT_INCLUDE;
}>;

export interface BridalGroupExtras {
  appointments?: BridalAppointmentRow[];
  groupMemberIdByClient?: Map<string, string>;
  contract?: { id: string; code: string; status: string } | null;
  appointmentCount: number;
  closedComandaClientIds: Set<string>;
}

export function serializeBridalGroup(row: BridalGroupRow, extras: BridalGroupExtras) {
  return {
    id: row.id,
    name: row.name,
    eventDate: row.eventDate.toISOString().slice(0, 10),
    readyBy: row.readyBy,
    locationKind: row.locationKind,
    locationAddress: row.locationAddress,
    travelMinutesBefore: row.travelMinutesBefore,
    travelMinutesAfter: row.travelMinutesAfter,
    status: row.status,
    notes: row.notes,
    cancelReason: row.cancelReason,
    contractId: extras.contract?.id ?? null,
    contractCode: extras.contract?.code ?? null,
    contractStatus: extras.contract?.status ?? null,
    // pacote soft-deleted continua com o nome: é o histórico do que foi contratado
    packageId: row.packageId,
    packageName: row.package?.name ?? null,
    appointmentCount: extras.appointmentCount,
    createdAt: row.createdAt,
    appointments: (extras.appointments ?? []).map((a) => ({
      id: a.id,
      groupMemberId: extras.groupMemberIdByClient?.get(a.clientId) ?? null,
      clientName: a.client.fullName,
      serviceName: a.service.name,
      professionalId: a.professionalId,
      professionalName: a.professional.displayName,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      status: a.status,
      purpose: a.purpose,
      covered: a.contractId !== null,
      comandaId: a.comandaId,
      comandaStatus: a.comanda?.status ?? null,
    })),
    members: row.members.map((m) => ({
      id: m.id,
      clientId: m.clientId,
      clientName: m.client.fullName,
      clientPhone: m.client.phone,
      role: m.role,
      relationLabel: m.relationLabel,
      coveredByContract: m.coveredByContract,
      hasClosedComanda: extras.closedComandaClientIds.has(m.clientId),
      services: m.services.map((s) => ({
        id: s.id,
        serviceId: s.serviceId,
        serviceName: s.service.name,
        durationMinutes: s.service.defaultDurationMinutes,
        purpose: s.purpose,
      })),
    })),
  };
}
