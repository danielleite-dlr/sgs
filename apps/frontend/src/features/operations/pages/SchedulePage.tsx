import { useState, useMemo } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  SlidersHorizontal,
  Search,
  Eye,
  EyeOff,
  Clock,
  HelpCircle,
  X,
  Users,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MOCK_PROFESSIONALS,
  MOCK_APPOINTMENTS,
  getMockWeekDays,
  TIME_SLOTS,
  type MockAppointment,
  type MockProfessional,
} from '../mocks/schedule.mock';
import { cn } from '@/lib/utils';

// ─── Types & constants ────────────────────────────────────────────────────────

const APPT_STATUSES = [
  { id: 'absent',     label: 'Ausência de profissional',            color: '#D9D9D9', textOnColor: '#5C5C5C' },
  { id: 'awaiting',   label: 'Aguardando Confirmação do Estabelecimento', color: '#EF9F27', textOnColor: '#FFFFFF' },
  { id: 'confirmed',  label: 'Confirmado',                          color: '#1D9E75', textOnColor: '#FFFFFF' },
  { id: 'no_show',    label: 'Cliente não compareceu',              color: '#3F3F3F', textOnColor: '#FFFFFF' },
  { id: 'in_progress',label: 'Em atendimento',                     color: '#28A89F', textOnColor: '#FFFFFF' },
  { id: 'completed',  label: 'Finalizado',                          color: '#5D54C7', textOnColor: '#FFFFFF' },
  { id: 'cancelled',  label: 'Cancelado',                           color: '#FBE4E4', textOnColor: '#A03A3A' },
] as const;

type DensitySize = 'PP' | 'P' | 'M' | 'G';
const DENSITY_VALUES: DensitySize[] = ['PP', 'P', 'M', 'G'];

const ROW_HEIGHTS: Record<DensitySize, number> = { PP: 32, P: 40, M: 48, G: 64 };
const COL_WIDTHS: Record<DensitySize, string> = {
  PP: 'minmax(96px,1fr)',
  P:  'minmax(120px,1fr)',
  M:  'minmax(160px,1fr)',
  G:  'minmax(220px,1fr)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLong(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });
}

function getAppointmentStyle(appt: MockAppointment, slotHeight: number): React.CSSProperties {
  const startOffset = (appt.startHour - 8) * 2 + appt.startMinute / 30;
  const top = startOffset * slotHeight;
  const height = (appt.durationMinutes / 30) * slotHeight - 4;
  return {
    top: `${top}px`,
    height: `${height}px`,
    backgroundColor: appt.categoryColor + '22',
    borderLeft: `3px solid ${appt.categoryColor}`,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface InlineCalendarProps {
  selected: Date;
  onSelect: (d: Date) => void;
}

function InlineCalendar({ selected, onSelect }: InlineCalendarProps) {
  const [viewDate, setViewDate] = useState(new Date(selected));
  const monthLabel = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ date: Date | null; isCurrent: boolean }> = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null, isCurrent: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({
      date,
      isCurrent: date.toDateString() === selected.toDateString(),
    });
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-sm">
      <header className="flex items-center justify-between mb-sm">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mês anterior"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold capitalize text-neutral-800">{monthLabel}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Próximo mês"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </header>
      <div className="grid grid-cols-7 gap-px text-[11px] text-neutral-400 mb-xs">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((w, i) => (
          <span key={i} className="text-center">{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((c, i) => {
          if (!c.date) return <span key={i} className="h-7" />;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(c.date!)}
              className={cn(
                'h-7 w-7 mx-auto rounded-full text-xs flex items-center justify-center transition-colors',
                c.isCurrent
                  ? 'bg-primary-500 text-white font-semibold'
                  : 'text-neutral-700 hover:bg-neutral-50',
              )}
            >
              {c.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface FilterPanelProps {
  professionals: MockProfessional[];
  visibleProfIds: Set<string>;
  onToggleProf: (id: string) => void;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  activeStatuses: Set<string>;
  onToggleStatus: (id: string) => void;
  closingFilter: 'all' | 'open' | 'closed';
  onChangeClosing: (v: 'all' | 'open' | 'closed') => void;
  rowSize: DensitySize;
  colSize: DensitySize;
  onChangeRow: (v: DensitySize) => void;
  onChangeCol: (v: DensitySize) => void;
  showFolga: boolean;
  onChangeShowFolga: (v: boolean) => void;
  onOpenBuscarAgendar: () => void;
  onOpenSelecaoProf: () => void;
}

function FilterPanel(props: FilterPanelProps) {
  return (
    <aside className="flex flex-col gap-md">
      {/* Calendar */}
      <InlineCalendar selected={props.selectedDate} onSelect={props.onSelectDate} />

      {/* Ações rápidas — Buscar e Agendar / Seleção de Profissionais */}
      <div className="flex flex-col gap-xs">
        <button
          type="button"
          onClick={props.onOpenBuscarAgendar}
          className="flex items-center gap-sm px-sm py-xs rounded-md border border-primary-200 text-sm text-neutral-700 hover:bg-primary-50 transition-colors text-left"
        >
          <span className="h-6 w-6 rounded-md bg-primary-500 text-white flex items-center justify-center shrink-0">
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <span className="flex-1">Buscar e Agendar</span>
        </button>
        <button
          type="button"
          onClick={props.onOpenSelecaoProf}
          className="flex items-center gap-sm px-sm py-xs rounded-md border border-primary-200 text-sm text-neutral-700 hover:bg-primary-50 transition-colors text-left"
        >
          <span className="h-6 w-6 rounded-md bg-primary-700 text-white flex items-center justify-center shrink-0">
            <Users className="h-3.5 w-3.5" />
          </span>
          <span className="flex-1">Seleção de Profissionais</span>
        </button>
      </div>

      {/* Nome do profissional — chips */}
      <CollapsibleSection title="Nome do profissional">
        <div className="flex flex-wrap gap-xs">
          <button
            type="button"
            onClick={() => {
              if (props.visibleProfIds.size === props.professionals.length) {
                props.professionals.forEach((p) => props.onToggleProf(p.id));
              } else {
                props.professionals.forEach((p) => {
                  if (!props.visibleProfIds.has(p.id)) props.onToggleProf(p.id);
                });
              }
            }}
            className={cn(
              'px-sm py-xs rounded-full text-xs border transition-colors',
              props.visibleProfIds.size === props.professionals.length
                ? 'bg-neutral-800 text-white border-neutral-800'
                : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50',
            )}
          >
            Todos
          </button>
          {props.professionals.map((pro) => {
            const visible = props.visibleProfIds.has(pro.id);
            return (
              <button
                key={pro.id}
                type="button"
                onClick={() => props.onToggleProf(pro.id)}
                className={cn(
                  'h-7 w-7 rounded-full text-xs font-semibold border transition-colors flex items-center justify-center',
                  visible
                    ? 'text-white border-transparent'
                    : 'bg-white text-neutral-500 border-neutral-300 hover:bg-neutral-50',
                )}
                style={visible ? { backgroundColor: pro.color } : undefined}
                aria-label={`${pro.name} — ${visible ? 'visível' : 'oculto'}`}
              >
                {pro.initials}
              </button>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Status do Agendamento — pílulas coloridas full-width */}
      <CollapsibleSection title="Status do Agendamento">
        <div className="flex flex-col gap-xs">
          {APPT_STATUSES.map((s) => {
            const active = props.activeStatuses.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => props.onToggleStatus(s.id)}
                className={cn(
                  'rounded-full px-sm py-xs text-[11px] font-medium text-center transition-opacity border',
                  active ? 'opacity-100 border-transparent' : 'opacity-50 border-neutral-200 bg-white text-neutral-600',
                )}
                style={
                  active
                    ? { backgroundColor: s.color, color: s.textOnColor }
                    : undefined
                }
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Fechamento de Conta */}
      <CollapsibleSection title="Fechamento de Conta">
        <div className="flex gap-xs">
          {(['open', 'closed'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                props.onChangeClosing(props.closingFilter === opt ? 'all' : opt)
              }
              className={cn(
                'px-md py-xs rounded-full text-xs border transition-colors',
                props.closingFilter === opt
                  ? 'bg-neutral-800 text-white border-neutral-800'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50',
              )}
            >
              {opt === 'open' ? 'Aberta' : 'Fechada'}
            </button>
          ))}
        </div>
      </CollapsibleSection>

      {/* Tamanho da agenda */}
      <CollapsibleSection title="Tamanho da agenda">
        <div className="space-y-sm">
          <div>
            <Label className="text-xs text-neutral-600">Linha:</Label>
            <RadioGroup
              value={props.rowSize}
              onValueChange={(v) => props.onChangeRow(v as DensitySize)}
              className="flex gap-sm mt-xs"
            >
              {DENSITY_VALUES.map((v) => (
                <label key={v} className="flex items-center gap-xs cursor-pointer">
                  <RadioGroupItem value={v} id={`row-${v}`} />
                  <span className="text-xs text-neutral-700">{v}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label className="text-xs text-neutral-600">Coluna:</Label>
            <RadioGroup
              value={props.colSize}
              onValueChange={(v) => props.onChangeCol(v as DensitySize)}
              className="flex gap-sm mt-xs"
            >
              {DENSITY_VALUES.map((v) => (
                <label key={v} className="flex items-center gap-xs cursor-pointer">
                  <RadioGroupItem value={v} id={`col-${v}`} />
                  <span className="text-xs text-neutral-700">{v}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>
      </CollapsibleSection>

      {/* Mostrar folga */}
      <CollapsibleSection title="Exibição da agenda">
        <Label className="text-xs text-neutral-600 mb-xs block">Mostrar folga:</Label>
        <RadioGroup
          value={props.showFolga ? 'yes' : 'no'}
          onValueChange={(v) => props.onChangeShowFolga(v === 'yes')}
          className="flex gap-md"
        >
          <label className="flex items-center gap-xs cursor-pointer">
            <RadioGroupItem value="yes" id="folga-yes" />
            <span className="text-xs text-neutral-700">Sim</span>
          </label>
          <label className="flex items-center gap-xs cursor-pointer">
            <RadioGroupItem value="no" id="folga-no" />
            <span className="text-xs text-neutral-700">Não</span>
          </label>
        </RadioGroup>
      </CollapsibleSection>
    </aside>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-neutral-200 pb-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center justify-between w-full text-sm font-semibold text-neutral-800 mb-sm"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn('h-4 w-4 text-neutral-500 transition-transform', !open && '-rotate-90')}
        />
      </button>
      {open && children}
    </section>
  );
}

// ─── Buscar e Agendar Modal ───────────────────────────────────────────────────

function BuscarAgendarModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const [client, setClient] = useState('');
  const [date, setDate] = useState(todayStr);
  const dayOfWeek = today.toLocaleDateString('pt-BR', { weekday: 'long' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] p-0">
        <header className="flex items-center justify-between px-md py-sm border-b border-neutral-200 bg-neutral-50">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-800">
            Buscar e Agendar
          </h2>
          <div className="flex items-center gap-sm">
            <span className="text-xs font-semibold text-primary-700 uppercase">
              Hoje — {dayOfWeek}
            </span>
            <div className="relative">
              <CalendarDays className="absolute left-sm top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                value={date}
                onChange={(e) => setDate(maskDateBR(e.target.value))}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
                maxLength={10}
                className="pl-9 h-8 w-[120px] text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="px-md py-md space-y-md">
          {/* Cliente */}
          <div>
            <Label className="text-xs font-semibold text-neutral-700">Cliente:</Label>
            <div className="flex gap-xs mt-xs">
              <div className="flex-1 relative">
                <Search className="absolute left-sm top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Buscar cliente…"
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon" aria-label="Novo cliente">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Serviço + Profissional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <div>
              <Label className="text-xs font-semibold text-neutral-700">Serviço:</Label>
              <select className="mt-xs w-full rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white h-9">
                <option value="">Selecione…</option>
                <option>Corte feminino</option>
                <option>Hidratação</option>
                <option>Manicure</option>
                <option>Coloração</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-neutral-700">Profissional:</Label>
              <select className="mt-xs w-full rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white h-9">
                <option value="">Selecione…</option>
                {MOCK_PROFESSIONALS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Pesquisar Horários */}
          <div>
            <Button className="gap-xs">
              <Search className="h-4 w-4" />
              Pesquisar Horários
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Seleção de Profissionais Modal ───────────────────────────────────────────

function SelecaoProfissionaisModal({
  open,
  onOpenChange,
  visibleProfIds,
  onChangeVisible,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visibleProfIds: Set<string>;
  onChangeVisible: (next: Set<string>) => void;
}) {
  const [localVisible, setLocalVisible] = useState<Set<string>>(new Set(visibleProfIds));
  const [categoriasAll, setCategoriasAll] = useState(true);
  const [cabelo, setCabelo] = useState(true);

  const allChecked = localVisible.size === MOCK_PROFESSIONALS.length;

  function toggleProf(id: string) {
    const next = new Set(localVisible);
    if (next.has(id)) next.delete(id); else next.add(id);
    setLocalVisible(next);
  }

  function toggleAll() {
    if (allChecked) setLocalVisible(new Set());
    else setLocalVisible(new Set(MOCK_PROFESSIONALS.map((p) => p.id)));
  }

  function handleSelect() {
    onChangeVisible(localVisible);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] p-0">
        <header className="flex items-center justify-between px-md py-sm border-b border-neutral-200 bg-neutral-50">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-800">
            Selecione os profissionais que você deseja visualizar na sua agenda
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="px-md py-md space-y-md">
          {/* Categoria de Serviço */}
          <section className="rounded-md border border-neutral-200 overflow-hidden">
            <header className="bg-primary-700 text-white px-md py-xs flex items-center gap-xs">
              <ChevronRight className="h-3 w-3" />
              <h3 className="text-sm font-semibold">Categoria de Serviço</h3>
            </header>
            <div className="p-md grid grid-cols-2 gap-sm">
              <label className="flex items-center gap-xs text-sm text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={categoriasAll}
                  onChange={(e) => {
                    setCategoriasAll(e.target.checked);
                    setCabelo(e.target.checked);
                  }}
                  className="rounded border-neutral-300"
                />
                Todas as Categorias
              </label>
              <label className="flex items-center gap-xs text-sm text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cabelo}
                  onChange={(e) => setCabelo(e.target.checked)}
                  className="rounded border-neutral-300"
                />
                Cabelo
              </label>
            </div>
          </section>

          {/* Profissionais */}
          <section className="rounded-md border border-neutral-200 overflow-hidden">
            <header className="bg-primary-700 text-white px-md py-xs">
              <h3 className="text-sm font-semibold">Profissionais</h3>
            </header>
            <div className="p-md grid grid-cols-1 sm:grid-cols-2 gap-sm">
              <label className="flex items-center gap-xs text-sm text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="rounded border-neutral-300"
                />
                Todos os Profissionais
              </label>
              {MOCK_PROFESSIONALS.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-xs text-sm text-neutral-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={localVisible.has(p.id)}
                    onChange={() => toggleProf(p.id)}
                    className="rounded border-neutral-300"
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-between gap-md">
            <p className="text-xs text-error-500">
              * em vermelho profissionais de folga no dia da agenda
            </p>
            <Button onClick={handleSelect}>Selecionar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface AppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTime?: { hour: number; minute: number; profId?: string };
}

interface ChainedService {
  id: string;
  professional: string;
  service: string;
  duration: string;
  value: string;
}

function maskTime(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function maskDateBR(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function maskCurrencyBR(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  const cents = padded.slice(-2);
  const reais = padded.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
  const reaisFormatted = reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${reaisFormatted},${cents}`;
}

function AppointmentModal({ open, onOpenChange, initialTime }: AppointmentModalProps) {
  const [client, setClient] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  });
  const [time, setTime] = useState(() => {
    if (initialTime) return `${String(initialTime.hour).padStart(2, '0')}:${String(initialTime.minute).padStart(2, '0')}`;
    return '';
  });
  const [duration, setDuration] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [chained, setChained] = useState<ChainedService[]>([]);

  const notesCount = notes.length;

  function handleClose() {
    setClient('');
    setTime('');
    setDuration('');
    setValue('');
    setNotes('');
    setChained([]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] p-0 max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between px-md py-md border-b border-neutral-200 bg-neutral-50">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-800">
            Cadastrar agendamento
          </h2>
          <div className="flex items-center gap-xs">
            <Button variant="ghost" size="icon" aria-label="Ajuda">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Fechar">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-md py-md space-y-md">
          {/* Cliente */}
          <div>
            <Label className="text-xs font-semibold text-neutral-700">Cliente</Label>
            <div className="flex gap-xs mt-xs">
              <div className="flex-1 relative">
                <Search className="absolute left-sm top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Buscar cliente…"
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon" aria-label="Novo cliente">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-xs rounded-md bg-primary-50 border border-primary-100 px-sm py-xs text-xs text-primary-700">
              Busque por nome, e-mail, telefone ou CPF completo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <div>
              <Label className="text-xs font-semibold text-neutral-700">Profissional</Label>
              <select className="mt-xs w-full rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white">
                <option value="">Selecione…</option>
                {MOCK_PROFESSIONALS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-neutral-700">Serviço</Label>
              <select className="mt-xs w-full rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white">
                <option value="">Selecione…</option>
                <option>Corte feminino</option>
                <option>Hidratação</option>
                <option>Manicure</option>
                <option>Coloração</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
            <div>
              <Label className="text-xs font-semibold text-neutral-700">Data</Label>
              <div className="mt-xs flex gap-xs">
                <div className="flex-1 relative">
                  <CalendarDays className="absolute left-sm top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    value={date}
                    onChange={(e) => setDate(maskDateBR(e.target.value))}
                    placeholder="dd/mm/aaaa"
                    inputMode="numeric"
                    maxLength={10}
                    className="pl-9"
                  />
                </div>
                <button
                  type="button"
                  className="rounded-full px-sm py-xs text-xs border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                  onClick={() => {
                    const t = new Date();
                    setDate(`${String(t.getDate()).padStart(2,'0')}/${String(t.getMonth()+1).padStart(2,'0')}/${t.getFullYear()}`);
                  }}
                >
                  Hoje
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-neutral-700">Hora</Label>
              <div className="relative mt-xs">
                <Clock className="absolute left-sm top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  value={time}
                  onChange={(e) => setTime(maskTime(e.target.value))}
                  placeholder="HH:mm"
                  inputMode="numeric"
                  maxLength={5}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-neutral-700">Duração (min)</Label>
              <Input
                value={duration}
                onChange={(e) => setDuration(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="60"
                className="mt-xs"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-neutral-700">Valor (R$)</Label>
            <Input
              value={value}
              onChange={(e) => setValue(maskCurrencyBR(e.target.value))}
              placeholder="0,00"
              inputMode="numeric"
              className="mt-xs"
            />
          </div>

          {/* Encadeamento */}
          {chained.length > 0 && (
            <div className="rounded-md border border-neutral-200 p-sm space-y-xs">
              <p className="text-xs font-semibold text-neutral-600 uppercase">Serviços encadeados</p>
              {chained.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between text-xs text-neutral-700">
                  <span>{i + 2}. {c.service} — {c.duration}min — R$ {c.value}</span>
                  <button
                    type="button"
                    onClick={() => setChained((arr) => arr.filter((x) => x.id !== c.id))}
                    aria-label="Remover serviço encadeado"
                    className="text-neutral-400 hover:text-error-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-xs">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() =>
                setChained((arr) => [
                  ...arr,
                  { id: `c${Date.now()}`, professional: '', service: '', duration: '', value: '' },
                ])
              }
            >
              <Plus className="h-3 w-3 mr-xs" /> + Serviço
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() =>
                setChained((arr) => [
                  ...arr,
                  { id: `c${Date.now()}`, professional: '(mesmo)', service: '', duration: '', value: '' },
                ])
              }
            >
              <Plus className="h-3 w-3 mr-xs" /> + Serviço (mesmo profissional)
            </Button>
          </div>

          {/* Observações */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-neutral-700">
                Observações <span className="font-normal text-neutral-400">(opcional)</span>
              </Label>
              <span className="text-xs text-neutral-400">{notesCount} de 400 caracteres</span>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => {
                if (e.target.value.length <= 400) setNotes(e.target.value);
              }}
              rows={3}
              className="mt-xs resize-none"
              placeholder="Preferências do cliente, alergias, observações…"
            />
          </div>
        </div>

        <footer className="flex items-center justify-between px-md py-md border-t border-neutral-200 bg-neutral-50">
          <button
            type="button"
            className="text-xs text-primary-500 hover:text-primary-700 font-medium"
            onClick={handleClose}
          >
            Salvar e fechar conta
          </button>
          <div className="flex gap-xs">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleClose}>
              Salvar
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SchedulePage() {
  const weekDays = getMockWeekDays();
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const selectedDate = weekDays[selectedDayIdx] ?? weekDays[0];

  const [visibleProfIds, setVisibleProfIds] = useState<Set<string>>(
    () => new Set(MOCK_PROFESSIONALS.map((p) => p.id)),
  );
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    () => new Set(APPT_STATUSES.map((s) => s.id)),
  );
  const [closingFilter, setClosingFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [rowSize, setRowSize] = useState<DensitySize>('M');
  const [colSize, setColSize] = useState<DensitySize>('M');
  const [showFolga, setShowFolga] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSeed, setModalSeed] = useState<{ hour: number; minute: number; profId?: string } | undefined>();
  const [buscarAgendarOpen, setBuscarAgendarOpen] = useState(false);
  const [selecaoProfOpen, setSelecaoProfOpen] = useState(false);

  // Working hours: 9h–19h (expediente). 8h slot and 19h+ slots are "fora-expediente".
  const WORK_START_HOUR = 9;
  const WORK_END_HOUR = 19;

  const visibleProfs = useMemo(
    () => MOCK_PROFESSIONALS.filter((p) => visibleProfIds.has(p.id)),
    [visibleProfIds],
  );

  const dayAppointments = useMemo(() => {
    return MOCK_APPOINTMENTS.filter((a) => {
      if (a.dayOfWeek !== selectedDayIdx) return false;
      if (!visibleProfIds.has(a.professionalId)) return false;
      if (searchQuery && !a.clientName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [selectedDayIdx, visibleProfIds, searchQuery]);

  function toggleProf(id: string) {
    setVisibleProfIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleStatus(id: string) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openModalAt(hour: number, minute: number, profId?: string) {
    setModalSeed({ hour, minute, profId });
    setModalOpen(true);
  }

  function shiftDay(delta: number) {
    setSelectedDayIdx((idx) => Math.max(0, Math.min(weekDays.length - 1, idx + delta)));
  }

  const slotHeight = ROW_HEIGHTS[rowSize];

  // Filter content shared between desktop sidebar and mobile drawer
  const filterPanel = (
    <FilterPanel
      professionals={MOCK_PROFESSIONALS}
      visibleProfIds={visibleProfIds}
      onToggleProf={toggleProf}
      selectedDate={selectedDate}
      onSelectDate={(d) => {
        const idx = weekDays.findIndex((w) => w.toDateString() === d.toDateString());
        if (idx >= 0) setSelectedDayIdx(idx);
      }}
      activeStatuses={activeStatuses}
      onToggleStatus={toggleStatus}
      closingFilter={closingFilter}
      onChangeClosing={setClosingFilter}
      rowSize={rowSize}
      colSize={colSize}
      onChangeRow={setRowSize}
      onChangeCol={setColSize}
      showFolga={showFolga}
      onChangeShowFolga={setShowFolga}
      onOpenBuscarAgendar={() => setBuscarAgendarOpen(true)}
      onOpenSelecaoProf={() => setSelecaoProfOpen(true)}
    />
  );

  // Now-line: hour/min as fraction of 8h-21h day → top offset
  const now = new Date();
  const nowMinutesFromStart = (now.getHours() - 8) * 60 + now.getMinutes();
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const nowLineTop = (nowMinutesFromStart / 30) * slotHeight;

  // Fora-expediente bands: pixel ranges within the grid
  const beforeWorkHeight = (WORK_START_HOUR - 8) * 2 * slotHeight;
  const afterWorkTop = (WORK_END_HOUR - 8) * 2 * slotHeight;
  const afterWorkHeight = (21 - WORK_END_HOUR) * 2 * slotHeight;

  return (
    <div className="flex h-[calc(100vh-7rem)] lg:h-[calc(100vh-5rem)] -mx-md lg:-mx-lg -my-md lg:-my-lg">
      {/* Sidebar Agenda — colapsável */}
      {!sidebarCollapsed && (
        <aside className="hidden lg:flex w-[280px] shrink-0 border-r border-neutral-200 bg-white overflow-y-auto p-md flex-col">
          {filterPanel}
        </aside>
      )}

      {/* Toggle botão entre sidebar e grid */}
      <button
        type="button"
        onClick={() => setSidebarCollapsed((v) => !v)}
        aria-label={sidebarCollapsed ? 'Mostrar filtros' : 'Ocultar filtros'}
        className="hidden lg:flex h-8 w-6 self-start mt-md -ml-3 z-20 items-center justify-center rounded-r-md border border-l-0 border-neutral-200 bg-white text-primary-500 hover:bg-primary-50 shadow-sm"
      >
        {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
      </button>

      {/* Mobile filtros drawer */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="w-[320px] p-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left">Filtros</SheetTitle>
          </SheetHeader>
          <div className="mt-md">{filterPanel}</div>
        </SheetContent>
      </Sheet>

      {/* MAIN — top bar + grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-neutral-50/30">
        {/* TOP BAR */}
        <div className="flex items-center gap-sm px-md py-sm border-b border-neutral-200 bg-white shrink-0 flex-wrap">
          {/* Date navigator */}
          <div className="flex items-center gap-xs">
            <Button variant="ghost" size="icon" onClick={() => shiftDay(-1)} aria-label="Dia anterior" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              type="button"
              className="flex flex-col items-center px-sm leading-tight hover:bg-neutral-50 rounded-md py-xs min-w-[120px]"
            >
              <span className="text-sm font-bold text-neutral-800">
                {selectedDate.getDate()} {selectedDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')} {selectedDate.getFullYear()}
              </span>
              <span className="text-[11px] text-neutral-500 capitalize">
                {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
              </span>
            </button>
            <Button variant="ghost" size="icon" onClick={() => shiftDay(1)} aria-label="Próximo dia" className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-[320px]">
            <Search className="absolute left-sm top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar clientes agendados hoje"
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* +Agendar */}
          <Button
            size="sm"
            className="gap-xs bg-error-500 hover:bg-error-700 text-white"
            onClick={() => {
              setModalSeed(undefined);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Agendar
          </Button>

          {/* Filtros (mobile) */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setFiltersOpen(true)}
            aria-label="Filtros"
            className="lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          {/* Cluster avatares + Pgto Indica — alinhado à direita */}
          <div className="flex items-center gap-xs ml-auto">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mostrar/ocultar profissionais"
              className="h-8 w-8 text-neutral-500"
              onClick={() => {
                const allVisible = visibleProfIds.size === MOCK_PROFESSIONALS.length;
                if (allVisible) {
                  setVisibleProfIds(new Set([MOCK_PROFESSIONALS[0]?.id].filter(Boolean) as string[]));
                } else {
                  setVisibleProfIds(new Set(MOCK_PROFESSIONALS.map((p) => p.id)));
                }
              }}
            >
              {visibleProfIds.size === MOCK_PROFESSIONALS.length ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
            <div className="flex items-center -space-x-2">
              {MOCK_PROFESSIONALS.slice(0, 4).map((pro) => {
                const visible = visibleProfIds.has(pro.id);
                return (
                  <button
                    key={pro.id}
                    type="button"
                    onClick={() => toggleProf(pro.id)}
                    title={pro.name}
                    className={cn(
                      'h-8 w-8 rounded-full ring-2 ring-white flex items-center justify-center text-white text-xs font-semibold transition-opacity',
                      !visible && 'opacity-30',
                    )}
                    style={{ backgroundColor: pro.color }}
                  >
                    {pro.initials}
                  </button>
                );
              })}
              {MOCK_PROFESSIONALS.length > 4 && (
                <span className="h-8 w-8 rounded-full ring-2 ring-white bg-neutral-200 text-neutral-600 text-xs font-semibold flex items-center justify-center">
                  +{MOCK_PROFESSIONALS.length - 4}
                </span>
              )}
            </div>
            {/* Pgto Indica indicator */}
            <div className="hidden sm:flex items-center gap-xs px-sm py-xs rounded-md bg-warning-50 border border-warning-200">
              <AlertCircle className="h-3.5 w-3.5 text-warning-600" />
              <span className="text-[11px] font-medium text-warning-700 leading-none">Pgto<br />Indica</span>
            </div>
          </div>
        </div>

        {/* GRID — single scroll container */}
        <div className="flex-1 overflow-auto">
          <div className="bg-white border border-neutral-200 m-md rounded-lg overflow-hidden">
            {/* Header profs */}
            <div
              className="grid border-b border-neutral-200 bg-white sticky top-0 z-10"
              style={{
                gridTemplateColumns: `64px repeat(${Math.max(visibleProfs.length, 1)}, ${COL_WIDTHS[colSize]})`,
              }}
            >
              <div className="p-sm border-r border-neutral-200" />
              {visibleProfs.length === 0 ? (
                <div className="p-md text-xs text-neutral-500">
                  Nenhum profissional selecionado.
                </div>
              ) : (
                visibleProfs.map((pro) => (
                  <div
                    key={pro.id}
                    className="px-sm py-md border-r border-neutral-200 last:border-r-0 flex items-center gap-sm"
                  >
                    <div
                      className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 shrink-0 overflow-hidden"
                    >
                      <div
                        className="h-full w-full rounded-full flex items-center justify-center text-white text-xs font-semibold"
                        style={{ backgroundColor: pro.color }}
                      >
                        {pro.initials}
                      </div>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 truncate">
                      {pro.name.split(' ')[0]}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Time + appts */}
            <div
              className="grid relative"
              style={{
                gridTemplateColumns: `64px repeat(${Math.max(visibleProfs.length, 1)}, ${COL_WIDTHS[colSize]})`,
              }}
            >
              {/* Time column */}
              <div className="border-r border-neutral-200 relative">
                {TIME_SLOTS.map((slot, i) => (
                  <div
                    key={`${slot.hour}-${slot.minute}`}
                    className="border-b border-neutral-100 flex items-center justify-end pr-sm"
                    style={{ height: slotHeight }}
                  >
                    {slot.minute === 0 && (
                      <span className="text-xs text-neutral-500 font-medium">
                        {slot.hour}h
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Pro columns */}
              {visibleProfs.length === 0 ? (
                <div
                  className="border-r border-neutral-200 relative bg-neutral-50/40"
                  style={{ height: TIME_SLOTS.length * slotHeight }}
                />
              ) : (
                visibleProfs.map((pro) => (
                  <div
                    key={pro.id}
                    className="border-r border-neutral-200 last:border-r-0 relative"
                    style={{ height: TIME_SLOTS.length * slotHeight }}
                  >
                    {/* Fora-expediente bands */}
                    {beforeWorkHeight > 0 && (
                      <div
                        className="absolute left-0 right-0 bg-info-50 pointer-events-none"
                        style={{ top: 0, height: beforeWorkHeight, backgroundColor: '#DDE7F3' }}
                        aria-label="Fora do expediente"
                      />
                    )}
                    {afterWorkHeight > 0 && (
                      <div
                        className="absolute left-0 right-0 pointer-events-none"
                        style={{ top: afterWorkTop, height: afterWorkHeight, backgroundColor: '#DDE7F3' }}
                        aria-label="Fora do expediente"
                      />
                    )}

                    {/* Slots clicáveis */}
                    {TIME_SLOTS.map((slot, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => openModalAt(slot.hour, slot.minute, pro.id)}
                        className={cn(
                          'absolute w-full border-b text-left',
                          slot.minute === 0
                            ? 'border-neutral-200'
                            : 'border-neutral-100 border-dashed',
                          'hover:bg-primary-50/30',
                        )}
                        style={{ top: i * slotHeight, height: slotHeight }}
                        aria-label={`Cadastrar agendamento às ${slot.label} para ${pro.name}`}
                      />
                    ))}

                    {/* Agendamentos */}
                    <TooltipProvider delayDuration={200}>
                      {dayAppointments
                        .filter((a) => a.professionalId === pro.id)
                        .map((appt) => (
                          <Tooltip key={appt.id}>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute left-1 right-1 rounded-md px-xs py-xs cursor-pointer hover:brightness-95 transition-all overflow-hidden z-10"
                                style={getAppointmentStyle(appt, slotHeight)}
                              >
                                <p className="text-xs font-semibold text-neutral-800 truncate leading-tight">
                                  {appt.clientName}
                                </p>
                                <p className="text-xs text-neutral-600 truncate leading-tight">
                                  {appt.service}
                                </p>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm space-y-xs">
                                <p className="font-semibold">{appt.clientName}</p>
                                <p className="text-neutral-600">{appt.service}</p>
                                <p className="text-neutral-500 text-xs">
                                  {String(appt.startHour).padStart(2, '0')}:
                                  {String(appt.startMinute).padStart(2, '0')}
                                  {' '}— {appt.durationMinutes} min
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                    </TooltipProvider>
                  </div>
                ))
              )}

              {/* Now-line — só hoje, dentro do expediente */}
              {isToday && nowLineTop > 0 && nowLineTop < TIME_SLOTS.length * slotHeight && (
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                  style={{ top: nowLineTop }}
                >
                  <span className="h-2 w-2 rounded-full bg-error-500 ml-[60px]" />
                  <div className="flex-1 h-px bg-error-500" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer institucional (estilo Trinks) */}
        <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md px-md py-md border-t border-neutral-200 bg-white text-xs text-neutral-500">
          <nav className="flex flex-wrap items-center gap-x-md gap-y-xs" aria-label="Links institucionais">
            <a className="hover:text-primary-500 transition-colors" href="#">Meu site</a>
            <span className="text-neutral-300">|</span>
            <a className="hover:text-primary-500 transition-colors" href="#">SGS Ajuda</a>
            <span className="text-neutral-300">|</span>
            <a className="hover:text-primary-500 transition-colors" href="#">Blog</a>
            <span className="text-neutral-300">|</span>
            <a className="hover:text-primary-500 transition-colors" href="#">Fale conosco</a>
            <span className="text-neutral-300">|</span>
            <a className="hover:text-primary-500 transition-colors" href="#">Contato</a>
          </nav>
          <div className="flex items-center gap-sm">
            {[
              { label: 'Facebook', icon: 'F' },
              { label: 'Instagram', icon: 'IG' },
              { label: 'YouTube', icon: 'YT' },
            ].map((s) => (
              <span
                key={s.label}
                aria-label={s.label}
                className="h-7 w-7 rounded-full border border-neutral-300 flex items-center justify-center text-[10px] text-neutral-500 hover:border-primary-300 hover:text-primary-500 transition-colors"
              >
                {s.icon}
              </span>
            ))}
          </div>
        </footer>
      </div>

      <AppointmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialTime={modalSeed}
      />

      <BuscarAgendarModal
        open={buscarAgendarOpen}
        onOpenChange={setBuscarAgendarOpen}
      />

      <SelecaoProfissionaisModal
        open={selecaoProfOpen}
        onOpenChange={setSelecaoProfOpen}
        visibleProfIds={visibleProfIds}
        onChangeVisible={setVisibleProfIds}
      />
    </div>
  );
}
