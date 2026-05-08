import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export interface FinancialReportLayoutProps {
  /** Page title shown above the filter bar (orange/primary color, underlined). */
  title: string;
  /** Optional helper text shown below the title (small, gray). */
  description?: ReactNode;
  /** Filter inputs (date pickers, selects, checkboxes). */
  filters: ReactNode;
  /** Filter primary action — defaults to "Filtrar"/"Pesquisar". */
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  /** Show "Exportar" button alongside the primary action. */
  showExport?: boolean;
  onExport?: () => void;
  /** "Limpar" link — clears filters. */
  onClear?: () => void;
  /** Body content — table, empty state, etc. */
  children: ReactNode;
  /** Optional content rendered to the right of the title (tabs, action buttons). */
  topRight?: ReactNode;
  /** Tabs row rendered above the filter bar. */
  tabs?: ReactNode;
}

/**
 * Trinks-style financial report layout.
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ Título do Relatório                                         │
 *   │  ─────────────────────────────────────                      │
 *   │ ┌───────────────────────────────────────────────┐           │
 *   │ │ [date range][selects][checkboxes]             │           │
 *   │ │                  [Filtrar] [Exportar] [Limpar]│           │
 *   │ └───────────────────────────────────────────────┘           │
 *   │                                                             │
 *   │ {body — tabela, empty state, etc.}                          │
 *   └─────────────────────────────────────────────────────────────┘
 */
export function FinancialReportLayout({
  title,
  description,
  filters,
  primaryActionLabel = 'Filtrar',
  onPrimaryAction,
  showExport = true,
  onExport,
  onClear,
  children,
  topRight,
  tabs,
}: FinancialReportLayoutProps) {
  return (
    <div className="flex flex-col gap-md max-w-7xl">
      <header className="border-b border-neutral-200 pb-sm flex items-center justify-between gap-md">
        <div>
          <h1 className="text-base font-semibold text-primary-500">{title}</h1>
          {description && (
            <p className="text-xs text-primary-500 mt-xs">{description}</p>
          )}
        </div>
        {topRight}
      </header>

      {tabs && <div className="border-b border-neutral-200">{tabs}</div>}

      <section
        aria-label="Filtros"
        className="rounded-md border border-neutral-200 bg-neutral-50 p-md"
      >
        <div className="flex flex-col lg:flex-row lg:items-end gap-md">
          <div className="flex-1 min-w-0">{filters}</div>
          <div className="flex items-center gap-xs shrink-0 self-end">
            {onPrimaryAction && (
              <Button
                size="sm"
                onClick={onPrimaryAction}
                className="bg-error-500 hover:bg-error-700 text-white font-semibold"
              >
                {primaryActionLabel}
              </Button>
            )}
            {showExport && (
              <Button
                size="sm"
                variant="outline"
                onClick={onExport}
                className="border-error-500 text-error-500 hover:bg-error-50"
              >
                Exportar
              </Button>
            )}
            {onClear && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClear}
                className="text-neutral-500"
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      </section>

      <div>{children}</div>
    </div>
  );
}

/**
 * Trinks-style empty state, used inside report bodies.
 */
export function ReportEmptyState({
  title = 'Nenhum resultado encontrado',
  body,
}: {
  title?: string;
  body?: ReactNode;
}) {
  return (
    <div className="text-center py-12 text-sm text-neutral-500">
      <p className="font-semibold mb-xs">{title}</p>
      {body && <p className="text-xs">{body}</p>}
    </div>
  );
}

/**
 * Trinks-style tab strip — orange underline on active.
 */
export function ReportTabs({
  tabs,
}: {
  tabs: Array<{ id: string; label: string; active?: boolean; onClick?: () => void }>;
}) {
  return (
    <nav className="flex gap-lg overflow-x-auto" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.active}
          onClick={t.onClick}
          className={`text-sm py-sm transition-colors whitespace-nowrap ${
            t.active
              ? 'text-primary-500 font-semibold border-b-2 border-primary-500 -mb-px'
              : 'text-neutral-600 hover:text-neutral-800'
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
