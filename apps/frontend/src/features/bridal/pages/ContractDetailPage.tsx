import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';

/** Casca roteada (04-04); o conteúdo real chega no plano 04-14. */
export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div data-contract-id={id}>
      <PageHeader
        title="Contrato"
        breadcrumbs={[{ label: 'Contratos', to: '/contratos' }, { label: 'Contrato' }]}
      />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
