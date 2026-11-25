import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { REQUIRED_ROLES_KEY } from '../decorators/require-role.decorator';
import { REQUIRED_ACCESS_KEY } from '../decorators/require-access.decorator';
import type { Permission } from '../permissions.catalog';
import type { TenantContext } from '../decorators/current-tenant.decorator';
import type { JwtAccessPayload } from '../../auth/types';
import { AccessService, type AccessGqlContext } from '../access/access.service';
import { AccessDeniedError } from '../access/access.errors';
import { checkAccess, expandGates } from '../access/access-resolve';

export interface GuardGqlContext extends AccessGqlContext {
  req?: { user?: JwtAccessPayload; headers?: Record<string, string> };
}

/**
 * Resolve o tenant ativo a partir do JWT (membership escolhida pelo header
 * x-organization-id, ou a primeira). Os interceptors rodam DEPOIS dos guards, então
 * o TenantContextInterceptor pode ainda não ter rodado. Grava em gqlCtx.tenant.
 * Devolve undefined quando não há usuário/memberships.
 */
export function resolveTenantFromGqlContext(
  gqlCtx: GuardGqlContext,
): TenantContext | undefined {
  if (gqlCtx.tenant) return gqlCtx.tenant;
  const user = gqlCtx.req?.user;
  if (!user || !user.memberships?.length) return undefined;
  const headerOrgId = gqlCtx.req?.headers?.['x-organization-id'];
  let active = user.memberships[0];
  if (headerOrgId) {
    const matched = user.memberships.find(
      (m) => m.organizationId === headerOrgId,
    );
    if (!matched) {
      throw new ForbiddenException(
        'FORBIDDEN: requested organization not in user memberships',
      );
    }
    active = matched;
  }
  const tenant: TenantContext = {
    organizationId: active.organizationId,
    memberId: active.memberId,
    roleName: active.roleName,
  };
  gqlCtx.tenant = tenant;
  return tenant;
}

/**
 * PermissionGuard em duas camadas, ambas lidas do BANCO a cada requisição
 * (uma leitura por requisição HTTP, memoizada em gqlCtx):
 *  1. Item de acesso (@RequireAccess): a pessoa precisa ter ao menos um dos itens/porteiros ligado
 *     (padrão do papel + ajustes por pessoa).
 *  2. Permissão (@RequirePermission): checada no conjunto de permissões do papel; se há
 *     @RequireAccess, vale a união do item ligado (ganho de item concede permissões de gerente).
 *  @RequireRole compara o papel do banco (não o do JWT).
 *
 * Sem nenhum dos três decorators → permite (inalterado). Membro inativo/excluído é recusado
 * com FORBIDDEN (o frontend desloga); recusa por área/permissão sai com ACCESS_DENIED
 * (não desloga) e mensagem começando por "FORBIDDEN:".
 *
 * Roda DEPOIS do JwtAuthGuard (ambos APP_GUARD, na ordem de registro).
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const required =
      this.reflector.getAllAndOverride<Permission[]>(
        REQUIRED_PERMISSIONS_KEY,
        targets,
      ) ?? [];
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_ROLES_KEY, targets) ??
      [];
    const gates =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_ACCESS_KEY, targets) ??
      [];

    if (
      required.length === 0 &&
      requiredRoles.length === 0 &&
      gates.length === 0
    ) {
      return true;
    }

    const gqlCtx = GqlExecutionContext.create(ctx).getContext() as GuardGqlContext;
    const tenant = resolveTenantFromGqlContext(gqlCtx);
    if (!tenant) {
      throw new ForbiddenException('FORBIDDEN: no active tenant context');
    }

    const access = await this.access.forContext(gqlCtx);
    if (!access) {
      throw new ForbiddenException('FORBIDDEN: membro inativo ou inexistente');
    }

    // Papel do banco para todos os resolvers (o do JWT pode estar velho).
    gqlCtx.tenant = { ...tenant, roleName: access.roleName };

    if (requiredRoles.length > 0 && !requiredRoles.includes(access.roleName)) {
      throw new AccessDeniedError(
        `FORBIDDEN: role ${access.roleName} not in [${requiredRoles.join(',')}]`,
        { reason: 'ROLE' },
      );
    }

    if (required.length > 0 || gates.length > 0) {
      const r = checkAccess(access, gates, required);
      if (!r.ok) {
        if (r.reason === 'ITEM_DISABLED') {
          throw new AccessDeniedError(
            'FORBIDDEN: área desativada para este usuário',
            { reason: r.reason, items: expandGates(gates) },
          );
        }
        throw new AccessDeniedError(
          `FORBIDDEN: missing permissions [${r.missing.join(',')}]`,
          { reason: r.reason, missing: r.missing },
        );
      }
    }

    return true;
  }
}
