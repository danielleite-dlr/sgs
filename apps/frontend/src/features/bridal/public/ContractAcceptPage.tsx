import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Página pública de aceite do contrato (/aceite/:orgId/:token), sem AppShell.
 * Casca roteada (04-04); o conteúdo real chega no plano 04-09.
 */
export function ContractAcceptPage() {
  const { orgId, token } = useParams<{ orgId: string; token: string }>();

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <main className="mx-auto max-w-2xl p-lg" data-org-id={orgId} data-token={token}>
      <h1 className="pb-lg text-2xl font-semibold text-neutral-800">Contrato</h1>
      <Skeleton className="h-40 w-full" />
    </main>
  );
}
