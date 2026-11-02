import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  CreateVisitMutation,
  ProfessionalsForServiceQuery,
  VisitPackagesQuery,
  type CreateVisitResult,
  type ProfessionalsForServiceResult,
  type VisitPackagesResult,
} from '../../api/appointments.api';
import { ClientsListQuery, type ClientsListResult } from '@/features/clients/api/clients.api';
import {
  ServicesQuery,
  type ServiceData,
  type ServicesQueryResult,
} from '@/features/catalog/api/servicos.api';
import { maskCurrency, formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import { maskDateBR, maskTime } from '../../lib/input-masks';
import { PAYMENT_METHODS } from '../../lib/operations-labels';
import {
  buildCreateVisitInput,
  expandPackageLines,
  suggestVariant,
  type VisitLine,
} from '../../lib/visit-form';
import { filterProfessionalsForService, shouldClearProfessional } from '../../professional-filter';
import type { ScheduleProfessional } from './types';

interface LineState {
  serviceId: string;
  variantId: string;
  professionalId: string;
  time: string;
  duration: string;
}

export interface VisitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTime?: { hour: number; minute: number; profId?: string };
  date: Date;
  professionals: ScheduleProfessional[];
  onCreated: (r: { comandaId: string | null; comandaCode: string | null }) => void;
}

const SELECT_CLASS =
  'mt-xs w-full rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white';
const LABEL_CLASS = 'text-xs font-semibold text-neutral-700';

function dateToBr(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function seedTime(initial?: { hour: number; minute: number }): string {
  return initial
    ? `${String(initial.hour).padStart(2, '0')}:${String(initial.minute).padStart(2, '0')}`
    : '';
}

function emptyLine(time: string, professionalId = ''): LineState {
  return { serviceId: '', variantId: '', professionalId, time, duration: '' };
}

interface LineRowProps {
  index: number;
  line: LineState;
  services: ServiceData[];
  professionals: ScheduleProfessional[];
  lockedService: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<LineState>) => void;
  onRemove: () => void;
}

function LineRow({
  index,
  line,
  services,
  professionals,
  lockedService,
  canRemove,
  onChange,
  onRemove,
}: LineRowProps) {
  const { data: forService } = useQuery<ProfessionalsForServiceResult>(
    ProfessionalsForServiceQuery,
    {
      variables: { serviceId: line.serviceId },
      skip: !line.serviceId,
      fetchPolicy: 'cache-and-network',
    },
  );
  const allowedIds = useMemo<string[] | null>(
    () =>
      line.serviceId && forService ? forService.professionalsForService.map((p) => p.id) : null,
    [line.serviceId, forService],
  );
  const visible = filterProfessionalsForService(professionals, allowedIds);
  const service = services.find((s) => s.id === line.serviceId);

  useEffect(() => {
    if (shouldClearProfessional(line.professionalId, allowedIds)) {
      onChange({ professionalId: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedIds, line.professionalId]);

  function applyVariant(variantId: string, current: ServiceData | undefined) {
    const variant = current?.pricingVariants.find((v) => v.id === variantId);
    const minutes = variant?.durationMinutes ?? current?.defaultDurationMinutes;
    onChange({ variantId, ...(minutes ? { duration: String(minutes) } : {}) });
  }

  return (
    <div className="rounded-md border border-neutral-200 p-sm space-y-sm" role="group" aria-label={`Serviço ${index + 1}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
        <div>
          <Label className={LABEL_CLASS} htmlFor={`visit-line-${index}-service`}>
            Serviço
          </Label>
          <select
            id={`visit-line-${index}-service`}
            data-testid={`visit-line-${index}-service`}
            value={line.serviceId}
            disabled={lockedService}
            onChange={(e) => {
              const id = e.target.value;
              const next = services.find((s) => s.id === id);
              onChange({
                serviceId: id,
                variantId: '',
                ...(next ? { duration: String(next.defaultDurationMinutes) } : {}),
              });
            }}
            className={SELECT_CLASS}
          >
            <option value="">Selecione…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className={LABEL_CLASS} htmlFor={`visit-line-${index}-variant`}>
            Variante de preço
          </Label>
          <select
            id={`visit-line-${index}-variant`}
            data-testid={`visit-line-${index}-variant`}
            value={line.variantId}
            onChange={(e) => applyVariant(e.target.value, service)}
            className={SELECT_CLASS}
          >
            <option value="">Preço padrão</option>
            {(service?.pricingVariants ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — R$ {formatCurrencyDisplay(v.price)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_96px_96px_auto] gap-sm items-end">
        <div>
          <Label className={LABEL_CLASS} htmlFor={`visit-line-${index}-professional`}>
            Profissional
          </Label>
          <select
            id={`visit-line-${index}-professional`}
            data-testid={`visit-line-${index}-professional`}
            value={line.professionalId}
            onChange={(e) => {
              const professionalId = e.target.value;
              const tier = professionals.find((p) => p.id === professionalId)?.seniorityTier ?? null;
              const suggested = service
                ? suggestVariant(service.pricingVariants, tier)
                : null;
              onChange({ professionalId });
              if (suggested && !line.variantId) applyVariant(suggested, service);
            }}
            className={SELECT_CLASS}
          >
            <option value="">Selecione…</option>
            {visible.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {allowedIds !== null && visible.length === 0 && (
            <p className="mt-xs text-xs text-neutral-600">
              Nenhum profissional atende a categoria deste serviço.
            </p>
          )}
        </div>
        <div>
          <Label className={LABEL_CLASS} htmlFor={`visit-line-${index}-time`}>
            Hora
          </Label>
          <Input
            id={`visit-line-${index}-time`}
            data-testid={`visit-line-${index}-time`}
            value={line.time}
            onChange={(e) => onChange({ time: maskTime(e.target.value) })}
            placeholder="HH:mm"
            inputMode="numeric"
            maxLength={5}
            className="mt-xs"
          />
        </div>
        <div>
          <Label className={LABEL_CLASS} htmlFor={`visit-line-${index}-duration`}>
            Duração (min)
          </Label>
          <Input
            id={`visit-line-${index}-duration`}
            data-testid={`visit-line-${index}-duration`}
            value={line.duration}
            onChange={(e) => onChange({ duration: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            inputMode="numeric"
            placeholder="60"
            className="mt-xs"
          />
        </div>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Remover serviço ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function VisitFormDialog({
  open,
  onOpenChange,
  initialTime,
  date,
  professionals,
  onCreated,
}: VisitFormDialogProps) {
  const [clientSearch, setClientSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [dateBr, setDateBr] = useState(() => dateToBr(date));
  const [packageId, setPackageId] = useState('');
  const [lines, setLines] = useState<LineState[]>(() => [
    emptyLine(seedTime(initialTime), initialTime?.profId),
  ]);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('pix');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: clientsData } = useQuery<ClientsListResult>(ClientsListQuery, {
    variables: { search: clientSearch || null, limit: 10, offset: 0 },
    skip: !open,
  });
  const { data: servicesData } = useQuery<ServicesQueryResult>(ServicesQuery, { skip: !open });
  const { data: packagesData } = useQuery<VisitPackagesResult>(VisitPackagesQuery, {
    skip: !open,
  });
  const [createVisit, { loading }] = useMutation<CreateVisitResult>(CreateVisitMutation);
  const services = servicesData?.services ?? [];
  const selectedPackage = packagesData?.packages.find((p) => p.id === packageId) ?? null;

  useEffect(() => {
    if (open) {
      setDateBr(dateToBr(date));
      setLines([emptyLine(seedTime(initialTime), initialTime?.profId)]);
      setPackageId('');
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTime]);

  const selectedClient = clientsData?.clients.rows.find((c) => c.id === clientId);

  function reset() {
    setClientSearch('');
    setClientId('');
    setPackageId('');
    setDepositAmount('');
    setDepositMethod('pix');
    setNotes('');
    setError('');
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  function patchLine(i: number, patch: Partial<LineState>) {
    setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function choosePackage(id: string) {
    setPackageId(id);
    const pkg = packagesData?.packages.find((p) => p.id === id);
    if (!pkg) {
      setLines([emptyLine(lines[0]?.time ?? '', lines[0]?.professionalId)]);
      return;
    }
    const expanded = expandPackageLines(
      {
        services: pkg.services.map((s) => ({
          serviceId: s.serviceId,
          quantity: s.quantity,
          defaultDurationMinutes: s.service.defaultDurationMinutes,
        })),
      },
      lines[0]?.time || '09:00',
      lines[0]?.professionalId ?? '',
    );
    setLines(
      expanded.map((l: VisitLine) => ({
        serviceId: l.serviceId,
        variantId: '',
        professionalId: l.professionalId,
        time: l.time,
        duration: String(l.durationMinutes),
      })),
    );
  }

  async function handleSave() {
    setError('');
    const built = buildCreateVisitInput({
      clientId,
      date: dateBr,
      lines: lines.map((l) => ({
        serviceId: l.serviceId,
        variantId: l.variantId || null,
        professionalId: l.professionalId,
        time: l.time,
        durationMinutes: Number(l.duration),
      })),
      packageId: packageId || null,
      depositAmount,
      depositMethod,
      notes,
    });
    if (!built.ok) {
      setError(built.error);
      return;
    }
    try {
      const result = await createVisit({ variables: { input: built.input } });
      const payload = result.data?.createVisit;
      if (!payload || payload.errors.length > 0) {
        setError(payload?.errors[0]?.message ?? 'Não foi possível criar o agendamento.');
        return;
      }
      const comandaCode = payload.appointments.find((a) => a.comandaCode)?.comandaCode ?? null;
      toast.success(
        comandaCode
          ? `Agendamento criado. Comanda ${comandaCode} aberta.`
          : 'Agendamento criado.',
      );
      onCreated({ comandaId: payload.comandaId, comandaCode });
      close();
    } catch {
      setError('Não foi possível criar o agendamento. Tente novamente.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent
        data-testid="visit-form"
        className="max-w-[720px] p-0 max-h-[90vh] flex flex-col"
      >
        <header className="flex items-center justify-between px-md py-md border-b border-neutral-200 bg-neutral-50">
          <DialogTitle className="text-sm font-bold uppercase tracking-wide text-neutral-800">
            Cadastrar agendamento
          </DialogTitle>
          <DialogDescription className="sr-only">
            Informe cliente, serviços, profissionais, horários e o sinal recebido.
          </DialogDescription>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-md py-md space-y-md">
          <div>
            <Label className={LABEL_CLASS} htmlFor="visit-client-search">
              Cliente
            </Label>
            <Input
              id="visit-client-search"
              data-testid="visit-client-search"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setClientId('');
              }}
              placeholder="Buscar cliente…"
              className="mt-xs"
            />
            {clientSearch && !clientId && (
              <div className="mt-xs max-h-32 overflow-y-auto rounded-md border border-neutral-200 bg-white">
                {(clientsData?.clients.rows ?? []).map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    data-testid={`visit-client-option-${client.id}`}
                    onClick={() => {
                      setClientId(client.id);
                      setClientSearch(client.fullName);
                    }}
                    className="block w-full px-sm py-xs text-left text-sm hover:bg-neutral-50"
                  >
                    {client.fullName}
                  </button>
                ))}
              </div>
            )}
            {selectedClient && (
              <p className="mt-xs text-xs text-primary-700">
                Cliente selecionado: {selectedClient.fullName}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <div>
              <Label className={LABEL_CLASS} htmlFor="visit-date">
                Data
              </Label>
              <Input
                id="visit-date"
                data-testid="visit-date"
                value={dateBr}
                onChange={(e) => setDateBr(maskDateBR(e.target.value))}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
                maxLength={10}
                className="mt-xs"
              />
            </div>
            <div>
              <Label className={LABEL_CLASS} htmlFor="visit-package">
                Pacote <span className="font-normal text-neutral-600">(opcional)</span>
              </Label>
              <select
                id="visit-package"
                data-testid="visit-package"
                value={packageId}
                onChange={(e) => choosePackage(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Sem pacote</option>
                {(packagesData?.packages ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-sm">
            {lines.map((line, i) => (
              <LineRow
                key={i}
                index={i}
                line={line}
                services={services}
                professionals={professionals}
                lockedService={selectedPackage !== null}
                canRemove={selectedPackage === null && lines.length > 1}
                onChange={(patch) => patchLine(i, patch)}
                onRemove={() => setLines((cur) => cur.filter((_, idx) => idx !== i))}
              />
            ))}
            {selectedPackage === null && lines.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="visit-add-line"
                className="gap-xs"
                onClick={() =>
                  setLines((cur) => {
                    const last = cur[cur.length - 1];
                    return [...cur, emptyLine('', last?.professionalId)];
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Adicionar serviço
              </Button>
            )}
          </div>

          <fieldset className="rounded-md border border-neutral-200 p-sm">
            <legend className="px-xs text-xs font-semibold text-neutral-700">
              Sinal recebido (opcional)
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
              <div>
                <Label className={LABEL_CLASS} htmlFor="visit-deposit-amount">
                  Valor
                </Label>
                <div className="relative mt-xs">
                  <span className="absolute left-sm top-1/2 -translate-y-1/2 text-sm text-neutral-600">
                    R$
                  </span>
                  <Input
                    id="visit-deposit-amount"
                    data-testid="visit-deposit-amount"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(maskCurrency(e.target.value))}
                    inputMode="numeric"
                    placeholder="0,00"
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <Label className={LABEL_CLASS} htmlFor="visit-deposit-method">
                  Forma de pagamento
                </Label>
                <select
                  id="visit-deposit-method"
                  data-testid="visit-deposit-method"
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value)}
                  className={SELECT_CLASS}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-xs text-xs text-neutral-600">
              O sinal fica como crédito do cliente e é usado no fechamento da comanda.
            </p>
          </fieldset>

          <div>
            <Label className={LABEL_CLASS} htmlFor="visit-notes">
              Observações <span className="font-normal text-neutral-600">(opcional)</span>
            </Label>
            <Textarea
              id="visit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 400))}
              rows={3}
              className="mt-xs resize-none"
              placeholder="Preferências do cliente, alergias, observações…"
            />
          </div>

          {error && (
            <p role="alert" data-testid="visit-error" className="text-sm text-error-600">
              {error}
            </p>
          )}
        </div>
        <footer className="flex justify-end gap-xs px-md py-md border-t border-neutral-200 bg-neutral-50">
          <Button variant="outline" size="sm" onClick={close}>
            Cancelar
          </Button>
          <Button size="sm" data-testid="visit-submit" disabled={loading} onClick={handleSave}>
            {loading ? 'Salvando…' : 'Salvar'}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
