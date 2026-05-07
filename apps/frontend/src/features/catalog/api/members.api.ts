import { gql } from '@apollo/client';

/**
 * Fetches all members in the organization.
 * Consumed by CommissionRuleForm's member picker (MemberCombobox).
 * Server-side gated by MEMBER_READ permission — added in Plan 05 identity.graphql.
 */
export const MembersQuery = gql`
  query Members {
    members {
      id
      displayName
      email
      roleName
      seniorityTier
    }
  }
`;

// ---- TypeScript response shapes ----

export interface MemberData {
  id: string;
  displayName: string;
  email: string;
  roleName: string;
  seniorityTier?: string | null;
}

export interface MembersQueryResult {
  members: MemberData[];
}
