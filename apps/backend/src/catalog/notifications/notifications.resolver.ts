import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessService, type AccessGqlContext } from '../../authz/access/access.service';
import { NotificationsService } from './notifications.service';
import {
  CurrentTenant,
  TenantContext,
} from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import { hiddenNotificationKinds } from './notification-visibility';

@Resolver()
export class NotificationsResolver {
  constructor(
    private readonly svc: NotificationsService,
    private readonly access: AccessService,
  ) {}

  @Query('notifications')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  async list(
    @CurrentTenant() t: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('unreadOnly') unreadOnly?: boolean,
  ) {
    const hidden = hiddenNotificationKinds(await this.access.forContext(ctx));
    return this.svc.list(t.organizationId, t.memberId, unreadOnly ?? true, hidden);
  }

  @Mutation('markNotificationRead')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  markRead(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: { id: string },
  ) {
    return this.svc.markRead(t.organizationId, t.memberId, input.id);
  }

  @Query('unreadNotificationCount')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  async unreadCount(@CurrentTenant() t: TenantContext, @Context() ctx: AccessGqlContext) {
    const hidden = hiddenNotificationKinds(await this.access.forContext(ctx));
    return this.svc.unreadCount(t.organizationId, t.memberId, hidden);
  }

  @Mutation('markAllNotificationsRead')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  async markAllRead(@CurrentTenant() t: TenantContext, @Context() ctx: AccessGqlContext) {
    const hidden = hiddenNotificationKinds(await this.access.forContext(ctx));
    return this.svc.markAllRead(t.organizationId, t.memberId, hidden);
  }
}
