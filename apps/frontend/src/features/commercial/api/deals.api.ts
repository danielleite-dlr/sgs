import { gql } from '@apollo/client';

/** SDL em apps/backend/src/graphql/schema/commercial-deals.graphql. */
export interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

export interface CommercialMember {
  id: string;
  displayName: string;
  roleName: string;
}

export interface CommercialStage {
  id: string;
  name: string;
  color: string;
  position: number;
  slaDays: number | null;
  kind: 'open' | 'won' | 'lost';
  isSystem: boolean;
  openDeals: number;
}

export interface CommercialDeal {
  id: string;
  leadId: string;
  lead: { id: string; fullName: string; phone: string | null; email: string | null };
  stage: CommercialStage;
  status: string;
  kind: 'noiva' | 'debutante' | string;
  beneficiaryName: string | null;
  eventDate: string | null;
  package: { id: string; name: string; price: string } | null;
  packageName: string | null;
  packagePrice: string | null;
  discountAmount: string;
  finalAmount: string | null;
  assignee: CommercialMember | null;
  source: string;
  location: string | null;
  notes: string | null;
  stageEnteredAt: string;
  lastInteractionAt: string | null;
  overdue: boolean;
  overdueSince: string | null;
  lostReasonCode: string | null;
  lostReasonText: string | null;
  closedAt: string | null;
  wonContractId: string | null;
  createdAt: string;
}

export interface CommercialInteraction {
  id: string;
  leadId: string;
  dealId: string | null;
  type: string;
  notes: string | null;
  occurredAt: string;
  createdBy: CommercialMember | null;
  reminderId: string | null;
}

export interface CommercialDealPayload {
  deal: CommercialDeal | null;
  errors: UserError[];
}

export interface CommercialOkPayload {
  ok: boolean;
  errors: UserError[];
}

export interface CommercialInteractionPayload {
  interaction: CommercialInteraction | null;
  errors: UserError[];
}

export interface CommercialDealFilterInput {
  stageId?: string | null;
  status?: string | null;
  kind?: string | null;
  leadId?: string | null;
  assigneeMemberId?: string | null;
  unassigned?: boolean | null;
  closedSinceDays?: number | null;
  limit?: number | null;
  offset?: number | null;
}

export interface CreateCommercialDealInput {
  leadId: string;
  kind: string;
  stageId?: string | null;
  eventDate?: string | null;
  beneficiaryName?: string | null;
  packageId?: string | null;
  discountAmount?: string | null;
  assigneeMemberId?: string | null;
  source?: string | null;
  location?: string | null;
  notes?: string | null;
}

export interface UpdateCommercialDealInput {
  id: string;
  kind?: string | null;
  eventDate?: string | null;
  beneficiaryName?: string | null;
  packageId?: string | null;
  discountAmount?: string | null;
  source?: string | null;
  location?: string | null;
  notes?: string | null;
}

export interface CreateCommercialInteractionInput {
  leadId: string;
  dealId?: string | null;
  type: string;
  notes?: string | null;
  occurredAt?: string | null;
  nextContactAt?: string | null;
  nextContactTitle?: string | null;
}

/** Fragmento reusado pelo kanban (09-12). */
export const COMMERCIAL_DEAL_FIELDS = gql`
  fragment CommercialDealFields on CommercialDeal {
    id
    leadId
    lead {
      id
      fullName
      phone
      email
    }
    stage {
      id
      name
      color
      position
      slaDays
      kind
      isSystem
      openDeals
    }
    status
    kind
    beneficiaryName
    eventDate
    package {
      id
      name
      price
    }
    packageName
    packagePrice
    discountAmount
    finalAmount
    assignee {
      id
      displayName
      roleName
    }
    source
    location
    notes
    stageEnteredAt
    lastInteractionAt
    overdue
    overdueSince
    lostReasonCode
    lostReasonText
    closedAt
    wonContractId
    createdAt
  }
`;

export const CommercialDealsQuery = gql`
  ${COMMERCIAL_DEAL_FIELDS}
  query CommercialDeals($filter: CommercialDealFilter) {
    commercialDeals(filter: $filter) {
      total
      items {
        ...CommercialDealFields
      }
    }
  }
`;

export const CommercialDealQuery = gql`
  ${COMMERCIAL_DEAL_FIELDS}
  query CommercialDeal($id: UUID!) {
    commercialDeal(id: $id) {
      ...CommercialDealFields
    }
  }
`;

export const CreateCommercialDealMutation = gql`
  ${COMMERCIAL_DEAL_FIELDS}
  mutation CreateCommercialDeal($input: CreateCommercialDealInput!) {
    createCommercialDeal(input: $input) {
      deal {
        ...CommercialDealFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const UpdateCommercialDealMutation = gql`
  ${COMMERCIAL_DEAL_FIELDS}
  mutation UpdateCommercialDeal($input: UpdateCommercialDealInput!) {
    updateCommercialDeal(input: $input) {
      deal {
        ...CommercialDealFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const MoveCommercialDealMutation = gql`
  ${COMMERCIAL_DEAL_FIELDS}
  mutation MoveCommercialDeal($id: UUID!, $stageId: UUID!) {
    moveCommercialDeal(id: $id, stageId: $stageId) {
      deal {
        ...CommercialDealFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const AssignCommercialDealMutation = gql`
  ${COMMERCIAL_DEAL_FIELDS}
  mutation AssignCommercialDeal($id: UUID!, $assigneeMemberId: UUID) {
    assignCommercialDeal(id: $id, assigneeMemberId: $assigneeMemberId) {
      deal {
        ...CommercialDealFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const LoseCommercialDealMutation = gql`
  ${COMMERCIAL_DEAL_FIELDS}
  mutation LoseCommercialDeal($id: UUID!, $reasonCode: String!, $reasonText: String) {
    loseCommercialDeal(id: $id, reasonCode: $reasonCode, reasonText: $reasonText) {
      deal {
        ...CommercialDealFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const ReopenCommercialDealMutation = gql`
  ${COMMERCIAL_DEAL_FIELDS}
  mutation ReopenCommercialDeal($id: UUID!, $stageId: UUID) {
    reopenCommercialDeal(id: $id, stageId: $stageId) {
      deal {
        ...CommercialDealFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const DeleteCommercialDealMutation = gql`
  mutation DeleteCommercialDeal($id: UUID!) {
    deleteCommercialDeal(id: $id) {
      ok
      errors {
        code
        message
        field
      }
    }
  }
`;

export const CreateCommercialInteractionMutation = gql`
  mutation CreateCommercialInteraction($input: CreateCommercialInteractionInput!) {
    createCommercialInteraction(input: $input) {
      interaction {
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
      errors {
        code
        message
        field
      }
    }
  }
`;
