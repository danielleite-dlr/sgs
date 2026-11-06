import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useHasPermission } from '../operations-permissions';
import { ClientsListQuery } from '@/features/clients/api/clients.api';
import {
  formatCurrencyDisplay,
  maskCurrency,
  unmaskCurrency,
} from '@/features/catalog/utils/currency-mask';
import {
  AdjustClientCreditMutation,
  ClientCreditBalancesQuery,
  ClientCreditMovementsQuery,
  type AdjustClientCreditResult,
  type ClientCreditBalance,
  type ClientCreditBalancesResult,
  type ClientCreditMovementsResult,
} from '../api/financial.api';
import { FinancialReportLayout } from '../components/FinancialReportLayout';

const KIND_LABELS: Record<string, string> = {
  deposit: 'Sinal',
  consumption: 'Uso em comanda',
  reopen_refund: 'Estorno de comanda',
  manual_adjustment: 'Ajuste manual',
};

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

interface ClientsListResult {
  clients: { rows: { id: string; fullName: string }[] };
}

function HistorySheet({
  client,
  onClose,
}: {
  client: ClientCreditBalance | null;
  onClose: () => void;
}) {
  const { data, loading } = useQuery<ClientCreditMovementsResult>(ClientCreditMovementsQuery, {
    variables: { clientId: client?.clientId },
    skip: !client,
  });
  return (
    <Sheet open={client !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Histórico de crédito</SheetTitle>
          <SheetDescription>{client?.clientName}</SheetDescription>
        </SheetHeader>
        {loading ? (
          <Skeleton className="h-24 w-full mt-md" />
        ) : (data?.clientCreditMovements ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500 mt-md">Nenhuma movimentação.</p>
        ) : (
          <table className="w-full text-sm mt-md" data-testid="credit-history">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="py-xs">Data</th>
                <th>Tipo</th>
                <th className="text-right">Valor</th>
                <th className="pl-sm">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {data!.clientCreditMovements.map((m) => (
                <tr key={m.id} className="border-t border-neutral-100">
                  <td className="py-xs">{new Date(m.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td>{KIND_LABELS[m.kind] ?? m.kind}</td>
                  <td className={`text-right ${Number(m.amount) < 0 ? 'text-outflow-500' : ''}`}>
                    {brl(m.amount)}
                  </td>
                  <td className="pl-sm">{m.reason ?? (m.comandaId ? 'Comanda' : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AdjustDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [search, setSearch] = useState('');
  const [client, setClient] = useState<{ id: string; fullName: string } | null>(null);
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');

  const clients = useQuery<ClientsListResult>(ClientsListQuery, {
    variables: { search, limit: 8, offset: 0 },
    skip: search.trim().length < 2 || client !== null,
  });
  const [adjust, { loading: saving }] = useMutation<AdjustClientCreditResult>(
    AdjustClientCreditMutation,
    { refetchQueries: [ClientCreditBalancesQuery] },
  );

  const unmasked = unmaskCurrency(value);
  const amountValid = unmasked !== '' && Number(unmasked) > 0;
  const canSave = client !== null && amountValid && reason.trim().length >= 3 && !saving;

  function reset() {
    setSearch('');
    setClient(null);
    setDirection('add');
    setValue('');
    setReason('');
  }

  async function save() {
    if (!client || !amountValid) return;
    try {
      const res = await adjust({
        variables: {
          input: {
            clientId: client.id,
            amount: direction === 'remove' ? `-${unmasked}` : unmasked,
            reason: reason.trim(),
          },
        },
      });
      const errors = res.data?.adjustClientCredit.errors ?? [];
      if (errors.length > 0) {
        toast.error(errors[0].message);
        return;
      }
      toast.success('Crédito atualizado.');
      reset();
      onOpenChange(false);
    } catch {
      toast.error('Não foi possível atualizar o crédito.');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Incluir crédito</DialogTitle>
          <DialogDescription>
            Ajuste manual do saldo de crédito do cliente. Não movimenta o caixa.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <Label htmlFor="credit-client-search">Cliente</Label>
            {client ? (
              <div className="flex items-center justify-between rounded-md border border-neutral-200 px-sm py-xs text-sm">
                <span data-testid="credit-selected-client">{client.fullName}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setClient(null)}>
                  Trocar
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id="credit-client-search"
                  placeholder="Buscar cliente pelo nome"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <ul className="flex flex-col gap-xs">
                  {(clients.data?.clients.rows ?? []).map((c) => (
                    <li key={c.id}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setClient({ id: c.id, fullName: c.fullName })}
                      >
                        {c.fullName}
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <RadioGroup
            value={direction}
            onValueChange={(v) => setDirection(v as 'add' | 'remove')}
            className="flex gap-md"
            aria-label="Tipo de ajuste"
          >
            <div className="flex items-center gap-xs">
              <RadioGroupItem id="credit-dir-add" value="add" />
              <Label htmlFor="credit-dir-add">Adicionar</Label>
            </div>
            <div className="flex items-center gap-xs">
              <RadioGroupItem id="credit-dir-remove" value="remove" />
              <Label htmlFor="credit-dir-remove">Remover</Label>
            </div>
          </RadioGroup>

          <div className="flex flex-col gap-xs">
            <Label htmlFor="credit-amount">Valor (R$)</Label>
            <Input
              id="credit-amount"
              inputMode="numeric"
              placeholder="0,00"
              value={value}
              onChange={(e) => setValue(maskCurrency(e.target.value))}
            />
          </div>

          <div className="flex flex-col gap-xs">
            <Label htmlFor="credit-reason">Motivo</Label>
            <Textarea
              id="credit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Por que o saldo está sendo ajustado?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!canSave} onClick={save}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreditoClientePage() {
  const canRead = useHasPermission('credit.read');
  const canAdjust = useHasPermission('credit.adjust');

  const [filter, setFilter] = useState('');
  const [history, setHistory] = useState<ClientCreditBalance | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const { data, loading, error } = useQuery<ClientCreditBalancesResult>(ClientCreditBalancesQuery, {
    skip: !canRead,
  });

  if (!canRead) {
    return (
      <FinancialReportLayout title="Crédito de cliente" filters={null} showExport={false}>
        <p className="text-sm text-neutral-600">Você não tem acesso ao crédito de clientes.</p>
      </FinancialReportLayout>
    );
  }

  const rows = (data?.clientCreditBalances ?? []).filter((r) =>
    r.clientName.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <FinancialReportLayout
      title="Crédito de cliente"
      description="Clientes com saldo de crédito para consumo em comandas (sinais e ajustes)."
      filters={
        <label className="flex flex-col gap-xs max-w-sm">
          <span className="text-xs font-semibold text-neutral-600">Filtrar por cliente</span>
          <Input
            className="h-9 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Nome do cliente"
          />
        </label>
      }
      showExport={false}
    >
      {canAdjust && (
        <div className="mb-sm">
          <Button size="sm" onClick={() => setAdjustOpen(true)}>
            Incluir Crédito
          </Button>
        </div>
      )}
      <div className="rounded-md border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm" data-testid="credit-balances">
          <thead className="bg-primary-700 text-white">
            <tr>
              <th className="px-md py-sm text-left font-semibold">Cliente</th>
              <th className="px-md py-sm text-right font-semibold">Saldo</th>
              <th className="px-md py-sm text-center font-semibold">Histórico</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="p-md">
                  <Skeleton className="h-6 w-full" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={3} className="text-center py-md text-sm text-error-600">
                  Não foi possível carregar o crédito dos clientes.
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-md text-sm text-neutral-500">
                  Não existem clientes com saldo de crédito
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.clientId} data-testid={`credit-row-${r.clientId}`} className="border-t border-neutral-100">
                  <td className="px-md py-sm">{r.clientName}</td>
                  <td className="px-md py-sm text-right font-medium">{brl(r.balance)}</td>
                  <td className="px-md py-sm text-center">
                    <Button type="button" size="sm" variant="outline" onClick={() => setHistory(r)}>
                      Histórico
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <HistorySheet client={history} onClose={() => setHistory(null)} />
      {canAdjust && <AdjustDialog open={adjustOpen} onOpenChange={setAdjustOpen} />}
    </FinancialReportLayout>
  );
}
