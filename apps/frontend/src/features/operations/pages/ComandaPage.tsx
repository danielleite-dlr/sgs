import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  User,
  Phone,
  Clock,
  ShoppingBag,
  Scissors,
  Receipt,
  X,
  Package,
  AlertTriangle,
  Percent,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { toDisplayName } from '@/lib/format-name';
import { ReopenComandaDialog } from '../components/comanda/ReopenComandaDialog';
import { COMANDA_STATUS_LABELS } from '../lib/operations-labels';

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

// Selo de status com ponto na cor (D-11).
const STATUS_BADGE: Record<string, 'info' | 'success' | 'error' | 'neutral'> = {
  open: 'info',
  closed: 'success',
  cancelled: 'error',
};

// Títulos dos cartões em serifa (D-07); ícone lucide neutro (D-18).
const CARD_TITLE_CLASS = 'flex items-center gap-xs font-serif text-headline-sm text-neutral-800';
const CARD_ICON_CLASS = 'h-4 w-4 shrink-0 text-neutral-500';

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
            <p className="text-body text-neutral-800">
              {t('operations.pos.notFound', 'Comanda não encontrada.')}
            </p>
            <Link to="/comanda" className="text-body font-semibold text-primary-700 underline">
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
          <>
            <Badge
              variant={STATUS_BADGE[comanda.status] ?? 'neutral'}
              data-testid="comanda-status"
            >
              {COMANDA_STATUS_LABELS[comanda.status] ?? comanda.status}
            </Badge>
            {!isOpen && canReopen && comanda.status === 'closed' && (
              <Button
                type="button"
                variant="outline"
                data-testid="comanda-reopen"
                onClick={() => setReopenOpen(true)}
              >
                {t('operations.pos.reopen', 'Reabrir comanda')}
              </Button>
            )}
          </>
        }
      />

      {/* Ordem no DOM (celular): Cliente, Itens, Adicionar, Pagamento. No computador o
          grid mantém Adicionar na 1ª coluna, abaixo do Cliente (UX-09). */}
      <div className="grid grid-cols-1 gap-md lg:grid-cols-3 lg:grid-rows-[auto_1fr]">
        <div data-testid="comanda-cliente" className="lg:col-start-1 lg:row-start-1 lg:self-start">
          <Card data-testid="comanda-client-card" className="max-w-none">
            <CardHeader className="pb-sm">
              <CardTitle className={CARD_TITLE_CLASS}>
                <User className={CARD_ICON_CLASS} aria-hidden="true" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-xs">
              <p className="break-words font-serif text-[17px] font-semibold leading-6 text-neutral-800">
                {toDisplayName(comanda.client.fullName)}
              </p>
              {comanda.client.phone && (
                <div className="flex items-center gap-xs text-body tabular-nums text-neutral-500">
                  <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{formatPhoneBr(comanda.client.phone)}</span>
                </div>
              )}
              <div className="flex items-center gap-xs text-body tabular-nums text-neutral-500">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Aberta às{' '}
                  {new Date(comanda.openedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div
                className="text-body tabular-nums text-neutral-500"
                data-testid="comanda-client-credit"
              >
                Crédito do cliente: {brl(comanda.clientCreditBalance)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div
          data-testid="comanda-itens"
          className="flex flex-col gap-md lg:col-start-2 lg:row-start-1 lg:row-span-2"
        >
          <Card className="max-w-none flex-1">
            <CardHeader className="flex-row items-center justify-between gap-sm space-y-0 pb-sm">
              <CardTitle className={CARD_TITLE_CLASS}>
                <Receipt className={CARD_ICON_CLASS} aria-hidden="true" />
                Itens da comanda
              </CardTitle>
              {comanda.items.length > 0 && (
                <span className="shrink-0 text-[12px] font-semibold leading-4 tabular-nums text-neutral-500">
                  {comanda.items.length === 1 ? '1 item' : `${comanda.items.length} itens`}
                </span>
              )}
            </CardHeader>
            <CardContent>
              {comanda.items.length === 0 ? (
                <p className="py-sm text-body text-neutral-500">Nenhum item lançado.</p>
              ) : (
                <ul>
                  {comanda.items.map((item) => (
                    <li
                      key={item.id}
                      data-testid={`comanda-item-${item.id}`}
                      className="flex items-start gap-sm border-b border-neutral-200 py-sm last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          data-testid={`comanda-item-name-${item.id}`}
                          className="min-w-0 break-words text-body font-medium text-neutral-800"
                        >
                          {item.name}
                        </p>
                        <p className="text-[12px] leading-4 tabular-nums text-neutral-500">
                          {item.kind === 'product'
                            ? `Produto · ${item.professional.displayName}`
                            : item.professional.displayName}
                          {' · '}
                          <span className="whitespace-nowrap">
                            {item.quantity}x{' '}
                            {item.listUnitPrice !== item.unitPrice && (
                              <span className="mr-xs line-through">{brl(item.listUnitPrice)}</span>
                            )}
                            {brl(item.unitPrice)}
                          </span>
                        </p>
                        {item.contractCode && (
                          <Badge
                            variant="outline"
                            data-testid={`item-contract-${item.id}`}
                            className="mt-xs"
                          >
                            Contrato {item.contractCode}
                          </Badge>
                        )}
                        {item.includedInEvent && (
                          <Badge
                            variant="outline"
                            data-testid={`item-trial-included-${item.id}`}
                            className="ml-xs mt-xs"
                          >
                            Teste incluso no pacote — pago no evento
                          </Badge>
                        )}
                      </div>
                      <div
                        data-testid={`comanda-item-valores-${item.id}`}
                        className="flex shrink-0 items-center gap-xs whitespace-nowrap text-body font-semibold tabular-nums text-neutral-800"
                      >
                        <span>{brl(item.total)}</span>
                        {isOpen && canWrite && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="-my-sm -mr-sm hover:text-error-600"
                            aria-label={`Remover ${item.name}`}
                            disabled={busy}
                            onClick={() => void handleRemoveItem(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-sm flex items-baseline justify-between gap-sm border-t border-neutral-200 pt-sm">
                <span className="font-serif text-headline-sm text-neutral-800">Total</span>
                <span className="whitespace-nowrap text-headline-sm tabular-nums text-neutral-800">
                  {brl(comanda.total)}
                </span>
              </div>
              {Number(comanda.covered) > 0 && (
                <div
                  data-testid="comanda-covered"
                  className="mt-xs flex justify-between gap-sm text-body text-neutral-500"
                >
                  <span>
                    Coberto pelo contrato{' '}
                    {[...new Set(comanda.items.map((i) => i.contractCode).filter(Boolean))].join(', ')}
                  </span>
                  <span className="whitespace-nowrap tabular-nums">- {brl(comanda.covered)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {isOpen && canWrite && (
          <div
            data-testid="comanda-adicionar"
            className="lg:col-start-1 lg:row-start-2 lg:self-start"
          >
            <Card className="max-w-none">
              <CardHeader className="pb-sm">
                <CardTitle className={CARD_TITLE_CLASS}>Adicionar à comanda</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-sm">
                <Button
                  variant="outline"
                  className="min-h-[44px] justify-start gap-sm"
                  data-testid="comanda-add-service"
                  onClick={() => setAddMode('service')}
                >
                  <Scissors className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                  {t('operations.pos.addService', 'Adicionar serviço')}
                </Button>
                <Button
                  variant="outline"
                  className="min-h-[44px] justify-start gap-sm"
                  data-testid="comanda-add-product"
                  onClick={() => setAddMode('product')}
                >
                  <ShoppingBag className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                  {t('operations.pos.addProduct', 'Adicionar produto')}
                </Button>
                <Button
                  variant="outline"
                  className="min-h-[44px] justify-start gap-sm"
                  data-testid="comanda-add-package"
                  onClick={() => setAddMode('package')}
                >
                  <Package className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                  {t('operations.pos.addPackage', 'Adicionar pacote')}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="lg:col-start-3 lg:row-start-1 lg:row-span-2">
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
        <Card data-testid="comanda-commissions" className="max-w-none">
          <CardHeader className="pb-sm">
            <CardTitle className={CARD_TITLE_CLASS}>
              <Percent className={CARD_ICON_CLASS} aria-hidden="true" />
              {t('operations.pos.commissionsGenerated', 'Comissões geradas')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-sm">
            {comanda.hasCommissionWarnings && (
              <Alert variant="warning" data-testid="comanda-commission-warning">
                <AlertTriangle className="h-4 w-4" />
                <div className="text-body">
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
              <p className="text-body text-neutral-500">Nenhuma comissão registrada.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-neutral-200">
                <table className="w-full text-body text-neutral-800">
                  <thead>
                    <tr className="bg-neutral-100 text-left text-overline uppercase text-neutral-500">
                      <th className="px-sm py-sm">Profissional</th>
                      <th className="px-sm py-sm">Item</th>
                      <th className="px-sm py-sm text-right">Base</th>
                      <th className="px-sm py-sm text-right">Cobrado</th>
                      <th className="px-sm py-sm text-right">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accruals.map((c) => (
                      <tr key={c.id} className="border-t border-neutral-200">
                        <td className="px-sm py-sm">{c.memberName}</td>
                        <td className="px-sm py-sm">{c.itemName}</td>
                        <td className="whitespace-nowrap px-sm py-sm text-right tabular-nums">
                          {brl(c.baseAmount)}
                        </td>
                        <td className="whitespace-nowrap px-sm py-sm text-right tabular-nums">
                          {brl(c.chargedAmount)}
                        </td>
                        <td className="whitespace-nowrap px-sm py-sm text-right tabular-nums">
                          {brl(c.calculatedAmount)}
                          {c.noRule && (
                            <Badge variant="outline" className="ml-xs">
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
