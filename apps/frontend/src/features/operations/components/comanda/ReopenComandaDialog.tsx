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
import { ReopenComandaMutation, type ReopenComandaResult } from '../../api/comandas.api';

const MIN_REASON = 3;
const MAX_REASON = 400;

interface Props {
  comandaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ReopenForm({ comandaId, onClose }: { comandaId: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [reopen, { loading }] = useMutation<ReopenComandaResult>(ReopenComandaMutation);
  const valid = reason.trim().length >= MIN_REASON;

  async function submit() {
    if (!valid) return;
    setError('');
    try {
      const res = await reopen({ variables: { input: { id: comandaId, reason: reason.trim() } } });
      const errors = res.data?.reopenComanda.errors ?? [];
      if (errors.length > 0) {
        setError(errors[0].message);
        return;
      }
      toast.success('Comanda reaberta.');
      onClose();
    } catch {
      setError('Não foi possível reabrir a comanda. Tente novamente.');
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reabrir comanda</DialogTitle>
        <DialogDescription>
          Estoque, comissões, crédito e caixa desta comanda serão estornados.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-xs">
        <Label htmlFor="reopen-reason" className="text-xs font-semibold text-neutral-700">
          Motivo da reabertura
        </Label>
        <Textarea
          id="reopen-reason"
          data-testid="reopen-reason"
          value={reason}
          maxLength={MAX_REASON}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex.: item lançado errado"
        />
        {error && (
          <p role="alert" data-testid="reopen-error" className="text-sm text-error-600">
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
          variant="destructive"
          disabled={!valid || loading}
          data-testid="reopen-submit"
          onClick={() => void submit()}
        >
          Reabrir
        </Button>
      </DialogFooter>
    </>
  );
}

export function ReopenComandaDialog({ comandaId, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <ReopenForm comandaId={comandaId} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
