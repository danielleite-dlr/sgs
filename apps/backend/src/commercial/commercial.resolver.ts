import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import type { CommercialViewer } from './commercial-access';
import {
  CommercialLeadsService,
  type CommercialLeadFilterDto,
  type CreateCommercialLeadDto,
  type UpdateCommercialLeadDto,
} from './commercial-leads.service';
import { CommercialStagesService, type CommercialStageInputDto } from './commercial-stages.service';

const viewerOf = (t: TenantContext): CommercialViewer => ({
  roleName: t.roleName,
  memberId: t.memberId,
});

@Resolver()
export class CommercialResolver {
  constructor(
    private readonly stages: CommercialStagesService,
    private readonly leads: CommercialLeadsService,
  ) {}

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

  // ---------- Leads ----------

  @Query('commercialLeads')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  commercialLeads(
    @CurrentTenant() tenant: TenantContext,
    @Args('filter') filter?: CommercialLeadFilterDto,
  ) {
    return this.leads.list(tenant.organizationId, viewerOf(tenant), filter);
  }

  @Query('commercialLead')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  commercialLead(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.leads.get(tenant.organizationId, viewerOf(tenant), id);
  }

  @Query('commercialDuplicateCheck')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  commercialDuplicateCheck(
    @CurrentTenant() tenant: TenantContext,
    @Args('phone') phone?: string,
    @Args('email') email?: string,
    @Args('excludeLeadId') excludeLeadId?: string,
  ) {
    return this.leads.duplicates(tenant.organizationId, viewerOf(tenant), {
      phone,
      email,
      excludeLeadId,
    });
  }

  @Query('commercialAssignees')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  commercialAssignees(@CurrentTenant() tenant: TenantContext) {
    return this.leads.assignees(tenant.organizationId);
  }

  @Mutation('createCommercialLead')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  createCommercialLead(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: CreateCommercialLeadDto,
  ) {
    return this.leads.create(tenant.organizationId, viewerOf(tenant), input);
  }

  @Mutation('updateCommercialLead')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  updateCommercialLead(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: UpdateCommercialLeadDto,
  ) {
    return this.leads.update(tenant.organizationId, viewerOf(tenant), input);
  }

  @Mutation('linkCommercialLeadClient')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  linkCommercialLeadClient(
    @CurrentTenant() tenant: TenantContext,
    @Args('leadId') leadId: string,
    @Args('clientId') clientId?: string,
  ) {
    return this.leads.link(tenant.organizationId, viewerOf(tenant), leadId, clientId);
  }

  @Mutation('deleteCommercialLead')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  deleteCommercialLead(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.leads.softDelete(tenant.organizationId, viewerOf(tenant), id);
  }

  @Mutation('purgeCommercialLead')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  purgeCommercialLead(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.leads.purge(tenant.organizationId, id);
  }
}
