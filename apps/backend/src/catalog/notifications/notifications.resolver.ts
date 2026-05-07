import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { NotificationsService } from './notifications.service';
import {
  CurrentTenant,
  TenantContext,
} from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';

@Resolver()
export class NotificationsResolver {
  constructor(private readonly svc: NotificationsService) {}

  @Query('notifications')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  list(
    @CurrentTenant() t: TenantContext,
    @Args('unreadOnly') unreadOnly?: boolean,
  ) {
    return this.svc.list(t.organizationId, t.memberId, unreadOnly ?? true);
  }

  @Mutation('markNotificationRead')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  markRead(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: { id: string },
  ) {
    return this.svc.markRead(t.organizationId, input.id);
  }
}
