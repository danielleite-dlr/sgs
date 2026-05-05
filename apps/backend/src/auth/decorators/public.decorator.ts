import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public() — marks a resolver mutation/query as publicly accessible,
 * bypassing the global JwtAuthGuard. Use on auth endpoints (signup, login, etc.).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
