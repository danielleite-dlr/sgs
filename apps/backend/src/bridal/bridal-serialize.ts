import type { Prisma } from '@prisma/client';
import { isAssistantEligible, isAssistantPending } from './bridal-assistant-rules';

// 'bride' < 'companion' em ordem alfabética: noiva primeiro, depois por sort_order.
export const BRIDAL_GROUP_INCLUDE = {
  package: { select: { id: true, name: true, includesBridalAssistant: true, deletedAt: true } },
  assistant: { select: { id: true, displayName: true } },
  responsible: { select: { fullName: true } },
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
  /** Agendamentos ativos do grupo (BLOCKING), para o "falta agendar" (quick 261124-n98). */
  activeAppointments?: ActiveAppointmentKey[];
  closedComandaClientIds: Set<string>;
  /** Hoje (YYYY-MM-DD) no fuso da org, para a pendência da assistente. */
  todayYmd: string;
  /** Comanda do evento da noiva já fechada (09.1 D-17). */
  eventComandaClosed: boolean;
}

export interface ActiveAppointmentKey {
  clientId: string;
  serviceId: string;
  purpose: string | null;
}

/**
 * Serviços do evento de cada pessoa sem agendamento ativo no grupo (quick 261124-n98). Cada
 * agendamento cobre um serviço planejado (mesma cliente + serviço); purpose nulo conta como evento.
 */
export function unscheduledEventServices(
  members: { id: string; clientId: string; services: { serviceId: string; purpose: string }[] }[],
  active: ActiveAppointmentKey[],
): Map<string, string[]> {
  const left = active
    .filter((a) => a.purpose !== 'trial')
    .map((a) => `${a.clientId}:${a.serviceId}`);
  const out = new Map<string, string[]>();
  for (const m of members) {
    const missing: string[] = [];
    for (const s of m.services) {
      if (s.purpose !== 'event') continue;
      const i = left.indexOf(`${m.clientId}:${s.serviceId}`);
      if (i >= 0) left.splice(i, 1);
      else missing.push(s.serviceId);
    }
    out.set(m.id, missing);
  }
  return out;
}

export function serializeBridalGroup(row: BridalGroupRow, extras: BridalGroupExtras) {
  const active = extras.activeAppointments ?? [];
  const missing = unscheduledEventServices(row.members, active);
  const hasEventSchedule = active.some((a) => a.purpose !== 'trial');
  const totalMissing = [...missing.values()].reduce((n, l) => n + l.length, 0);
  const eventDateYmd = row.eventDate.toISOString().slice(0, 10);
  const assistantLike = {
    eventKind: row.eventKind,
    locationKind: row.locationKind,
    status: row.status,
    pkg: row.package,
  };
  return {
    id: row.id,
    name: row.name,
    eventDate: eventDateYmd,
    readyBy: row.readyBy,
    companionsReadyBy: row.companionsReadyBy ?? null,
    locationKind: row.locationKind,
    locationAddress: row.locationAddress,
    locationName: row.locationName,
    eventKind: row.eventKind,
    eventTime: row.eventTime,
    responsibleClientId: row.responsibleClientId,
    responsibleName: row.responsible?.fullName ?? null,
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
    // Só conta depois que a agenda do evento foi montada: antes disso tudo está "por agendar".
    unscheduledServiceCount: hasEventSchedule ? totalMissing : 0,
    assistantRequired: isAssistantEligible(assistantLike),
    assistantPending: isAssistantPending({
      ...assistantLike,
      assistantMemberId: row.assistantMemberId,
      eventDateYmd,
      todayYmd: extras.todayYmd,
      eventComandaClosed: extras.eventComandaClosed,
    }),
    assistantMemberId: row.assistantMemberId,
    assistantName: row.assistant?.displayName ?? null,
    assistantDailyRate: row.assistantDailyRate ? row.assistantDailyRate.toFixed(2) : null,
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
      unscheduledServiceIds: missing.get(m.id) ?? [],
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
