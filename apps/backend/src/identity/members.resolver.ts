import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MembersService, redactPersonal } from './members.service';
import {
  CreateMemberInput,
  ResetMemberPasswordInput,
  UpdateMemberInput,
} from './dto/member.input';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { CurrentTenant } from '../authz/decorators/current-tenant.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import type { TenantContext } from '../authz/decorators/current-tenant.decorator';

/**
 * MembersResolver — exposes the member lifecycle:
 *  - `members` (active only) for the schedule/commission-rule pickers
 *  - `allMembers` (active + inactive) for the admin team screen
 *  - `createMember` (direct registration with a temporary password),
 *    `resetMemberPassword`, `updateMember` / `deactivateMember` /
 *    `reactivateMember` mutations
 * `members` and `allMembers` are both gated by MEMBER_READ (all 4 roles);
 * phone / Pix / birth date are redacted for roles other than ADMIN/MANAGER.
 * The mutations delegate entirely to MembersService, which already returns
 * the error-as-data payload — no try/catch needed here.
 */
@Resolver()
export class MembersResolver {
  constructor(private readonly members: MembersService) {}

  @RequirePermission(PERMISSIONS.MEMBER_READ)
  @Query('members')
  async listMembers(@CurrentTenant() tenantCtx: TenantContext) {
    const rows = await this.members.listActive(tenantCtx.organizationId);
    return rows.map((r) => redactPersonal(r, tenantCtx.roleName));
  }

  @RequirePermission(PERMISSIONS.MEMBER_READ)
  @Query('allMembers')
  async listAllMembers(@CurrentTenant() tenantCtx: TenantContext) {
    const rows = await this.members.listAll(tenantCtx.organizationId);
    return rows.map((r) => redactPersonal(r, tenantCtx.roleName));
  }

  @RequirePermission(PERMISSIONS.MEMBER_INVITE)
  @Mutation('createMember')
  async createMember(
    @Args('input') input: CreateMemberInput,
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.members.create(
      tenantCtx.organizationId,
      tenantCtx.roleName,
      input,
    );
  }

  @RequirePermission(PERMISSIONS.MEMBER_EDIT_ROLE)
  @Mutation('resetMemberPassword')
  async resetMemberPassword(
    @Args('input') input: ResetMemberPasswordInput,
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.members.resetPassword(
      tenantCtx.organizationId,
      tenantCtx.memberId,
      input.id,
    );
  }

  @RequirePermission(PERMISSIONS.MEMBER_EDIT_ROLE)
  @Mutation('updateMember')
  async updateMember(
    @Args('input') input: UpdateMemberInput,
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.members.update(tenantCtx.organizationId, input);
  }

  @RequirePermission(PERMISSIONS.MEMBER_REMOVE)
  @Mutation('deactivateMember')
  async deactivateMember(
    @Args('id') id: string,
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.members.deactivate(tenantCtx.organizationId, id);
  }

  @RequirePermission(PERMISSIONS.MEMBER_REMOVE)
  @Mutation('reactivateMember')
  async reactivateMember(
    @Args('id') id: string,
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.members.reactivate(tenantCtx.organizationId, id);
  }
}
