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
        rg
        postalCode
        phone2
        phone3
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
      rg
      postalCode
      phone2
      phone3
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
      entityType
      entityId
    }
  }
`;

export interface ClientHistoryItemData {
  id: string;
  occurredAt: string;
  /** appointment | comanda | product | contract_payment */
  kind: string;
  description: string;
  amount: string | null;
  professionalName: string | null;
  /** appointment | comanda | contract */
  entityType: string | null;
  entityId: string | null;
}

export interface ClientHistoryResult {
  clientHistory: ClientHistoryItemData[];
}

export const ClientOverviewQuery = gql`
  query ClientOverview($clientId: UUID!) {
    clientOverview(clientId: $clientId) {
      bridalGroups {
        id
        name
        eventKind
        role
        eventDate
        eventTime
        status
        trialDates
      }
      contracts {
        id
        code
        status
        groupId
        groupName
        totalAmount
        paid
        balance
        nextDueDate
        nextDueAmount
      }
      upcomingAppointments {
        id
        startsAt
        endsAt
        status
        serviceName
        professionalName
        kind
        comandaId
        bridalGroupId
      }
      openComandas {
        id
        code
        openedAt
        firstAppointmentAt
        total
        serviceNames
        professionalNames
      }
      stats {
        completedCount
        lastVisitAt
        totalSpent
        creditBalance
      }
    }
  }
`;

export interface ClientOpenComandaData {
  id: string;
  code: string;
  openedAt: string;
  firstAppointmentAt: string | null;
  total: string;
  serviceNames: string[];
  professionalNames: string[];
}

export interface ClientOverviewData {
  bridalGroups: {
    id: string;
    name: string;
    eventKind: string;
    /** bride | debutante | companion | responsible */
    role: string;
    /** YYYY-MM-DD */
    eventDate: string;
    eventTime: string | null;
    status: string;
    trialDates: string[];
  }[];
  contracts: {
    id: string;
    code: string;
    status: string;
    groupId: string;
    groupName: string;
    totalAmount: string;
    paid: string;
    balance: string;
    nextDueDate: string | null;
    nextDueAmount: string | null;
  }[];
  upcomingAppointments: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    serviceName: string;
    professionalName: string;
    /** trial | event | normal */
    kind: string;
    comandaId: string | null;
    bridalGroupId: string | null;
  }[];
  openComandas: ClientOpenComandaData[];
  stats: {
    completedCount: number;
    lastVisitAt: string | null;
    totalSpent: string;
    creditBalance: string;
  };
}

export interface ClientOverviewResult {
  clientOverview: ClientOverviewData;
}

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
        rg
        postalCode
        phone2
        phone3
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
        rg
        postalCode
        phone2
        phone3
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
  rg: string | null;
  postalCode: string | null;
  phone2: string | null;
  phone3: string | null;
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
