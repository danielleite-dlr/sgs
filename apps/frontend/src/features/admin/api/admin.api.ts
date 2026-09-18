import { gql, useMutation, useQuery } from '@apollo/client';

export interface AdminClient {
  organizationId: string;
  tradeName: string;
  email: string;
  subdomain: string;
  status: string;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerLastLoginAt: string | null;
  memberCount: number;
}

export interface AdminClientsResult {
  adminClients: AdminClient[];
}

export interface AdminCreateClientResult {
  adminCreateClient: {
    client: AdminClient | null;
    errors: Array<{ code: string; message: string; field?: string | null }>;
  };
}

export const AdminClientsQuery = gql`
  query AdminClients {
    adminClients {
      organizationId
      tradeName
      email
      subdomain
      status
      createdAt
      ownerName
      ownerEmail
      ownerLastLoginAt
      memberCount
    }
  }
`;

export const AdminCreateClientMutation = gql`
  mutation AdminCreateClient($input: AdminCreateClientInput!) {
    adminCreateClient(input: $input) {
      client {
        organizationId
        tradeName
        email
        subdomain
        status
        createdAt
        ownerName
        ownerEmail
        ownerLastLoginAt
        memberCount
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const useAdminClientsQuery = () =>
  useQuery<AdminClientsResult>(AdminClientsQuery);

export const useAdminCreateClientMutation = () =>
  useMutation<AdminCreateClientResult>(AdminCreateClientMutation, {
    refetchQueries: [{ query: AdminClientsQuery }],
  });
