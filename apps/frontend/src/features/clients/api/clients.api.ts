import { gql } from '@apollo/client';

// ===== Queries =====

export const ClientsListQuery = gql`
  query ClientsList($search: String, $limit: Int, $offset: Int) {
    clients(search: $search, limit: $limit, offset: $offset) {
      rows {
        id
        fullName
        phone
        email
        cpf
        birthDate
        address
        notes
        createdAt
        updatedAt
      }
      totalCount
    }
  }
`;

export const ClientByIdQuery = gql`
  query ClientById($id: UUID!) {
    client(id: $id) {
      id
      fullName
      phone
      email
      cpf
      birthDate
      address
      notes
      createdAt
      updatedAt
    }
  }
`;

export const ClientsByFieldQuery = gql`
  query ClientsByField($cpf: String, $phone: String, $email: String, $excludeId: UUID) {
    clientsByField(cpf: $cpf, phone: $phone, email: $email, excludeId: $excludeId) {
      id
      fullName
      phone
      email
      cpf
    }
  }
`;

export const ClientHistoryQuery = gql`
  query ClientHistory($clientId: UUID!, $filters: ClientHistoryFilters) {
    clientHistory(clientId: $clientId, filters: $filters) {
      id
      occurredAt
      kind
      description
      amount
      professionalName
    }
  }
`;

// ===== Mutations =====

export const CreateClientMutation = gql`
  mutation CreateClient($input: CreateClientInput!) {
    createClient(input: $input) {
      client {
        id
        fullName
        phone
        email
        cpf
        birthDate
        address
        notes
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const UpdateClientMutation = gql`
  mutation UpdateClient($input: UpdateClientInput!) {
    updateClient(input: $input) {
      client {
        id
        fullName
        phone
        email
        cpf
        birthDate
        address
        notes
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const SoftDeleteClientMutation = gql`
  mutation SoftDeleteClient($input: SoftDeleteInput!) {
    softDeleteClient(input: $input) {
      client {
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

export const RestoreClientMutation = gql`
  mutation RestoreClient($input: SoftDeleteInput!) {
    restoreClient(input: $input) {
      client {
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

// ===== TypeScript response shapes =====

export interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

export interface ClientData {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  birthDate: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPayload {
  client: ClientData | null;
  errors: UserError[];
}

export interface ClientsListResult {
  clients: {
    rows: ClientData[];
    totalCount: number;
  };
}

export interface ClientByIdResult {
  client: ClientData | null;
}

export interface ClientsByFieldResult {
  clientsByField: Pick<ClientData, 'id' | 'fullName' | 'phone' | 'email' | 'cpf'>[];
}

export interface CreateClientResult {
  createClient: ClientPayload;
}

export interface UpdateClientResult {
  updateClient: ClientPayload;
}

export interface SoftDeleteClientResult {
  softDeleteClient: ClientPayload;
}

export interface RestoreClientResult {
  restoreClient: ClientPayload;
}
