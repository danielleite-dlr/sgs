import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CurrentTenant,
  TenantContext,
} from '../../authz/decorators/current-tenant.decorator';
import { RequireAccess } from '../../authz/decorators/require-access.decorator';
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
  @RequireAccess('CATALOGO_REF')
  @RequirePermission(PERMISSIONS.PACKAGE_READ)
  list(@CurrentTenant() t: TenantContext, @Args('packageId') packageId: string) {
    return this.svc.list(t.organizationId, packageId);
  }

  @Mutation('setPackageTimeline')
  @RequireAccess('pacotes-todos')
  @RequirePermission(PERMISSIONS.PACKAGE_WRITE)
  set(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: SetPackageTimelineInput,
  ) {
    return this.svc.set(t.organizationId, t.memberId, input);
  }
}
