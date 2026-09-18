import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  useAuthStore,
  selectIsAuthenticated,
  selectIsPlatformAdmin,
} from '@/infrastructure/stores/auth.store';

interface PlatformAdminRouteProps {
  children: ReactNode;
}

/**
 * PlatformAdminRoute — restringe a área /admin a quem tem papel de plataforma.
 *
 * É só a guarda de navegação: quem manda é o PlatformAdminGuard do backend, que
 * reconfere a flag no banco a cada request.
 */
export function PlatformAdminRoute({ children }: PlatformAdminRouteProps) {
  const isAuth = useAuthStore(selectIsAuthenticated);
  const isPlatformAdmin = useAuthStore(selectIsPlatformAdmin);
  const location = useLocation();

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
