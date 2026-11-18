import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import type { CommercialDeal, CommercialStage } from '../api/deals.api';
import { centsToDecimal, formatMoney, toCents } from '../lib/commercial-labels';
import { DealCard } from './DealCard';

interface Props {
  stage: CommercialStage;
  deals: CommercialDeal[];
  openStages: CommercialStage[];
  onMove: (deal: CommercialDeal, stage: CommercialStage) => void;
  onWin: (deal: CommercialDeal) => void;
  onLose: (deal: CommercialDeal) => void;
}

export function StageColumn({ stage, deals, openStages, onMove, onWin, onLose }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((acc, d) => acc + (toCents(d.finalAmount ?? '') ?? 0), 0);

  return (
    <section
      ref={setNodeRef}
      aria-label={stage.name}
      data-testid={`stage-${stage.id}`}
      className={cn(
        'min-w-[280px] shrink-0 snap-start rounded-lg border border-neutral-200 bg-neutral-50 p-sm',
        'lg:min-w-0 lg:shrink',
        isOver && 'ring-2 ring-primary-400',
      )}
    >
      <header className="mb-sm border-t-4 pt-xs" style={{ borderTopColor: stage.color }}>
        <h2 className="text-sm font-semibold text-neutral-900">
          {stage.name} <span className="font-normal text-neutral-600">({deals.length})</span>
        </h2>
        {stage.kind === 'open' && (
          <p className="text-xs text-neutral-700">{formatMoney(centsToDecimal(total))}</p>
        )}
        {stage.slaDays != null && (
          <p className="text-xs text-neutral-600">Prazo: {stage.slaDays} dia(s)</p>
        )}
      </header>
      <ul className="flex flex-col gap-sm">
        {deals.map((d) => (
          <DealCard
            key={d.id}
            deal={d}
            openStages={openStages}
            onMove={onMove}
            onWin={onWin}
            onLose={onLose}
          />
        ))}
      </ul>
    </section>
  );
}
