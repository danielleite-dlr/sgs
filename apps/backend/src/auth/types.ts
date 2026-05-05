export interface JwtAccessPayload {
  sub: string; // user.id
  email: string;
  memberships: Array<{
    memberId: string;
    organizationId: string;
    roleName: string;
  }>;
  iat?: number;
  exp?: number;
}

export class AuthError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_CREDENTIALS'
      | 'ACCOUNT_UNVERIFIED'
      | 'EMAIL_TAKEN'
      | 'ORGANIZATION_TAKEN'
      | 'TOKEN_EXPIRED'
      | 'TOKEN_INVALID'
      | 'TOKEN_ALREADY_USED'
      | 'TOKEN_REUSE_DETECTED'
      | 'INVITATION_EXPIRED'
      | 'INVITATION_USED'
      | 'PASSWORD_TOO_SHORT'
      | 'NAME_TOO_SHORT',
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
