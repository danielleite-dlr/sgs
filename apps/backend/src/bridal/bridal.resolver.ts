import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CurrentTenant,
  TenantContext,
} from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import {
  BridalService,
  type BridalGroupFieldsInput,
  type BridalMemberServiceInput,
  type BridalPersonInput,
  type CreateBridalGroupInput,
} from './bridal.service';

@Resolver()
export class BridalResolver {
  constructor(private readonly bridal: BridalService) {}

  @Query('bridalGroups')
  @RequirePermission(PERMISSIONS.BRIDAL_READ)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Args('status') status?: string,
    @Args('from') from?: string,
    @Args('to') to?: string,
  ) {
    return this.bridal.list(tenant.organizationId, { status, from, to });
  }

  @Query('bridalGroup')
  @RequirePermission(PERMISSIONS.BRIDAL_READ)
  get(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.bridal.get(tenant.organizationId, id);
  }

  @Mutation('createBridalGroup')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: CreateBridalGroupInput,
  ) {
    return this.bridal.create(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation('updateBridalGroup')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Args('id') id: string,
    @Args('input') input: BridalGroupFieldsInput,
  ) {
    return this.bridal.update(tenant.organizationId, id, input);
  }

  @Mutation('addBridalGroupMember')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE)
  addMember(
    @CurrentTenant() tenant: TenantContext,
    @Args('groupId') groupId: string,
    @Args('person') person: BridalPersonInput,
  ) {
    return this.bridal.addMember(tenant.organizationId, groupId, person);
  }

  @Mutation('removeBridalGroupMember')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE)
  removeMember(
    @CurrentTenant() tenant: TenantContext,
    @Args('memberId') memberId: string,
  ) {
    return this.bridal.removeMember(tenant.organizationId, memberId);
  }

  @Mutation('setBridalMemberCoverage')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE)
  setCoverage(
    @CurrentTenant() tenant: TenantContext,
    @Args('memberId') memberId: string,
    @Args('covered') covered: boolean,
  ) {
    return this.bridal.setCoverage(tenant.organizationId, memberId, covered);
  }

  @Mutation('setBridalMemberServices')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE)
  setServices(
    @CurrentTenant() tenant: TenantContext,
    @Args('memberId') memberId: string,
    @Args('services') services: BridalMemberServiceInput[],
  ) {
    return this.bridal.setServices(tenant.organizationId, memberId, services);
  }
}
