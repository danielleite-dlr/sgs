export interface JwtAccessPayload {
  sub: string; // user.id
  email: string;
  // Papel de plataforma. Viaja no token para o guard não bater no banco a cada
  // request; como o access token dura 15m, uma revogação some em até 15m.
  isPlatformAdmin?: boolean;
  isPlatformMaster?: boolean;
  canAccessClientOrgs?: boolean;
  // Token emitido pelo seletor de salão: o admin está operando dentro da
  // organização de um cliente. Guarda quem entrou, para a trilha no log.
  impersonating?: boolean;
  impersonatorUserId?: string;
  memberships: Array<{
    memberId: string;
    organizationId: string;
    roleName: string;
    organizationStatus?: string;
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
      | 'NAME_TOO_SHORT'
      | 'ORGANIZATION_SUSPENDED'
      | 'FORBIDDEN'
      | 'NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
