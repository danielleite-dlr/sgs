import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { User, Phone, Clock, ShoppingBag, Scissors, Receipt, X, Package, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/layout/PageHeader';
import { useHasPermission } from '../operations-permissions';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import {
  AddComandaPaymentMutation,
  CloseComandaMutation,
  ComandaQuery,
  RemoveComandaItemMutation,
  RemoveComandaPaymentMutation,
  type AddComandaPaymentResult,
  type CloseComandaResult,
  type ComandaPayloadResult,
  type ComandaQueryResult,
  type RemoveComandaItemResult,
  type RemoveComandaPaymentResult,
} from '../api/comandas.api';
import { AddItemDialog, type AddItemMode } from '../components/comanda/AddItemDialog';
import { PaymentPanel } from '../components/comanda/PaymentPanel';
import { formatPhoneBr } from '@/lib/format-phone';
import { ReopenComandaDialog } from '../components/comanda/ReopenComandaDialog';
import { COMANDA_STATUS_LABELS } from '../lib/operations-labels';

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

function firstError(p: ComandaPayloadResult | undefined): string | null {
  return p && p.errors.length > 0 ? p.errors[0].message : null;
}

export function ComandaPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const canWrite = useHasPermission('comanda.write');
  const canClose = useHasPermission('comanda.close');
  const canReopen = useHasPermission('comanda.reopen');
  const canReviewRules = useHasPermission('commission.write');

  const { data, loading } = useQuery<ComandaQueryResult>(ComandaQuery, {
    variables: { id },
    skip: !id,
  });
  const [addMode, setAddMode] = useState<AddItemMode | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);

  const [removeItem, removeItemState] = useMutation<RemoveComandaItemResult>(RemoveComandaItemMutation);
  const [addPayment, addPaymentState] = useMutation<AddComandaPaymentResult>(AddComandaPaymentMutation);
  const [removePayment, removePaymentState] = useMutation<RemoveComandaPaymentResult>(
    RemoveComandaPaymentMutation,
  );
  const [closeComanda, closeState] = useMutation<CloseComandaResult>(CloseComandaMutation);
  const busy =
    removeItemState.loading ||
    addPaymentState.loading ||
    removePaymentState.loading ||
    closeState.loading;

  const comanda = data?.comanda ?? null;

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-md">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!comanda) {
    return (
      <div className="flex flex-col gap-md">
        <PageHeader
          title={t('operations.pos.title', 'Comanda')}
          breadcrumbs={[
            { label: 'Financeiro' },
            { label: 'Comandas', to: '/comanda' },
            { label: 'Não encontrada' },
          ]}
        />
        <Card>
          <CardContent className="space-y-sm py-lg">
            <p className="text-sm text-neutral-700">
              {t('operations.pos.notFound', 'Comanda não encontrada.')}
            </p>
            <Link to="/comanda" className="text-sm font-semibold text-primary-700 underline">
              Voltar para comandas
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOpen = comanda.status === 'open';
  const accruals = comanda.commissions.filter((c) => c.kind === 'accrual');

  async function handleRemoveItem(itemId: string) {
    if (!comanda) return;
    try {
      const res = await removeItem({ variables: { comandaId: comanda.id, itemId } });
      const err = firstError(res.data?.removeComandaItem);
      if (err) toast.error(err);
    } catch {
      toast.error('Não foi possível remover o item.');
    }
  }

  async function handleAddPayment(p: { method: string; amount: string }) {
    if (!comanda) return;
    try {
      const res = await addPayment({
        variables: { input: { comandaId: comanda.id, method: p.method, amount: p.amount } },
      });
      const err = firstError(res.data?.addComandaPayment);
      if (err) toast.error(err);
    } catch {
      toast.error('Não foi possível lançar o pagamento.');
    }
  }

  async function handleRemovePayment(paymentId: string) {
    if (!comanda) return;
    try {
      const res = await removePayment({ variables: { comandaId: comanda.id, paymentId } });
      const err = firstError(res.data?.removeComandaPayment);
      if (err) toast.error(err);
    } catch {
      toast.error('Não foi possível remover o pagamento.');
    }
  }

  async function handleClose() {
    if (!comanda) return;
    try {
      const res = await closeComanda({ variables: { id: comanda.id } });
      const err = firstError(res.data?.closeComanda);
      if (err) {
        toast.error(err);
        return;
      }
      toast.success(`Comanda ${comanda.code} fechada.`);
    } catch {
      toast.error('Não foi possível fechar a comanda.');
    }
  }

  return (
    <div className="flex flex-col gap-md">
      <PageHeader
        title={`Comanda ${comanda.code}`}
        breadcrumbs={[
          { label: 'Financeiro' },
          { label: 'Comandas', to: '/comanda' },
          { label: comanda.code },
        ]}
        cta={
          !isOpen && canReopen && comanda.status === 'closed' ? (
            <Button
              type="button"
              variant="outline"
              data-testid="comanda-reopen"
              onClick={() => setReopenOpen(true)}
            >
              {t('operations.pos.reopen', 'Reabrir comanda')}
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
        <div className="lg:col-span-1 flex flex-col gap-md">
          <Card data-testid="comanda-client-card">
            <CardHeader className="pb-sm">
              <CardTitle className="text-base flex items-center gap-xs">
                <User className="h-4 w-4 text-primary-500" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-sm">
              <p className="text-sm font-semibold text-neutral-800">{comanda.client.fullName}</p>
              {comanda.client.phone && (
                <div className="flex items-center gap-xs text-sm text-neutral-600">
                  <Phone className="h-3 w-3" />
                  <span>{formatPhoneBr(comanda.client.phone)}</span>
                </div>
              )}
              <div className="flex items-center gap-xs text-sm text-neutral-600">
                <Clock className="h-3 w-3" />
                <span>
                  Aberta às{' '}
                  {new Date(comanda.openedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="text-sm text-neutral-600" data-testid="comanda-client-credit">
                Crédito do cliente: {brl(comanda.clientCreditBalance)}
              </div>
              <Badge
                variant="outline"
                data-testid="comanda-status"
                className="bg-success-50 text-success-700 border-success-200 text-xs"
              >
                {COMANDA_STATUS_LABELS[comanda.status] ?? comanda.status}
              </Badge>
            </CardContent>
          </Card>

          {isOpen && canWrite && (
            <Card>
              <CardHeader className="pb-sm">
                <CardTitle className="text-base">Adicionar à comanda</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-sm">
                <Button
                  variant="outline"
                  className="justify-start gap-sm"
                  data-testid="comanda-add-service"
                  onClick={() => setAddMode('service')}
                >
                  <Scissors className="h-4 w-4 text-primary-500" />
                  {t('operations.pos.addService', 'Adicionar serviço')}
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-sm"
                  data-testid="comanda-add-product"
                  onClick={() => setAddMode('product')}
                >
                  <ShoppingBag className="h-4 w-4 text-primary-500" />
                  {t('operations.pos.addProduct', 'Adicionar produto')}
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-sm"
                  data-testid="comanda-add-package"
                  onClick={() => setAddMode('package')}
                >
                  <Package className="h-4 w-4 text-primary-500" />
                  {t('operations.pos.addPackage', 'Adicionar pacote')}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1 flex flex-col gap-md">
          <Card className="flex-1">
            <CardHeader className="pb-sm">
              <CardTitle className="text-base flex items-center gap-xs">
                <Receipt className="h-4 w-4 text-primary-500" />
                Itens da comanda
              </CardTitle>
            </CardHeader>
            <CardContent>
              {comanda.items.length === 0 ? (
                <p className="text-sm text-neutral-600">Nenhum item lançado.</p>
              ) : (
                <ul className="space-y-sm">
                  {comanda.items.map((item) => (
                    <li
                      key={item.id}
                      data-testid={`comanda-item-${item.id}`}
                      className="flex items-center justify-between gap-sm rounded-md border border-neutral-100 bg-neutral-50 p-sm"
                    >
                      <div className="flex items-start gap-sm">
                        <div
                          className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${item.kind === 'product' ? 'bg-success-50' : 'bg-primary-50'}`}
                        >
                          {item.kind === 'product' ? (
                            <ShoppingBag className="h-4 w-4 text-success-600" />
                          ) : (
                            <Scissors className="h-4 w-4 text-primary-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-neutral-800">{item.name}</p>
                          <p className="text-xs text-neutral-600">{item.professional.displayName}</p>
                          {item.contractCode && (
                            <span
                              data-testid={`item-contract-${item.id}`}
                              className="inline-block rounded bg-primary-50 px-xs text-xs font-semibold text-primary-700"
                            >
                              Contrato {item.contractCode}
                            </span>
                          )}
                          <p className="text-xs text-neutral-600">
                            {item.quantity}x{' '}
                            {item.listUnitPrice !== item.unitPrice && (
                              <span className="line-through mr-xs">{brl(item.listUnitPrice)}</span>
                            )}
                            {brl(item.unitPrice)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-sm">
                        <span className="text-sm font-semibold text-neutral-800">
                          {brl(item.total)}
                        </span>
                        {isOpen && canWrite && (
                          <button
                            type="button"
                            className="text-neutral-500 hover:text-error-600 disabled:opacity-50"
                            aria-label={`Remover ${item.name}`}
                            disabled={busy}
                            onClick={() => void handleRemoveItem(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Separator className="my-md" />
              <div className="flex justify-between text-base font-semibold text-neutral-800">
                <span>Total</span>
                <span>{brl(comanda.total)}</span>
              </div>
              {Number(comanda.covered) > 0 && (
                <div
                  data-testid="comanda-covered"
                  className="mt-xs flex justify-between text-sm text-primary-700"
                >
                  <span>
                    Coberto pelo contrato{' '}
                    {[...new Set(comanda.items.map((i) => i.contractCode).filter(Boolean))].join(', ')}
                  </span>
                  <span>- {brl(comanda.covered)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <PaymentPanel
            comanda={comanda}
            canWrite={canWrite}
            canClose={canClose}
            busy={busy}
            onAddPayment={handleAddPayment}
            onRemovePayment={handleRemovePayment}
            onClose={handleClose}
          />
        </div>
      </div>

      {comanda.status === 'closed' && (
        <Card data-testid="comanda-commissions">
          <CardHeader className="pb-sm">
            <CardTitle className="text-base">
              {t('operations.pos.commissionsGenerated', 'Comissões geradas')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-sm">
            {comanda.hasCommissionWarnings && (
              <Alert data-testid="comanda-commission-warning">
                <AlertTriangle className="h-4 w-4" />
                <div className="text-sm">
                  {t(
                    'operations.pos.noRuleWarning',
                    'Alguns itens não têm regra de comissão e foram registrados com R$ 0,00.',
                  )}{' '}
                  {canReviewRules && (
                    <Link to="/catalogo/comissoes" className="font-semibold text-primary-700 underline">
                      Revisar regras
                    </Link>
                  )}
                </div>
              </Alert>
            )}
            {accruals.length === 0 ? (
              <p className="text-sm text-neutral-600">Nenhuma comissão registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-neutral-600">
                      <th className="py-xs">Profissional</th>
                      <th>Item</th>
                      <th className="text-right">Base</th>
                      <th className="text-right">Cobrado</th>
                      <th className="text-right">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accruals.map((c) => (
                      <tr key={c.id} className="border-t border-neutral-100">
                        <td className="py-xs">{c.memberName}</td>
                        <td>{c.itemName}</td>
                        <td className="text-right">{brl(c.baseAmount)}</td>
                        <td className="text-right">{brl(c.chargedAmount)}</td>
                        <td className="text-right">
                          {brl(c.calculatedAmount)}
                          {c.noRule && (
                            <Badge variant="outline" className="ml-xs text-xs">
                              Sem regra
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {addMode && (
        <AddItemDialog
          mode={addMode}
          comanda={comanda}
          open
          onOpenChange={(o) => !o && setAddMode(null)}
          onDone={() => setAddMode(null)}
        />
      )}
      <ReopenComandaDialog
        comandaId={comanda.id}
        open={reopenOpen}
        onOpenChange={setReopenOpen}
      />
    </div>
  );
}
