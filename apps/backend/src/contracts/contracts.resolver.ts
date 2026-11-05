import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CurrentTenant,
  TenantContext,
} from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import {
  ContractsService,
  type CreateContractInput,
  type UpdateContractInput,
} from './contracts.service';
import {
  ContractSettingsService,
  type UpdateContractSettingsInput,
} from './contract-settings.service';

@Resolver()
export class ContractsResolver {
  constructor(
    private readonly settings: ContractSettingsService,
    private readonly contracts: ContractsService,
  ) {}

  @Query('contracts')
  @RequirePermission(PERMISSIONS.CONTRACT_READ)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Args('status') status?: string,
    @Args('derived') derived?: string,
  ) {
    return this.contracts.list(tenant.organizationId, { status, derived });
  }

  @Query('contract')
  @RequirePermission(PERMISSIONS.CONTRACT_READ)
  get(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.contracts.get(tenant.organizationId, id);
  }

  @Query('contractReadiness')
  @RequirePermission(PERMISSIONS.CONTRACT_READ)
  readiness(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.contracts.readiness(tenant.organizationId, id);
  }

  @Mutation('createContract')
  @RequirePermission(PERMISSIONS.CONTRACT_WRITE)
  create(@CurrentTenant() tenant: TenantContext, @Args('input') input: CreateContractInput) {
    return this.contracts.create(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation('updateContract')
  @RequirePermission(PERMISSIONS.CONTRACT_WRITE)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Args('id') id: string,
    @Args('input') input: UpdateContractInput,
  ) {
    return this.contracts.update(tenant.organizationId, tenant.memberId, id, input);
  }

  @Mutation('generateContractLink')
  @RequirePermission(PERMISSIONS.CONTRACT_WRITE)
  generateLink(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.contracts.generateLink(tenant.organizationId, tenant.memberId, id);
  }

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
