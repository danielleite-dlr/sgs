import { gql } from '@apollo/client';

export const CommissionRulesQuery = gql`
  query CommissionRules {
    commissionRules {
      id
      scopeType
      kind
      value
      member {
        id
        displayName
      }
      service {
        id
        name
      }
      category {
        id
        name
      }
      product {
        id
        name
      }
      createdAt
      updatedAt
    }
  }
`;

export const CreateCommissionRuleMutation = gql`
  mutation CreateCommissionRule($input: CreateCommissionRuleInput!) {
    createCommissionRule(input: $input) {
      rule {
        id
        scopeType
        kind
        value
        member {
          id
          displayName
        }
        service {
          id
          name
        }
        category {
          id
          name
        }
        product {
          id
          name
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

export const UpdateCommissionRuleMutation = gql`
  mutation UpdateCommissionRule($input: UpdateCommissionRuleInput!) {
    updateCommissionRule(input: $input) {
      rule {
        id
        scopeType
        kind
        value
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const SoftDeleteCommissionRuleMutation = gql`
  mutation SoftDeleteCommissionRule($input: SoftDeleteInput!) {
    softDeleteCommissionRule(input: $input) {
      rule {
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

// ---- TypeScript response shapes ----

export type CommissionScopeType = 'member_service' | 'service' | 'category' | 'product' | 'default';
export type CommissionKind = 'fixed' | 'percentage';

export interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

export interface CommissionRuleData {
  id: string;
  scopeType: CommissionScopeType;
  kind: CommissionKind;
  value: string;
  member?: { id: string; displayName: string } | null;
  service?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  product?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionRulePayload {
  rule: CommissionRuleData | null;
  errors: UserError[];
}

export interface CommissionRulesQueryResult {
  commissionRules: CommissionRuleData[];
}

export interface CreateCommissionRuleResult {
  createCommissionRule: CommissionRulePayload;
}

export interface UpdateCommissionRuleResult {
  updateCommissionRule: CommissionRulePayload;
}

export interface SoftDeleteCommissionRuleResult {
  softDeleteCommissionRule: CommissionRulePayload;
}
