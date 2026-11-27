import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export type SeniorityTier = 'junior' | 'pleno' | 'senior';
export const MEMBER_STATUS_ACTIVE = 'active' as const;
export const MEMBER_STATUS_INACTIVE = 'inactive' as const;

export class UpdateMemberInput {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsIn(['ADMIN', 'MANAGER', 'ATTENDANT', 'PROFESSIONAL', 'ASSISTANT'])
  roleName?: string;

  @IsOptional()
  @IsBoolean()
  isProfessional?: boolean;

  @IsOptional()
  @IsBoolean()
  isBridalAssistant?: boolean;

  @IsOptional()
  @IsBoolean()
  isFixed?: boolean;

  @IsOptional()
  @IsBoolean()
  servesBridal?: boolean;

  @IsOptional()
  @IsEnum(['junior', 'pleno', 'senior'])
  seniorityTier?: SeniorityTier | null;

  /** Telefone/Pix não podem ser limpos; null é tratado como inválido. */
  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  pixKey?: string | null;

  /** null limpa a data de nascimento. */
  @IsOptional()
  birthDate?: Date | null;

  /** Substitui o conjunto de categorias atendidas. */
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  categoryIds?: string[];
}

export class CreateMemberInput {
  @IsString()
  displayName!: string;

  /** Obrigatórios, exceto para o papel Assistente (o servidor gera). */
  @IsOptional()
  @IsString()
  email?: string | null;

  @IsString()
  phone!: string;

  @IsString()
  pixKey!: string;

  @IsOptional()
  birthDate?: Date | null;

  @IsIn(['ADMIN', 'MANAGER', 'ATTENDANT', 'PROFESSIONAL', 'ASSISTANT'])
  roleName!: string;

  @IsOptional()
  @IsBoolean()
  isProfessional?: boolean;

  @IsOptional()
  @IsBoolean()
  isBridalAssistant?: boolean;

  @IsOptional()
  @IsBoolean()
  isFixed?: boolean;

  @IsOptional()
  @IsBoolean()
  servesBridal?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  categoryIds?: string[];

  /** Obrigatória, exceto para o papel Assistente (o servidor gera). */
  @IsOptional()
  @IsString()
  temporaryPassword?: string | null;
}

export class ResetMemberPasswordInput {
  @IsUUID()
  id!: string;
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
