import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, selectIsAuthenticated } from '@/infrastructure/stores/auth.store';

import { savePendingRoute } from '@/infrastructure/native/push-route';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuth = useAuthStore(selectIsAuthenticated);
  const location = useLocation();

  if (!isAuth) {
    // App aberto a frio pelo toque da notificação com a sessão vencida: o login volta para o
    // atendimento (fase 8).
    savePendingRoute(location.pathname + location.search);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
