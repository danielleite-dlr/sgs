import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import { PAYMENT_METHODS } from '@/features/operations/lib/operations-labels';
import {
  CancelContractMutation,
  ContractCancellationPreviewQuery,
  type CancelContractResult,
  type ContractCancellationPreviewResult,
  type ContractData,
} from '../api/contracts.api';
import { PARTY_LABEL, contractErrorMessage } from '../lib/contract-labels';

const MIN_REASON = 3;
const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

function CancelForm({ contract, onClose }: { contract: ContractData; onClose: () => void }) {
  const [party, setParty] = useState('');
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('');
  const [error, setError] = useState('');

  const preview = useQuery<ContractCancellationPreviewResult>(ContractCancellationPreviewQuery, {
    variables: { contractId: contract.id, party },
    skip: !party,
    fetchPolicy: 'network-only',
  });
  const [cancel, { loading }] = useMutation<CancelContractResult>(CancelContractMutation);

  const p = party ? preview.data?.contractCancellationPreview : undefined;
  const needsRefundMethod = !!p && Number(p.refund) > 0;
  const valid =
    !!p && reason.trim().length >= MIN_REASON && (!needsRefundMethod || refundMethod !== '');

  async function submit() {
    if (!valid) return;
    setError('');
    try {
      const res = await cancel({
        variables: {
          input: {
            contractId: contract.id,
            party,
            reason: reason.trim(),
            refundMethod: needsRefundMethod ? refundMethod : undefined,
          },
        },
      });
      const errors = res.data?.cancelContract.errors ?? [];
      if (errors.length > 0) {
        setError(contractErrorMessage(errors[0]));
        return;
      }
      toast.success('Contrato cancelado.');
      onClose();
    } catch {
      setError('Não foi possível cancelar o contrato. Tente novamente.');
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Cancelar contrato {contract.code}</DialogTitle>
        <DialogDescription>
          Os agendamentos vinculados ao contrato serão cancelados.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-sm">
        <fieldset className="space-y-xs">
          <legend className="text-xs font-semibold text-neutral-700">Quem cancela</legend>
          {Object.entries(PARTY_LABEL).map(([value, label]) => (
            <label key={value} className="flex items-center gap-xs text-sm">
              <input
                type="radio"
                name="cancel-party"
                value={value}
                checked={party === value}
                onChange={() => setParty(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>

        {party && preview.loading && <p className="text-sm text-neutral-600">Calculando acerto…</p>}
        {p && (
          <p
            data-testid="cancel-preview"
            className="rounded-md bg-neutral-50 p-sm text-sm font-semibold text-neutral-800"
          >
            Pago {brl(p.paid)} · Retido {brl(p.retained)} · Devolver {brl(p.refund)}
          </p>
        )}
        {party && preview.error && (
          <p role="alert" className="text-sm text-error-600">
            Não foi possível calcular o acerto.
          </p>
        )}

        {needsRefundMethod && (
          <div>
            <Label htmlFor="cancel-refund-method" className="text-xs font-semibold text-neutral-700">
              Método da devolução
            </Label>
            <select
              id="cancel-refund-method"
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value)}
              className="mt-xs w-full rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm"
            >
              <option value="">Selecione…</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <Label htmlFor="cancel-reason" className="text-xs font-semibold text-neutral-700">
            Motivo do cancelamento
          </Label>
          <Textarea
            id="cancel-reason"
            className="mt-xs"
            maxLength={400}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" data-testid="cancel-error" className="text-sm text-error-600">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Voltar
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={!valid || loading}
          data-testid="cancel-submit"
          onClick={() => void submit()}
        >
          {loading ? 'Cancelando…' : 'Cancelar contrato'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function CancelContractDialog({
  contract,
  open,
  onOpenChange,
}: {
  contract: ContractData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {open && <CancelForm contract={contract} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
