import { IsBoolean, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';

export type SeniorityTier = 'junior' | 'pleno' | 'senior';
export const MEMBER_STATUS_ACTIVE = 'active' as const;
export const MEMBER_STATUS_INACTIVE = 'inactive' as const;

export class UpdateMemberInput {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsIn(['ADMIN', 'MANAGER', 'ATTENDANT', 'PROFESSIONAL'])
  roleName?: string;

  @IsOptional()
  @IsBoolean()
  isProfessional?: boolean;

  @IsOptional()
  @IsEnum(['junior', 'pleno', 'senior'])
  seniorityTier?: SeniorityTier | null;
}

export class InviteMemberInput {
  email!: string;
  roleName!: string;

  @IsOptional()
  @IsBoolean()
  isProfessional?: boolean;

  @IsOptional()
  @IsEnum(['junior', 'pleno', 'senior'])
  seniorityTier?: SeniorityTier;
}
