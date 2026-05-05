import { IsString, MinLength, MaxLength } from 'class-validator';

export class AcceptInvitationInput {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password!: string;
}
