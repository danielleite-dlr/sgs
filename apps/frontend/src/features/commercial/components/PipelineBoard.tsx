import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useMutation } from '@apollo/client';
import { toast } from 'sonner';
import {
  MoveCommercialDealMutation,
  type CommercialDeal,
  type CommercialDealPayload,
  type CommercialStage,
} from '../api/deals.api';
import { useCommercialAccess } from '../commercial-permissions';
import { firstError } from '../lib/commercial-labels';
import { StageColumn } from './StageColumn';

interface Props {
  stages: CommercialStage[];
  deals: CommercialDeal[];
  onWin: (deal: CommercialDeal) => void;
  onLose: (deal: CommercialDeal) => void;
}

export function PipelineBoard({ stages, deals, onWin, onLose }: Props) {
  const { canWin } = useCommercialAccess();
  const [moveDeal] = useMutation<{ moveCommercialDeal: CommercialDealPayload }>(
    MoveCommercialDealMutation,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const openStages = ordered.filter((s) => s.kind === 'open');

  function handleWin(deal: CommercialDeal) {
    // D-21: o diálogo de ganho só abre para quem pode.
    if (!canWin) {
      toast.error('Você não tem permissão para marcar negócios como ganhos.');
      return;
    }
    onWin(deal);
  }

  async function move(deal: CommercialDeal, target: CommercialStage) {
    try {
      const res = await moveDeal({
        variables: { id: deal.id, stageId: target.id },
        // Otimista: o card muda de coluna na hora; se a API recusar, a camada otimista
        // é descartada e o card volta sozinho para a etapa original.
        optimisticResponse: {
          moveCommercialDeal: {
            __typename: 'CommercialDealPayload',
            deal: {
              ...deal,
              stage: target,
              stageEnteredAt: new Date().toISOString(),
              overdue: false,
              overdueSince: null,
            },
            errors: [],
          } as unknown as CommercialDealPayload,
        },
      });
      const p = res.data?.moveCommercialDeal;
      if (p?.errors.length) toast.error(firstError(p.errors, 'Não foi possível mover o negócio.'));
    } catch {
      toast.error('Não foi possível mover o negócio. Tente novamente.');
    }
  }

  /** Soltar um card numa coluna. */
  function handleDealDrop(deal: CommercialDeal, target: CommercialStage) {
    if (deal.status !== 'open' || target.id === deal.stage.id) return;
    if (target.kind === 'won') handleWin(deal);
    else if (target.kind === 'lost') onLose(deal);
    else void move(deal, target);
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const deal = deals.find((d) => d.id === String(e.active.id));
    const target = ordered.find((s) => s.id === String(e.over!.id));
    if (deal && target) handleDealDrop(deal, target);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex snap-x snap-mandatory gap-sm overflow-x-auto pb-sm lg:grid lg:auto-cols-fr lg:grid-flow-col lg:overflow-visible">
        {ordered.map((s) => (
          <StageColumn
            key={s.id}
            stage={s}
            deals={deals.filter((d) => d.stage.id === s.id)}
            openStages={openStages}
            onMove={(d, st) => void move(d, st)}
            onWin={handleWin}
            onLose={onLose}
          />
        ))}
      </div>
    </DndContext>
  );
}
