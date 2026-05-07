import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Construction, Heart, Plus, MoreHorizontal, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  mockBridalGroups,
  formatBRL,
  formatDate,
  BRIDAL_STATUS_LABELS,
  type MockBridalGroup,
  type BridalGroupStatus,
} from '../mocks/bridal.mock';

// ─── Status badge styling ─────────────────────────────────────────────────────

const STATUS_BADGE_CLASS: Record<BridalGroupStatus, string> = {
  planning: 'border-warning-500 text-warning-600 bg-warning-50',
  confirmed: 'border-success-500 text-success-700 bg-success-50',
  completed: 'border-neutral-300 text-neutral-500 bg-neutral-50',
};

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-2xl text-center space-y-md">
      <Heart className="h-12 w-12 text-neutral-300" />
      <h2 className="text-base font-semibold text-neutral-800">Nenhum grupo de noivas ainda</h2>
      <p className="text-sm text-neutral-500 max-w-md">
        Crie grupos para organizar o atendimento da noiva e suas acompanhantes em um único evento.
      </p>
      <Button onClick={onNew}>
        <Plus className="mr-2 h-4 w-4" />
        Novo grupo
      </Button>
    </div>
  );
}

// ─── "Em breve" dialog ────────────────────────────────────────────────────────

function ComingSoonDialog({ trigger }: { trigger: React.ReactNode }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Funcionalidade em breve</AlertDialogTitle>
          <AlertDialogDescription>
            A criação de grupos de noivas estará disponível na Phase 4. Por enquanto você está
            visualizando dados de exemplo do mockup.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Fechar</AlertDialogCancel>
          <AlertDialogAction disabled>Criar grupo (em breve)</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * BridalGroupsPlaceholder — Phase 4 mockup.
 * Replaces the previous empty stub. Exports the same name so the router keeps working.
 */
export function BridalGroupsPlaceholder() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<BridalGroupStatus | 'all'>('all');

  const filtered =
    statusFilter === 'all'
      ? mockBridalGroups
      : mockBridalGroups.filter((g) => g.status === statusFilter);

  return (
    <div className="flex flex-col gap-md">
      {/* Mockup badge */}
      <div className="flex items-center gap-sm">
        <Badge
          variant="outline"
          className="gap-xs border-warning-500 text-warning-600 bg-warning-50 text-xs"
        >
          <Construction className="h-3 w-3" />
          Mockup — Phase 4 (em breve)
        </Badge>
      </div>

      <PageHeader
        title="Grupos de Noivas"
        breadcrumbs={[{ label: 'Eventos' }, { label: 'Grupos de Noivas' }]}
        cta={
          <ComingSoonDialog
            trigger={
              <Button size="sm" className="gap-xs">
                <Plus className="h-4 w-4" />
                Novo grupo
              </Button>
            }
          />
        }
      />

      {/* Status filter pills */}
      <div className="flex items-center gap-xs flex-wrap">
        {(['all', 'planning', 'confirmed', 'completed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={[
              'px-md py-xs rounded-full text-sm font-medium border transition-colors',
              statusFilter === s
                ? 'bg-primary-500 text-white border-primary-500'
                : 'text-neutral-600 border-neutral-200 hover:bg-neutral-50',
            ].join(' ')}
          >
            {s === 'all' ? 'Todos' : BRIDAL_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <DataTable<MockBridalGroup>
        rowKey={(r) => r.id}
        rows={filtered}
        onRowClick={(r) => {
          if (r.contractId) {
            navigate(`/contratos/${r.contractId}`);
          }
        }}
        empty={<EmptyState onNew={() => {}} />}
        columns={[
          {
            key: 'bride',
            header: 'Noiva principal',
            cell: (r) => (
              <div className="flex items-center gap-sm">
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                  style={{ backgroundColor: r.bridesColor }}
                >
                  {r.bridesInitials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-neutral-800 truncate">{r.brideName}</span>
                  {r.contractId && (
                    <span className="text-xs text-neutral-400">Contrato #{r.contractId}</span>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'companions',
            header: 'Acompanhantes',
            cell: (r) => (
              <div className="flex items-center gap-xs">
                <Users className="h-4 w-4 text-neutral-400" />
                <Badge variant="outline" className="text-xs font-medium">
                  +{r.companionsCount}
                </Badge>
              </div>
            ),
          },
          {
            key: 'eventDate',
            header: 'Data do evento',
            sortable: true,
            cell: (r) => (
              <span className="text-sm text-neutral-700">{formatDate(r.eventDate)}</span>
            ),
          },
          {
            key: 'totalValue',
            header: 'Valor total',
            cell: (r) => (
              <span className="text-sm font-medium text-neutral-800">{formatBRL(r.totalValue)}</span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            cell: (r) => (
              <Badge variant="outline" className={STATUS_BADGE_CLASS[r.status]}>
                {BRIDAL_STATUS_LABELS[r.status]}
              </Badge>
            ),
          },
          {
            key: 'actions',
            header: 'Ações',
            cell: (r) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" aria-label="Ações">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem
                    onSelect={() => r.contractId && navigate(`/contratos/${r.contractId}`)}
                    disabled={!r.contractId}
                  >
                    Ver contrato
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-neutral-400 cursor-not-allowed"
                  >
                    Editar grupo (em breve)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
      />
    </div>
  );
}
