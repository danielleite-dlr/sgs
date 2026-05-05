import { gql, useMutation, useQuery } from '@apollo/client';
import type { AuthPayload, AuthSession } from '../types';

const SIGNUP = gql`
  mutation Signup($input: SignupInput!) {
    signup(input: $input) {
      accessToken
      refreshToken
      session {
        userId
        email
        fullName
        memberships {
          memberId
          organizationId
          organizationName
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

const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      session {
        userId
        email
        fullName
        memberships {
          memberId
          organizationId
          organizationName
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

const VERIFY = gql`
  mutation VerifyEmail($input: VerifyEmailInput!) {
    verifyEmail(input: $input) {
      success
      errors {
        code
        message
      }
    }
  }
`;

const RESEND = gql`
  mutation ResendVerification($input: ResendVerificationInput!) {
    resendVerification(input: $input) {
      success
      cooldownSeconds
      errors {
        code
        message
      }
    }
  }
`;

const REFRESH = gql`
  mutation RefreshSession($input: RefreshInput!) {
    refreshSession(input: $input) {
      accessToken
      refreshToken
      session {
        userId
        email
        fullName
        memberships {
          memberId
          organizationId
          organizationName
          roleName
        }
      }
      errors {
        code
        message
      }
    }
  }
`;

const LOGOUT = gql`
  mutation Logout($input: RefreshInput!) {
    logout(input: $input) {
      success
    }
  }
`;

const ACCEPT = gql`
  mutation AcceptInvitation($input: AcceptInvitationInput!) {
    acceptInvitation(input: $input) {
      accessToken
      refreshToken
      session {
        userId
        email
        fullName
        memberships {
          memberId
          organizationId
          organizationName
          roleName
        }
      }
      errors {
        code
        message
      }
    }
  }
`;

const ME = gql`
  query Me {
    me {
      userId
      email
      fullName
      memberships {
        memberId
        organizationId
        organizationName
        roleName
      }
    }
  }
`;

export const useSignupMutation = () =>
  useMutation<{ signup: AuthPayload }>(SIGNUP);

export const useLoginMutation = () =>
  useMutation<{ login: AuthPayload }>(LOGIN);

export const useVerifyEmailMutation = () =>
  useMutation<{
    verifyEmail: { success: boolean; errors: { code: string; message: string }[] };
  }>(VERIFY);

export const useResendVerificationMutation = () =>
  useMutation<{
    resendVerification: {
      success: boolean;
      cooldownSeconds: number | null;
      errors: { code: string; message: string }[];
    };
  }>(RESEND);

export const useRefreshMutation = () =>
  useMutation<{ refreshSession: AuthPayload }>(REFRESH);

export const useLogoutMutation = () =>
  useMutation<{ logout: { success: boolean } }>(LOGOUT);

export const useAcceptInvitationMutation = () =>
  useMutation<{ acceptInvitation: AuthPayload }>(ACCEPT);

export const useMeQuery = () =>
  useQuery<{ me: AuthSession | null }>(ME);
