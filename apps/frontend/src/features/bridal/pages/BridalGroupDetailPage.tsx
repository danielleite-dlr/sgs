import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';

/** Casca roteada (04-04); o conteúdo real chega no plano 04-13. */
export function BridalGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div data-group-id={id}>
      <PageHeader
        title="Grupo de noivas"
        breadcrumbs={[{ label: 'Noivas', to: '/noivas' }, { label: 'Grupo' }]}
      />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
