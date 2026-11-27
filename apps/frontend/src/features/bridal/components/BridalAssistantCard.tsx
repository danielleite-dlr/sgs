import { useState } from 'react';
import { useLazyQuery, useMutation } from '@apollo/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useHasPermission } from '@/features/operations/operations-permissions';
import {
  BridalAssistantCandidatesQuery,
  SetBridalGroupAssistantMutation,
  type BridalAssistantCandidate,
  type BridalGroupData,
  type BridalGroupPayload,
} from '../api/bridal.api';

interface Props {
  group: BridalGroupData;
  /** ADMIN/MANAGER/ATTENDANT em grupo ativo. */
  canWrite: boolean;
}

function formatRate(rate: string): string {
  const n = Number(rate);
  if (Number.isNaN(n)) return rate;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Assistente da noiva ou da debutante (09.1 + fase 11 G-01): aviso de pendência, escolha, troca e remoção. */
export function BridalAssistantCard({ group, canWrite }: Props) {
  const canSeeCost = useHasPermission('financial.read');
  const [chooseOpen, setChooseOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadCandidates, { data, loading: loadingCandidates }] = useLazyQuery<{
    bridalAssistantCandidates: BridalAssistantCandidate[];
  }>(BridalAssistantCandidatesQuery, { fetchPolicy: 'network-only' });
  const [setAssistant, { loading: saving }] = useMutation<{
    setBridalGroupAssistant: BridalGroupPayload;
  }>(SetBridalGroupAssistantMutation);

  if (!group.assistantRequired && !group.assistantMemberId) return null;

  const candidates = data?.bridalAssistantCandidates ?? [];

  function openChoose() {
    setSelected(null);
    setChooseOpen(true);
    void loadCandidates({ variables: { groupId: group.id } });
  }

  async function apply(memberId: string | null) {
    try {
      const res = await setAssistant({ variables: { groupId: group.id, memberId } });
      const payload = res.data?.setBridalGroupAssistant;
      const err = payload?.errors?.[0];
      if (err) {
        toast.error(err.message);
        return;
      }
      if (payload?.warning) toast.warning(payload.warning);
      toast.success(memberId ? 'Assistente vinculada.' : 'Assistente removida.');
      setChooseOpen(false);
      setRemoveOpen(false);
    } catch {
      toast.error('Não foi possível atualizar a assistente. Tente novamente.');
    }
  }

  const who = group.eventKind === 'debutante' ? 'debutante' : 'noiva';

  return (
    <section
      aria-label={`Assistente da ${who}`}
      className="mb-md space-y-sm rounded-md border border-neutral-200 bg-white p-md"
      data-testid="assistant-card"
    >
      <h3 className="text-h3 font-semibold text-neutral-800">
        {`Assistente da ${who}`}
      </h3>

      {group.assistantMemberId ? (
        <div className="space-y-xs">
          <p className="text-body text-neutral-800" data-testid="assistant-name">
            Assistente: {group.assistantName}
          </p>
          {canSeeCost && group.assistantDailyRate && (
            <p className="text-sm tabular-nums text-neutral-700" data-testid="assistant-rate">
              Diária: R$ {formatRate(group.assistantDailyRate)}
            </p>
          )}
          <p className="text-xs text-neutral-600">
            A agenda dela fica bloqueada o dia todo no dia do evento.
          </p>
          {canWrite && (
            <div className="flex flex-wrap gap-sm">
              <Button
                type="button"
                variant="outline"
                onClick={openChoose}
                data-testid="assistant-change"
              >
                Trocar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-error-600"
                onClick={() => setRemoveOpen(true)}
                data-testid="assistant-remove"
              >
                Remover
              </Button>
            </div>
          )}
        </div>
      ) : group.assistantPending ? (
        <div
          role="status"
          data-testid="assistant-pending"
          className="flex flex-wrap items-center gap-sm rounded-md border border-warning-500 bg-warning-50 p-sm text-sm text-warning-700"
        >
          <span>Sem assistente — escolher</span>
          {canWrite && (
            <Button type="button" size="sm" onClick={openChoose} data-testid="assistant-choose">
              Escolher assistente
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-neutral-600">Sem assistente.</p>
      )}

      <Dialog open={chooseOpen} onOpenChange={setChooseOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogTitle className="text-base font-bold text-neutral-800">
            {`Escolher assistente da ${who}`}
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-600">
            As profissionais ocupadas no dia do evento aparecem desabilitadas.
          </DialogDescription>
          {loadingCandidates && <p className="text-sm text-neutral-600">Carregando...</p>}
          {!loadingCandidates && data && candidates.length === 0 && (
            <p className="text-sm text-neutral-600" data-testid="assistant-empty">
              Nenhuma profissional com a função Assistente da Noiva. Marque a função em
              Profissionais.
            </p>
          )}
          <ul className="space-y-xs" role="radiogroup" aria-label="Assistentes">
            {candidates.map((c) => (
              <li key={c.memberId}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected === c.memberId}
                  disabled={!c.available}
                  data-testid={`candidate-${c.memberId}`}
                  onClick={() => setSelected(c.memberId)}
                  className={`w-full rounded-md border px-sm py-xs text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected === c.memberId
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 bg-white'
                  }`}
                >
                  <span className="font-medium text-neutral-800">
                    {c.displayName}
                    {c.current ? ' (atual)' : ''}
                  </span>
                  {!c.available && c.reason && (
                    <span className="block text-xs text-neutral-600">{c.reason}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-sm">
            <Button type="button" variant="ghost" onClick={() => setChooseOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!selected || saving}
              onClick={() => void apply(selected)}
              data-testid="assistant-confirm"
            >
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogTitle className="text-base font-bold text-neutral-800">
            Remover a assistente?
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-600">
            Remover a assistente? A agenda dela no dia será liberada.
          </DialogDescription>
          <div className="flex flex-wrap justify-end gap-sm">
            <Button type="button" variant="ghost" onClick={() => setRemoveOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void apply(null)}
              data-testid="assistant-remove-confirm"
            >
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
