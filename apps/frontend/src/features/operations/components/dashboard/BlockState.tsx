import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Estados de carregando e erro compartilhados pelos blocos do Início (cada bloco os usa
// de forma independente: o erro de um não derruba os outros).
export const SECTION_TITLE_CLASS = 'font-serif text-headline-sm font-semibold text-neutral-800';

export const LINK_CLASS =
  'inline-flex min-h-[44px] items-center self-start text-label font-semibold text-primary-500 underline-offset-4 hover:underline';

export function BlockLoading({ testId, rows = 3 }: { testId: string; rows?: number }) {
  return (
    <div className="flex flex-col gap-sm" data-testid={testId}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function BlockError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>
        Não foi possível carregar {what}.{' '}
        <Button type="button" variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  );
}
