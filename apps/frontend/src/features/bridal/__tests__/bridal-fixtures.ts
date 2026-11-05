import type { BridalGroupData, BridalMemberData } from '../api/bridal.api';

export function member(p: Partial<BridalMemberData> & { id: string }): BridalMemberData & {
  __typename: string;
} {
  return {
    __typename: 'BridalGroupMember',
    clientId: `c-${p.id}`,
    clientName: `Pessoa ${p.id}`,
    clientPhone: null,
    role: 'companion',
    relationLabel: null,
    coveredByContract: false,
    hasClosedComanda: false,
    services: [],
    ...p,
  };
}

export function group(p: Partial<BridalGroupData> & { id: string }): BridalGroupData & {
  __typename: string;
} {
  return {
    __typename: 'BridalGroup',
    name: `Grupo ${p.id}`,
    eventDate: '2026-12-05',
    readyBy: null,
    locationKind: 'studio',
    locationAddress: null,
    locationName: null,
    eventKind: 'noiva',
    responsibleClientId: null,
    responsibleName: null,
    eventTime: null,
    travelMinutesBefore: 0,
    travelMinutesAfter: 0,
    status: 'active',
    notes: null,
    cancelReason: null,
    contractId: null,
    contractCode: null,
    contractStatus: null,
    packageId: null,
    packageName: null,
    appointmentCount: 0,
    createdAt: '2026-11-01T12:00:00.000Z',
    members: [],
    appointments: [],
    ...p,
  };
}

/** Grupo de debutante com responsável, horário e local preenchidos. */
export function debutanteGroup(p: Partial<BridalGroupData> & { id: string }) {
  return group({
    eventKind: 'debutante',
    responsibleClientId: 'resp-1',
    responsibleName: 'Marta Souza',
    eventTime: '19:30',
    locationName: 'Salão Aurora',
    locationAddress: 'Rua das Flores, 100',
    ...p,
  });
}
