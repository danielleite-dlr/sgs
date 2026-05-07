import { Construction, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * ContractsPlaceholder — stub for Phase 4.
 * Agent 2 will replace this file's contents with the real contracts list page.
 */
export function ContractsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-lg text-center">
      <div className="flex flex-col items-center gap-md">
        <div className="h-16 w-16 rounded-full bg-primary-50 flex items-center justify-center">
          <FileText className="h-8 w-8 text-primary-500" />
        </div>
        <div className="space-y-sm">
          <h1 className="text-xl font-semibold text-neutral-800">Contratos</h1>
          <p className="text-sm text-neutral-500 max-w-sm">
            Contratos de evento com valor total, parcelamento e acompanhamento de vencimentos. Inclui
            política de cancelamento configurável.
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
