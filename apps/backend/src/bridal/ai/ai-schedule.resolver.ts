import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CurrentTenant, TenantContext } from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import { AiScheduleService, type ConfirmBridalScheduleInput } from './ai-schedule.service';

@Resolver()
export class AiScheduleResolver {
  constructor(private readonly ai: AiScheduleService) {}

  @Mutation('suggestBridalSchedule')
  @RequirePermission(PERMISSIONS.BRIDAL_AI_SUGGEST)
  suggest(@CurrentTenant() tenant: TenantContext, @Args('groupId') groupId: string) {
    return this.ai.suggest(tenant.organizationId, tenant.memberId, groupId);
  }

  @Mutation('confirmBridalSchedule')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE, PERMISSIONS.APPOINTMENT_WRITE)
  confirm(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: ConfirmBridalScheduleInput,
  ) {
    return this.ai.confirm(tenant.organizationId, tenant.memberId, input);
  }
}
