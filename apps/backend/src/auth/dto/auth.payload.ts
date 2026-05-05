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
}

export interface AuthSessionDto {
  userId: string;
  email: string;
  fullName: string;
  memberships: MembershipDto[];
}

export interface AuthPayloadDto {
  accessToken: string | null;
  refreshToken: string | null;
  session: AuthSessionDto | null;
  errors: UserError[];
}
