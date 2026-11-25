import { RequireAccess } from '../authz/decorators/require-access.decorator';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import {
  ContractLetterheadService,
  type UploadLetterheadInput,
} from './contract-letterhead.service';

@Resolver()
export class ContractLetterheadResolver {
  constructor(private readonly letterhead: ContractLetterheadService) {}

  @Mutation('uploadContractLetterhead')
  @RequireAccess('contratos')
  @RequirePermission(PERMISSIONS.CONTRACT_SETTINGS)
  upload(@CurrentTenant() tenant: TenantContext, @Args('input') input: UploadLetterheadInput) {
    return this.letterhead.upload(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation('removeContractLetterhead')
  @RequireAccess('contratos')
  @RequirePermission(PERMISSIONS.CONTRACT_SETTINGS)
  remove(@CurrentTenant() tenant: TenantContext) {
    return this.letterhead.remove(tenant.organizationId, tenant.memberId);
  }
}
