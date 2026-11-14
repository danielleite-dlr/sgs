import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CurrentTenant,
  TenantContext,
} from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import {
  PackageTimelineService,
  SetPackageTimelineInput,
} from './package-timeline.service';

@Resolver()
export class PackageTimelineResolver {
  constructor(private readonly svc: PackageTimelineService) {}

  @Query('packageTimeline')
  @RequirePermission(PERMISSIONS.PACKAGE_READ)
  list(@CurrentTenant() t: TenantContext, @Args('packageId') packageId: string) {
    return this.svc.list(t.organizationId, packageId);
  }

  @Mutation('setPackageTimeline')
  @RequirePermission(PERMISSIONS.PACKAGE_WRITE)
  set(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: SetPackageTimelineInput,
  ) {
    return this.svc.set(t.organizationId, t.memberId, input);
  }
}
