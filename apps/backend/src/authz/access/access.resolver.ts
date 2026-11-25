import { ForbiddenException } from '@nestjs/common';
import { Context, Query, Resolver } from '@nestjs/graphql';
import { AccessService } from './access.service';
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
  constructor(private readonly access: AccessService) {}

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
}
