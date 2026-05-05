import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SignupInput {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  salonName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  segment?: string;
}
