import { Query, Resolver } from '@nestjs/graphql';
import { MembersService } from './members.service';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { CurrentTenant } from '../authz/decorators/current-tenant.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import type { TenantContext } from '../authz/decorators/current-tenant.decorator';

/**
 * MembersResolver — exposes `members` query for the commission rule member picker.
 * Gated by MEMBER_READ which is granted to all 4 roles in Phase 1/2.
 */
@Resolver()
export class MembersResolver {
  constructor(private readonly members: MembersService) {}

  @RequirePermission(PERMISSIONS.MEMBER_READ)
  @Query('members')
  async listMembers(@CurrentTenant() tenantCtx: TenantContext) {
    return this.members.listActive(tenantCtx.organizationId);
  }
}
