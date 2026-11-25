import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AccessResolver } from './access/access.resolver';
import { AccessService } from './access/access.service';
import { PermissionGuard } from './guards/permission.guard';
import { TenantContextInterceptor } from './tenant-context.middleware';

/**
 * AuthzModule — wires RBAC authorization infrastructure globally.
 *
 * AccessService (acesso efetivo por pessoa, lido do banco) é exportado para jobs e resolvers.
 *
 * Registration order matters:
 *  1. APP_INTERCEPTOR (TenantContextInterceptor) runs first — resolves active tenant from JWT
 *  2. APP_GUARD (PermissionGuard) runs after — reads tenant from context, checks permissions
 *
 * Must be imported AFTER AuthModule in AppModule so JwtAuthGuard (first APP_GUARD)
 * validates the JWT before PermissionGuard reads tenant context.
 */
@Global()
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_GUARD, useClass: PermissionGuard },
    AccessService,
    AccessResolver,
  ],
  exports: [AccessService],
})
export class AuthzModule {}
