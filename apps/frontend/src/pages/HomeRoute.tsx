import { Navigate } from 'react-router-dom';
import { homePathFor } from '@/config/features';
import { useHasAccess } from '@/features/access/access-hooks';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import DashboardPage from '@/pages/DashboardPage';

/**
 * D-11 + fase 10: ADMIN e MANAGER veem o painel; os demais seguem para a Agenda;
 * sem Agenda ligada, o painel renderiza para qualquer papel (sem laço).
 */
export function HomeRoute() {
  const roleName = useAuthStore((s) => s.roleName);
  const hasAgenda = useHasAccess('agenda');
  if (homePathFor(roleName, hasAgenda) === '/dashboard') return <DashboardPage />;
  return <Navigate to="/agenda" replace />;
}
