import { useState } from 'react';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PackagesQuery, type PackagesQueryResult } from '@/features/catalog/api/pacotes.api';
import {
  ProfessionalsForServiceQuery,
  type ProfessionalsForServiceResult,
} from '@/features/operations/api/appointments.api';
import { NATIVE_SELECT_CLASS } from '@/lib/field-classes';
import type { BridalGroupData } from '../api/bridal.api';
import {
  BridalTimelinePreviewQuery,
  BridalTimelineQuery,
  ConfirmBridalTimelineMutation,
  type BridalTimelineInput,
  type BridalTimelinePreviewData,
  type BridalTimelinePreviewResult,
  type BridalTimelineResult,
  type ConfirmBridalTimelineResult,
  type TimelineConflictData,
} from '../api/timeline.api';
import { useBridalPermission } from '../bridal-permissions';
import { copyText } from '../lib/copy-text';
import { SALON_TZ, toZoned } from '../lib/schedule-rows';
import { RULE_LABEL, timelineErrorMessage } from '../lib/timeline-labels';
import { TimelineSimulationCard } from './TimelineSimulationCard';

interface Props {
  group: BridalGroupData;
  onChanged: () => void;
}

interface Simulation {
  key: number;
  data: BridalTimelinePreviewData;
  conflicts: TimelineConflictData[];
  error: string | null;
}

const MAX_SIMULATIONS = 10;
const SELECT_CLASS = `mt-xs ${NATIVE_SELECT_CLASS}`;

function formatDateTime(iso: string): string {
  const { date, time } = toZoned(iso, SALON_TZ);
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y} às ${time}`;
}

function defaultBrideLabel(group: BridalGroupData): string {
  const name = group.members.find((m) => m.role === 'bride')?.clientName ?? '';
  return (name.trim().split(/\s+/)[0] ?? '').toLocaleUpperCase('pt-BR');
}

function ProfessionalSelect({
  id,
  label,
  serviceId,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  serviceId: string | null;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const { data } = useQuery<ProfessionalsForServiceResult>(ProfessionalsForServiceQuery, {
    variables: { serviceId },
    skip: !serviceId,
  });
  return (
    <div>
      <Label htmlFor={id} className="text-overline uppercase text-neutral-500">
        {label}
      </Label>
      <select
        id={id}
        data-testid={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">[a definir]</option>
        {(data?.professionalsForService ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}

export function BridalTimelineTab({ group, onChanged }: Props) {
  const canConfirm = useBridalPermission('bridal.write');
  const active = group.status === 'active';

  const [packageId, setPackageId] = useState(group.packageId ?? '');
  const [departure, setDeparture] = useState(
    group.readyBy ? toZoned(group.readyBy, SALON_TZ).time : '',
  );
  const [brideLabel, setBrideLabel] = useState(defaultBrideLabel(group));
  const [makeId, setMakeId] = useState('');
  const [hairId, setHairId] = useState('');
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [nextKey, setNextKey] = useState(1);
  const [pendingConfirm, setPendingConfirm] = useState<Simulation | null>(null);

  const { data: pkgData } = useQuery<PackagesQueryResult>(PackagesQuery);
  const { data: officialData, refetch: refetchOfficial } = useQuery<BridalTimelineResult>(
    BridalTimelineQuery,
    { variables: { groupId: group.id }, fetchPolicy: 'cache-and-network' },
  );
  const official = officialData?.bridalTimeline ?? null;

  const [runPreview, { loading: generating }] = useLazyQuery<BridalTimelinePreviewResult>(
    BridalTimelinePreviewQuery,
    { fetchPolicy: 'network-only' },
  );
  const [confirmTimeline, { loading: confirming }] = useMutation<ConfirmBridalTimelineResult>(
    ConfirmBridalTimelineMutation,
  );

  const latest = simulations[0]?.data ?? null;
  const makeServiceId = latest?.brideSlots.find((s) => s.kind === 'make')?.serviceId ?? null;
  const hairServiceId = latest?.brideSlots.find((s) => s.kind === 'hair')?.serviceId ?? null;

  function buildInput(): BridalTimelineInput {
    return {
      groupId: group.id,
      packageId,
      departureTime: departure,
      brideLabel: brideLabel.trim() || null,
      makeProfessionalId: makeId || null,
      hairProfessionalId: hairId || null,
    };
  }

  async function generate() {
    setFormError(null);
    try {
      const res = await runPreview({ variables: { input: buildInput() } });
      const payload = res.data?.bridalTimelinePreview;
      if (!payload || payload.errors.length > 0 || !payload.preview) {
        setFormError(
          payload?.errors.length
            ? timelineErrorMessage(payload.errors[0])
            : 'Não foi possível gerar a simulação. Tente novamente.',
        );
        return;
      }
      const preview = payload.preview;
      setSimulations((prev) =>
        [{ key: nextKey, data: preview, conflicts: [], error: null }, ...prev].slice(
          0,
          MAX_SIMULATIONS,
        ),
      );
      setNextKey((k) => k + 1);
    } catch {
      setFormError('Não foi possível gerar a simulação. Tente novamente.');
    }
  }

  function patchSim(key: number, patch: Partial<Simulation>) {
    setSimulations((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  async function doConfirm(sim: Simulation) {
    patchSim(sim.key, { error: null, conflicts: [] });
    const d = sim.data;
    try {
      const res = await confirmTimeline({
        variables: {
          input: {
            groupId: group.id,
            packageId: d.packageId,
            departureTime: d.departureTime,
            brideLabel: d.brideLabel,
            makeProfessionalId: d.makeProfessionalId,
            hairProfessionalId: d.hairProfessionalId,
          },
        },
      });
      const payload = res.data?.confirmBridalTimeline;
      if (!payload) return;
      if (payload.errors.length > 0 || !payload.timeline) {
        patchSim(sim.key, {
          error: payload.errors.length ? timelineErrorMessage(payload.errors[0]) : null,
          conflicts: payload.conflicts,
        });
        return;
      }
      toast.success('Cronograma confirmado. Make e penteado da noiva estão na agenda.');
      await refetchOfficial();
      onChanged();
    } catch {
      patchSim(sim.key, { error: 'Não foi possível confirmar. Tente novamente.' });
    }
  }

  function onConfirmClick(sim: Simulation) {
    if (official) setPendingConfirm(sim);
    else void doConfirm(sim);
  }

  const formDisabled = !active;

  return (
    <div className="space-y-md" data-testid="timeline-tab">
      <section
        className="rounded-md border border-neutral-200 bg-white p-md"
        data-testid="timeline-official"
      >
        <h2 className="mb-sm font-serif text-headline-sm text-neutral-800">Cronograma oficial</h2>
        {!official ? (
          <p className="text-body text-neutral-500">
            Ainda não há cronograma confirmado. Gere uma simulação e confirme quando o studio der o
            ok.
          </p>
        ) : (
          <div className="space-y-sm">
            <p className="text-body text-neutral-500" data-testid="timeline-official-meta">
              Versão {official.version} — {official.packageName}, saída {official.departureTime}.
              Confirmado por {official.confirmedByName ?? 'usuário'} em{' '}
              {formatDateTime(official.confirmedAt)}.
            </p>
            <pre
              data-testid="timeline-official-text"
              className="whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-sm text-body tabular-nums text-neutral-800"
            >
              {official.text}
            </pre>
            <Button type="button" variant="outline" onClick={() => void copyText(official.text)}>
              Copiar texto
            </Button>
            {official.companionIssues.length > 0 && (
              <div
                className="rounded-md border border-warning-500 bg-warning-50 p-sm"
                data-testid="timeline-companion-issues"
              >
                <p className="mb-xs text-body font-semibold text-neutral-800">
                  Acompanhantes que não cabem mais no cronograma
                </p>
                <ul className="space-y-xs text-body">
                  {official.companionIssues.map((i) => (
                    <li key={i.appointmentId} className="flex flex-wrap items-center gap-xs">
                      <Badge variant="warning">{RULE_LABEL[i.rule] ?? i.rule}</Badge>
                      <span className="font-semibold">{i.clientName}</span>
                      <span>
                        — {i.serviceName}, {formatDateTime(i.startsAt)}, {i.professionalName}.{' '}
                        {i.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section
        className="rounded-md border border-neutral-200 bg-white p-md"
        data-testid="timeline-form"
      >
        <h2 className="mb-sm font-serif text-headline-sm text-neutral-800">Nova simulação</h2>
        {!active && <p className="mb-sm text-body text-neutral-500">O grupo não está ativo.</p>}
        <div className="grid gap-sm sm:grid-cols-2">
          <div>
            <Label htmlFor="timeline-package" className="text-overline uppercase text-neutral-500">
              Pacote
            </Label>
            <select
              id="timeline-package"
              data-testid="timeline-package"
              value={packageId}
              disabled={formDisabled}
              onChange={(e) => setPackageId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Selecione…</option>
              {(pkgData?.packages ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="timeline-departure" className="text-overline uppercase text-neutral-500">
              Saída
            </Label>
            <Input
              id="timeline-departure"
              data-testid="timeline-departure"
              type="time"
              className="mt-xs"
              value={departure}
              disabled={formDisabled}
              onChange={(e) => setDeparture(e.target.value)}
            />
            <p className="mt-xs text-[12px] text-neutral-500">
              Sugerido a partir de &quot;Pronta até&quot;. Ao confirmar, &quot;Pronta até&quot; passa
              a ser esta saída.
            </p>
          </div>
          <div>
            <Label htmlFor="timeline-label" className="text-overline uppercase text-neutral-500">
              Nome no título
            </Label>
            <Input
              id="timeline-label"
              data-testid="timeline-label"
              className="mt-xs"
              value={brideLabel}
              disabled={formDisabled}
              onChange={(e) => setBrideLabel(e.target.value)}
            />
          </div>
          {latest && (
            <>
              <ProfessionalSelect
                id="timeline-make"
                label="Profissional de make"
                serviceId={makeServiceId}
                value={makeId}
                onChange={setMakeId}
                disabled={formDisabled}
              />
              <ProfessionalSelect
                id="timeline-hair"
                label="Profissional de penteado"
                serviceId={hairServiceId}
                value={hairId}
                onChange={setHairId}
                disabled={formDisabled}
              />
            </>
          )}
        </div>
        {formError && (
          <p role="alert" className="mt-sm text-[12px] font-semibold text-error-600" data-testid="timeline-form-error">
            {formError}
          </p>
        )}
        <div className="mt-sm flex flex-wrap items-center gap-sm">
          <Button
            type="button"
            onClick={() => void generate()}
            disabled={formDisabled || !packageId || !departure || generating}
            data-testid="timeline-generate"
          >
            Gerar simulação
          </Button>
          <p className="text-[12px] text-neutral-500">
            As simulações não ficam salvas ao sair da página.
          </p>
        </div>
      </section>

      <div className="space-y-sm" data-testid="timeline-simulations">
        {simulations.map((sim, i) => (
          <TimelineSimulationCard
            key={sim.key}
            sim={sim.data}
            index={simulations.length - 1 - i}
            canConfirm={canConfirm && active}
            confirming={confirming}
            hasOfficial={official !== null}
            serverConflicts={sim.conflicts}
            serverError={sim.error}
            onConfirm={() => onConfirmClick(sim)}
            onRemove={() => setSimulations((prev) => prev.filter((s) => s.key !== sim.key))}
          />
        ))}
      </div>

      <AlertDialog
        open={pendingConfirm !== null}
        onOpenChange={(o) => {
          if (!o) setPendingConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar e atualizar a agenda?</AlertDialogTitle>
            <AlertDialogDescription>
              Os horários da noiva serão movidos. Acompanhantes que deixarem de caber serão apenas
              sinalizadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="timeline-confirm-update"
              onClick={() => {
                const sim = pendingConfirm;
                setPendingConfirm(null);
                if (sim) void doConfirm(sim);
              }}
            >
              Confirmar e atualizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
