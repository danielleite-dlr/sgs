import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CreateBridalGroupMutation,
  UpdateBridalGroupMutation,
  type BridalGroupData,
  type BridalGroupFieldsInput,
  type BridalGroupPayload,
} from '../api/bridal.api';
import { errorMessage } from '../lib/bridal-labels';
import { buildPersonInput, emptyPerson, type PersonDraft } from '../lib/person-draft';
import { fromZoned, toZoned } from '../lib/schedule-rows';
import { BridalPersonFields } from './BridalPersonFields';

const MAX_COMPANIONS = 14;
const LABEL_CLASS = 'text-xs font-semibold text-neutral-700';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando presente, edita os dados do grupo (sem pessoas). */
  group?: BridalGroupData;
  onSaved: (group: BridalGroupData) => void;
}

function readyByToTime(g?: BridalGroupData): string {
  return g?.readyBy ? toZoned(g.readyBy).time : '';
}

export function BridalGroupFormDialog({ open, onOpenChange, group, onSaved }: Props) {
  const editing = group !== undefined;
  const [name, setName] = useState(group?.name ?? '');
  const [eventDate, setEventDate] = useState(group?.eventDate.slice(0, 10) ?? '');
  const [readyTime, setReadyTime] = useState(readyByToTime(group));
  const [locationKind, setLocationKind] = useState(group?.locationKind ?? 'studio');
  const [address, setAddress] = useState(group?.locationAddress ?? '');
  const [before, setBefore] = useState(String(group?.travelMinutesBefore ?? 0));
  const [after, setAfter] = useState(String(group?.travelMinutesAfter ?? 0));
  const [notes, setNotes] = useState(group?.notes ?? '');
  const [bride, setBride] = useState<PersonDraft>(() => emptyPerson(true));
  const [companions, setCompanions] = useState<PersonDraft[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const [createGroup, { loading: creating }] =
    useMutation<{ createBridalGroup: BridalGroupPayload }>(CreateBridalGroupMutation);
  const [updateGroup, { loading: updating }] =
    useMutation<{ updateBridalGroup: BridalGroupPayload }>(UpdateBridalGroupMutation);
  const loading = creating || updating;
  const external = locationKind === 'external';

  function buildGroupFields(): { ok: true; fields: BridalGroupFieldsInput } | { ok: false; errs: string[] } {
    const errs: string[] = [];
    if (name.trim().length < 2) errs.push('Informe o nome do grupo.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) errs.push('Informe a data do evento.');
    if (readyTime && !/^\d{2}:\d{2}$/.test(readyTime)) errs.push('Horário "pronta até" inválido.');
    if (external && address.trim().length < 3) errs.push('Informe o endereço do evento externo.');
    const b = Number(before);
    const a = Number(after);
    if (external) {
      for (const [label, v] of [
        ['antes', b],
        ['depois', a],
      ] as const) {
        if (!Number.isInteger(v) || v < 0 || v > 240) {
          errs.push(`Deslocamento ${label}: use de 0 a 240 minutos.`);
        }
      }
    }
    if (errs.length > 0) return { ok: false, errs };
    return {
      ok: true,
      fields: {
        name: name.trim(),
        eventDate,
        readyBy: readyTime ? fromZoned(eventDate, readyTime).toISOString() : null,
        locationKind,
        locationAddress: external ? address.trim() : null,
        travelMinutesBefore: external ? b : 0,
        travelMinutesAfter: external ? a : 0,
        notes: notes.trim() || null,
      },
    };
  }

  async function submit() {
    setErrors([]);
    const g = buildGroupFields();
    if (!g.ok) {
      setErrors(g.errs);
      return;
    }
    try {
      if (editing && group) {
        const res = await updateGroup({ variables: { id: group.id, input: g.fields } });
        const p = res.data?.updateBridalGroup;
        if (p?.errors.length) {
          setErrors(p.errors.map(errorMessage));
          return;
        }
        if (p?.group) {
          toast.success('Grupo atualizado.');
          onSaved(p.group);
          onOpenChange(false);
        }
        return;
      }
      const brideRes = buildPersonInput(bride, 'Noiva');
      if (!brideRes.ok) {
        setErrors([brideRes.error]);
        return;
      }
      const comps = [];
      for (const [i, c] of companions.entries()) {
        const r = buildPersonInput(c, `Acompanhante ${i + 1}`);
        if (!r.ok) {
          setErrors([r.error]);
          return;
        }
        comps.push(r.input);
      }
      const res = await createGroup({
        variables: { input: { group: g.fields, bride: brideRes.input, companions: comps } },
      });
      const p = res.data?.createBridalGroup;
      if (p?.errors.length) {
        setErrors(p.errors.map(errorMessage));
        return;
      }
      if (p?.group) {
        toast.success('Grupo de noivas criado.');
        onSaved(p.group);
        onOpenChange(false);
      }
    } catch {
      setErrors(['Não foi possível salvar o grupo. Tente novamente.']);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-base font-bold text-neutral-800">
          {editing ? 'Editar grupo' : 'Novo grupo de noivas'}
        </DialogTitle>
        <DialogDescription className="text-sm text-neutral-600">
          {editing
            ? 'Altere a data, o local e o deslocamento do evento.'
            : 'Cadastre a noiva, as acompanhantes e os serviços planejados de cada uma.'}
        </DialogDescription>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
          <div className="sm:col-span-3">
            <Label className={LABEL_CLASS} htmlFor="bg-name">
              Nome do grupo
            </Label>
            <Input
              id="bg-name"
              data-testid="bg-name"
              className="mt-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label className={LABEL_CLASS} htmlFor="bg-date">
              Data do evento
            </Label>
            <Input
              id="bg-date"
              data-testid="bg-date"
              type="date"
              className="mt-xs"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div>
            <Label className={LABEL_CLASS} htmlFor="bg-ready">
              Pronta até (opcional)
            </Label>
            <Input
              id="bg-ready"
              data-testid="bg-ready"
              type="time"
              className="mt-xs"
              value={readyTime}
              onChange={(e) => setReadyTime(e.target.value)}
            />
          </div>
          <div>
            <Label className={LABEL_CLASS} htmlFor="bg-location">
              Local
            </Label>
            <select
              id="bg-location"
              data-testid="bg-location"
              className="mt-xs w-full rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white"
              value={locationKind}
              onChange={(e) => setLocationKind(e.target.value)}
            >
              <option value="studio">No estúdio</option>
              <option value="external">Externo</option>
            </select>
          </div>
          {external && (
            <>
              <div className="sm:col-span-3">
                <Label className={LABEL_CLASS} htmlFor="bg-address">
                  Endereço
                </Label>
                <Input
                  id="bg-address"
                  data-testid="bg-address"
                  className="mt-xs"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div>
                <Label className={LABEL_CLASS} htmlFor="bg-before">
                  Deslocamento antes (min)
                </Label>
                <Input
                  id="bg-before"
                  type="number"
                  min={0}
                  max={240}
                  className="mt-xs"
                  value={before}
                  onChange={(e) => setBefore(e.target.value)}
                />
              </div>
              <div>
                <Label className={LABEL_CLASS} htmlFor="bg-after">
                  Deslocamento depois (min)
                </Label>
                <Input
                  id="bg-after"
                  type="number"
                  min={0}
                  max={240}
                  className="mt-xs"
                  value={after}
                  onChange={(e) => setAfter(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="sm:col-span-3">
            <Label className={LABEL_CLASS} htmlFor="bg-notes">
              Observações
            </Label>
            <Textarea
              id="bg-notes"
              className="mt-xs"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {!editing && (
          <div className="space-y-sm">
            <BridalPersonFields idPrefix="bride" title="Noiva" value={bride} onChange={setBride} />
            {companions.map((c, i) => (
              <BridalPersonFields
                key={i}
                idPrefix={`companion-${i}`}
                title={`Acompanhante ${i + 1}`}
                value={c}
                onChange={(next) => setCompanions(companions.map((x, j) => (j === i ? next : x)))}
                onRemove={() => setCompanions(companions.filter((_, j) => j !== i))}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={companions.length >= MAX_COMPANIONS}
              onClick={() => setCompanions([...companions, emptyPerson(false)])}
              data-testid="bg-add-companion"
            >
              <Plus className="mr-xs h-4 w-4" aria-hidden="true" />
              Adicionar acompanhante
            </Button>
          </div>
        )}

        <div aria-live="polite" role="alert" className="text-sm text-error" data-testid="bg-errors">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>

        <div className="flex justify-end gap-sm">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={submit} disabled={loading} data-testid="bg-submit">
            {editing ? 'Salvar' : 'Criar grupo'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
