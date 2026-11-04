import { Mutation, Resolver } from '@nestjs/graphql';
import {
  CurrentTenant,
  TenantContext,
} from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import { ContractAlertsService } from './contract-alerts.service';

@Resolver()
export class ContractAlertsResolver {
  constructor(private readonly alerts: ContractAlertsService) {}

  @Mutation('runContractAlertsNow')
  @RequirePermission(PERMISSIONS.CONTRACT_CANCEL)
  run(@CurrentTenant() tenant: TenantContext) {
    return this.alerts.runForOrg(tenant.organizationId, new Date(), { force: true });
  }
}
