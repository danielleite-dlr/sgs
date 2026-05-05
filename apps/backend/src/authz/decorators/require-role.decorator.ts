import { SetMetadata } from '@nestjs/common';

export const REQUIRED_ROLES_KEY = 'requiredRoles';

export const RequireRole = (
  ...roleNames: Array<'ADMIN' | 'MANAGER' | 'ATTENDANT' | 'PROFESSIONAL'>
) => SetMetadata(REQUIRED_ROLES_KEY, roleNames);
