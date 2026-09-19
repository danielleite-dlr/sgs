import { gql } from "@apollo/client";

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
      id
      professionalId
      clientId
      serviceId
      startsAt
      endsAt
      status
      notes
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
        category {
          id
          name
        }
      }
    }
  }
`;

export const CreateAppointmentMutation = gql`
  mutation CreateAppointment($input: CreateAppointmentInput!) {
    createAppointment(input: $input) {
      appointment {
        id
        professionalId
        clientId
        serviceId
        startsAt
        endsAt
        status
        notes
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
          category {
            id
            name
          }
        }
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export interface AppointmentData {
  id: string;
  professionalId: string;
  clientId: string;
  serviceId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
  client: { id: string; fullName: string };
  professional: { id: string; displayName: string };
  service: {
    id: string;
    name: string;
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
export interface CreateAppointmentResult {
  createAppointment: {
    appointment: AppointmentData | null;
    errors: AppointmentUserError[];
  };
}
