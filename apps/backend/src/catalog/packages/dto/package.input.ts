import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const DECIMAL_REGEX = /^\d+(\.\d{1,2})?$/;

export class PackageServiceInput {
  @IsUUID()
  serviceId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class CreatePackageInput {
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @Matches(DECIMAL_REGEX, {
    message: 'price must be a non-negative decimal with up to 2 decimal places',
  })
  price!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  validForDays?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PackageServiceInput)
  services!: PackageServiceInput[];
}

export class UpdatePackageInput {
  @IsUUID()
  id!: string;

  @IsOptional()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @Matches(DECIMAL_REGEX, {
    message: 'price must be a non-negative decimal with up to 2 decimal places',
  })
  price?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  validForDays?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackageServiceInput)
  services?: PackageServiceInput[];
}

export class SoftDeletePackageInput {
  @IsUUID()
  id!: string;
}
