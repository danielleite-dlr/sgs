import { gql, useMutation, useQuery } from '@apollo/client';
import type { AuthPayload, UserError } from '@/features/auth/types';

export interface AdminClient {
  organizationId: string;
  tradeName: string;
  legalName: string;
  email: string;
  phone: string | null;
  subdomain: string;
  segment: string;
  status: string;
  createdAt: string;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerLastLoginAt: string | null;
  ownerMustChangePassword: boolean;
  memberCount: number;
}

export interface PlatformUser {
  userId: string;
  fullName: string;
  email: string;
  isPlatformMaster: boolean;
  canAccessClientOrgs: boolean;
  lastLoginAt: string | null;
}

export interface AdminClientsResult {
  adminClients: AdminClient[];
}

export interface AdminClientPayload {
  client: AdminClient | null;
  temporaryPassword: string | null;
  errors: UserError[];
}

const CLIENT_FIELDS = `
  organizationId
  tradeName
  legalName
  email
  phone
  subdomain
  segment
  status
  createdAt
  ownerUserId
  ownerName
  ownerEmail
  ownerLastLoginAt
  ownerMustChangePassword
  memberCount
`;

const PLATFORM_USER_FIELDS = `
  userId
  fullName
  email
  isPlatformMaster
  canAccessClientOrgs
  lastLoginAt
`;

export const AdminClientsQuery = gql`
  query AdminClients {
    adminClients { ${CLIENT_FIELDS} }
  }
`;

export const AdminPlatformUsersQuery = gql`
  query AdminPlatformUsers {
    adminPlatformUsers { ${PLATFORM_USER_FIELDS} }
  }
`;

export const AdminCreateClientMutation = gql`
  mutation AdminCreateClient($input: AdminCreateClientInput!) {
    adminCreateClient(input: $input) {
      client { ${CLIENT_FIELDS} }
      temporaryPassword
      errors { code message field }
    }
  }
`;

export const AdminUpdateClientMutation = gql`
  mutation AdminUpdateClient($input: AdminUpdateClientInput!) {
    adminUpdateClient(input: $input) {
      client { ${CLIENT_FIELDS} }
      temporaryPassword
      errors { code message field }
    }
  }
`;

export const AdminSetClientStatusMutation = gql`
  mutation AdminSetClientStatus($input: AdminSetClientStatusInput!) {
    adminSetClientStatus(input: $input) {
      client { ${CLIENT_FIELDS} }
      temporaryPassword
      errors { code message field }
    }
  }
`;

export const AdminResetClientPasswordMutation = gql`
  mutation AdminResetClientPassword($input: AdminClientRefInput!) {
    adminResetClientPassword(input: $input) {
      client { ${CLIENT_FIELDS} }
      temporaryPassword
      errors { code message field }
    }
  }
`;

export const AdminSwitchToClientMutation = gql`
  mutation AdminSwitchToClient($input: AdminClientRefInput!) {
    adminSwitchToClient(input: $input) {
      accessToken
      refreshToken
      session {
        userId
        email
        fullName
        isPlatformAdmin
        isPlatformMaster
        canAccessClientOrgs
        mustChangePassword
        impersonating
        memberships {
          memberId
          organizationId
          organizationName
          roleName
          organizationStatus
        }
      }
      errors { code message }
    }
  }
`;

export const AdminSetPlatformAccessMutation = gql`
  mutation AdminSetPlatformAccess($input: AdminSetPlatformAccessInput!) {
    adminSetPlatformAccess(input: $input) {
      users { ${PLATFORM_USER_FIELDS} }
      errors { code message }
    }
  }
`;

export const useAdminClientsQuery = () =>
  useQuery<AdminClientsResult>(AdminClientsQuery);

export const useAdminPlatformUsersQuery = (skip: boolean) =>
  useQuery<{ adminPlatformUsers: PlatformUser[] }>(AdminPlatformUsersQuery, {
    skip,
  });

const refetchClients = [{ query: AdminClientsQuery }];

export const useAdminCreateClientMutation = () =>
  useMutation<{ adminCreateClient: AdminClientPayload }>(
    AdminCreateClientMutation,
    { refetchQueries: refetchClients },
  );

export const useAdminUpdateClientMutation = () =>
  useMutation<{ adminUpdateClient: AdminClientPayload }>(
    AdminUpdateClientMutation,
    { refetchQueries: refetchClients },
  );

export const useAdminSetClientStatusMutation = () =>
  useMutation<{ adminSetClientStatus: AdminClientPayload }>(
    AdminSetClientStatusMutation,
    { refetchQueries: refetchClients },
  );

export const useAdminResetClientPasswordMutation = () =>
  useMutation<{ adminResetClientPassword: AdminClientPayload }>(
    AdminResetClientPasswordMutation,
    { refetchQueries: refetchClients },
  );

export const useAdminSwitchToClientMutation = () =>
  useMutation<{ adminSwitchToClient: AuthPayload }>(AdminSwitchToClientMutation);

export const useAdminSetPlatformAccessMutation = () =>
  useMutation<{
    adminSetPlatformAccess: { users: PlatformUser[]; errors: UserError[] };
  }>(AdminSetPlatformAccessMutation, {
    refetchQueries: [{ query: AdminPlatformUsersQuery }],
  });
