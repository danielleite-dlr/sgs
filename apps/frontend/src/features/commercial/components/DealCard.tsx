import { useDraggable } from '@dnd-kit/core';
import { Link } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { CommercialDeal, CommercialStage } from '../api/deals.api';
import { useCommercialAccess } from '../commercial-permissions';
import { KIND_LABEL, formatMoney, formatYmd } from '../lib/commercial-labels';

interface Props {
  deal: CommercialDeal;
  /** Etapas abertas (destinos do menu "Mover para…"). */
  openStages: CommercialStage[];
  onMove: (deal: CommercialDeal, stage: CommercialStage) => void;
  onWin: (deal: CommercialDeal) => void;
  onLose: (deal: CommercialDeal) => void;
}

export function DealCard({ deal, openStages, onMove, onWin, onLose }: Props) {
  // D-21: ponto único no front para "Marcar como ganho".
  const { canWin } = useCommercialAccess();
  const isOpen = deal.status === 'open';
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    disabled: !isOpen,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const title = KIND_LABEL[deal.kind] ?? deal.kind;
  const targets = openStages.filter((s) => s.id !== deal.stage.id);

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={`deal-${deal.id}`}
      data-overdue={deal.overdue ? 'true' : undefined}
      className={cn(
        'relative rounded-md border bg-white p-sm shadow-sm',
        deal.overdue ? 'border-error-500 bg-error-50' : 'border-neutral-200',
        isDragging && 'z-10 opacity-80 shadow-sm ring-2 ring-primary-300',
      )}
    >
      <div className="flex items-start gap-xs">
        <div
          className={cn('min-w-0 flex-1', isOpen && 'cursor-grab touch-none')}
          {...(isOpen ? listeners : {})}
          {...(isOpen ? attributes : {})}
        >
          <Link
            to={`/comercial/leads/${deal.leadId}`}
            className="block break-words text-sm font-semibold text-neutral-900 hover:underline"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {deal.lead.fullName}
          </Link>
          <p className="text-xs text-neutral-700">
            {title}
            {deal.kind === 'debutante' && deal.beneficiaryName ? ` — ${deal.beneficiaryName}` : ''}
            {deal.eventDate ? ` · ${formatYmd(deal.eventDate)}` : ''}
          </p>
          {deal.packageName && <p className="text-xs text-neutral-700">{deal.packageName}</p>}
          {deal.finalAmount != null && (
            <p className="text-sm font-semibold text-neutral-900">{formatMoney(deal.finalAmount)}</p>
          )}
          {deal.assignee && <p className="text-xs text-neutral-600">{deal.assignee.displayName}</p>}
          {deal.overdue && <p className="mt-xs text-xs font-semibold text-error-700">Atrasado</p>}
        </div>
        {isOpen && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                aria-label={`Ações de ${deal.lead.fullName}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Mover para…</DropdownMenuLabel>
              {targets.map((s) => (
                <DropdownMenuItem key={s.id} onSelect={() => onMove(deal, s)}>
                  {s.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {canWin && (
                <DropdownMenuItem onSelect={() => onWin(deal)}>Marcar como ganho</DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => onLose(deal)}>Marcar como perdido</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
}
