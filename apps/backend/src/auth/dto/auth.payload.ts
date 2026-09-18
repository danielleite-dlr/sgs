export interface UserError {
  code: string;
  message: string;
  field?: string;
}

export interface MembershipDto {
  memberId: string;
  organizationId: string;
  organizationName: string;
  roleName: string;
  organizationStatus: string;
}

export interface AuthSessionDto {
  userId: string;
  email: string;
  fullName: string;
  isPlatformAdmin: boolean;
  isPlatformMaster: boolean;
  canAccessClientOrgs: boolean;
  mustChangePassword: boolean;
  /** Sessão aberta pelo seletor de salão, dentro da organização de um cliente. */
  impersonating: boolean;
  memberships: MembershipDto[];
}

export interface AuthPayloadDto {
  accessToken: string | null;
  refreshToken: string | null;
  session: AuthSessionDto | null;
  errors: UserError[];
}
