import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { homePathFor } from '@/config/features';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { hasAccessIn, useAccess, useAccessFresh } from './access-hooks';

interface AccessRouteProps {
  /** Basta um item ligado (OU). */
  items: readonly string[];
  children: ReactNode;
}

/**
 * Fase 10 (D-02): rota de item desligado leva à tela inicial. Só nega com acesso lido
 * nesta sessão; com acesso apenas persistido, mostra esqueleto até a leitura chegar.
 * É conforto de UI: quem protege de verdade é a API.
 */
export function AccessRoute({ items, children }: AccessRouteProps) {
  const access = useAccess();
  const fresh = useAccessFresh();
  const roleName = useAuthStore((s) => s.roleName);
  const allowed = items.some((id) => hasAccessIn(access, id));
  if (allowed) return <>{children}</>;
  if (!fresh) {
    return (
      <div className="space-y-md p-md" data-testid="access-route-loading">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  return <Navigate to={homePathFor(roleName, hasAccessIn(access, 'agenda'))} replace />;
}
