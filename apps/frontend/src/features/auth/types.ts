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
  | 'NOT_FOUND'
  | 'ORGANIZATION_SUSPENDED'
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
  organizationStatus: string;
}

export interface AuthSession {
  userId: string;
  email: string;
  fullName: string;
  /** Papel de plataforma: cadastra e acompanha os clientes. */
  isPlatformAdmin: boolean;
  /** Master: concede e revoga acesso dos outros admins. */
  isPlatformMaster: boolean;
  /** Pode entrar no salão de um cliente. */
  canAccessClientOrgs: boolean;
  /** Senha temporária: precisa trocar antes de usar o sistema. */
  mustChangePassword: boolean;
  /** Sessão aberta pelo seletor, dentro da organização de um cliente. */
  impersonating: boolean;
  memberships: Membership[];
}

export interface AuthPayload {
  accessToken: string | null;
  refreshToken: string | null;
  session: AuthSession | null;
  errors: UserError[];
}
