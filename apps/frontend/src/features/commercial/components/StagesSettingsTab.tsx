import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
import { Skeleton } from '@/components/ui/skeleton';
import { CommercialStagesQuery } from '../api/leads.api';
import {
  CreateCommercialStageMutation,
  DeleteCommercialStageMutation,
  ReorderCommercialStagesMutation,
  UpdateCommercialStageMutation,
  type CommercialOkPayload,
  type CommercialStagePayload,
  type CommercialStagesPayload,
} from '../api/stages.api';
import type { CommercialStage } from '../api/deals.api';

const LABEL_CLASS = 'text-xs font-semibold text-neutral-700';
const SELECT_CLASS =
  'mt-xs w-full rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm min-h-[44px]';
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function stageError(errors: { code: string; message: string }[], fallback: string): string {
  const e = errors[0];
  if (!e) return fallback;
  if (e.code === 'STAGE_LAST_OPEN') return 'Mantenha pelo menos uma etapa aberta.';
  return e.message || fallback;
}

interface RowProps {
  stage: CommercialStage;
  index: number;
  openCount: number;
  busy: boolean;
  onSave: (stage: CommercialStage, name: string, color: string, slaDays: number | null) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onDelete: (stage: CommercialStage) => void;
}

function StageRow({ stage, index, openCount, busy, onSave, onMove, onDelete }: RowProps) {
  const system = stage.kind !== 'open';
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color);
  const [sla, setSla] = useState(stage.slaDays == null ? '' : String(stage.slaDays));
  const slaNum = sla.trim() === '' ? null : Number(sla);
  const valid =
    name.trim().length > 0 &&
    HEX_RE.test(color) &&
    (slaNum === null || (Number.isInteger(slaNum) && slaNum >= 0));
  const dirty =
    name !== stage.name || color !== stage.color || (system ? false : slaNum !== stage.slaDays);

  return (
    <li
      className="rounded-md border border-neutral-200 bg-white p-md"
      data-testid={`stage-row-${stage.id}`}
    >
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-[2fr_auto_1fr]">
        <div>
          <Label htmlFor={`st-name-${stage.id}`} className={LABEL_CLASS}>
            Nome da etapa
          </Label>
          <Input
            id={`st-name-${stage.id}`}
            className="mt-xs"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`st-color-${stage.id}`} className={LABEL_CLASS}>
            Cor
          </Label>
          <div className="mt-xs flex items-center gap-xs">
            <input
              id={`st-color-${stage.id}`}
              type="color"
              aria-label={`Cor da etapa ${stage.name}`}
              className="h-11 w-11 shrink-0 cursor-pointer rounded-md border border-neutral-200"
              value={HEX_RE.test(color) ? color : '#000000'}
              onChange={(e) => setColor(e.target.value)}
            />
            <Input
              aria-label={`Código da cor de ${stage.name}`}
              className="w-28"
              value={color}
              maxLength={7}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
        </div>
        {system ? (
          <div className="flex items-end">
            <Badge variant="outline">Etapa de sistema</Badge>
          </div>
        ) : (
          <div>
            <Label htmlFor={`st-sla-${stage.id}`} className={LABEL_CLASS}>
              Prazo (dias)
            </Label>
            <Input
              id={`st-sla-${stage.id}`}
              className="mt-xs"
              inputMode="numeric"
              placeholder="Sem prazo"
              value={sla}
              onChange={(e) => setSla(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        )}
      </div>
      <div className="mt-sm flex flex-wrap items-center gap-xs">
        {!system && (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-11 shrink-0 px-0"
              aria-label={`Subir ${stage.name}`}
              disabled={busy || index === 0}
              onClick={() => onMove(index, -1)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-11 shrink-0 px-0"
              aria-label={`Descer ${stage.name}`}
              disabled={busy || index === openCount - 1}
              onClick={() => onMove(index, 1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button
          type="button"
          className="shrink-0"
          disabled={busy || !dirty || !valid}
          onClick={() => onSave(stage, name.trim(), color, system ? null : slaNum)}
        >
          Salvar
        </Button>
        {!system && (
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 text-error-600"
            disabled={busy}
            aria-label={`Excluir etapa ${stage.name}`}
            onClick={() => onDelete(stage)}
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        )}
      </div>
    </li>
  );
}

export function StagesSettingsTab() {
  const { data, loading } = useQuery<{ commercialStages: CommercialStage[] }>(
    CommercialStagesQuery,
  );
  const refetchQueries = [{ query: CommercialStagesQuery }];
  const [createStage, { loading: creating }] = useMutation<{
    createCommercialStage: CommercialStagePayload;
  }>(CreateCommercialStageMutation, { refetchQueries });
  const [updateStage, { loading: updating }] = useMutation<{
    updateCommercialStage: CommercialStagePayload;
  }>(UpdateCommercialStageMutation, { refetchQueries });
  const [reorderStages, { loading: reordering }] = useMutation<{
    reorderCommercialStages: CommercialStagesPayload;
  }>(ReorderCommercialStagesMutation, { refetchQueries });
  const [deleteStage, { loading: deleting }] = useMutation<{
    deleteCommercialStage: CommercialOkPayload;
  }>(DeleteCommercialStageMutation, { refetchQueries });
  const busy = creating || updating || reordering || deleting;

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [newSla, setNewSla] = useState('');
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<CommercialStage | null>(null);
  const [moveTo, setMoveTo] = useState('');

  const stages = [...(data?.commercialStages ?? [])].sort((a, b) => a.position - b.position);
  const open = stages.filter((s) => s.kind === 'open');
  const closed = stages.filter((s) => s.kind !== 'open'); // Ganho e Perdido, sempre no fim

  async function run<T>(
    fn: () => Promise<{ data?: T | null }>,
    pick: (d: T) => { errors: { code: string; message: string }[] } | undefined,
    fallback: string,
    okMessage?: string,
  ): Promise<boolean> {
    setError('');
    try {
      const res = await fn();
      const p = res.data ? pick(res.data) : undefined;
      if (p?.errors.length) {
        const msg = stageError(p.errors, fallback);
        setError(msg);
        toast.error(msg);
        return false;
      }
      if (okMessage) toast.success(okMessage);
      return true;
    } catch {
      setError(fallback);
      toast.error(fallback);
      return false;
    }
  }

  async function create() {
    const ok = await run(
      () =>
        createStage({
          variables: {
            input: {
              name: newName.trim(),
              color: newColor,
              slaDays: newSla.trim() === '' ? null : Number(newSla),
            },
          },
        }),
      (d) => d.createCommercialStage,
      'Não foi possível criar a etapa.',
      'Etapa criada.',
    );
    if (ok) {
      setNewName('');
      setNewSla('');
    }
  }

  function save(stage: CommercialStage, name: string, color: string, slaDays: number | null) {
    void run(
      () =>
        updateStage({
          variables: {
            id: stage.id,
            input: { name, color, slaDays: stage.kind === 'open' ? slaDays : stage.slaDays },
          },
        }),
      (d) => d.updateCommercialStage,
      'Não foi possível salvar a etapa.',
      'Etapa salva.',
    );
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...open];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    const ids = [...next, ...closed].map((s) => s.id);
    void run(
      () => reorderStages({ variables: { ids } }),
      (d) => d.reorderCommercialStages,
      'Não foi possível reordenar as etapas.',
    );
  }

  function askDelete(stage: CommercialStage) {
    if (open.length <= 1) {
      const msg = 'Mantenha pelo menos uma etapa aberta.';
      setError(msg);
      toast.error(msg);
      return;
    }
    setToDelete(stage);
    setMoveTo(open.find((s) => s.id !== stage.id)?.id ?? '');
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const ok = await run(
      () =>
        deleteStage({
          variables: { id: toDelete.id, moveToStageId: toDelete.openDeals > 0 ? moveTo : null },
        }),
      (d) => d.deleteCommercialStage,
      'Não foi possível excluir a etapa.',
      'Etapa excluída.',
    );
    if (ok) setToDelete(null);
  }

  if (loading && stages.length === 0) return <Skeleton className="mt-md h-48 w-full" />;

  const newSlaValid = newSla.trim() === '' || Number.isInteger(Number(newSla));

  return (
    <div className="mt-md space-y-md">
      <p className="text-sm text-neutral-700">
        Cada etapa tem uma cor e um prazo em dias: o negócio parado além do prazo fica em alerta
        vermelho. Ganho e Perdido são etapas de sistema e ficam sempre no fim.
      </p>
      {error && (
        <p role="alert" className="text-sm text-error-600">
          {error}
        </p>
      )}
      <ul className="space-y-sm">
        {open.map((s, i) => (
          <StageRow
            key={`${s.id}-${s.name}-${s.color}-${s.slaDays}`}
            stage={s}
            index={i}
            openCount={open.length}
            busy={busy}
            onSave={save}
            onMove={move}
            onDelete={askDelete}
          />
        ))}
        {closed.map((s, i) => (
          <StageRow
            key={`${s.id}-${s.name}-${s.color}`}
            stage={s}
            index={i}
            openCount={0}
            busy={busy}
            onSave={save}
            onMove={move}
            onDelete={askDelete}
          />
        ))}
      </ul>

      <form
        noValidate
        className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-md"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <h3 className="mb-sm text-sm font-semibold text-neutral-900">Nova etapa</h3>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-[2fr_auto_1fr]">
          <div>
            <Label htmlFor="new-stage-name" className={LABEL_CLASS}>
              Nome da nova etapa
            </Label>
            <Input
              id="new-stage-name"
              className="mt-xs"
              value={newName}
              maxLength={40}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="new-stage-color" className={LABEL_CLASS}>
              Cor da nova etapa
            </Label>
            <input
              id="new-stage-color"
              type="color"
              className="mt-xs block h-11 w-14 cursor-pointer rounded-md border border-neutral-200"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="new-stage-sla" className={LABEL_CLASS}>
              Prazo da nova etapa (dias)
            </Label>
            <Input
              id="new-stage-sla"
              className="mt-xs"
              inputMode="numeric"
              placeholder="Sem prazo"
              value={newSla}
              onChange={(e) => setNewSla(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>
        <Button
          type="submit"
          className="mt-sm shrink-0"
          disabled={busy || newName.trim().length === 0 || !newSlaValid}
        >
          Nova etapa
        </Button>
      </form>

      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent className="max-w-md">
          {toDelete && (
            <>
              <DialogHeader>
                <DialogTitle>Excluir etapa {toDelete.name}</DialogTitle>
                <DialogDescription>
                  {toDelete.openDeals > 0
                    ? `Esta etapa tem ${toDelete.openDeals} negócio(s) aberto(s). Escolha para onde eles vão.`
                    : 'Esta etapa não tem negócios abertos.'}
                </DialogDescription>
              </DialogHeader>
              {toDelete.openDeals > 0 && (
                <div className="my-md">
                  <Label htmlFor="stage-move-to" className={LABEL_CLASS}>
                    Mover os negócios para
                  </Label>
                  <select
                    id="stage-move-to"
                    className={SELECT_CLASS}
                    value={moveTo}
                    onChange={(e) => setMoveTo(e.target.value)}
                  >
                    {open
                      .filter((s) => s.id !== toDelete.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setToDelete(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={busy || (toDelete.openDeals > 0 && !moveTo)}
                  onClick={() => void confirmDelete()}
                >
                  Excluir etapa
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
