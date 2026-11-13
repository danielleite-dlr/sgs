import { useState } from 'react';
import { CircleCheck, Trash2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  formatCurrencyDisplay,
  maskCurrency,
  unmaskCurrency,
} from '@/features/catalog/utils/currency-mask';
import { FIELD_LABEL_CLASS, NATIVE_SELECT_CLASS } from '@/lib/field-classes';
import { centsToDecimal, computePaymentSummary, decimalToCents } from '../../lib/money';
import {
  ALL_PAYMENT_METHODS,
  CLIENT_CREDIT_METHOD,
  PAYMENT_METHODS,
  paymentMethodLabel,
} from '../../lib/operations-labels';
import type { ComandaData } from '../../api/comandas.api';

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

// Linha do resumo (Total, Pago, Falta, Troco): divisor fino e valor tabular (D-07).
const SUMMARY_ROW_CLASS =
  'flex items-baseline justify-between gap-sm border-b border-neutral-200 py-sm last:border-b-0';
const SUMMARY_DT_CLASS = 'text-overline uppercase text-neutral-500';
const SUMMARY_DD_CLASS = 'whitespace-nowrap font-semibold tabular-nums';

const CHANGE_ERROR_TEXT = 'O troco só pode sair de pagamento em dinheiro.';

export interface PaymentPanelProps {
  comanda: ComandaData;
  canWrite: boolean;
  canClose: boolean;
  busy: boolean;
  onAddPayment: (p: { method: string; amount: string }) => Promise<void>;
  onRemovePayment: (id: string) => Promise<void>;
  onClose: () => Promise<void>;
}

/** Valor digitado ("50,00") -> decimal do backend ("50.00") ou null quando vazio/zero/inválido. */
function parseTyped(masked: string): string | null {
  const un = unmaskCurrency(masked);
  if (!un || !/^\d+\.\d{2}$/.test(un)) return null;
  return decimalToCents(un) > 0 ? un : null;
}

export function PaymentPanel({
  comanda,
  canWrite,
  canClose,
  busy,
  onAddPayment,
  onRemovePayment,
  onClose,
}: PaymentPanelProps) {
  const isOpen = comanda.status === 'open';
  const [method, setMethod] = useState<string>('cash');
  const [typed, setTyped] = useState('');
  const [dirty, setDirty] = useState(false);

  const lines = comanda.payments.map((p) => ({ method: p.method, amount: p.amount }));
  const base = computePaymentSummary(comanda.owed, lines);

  const remainingMasked = maskCurrency(base.remaining.replace('.', ''));
  const shownAmount = dirty ? typed : base.remaining === '0.00' ? '' : remainingMasked;
  const pending = isOpen && canWrite ? parseTyped(shownAmount) : null;
  // Preview em tempo real só quando a pessoa digitou algo (senão "Falta" ficaria sempre zerada).
  const previewLines = dirty && pending ? [...lines, { method, amount: pending }] : lines;
  const summary = computePaymentSummary(comanda.owed, previewLines);

  const changeError =
    summary.error === 'INVALID_CHANGE' || comanda.closeError === 'INVALID_CHANGE';

  const hasCreditLine = comanda.payments.some((p) => p.method === CLIENT_CREDIT_METHOD.value);
  const creditCents = decimalToCents(comanda.clientCreditBalance);
  // O saldo só é baixado no fechamento: o que já foi lançado nesta comanda ainda conta nele.
  const creditAppliedCents = comanda.payments
    .filter((p) => p.method === CLIENT_CREDIT_METHOD.value)
    .reduce((acc, p) => acc + decimalToCents(p.amount), 0);
  const remainingCents = decimalToCents(base.remaining);
  const creditSuggestion = Math.min(creditCents, remainingCents);
  const remainingAfterCredit = centsToDecimal(remainingCents - creditSuggestion);
  const showCreditCallout = isOpen && (creditCents > 0 || hasCreditLine);
  const showCreditShortcut =
    isOpen && canWrite && creditCents > 0 && remainingCents > 0 && !hasCreditLine;

  const methods = creditCents > 0 || hasCreditLine ? ALL_PAYMENT_METHODS : PAYMENT_METHODS;

  const coveredCents = decimalToCents(comanda.covered);
  const owedCents = decimalToCents(comanda.owed);
  const coveredCodes = [
    ...new Set(comanda.items.map((i) => i.contractCode).filter((c): c is string => !!c)),
  ].join(', ');

  // Comanda vazia não fecha (o backend recusa com EMPTY_COMANDA). Total > 0 implica itens.
  const hasItems = comanda.items.length > 0 || decimalToCents(comanda.total) > 0;
  const readyToClose = hasItems && comanda.canClose && base.canClose;
  const closeEnabled = readyToClose && !busy;
  // Motivo visível quando o botão está realmente bloqueado (UX-06). O erro de
  // troco já tem o próprio aviso acima.
  const closeBlockedReason = readyToClose
    ? null
    : !hasItems
      ? 'Adicione ao menos um item para fechar'
      : Number(base.remaining) > 0
        ? `Falta ${brl(base.remaining)} para fechar`
        : null;

  async function add() {
    if (!pending) return;
    await onAddPayment({ method, amount: pending });
    setTyped('');
    setDirty(false);
  }

  async function applyCredit() {
    await onAddPayment({
      method: CLIENT_CREDIT_METHOD.value,
      amount: centsToDecimal(creditSuggestion),
    });
  }

  return (
    <Card data-testid="payment-panel" className="max-w-none">
      <CardHeader className="pb-sm">
        <CardTitle className="flex items-center gap-xs font-serif text-headline-sm text-neutral-800">
          <Wallet className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
          Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-md">
        {comanda.payments.length > 0 && (
          <ul aria-label="Pagamentos lançados">
            {comanda.payments.map((p) => (
              <li
                key={p.id}
                data-testid={`payment-row-${p.id}`}
                className="flex items-center justify-between gap-sm border-b border-neutral-200 py-xs last:border-b-0"
              >
                <span className="min-w-0 break-words text-body text-neutral-800">
                  {paymentMethodLabel(p.method)}
                </span>
                <span className="flex shrink-0 items-center gap-xs">
                  <span className="whitespace-nowrap text-body font-semibold tabular-nums text-neutral-800">
                    {brl(p.amount)}
                  </span>
                  {isOpen && canWrite && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 hover:text-error-600"
                      disabled={busy}
                      aria-label={`Remover pagamento ${paymentMethodLabel(p.method)} ${brl(p.amount)}`}
                      onClick={() => void onRemovePayment(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {showCreditCallout && (
          <div
            data-testid="payment-credit-callout"
            className="space-y-xs rounded-md border border-primary-300 bg-primary-50 px-sm py-sm"
          >
            {hasCreditLine ? (
              <>
                <p className="flex items-center gap-xs font-semibold tabular-nums text-primary-900">
                  <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Crédito aplicado: {brl(centsToDecimal(creditAppliedCents))}
                </p>
                <p className="text-[12px] leading-4 text-primary-700">
                  Valor pago antes pela cliente (sinal ou pacote). O saldo é baixado ao fechar a
                  comanda.
                </p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-xs font-semibold tabular-nums text-primary-900">
                  <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Crédito disponível: {brl(comanda.clientCreditBalance)}
                </p>
                <p className="text-[12px] leading-4 text-primary-700">
                  Valor pago antes pela cliente (sinal ou pacote). Use o crédito antes de receber o
                  restante.
                </p>
                {showCreditShortcut && (
                  <p
                    data-testid="payment-after-credit"
                    className="text-body tabular-nums text-primary-900"
                  >
                    Depois do crédito, falta <strong>{brl(remainingAfterCredit)}</strong>
                  </p>
                )}
              </>
            )}
            {showCreditShortcut && (
              <Button
                type="button"
                className="w-full min-h-[44px] tabular-nums"
                disabled={busy}
                data-testid="payment-use-credit"
                onClick={() => void applyCredit()}
              >
                Usar crédito do cliente ({brl(centsToDecimal(creditSuggestion))})
              </Button>
            )}
          </div>
        )}

        {isOpen && canWrite && (
          <div className="space-y-sm">
            <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div>
                <Label htmlFor="payment-method-select" className={FIELD_LABEL_CLASS}>
                  Forma
                </Label>
                <select
                  id="payment-method-select"
                  data-testid="payment-method-select"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className={`mt-xs ${NATIVE_SELECT_CLASS}`}
                >
                  {methods.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="payment-amount" className={FIELD_LABEL_CLASS}>
                  Valor
                </Label>
                <Input
                  id="payment-amount"
                  data-testid="payment-amount"
                  className="mt-xs tabular-nums"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={shownAmount}
                  onChange={(e) => {
                    setTyped(maskCurrency(e.target.value));
                    setDirty(true);
                  }}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-[44px]"
              disabled={busy || !pending}
              data-testid="payment-add"
              onClick={() => void add()}
            >
              Adicionar
            </Button>
          </div>
        )}

        {coveredCents > 0 && (
          <p
            data-testid="payment-covered"
            className="rounded-md border border-neutral-200 bg-neutral-50 px-sm py-xs text-body text-neutral-800"
          >
            Coberto pelo contrato {coveredCodes}: {brl(comanda.covered)}
          </p>
        )}
        {coveredCents > 0 && owedCents === 0 && (
          <p data-testid="payment-nothing-due" className="text-body font-semibold text-neutral-800">
            Nada a cobrar — coberto pelo contrato
          </p>
        )}

        <dl className="border-t border-neutral-200">
          <div className={SUMMARY_ROW_CLASS}>
            <dt className={SUMMARY_DT_CLASS}>{coveredCents > 0 ? 'A pagar' : 'Total'}</dt>
            <dd data-testid="payment-total" className={`${SUMMARY_DD_CLASS} text-neutral-800`}>
              {brl(summary.total)}
            </dd>
          </div>
          <div className={SUMMARY_ROW_CLASS}>
            <dt className={SUMMARY_DT_CLASS}>Pago</dt>
            <dd data-testid="payment-paid" className={`${SUMMARY_DD_CLASS} text-neutral-800`}>
              {brl(summary.paid)}
            </dd>
          </div>
          <div className={SUMMARY_ROW_CLASS}>
            <dt className={SUMMARY_DT_CLASS}>Falta</dt>
            <dd
              data-testid="payment-remaining"
              className={`${SUMMARY_DD_CLASS} text-neutral-800 ${Number(summary.remaining) > 0 ? 'text-headline-sm' : ''}`}
            >
              {brl(summary.remaining)}
            </dd>
          </div>
          <div className={SUMMARY_ROW_CLASS}>
            <dt className={SUMMARY_DT_CLASS}>Troco</dt>
            <dd
              data-testid="payment-change"
              className={`${SUMMARY_DD_CLASS} ${Number(summary.change) > 0 ? 'text-success-700' : 'text-neutral-800'}`}
            >
              {brl(summary.change)}
            </dd>
          </div>
        </dl>

        {changeError && (
          <p
            role="alert"
            data-testid="payment-error"
            className="text-[12px] font-semibold leading-4 text-error-600"
          >
            {CHANGE_ERROR_TEXT}
          </p>
        )}

        {isOpen && canClose && (
          <div className="space-y-xs">
            <Button
              type="button"
              size="lg"
              // Pronto para fechar: cor cheia mesmo enquanto salva (UX-06).
              className={
                readyToClose ? 'w-full min-h-[44px] disabled:opacity-100' : 'w-full min-h-[44px]'
              }
              disabled={!closeEnabled}
              aria-busy={readyToClose && busy ? true : undefined}
              data-testid="comanda-close"
              onClick={() => void onClose()}
            >
              <CircleCheck className="h-4 w-4" aria-hidden="true" />
              Fechar comanda
            </Button>
            {closeBlockedReason && (
              <p
                className="text-[12px] leading-4 tabular-nums text-neutral-500"
                data-testid="close-blocked-reason"
              >
                {closeBlockedReason}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
