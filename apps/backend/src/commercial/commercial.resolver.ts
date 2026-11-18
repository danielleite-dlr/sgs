import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import type { CommercialViewer } from './commercial-access';
import { CommercialStagesService, type CommercialStageInputDto } from './commercial-stages.service';

const viewerOf = (t: TenantContext): CommercialViewer => ({
  roleName: t.roleName,
  memberId: t.memberId,
});

@Resolver()
export class CommercialResolver {
  constructor(private readonly stages: CommercialStagesService) {}

  // ---------- Etapas ----------

  @Query('commercialStages')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  commercialStages(@CurrentTenant() tenant: TenantContext) {
    return this.stages.list(tenant.organizationId, viewerOf(tenant));
  }

  @Mutation('createCommercialStage')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  createCommercialStage(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: CommercialStageInputDto,
  ) {
    return this.stages.create(tenant.organizationId, viewerOf(tenant), input);
  }

  @Mutation('updateCommercialStage')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  updateCommercialStage(
    @CurrentTenant() tenant: TenantContext,
    @Args('id') id: string,
    @Args('input') input: CommercialStageInputDto,
  ) {
    return this.stages.update(tenant.organizationId, viewerOf(tenant), id, input);
  }

  @Mutation('reorderCommercialStages')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  reorderCommercialStages(@CurrentTenant() tenant: TenantContext, @Args('ids') ids: string[]) {
    return this.stages.reorder(tenant.organizationId, viewerOf(tenant), ids);
  }

  @Mutation('deleteCommercialStage')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  deleteCommercialStage(
    @CurrentTenant() tenant: TenantContext,
    @Args('id') id: string,
    @Args('moveToStageId') moveToStageId?: string,
  ) {
    return this.stages.remove(tenant.organizationId, id, moveToStageId);
  }
}
