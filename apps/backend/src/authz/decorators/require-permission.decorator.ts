import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../permissions.catalog';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Marks a resolver/controller handler as requiring all listed permissions
 * for the active organization (resolved by TenantContextInterceptor).
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
