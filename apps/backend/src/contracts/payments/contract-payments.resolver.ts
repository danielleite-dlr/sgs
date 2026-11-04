import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CurrentTenant,
  TenantContext,
} from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import {
  ContractPaymentsService,
  type CancelContractInput,
  type RecordContractPaymentInput,
} from './contract-payments.service';

@Resolver()
export class ContractPaymentsResolver {
  constructor(private readonly payments: ContractPaymentsService) {}

  @Mutation('recordContractPayment')
  @RequirePermission(PERMISSIONS.CONTRACT_PAYMENT)
  record(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: RecordContractPaymentInput,
  ) {
    return this.payments.record(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation('reverseContractPayment')
  @RequirePermission(PERMISSIONS.CONTRACT_CANCEL)
  reverse(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: { paymentId: string; reason: string },
  ) {
    return this.payments.reverse(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation('cancelContract')
  @RequirePermission(PERMISSIONS.CONTRACT_CANCEL)
  cancel(@CurrentTenant() tenant: TenantContext, @Args('input') input: CancelContractInput) {
    return this.payments.cancel(tenant.organizationId, tenant.memberId, input);
  }

  @Query('contractCancellationPreview')
  @RequirePermission(PERMISSIONS.CONTRACT_CANCEL)
  preview(
    @CurrentTenant() tenant: TenantContext,
    @Args('contractId') contractId: string,
    @Args('party') party: string,
  ) {
    return this.payments.preview(tenant.organizationId, contractId, party);
  }
}
