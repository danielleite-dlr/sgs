import { ForbiddenException } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessService, type AccessGqlContext } from '../authz/access/access.service';
import { RequireAccess } from '../authz/decorators/require-access.decorator';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import { commercialViewerFrom, type CommercialViewer } from './commercial-access';
import {
  CommercialRemindersService,
  type CommercialReminderFilterDto,
  type CreateCommercialReminderDto,
  type UpdateCommercialReminderDto,
} from './commercial-reminders.service';

@Resolver()
export class CommercialRemindersResolver {
  constructor(
    private readonly reminders: CommercialRemindersService,
    private readonly access: AccessService,
  ) {}

  private async viewer(ctx: AccessGqlContext, items: readonly string[]): Promise<CommercialViewer> {
    const access = await this.access.forContext(ctx);
    if (!access) throw new ForbiddenException('FORBIDDEN: membro inativo ou inexistente');
    return commercialViewerFrom(access, access.memberId, items);
  }

  @Query('commercialReminders')
  @RequireAccess('comercial-lembretes')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  async commercialReminders(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('filter') filter?: CommercialReminderFilterDto,
  ) {
    return this.reminders.list(
      tenant.organizationId,
      await this.viewer(ctx, ['comercial-lembretes']),
      filter,
    );
  }

  @Query('commercialReminder')
  @RequireAccess('comercial-lembretes')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  async commercialReminder(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
  ) {
    return this.reminders.get(
      tenant.organizationId,
      await this.viewer(ctx, ['comercial-lembretes']),
      id,
    );
  }

  @Query('commercialReminderCounts')
  @RequireAccess('comercial-lembretes', 'comercial-painel')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  async commercialReminderCounts(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
  ) {
    return this.reminders.counts(
      tenant.organizationId,
      await this.viewer(ctx, ['comercial-lembretes', 'comercial-painel']),
    );
  }

  @Mutation('createCommercialReminder')
  @RequireAccess('comercial-lembretes')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async createCommercialReminder(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('input') input: CreateCommercialReminderDto,
  ) {
    return this.reminders.create(
      tenant.organizationId,
      await this.viewer(ctx, ['comercial-lembretes']),
      input,
    );
  }

  @Mutation('updateCommercialReminder')
  @RequireAccess('comercial-lembretes')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async updateCommercialReminder(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('input') input: UpdateCommercialReminderDto,
  ) {
    return this.reminders.update(
      tenant.organizationId,
      await this.viewer(ctx, ['comercial-lembretes']),
      input,
    );
  }

  @Mutation('completeCommercialReminder')
  @RequireAccess('comercial-lembretes')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async completeCommercialReminder(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
    @Args('completed') completed: boolean,
  ) {
    return this.reminders.complete(
      tenant.organizationId,
      await this.viewer(ctx, ['comercial-lembretes']),
      id,
      completed,
    );
  }

  @Mutation('deleteCommercialReminder')
  @RequireAccess('comercial-lembretes')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async deleteCommercialReminder(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
  ) {
    return this.reminders.remove(
      tenant.organizationId,
      await this.viewer(ctx, ['comercial-lembretes']),
      id,
    );
  }
}
