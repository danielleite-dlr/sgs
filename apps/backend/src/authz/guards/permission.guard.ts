import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from '../../database/prisma.service';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { REQUIRED_ROLES_KEY } from '../decorators/require-role.decorator';
import type { Permission } from '../permissions.catalog';
import type { TenantContext } from '../decorators/current-tenant.decorator';

/**
 * PermissionGuard — resolves required permissions from resolver metadata and
 * checks them against the active tenant's role permissions in the database.
 *
 * Runs AFTER JwtAuthGuard (both registered as APP_GUARD; order is registration order)
 * and AFTER TenantContextInterceptor (registered as APP_INTERCEPTOR, runs first).
 *
 * Uses cases:
 *  - @RequirePermission('member.invite') → checks role_permissions table
 *  - @RequireRole('ADMIN') → checks roleName from TenantContext directly
 *  - No decorator → allow (resolvers not decorated are public-visible after JWT)
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRED_PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    ) ?? [];

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    ) ?? [];

    if (required.length === 0 && requiredRoles.length === 0) return true;

    const gql = GqlExecutionContext.create(ctx);
    const gqlCtx = gql.getContext() as { tenant?: TenantContext };
    const tenant = gqlCtx.tenant;

    if (!tenant) {
      throw new ForbiddenException('FORBIDDEN: no active tenant context');
    }

    // Role check (escape hatch — prefer permission checks)
    if (requiredRoles.length > 0 && !requiredRoles.includes(tenant.roleName)) {
      throw new ForbiddenException(
        `FORBIDDEN: role ${tenant.roleName} not in [${requiredRoles.join(',')}]`,
      );
    }

    // Permission check — resolve role's permissions from DB
    if (required.length > 0) {
      const role = await this.prisma.role.findFirst({
        where: { name: tenant.roleName, isSystem: true },
        include: { permissions: true },
      });
      const granted = new Set(
        role?.permissions.map((p) => p.permission) ?? [],
      );
      const missing = required.filter((p) => !granted.has(p));
      if (missing.length > 0) {
        throw new ForbiddenException(
          `FORBIDDEN: missing permissions [${missing.join(',')}]`,
        );
      }
    }

    return true;
  }
}
