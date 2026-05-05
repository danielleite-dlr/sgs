import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginInput {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  password!: string;
}
