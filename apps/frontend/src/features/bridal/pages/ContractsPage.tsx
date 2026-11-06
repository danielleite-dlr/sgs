import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Plus } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import { toDisplayName } from '@/lib/format-name';
import { useBridalPermission } from '../bridal-permissions';
import { ContractsQuery, type ContractsResult } from '../api/contracts.api';
import {
  CONTRACT_STATUS_LABEL,
  derivedBadges,
  formatDateOnly,
} from '../lib/contract-labels';
import { ContractFormDialog } from '../components/ContractFormDialog';
import { ContractSettingsTab } from '../components/ContractSettingsTab';

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

const FILTERS = [
  { value: 'all', label: 'Todos', vars: {} },
  { value: 'deposit_pending', label: 'Entrada pendente', vars: { derived: 'deposit_pending' } },
  { value: 'due_soon', label: 'Vence em 3 dias', vars: { derived: 'due_soon' } },
  { value: 'overdue', label: 'Vencidos', vars: { derived: 'overdue' } },
  { value: 'settled', label: 'Quitados', vars: { derived: 'settled' } },
  { value: 'cancelled', label: 'Cancelados', vars: { status: 'cancelled' } },
] as const;

export function ContractsPage() {
  const canRead = useBridalPermission('contract.read');
  const canWrite = useBridalPermission('contract.write');
  const canSettings = useBridalPermission('contract.settings');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const groupParam = params.get('grupo');
  const newParam = params.get('novo');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('all');
  const active = FILTERS.find((f) => f.value === filter)!;

  const { data, loading, error } = useQuery<ContractsResult>(ContractsQuery, {
    variables: active.vars,
    skip: !canRead,
  });

  function closeForm() {
    const next = new URLSearchParams(params);
    next.delete('grupo');
    next.delete('novo');
    setParams(next, { replace: true });
  }

  const list = (
    <div className="flex flex-col gap-md">
      <div role="group" aria-label="Filtrar contratos" className="flex flex-wrap gap-xs">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            type="button"
            size="sm"
            variant={filter === f.value ? 'default' : 'outline'}
            aria-pressed={filter === f.value}
            data-testid={`contract-filter-${f.value}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-error-600">Não foi possível carregar os contratos.</p>
      ) : loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (data?.contracts ?? []).length === 0 ? (
        <p className="text-sm text-neutral-600">Nenhum contrato encontrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
          <table className="w-full text-sm" data-testid="contracts-table">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="p-sm">Código</th>
                <th>Noiva</th>
                <th>Evento</th>
                <th className="text-right">Total</th>
                <th className="text-right">Pago</th>
                <th className="text-right">Saldo</th>
                <th>Prazo</th>
                <th className="pr-sm">Situação</th>
              </tr>
            </thead>
            <tbody>
              {data!.contracts.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                  data-testid={`contract-row-${c.id}`}
                  onClick={() => navigate(`/contratos/${c.id}`)}
                >
                  <td className="p-sm font-semibold">
                    <Link to={`/contratos/${c.id}`} onClick={(e) => e.stopPropagation()}>
                      {c.code}
                    </Link>
                  </td>
                  <td>{toDisplayName(c.brideName)}</td>
                  <td>{formatDateOnly(c.eventDate)}</td>
                  <td className="text-right">{brl(c.totalAmount)}</td>
                  <td className="text-right">{brl(c.paid)}</td>
                  <td className="text-right">{brl(c.balance)}</td>
                  <td>{formatDateOnly(c.balanceDueDate)}</td>
                  <td className="pr-sm">
                    <div className="flex flex-wrap gap-xs py-xs">
                      <Badge variant="outline">{CONTRACT_STATUS_LABEL[c.status] ?? c.status}</Badge>
                      {derivedBadges(c).map((b) => (
                        <Badge key={b.label} variant={b.tone}>
                          {b.label}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Contratos"
        cta={
          canWrite ? (
            <Button
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set('novo', '1');
                setParams(next);
              }}
              data-testid="new-contract"
            >
              <Plus className="mr-xs h-4 w-4" aria-hidden="true" />
              Novo contrato
            </Button>
          ) : undefined
        }
      />
      {!canRead ? (
        <p className="rounded-md border border-neutral-200 bg-white p-md text-sm text-neutral-600">
          Você não tem acesso aos contratos.
        </p>
      ) : canSettings ? (
        <Tabs defaultValue={params.get('aba') === 'configuracoes' ? 'settings' : 'contracts'}>
          <TabsList>
            <TabsTrigger value="contracts">Contratos</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="contracts">{list}</TabsContent>
          <TabsContent value="settings">
            <ContractSettingsTab />
          </TabsContent>
        </Tabs>
      ) : (
        list
      )}

      {canWrite && !groupParam && newParam && (
        <ContractFormDialog
          open
          onOpenChange={(o) => {
            if (!o) closeForm();
          }}
        />
      )}
      {canWrite && groupParam && (
        <ContractFormDialog
          open
          groupId={groupParam}
          onOpenChange={(o) => {
            if (!o) closeForm();
          }}
        />
      )}
    </div>
  );
}
