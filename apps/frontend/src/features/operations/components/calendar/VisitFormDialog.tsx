import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import { AlertCircle, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FIELD_LABEL_CLASS, NATIVE_SELECT_CLASS } from '@/lib/field-classes';
import { toDisplayName } from '@/lib/format-name';
import { formatPhoneBr } from '@/lib/format-phone';
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
import {
  ClientsListQuery,
  CreateClientMutation,
  type ClientsListResult,
  type CreateClientResult,
} from '@/features/clients/api/clients.api';
import { maskBrPhone, normalizeBrPhone } from '@/features/identity/member-validation';
import { useHasPermission } from '../../operations-permissions';
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

const SELECT_CLASS = `${NATIVE_SELECT_CLASS} mt-xs`;
const LABEL_CLASS = FIELD_LABEL_CLASS;
const OPTIONAL_CLASS = 'normal-case font-normal tracking-normal';
// D-20: até 4 profissionais a escolha vira controle segmentado; acima disso, select.
const SEGMENTED_MAX = 4;

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
  dateField?: ReactNode;
  onChange: (patch: Partial<LineState>) => void;
  onRemove: () => void;
}

interface ProfessionalSegmentedProps {
  index: number;
  options: ScheduleProfessional[];
  value: string;
  onPick: (professionalId: string) => void;
}

// Controle segmentado de profissional (D-20) com o padrão radiogroup do WAI-ARIA:
// tabIndex móvel e setas com volta (WCAG 2.1 AA).
function ProfessionalSegmented({ index, options, value, onPick }: ProfessionalSegmentedProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const anyChecked = options.some((p) => p.id === value);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;
    e.preventDefault();
    const current = refs.current.findIndex((el) => el === document.activeElement);
    const from = current >= 0 ? current : Math.max(0, options.findIndex((p) => p.id === value));
    const next = (from + step + options.length) % options.length;
    onPick(options[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Profissional"
      id={`visit-line-${index}-professional`}
      data-testid={`visit-line-${index}-professional`}
      onKeyDown={onKeyDown}
      className="mt-xs grid gap-1 rounded-md border border-neutral-200 bg-neutral-100 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((p, i) => {
        const sel = p.id === value;
        return (
          <button
            key={p.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={sel}
            tabIndex={sel || (!anyChecked && i === 0) ? 0 : -1}
            title={p.name}
            data-testid={`visit-line-${index}-professional-${p.id}`}
            onClick={() => onPick(p.id)}
            className={cn(
              'min-h-[44px] truncate rounded-md px-sm text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              sel
                ? 'bg-primary font-semibold text-white'
                : 'bg-transparent text-neutral-600 hover:bg-white',
            )}
          >
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

function LineRow({
  index,
  line,
  services,
  professionals,
  lockedService,
  canRemove,
  dateField,
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
  const segmented = visible.length > 0 && visible.length <= SEGMENTED_MAX;

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

  function chooseProfessional(professionalId: string) {
    const tier = professionals.find((p) => p.id === professionalId)?.seniorityTier ?? null;
    const suggested = service ? suggestVariant(service.pricingVariants, tier) : null;
    onChange({ professionalId });
    if (suggested && !line.variantId) applyVariant(suggested, service);
  }

  const timeField = (
    <div className={dateField ? 'col-span-6 sm:col-span-4' : 'col-span-6'}>
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
        className="mt-xs tabular-nums"
      />
    </div>
  );
  const durationField = (
    <div className={dateField ? 'col-span-6 sm:col-span-3' : 'col-span-6'}>
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
        className="mt-xs tabular-nums"
      />
    </div>
  );

  return (
    <div
      className="rounded-md border border-neutral-200 bg-white p-sm space-y-sm"
      role="group"
      aria-label={`Serviço ${index + 1}`}
    >
      <div className="flex items-end gap-sm">
        <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 gap-sm">
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
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={onRemove}
            aria-label={`Remover serviço ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div>
        {segmented ? (
          <>
            <span className={cn(LABEL_CLASS, 'block')} aria-hidden="true">
              Profissional
            </span>
            <ProfessionalSegmented
              index={index}
              options={visible}
              value={line.professionalId}
              onPick={chooseProfessional}
            />
          </>
        ) : (
          <>
            <Label className={LABEL_CLASS} htmlFor={`visit-line-${index}-professional`}>
              Profissional
            </Label>
            <select
              id={`visit-line-${index}-professional`}
              data-testid={`visit-line-${index}-professional`}
              value={line.professionalId}
              onChange={(e) => chooseProfessional(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Selecione…</option>
              {visible.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </>
        )}
        {allowedIds !== null && visible.length === 0 && (
          <p className="mt-xs text-[12px] leading-4 text-neutral-500">
            Nenhum profissional atende a categoria deste serviço.
          </p>
        )}
      </div>
      <div
        data-testid={dateField ? 'visit-when' : undefined}
        className="grid grid-cols-12 gap-sm"
      >
        {dateField}
        {timeField}
        {durationField}
      </div>
    </div>
  );
}

interface ServiceChip {
  name: string;
  price: string | null;
}

function serviceChips(lines: LineState[], services: ServiceData[]): ServiceChip[] {
  return lines.flatMap((l) => {
    const s = services.find((x) => x.id === l.serviceId);
    if (!s) return [];
    const variant = s.pricingVariants.find((v) => v.id === l.variantId);
    const price = variant?.price ?? s.basePrice;
    return [{ name: s.name, price: price ? formatCurrencyDisplay(price) : null }];
  });
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
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientError, setNewClientError] = useState('');
  const canCreateClient = useHasPermission('client.write');
  const [dateBr, setDateBr] = useState(() => dateToBr(date));
  const [packageId, setPackageId] = useState('');
  const [lines, setLines] = useState<LineState[]>(() => [
    emptyLine(seedTime(initialTime), initialTime?.profId),
  ]);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('pix');
  // D-20: "Sinal" começa recolhido; abre sozinho se já houver valor preenchido.
  const [depositOpen, setDepositOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  // UX-03: no celular, avisa que há mais campos até o corpo chegar ao fim.
  const [atBottom, setAtBottom] = useState(false);
  const updateAtBottom = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 8);
  }, []);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const { data: clientsData } = useQuery<ClientsListResult>(ClientsListQuery, {
    variables: { search: clientSearch || null, limit: 10, offset: 0 },
    skip: !open,
  });
  const { data: servicesData } = useQuery<ServicesQueryResult>(ServicesQuery, { skip: !open });
  const { data: packagesData } = useQuery<VisitPackagesResult>(VisitPackagesQuery, {
    skip: !open,
  });
  const [createVisit, { loading }] = useMutation<CreateVisitResult>(CreateVisitMutation);
  const [createClient, { loading: creatingClient }] = useMutation<CreateClientResult>(
    CreateClientMutation,
    { refetchQueries: ['ClientsList'] },
  );
  const services = servicesData?.services ?? [];
  const selectedPackage = packagesData?.packages.find((p) => p.id === packageId) ?? null;

  useEffect(() => {
    if (open) {
      setDateBr(dateToBr(date));
      setLines([emptyLine(seedTime(initialTime), initialTime?.profId)]);
      setPackageId('');
      setError('');
      setDepositOpen(depositAmount !== '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTime]);

  // Remede o aviso de rolagem quando o conteúdo do corpo muda de altura.
  useEffect(() => {
    if (open) updateAtBottom(bodyRef.current);
  }, [open, lines.length, packageId, newClientOpen, error, depositOpen, updateAtBottom]);

  const clientRows = clientsData?.clients.rows ?? [];
  const selectedClient = clientId
    ? { id: clientId, fullName: clientName, phone: clientPhone }
    : null;
  const chips = serviceChips(lines, services);
  const depositLabel = PAYMENT_METHODS.find((m) => m.value === depositMethod)?.label ?? '';

  function pickClient(id: string, fullName: string, phone: string | null) {
    setClientId(id);
    setClientName(fullName);
    setClientPhone(phone ?? '');
    setClientSearch(fullName);
  }

  function openNewClient() {
    setNewClientOpen(true);
    setNewClientName(clientSearch.trim());
    setNewClientPhone('');
    setNewClientError('');
  }

  async function handleCreateClient() {
    setNewClientError('');
    const fullName = newClientName.trim();
    if (fullName.length < 2) {
      setNewClientError('Informe o nome do cliente.');
      return;
    }
    const phone = normalizeBrPhone(newClientPhone);
    if (!phone) {
      setNewClientError('Informe um telefone válido com DDD.');
      return;
    }
    try {
      const result = await createClient({ variables: { input: { fullName, phone } } });
      const payload = result.data?.createClient;
      if (!payload?.client || payload.errors.length > 0) {
        setNewClientError(payload?.errors[0]?.message ?? 'Não foi possível cadastrar o cliente.');
        return;
      }
      pickClient(payload.client.id, payload.client.fullName, payload.client.phone);
      setNewClientOpen(false);
      toast.success('Cliente cadastrado.');
    } catch {
      setNewClientError('Não foi possível cadastrar o cliente.');
    }
  }

  function reset() {
    setClientSearch('');
    setClientId('');
    setClientName('');
    setClientPhone('');
    setNewClientOpen(false);
    setNewClientName('');
    setNewClientPhone('');
    setNewClientError('');
    setPackageId('');
    setDepositAmount('');
    setDepositMethod('pix');
    setDepositOpen(false);
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

  const dateField = (
    <div className="col-span-12 sm:col-span-5">
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
        className="mt-xs tabular-nums"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent
        data-testid="visit-form"
        className="max-w-[720px] gap-0 max-sm:gap-0 sm:gap-0 p-0 max-sm:p-0 sm:p-0 max-sm:border-0 h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[90vh] sm:rounded-md flex flex-col"
      >
        <header className="flex items-start justify-between gap-sm px-md py-md pr-14 border-b border-neutral-200 bg-white">
          <div className="min-w-0">
            <DialogTitle className="font-serif text-headline-md text-neutral-800">
              Cadastrar agendamento
            </DialogTitle>
            <DialogDescription className="text-[12px] leading-4 text-neutral-500">
              Preencha os detalhes do atendimento
            </DialogDescription>
          </div>
        </header>
        <div
          ref={bodyRef}
          data-testid="visit-form-body"
          onScroll={(e) => updateAtBottom(e.currentTarget)}
          className="flex-1 min-h-0 overflow-y-auto px-md py-md space-y-md"
        >
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
            {clientSearch && !clientId && !newClientOpen && (
              <div className="mt-xs max-h-48 overflow-y-auto rounded-md border border-neutral-200 bg-white">
                {clientRows.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    data-testid={`visit-client-option-${client.id}`}
                    onClick={() => pickClient(client.id, client.fullName, client.phone)}
                    className="flex min-h-[44px] w-full items-center justify-between gap-sm px-sm text-left text-body text-neutral-800 hover:bg-neutral-50"
                  >
                    <span className="truncate">{toDisplayName(client.fullName)}</span>
                    {client.phone && (
                      <span className="shrink-0 text-[12px] tabular-nums text-neutral-500">
                        {formatPhoneBr(client.phone)}
                      </span>
                    )}
                  </button>
                ))}
                {clientsData && clientRows.length === 0 && (
                  <p
                    data-testid="visit-client-empty"
                    className="px-sm py-sm text-body text-neutral-500"
                  >
                    Nenhum cliente encontrado.
                  </p>
                )}
                {canCreateClient && (
                  <button
                    type="button"
                    data-testid="visit-client-new"
                    onClick={openNewClient}
                    className="flex min-h-[44px] w-full items-center gap-xs border-t border-neutral-200 px-sm text-left text-body font-semibold text-primary hover:bg-neutral-50"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Cadastrar cliente
                  </button>
                )}
              </div>
            )}
            {!clientSearch && !clientId && !newClientOpen && canCreateClient && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="mt-xs min-h-[44px] px-0"
                data-testid="visit-client-new-empty"
                onClick={openNewClient}
              >
                <Plus className="mr-xs h-4 w-4" aria-hidden="true" />
                Cadastrar novo cliente
              </Button>
            )}
            {newClientOpen && (
              <div
                data-testid="visit-new-client"
                className="mt-xs space-y-sm rounded-md border border-neutral-200 bg-neutral-100 p-sm"
              >
                <p className="text-label text-neutral-800">Novo cliente</p>
                <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                  <div>
                    <Label className={LABEL_CLASS} htmlFor="visit-new-client-name">
                      Nome
                    </Label>
                    <Input
                      id="visit-new-client-name"
                      data-testid="visit-new-client-name"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Nome completo"
                      className="mt-xs"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label className={LABEL_CLASS} htmlFor="visit-new-client-phone">
                      Telefone (WhatsApp)
                    </Label>
                    <Input
                      id="visit-new-client-phone"
                      data-testid="visit-new-client-phone"
                      type="tel"
                      inputMode="tel"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(maskBrPhone(e.target.value))}
                      placeholder="(11) 98765-4321"
                      className="mt-xs"
                    />
                  </div>
                </div>
                {newClientError && (
                  <p
                    data-testid="visit-new-client-error"
                    role="alert"
                    className="text-[12px] leading-4 font-semibold text-error-600"
                  >
                    {newClientError}
                  </p>
                )}
                <div className="flex justify-end gap-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewClientOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    data-testid="visit-new-client-submit"
                    disabled={creatingClient}
                    onClick={handleCreateClient}
                  >
                    {creatingClient ? 'Salvando…' : 'Salvar cliente'}
                  </Button>
                </div>
              </div>
            )}
            {selectedClient && (
              <p
                data-testid="visit-client-selected"
                className="mt-xs flex min-h-[44px] items-center gap-xs rounded-md bg-neutral-100 px-sm"
              >
                <span className="sr-only">Cliente selecionado: </span>
                <span className="truncate font-serif text-[15px] font-semibold text-neutral-800">
                  {toDisplayName(selectedClient.fullName)}
                </span>
                {selectedClient.phone && (
                  <span className="shrink-0 text-[12px] tabular-nums text-neutral-500">
                    {' · '}
                    {formatPhoneBr(selectedClient.phone)}
                  </span>
                )}
              </p>
            )}
          </div>

          <section className="space-y-sm" aria-label="Serviços">
            <div className="flex items-center justify-between gap-sm">
              <span className={LABEL_CLASS}>Serviço</span>
              <span className="text-overline text-primary-500" data-testid="visit-service-count">
                {chips.length} {chips.length === 1 ? 'selecionado' : 'selecionados'}
              </span>
            </div>
            <div data-testid="visit-service-chips" className="flex flex-wrap items-center gap-1.5">
              {chips.map((chip, i) => (
                <span
                  key={i}
                  data-testid={`visit-service-chip-${i}`}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-100 px-3 text-[12px] font-semibold text-neutral-800"
                >
                  {chip.name}
                  {chip.price && (
                    <span className="whitespace-nowrap text-[11px] font-normal tabular-nums text-neutral-500">
                      R$ {chip.price}
                    </span>
                  )}
                </span>
              ))}
              {selectedPackage === null && lines.length < 10 && (
                <button
                  type="button"
                  data-testid="visit-add-line"
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-dashed border-neutral-200 bg-white px-3 text-label text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() =>
                    setLines((cur) => {
                      const last = cur[cur.length - 1];
                      return [...cur, emptyLine('', last?.professionalId)];
                    })
                  }
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Adicionar serviço
                </button>
              )}
            </div>
            {lines.map((line, i) => (
              <LineRow
                key={i}
                index={i}
                line={line}
                services={services}
                professionals={professionals}
                lockedService={selectedPackage !== null}
                canRemove={selectedPackage === null && lines.length > 1}
                dateField={i === 0 ? dateField : undefined}
                onChange={(patch) => patchLine(i, patch)}
                onRemove={() => setLines((cur) => cur.filter((_, idx) => idx !== i))}
              />
            ))}
          </section>

          {error && (
            <p
              role="alert"
              data-testid="visit-error"
              className="flex items-start gap-xs text-[12px] leading-4 font-semibold text-error-600"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <div>
            <Label className={LABEL_CLASS} htmlFor="visit-package">
              Pacote <span className={OPTIONAL_CLASS}>(opcional)</span>
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

          <section className="rounded-md border border-neutral-200 bg-neutral-100">
            <button
              type="button"
              data-testid="visit-deposit-toggle"
              aria-expanded={depositOpen}
              aria-controls="visit-deposit-content"
              onClick={() => setDepositOpen((o) => !o)}
              className="flex min-h-[44px] w-full items-center justify-between gap-sm rounded-md px-sm text-left text-label text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 truncate">
                Sinal <span className="font-normal text-neutral-500">(opcional)</span>
                {depositAmount && (
                  <span className="font-normal text-neutral-500">
                    {': '}
                    <span className="font-semibold tabular-nums text-neutral-800">
                      R$ {depositAmount}
                    </span>{' '}
                    por {depositLabel}
                  </span>
                )}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-neutral-500 transition-transform',
                  depositOpen && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </button>
            {depositOpen && (
              <div
                id="visit-deposit-content"
                className="space-y-xs border-t border-neutral-200 px-sm pb-sm pt-sm"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                  <div>
                    <Label className={LABEL_CLASS} htmlFor="visit-deposit-amount">
                      Valor
                    </Label>
                    <div className="relative mt-xs">
                      <span className="absolute left-sm top-1/2 -translate-y-1/2 text-body text-neutral-500">
                        R$
                      </span>
                      <Input
                        id="visit-deposit-amount"
                        data-testid="visit-deposit-amount"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(maskCurrency(e.target.value))}
                        inputMode="numeric"
                        placeholder="0,00"
                        className="pl-9 tabular-nums"
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
                <p className="text-[12px] leading-4 text-neutral-500">
                  O sinal fica como crédito do cliente e é usado no fechamento da comanda.
                </p>
              </div>
            )}
          </section>

          <div>
            <Label className={LABEL_CLASS} htmlFor="visit-notes">
              Observações <span className={OPTIONAL_CLASS}>(opcional)</span>
            </Label>
            <Textarea
              id="visit-notes"
              data-testid="visit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 400))}
              rows={3}
              className="mt-xs resize-none"
              placeholder="Preferências do cliente, alergias, observações…"
            />
          </div>

          <div
            data-testid="visit-scroll-hint"
            aria-hidden="true"
            className={cn(
              'sticky bottom-0 -mx-md -mb-md border-t border-neutral-200 bg-white py-xs text-center text-[12px] leading-4 text-neutral-500 pointer-events-none sm:hidden',
              atBottom && 'hidden',
            )}
          >
            Role para ver mais campos
          </div>
        </div>
        <footer className="flex gap-sm px-md py-sm border-t border-neutral-200 bg-white sm:justify-end">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={close}>
            Cancelar
          </Button>
          <Button
            data-testid="visit-submit"
            className="flex-1 sm:flex-none"
            disabled={loading}
            onClick={handleSave}
          >
            {loading ? 'Salvando…' : 'Salvar'}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
