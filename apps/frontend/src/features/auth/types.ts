export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_UNVERIFIED'
  | 'EMAIL_TAKEN'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_ALREADY_USED'
  | 'TOKEN_REUSE_DETECTED'
  | 'INVITATION_EXPIRED'
  | 'INVITATION_USED'
  | 'PASSWORD_TOO_SHORT'
  | 'NAME_TOO_SHORT'
  | 'FORBIDDEN'
  | 'UNKNOWN';

export interface UserError {
  code: AuthErrorCode;
  message: string;
  field?: string | null;
}

export interface Membership {
  memberId: string;
  organizationId: string;
  organizationName: string;
  roleName: 'ADMIN' | 'MANAGER' | 'ATTENDANT' | 'PROFESSIONAL';
}

export interface AuthSession {
  userId: string;
  email: string;
  fullName: string;
  memberships: Membership[];
}

export interface AuthPayload {
  accessToken: string | null;
  refreshToken: string | null;
  session: AuthSession | null;
  errors: UserError[];
}
