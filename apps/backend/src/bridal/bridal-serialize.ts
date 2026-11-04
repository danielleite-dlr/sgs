import type { Prisma } from '@prisma/client';

// 'bride' < 'companion' em ordem alfabética: noiva primeiro, depois por sort_order.
export const BRIDAL_GROUP_INCLUDE = {
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

export interface BridalGroupExtras {
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
    appointmentCount: extras.appointmentCount,
    createdAt: row.createdAt,
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
