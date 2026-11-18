import { gql } from '@apollo/client';
import { COMMERCIAL_DEAL_FIELDS } from './deals.api';
import type {
  CommercialDeal,
  CommercialInteraction,
  CommercialMember,
  CommercialOkPayload,
  CommercialStage,
  UserError,
} from './deals.api';

export type {
  CommercialDeal,
  CommercialInteraction,
  CommercialMember,
  CommercialOkPayload,
  CommercialStage,
};

/** SDL em apps/backend/src/graphql/schema/commercial.graphql. */
export interface CommercialRef {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
}

export interface CommercialLead {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  source: string;
  notes: string | null;
  client: CommercialRef | null;
  createdBy: CommercialMember | null;
  consentAt: string | null;
  createdAt: string;
  openDeals: number;
  lastInteractionAt: string | null;
  deals?: CommercialDeal[];
  interactions?: CommercialInteraction[];
}

export interface CommercialLeadPayload {
  lead: CommercialLead | null;
  errors: UserError[];
}

export interface CommercialDuplicateCheck {
  clients: CommercialRef[];
  leads: CommercialRef[];
}

export interface CommercialLeadFilterInput {
  search?: string | null;
  source?: string | null;
  assigneeMemberId?: string | null;
  unassigned?: boolean | null;
  limit?: number | null;
  offset?: number | null;
}

export interface CreateCommercialLeadInput {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  notes?: string | null;
  clientId?: string | null;
}

export interface UpdateCommercialLeadInput {
  id: string;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  notes?: string | null;
}

const LEAD_FIELDS = gql`
  fragment CommercialLeadFields on CommercialLead {
    id
    fullName
    phone
    email
    source
    notes
    client {
      id
      fullName
      phone
      email
    }
    createdBy {
      id
      displayName
      roleName
    }
    consentAt
    createdAt
    openDeals
    lastInteractionAt
  }
`;

export const CommercialLeadsQuery = gql`
  ${LEAD_FIELDS}
  query CommercialLeads($filter: CommercialLeadFilter) {
    commercialLeads(filter: $filter) {
      total
      items {
        ...CommercialLeadFields
      }
    }
  }
`;

export const CommercialLeadQuery = gql`
  ${LEAD_FIELDS}
  ${COMMERCIAL_DEAL_FIELDS}
  query CommercialLead($id: UUID!, $limit: Int) {
    commercialLead(id: $id) {
      ...CommercialLeadFields
      deals {
        ...CommercialDealFields
      }
      interactions(limit: $limit) {
        id
        leadId
        dealId
        type
        notes
        occurredAt
        reminderId
        createdBy {
          id
          displayName
          roleName
        }
      }
    }
  }
`;

export const CommercialDuplicateCheckQuery = gql`
  query CommercialDuplicateCheck($phone: String, $email: String, $excludeLeadId: UUID) {
    commercialDuplicateCheck(phone: $phone, email: $email, excludeLeadId: $excludeLeadId) {
      clients {
        id
        fullName
        phone
        email
      }
      leads {
        id
        fullName
        phone
        email
      }
    }
  }
`;

export const CommercialAssigneesQuery = gql`
  query CommercialAssignees {
    commercialAssignees {
      id
      displayName
      roleName
    }
  }
`;

export const CommercialStagesQuery = gql`
  query CommercialStages {
    commercialStages {
      id
      name
      color
      position
      slaDays
      kind
      isSystem
      openDeals
    }
  }
`;

export const CreateCommercialLeadMutation = gql`
  ${LEAD_FIELDS}
  mutation CreateCommercialLead($input: CreateCommercialLeadInput!) {
    createCommercialLead(input: $input) {
      lead {
        ...CommercialLeadFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const UpdateCommercialLeadMutation = gql`
  ${LEAD_FIELDS}
  mutation UpdateCommercialLead($input: UpdateCommercialLeadInput!) {
    updateCommercialLead(input: $input) {
      lead {
        ...CommercialLeadFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const LinkCommercialLeadClientMutation = gql`
  ${LEAD_FIELDS}
  mutation LinkCommercialLeadClient($leadId: UUID!, $clientId: UUID) {
    linkCommercialLeadClient(leadId: $leadId, clientId: $clientId) {
      lead {
        ...CommercialLeadFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const DeleteCommercialLeadMutation = gql`
  mutation DeleteCommercialLead($id: UUID!) {
    deleteCommercialLead(id: $id) {
      ok
      errors {
        code
        message
        field
      }
    }
  }
`;
