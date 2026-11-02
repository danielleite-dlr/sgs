import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { scopeProfessionalFilter } from '../appointments/appointments.resolver';
import {
  CurrentTenant,
  TenantContext,
} from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import { ClientCreditService } from './client-credit.service';
import { FinancialService } from './financial.service';

@Resolver()
export class FinancialResolver {
  constructor(
    private readonly financial: FinancialService,
    private readonly credit: ClientCreditService,
  ) {}

  @Query('financialSummary')
  @RequirePermission(PERMISSIONS.FINANCIAL_READ)
  summary(
    @CurrentTenant() tenant: TenantContext,
    @Args('from') from: string,
    @Args('to') to: string,
    @Args('granularity') granularity: string,
  ) {
    return this.financial.summary(tenant.organizationId, from, to, granularity);
  }

  @Query('cashMovements')
  @RequirePermission(PERMISSIONS.FINANCIAL_READ)
  cashMovements(
    @CurrentTenant() tenant: TenantContext,
    @Args('from') from: string,
    @Args('to') to: string,
  ) {
    return this.financial.cashMovements(tenant.organizationId, from, to);
  }

  @Query('commissionRecords')
  @RequirePermission(PERMISSIONS.COMMISSION_RECORD_READ)
  commissionRecords(
    @CurrentTenant() tenant: TenantContext,
    @Args('from') from: string,
    @Args('to') to: string,
    @Args('memberId') memberId?: string,
  ) {
    return this.financial.commissionRecords(tenant.organizationId, {
      from,
      to,
      memberId: scopeProfessionalFilter(tenant, memberId),
    });
  }

  @Query('commissionTotals')
  @RequirePermission(PERMISSIONS.COMMISSION_RECORD_READ)
  commissionTotals(
    @CurrentTenant() tenant: TenantContext,
    @Args('from') from: string,
    @Args('to') to: string,
    @Args('memberId') memberId?: string,
  ) {
    return this.financial.commissionTotals(tenant.organizationId, {
      from,
      to,
      memberId: scopeProfessionalFilter(tenant, memberId),
    });
  }

  @Query('clientCreditBalances')
  @RequirePermission(PERMISSIONS.CREDIT_READ)
  balances(@CurrentTenant() tenant: TenantContext) {
    return this.credit.balances(tenant.organizationId);
  }

  @Query('clientCreditMovements')
  @RequirePermission(PERMISSIONS.CREDIT_READ)
  movements(
    @CurrentTenant() tenant: TenantContext,
    @Args('clientId') clientId: string,
  ) {
    return this.credit.movements(tenant.organizationId, clientId);
  }

  @Mutation('adjustClientCredit')
  @RequirePermission(PERMISSIONS.CREDIT_ADJUST)
  adjust(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: { clientId: string; amount: string; reason: string },
  ) {
    return this.credit.adjust(tenant.organizationId, tenant.memberId, input);
  }
}
