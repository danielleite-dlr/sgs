import { useState, useMemo } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  Search,
  Eye,
  EyeOff,
  Clock,
  HelpCircle,
  X,
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
  { id: 'absent',     label: 'Ausência de profissional',           color: '#888780' },
  { id: 'awaiting',   label: 'Aguardando confirmação',             color: '#EF9F27' },
  { id: 'confirmed',  label: 'Confirmado',                          color: '#5D54C7' },
  { id: 'no_show',    label: 'Cliente não compareceu',              color: '#D85A30' },
  { id: 'in_progress',label: 'Em atendimento',                     color: '#1D9E75' },
  { id: 'completed',  label: 'Finalizado',                          color: '#3C3489' },
  { id: 'cancelled',  label: 'Cancelado',                           color: '#999592' },
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
}

function FilterPanel(props: FilterPanelProps) {
  return (
    <aside className="flex flex-col gap-md">
      {/* Calendar */}
      <InlineCalendar selected={props.selectedDate} onSelect={props.onSelectDate} />

      {/* Profissionais — chips */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-sm">
          Profissionais
        </h3>
        <div className="flex flex-wrap gap-xs">
          <button
            type="button"
            onClick={() => {
              if (props.visibleProfIds.size === props.professionals.length) {
                // hide all
                props.professionals.forEach((p) => props.onToggleProf(p.id));
              } else {
                // show all
                props.professionals.forEach((p) => {
                  if (!props.visibleProfIds.has(p.id)) props.onToggleProf(p.id);
                });
              }
            }}
            className={cn(
              'px-sm py-xs rounded-full text-xs border transition-colors',
              props.visibleProfIds.size === props.professionals.length
                ? 'bg-primary-500 text-white border-primary-500'
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
                  'px-sm py-xs rounded-full text-xs border transition-colors flex items-center gap-xs',
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
      </section>

      {/* Status do Agendamento — chips coloridos */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-sm">
          Status do agendamento
        </h3>
        <div className="flex flex-col gap-xs">
          {APPT_STATUSES.map((s) => {
            const active = props.activeStatuses.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => props.onToggleStatus(s.id)}
                className={cn(
                  'flex items-center gap-sm px-sm py-xs rounded-md text-xs border transition-colors text-left',
                  active
                    ? 'border-primary-300 bg-primary-50 text-neutral-800 font-medium'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="flex-1 truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Fechamento de Conta */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-sm">
          Fechamento de conta
        </h3>
        <div className="flex gap-xs">
          {(['all', 'open', 'closed'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => props.onChangeClosing(opt)}
              className={cn(
                'px-md py-xs rounded-full text-xs border transition-colors',
                props.closingFilter === opt
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50',
              )}
            >
              {opt === 'all' ? 'Todas' : opt === 'open' ? 'Aberta' : 'Fechada'}
            </button>
          ))}
        </div>
      </section>

      {/* Tamanho da agenda */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-sm">
          Tamanho da agenda
        </h3>
        <div className="space-y-sm">
          <div>
            <Label className="text-xs text-neutral-600">Linha</Label>
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
            <Label className="text-xs text-neutral-600">Coluna</Label>
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
      </section>

      {/* Mostrar folga */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-sm">
          Exibição da agenda
        </h3>
        <RadioGroup
          value={props.showFolga ? 'yes' : 'no'}
          onValueChange={(v) => props.onChangeShowFolga(v === 'yes')}
          className="flex gap-md"
        >
          <label className="flex items-center gap-xs cursor-pointer">
            <RadioGroupItem value="yes" id="folga-yes" />
            <span className="text-xs text-neutral-700">Mostrar folga</span>
          </label>
          <label className="flex items-center gap-xs cursor-pointer">
            <RadioGroupItem value="no" id="folga-no" />
            <span className="text-xs text-neutral-700">Ocultar</span>
          </label>
        </RadioGroup>
      </section>
    </aside>
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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSeed, setModalSeed] = useState<{ hour: number; minute: number; profId?: string } | undefined>();

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
    />
  );

  return (
    <div className="flex flex-col gap-md">
      {/* TOP BAR — avatares + data + ações */}
      <div className="flex flex-col gap-sm">
        {/* Linha 1 — Profissionais (avatares + olho) */}
        <div className="flex items-center gap-sm overflow-x-auto pb-xs">
          {MOCK_PROFESSIONALS.map((pro) => {
            const visible = visibleProfIds.has(pro.id);
            return (
              <button
                key={pro.id}
                type="button"
                onClick={() => toggleProf(pro.id)}
                className={cn(
                  'flex flex-col items-center gap-xs shrink-0 transition-opacity',
                  !visible && 'opacity-40',
                )}
                aria-label={`${pro.name} — ${visible ? 'visível' : 'oculto'}`}
              >
                <div className="relative">
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{ backgroundColor: pro.color }}
                  >
                    {pro.initials}
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white border border-neutral-200 flex items-center justify-center">
                    {visible ? (
                      <Eye className="h-3 w-3 text-neutral-600" />
                    ) : (
                      <EyeOff className="h-3 w-3 text-neutral-400" />
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-neutral-700 max-w-[64px] truncate">
                  {pro.name.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Linha 2 — Navegador data + +Agendar + filtros + busca */}
        <div className="flex flex-wrap items-center gap-sm">
          <div className="flex items-center gap-xs">
            <Button variant="ghost" size="icon" onClick={() => shiftDay(-1)} aria-label="Dia anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              type="button"
              className="text-sm font-semibold text-neutral-800 capitalize px-sm hover:bg-neutral-50 rounded-md py-xs"
            >
              {formatDateLong(selectedDate)}
            </button>
            <Button variant="ghost" size="icon" onClick={() => shiftDay(1)} aria-label="Próximo dia">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            size="sm"
            className="gap-xs"
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

          <div className="relative flex-1 min-w-[180px] max-w-[280px] ml-auto">
            <Search className="absolute left-sm top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar clientes agendados…"
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* BODY — sidebar + grid */}
      <div className="flex gap-md">
        {/* Sidebar desktop */}
        <div className="hidden lg:block w-[280px] shrink-0">{filterPanel}</div>

        {/* Mobile drawer */}
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="right" className="w-[320px] p-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-left">Filtros</SheetTitle>
            </SheetHeader>
            <div className="mt-md">{filterPanel}</div>
          </SheetContent>
        </Sheet>

        {/* GRID */}
        <div className="flex-1 min-w-0 border border-neutral-200 rounded-lg overflow-hidden bg-white">
          {/* Header profs */}
          <div
            className="grid border-b border-neutral-200 bg-neutral-50 sticky top-0 z-10"
            style={{
              gridTemplateColumns: `64px repeat(${visibleProfs.length}, ${COL_WIDTHS[colSize]})`,
            }}
          >
            <div className="p-sm border-r border-neutral-200" />
            {visibleProfs.map((pro) => (
              <div
                key={pro.id}
                className="p-sm border-r border-neutral-200 last:border-r-0 flex items-center gap-xs"
              >
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                  style={{ backgroundColor: pro.color }}
                >
                  {pro.initials}
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-700 truncate">
                  {pro.name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>

          {/* Time + appts */}
          <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
            <div
              className="grid relative"
              style={{
                gridTemplateColumns: `64px repeat(${visibleProfs.length}, ${COL_WIDTHS[colSize]})`,
              }}
            >
              {/* Time column */}
              <div className="border-r border-neutral-200">
                {TIME_SLOTS.map((slot) => (
                  <div
                    key={`${slot.hour}-${slot.minute}`}
                    className="border-b border-neutral-100 flex items-start justify-end pr-sm pt-xs"
                    style={{ height: slotHeight }}
                  >
                    {slot.minute === 0 && (
                      <span className="text-xs text-neutral-500 font-mono">{slot.label}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Pro columns */}
              {visibleProfs.map((pro) => (
                <div
                  key={pro.id}
                  className="border-r border-neutral-200 last:border-r-0 relative"
                  style={{ height: TIME_SLOTS.length * slotHeight }}
                >
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
              ))}
            </div>
          </div>
        </div>
      </div>

      <AppointmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialTime={modalSeed}
      />
    </div>
  );
}
