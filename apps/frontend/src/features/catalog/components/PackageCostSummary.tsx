import { computeProfit } from '../utils/package-profit';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const pct = (v: number) =>
  `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export interface PackageCostSummaryProps {
  totalCost: string | number;
  packagePrice: string | number;
  compact?: boolean;
}

/** Custo total, lucro em R$ e % do pacote. Só para ADMIN/MANAGER (o backend devolve null aos demais). */
export function PackageCostSummary({ totalCost, packagePrice, compact }: PackageCostSummaryProps) {
  const { cost, profit, percent } = computeProfit(totalCost, packagePrice);
  const profitCls = profit < 0 ? 'text-error-500' : 'text-success-500';

  if (compact) {
    return (
      <div className="flex flex-col text-sm" data-testid="package-profit">
        <span className={`font-semibold ${profitCls}`}>
          {fmt(profit)} ({pct(percent)})
        </span>
        <span className="text-xs text-neutral-500">custo {fmt(cost)}</span>
      </div>
    );
  }

  return (
    <dl
      className="grid grid-cols-3 gap-sm rounded-md border border-neutral-200 bg-neutral-50 p-sm text-sm"
      data-testid="package-cost-summary"
    >
      <div>
        <dt className="text-xs text-neutral-500">Custo total</dt>
        <dd className="font-semibold text-neutral-800">{fmt(cost)}</dd>
      </div>
      <div>
        <dt className="text-xs text-neutral-500">Lucro</dt>
        <dd className={`font-semibold ${profitCls}`}>{fmt(profit)}</dd>
      </div>
      <div>
        <dt className="text-xs text-neutral-500">% de lucro</dt>
        <dd className={`font-semibold ${profitCls}`}>{pct(percent)}</dd>
      </div>
    </dl>
  );
}
