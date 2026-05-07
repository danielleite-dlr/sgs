import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const DECIMAL_REGEX = /^\d+(\.\d{1,2})?$/;

export class PricingVariantInput {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsOptional()
  @IsString()
  seniorityTier?: string | null;

  @Matches(DECIMAL_REGEX, {
    message: 'price must be a non-negative decimal with up to 2 decimal places',
  })
  price!: string;
}

export class CreateServiceInput {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsUUID()
  categoryId!: string;

  @Matches(DECIMAL_REGEX, {
    message: 'basePrice must be a non-negative decimal with up to 2 decimal places',
  })
  basePrice!: string;

  @IsInt()
  @Min(1)
  defaultDurationMinutes!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingVariantInput)
  pricingVariants?: PricingVariantInput[];
}

export class UpdateServiceInput {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Matches(DECIMAL_REGEX, {
    message: 'basePrice must be a non-negative decimal with up to 2 decimal places',
  })
  basePrice?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultDurationMinutes?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingVariantInput)
  pricingVariants?: PricingVariantInput[];
}

export class SoftDeleteServiceInput {
  @IsUUID()
  id!: string;
}
