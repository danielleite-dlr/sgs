export interface JwtAccessPayload {
  sub: string; // user.id
  email: string;
  // Papel de plataforma. Viaja no token para o guard não bater no banco a cada
  // request; como o access token dura 15m, uma revogação some em até 15m.
  isPlatformAdmin?: boolean;
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
