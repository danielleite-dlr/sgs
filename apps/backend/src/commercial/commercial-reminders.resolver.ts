import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import type { CommercialViewer } from './commercial-access';
import {
  CommercialRemindersService,
  type CommercialReminderFilterDto,
  type CreateCommercialReminderDto,
  type UpdateCommercialReminderDto,
} from './commercial-reminders.service';

const viewerOf = (t: TenantContext): CommercialViewer => ({
  roleName: t.roleName,
  memberId: t.memberId,
});

@Resolver()
export class CommercialRemindersResolver {
  constructor(private readonly reminders: CommercialRemindersService) {}

  @Query('commercialReminders')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  commercialReminders(
    @CurrentTenant() tenant: TenantContext,
    @Args('filter') filter?: CommercialReminderFilterDto,
  ) {
    return this.reminders.list(tenant.organizationId, viewerOf(tenant), filter);
  }

  @Query('commercialReminder')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  commercialReminder(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.reminders.get(tenant.organizationId, viewerOf(tenant), id);
  }

  @Query('commercialReminderCounts')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  commercialReminderCounts(@CurrentTenant() tenant: TenantContext) {
    return this.reminders.counts(tenant.organizationId, viewerOf(tenant));
  }

  @Mutation('createCommercialReminder')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  createCommercialReminder(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: CreateCommercialReminderDto,
  ) {
    return this.reminders.create(tenant.organizationId, viewerOf(tenant), input);
  }

  @Mutation('updateCommercialReminder')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  updateCommercialReminder(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: UpdateCommercialReminderDto,
  ) {
    return this.reminders.update(tenant.organizationId, viewerOf(tenant), input);
  }

  @Mutation('completeCommercialReminder')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  completeCommercialReminder(
    @CurrentTenant() tenant: TenantContext,
    @Args('id') id: string,
    @Args('completed') completed: boolean,
  ) {
    return this.reminders.complete(tenant.organizationId, viewerOf(tenant), id, completed);
  }

  @Mutation('deleteCommercialReminder')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  deleteCommercialReminder(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.reminders.remove(tenant.organizationId, viewerOf(tenant), id);
  }
}
