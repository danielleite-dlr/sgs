import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;
const SKU_PATTERN = /^[A-Za-z0-9_\-\.]{1,60}$/;

export class CreateProductInput {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsString()
  @Matches(SKU_PATTERN, { message: 'SKU inválido.' })
  sku!: string;

  @Matches(DECIMAL_PATTERN, { message: 'Preço de custo inválido.' })
  costPrice!: string;

  @Matches(DECIMAL_PATTERN, { message: 'Preço de venda inválido.' })
  salePrice!: string;

  @IsInt()
  @Min(0)
  stockQuantity!: number;

  @IsInt()
  @Min(0)
  minStockLevel!: number;

  @IsEnum(['un', 'ml', 'g'], { message: 'Unidade deve ser un, ml ou g.' })
  unit!: 'un' | 'ml' | 'g';
}

export class UpdateProductInput {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @Matches(SKU_PATTERN, { message: 'SKU inválido.' })
  sku?: string;

  @IsOptional()
  @Matches(DECIMAL_PATTERN, { message: 'Preço de custo inválido.' })
  costPrice?: string;

  @IsOptional()
  @Matches(DECIMAL_PATTERN, { message: 'Preço de venda inválido.' })
  salePrice?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStockLevel?: number;

  @IsOptional()
  @IsEnum(['un', 'ml', 'g'], { message: 'Unidade deve ser un, ml ou g.' })
  unit?: 'un' | 'ml' | 'g';
}

export class AdjustStockInput {
  @IsUUID()
  productId!: string;

  @IsInt()
  delta!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
