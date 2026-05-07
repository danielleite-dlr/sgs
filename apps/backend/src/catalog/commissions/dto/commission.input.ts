import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';

const DECIMAL = /^\d+(\.\d{1,4})?$/;

export type CommissionScopeType =
  | 'member_service'
  | 'service'
  | 'category'
  | 'product'
  | 'default';

export type CommissionKind = 'fixed' | 'percentage';

export class CreateCommissionRuleInput {
  @IsEnum(['member_service', 'service', 'category', 'product', 'default'])
  scopeType!: CommissionScopeType;

  @IsEnum(['fixed', 'percentage'])
  kind!: CommissionKind;

  @Matches(DECIMAL, { message: 'Valor inválido.' })
  value!: string;

  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;
}

export class UpdateCommissionRuleInput {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsEnum(['fixed', 'percentage'])
  kind?: CommissionKind;

  @IsOptional()
  @Matches(DECIMAL, { message: 'Valor inválido.' })
  value?: string;
}
