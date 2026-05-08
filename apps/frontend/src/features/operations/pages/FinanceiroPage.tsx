import { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';

interface PeriodChip {
  label: string;
}

/**
 * Controle de entrada e saída — /financeiro page (Trinks-pattern, SGS design system).
 *
 * Layout:
 *   PageHeader "Controle de entrada e saída"
 *   ┌──────────────────┐                ┌────────────────────┐
 *   │ Período: chip    │                │ Lançamentos        │
 *   │                  │                │                    │
 *   │     Resultado    │                │                    │
 *   │     R$ 0,00      │                │                    │
 *   │                  │                │                    │
 *   │  [Receita ↑]     │                │                    │
 *   │  [Despesa ↓]     │                │                    │
 *   │                  │                │                    │
 *   │  [Lançar receita][Lançar despesa] │                    │
 *   └──────────────────┘                └────────────────────┘
 */
export function FinanceiroPage() {
  const [period] = useState<PeriodChip>({ label: 'Período: 01/05/2026 - 31/05/2026' });

  return (
    <>
      <PageHeader
        title="Controle de entrada e saída"
        breadcrumbs={[
          { label: 'Financeiro' },
          { label: 'Controle de entrada e saída' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-lg">
        {/* Coluna esquerda — resumo + ações */}
        <div className="flex flex-col items-center gap-md py-md">
          <span className="rounded-md border border-primary-200 bg-primary-50 px-md py-xs text-sm text-primary-700 font-medium">
            {period.label}
          </span>

          <div className="text-center mt-md">
            <p className="text-sm text-neutral-500 mb-xs">Resultado</p>
            <p className="text-3xl font-semibold text-neutral-800">R$ 0,00</p>
          </div>

          <div className="grid grid-cols-2 gap-md w-full max-w-md mt-md">
            <article className="rounded-md border border-neutral-200 bg-white p-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500 mb-xs">Receita</p>
                <p className="text-sm font-semibold text-neutral-800">R$ 0,00</p>
              </div>
              <TrendingUp className="h-5 w-5 text-success-500 shrink-0" />
            </article>
            <article className="rounded-md border border-neutral-200 bg-white p-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500 mb-xs">Despesa</p>
                <p className="text-sm font-semibold text-neutral-800">R$ 0,00</p>
              </div>
              <TrendingDown className="h-5 w-5 text-error-500 shrink-0" />
            </article>
          </div>

          <div className="grid grid-cols-2 gap-md w-full max-w-md mt-sm">
            <Button>
              Lançar receita <TrendingUp className="h-4 w-4" />
            </Button>
            <Button variant="destructive">
              Lançar despesa <TrendingDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Coluna direita — Lançamentos */}
        <aside>
          <h2 className="text-sm font-semibold text-neutral-800 mb-sm">Lançamentos</h2>
          <p className="text-sm text-neutral-500 leading-relaxed">
            Nenhum lançamento foi encontrado no período selecionado. Selecione "Lançar despesa" ou
            "Lançar receita" para adicionar um novo registro.
          </p>
        </aside>
      </div>
    </>
  );
}
