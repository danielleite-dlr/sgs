import { IsEmail, IsIn, IsString } from 'class-validator';

export class InviteMemberInput {
  @IsEmail()
  email!: string;

  @IsString()
  @IsIn(['ADMIN', 'MANAGER', 'ATTENDANT', 'PROFESSIONAL'])
  roleName!: 'ADMIN' | 'MANAGER' | 'ATTENDANT' | 'PROFESSIONAL';
}
