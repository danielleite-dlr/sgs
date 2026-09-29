import { gql } from "@apollo/client";

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
      isProfessional
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
  isProfessional: boolean;
}

export interface MembersQueryResult {
  members: MemberData[];
}

// ---- Admin team screen (`/profissionais`) — allMembers + member lifecycle ----

export const ROLE_OPTIONS = ['ADMIN', 'MANAGER', 'ATTENDANT', 'PROFESSIONAL'] as const;
export const SENIORITY_OPTIONS = ['junior', 'pleno', 'senior'] as const;

export type MemberStatus = 'active' | 'inactive';
export type SeniorityTier = (typeof SENIORITY_OPTIONS)[number];

export interface AdminMemberData extends MemberData {
  status: MemberStatus;
}

export interface UserErrorData {
  code: string;
  message: string;
  field?: string | null;
}

/**
 * Fetches all members in the organization, active and inactive.
 * Consumed by ProfissionaisPage — never by the agenda/comission pickers
 * (those use `MembersQuery`, which stays active-only and unparameterized).
 */
export const AllMembersQuery = gql`
  query AllMembers {
    allMembers {
      id
      displayName
      email
      roleName
      seniorityTier
      isProfessional
      status
    }
  }
`;

export interface AllMembersResult {
  allMembers: AdminMemberData[];
}

export const UpdateMemberMutation = gql`
  mutation UpdateMember($input: UpdateMemberInput!) {
    updateMember(input: $input) {
      member {
        id
        displayName
        roleName
        seniorityTier
        isProfessional
        status
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export interface UpdateMemberResult {
  updateMember: {
    member: AdminMemberData | null;
    errors: UserErrorData[];
  };
}

export interface BlockingAppointment {
  id: string;
  startsAt: string;
  clientName: string;
  serviceName: string;
}

export const DeactivateMemberMutation = gql`
  mutation DeactivateMember($id: UUID!) {
    deactivateMember(id: $id) {
      member {
        id
        status
      }
      futureAppointmentCount
      blockingAppointments {
        id
        startsAt
        clientName
        serviceName
      }
      activeCommissionRuleCount
      errors {
        code
        message
        field
      }
    }
  }
`;

export interface DeactivateMemberResult {
  deactivateMember: {
    member: { id: string; status: MemberStatus } | null;
    futureAppointmentCount: number;
    blockingAppointments: BlockingAppointment[];
    activeCommissionRuleCount: number;
    errors: UserErrorData[];
  };
}

export const ReactivateMemberMutation = gql`
  mutation ReactivateMember($id: UUID!) {
    reactivateMember(id: $id) {
      member {
        id
        status
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export interface ReactivateMemberResult {
  reactivateMember: {
    member: { id: string; status: MemberStatus } | null;
    errors: UserErrorData[];
  };
}

export const InviteMemberMutation = gql`
  mutation InviteMember($input: InviteMemberInput!) {
    inviteMember(input: $input) {
      invitationId
      expiresAt
      errors {
        code
        message
      }
    }
  }
`;

export interface InviteMemberResult {
  inviteMember: {
    invitationId: string | null;
    expiresAt: string | null;
    errors: UserErrorData[];
  };
}

export const PendingInvitationsQuery = gql`
  query PendingInvitations {
    pendingInvitations {
      id
      email
      roleName
      isProfessional
      seniorityTier
      expiresAt
      createdAt
    }
  }
`;

export interface PendingInvitationData {
  id: string;
  email: string;
  roleName: string;
  isProfessional: boolean;
  seniorityTier?: SeniorityTier | null;
  expiresAt: string;
  createdAt: string;
}

export interface PendingInvitationsResult {
  pendingInvitations: PendingInvitationData[];
}

export const RevokeInvitationMutation = gql`
  mutation RevokeInvitation($invitationId: UUID!) {
    revokeInvitation(invitationId: $invitationId) {
      success
      errors {
        code
        message
      }
    }
  }
`;

export interface RevokeInvitationResult {
  revokeInvitation: {
    success: boolean;
    errors: UserErrorData[];
  };
}
