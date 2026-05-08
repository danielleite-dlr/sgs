import { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PeriodChip {
  label: string;
}

/**
 * Controle de entrada e saída — Trinks-style /financeiro page.
 *
 * Layout (1:1 with Trinks reference):
 *   ┌────────────────────────────────────────────────────────────┐
 *   │ Controle de entrada e saída                                │
 *   │  ──────────────────────────                                │
 *   │ ┌──────────────────┐                ┌────────────────────┐ │
 *   │ │ Período: chip    │                │ Lançamentos        │ │
 *   │ │                  │                │ Nenhum lançamento… │ │
 *   │ │      Resultado   │                │                    │ │
 *   │ │      R$ 0,00     │                │                    │ │
 *   │ │                  │                │                    │ │
 *   │ │  [Receita ↑]     │                │                    │ │
 *   │ │  [Despesa ↓]     │                │                    │ │
 *   │ │                  │                │                    │ │
 *   │ │  [Lançar receita][Lançar despesa] │                    │ │
 *   │ └──────────────────┘                └────────────────────┘ │
 *   └────────────────────────────────────────────────────────────┘
 */
export function FinanceiroPage() {
  const [period] = useState<PeriodChip>({ label: 'Período: 01/05/2026 - 31/05/2026' });

  return (
    <div className="flex flex-col gap-md max-w-7xl">
      <header className="border-b border-neutral-200 pb-sm">
        <h1 className="text-base font-semibold text-neutral-700">Controle de entrada e saída</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-lg">
        {/* Coluna esquerda — resumo + ações */}
        <div className="flex flex-col items-center gap-md py-md">
          <span className="rounded-md border border-error-500/40 bg-white px-md py-xs text-sm text-error-500 font-medium">
            {period.label}
          </span>

          <div className="text-center mt-md">
            <p className="text-sm text-neutral-500 mb-xs">Resultado</p>
            <p className="text-3xl font-bold text-neutral-800">R$ 0,00</p>
          </div>

          <div className="grid grid-cols-2 gap-md w-full max-w-md mt-md">
            <article className="rounded-md border border-neutral-200 bg-white p-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500 mb-xs">Receita</p>
                <p className="text-sm font-bold text-neutral-800">R$ 0,00</p>
              </div>
              <TrendingUp className="h-5 w-5 text-success-500 shrink-0" />
            </article>
            <article className="rounded-md border border-neutral-200 bg-white p-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500 mb-xs">Despesa</p>
                <p className="text-sm font-bold text-neutral-800">R$ 0,00</p>
              </div>
              <TrendingDown className="h-5 w-5 text-error-500 shrink-0" />
            </article>
          </div>

          <div className="grid grid-cols-2 gap-md w-full max-w-md mt-sm">
            <Button className="bg-success-500 hover:bg-success-700 text-white font-semibold gap-xs">
              Lançar receita <TrendingUp className="h-4 w-4" />
            </Button>
            <Button className="bg-error-500 hover:bg-error-700 text-white font-semibold gap-xs">
              Lançar despesa <TrendingDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Coluna direita — Lançamentos */}
        <aside>
          <h2 className="text-sm font-semibold text-neutral-800 mb-sm">Lançamentos</h2>
          <p className="text-xs text-primary-500 leading-relaxed">
            Nenhum lançamento foi encontrado no período selecionado. Selecione "Lançar despesa" ou
            "Lançar receita" para adicionar um novo registro.
          </p>
        </aside>
      </div>
    </div>
  );
}
