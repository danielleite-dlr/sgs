import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CommissionsService } from './commissions.service';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { CurrentTenant } from '../../authz/decorators/current-tenant.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import type { TenantContext } from '../../authz/decorators/current-tenant.decorator';

/**
 * CommissionsResolver — GraphQL resolver for commission rule CRUD.
 * Read ops: COMMISSION_READ (ADMIN, MANAGER, ATTENDANT access).
 * Write ops: COMMISSION_WRITE (ADMIN only per Plan 01 seed).
 */
@Resolver()
export class CommissionsResolver {
  constructor(private readonly commissions: CommissionsService) {}

  @RequirePermission(PERMISSIONS.COMMISSION_READ)
  @Query('commissionRules')
  async listRules(@CurrentTenant() tenantCtx: TenantContext) {
    return this.commissions.list(tenantCtx.organizationId);
  }

  @RequirePermission(PERMISSIONS.COMMISSION_READ)
  @Query('commissionRule')
  async getRule(
    @Args('id') id: string,
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.commissions.byId(tenantCtx.organizationId, id);
  }

  @RequirePermission(PERMISSIONS.COMMISSION_WRITE)
  @Mutation('createCommissionRule')
  async create(
    @Args('input')
    input: {
      scopeType: string;
      kind: string;
      value: string;
      memberId?: string;
      serviceId?: string;
      categoryId?: string;
      productId?: string;
    },
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.commissions.create(tenantCtx.organizationId, input as any);
  }

  @RequirePermission(PERMISSIONS.COMMISSION_WRITE)
  @Mutation('updateCommissionRule')
  async update(
    @Args('input')
    input: { id: string; kind?: string; value?: string },
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.commissions.update(tenantCtx.organizationId, input as any);
  }

  @RequirePermission(PERMISSIONS.COMMISSION_WRITE)
  @Mutation('softDeleteCommissionRule')
  async softDelete(
    @Args('input') input: { id: string },
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.commissions.softDelete(tenantCtx.organizationId, input.id);
  }
}
