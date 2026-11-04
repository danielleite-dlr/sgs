import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  formatCurrencyDisplay,
  maskCurrency,
  unmaskCurrency,
} from '@/features/catalog/utils/currency-mask';
import { centsToDecimal, decimalToCents } from '@/features/operations/lib/money';
import { PAYMENT_METHODS } from '@/features/operations/lib/operations-labels';
import {
  RecordContractPaymentMutation,
  type ContractData,
  type RecordContractPaymentResult,
} from '../api/contracts.api';
import { contractErrorMessage } from '../lib/contract-labels';

const MAX_LINES = 5;
const brl = (cents: number) => `R$ ${formatCurrencyDisplay(centsToDecimal(cents))}`;

interface Line {
  method: string;
  amount: string; // mascarado
}

function toCents(masked: string): number {
  const un = unmaskCurrency(masked);
  if (!un) return 0;
  try {
    return decimalToCents(un);
  } catch {
    return 0;
  }
}

export interface ContractPaymentDialogProps {
  contract: ContractData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PaymentForm({ contract, onClose }: { contract: ContractData; onClose: () => void }) {
  const depositPending = decimalToCents(contract.depositPending);
  const balance = decimalToCents(contract.balance);
  const suggested = depositPending > 0 ? depositPending : balance;
  const [lines, setLines] = useState<Line[]>([
    { method: 'pix', amount: suggested > 0 ? formatCurrencyDisplay(centsToDecimal(suggested)) : '' },
  ]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [record, { loading }] = useMutation<RecordContractPaymentResult>(
    RecordContractPaymentMutation,
  );

  const total = lines.reduce((acc, l) => acc + toCents(l.amount), 0);
  const after = balance - total;
  const valid = total > 0 && lines.every((l) => toCents(l.amount) > 0);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    if (!valid) return;
    setError('');
    try {
      const res = await record({
        variables: {
          input: {
            contractId: contract.id,
            lines: lines.map((l) => ({ method: l.method, amount: unmaskCurrency(l.amount) })),
            note: note.trim() || undefined,
          },
        },
      });
      const errors = res.data?.recordContractPayment.errors ?? [];
      if (errors.length > 0) {
        setError(contractErrorMessage(errors[0]));
        return;
      }
      toast.success('Pagamento registrado.');
      onClose();
    } catch {
      setError('Não foi possível registrar o pagamento. Tente novamente.');
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Registrar pagamento</DialogTitle>
        <DialogDescription>
          Contrato {contract.code} · saldo atual {brl(balance)}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-sm">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-sm">
            <div>
              <Label htmlFor={`cp-method-${i}`} className="text-xs font-semibold text-neutral-700">
                Forma {i + 1}
              </Label>
              <select
                id={`cp-method-${i}`}
                value={l.method}
                onChange={(e) => setLine(i, { method: e.target.value })}
                className="mt-xs w-full rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={`cp-amount-${i}`} className="text-xs font-semibold text-neutral-700">
                Valor {i + 1}
              </Label>
              <Input
                id={`cp-amount-${i}`}
                className="mt-xs"
                inputMode="numeric"
                placeholder="0,00"
                value={l.amount}
                onChange={(e) => setLine(i, { amount: maskCurrency(e.target.value) })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={lines.length === 1}
              aria-label={`Remover linha ${i + 1}`}
              onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {lines.length < MAX_LINES && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((ls) => [...ls, { method: 'pix', amount: '' }])}
          >
            Adicionar forma de pagamento
          </Button>
        )}
        <div>
          <Label htmlFor="cp-note" className="text-xs font-semibold text-neutral-700">
            Observação
          </Label>
          <Textarea
            id="cp-note"
            className="mt-xs"
            maxLength={400}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <p className="text-sm text-neutral-700" data-testid="cp-balance-after">
          Saldo após o pagamento: {brl(Math.max(0, after))}
        </p>
        {error && (
          <p role="alert" data-testid="cp-error" className="text-sm text-error-600">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={!valid || loading}
          data-testid="cp-submit"
          onClick={() => void submit()}
        >
          {loading ? 'Registrando…' : 'Registrar pagamento'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ContractPaymentDialog({ contract, open, onOpenChange }: ContractPaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {open && <PaymentForm contract={contract} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
