import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Construction, FileText, Plus, MoreHorizontal, AlertCircle } from 'lucide-react';
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
  mockContracts,
  formatBRL,
  formatDate,
  CONTRACT_STATUS_LABELS,
  type MockContract,
  type ContractStatus,
} from '../mocks/bridal.mock';

// ─── Status badge styling ─────────────────────────────────────────────────────

const STATUS_BADGE_CLASS: Record<ContractStatus, string> = {
  current: 'border-success-500 text-success-700 bg-success-50',
  overdue: 'border-error-500 text-error-700 bg-error-50',
  settled: 'border-neutral-300 text-neutral-500 bg-neutral-50',
};

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilter, onClear, onNew }: { hasFilter: boolean; onClear: () => void; onNew: () => void }) {
  if (hasFilter) {
    return (
      <div className="flex flex-col items-center justify-center py-2xl text-center space-y-md">
        <AlertCircle className="h-12 w-12 text-neutral-300" />
        <h2 className="text-base font-semibold text-neutral-800">Nenhum contrato com esse status</h2>
        <Button variant="ghost" onClick={onClear}>
          Limpar filtro
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-2xl text-center space-y-md">
      <FileText className="h-12 w-12 text-neutral-300" />
      <h2 className="text-base font-semibold text-neutral-800">Nenhum contrato ainda</h2>
      <p className="text-sm text-neutral-500 max-w-md">
        Contratos de evento vinculam grupos de noivas a valores, parcelas e políticas de cancelamento.
      </p>
      <Button onClick={onNew}>
        <Plus className="mr-2 h-4 w-4" />
        Novo contrato
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
            A criação de contratos estará disponível na Phase 4. Por enquanto você está visualizando
            dados de exemplo do mockup.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Fechar</AlertDialogCancel>
          <AlertDialogAction disabled>Criar contrato (em breve)</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * ContractsPlaceholder — Phase 4 mockup.
 * Replaces the previous empty stub. Exports the same name so the router keeps working.
 */
export function ContractsPlaceholder() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');

  const filtered =
    statusFilter === 'all'
      ? mockContracts
      : mockContracts.filter((c) => c.status === statusFilter);

  const hasFilter = statusFilter !== 'all';

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
        title="Contratos"
        breadcrumbs={[{ label: 'Eventos' }, { label: 'Contratos' }]}
        cta={
          <ComingSoonDialog
            trigger={
              <Button size="sm" className="gap-xs">
                <Plus className="h-4 w-4" />
                Novo contrato
              </Button>
            }
          />
        }
      />

      {/* Status filter pills */}
      <div className="flex items-center gap-xs flex-wrap">
        {(['all', 'current', 'overdue', 'settled'] as const).map((s) => (
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
            {s === 'all' ? 'Todos' : CONTRACT_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <DataTable<MockContract>
        rowKey={(r) => r.id}
        rows={filtered}
        onRowClick={(r) => navigate(`/contratos/${r.id}`)}
        empty={
          <EmptyState
            hasFilter={hasFilter}
            onClear={() => setStatusFilter('all')}
            onNew={() => {}}
          />
        }
        columns={[
          {
            key: 'client',
            header: 'Cliente / Noiva',
            cell: (r) => (
              <div className="flex items-center gap-sm">
                <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-semibold shrink-0">
                  {r.clientInitials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-neutral-800 truncate">{r.clientName}</span>
                  <span className="text-xs text-neutral-400">Contrato #{r.id}</span>
                </div>
              </div>
            ),
          },
          {
            key: 'totalValue',
            header: 'Valor total',
            cell: (r) => (
              <span className="text-sm font-semibold text-neutral-800">
                {formatBRL(r.totalValue)}
              </span>
            ),
          },
          {
            key: 'installments',
            header: 'Parcelas',
            cell: (r) => (
              <span className="text-sm text-neutral-700">
                {r.installmentsPaid}/{r.installmentsTotal}
              </span>
            ),
          },
          {
            key: 'nextDue',
            header: 'Próximo vencimento',
            sortable: true,
            cell: (r) =>
              r.nextDueDate ? (
                <span
                  className={[
                    'text-sm',
                    r.status === 'overdue' ? 'text-error-600 font-medium' : 'text-neutral-700',
                  ].join(' ')}
                >
                  {formatDate(r.nextDueDate)}
                </span>
              ) : (
                <span className="text-sm text-neutral-400">—</span>
              ),
          },
          {
            key: 'status',
            header: 'Status',
            cell: (r) => (
              <Badge variant="outline" className={STATUS_BADGE_CLASS[r.status]}>
                {CONTRACT_STATUS_LABELS[r.status]}
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
                  <DropdownMenuItem onSelect={() => navigate(`/contratos/${r.id}`)}>
                    Ver detalhes
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-neutral-400 cursor-not-allowed"
                  >
                    Editar (em breve)
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
