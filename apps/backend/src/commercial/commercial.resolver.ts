import { ForbiddenException } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessService, type AccessGqlContext } from '../authz/access/access.service';
import { RequireAccess } from '../authz/decorators/require-access.decorator';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import { commercialViewerFrom, type CommercialViewer } from './commercial-access';
import {
  CommercialLeadsService,
  type CommercialLeadFilterDto,
  type CreateCommercialLeadDto,
  type UpdateCommercialLeadDto,
} from './commercial-leads.service';
import { CommercialStagesService, type CommercialStageInputDto } from './commercial-stages.service';

@Resolver()
export class CommercialResolver {
  constructor(
    private readonly stages: CommercialStagesService,
    private readonly leads: CommercialLeadsService,
    private readonly access: AccessService,
  ) {}

  private async viewer(ctx: AccessGqlContext, items: readonly string[]): Promise<CommercialViewer> {
    const access = await this.access.forContext(ctx);
    if (!access) throw new ForbiddenException('FORBIDDEN: membro inativo ou inexistente');
    return commercialViewerFrom(access, access.memberId, items);
  }

  // ---------- Etapas ----------

  @Query('commercialStages')
  @RequireAccess(
    'COMERCIAL_NEGOCIOS',
    'comercial-config',
    'comercial-painel',
    'comercial-relatorios',
  )
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  async commercialStages(@CurrentTenant() tenant: TenantContext, @Context() ctx: AccessGqlContext) {
    return this.stages.list(
      tenant.organizationId,
      await this.viewer(ctx, [
        'COMERCIAL_NEGOCIOS',
        'comercial-config',
        'comercial-painel',
        'comercial-relatorios',
      ]),
    );
  }

  @Mutation('createCommercialStage')
  @RequireAccess('comercial-config')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  async createCommercialStage(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('input') input: CommercialStageInputDto,
  ) {
    return this.stages.create(
      tenant.organizationId,
      await this.viewer(ctx, ['comercial-config']),
      input,
    );
  }

  @Mutation('updateCommercialStage')
  @RequireAccess('comercial-config')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  async updateCommercialStage(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
    @Args('input') input: CommercialStageInputDto,
  ) {
    return this.stages.update(
      tenant.organizationId,
      await this.viewer(ctx, ['comercial-config']),
      id,
      input,
    );
  }

  @Mutation('reorderCommercialStages')
  @RequireAccess('comercial-config')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  async reorderCommercialStages(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('ids') ids: string[],
  ) {
    return this.stages.reorder(
      tenant.organizationId,
      await this.viewer(ctx, ['comercial-config']),
      ids,
    );
  }

  @Mutation('deleteCommercialStage')
  @RequireAccess('comercial-config')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  async deleteCommercialStage(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
    @Args('moveToStageId') moveToStageId?: string,
  ) {
    return this.stages.remove(tenant.organizationId, id, moveToStageId);
  }

  // ---------- Leads ----------

  @Query('commercialLeads')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  async commercialLeads(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('filter') filter?: CommercialLeadFilterDto,
  ) {
    return this.leads.list(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      filter,
    );
  }

  @Query('commercialLead')
  @RequireAccess('COMERCIAL_NEGOCIOS', 'comercial-lembretes')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  async commercialLead(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
  ) {
    return this.leads.get(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS', 'comercial-lembretes']),
      id,
    );
  }

  @Query('commercialDuplicateCheck')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  async commercialDuplicateCheck(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('phone') phone?: string,
    @Args('email') email?: string,
    @Args('excludeLeadId') excludeLeadId?: string,
  ) {
    return this.leads.duplicates(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      {
        phone,
        email,
        excludeLeadId,
      },
    );
  }

  @Query('commercialAssignees')
  @RequireAccess('COMERCIAL_NEGOCIOS', 'comercial-lembretes', 'comercial-relatorios')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  commercialAssignees(@CurrentTenant() tenant: TenantContext) {
    return this.leads.assignees(tenant.organizationId);
  }

  @Mutation('createCommercialLead')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async createCommercialLead(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('input') input: CreateCommercialLeadDto,
  ) {
    return this.leads.create(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      input,
    );
  }

  @Mutation('updateCommercialLead')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async updateCommercialLead(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('input') input: UpdateCommercialLeadDto,
  ) {
    return this.leads.update(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      input,
    );
  }

  @Mutation('linkCommercialLeadClient')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async linkCommercialLeadClient(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('leadId') leadId: string,
    @Args('clientId') clientId?: string,
  ) {
    return this.leads.link(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      leadId,
      clientId,
    );
  }

  @Mutation('deleteCommercialLead')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  async deleteCommercialLead(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
  ) {
    return this.leads.softDelete(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      id,
    );
  }

  @Mutation('purgeCommercialLead')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  async purgeCommercialLead(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
  ) {
    return this.leads.purge(tenant.organizationId, id);
  }
}
