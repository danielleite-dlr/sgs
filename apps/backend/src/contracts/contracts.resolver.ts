import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CurrentTenant,
  TenantContext,
} from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import {
  ContractSettingsService,
  type UpdateContractSettingsInput,
} from './contract-settings.service';

@Resolver()
export class ContractsResolver {
  constructor(private readonly settings: ContractSettingsService) {}

  @Query('contractSettings')
  @RequirePermission(PERMISSIONS.CONTRACT_READ)
  contractSettings(@CurrentTenant() tenant: TenantContext) {
    return this.settings.get(tenant.organizationId);
  }

  @Mutation('updateContractSettings')
  @RequirePermission(PERMISSIONS.CONTRACT_SETTINGS)
  updateContractSettings(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: UpdateContractSettingsInput,
  ) {
    return this.settings.update(tenant.organizationId, tenant.memberId, input);
  }
}
