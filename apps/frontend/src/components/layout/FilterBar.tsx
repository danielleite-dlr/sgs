import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FilterBarProps {
  /** Always-visible filter row(s) */
  basicFilters: ReactNode;
  /** Optional advanced filters revealed by "Mais filtros". */
  advancedFilters?: ReactNode;
  /** Reset all filters. */
  onClear?: () => void;
  /** Export action (CSV/XLSX). */
  onExport?: () => void;
  /** Custom right-side actions to render alongside Limpar/Exportar. */
  rightActions?: ReactNode;
  /** Compact mode for smaller embeds (skips background). */
  compact?: boolean;
}

/**
 * Trinks-style entity-list filter bar.
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ [Filtros básicos]                              Limpar  Export│
 *   │ [Filtros básicos linha 2]                                    │
 *   │ ┌─ Mais filtros ˅ ──────────────────────────────────────────┐│
 *   │ │ [Filtros avançados]                                       ││
 *   │ └───────────────────────────────────────────────────────────┘│
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Used by Tríptico lists (Clientes, Profissionais, etc.) and Reports.
 */
export function FilterBar({
  basicFilters,
  advancedFilters,
  onClear,
  onExport,
  rightActions,
  compact = false,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      aria-label="Filtros"
      className={cn(
        'rounded-md border border-neutral-200',
        compact ? 'p-sm' : 'p-md bg-neutral-50',
      )}
    >
      <div className="flex items-start justify-between gap-md flex-wrap">
        <div className="flex-1 min-w-0">{basicFilters}</div>
        <div className="flex items-center gap-sm shrink-0">
          {rightActions}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-primary-500 hover:text-primary-700 font-medium"
            >
              Limpar
            </button>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} className="gap-xs">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          )}
        </div>
      </div>

      {advancedFilters && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-md flex items-center gap-xs text-xs font-medium text-primary-500 hover:text-primary-700"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Menos filtros
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Mais filtros
              </>
            )}
          </button>
          {expanded && (
            <div className="mt-md pt-md border-t border-neutral-200">{advancedFilters}</div>
          )}
        </>
      )}
    </section>
  );
}
