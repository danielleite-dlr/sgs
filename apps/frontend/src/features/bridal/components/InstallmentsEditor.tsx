import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrencyDisplay, maskCurrency } from '@/features/catalog/utils/currency-mask';
import { centsToDecimal } from '@/features/operations/lib/money';

export type PaymentModeValue = 'sinal' | 'sinal_parcelado' | 'a_vista';

export interface InstallmentRow {
  /** 'YYYY-MM-DD' (vazio = não informada). */
  dueDate: string;
  /** Centavos; null = campo vazio. */
  cents: number | null;
}

export const MAX_INSTALLMENTS = 12;

const brl = (cents: number) => `R$ ${formatCurrencyDisplay(centsToDecimal(cents))}`;

/**
 * Confere as parcelas do sinal (mesmas regras do backend: valor > 0, data
 * preenchida, soma == sinal com tolerância de 1 centavo). Tudo em centavos
 * inteiros. Devolve a mensagem de erro ou null.
 */
// eslint-disable-next-line react-refresh/only-export-components -- validação pura, exigida junto do editor
export function installmentsValid(
  mode: PaymentModeValue,
  rows: InstallmentRow[],
  depositCents: number,
  totalCents: number,
): string | null {
  if (rows.length === 0) return 'Informe ao menos uma parcela do sinal.';
  if (mode !== 'sinal_parcelado' && rows.length !== 1) {
    return 'Quantidade de parcelas inválida para a forma de pagamento.';
  }
  if (rows.length > MAX_INSTALLMENTS) {
    return `No máximo ${MAX_INSTALLMENTS} parcelas.`;
  }
  if (rows.some((r) => !r.dueDate)) return 'Informe a data da parcela.';
  if (rows.some((r) => r.cents == null || r.cents <= 0)) {
    return 'Informe o valor da parcela (maior que zero).';
  }
  if (mode === 'a_vista' && depositCents !== totalCents) {
    return 'No pagamento à vista, o valor é o total do contrato.';
  }
  const sum = rows.reduce((acc, r) => acc + (r.cents ?? 0), 0);
  if (Math.abs(sum - depositCents) > 1) {
    return `A soma das parcelas (${brl(sum)}) deve ser igual ao ${
      mode === 'a_vista' ? 'valor à vista' : 'sinal'
    } (${brl(depositCents)}).`;
  }
  return null;
}

export interface InstallmentsEditorProps {
  mode: PaymentModeValue;
  depositCents: number;
  totalCents: number;
  value: InstallmentRow[];
  onChange: (rows: InstallmentRow[]) => void;
}

export function InstallmentsEditor({
  mode,
  depositCents,
  totalCents,
  value,
  onChange,
}: InstallmentsEditorProps) {
  const parcelado = mode === 'sinal_parcelado';
  const error = installmentsValid(mode, value, depositCents, totalCents);
  const sum = value.reduce((acc, r) => acc + (r.cents ?? 0), 0);

  function patch(index: number, p: Partial<InstallmentRow>) {
    onChange(value.map((r, i) => (i === index ? { ...r, ...p } : r)));
  }

  function add() {
    if (value.length >= MAX_INSTALLMENTS) return;
    const remaining = Math.max(0, depositCents - sum);
    onChange([...value, { dueDate: '', cents: remaining > 0 ? remaining : null }]);
  }

  const dateLabel = (n: number) =>
    parcelado ? `Vencimento da parcela ${n}` : mode === 'a_vista' ? 'Data do pagamento' : 'Data do sinal';

  return (
    <div className="space-y-xs" data-testid="installments-editor">
      {value.map((r, idx) => {
        const n = idx + 1;
        return (
          <div
            key={idx}
            className={`grid items-end gap-sm ${parcelado ? 'grid-cols-[1fr_1fr_auto]' : 'grid-cols-1'}`}
          >
            {parcelado && (
            <div>
              <Label htmlFor={`installment-amount-${n}`} className="text-xs font-semibold text-neutral-700">
                Valor da parcela {n}
              </Label>
              <Input
                id={`installment-amount-${n}`}
                className="mt-xs"
                inputMode="numeric"
                value={r.cents == null ? '' : formatCurrencyDisplay(centsToDecimal(r.cents))}
                onChange={(e) => {
                  const masked = maskCurrency(e.target.value);
                  const digits = masked.replace(/\D/g, '');
                  patch(idx, { cents: digits ? Number(digits) : null });
                }}
              />
            </div>
            )}
            <div>
              <Label htmlFor={`installment-date-${n}`} className="text-xs font-semibold text-neutral-700">
                {dateLabel(n)}
              </Label>
              <Input
                id={`installment-date-${n}`}
                className="mt-xs"
                type="date"
                value={r.dueDate}
                onChange={(e) => patch(idx, { dueDate: e.target.value })}
              />
            </div>
            {parcelado && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover parcela ${n}`}
                disabled={value.length <= 1}
                onClick={() => onChange(value.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
      {parcelado && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={value.length >= MAX_INSTALLMENTS}
            onClick={add}
          >
            <Plus className="mr-xs h-4 w-4" aria-hidden="true" />
            Adicionar parcela
          </Button>
          <span className="text-xs text-neutral-600" data-testid="installments-sum">
            Soma {brl(sum)} de {brl(depositCents)}
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-error-600" data-testid="installments-error">
          {error}
        </p>
      )}
    </div>
  );
}
