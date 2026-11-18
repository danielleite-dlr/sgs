import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { homePathForRole } from '@/config/features';
import { useCommercialAccess } from '../commercial-permissions';

interface CommercialRouteProps {
  children: ReactNode;
  /** Relatórios e Etapas e formulário: só ADMIN e MANAGER (D-13). */
  managerOnly?: boolean;
}

/**
 * Guard de rota por papel (D-11, D-13). É conforto de UI; quem protege de verdade
 * é a API (commercial.*).
 */
export function CommercialRoute({ children, managerOnly = false }: CommercialRouteProps) {
  const { roleName, canUse, isManager } = useCommercialAccess();
  if (!canUse) return <Navigate to={homePathForRole(roleName)} replace />;
  if (managerOnly && !isManager) return <Navigate to="/comercial" replace />;
  return <>{children}</>;
}
