import { gql } from '@apollo/client';
import type { AccessItemData } from './access.api';

export const MemberAccessQuery = gql`
  query MemberAccess($memberId: UUID!) {
    memberAccess(memberId: $memberId) {
      memberId
      displayName
      roleName
      editable
      lockReason
      adjustedCount
      items {
        id
        label
        group
        groupLabel
        enabled
        defaultEnabled
        source
        adjustable
        lockReason
        permissions
      }
    }
  }
`;

export const MemberAccessOverviewQuery = gql`
  query MemberAccessOverview {
    memberAccessOverview {
      memberId
      adjustedCount
    }
  }
`;

export const SetMemberAccessMutation = gql`
  mutation SetMemberAccess($input: SetMemberAccessInput!) {
    setMemberAccess(input: $input) {
      access {
        memberId
        displayName
        roleName
        editable
        lockReason
        adjustedCount
        items {
          id
          label
          group
          groupLabel
          enabled
          defaultEnabled
          source
          adjustable
          lockReason
          permissions
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

export const ResetMemberAccessMutation = gql`
  mutation ResetMemberAccess($memberId: UUID!) {
    resetMemberAccess(memberId: $memberId) {
      access {
        memberId
        displayName
        roleName
        editable
        lockReason
        adjustedCount
        items {
          id
          label
          group
          groupLabel
          enabled
          defaultEnabled
          source
          adjustable
          lockReason
          permissions
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

export interface MemberAccessData {
  memberId: string;
  displayName: string;
  roleName: string;
  editable: boolean;
  lockReason: string | null;
  adjustedCount: number;
  items: AccessItemData[];
}

export interface MemberAccessResult {
  memberAccess: MemberAccessData;
}

export interface MemberAccessSummaryData {
  memberId: string;
  adjustedCount: number;
}

export interface MemberAccessOverviewResult {
  memberAccessOverview: MemberAccessSummaryData[];
}

export interface AccessUserError {
  code: string;
  message: string;
  field?: string | null;
}

export interface SetMemberAccessResult {
  setMemberAccess: { access: MemberAccessData | null; errors: AccessUserError[] };
}

export interface ResetMemberAccessResult {
  resetMemberAccess: { access: MemberAccessData | null; errors: AccessUserError[] };
}
