import { Construction, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useParams } from 'react-router-dom';

/**
 * ContractDetailPlaceholder — stub for Phase 4.
 * Agent 2 will replace this file's contents with the real contract detail page.
 */
export function ContractDetailPlaceholder() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-lg text-center">
      <div className="flex flex-col items-center gap-md">
        <div className="h-16 w-16 rounded-full bg-primary-50 flex items-center justify-center">
          <FileText className="h-8 w-8 text-primary-500" />
        </div>
        <div className="space-y-sm">
          <h1 className="text-xl font-semibold text-neutral-800">
            Contrato {id ? `#${id}` : ''}
          </h1>
          <p className="text-sm text-neutral-500 max-w-sm">
            Detalhes do contrato: parcelas, histórico de pagamentos e política de cancelamento.
          </p>
        </div>
        <Badge
          variant="outline"
          className="gap-xs border-warning-500 text-warning-600 bg-warning-50"
        >
          <Construction className="h-3 w-3" />
          Mockup — Phase 4 (em breve)
        </Badge>
      </div>
    </div>
  );
}
