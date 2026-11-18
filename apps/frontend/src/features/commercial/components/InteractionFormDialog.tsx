import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  CreateCommercialInteractionMutation,
  type CommercialDeal,
  type CommercialInteractionPayload,
} from '../api/deals.api';
import {
  INTERACTION_TYPE_OPTIONS,
  KIND_LABEL,
  firstError,
} from '../lib/commercial-labels';

const LABEL_CLASS = 'text-xs font-semibold text-neutral-700';
const SELECT_CLASS =
  'mt-xs w-full rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm min-h-[44px]';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  dealId?: string | null;
  /** Negócios do lead, para escolher a qual a interação se refere. */
  deals?: CommercialDeal[];
  onSaved: () => void;
}

/** 'YYYY-MM-DDTHH:mm' (hora local do navegador) -> ISO UTC. */
function localToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function InteractionFormDialog({
  open,
  onOpenChange,
  leadId,
  dealId,
  deals,
  onSaved,
}: Props) {
  const [type, setType] = useState('call');
  const [notes, setNotes] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [nextContact, setNextContact] = useState('');
  const [nextTitle, setNextTitle] = useState('');
  const [selectedDeal, setSelectedDeal] = useState(dealId ?? '');
  const [error, setError] = useState<string | null>(null);

  const [createInteraction, { loading }] = useMutation<{
    createCommercialInteraction: CommercialInteractionPayload;
  }>(CreateCommercialInteractionMutation);

  async function submit() {
    setError(null);
    const nextIso = localToIso(nextContact);
    if (nextContact && !nextIso) {
      setError('Data do próximo contato inválida.');
      return;
    }
    try {
      const res = await createInteraction({
        variables: {
          input: {
            leadId,
            dealId: selectedDeal || null,
            type,
            notes: notes.trim() || null,
            occurredAt: localToIso(occurredAt),
            nextContactAt: nextIso,
            nextContactTitle: nextIso ? nextTitle.trim() || null : null,
          },
        },
      });
      const p = res.data?.createCommercialInteraction;
      if (!p?.interaction) {
        setError(firstError(p?.errors, 'Não foi possível registrar a interação.'));
        return;
      }
      toast.success(
        nextIso ? 'Interação registrada e lembrete criado' : 'Interação registrada',
      );
      onSaved();
      onOpenChange(false);
    } catch {
      setError('Não foi possível registrar a interação. Tente novamente.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[560px] overflow-y-auto">
        <DialogTitle className="font-serif text-base font-bold text-neutral-800">
          Registrar interação
        </DialogTitle>
        <DialogDescription className="text-sm text-neutral-600">
          Fica no histórico único do lead. Defina um próximo contato para criar o lembrete.
        </DialogDescription>

        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div>
            <Label className={LABEL_CLASS} htmlFor="int-type">
              Tipo
            </Label>
            <select
              id="int-type"
              className={SELECT_CLASS}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {INTERACTION_TYPE_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className={LABEL_CLASS} htmlFor="int-when">
              Data e hora (opcional)
            </Label>
            <Input
              id="int-when"
              type="datetime-local"
              className="mt-xs"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>
          {deals && deals.length > 0 && (
            <div className="sm:col-span-2">
              <Label className={LABEL_CLASS} htmlFor="int-deal">
                Negócio
              </Label>
              <select
                id="int-deal"
                className={SELECT_CLASS}
                value={selectedDeal}
                onChange={(e) => setSelectedDeal(e.target.value)}
              >
                <option value="">Geral (sem negócio)</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {KIND_LABEL[d.kind] ?? d.kind}
                    {d.beneficiaryName ? ` — ${d.beneficiaryName}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <Label className={LABEL_CLASS} htmlFor="int-notes">
              Observações
            </Label>
            <Textarea
              id="int-notes"
              className="mt-xs"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div>
            <Label className={LABEL_CLASS} htmlFor="int-next">
              Próximo contato em
            </Label>
            <Input
              id="int-next"
              type="datetime-local"
              className="mt-xs"
              value={nextContact}
              onChange={(e) => setNextContact(e.target.value)}
            />
          </div>
          {nextContact && (
            <div>
              <Label className={LABEL_CLASS} htmlFor="int-next-title">
                Título do lembrete (opcional)
              </Label>
              <Input
                id="int-next-title"
                className="mt-xs"
                value={nextTitle}
                onChange={(e) => setNextTitle(e.target.value)}
              />
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-error-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-sm">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={loading}>
            {loading ? 'Salvando...' : 'Registrar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
