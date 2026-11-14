import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery } from '@apollo/client';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { PackageData, UserError } from '../api/pacotes.api';
import type {
  PackageTimelineKind,
  PackageTimelineQueryResult,
  PackageTimelineStepInput,
  SetPackageTimelineResult,
} from '../api/package-timeline.api';
import { PackageTimelineQuery, SetPackageTimelineMutation } from '../api/package-timeline.api';

const DEFAULT_DURATION = 90;
const EXAMPLE_DEPARTURE_MINUTES = 17 * 60;

interface RowValues {
  name: string;
  offset: string;
  kind: '' | PackageTimelineKind;
  serviceId: string;
  duration: string;
  startsRegistry: boolean;
}

interface FormValues {
  steps: RowValues[];
  extras: RowValues[];
}

const emptyRow = (): RowValues => ({
  name: '',
  offset: '0',
  kind: '',
  serviceId: '',
  duration: '',
  startsRegistry: false,
});

/** Hora cheia "17h", quebrada "15:10" (mesma regra do cronograma gerado no servidor). */
function formatHour(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  const hh = String(h).padStart(2, '0');
  return mm === 0 ? `${hh}h` : `${hh}:${String(mm).padStart(2, '0')}`;
}

const fieldClass =
  'h-11 w-full rounded-md border border-neutral-200 bg-white px-[14px] text-body text-neutral-800';

interface Props {
  pkg: PackageData;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function PackageTimelineDialog({ pkg, open, onOpenChange }: Props) {
  const { data, loading } = useQuery<PackageTimelineQueryResult>(PackageTimelineQuery, {
    variables: { packageId: pkg.id },
    skip: !open,
    fetchPolicy: 'network-only',
  });
  const [save, { loading: saving }] = useMutation<SetPackageTimelineResult>(
    SetPackageTimelineMutation,
    { refetchQueries: ['PackageTimeline'] },
  );
  const [errors, setErrors] = useState<UserError[]>([]);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const form = useForm<FormValues>({ defaultValues: { steps: [], extras: [] } });
  const stepsArray = useFieldArray({ control: form.control, name: 'steps' });
  const extrasArray = useFieldArray({ control: form.control, name: 'extras' });

  useEffect(() => {
    if (!data) return;
    const toRow = (s: PackageTimelineQueryResult['packageTimeline'][number]): RowValues => ({
      name: s.name,
      offset: String(s.offsetMinutes),
      kind: s.kind ?? '',
      serviceId: s.serviceId ?? '',
      duration: s.durationMinutes != null ? String(s.durationMinutes) : '',
      startsRegistry: s.startsRegistry,
    });
    const sorted = [...data.packageTimeline].sort((a, b) => a.displayOrder - b.displayOrder);
    form.reset({
      steps: sorted.filter((s) => !s.isExtra).map(toRow),
      extras: sorted.filter((s) => s.isExtra).map(toRow),
    });
  }, [data, form]);

  const watched = form.watch();
  const steps = watched.steps ?? [];
  const extras = watched.extras ?? [];

  const preview = [...steps, ...extras]
    .filter((r) => r.name.trim() !== '' && r.offset !== '' && !Number.isNaN(Number(r.offset)))
    .map((r) => ({
      minutes: EXAMPLE_DEPARTURE_MINUTES - Number(r.offset),
      offset: Number(r.offset),
      name: r.name.trim(),
    }))
    .sort((a, b) => b.offset - a.offset);

  function buildSteps(): PackageTimelineStepInput[] {
    const map = (r: RowValues, isExtra: boolean): PackageTimelineStepInput => ({
      isExtra,
      name: r.name.trim(),
      offsetMinutes: Number(r.offset),
      kind: !isExtra && r.kind ? r.kind : null,
      serviceId: !isExtra && r.kind && r.serviceId ? r.serviceId : null,
      durationMinutes: !isExtra && r.kind ? Number(r.duration || DEFAULT_DURATION) : null,
      startsRegistry: !isExtra && r.startsRegistry,
    });
    const v = form.getValues();
    return [...v.steps.map((r) => map(r, false)), ...v.extras.map((r) => map(r, true))];
  }

  async function submit(payload: PackageTimelineStepInput[]) {
    setErrors([]);
    const res = await save({ variables: { input: { packageId: pkg.id, steps: payload } } });
    const result = res.data?.setPackageTimeline;
    if (!result) {
      setErrors([{ code: 'UNKNOWN', message: 'Não foi possível salvar o cronograma.' }]);
      return;
    }
    if (result.errors.length > 0) {
      setErrors(result.errors);
      return;
    }
    toast.success('Cronograma do pacote salvo.');
    onOpenChange(false);
  }

  function setKind(list: 'steps', index: number, kind: '' | PackageTimelineKind) {
    form.setValue(`${list}.${index}.kind`, kind);
    if (kind === '') {
      form.setValue(`${list}.${index}.serviceId`, '');
      form.setValue(`${list}.${index}.duration`, '');
    } else if (!form.getValues(`${list}.${index}.duration`)) {
      form.setValue(`${list}.${index}.duration`, String(DEFAULT_DURATION));
    }
  }

  function setRegistry(index: number) {
    form.getValues('steps').forEach((_, i) => {
      form.setValue(`steps.${i}.startsRegistry`, i === index);
    });
  }

  const isEmpty = stepsArray.fields.length === 0 && extrasArray.fields.length === 0;
  const hasRule = (data?.packageTimeline.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{`Cronograma do dia — ${pkg.name}`}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-neutral-500">Carregando cronograma…</p>
        ) : (
          <form
            className="space-y-lg"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(buildSteps());
            }}
          >
            {isEmpty && (
              <p className="text-sm text-neutral-500">
                Este pacote ainda não tem cronograma. Sem regra, o grupo de noivas não gera o
                cronograma do dia.
              </p>
            )}

            <section className="space-y-sm">
              <h3 className="text-overline uppercase text-neutral-500">Etapas</h3>
              {stepsArray.fields.map((field, i) => {
                const n = i + 1;
                const kind = steps[i]?.kind ?? '';
                return (
                  <div
                    key={field.id}
                    className="space-y-xs rounded-md border border-neutral-200 bg-white p-sm"
                  >
                    <div className="grid grid-cols-1 gap-sm sm:grid-cols-[1fr_9rem_11rem]">
                      <Input
                        aria-label={`Etapa ${n}`}
                        placeholder="Etapa"
                        {...form.register(`steps.${i}.name`)}
                      />
                      <Input
                        type="number"
                        min={0}
                        max={1440}
                        className="tabular-nums"
                        aria-label={`Minutos antes da saída da etapa ${n}`}
                        {...form.register(`steps.${i}.offset`)}
                      />
                      <select
                        aria-label={`Tipo da etapa ${n}`}
                        className={fieldClass}
                        value={kind}
                        onChange={(e) => setKind('steps', i, e.target.value as '' | PackageTimelineKind)}
                      >
                        <option value="">Comum</option>
                        <option value="make">Make da noiva</option>
                        <option value="hair">Penteado da noiva</option>
                      </select>
                    </div>
                    {kind !== '' && (
                      <div className="grid grid-cols-1 gap-sm sm:grid-cols-[1fr_9rem]">
                        <select
                          aria-label={`Serviço da etapa ${n}`}
                          className={fieldClass}
                          {...form.register(`steps.${i}.serviceId`)}
                        >
                          <option value="">Escolha o serviço do pacote</option>
                          {pkg.services.map((s) => (
                            <option key={s.serviceId} value={s.serviceId}>
                              {s.service.name}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          min={1}
                          className="tabular-nums"
                          aria-label={`Duração (min) da etapa ${n}`}
                          {...form.register(`steps.${i}.duration`)}
                        />
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-sm">
                      <label className="flex items-center gap-xs text-sm text-neutral-800">
                        <input
                          type="radio"
                          name="timeline-registry-start"
                          aria-label={`Início do registro (fotos/making of) da etapa ${n}`}
                          checked={steps[i]?.startsRegistry ?? false}
                          onChange={() => setRegistry(i)}
                        />
                        Início do registro (fotos/making of)
                      </label>
                      <div className="inline-flex">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Subir etapa ${n}`}
                          disabled={i === 0}
                          onClick={() => stepsArray.move(i, i - 1)}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Descer etapa ${n}`}
                          disabled={i === stepsArray.fields.length - 1}
                          onClick={() => stepsArray.move(i, i + 1)}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover etapa ${n}`}
                          onClick={() => stepsArray.remove(i)}
                        >
                          <Trash2 className="h-4 w-4 text-error-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <Button type="button" variant="outline" onClick={() => stepsArray.append(emptyRow())}>
                <Plus className="mr-1 h-4 w-4" />
                Adicionar etapa
              </Button>
            </section>

            <section className="space-y-sm">
              <h3 className="text-overline uppercase text-neutral-500">Extras</h3>
              {extrasArray.fields.map((field, i) => {
                const n = i + 1;
                return (
                  <div
                    key={field.id}
                    className="grid grid-cols-1 items-center gap-sm rounded-md border border-neutral-200 bg-white p-sm sm:grid-cols-[1fr_9rem_auto]"
                  >
                    <Input
                      aria-label={`Texto do extra ${n}`}
                      placeholder="Texto"
                      {...form.register(`extras.${i}.name`)}
                    />
                    <Input
                      type="number"
                      min={0}
                      max={1440}
                      className="tabular-nums"
                      aria-label={`Minutos antes da saída do extra ${n}`}
                      {...form.register(`extras.${i}.offset`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover extra ${n}`}
                      onClick={() => extrasArray.remove(i)}
                    >
                      <Trash2 className="h-4 w-4 text-error-600" />
                    </Button>
                  </div>
                );
              })}
              <Button type="button" variant="outline" onClick={() => extrasArray.append(emptyRow())}>
                <Plus className="mr-1 h-4 w-4" />
                Adicionar extra
              </Button>
            </section>

            <section className="space-y-xs">
              <h3 className="text-overline uppercase text-neutral-500">
                Prévia (saída às {formatHour(EXAMPLE_DEPARTURE_MINUTES)})
              </h3>
              <ul
                data-testid="timeline-rule-preview"
                className="rounded-md border border-neutral-200 bg-white p-sm text-sm text-neutral-800"
              >
                {preview.length === 0 && <li className="text-neutral-500">Sem etapas.</li>}
                {preview.map((p, i) => (
                  <li key={i} className="tabular-nums">
                    {`${formatHour(p.minutes)} ${p.name}`}
                  </li>
                ))}
              </ul>
            </section>

            {errors.length > 0 && (
              <ul role="alert" className="list-disc pl-5 text-sm text-error-600">
                {errors.map((e, i) => (
                  <li key={`${e.code}-${i}`}>{e.message}</li>
                ))}
              </ul>
            )}

            <p className="text-xs text-neutral-500">
              Os horários são contados a partir da saída da noiva. O sistema não muda esses
              valores sozinho.
            </p>

            <DialogFooter className="gap-sm">
              {hasRule &&
                (confirmRemove ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void submit([])}
                  >
                    Confirmar remoção do cronograma
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => setConfirmRemove(true)}>
                    Remover cronograma
                  </Button>
                ))}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Salvar cronograma
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
