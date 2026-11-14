import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentTenant, TenantContext } from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import { BridalTimelineService, type BridalTimelineInput } from './timeline.service';

@Resolver()
export class BridalTimelineResolver {
  constructor(private readonly timeline: BridalTimelineService) {}

  @Query('bridalTimelinePreview')
  @RequirePermission(PERMISSIONS.BRIDAL_READ)
  preview(@CurrentTenant() tenant: TenantContext, @Args('input') input: BridalTimelineInput) {
    return this.timeline.preview(tenant.organizationId, input);
  }

  @Query('bridalTimeline')
  @RequirePermission(PERMISSIONS.BRIDAL_READ)
  get(@CurrentTenant() tenant: TenantContext, @Args('groupId') groupId: string) {
    return this.timeline.get(tenant.organizationId, groupId);
  }

  @Mutation('confirmBridalTimeline')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE, PERMISSIONS.APPOINTMENT_WRITE)
  confirm(@CurrentTenant() tenant: TenantContext, @Args('input') input: BridalTimelineInput) {
    return this.timeline.confirm(tenant.organizationId, tenant.memberId, input);
  }
}
