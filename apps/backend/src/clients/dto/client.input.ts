import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const PHONE = /^[\d\s()+\-]{8,30}$/;
const RG = /^[0-9Xx.\-\s]{5,20}$/;
const CEP = /^\d{5}-?\d{3}$/;

/** Valida só quando há valor; string vazia limpa o campo. */
const filled = (_: unknown, v: unknown) => v !== undefined && v !== null && v !== '';

export class CreateClientInput {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName!: string;

  @IsOptional()
  @Matches(PHONE, { message: 'Telefone inválido.' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido.' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ValidateIf(filled)
  @Matches(RG, { message: 'RG inválido.' })
  rg?: string;

  @ValidateIf(filled)
  @Matches(CEP, { message: 'CEP inválido.' })
  postalCode?: string;

  @ValidateIf(filled)
  @Matches(PHONE, { message: 'Telefone inválido.' })
  phone2?: string;

  @ValidateIf(filled)
  @Matches(PHONE, { message: 'Telefone inválido.' })
  phone3?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateClientInput {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName?: string;

  @IsOptional()
  @Matches(PHONE, { message: 'Telefone inválido.' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido.' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ValidateIf(filled)
  @Matches(RG, { message: 'RG inválido.' })
  rg?: string;

  @ValidateIf(filled)
  @Matches(CEP, { message: 'CEP inválido.' })
  postalCode?: string;

  @ValidateIf(filled)
  @Matches(PHONE, { message: 'Telefone inválido.' })
  phone2?: string;

  @ValidateIf(filled)
  @Matches(PHONE, { message: 'Telefone inválido.' })
  phone3?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
