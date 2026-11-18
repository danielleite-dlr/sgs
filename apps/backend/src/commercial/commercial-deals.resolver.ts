import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import type { CommercialViewer } from './commercial-access';
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

const viewerOf = (t: TenantContext): CommercialViewer => ({
  roleName: t.roleName,
  memberId: t.memberId,
});

@Resolver()
export class CommercialDealsResolver {
  constructor(
    private readonly deals: CommercialDealsService,
    private readonly interactions: CommercialInteractionsService,
  ) {}

  // ---------- Negócios ----------

  @Query('commercialDeals')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  commercialDeals(
    @CurrentTenant() tenant: TenantContext,
    @Args('filter') filter?: CommercialDealFilterDto,
  ) {
    return this.deals.list(tenant.organizationId, viewerOf(tenant), filter);
  }

  @Query('commercialDeal')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  commercialDeal(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.deals.get(tenant.organizationId, viewerOf(tenant), id);
  }

  @Mutation('createCommercialDeal')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  createCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: CreateCommercialDealDto,
  ) {
    return this.deals.create(tenant.organizationId, viewerOf(tenant), input);
  }

  @Mutation('updateCommercialDeal')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  updateCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: UpdateCommercialDealDto,
  ) {
    return this.deals.update(tenant.organizationId, viewerOf(tenant), input);
  }

  @Mutation('moveCommercialDeal')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  moveCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Args('id') id: string,
    @Args('stageId') stageId: string,
  ) {
    return this.deals.move(tenant.organizationId, viewerOf(tenant), id, stageId);
  }

  @Mutation('assignCommercialDeal')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  assignCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Args('id') id: string,
    @Args('assigneeMemberId') assigneeMemberId?: string,
  ) {
    return this.deals.assign(tenant.organizationId, viewerOf(tenant), id, assigneeMemberId);
  }

  @Mutation('loseCommercialDeal')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  loseCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Args('id') id: string,
    @Args('reasonCode') reasonCode: string,
    @Args('reasonText') reasonText?: string,
  ) {
    return this.deals.lose(tenant.organizationId, viewerOf(tenant), id, reasonCode, reasonText);
  }

  @Mutation('reopenCommercialDeal')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  reopenCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Args('id') id: string,
    @Args('stageId') stageId?: string,
  ) {
    return this.deals.reopen(tenant.organizationId, viewerOf(tenant), id, stageId);
  }

  @Mutation('deleteCommercialDeal')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  deleteCommercialDeal(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.deals.remove(tenant.organizationId, viewerOf(tenant), id);
  }

  // ---------- Interações ----------

  @Query('commercialInteractions')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  commercialInteractions(
    @CurrentTenant() tenant: TenantContext,
    @Args('leadId') leadId: string,
    @Args('dealId') dealId?: string,
    @Args('limit') limit?: number,
  ) {
    return this.interactions.list(tenant.organizationId, viewerOf(tenant), leadId, dealId, limit);
  }

  @Mutation('createCommercialInteraction')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  createCommercialInteraction(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: CreateCommercialInteractionDto,
  ) {
    return this.interactions.create(tenant.organizationId, viewerOf(tenant), input);
  }

  @Mutation('deleteCommercialInteraction')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  deleteCommercialInteraction(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.interactions.remove(tenant.organizationId, viewerOf(tenant), id);
  }
}

/** Campos do lead que dependem de negócios e interações. */
@Resolver('CommercialLead')
export class CommercialLeadDealsResolver {
  constructor(
    private readonly deals: CommercialDealsService,
    private readonly interactions: CommercialInteractionsService,
  ) {}

  @ResolveField('deals')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  leadDeals(@CurrentTenant() tenant: TenantContext, @Parent() lead: { id: string }) {
    return this.deals.dealsOfLead(tenant.organizationId, viewerOf(tenant), lead.id);
  }

  @ResolveField('interactions')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  leadInteractions(
    @CurrentTenant() tenant: TenantContext,
    @Parent() lead: { id: string },
    @Args('limit') limit?: number,
  ) {
    return this.interactions.list(tenant.organizationId, viewerOf(tenant), lead.id, null, limit);
  }
}
