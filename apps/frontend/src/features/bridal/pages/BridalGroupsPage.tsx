import { PageHeader } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';

/** Casca roteada (04-04); o conteúdo real chega no plano 04-13. */
export function BridalGroupsPage() {
  return (
    <div>
      <PageHeader title="Grupos de noivas" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
