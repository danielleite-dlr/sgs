import { useState } from 'react';
import { useMutation } from '@apollo/client';
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
import {
  ReverseContractPaymentMutation,
  type ReverseContractPaymentResult,
} from '../api/contracts.api';
import { contractErrorMessage } from '../lib/contract-labels';

const MIN_REASON = 3;

export interface ReverseContractPaymentDialogProps {
  paymentId: string | null;
  onOpenChange: (open: boolean) => void;
}

function ReverseForm({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [reverse, { loading }] = useMutation<ReverseContractPaymentResult>(
    ReverseContractPaymentMutation,
  );
  const valid = reason.trim().length >= MIN_REASON;

  async function submit() {
    if (!valid) return;
    setError('');
    try {
      const res = await reverse({ variables: { input: { paymentId, reason: reason.trim() } } });
      const errors = res.data?.reverseContractPayment.errors ?? [];
      if (errors.length > 0) {
        setError(contractErrorMessage(errors[0]));
        return;
      }
      toast.success('Pagamento estornado.');
      onClose();
    } catch {
      setError('Não foi possível estornar o pagamento. Tente novamente.');
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Estornar pagamento</DialogTitle>
        <DialogDescription>
          O estorno gera um lançamento negativo no caixa e devolve o valor ao saldo do contrato.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-xs">
        <Label htmlFor="reverse-reason" className="text-xs font-semibold text-neutral-700">
          Motivo do estorno
        </Label>
        <Textarea
          id="reverse-reason"
          maxLength={400}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex.: valor lançado errado"
        />
        {error && (
          <p role="alert" data-testid="reverse-error" className="text-sm text-error-600">
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
          data-testid="reverse-submit"
          onClick={() => void submit()}
        >
          {loading ? 'Estornando…' : 'Estornar'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ReverseContractPaymentDialog({
  paymentId,
  onOpenChange,
}: ReverseContractPaymentDialogProps) {
  return (
    <Dialog open={paymentId != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {paymentId && <ReverseForm paymentId={paymentId} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
