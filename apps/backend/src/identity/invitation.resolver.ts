import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InvitationService } from './invitation.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import { AuthError } from '../auth/types';
import type { JwtAccessPayload } from '../auth/types';
import type { TenantContext } from '../authz/decorators/current-tenant.decorator';

@Resolver()
export class InvitationResolver {
  constructor(
    private readonly invitations: InvitationService,
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  @RequirePermission(PERMISSIONS.MEMBER_INVITE)
  @Mutation('inviteMember')
  async invite(
    @Args('input') input: { email: string; roleName: string },
    @CurrentUser() user: JwtAccessPayload,
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    try {
      const org = await this.prisma.organization.findUniqueOrThrow({
        where: { id: tenantCtx.organizationId },
      });
      const result = await this.invitations.invite({
        organizationId: tenantCtx.organizationId,
        invitedById: tenantCtx.memberId,
        inviterName: user.email,
        salonName: org.tradeName,
        email: input.email,
        roleName: input.roleName,
      });
      return {
        invitationId: result.invitationId,
        expiresAt: result.expiresAt,
        errors: [],
      };
    } catch (e) {
      if (e instanceof AuthError) {
        return {
          invitationId: null,
          expiresAt: null,
          errors: [{ code: e.code, message: e.message }],
        };
      }
      throw e;
    }
  }

  @Public()
  @Mutation('acceptInvitation')
  async accept(
    @Args('input') input: { token: string; fullName: string; password: string },
  ) {
    try {
      return await this.invitations.accept(
        input.token,
        input.fullName,
        input.password,
      );
    } catch (e) {
      if (e instanceof AuthError) {
        return {
          accessToken: null,
          refreshToken: null,
          session: null,
          errors: [{ code: e.code, message: e.message }],
        };
      }
      throw e;
    }
  }

  @RequirePermission(PERMISSIONS.MEMBER_INVITE)
  @Mutation('revokeInvitation')
  async revoke(
    @Args('invitationId') invitationId: string,
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    await this.tenant.runWithTenant(tenantCtx.organizationId, async (tx) => {
      await tx.memberInvitation.update({
        where: { id: invitationId },
        data: { revokedAt: new Date() },
      });
    });
    return { success: true, errors: [] };
  }

  @RequirePermission(PERMISSIONS.MEMBER_READ)
  @Query('pendingInvitations')
  async pending(@CurrentTenant() tenantCtx: TenantContext) {
    return this.tenant.runWithTenant(tenantCtx.organizationId, async (tx) => {
      const rows = await tx.memberInvitation.findMany({
        where: {
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { role: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((r) => ({
        id: r.id,
        email: r.email,
        roleName: r.role.name,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
      }));
    });
  }
}
