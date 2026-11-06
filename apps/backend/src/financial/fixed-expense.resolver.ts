import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CurrentTenant,
  TenantContext,
} from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import { FixedExpenseInputDto, FixedExpenseService } from './fixed-expense.service';

@Resolver()
export class FixedExpenseResolver {
  constructor(private readonly fixedExpenses: FixedExpenseService) {}

  @Query('fixedExpenses')
  @RequirePermission(PERMISSIONS.FINANCIAL_READ)
  list(@CurrentTenant() tenant: TenantContext) {
    return this.fixedExpenses.list(tenant.organizationId);
  }

  @Mutation('createFixedExpense')
  @RequirePermission(PERMISSIONS.FINANCIAL_EXPENSE_WRITE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: FixedExpenseInputDto,
  ) {
    return this.fixedExpenses.create(tenant.organizationId, input);
  }

  @Mutation('updateFixedExpense')
  @RequirePermission(PERMISSIONS.FINANCIAL_EXPENSE_WRITE)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Args('id') id: string,
    @Args('input') input: FixedExpenseInputDto,
  ) {
    return this.fixedExpenses.update(tenant.organizationId, id, input);
  }

  @Mutation('deleteFixedExpense')
  @RequirePermission(PERMISSIONS.FINANCIAL_EXPENSE_WRITE)
  remove(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.fixedExpenses.remove(tenant.organizationId, id);
  }
}
