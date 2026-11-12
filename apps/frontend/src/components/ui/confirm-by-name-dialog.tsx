import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ConfirmByNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  /** Nome que precisa ser digitado para liberar o botão destrutivo. */
  expectedName: string;
  confirmLabel?: string;
  loading?: boolean;
  /** Mensagem de bloqueio/erro exibida dentro do diálogo (role="alert"). */
  error?: string | null;
  onConfirm: () => void;
}

/** Compara sem espaços nas pontas e sem diferenciar maiúsculas; acentos contam. */
function namesMatch(typed: string, expected: string): boolean {
  const a = typed.trim().toLocaleLowerCase('pt-BR');
  return a.length > 0 && a === expected.trim().toLocaleLowerCase('pt-BR');
}

/**
 * Confirmação de ação destrutiva e irreversível: o botão só libera depois de o
 * usuário digitar o nome exato do que será apagado.
 */
export function ConfirmByNameDialog({
  open,
  onOpenChange,
  title,
  description,
  expectedName,
  confirmLabel = 'Excluir definitivamente',
  loading = false,
  error = null,
  onConfirm,
}: ConfirmByNameDialogProps) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  const canConfirm = namesMatch(typed, expectedName) && !loading;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (canConfirm) onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-sm text-sm text-neutral-600">{description}</div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-xs">
            <Label htmlFor="confirm-name-input" className="normal-case text-sm text-neutral-800">
              Digite <strong>{expectedName}</strong> para confirmar
            </Label>
            <Input
              id="confirm-name-input"
              data-testid="confirm-name-input"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-error-500" data-testid="confirm-name-error">
              {error}
            </p>
          )}

          <DialogFooter className="gap-sm">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              data-testid="confirm-delete"
              disabled={!canConfirm}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
