import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { CancelBridalGroupMutation, type BridalGroupPayload } from '../api/bridal.api';
import { errorMessage } from '../lib/bridal-labels';

const MIN_REASON = 3;

interface Props {
  groupId: string;
  groupName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}

export function CancelBridalGroupDialog({
  groupId,
  groupName,
  open,
  onOpenChange,
  onCancelled,
}: Props) {
  const [reason, setReason] = useState('');
  const [contractFirst, setContractFirst] = useState(false);
  const [error, setError] = useState('');
  const [cancel, { loading }] = useMutation<{ cancelBridalGroup: BridalGroupPayload }>(
    CancelBridalGroupMutation,
  );
  const valid = reason.trim().length >= MIN_REASON;

  async function submit() {
    if (!valid) return;
    setError('');
    setContractFirst(false);
    try {
      const res = await cancel({ variables: { input: { id: groupId, reason: reason.trim() } } });
      const errs = res.data?.cancelBridalGroup.errors ?? [];
      if (errs.length > 0) {
        if (errs.some((e) => e.code === 'CANCEL_CONTRACT_FIRST')) setContractFirst(true);
        else setError(errorMessage(errs[0]));
        return;
      }
      toast.success('Grupo cancelado.');
      onOpenChange(false);
      onCancelled();
    } catch {
      setError('Não foi possível cancelar o grupo. Tente novamente.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogTitle className="text-base font-bold text-neutral-800">Cancelar grupo</DialogTitle>
        <DialogDescription className="text-sm text-neutral-600">
          {groupName} — os agendamentos e deslocamentos do evento serão cancelados.
        </DialogDescription>
        <div>
          <Label className="text-xs font-semibold text-neutral-700" htmlFor="cancel-group-reason">
            Motivo
          </Label>
          <Textarea
            id="cancel-group-reason"
            data-testid="cancel-group-reason"
            className="mt-xs"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div aria-live="polite" role="alert" className="text-sm text-error">
          {contractFirst && (
            <p data-testid="cancel-contract-first">
              Cancele o contrato antes (em{' '}
              <Link to="/contratos" className="underline">
                Contratos
              </Link>
              ).
            </p>
          )}
          {error && <p>{error}</p>}
        </div>
        <div className="flex justify-end gap-sm">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!valid || loading}
            onClick={submit}
            data-testid="cancel-group-submit"
          >
            Cancelar grupo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
