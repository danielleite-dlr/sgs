import { ForbiddenException } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessAdminService } from './access-admin.service';
import { AccessService, type LoadedAccess } from './access.service';
import { RequireAccess } from '../decorators/require-access.decorator';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { PERMISSIONS } from '../permissions.catalog';
import { ACCESS_ITEMS } from './access-catalog';
import {
  resolveTenantFromGqlContext,
  type GuardGqlContext,
} from '../guards/permission.guard';

/**
 * Acesso efetivo de quem está logado. Sem @RequirePermission de propósito:
 * qualquer membro autenticado e ativo pode consultar o próprio acesso.
 */
@Resolver()
export class AccessResolver {
  constructor(
    private readonly access: AccessService,
    private readonly admin: AccessAdminService,
  ) {}

  private async actor(ctx: GuardGqlContext): Promise<LoadedAccess> {
    const tenant = resolveTenantFromGqlContext(ctx);
    const actor = tenant ? await this.access.forContext(ctx) : null;
    if (!tenant || !actor) {
      throw new ForbiddenException('FORBIDDEN: membro inativo ou inexistente');
    }
    return actor;
  }

  @Query('myAccess')
  async myAccess(@Context() ctx: GuardGqlContext) {
    const tenant = resolveTenantFromGqlContext(ctx);
    if (!tenant) {
      throw new ForbiddenException('FORBIDDEN: no active tenant context');
    }
    const access = await this.access.forContext(ctx);
    if (!access) {
      throw new ForbiddenException('FORBIDDEN: membro inativo ou inexistente');
    }
    const items = ACCESS_ITEMS.flatMap((def) => {
      const r = access.items.get(def.id);
      if (!r) return [];
      return [
        {
          id: def.id,
          label: def.label,
          group: def.group,
          groupLabel: def.groupLabel,
          enabled: r.enabled,
          defaultEnabled: r.defaultEnabled,
          source: r.source,
          adjustable: false,
          lockReason: null,
          permissions: [...r.permissions].sort(),
        },
      ];
    });
    return {
      memberId: access.memberId,
      roleName: access.roleName,
      items,
      permissions: [...access.permissions].sort(),
      canManageAccess:
        access.items.get('profissionais-perfis')?.enabled === true,
    };
  }

  @RequirePermission(PERMISSIONS.MEMBER_EDIT_ROLE)
  @RequireAccess('profissionais-perfis')
  @Query('memberAccess')
  async memberAccess(
    @Args('memberId') memberId: string,
    @Context() ctx: GuardGqlContext,
  ) {
    const actor = await this.actor(ctx);
    return this.admin.memberAccess(actor.organizationId, actor, memberId);
  }

  @RequirePermission(PERMISSIONS.MEMBER_EDIT_ROLE)
  @RequireAccess('profissionais-perfis')
  @Query('memberAccessOverview')
  async memberAccessOverview(@Context() ctx: GuardGqlContext) {
    const actor = await this.actor(ctx);
    return this.admin.overview(actor.organizationId);
  }

  @RequirePermission(PERMISSIONS.MEMBER_EDIT_ROLE)
  @RequireAccess('profissionais-perfis')
  @Mutation('setMemberAccess')
  async setMemberAccess(
    @Args('input')
    input: {
      memberId: string;
      changes: { itemId: string; enabled: boolean }[];
    },
    @Context() ctx: GuardGqlContext,
  ) {
    const actor = await this.actor(ctx);
    return this.admin.set(actor.organizationId, actor, input);
  }

  @RequirePermission(PERMISSIONS.MEMBER_EDIT_ROLE)
  @RequireAccess('profissionais-perfis')
  @Mutation('resetMemberAccess')
  async resetMemberAccess(
    @Args('memberId') memberId: string,
    @Context() ctx: GuardGqlContext,
  ) {
    const actor = await this.actor(ctx);
    return this.admin.reset(actor.organizationId, actor, memberId);
  }
}
