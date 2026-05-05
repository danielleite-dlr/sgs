import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionGuard } from './guards/permission.guard';
import { TenantContextInterceptor } from './tenant-context.middleware';

/**
 * AuthzModule — wires RBAC authorization infrastructure globally.
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
  ],
})
export class AuthzModule {}
