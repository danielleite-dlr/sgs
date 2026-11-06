import { Navigate } from 'react-router-dom';
import { homePathForRole } from '@/config/features';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import DashboardPage from '@/pages/DashboardPage';

/** D-11: ADMIN e MANAGER veem o painel; os demais papéis seguem para a Agenda. */
export function HomeRoute() {
  const roleName = useAuthStore((s) => s.roleName);
  if (homePathForRole(roleName) === '/dashboard') return <DashboardPage />;
  return <Navigate to="/agenda" replace />;
}
