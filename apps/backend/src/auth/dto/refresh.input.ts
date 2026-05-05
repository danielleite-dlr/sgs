import { IsString, MinLength } from 'class-validator';

export class RefreshInput {
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}
