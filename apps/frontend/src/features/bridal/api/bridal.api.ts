import { gql } from '@apollo/client';

/** Campos do grupo sem agendamentos (usado na listagem — appointments pode carregar até 1000). */
export const BRIDAL_GROUP_LIST_FIELDS = gql`
  fragment BridalGroupListFields on BridalGroup {
    id
    name
    eventDate
    readyBy
    locationKind
    locationAddress
    travelMinutesBefore
    travelMinutesAfter
    status
    notes
    cancelReason
    contractId
    contractCode
    contractStatus
    appointmentCount
    createdAt
    members {
      id
      clientId
      clientName
      clientPhone
      role
      relationLabel
      coveredByContract
      hasClosedComanda
      services {
        id
        serviceId
        serviceName
        durationMinutes
        purpose
      }
    }
  }
`;

export const BRIDAL_GROUP_FIELDS = gql`
  fragment BridalGroupFields on BridalGroup {
    ...BridalGroupListFields
    appointments {
      id
      groupMemberId
      clientName
      serviceName
      professionalId
      professionalName
      startsAt
      endsAt
      status
      purpose
      covered
      comandaId
      comandaStatus
    }
  }
  ${BRIDAL_GROUP_LIST_FIELDS}
`;

export const BridalGroupsQuery = gql`
  query BridalGroups($status: String, $from: String, $to: String) {
    bridalGroups(status: $status, from: $from, to: $to) {
      ...BridalGroupListFields
    }
  }
  ${BRIDAL_GROUP_LIST_FIELDS}
`;

export const BridalGroupQuery = gql`
  query BridalGroup($id: UUID!) {
    bridalGroup(id: $id) {
      ...BridalGroupFields
    }
  }
  ${BRIDAL_GROUP_FIELDS}
`;

export const CreateBridalGroupMutation = gql`
  mutation CreateBridalGroup($input: CreateBridalGroupInput!) {
    createBridalGroup(input: $input) {
      group {
        ...BridalGroupFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${BRIDAL_GROUP_FIELDS}
`;

export const UpdateBridalGroupMutation = gql`
  mutation UpdateBridalGroup($id: UUID!, $input: BridalGroupFieldsInput!) {
    updateBridalGroup(id: $id, input: $input) {
      group {
        ...BridalGroupFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${BRIDAL_GROUP_FIELDS}
`;

export const AddBridalGroupMemberMutation = gql`
  mutation AddBridalGroupMember($groupId: UUID!, $person: BridalPersonInput!) {
    addBridalGroupMember(groupId: $groupId, person: $person) {
      group {
        ...BridalGroupFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${BRIDAL_GROUP_FIELDS}
`;

export const RemoveBridalGroupMemberMutation = gql`
  mutation RemoveBridalGroupMember($memberId: UUID!) {
    removeBridalGroupMember(memberId: $memberId) {
      group {
        ...BridalGroupFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${BRIDAL_GROUP_FIELDS}
`;

export const SetBridalMemberCoverageMutation = gql`
  mutation SetBridalMemberCoverage($memberId: UUID!, $covered: Boolean!) {
    setBridalMemberCoverage(memberId: $memberId, covered: $covered) {
      group {
        ...BridalGroupFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${BRIDAL_GROUP_FIELDS}
`;

export const SetBridalMemberServicesMutation = gql`
  mutation SetBridalMemberServices($memberId: UUID!, $services: [BridalMemberServiceInput!]!) {
    setBridalMemberServices(memberId: $memberId, services: $services) {
      group {
        ...BridalGroupFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${BRIDAL_GROUP_FIELDS}
`;

export const ScheduleBridalEventMutation = gql`
  mutation ScheduleBridalEvent($input: ScheduleBridalEventInput!) {
    scheduleBridalEvent(input: $input) {
      appointmentIds
      group {
        ...BridalGroupFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${BRIDAL_GROUP_FIELDS}
`;

export const CancelBridalGroupMutation = gql`
  mutation CancelBridalGroup($input: CancelBridalGroupInput!) {
    cancelBridalGroup(input: $input) {
      group {
        ...BridalGroupFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${BRIDAL_GROUP_FIELDS}
`;

// ---- Tipos manuais ----

export interface BridalUserError {
  code: string;
  message: string;
  field?: string | null;
}

export interface BridalMemberServiceData {
  id: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  purpose: string;
}

export interface BridalMemberData {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  role: string;
  relationLabel: string | null;
  coveredByContract: boolean;
  hasClosedComanda: boolean;
  services: BridalMemberServiceData[];
}

export interface BridalAppointmentData {
  id: string;
  groupMemberId: string | null;
  clientName: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  purpose: string | null;
  covered: boolean;
  comandaId: string | null;
  comandaStatus: string | null;
}

export interface BridalGroupData {
  id: string;
  name: string;
  eventDate: string;
  readyBy: string | null;
  locationKind: string;
  locationAddress: string | null;
  travelMinutesBefore: number;
  travelMinutesAfter: number;
  status: string;
  notes: string | null;
  cancelReason: string | null;
  contractId: string | null;
  contractCode: string | null;
  contractStatus: string | null;
  appointmentCount: number;
  createdAt: string;
  members: BridalMemberData[];
  /** Só vem no detalhe (BridalGroupFields). */
  appointments?: BridalAppointmentData[];
}

export interface BridalGroupsResult {
  bridalGroups: BridalGroupData[];
}
export interface BridalGroupResult {
  bridalGroup: BridalGroupData | null;
}

export interface BridalGroupPayload {
  group: BridalGroupData | null;
  errors: BridalUserError[];
}

export interface BridalMemberServiceInput {
  serviceId: string;
  purpose?: string;
}

export interface BridalPersonInput {
  clientId?: string;
  newClient?: { fullName: string; phone?: string };
  relationLabel?: string;
  coveredByContract?: boolean;
  services?: BridalMemberServiceInput[];
}

export interface BridalGroupFieldsInput {
  name: string;
  eventDate: string;
  readyBy?: string | null;
  locationKind?: string;
  locationAddress?: string | null;
  travelMinutesBefore?: number;
  travelMinutesAfter?: number;
  notes?: string | null;
}

export interface CreateBridalGroupInput {
  group: BridalGroupFieldsInput;
  bride: BridalPersonInput;
  companions?: BridalPersonInput[];
}

export interface BridalScheduleItemInput {
  groupMemberId: string;
  serviceId: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  purpose?: string;
}

export interface BridalDepositInput {
  groupMemberId: string;
  amount: string;
  method: string;
}
