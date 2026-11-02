import { gql } from "@apollo/client";

export const APPOINTMENT_FIELDS = gql`
  fragment AppointmentFields on Appointment {
    id
    professionalId
    clientId
    serviceId
    serviceVariantId
    comandaId
    comandaCode
    comandaStatus
    depositAmount
    startsAt
    endsAt
    status
    notes
    cancelReason
    cancelReasonTag
    cancelledAt
    client {
      id
      fullName
    }
    professional {
      id
      displayName
    }
    service {
      id
      name
      defaultDurationMinutes
      category {
        id
        name
      }
    }
  }
`;

export const AppointmentsQuery = gql`
  query Appointments(
    $startsAt: DateTime!
    $endsAt: DateTime!
    $professionalId: UUID
  ) {
    appointments(
      startsAt: $startsAt
      endsAt: $endsAt
      professionalId: $professionalId
    ) {
      ...AppointmentFields
    }
  }
  ${APPOINTMENT_FIELDS}
`;

export const CreateAppointmentMutation = gql`
  mutation CreateAppointment($input: CreateAppointmentInput!) {
    createAppointment(input: $input) {
      appointment {
        ...AppointmentFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${APPOINTMENT_FIELDS}
`;

export const MoveAppointmentMutation = gql`
  mutation MoveAppointment($input: MoveAppointmentInput!) {
    moveAppointment(input: $input) {
      appointment {
        ...AppointmentFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${APPOINTMENT_FIELDS}
`;

export const TimeBlocksQuery = gql`
  query TimeBlocks($startsAt: DateTime!, $endsAt: DateTime!, $professionalId: UUID) {
    timeBlocks(startsAt: $startsAt, endsAt: $endsAt, professionalId: $professionalId) {
      id
      kind
      professionalId
      startsAt
      endsAt
      allDay
      note
    }
  }
`;

export interface TimeBlockData {
  id: string;
  kind: 'folga' | 'intervalo' | 'feriado' | 'indisponibilidade';
  professionalId: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  note: string | null;
}
export interface TimeBlocksQueryResult {
  timeBlocks: TimeBlockData[];
}

export interface AppointmentData {
  id: string;
  professionalId: string;
  clientId: string;
  serviceId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
  serviceVariantId: string | null;
  comandaId: string | null;
  comandaCode: string | null;
  comandaStatus: string | null;
  depositAmount: string;
  cancelReason: string | null;
  cancelReasonTag: string | null;
  cancelledAt: string | null;
  client: { id: string; fullName: string };
  professional: { id: string; displayName: string };
  service: {
    id: string;
    name: string;
    defaultDurationMinutes?: number;
    category?: { id: string; name: string } | null;
  };
}

export interface AppointmentUserError {
  code: string;
  message: string;
  field?: string | null;
}
export interface AppointmentsQueryResult {
  appointments: AppointmentData[];
}
export interface MoveAppointmentResult {
  moveAppointment: {
    appointment: AppointmentData | null;
    errors: AppointmentUserError[];
  };
}
export interface CreateAppointmentResult {
  createAppointment: {
    appointment: AppointmentData | null;
    errors: AppointmentUserError[];
  };
}

/** Profissionais ativos que atendem a categoria do serviço (filtro no backend). */
export const ProfessionalsForServiceQuery = gql`
  query ProfessionalsForService($serviceId: UUID!) {
    professionalsForService(serviceId: $serviceId) {
      id
      displayName
    }
  }
`;

export interface ProfessionalsForServiceResult {
  professionalsForService: { id: string; displayName: string }[];
}

// ─── Visita (agendamento multi-serviço + sinal) ──────────────────────────────

export interface CreateVisitInputVars {
  clientId: string;
  items: {
    serviceId: string;
    serviceVariantId: string | null;
    professionalId: string;
    startsAt: string;
    endsAt: string;
  }[];
  packageId: string | null;
  deposit: { amount: string; method: string } | null;
  notes?: string | null;
}

export const CreateVisitMutation = gql`
  mutation CreateVisit($input: CreateVisitInput!) {
    createVisit(input: $input) {
      appointments {
        ...AppointmentFields
      }
      comandaId
      errors {
        code
        message
        field
      }
    }
  }
  ${APPOINTMENT_FIELDS}
`;

export interface CreateVisitResult {
  createVisit: {
    appointments: AppointmentData[];
    comandaId: string | null;
    errors: AppointmentUserError[];
  };
}

export const UpdateAppointmentStatusMutation = gql`
  mutation UpdateAppointmentStatus($input: UpdateAppointmentStatusInput!) {
    updateAppointmentStatus(input: $input) {
      appointment {
        ...AppointmentFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${APPOINTMENT_FIELDS}
`;

export interface UpdateAppointmentStatusResult {
  updateAppointmentStatus: {
    appointment: AppointmentData | null;
    errors: AppointmentUserError[];
  };
}

export const CancelAppointmentMutation = gql`
  mutation CancelAppointment($input: CancelAppointmentInput!) {
    cancelAppointment(input: $input) {
      appointment {
        ...AppointmentFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${APPOINTMENT_FIELDS}
`;

export interface CancelAppointmentResult {
  cancelAppointment: {
    appointment: AppointmentData | null;
    errors: AppointmentUserError[];
  };
}

export const CreateTimeBlockMutation = gql`
  mutation CreateTimeBlock($input: CreateTimeBlockInput!) {
    createTimeBlock(input: $input) {
      timeBlock {
        id
        kind
        professionalId
        startsAt
        endsAt
        allDay
        note
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const DeleteTimeBlockMutation = gql`
  mutation DeleteTimeBlock($id: UUID!) {
    deleteTimeBlock(id: $id) {
      timeBlock {
        id
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export interface CreateTimeBlockResult {
  createTimeBlock: { timeBlock: TimeBlockData | null; errors: AppointmentUserError[] };
}
export interface DeleteTimeBlockResult {
  deleteTimeBlock: { timeBlock: { id: string } | null; errors: AppointmentUserError[] };
}

/** Pacotes com a duração padrão dos serviços (usada para expandir as linhas da visita). */
export const VisitPackagesQuery = gql`
  query VisitPackages {
    packages {
      id
      name
      services {
        serviceId
        quantity
        displayOrder
        service {
          id
          name
          defaultDurationMinutes
        }
      }
    }
  }
`;

export interface VisitPackageData {
  id: string;
  name: string;
  services: {
    serviceId: string;
    quantity: number;
    displayOrder: number;
    service: { id: string; name: string; defaultDurationMinutes: number };
  }[];
}
export interface VisitPackagesResult {
  packages: VisitPackageData[];
}
