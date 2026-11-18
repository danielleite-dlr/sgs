import { useState } from 'react';
import { useMutation } from '@apollo/client';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  LoseCommercialDealMutation,
  type CommercialDeal,
  type CommercialDealPayload,
} from '../api/deals.api';
import { LOST_REASON_OPTIONS, firstError } from '../lib/commercial-labels';

const MAX_TEXT = 500;

interface Props {
  deal: CommercialDeal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

function LoseForm({ deal, onClose, onDone }: { deal: CommercialDeal; onClose: () => void; onDone?: () => void }) {
  const [reason, setReason] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [lose, { loading }] = useMutation<{ loseCommercialDeal: CommercialDealPayload }>(
    LoseCommercialDealMutation,
  );

  async function submit() {
    setError('');
    if (!reason) return setError('Escolha o motivo');
    if (reason === 'other' && !text.trim()) return setError('Descreva o motivo');
    if (text.length > MAX_TEXT) return setError(`Use no máximo ${MAX_TEXT} caracteres`);
    try {
      const res = await lose({
        variables: { id: deal.id, reasonCode: reason, reasonText: text.trim() || null },
      });
      const p = res.data?.loseCommercialDeal;
      if (p?.errors.length) return setError(firstError(p.errors, 'Não foi possível marcar como perdido.'));
      toast.success('Negócio marcado como perdido.');
      onDone?.();
      onClose();
    } catch {
      setError('Não foi possível marcar como perdido. Tente novamente.');
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>Marcar como perdido</DialogTitle>
        <DialogDescription>{deal.lead.fullName}: qual foi o motivo?</DialogDescription>
      </DialogHeader>
      <div className="my-md space-y-sm">
        <fieldset className="space-y-xs">
          <legend className="text-xs font-semibold text-neutral-700">Motivo</legend>
          {LOST_REASON_OPTIONS.map((o) => (
            <label key={o.code} className="flex min-h-[44px] items-center gap-sm text-sm">
              <input
                type="radio"
                name="lost-reason"
                value={o.code}
                checked={reason === o.code}
                onChange={() => setReason(o.code)}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
        <div>
          <Label htmlFor="lose-text" className="text-xs font-semibold text-neutral-700">
            Detalhes {reason === 'other' ? '(obrigatório)' : '(opcional)'}
          </Label>
          <Textarea
            id="lose-text"
            className="mt-xs"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-right text-xs text-neutral-600">
            {text.length}/{MAX_TEXT}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-error-600">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading || text.length > MAX_TEXT}>
          {loading ? 'Salvando…' : 'Marcar como perdido'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function LoseDealDialog({ deal, open, onOpenChange, onDone }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {open && deal && (
          <LoseForm deal={deal} onClose={() => onOpenChange(false)} onDone={onDone} />
        )}
      </DialogContent>
    </Dialog>
  );
}
