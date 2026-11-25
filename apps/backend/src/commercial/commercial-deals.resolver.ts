import { ForbiddenException } from '@nestjs/common';
import { Args, Context, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { AccessService, type AccessGqlContext } from '../authz/access/access.service';
import { RequireAccess } from '../authz/decorators/require-access.decorator';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import { commercialViewerFrom, type CommercialViewer } from './commercial-access';
import {
  CommercialDealsService,
  type CommercialDealFilterDto,
  type CreateCommercialDealDto,
  type UpdateCommercialDealDto,
} from './commercial-deals.service';
import {
  CommercialInteractionsService,
  type CreateCommercialInteractionDto,
} from './commercial-interactions.service';

@Resolver()
export class CommercialDealsResolver {
  constructor(
    private readonly deals: CommercialDealsService,
    private readonly interactions: CommercialInteractionsService,
    private readonly access: AccessService,
  ) {}

  private async viewer(ctx: AccessGqlContext, items: readonly string[]): Promise<CommercialViewer> {
    const access = await this.access.forContext(ctx);
    if (!access) throw new ForbiddenException('FORBIDDEN: membro inativo ou inexistente');
    return commercialViewerFrom(access, access.memberId, items);
  }

  // ---------- Negócios ----------

  @Query('commercialDeals')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  async commercialDeals(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('filter') filter?: CommercialDealFilterDto,
  ) {
    return this.deals.list(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      filter,
    );
  }

  @Query('commercialDeal')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  async commercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
  ) {
    return this.deals.get(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      id,
    );
  }

  @Mutation('createCommercialDeal')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async createCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('input') input: CreateCommercialDealDto,
  ) {
    return this.deals.create(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      input,
    );
  }

  @Mutation('updateCommercialDeal')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async updateCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('input') input: UpdateCommercialDealDto,
  ) {
    return this.deals.update(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      input,
    );
  }

  @Mutation('moveCommercialDeal')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async moveCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
    @Args('stageId') stageId: string,
  ) {
    return this.deals.move(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      id,
      stageId,
    );
  }

  @Mutation('assignCommercialDeal')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  async assignCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
    @Args('assigneeMemberId') assigneeMemberId?: string,
  ) {
    return this.deals.assign(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      id,
      assigneeMemberId,
    );
  }

  @Mutation('loseCommercialDeal')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async loseCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
    @Args('reasonCode') reasonCode: string,
    @Args('reasonText') reasonText?: string,
  ) {
    return this.deals.lose(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      id,
      reasonCode,
      reasonText,
    );
  }

  @Mutation('reopenCommercialDeal')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  async reopenCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
    @Args('stageId') stageId?: string,
  ) {
    return this.deals.reopen(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      id,
      stageId,
    );
  }

  @Mutation('deleteCommercialDeal')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  async deleteCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
  ) {
    return this.deals.remove(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      id,
    );
  }

  // ---------- Interações ----------

  @Query('commercialInteractions')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  async commercialInteractions(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('leadId') leadId: string,
    @Args('dealId') dealId?: string,
    @Args('limit') limit?: number,
  ) {
    return this.interactions.list(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      leadId,
      dealId,
      limit,
    );
  }

  @Mutation('createCommercialInteraction')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async createCommercialInteraction(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('input') input: CreateCommercialInteractionDto,
  ) {
    return this.interactions.create(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      input,
    );
  }

  @Mutation('deleteCommercialInteraction')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  async deleteCommercialInteraction(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('id') id: string,
  ) {
    return this.interactions.remove(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      id,
    );
  }
}

/** Campos do lead que dependem de negócios e interações. */
@Resolver('CommercialLead')
export class CommercialLeadDealsResolver {
  constructor(
    private readonly deals: CommercialDealsService,
    private readonly interactions: CommercialInteractionsService,
    private readonly access: AccessService,
  ) {}

  private async viewer(ctx: AccessGqlContext, items: readonly string[]): Promise<CommercialViewer> {
    const access = await this.access.forContext(ctx);
    if (!access) throw new ForbiddenException('FORBIDDEN: membro inativo ou inexistente');
    return commercialViewerFrom(access, access.memberId, items);
  }

  @ResolveField('deals')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  async leadDeals(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Parent() lead: { id: string },
  ) {
    return this.deals.dealsOfLead(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      lead.id,
    );
  }

  @ResolveField('interactions')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  async leadInteractions(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Parent() lead: { id: string },
    @Args('limit') limit?: number,
  ) {
    return this.interactions.list(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      lead.id,
      null,
      limit,
    );
  }
}
