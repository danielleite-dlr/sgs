import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Ban,
  SlidersHorizontal,
  Search,
  Eye,
  EyeOff,
  X,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AppointmentsQuery,
  TimeBlocksQuery,
  DeleteTimeBlockMutation,
  type DeleteTimeBlockResult,
  type TimeBlockData,
  type TimeBlocksQueryResult,
  type AppointmentsQueryResult,
} from "../api/appointments.api";
import {
  MembersQuery,
  type MemberData,
  type MembersQueryResult,
} from "@/features/catalog/api/members.api";
import { cn } from "@/lib/utils";
import { NATIVE_SELECT_CLASS } from "@/lib/field-classes";
import { useAuthStore } from "@/infrastructure/stores/auth.store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppointmentDetailsDialog } from "../components/calendar/AppointmentDetailsDialog";
import { TimeBlockDialog } from "../components/calendar/TimeBlockDialog";
import { TIME_BLOCK_KINDS } from "../lib/operations-labels";
import { formatHM } from "../components/calendar/types";
import { VisitFormDialog } from "../components/calendar/VisitFormDialog";
import { DayGrid } from "../components/calendar/DayGrid";
import { WeekGrid } from "../components/calendar/WeekGrid";
import { maskDateBR } from "../lib/input-masks";
import { weekRange } from "../lib/week-range";
import { shortProfessionalName } from "../lib/professional-label";
import {
  APPT_STATUSES,
  HIDDEN_STATUSES,
} from "../components/calendar/appointment-statuses";
import {
  PROFESSIONAL_COLORS,
  type ScheduleProfessional,
} from "../components/calendar/types";
import {
  canWriteAppointments,
  seesOnlyOwnAppointments,
} from "../schedule-permissions";

// ─── Types & constants ────────────────────────────────────────────────────────


type DensitySize = "PP" | "P" | "M" | "G";
const DENSITY_VALUES: DensitySize[] = ["PP", "P", "M", "G"];

const ROW_HEIGHTS: Record<DensitySize, number> = {
  PP: 32,
  P: 40,
  M: 48,
  G: 64,
};
const COL_WIDTHS: Record<DensitySize, string> = {
  PP: "minmax(96px,1fr)",
  P: "minmax(120px,1fr)",
  M: "minmax(160px,1fr)",
  G: "minmax(220px,1fr)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dayRange(date: Date) {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface InlineCalendarProps {
  selected: Date;
  onSelect: (d: Date) => void;
}

export function InlineCalendar({ selected, onSelect }: InlineCalendarProps) {
  const [viewDate, setViewDate] = useState(new Date(selected));
  const rawMonthLabel = viewDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const monthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ date: Date | null; isCurrent: boolean }> = [];
  for (let i = 0; i < startWeekday; i++)
    cells.push({ date: null, isCurrent: false });
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
        <span className="font-serif text-[15px] font-semibold text-neutral-800">
          {monthLabel}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Próximo mês"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </header>
      <div className="grid grid-cols-7 gap-px text-[11px] font-semibold text-neutral-500 mb-xs">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((w, i) => (
          <span key={i} className="text-center">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((c, i) => {
          if (!c.date) return <span key={i} className="h-8" />;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(c.date!)}
              className={cn(
                "h-8 w-8 mx-auto rounded-md text-xs tabular-nums flex items-center justify-center transition-colors",
                c.isCurrent
                  ? "bg-primary text-white font-semibold"
                  : "text-neutral-800 hover:bg-neutral-50",
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
  professionals: ScheduleProfessional[];
  visibleProfIds: Set<string>;
  onToggleProf: (id: string) => void;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  activeStatuses: Set<string>;
  onToggleStatus: (id: string) => void;
  closingFilter: "all" | "open" | "closed";
  onChangeClosing: (v: "all" | "open" | "closed") => void;
  rowSize: DensitySize;
  colSize: DensitySize;
  onChangeRow: (v: DensitySize) => void;
  onChangeCol: (v: DensitySize) => void;
  showFolga: boolean;
  onChangeShowFolga: (v: boolean) => void;
  onOpenBuscarAgendar: () => void;
  onOpenSelecaoProf: () => void;
  onOpenBlock: () => void;
  canSchedule: boolean;
  canSelectProfessionals: boolean;
}

const QUICK_ACTION_CLASS =
  "flex min-h-[44px] items-center gap-sm rounded-md border border-neutral-200 bg-white px-sm text-left text-label text-neutral-800 transition-colors hover:bg-neutral-50";

function FilterPanel(props: FilterPanelProps) {
  return (
    <aside className="flex flex-col gap-md">
      {/* Calendar */}
      <InlineCalendar
        selected={props.selectedDate}
        onSelect={props.onSelectDate}
      />

      {/* Ações rápidas — Buscar e Agendar / Bloquear / Seleção de Profissionais */}
      <div className="flex flex-col gap-xs">
        {props.canSchedule && (
          <button
            type="button"
            onClick={props.onOpenBuscarAgendar}
            className={QUICK_ACTION_CLASS}
          >
            <CalendarDays aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-500" />
            <span className="flex-1">Buscar e Agendar</span>
          </button>
        )}
        {props.canSchedule && (
          <button
            type="button"
            onClick={props.onOpenBlock}
            className={QUICK_ACTION_CLASS}
          >
            <Ban aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-500" />
            <span className="flex-1">Bloquear horário</span>
          </button>
        )}
        {props.canSelectProfessionals && (
          <button
            type="button"
            onClick={props.onOpenSelecaoProf}
            className={QUICK_ACTION_CLASS}
          >
            <Users aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-500" />
            <span className="flex-1">Seleção de Profissionais</span>
          </button>
        )}
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
              "min-h-[44px] shrink-0 px-md rounded-md text-label border transition-colors",
              props.visibleProfIds.size === props.professionals.length
                ? "bg-primary text-white border-primary"
                : "bg-white text-neutral-800 border-neutral-200 hover:bg-neutral-50",
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
                  "h-11 w-11 shrink-0 rounded-md text-xs font-semibold border transition-colors flex items-center justify-center",
                  visible
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50",
                )}
                aria-pressed={visible}
                aria-label={`${pro.name} — ${visible ? "visível" : "oculto"}`}
              >
                {pro.initials}
              </button>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Status do Agendamento — selos de 6 px com ponto na cor do status (D-11) */}
      <CollapsibleSection title="Status do Agendamento">
        <div className="flex flex-col gap-xs">
          {APPT_STATUSES.map((s) => {
            const active = props.activeStatuses.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => props.onToggleStatus(s.id)}
                className={cn(
                  "flex min-h-[44px] items-center gap-xs rounded-md border px-sm text-left text-[12px] font-semibold transition-colors",
                  active
                    ? "border-neutral-200 bg-neutral-50 text-neutral-800"
                    : "border-dashed border-neutral-200 bg-white text-neutral-500 line-through",
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.id === "absent" ? "#6B7280" : s.color }}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Fechamento de Conta */}
      <CollapsibleSection title="Fechamento de Conta">
        <div className="flex gap-xs">
          {(["open", "closed"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                props.onChangeClosing(props.closingFilter === opt ? "all" : opt)
              }
              className={cn(
                "min-h-[44px] px-md rounded-md text-label border transition-colors",
                props.closingFilter === opt
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-neutral-800 border-neutral-200 hover:bg-neutral-50",
              )}
            >
              {opt === "open" ? "Aberta" : "Fechada"}
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
                <label
                  key={v}
                  className="flex items-center gap-xs cursor-pointer"
                >
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
                <label
                  key={v}
                  className="flex items-center gap-xs cursor-pointer"
                >
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
        <Label className="text-xs text-neutral-600 mb-xs block">
          Mostrar folga:
        </Label>
        <RadioGroup
          value={props.showFolga ? "yes" : "no"}
          onValueChange={(v) => props.onChangeShowFolga(v === "yes")}
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
        className="flex min-h-[44px] items-center justify-between w-full text-overline uppercase text-neutral-500"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-neutral-500 transition-transform",
            !open && "-rotate-90",
          )}
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
  professionals,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionals: ScheduleProfessional[];
}) {
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
  const [client, setClient] = useState("");
  const [date, setDate] = useState(todayStr);
  const dayOfWeek = today.toLocaleDateString("pt-BR", { weekday: "long" });

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
            <Label className="text-xs font-semibold text-neutral-700">
              Cliente:
            </Label>
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
              <Label className="text-xs font-semibold text-neutral-700">
                Serviço:
              </Label>
              <select className={cn(NATIVE_SELECT_CLASS, "mt-xs")}>
                <option value="">Selecione…</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-neutral-700">
                Profissional:
              </Label>
              <select className={cn(NATIVE_SELECT_CLASS, "mt-xs")}>
                <option value="">Selecione…</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
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
  professionals,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visibleProfIds: Set<string>;
  onChangeVisible: (next: Set<string>) => void;
  professionals: ScheduleProfessional[];
}) {
  const [localVisible, setLocalVisible] = useState<Set<string>>(
    new Set(visibleProfIds),
  );
  const [categoriasAll, setCategoriasAll] = useState(true);
  const [cabelo, setCabelo] = useState(true);

  const allChecked = localVisible.size === professionals.length;

  function toggleProf(id: string) {
    const next = new Set(localVisible);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setLocalVisible(next);
  }

  function toggleAll() {
    if (allChecked) setLocalVisible(new Set());
    else setLocalVisible(new Set(professionals.map((p) => p.id)));
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
            <header className="bg-neutral-100 border-b border-neutral-200 px-md py-xs flex items-center gap-xs">
              <ChevronRight className="h-3 w-3 text-neutral-500" />
              <h3 className="text-overline uppercase text-neutral-500">Categoria de Serviço</h3>
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
            <header className="bg-neutral-100 border-b border-neutral-200 px-md py-xs">
              <h3 className="text-overline uppercase text-neutral-500">Profissionais</h3>
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
              {professionals.map((p) => (
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

// ─── Main page ────────────────────────────────────────────────────────────────

export function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState<"day" | "week">("day");
  const [visibleProfIds, setVisibleProfIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    () => new Set(APPT_STATUSES.map((s) => s.id)),
  );
  const [closingFilter, setClosingFilter] = useState<"all" | "open" | "closed">(
    "all",
  );
  const [rowSize, setRowSize] = useState<DensitySize>("M");
  const [colSize, setColSize] = useState<DensitySize>("M");
  const [showFolga, setShowFolga] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSeed, setModalSeed] = useState<
    { hour: number; minute: number; profId?: string } | undefined
  >();
  const [buscarAgendarOpen, setBuscarAgendarOpen] = useState(false);
  const [selecaoProfOpen, setSelecaoProfOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [blockToRemove, setBlockToRemove] = useState<TimeBlockData | null>(null);
  const [deleteTimeBlock] =
    useMutation<DeleteTimeBlockResult>(DeleteTimeBlockMutation);
  const roleName = useAuthStore((s) => s.roleName);
  const memberId = useAuthStore((s) => s.memberId);
  const canSchedule = canWriteAppointments(roleName);
  const ownOnly = seesOnlyOwnAppointments(roleName);
  const { data: membersData } = useQuery<MembersQueryResult>(MembersQuery);
  const professionals = useMemo<ScheduleProfessional[]>(
    () =>
      (membersData?.members ?? [])
        .filter((member: MemberData) => member.isProfessional)
        .filter((member: MemberData) => !ownOnly || member.id === memberId)
        .map((member, index) => ({
          id: member.id,
          name: member.displayName,
          initials: member.displayName
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase(),
          color: PROFESSIONAL_COLORS[index % PROFESSIONAL_COLORS.length],
          seniorityTier: member.seniorityTier ?? null,
        })),
    [membersData, ownOnly, memberId],
  );
  const week = useMemo(() => weekRange(selectedDate), [selectedDate]);
  const range = useMemo(
    () =>
      view === "week"
        ? { from: week.startsAt, to: week.endsAt }
        : dayRange(selectedDate),
    [view, week, selectedDate],
  );
  const { data: appointmentsData, refetch: refetchAppointments } =
    useQuery<AppointmentsQueryResult>(AppointmentsQuery, {
      variables: {
        startsAt: range.from,
        endsAt: range.to,
        // O backend já restringe o PROFESSIONAL; mandar o próprio id deixa
        // o pedido explícito.
        professionalId: ownOnly ? memberId : null,
      },
    });

  const { data: timeBlocksData, refetch: refetchTimeBlocks } =
    useQuery<TimeBlocksQueryResult>(
    TimeBlocksQuery,
    {
      variables: {
        startsAt: range.from,
        endsAt: range.to,
        professionalId: ownOnly ? memberId : null,
      },
    },
  );

  useEffect(() => {
    if (professionals.length)
      setVisibleProfIds((current) =>
        current.size
          ? current
          : new Set(professionals.map((professional) => professional.id)),
      );
  }, [professionals]);

  const visibleProfs = useMemo(
    () =>
      professionals.filter((professional) =>
        visibleProfIds.has(professional.id),
      ),
    [professionals, visibleProfIds],
  );
  const dayAppointments = useMemo(
    () =>
      (appointmentsData?.appointments ?? []).filter(
        (appointment) =>
          !HIDDEN_STATUSES.has(appointment.status) &&
          visibleProfIds.has(appointment.professionalId) &&
          activeStatuses.has(appointment.status) &&
          (!searchQuery ||
            appointment.client.fullName
              .toLowerCase()
              .includes(searchQuery.toLowerCase())),
      ),
    [appointmentsData, visibleProfIds, activeStatuses, searchQuery],
  );

  function toggleProf(id: string) {
    setVisibleProfIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleStatus(id: string) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function openModalAt(hour: number, minute: number, profId?: string) {
    if (!canSchedule) return;
    setModalSeed({ hour, minute, profId });
    setModalOpen(true);
  }
  function refetchAll() {
    void refetchAppointments();
    void refetchTimeBlocks();
  }
  async function removeBlock() {
    const block = blockToRemove;
    if (!block) return;
    try {
      const res = await deleteTimeBlock({ variables: { id: block.id } });
      const errors = res.data?.deleteTimeBlock.errors ?? [];
      if (errors.length > 0) {
        toast.error(errors[0].message);
        return;
      }
      toast.success("Bloqueio removido.");
      setBlockToRemove(null);
      refetchAll();
    } catch {
      toast.error("Não foi possível remover o bloqueio. Tente novamente.");
    }
  }
  function shiftDay(delta: number) {
    setSelectedDate((day) => {
      const next = new Date(day);
      next.setDate(next.getDate() + delta * (view === "week" ? 7 : 1));
      return next;
    });
  }
  const slotHeight = ROW_HEIGHTS[rowSize];
  const filterPanel = (
    <FilterPanel
      professionals={professionals}
      visibleProfIds={visibleProfIds}
      onToggleProf={toggleProf}
      selectedDate={selectedDate}
      onSelectDate={setSelectedDate}
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
      onOpenBlock={() => setBlockOpen(true)}
      canSchedule={canSchedule}
      canSelectProfessionals={!ownOnly}
    />
  );

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
        aria-label={sidebarCollapsed ? "Mostrar filtros" : "Ocultar filtros"}
        className="hidden lg:flex h-8 w-6 self-start mt-md -ml-3 z-20 items-center justify-center rounded-r-md border border-l-0 border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
      >
        {sidebarCollapsed ? (
          <ChevronsRight className="h-4 w-4" />
        ) : (
          <ChevronsLeft className="h-4 w-4" />
        )}
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
      <div className="flex-1 flex flex-col min-w-0 bg-neutral-50">
        {/* TOP BAR */}
        <div className="flex items-center gap-sm px-md py-sm border-b border-neutral-200 bg-white shrink-0 flex-wrap">
          {/* Date navigator */}
          <div className="flex items-center gap-xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shiftDay(-1)}
              aria-label={view === "week" ? "Semana anterior" : "Dia anterior"}
              className="h-11 w-11"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              type="button"
              className="flex flex-col items-center px-sm leading-tight hover:bg-neutral-50 rounded-md py-xs min-w-[120px] min-h-[44px]"
            >
              <span className="font-serif text-headline-sm tabular-nums text-neutral-800">
                {view === "week"
                  ? `${week.days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} – ${week.days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
                  : `${selectedDate.getDate()} ${selectedDate
                      .toLocaleDateString("pt-BR", { month: "short" })
                      .replace(".", "")} ${selectedDate.getFullYear()}`}
              </span>
              <span className="text-overline uppercase tabular-nums text-neutral-500">
                {view === "week"
                  ? selectedDate.getFullYear()
                  : selectedDate.toLocaleDateString("pt-BR", { weekday: "long" })}
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shiftDay(1)}
              aria-label={view === "week" ? "Próxima semana" : "Próximo dia"}
              className="h-11 w-11"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Dia / Semana (D-18) */}
          <div className="flex items-center gap-xs" role="group" aria-label="Vista da agenda">
            <Button
              type="button"
              size="sm"
              data-testid="view-day"
              aria-pressed={view === "day"}
              variant={view === "day" ? "default" : "outline"}
              onClick={() => setView("day")}
            >
              Dia
            </Button>
            <Button
              type="button"
              size="sm"
              data-testid="view-week"
              aria-pressed={view === "week"}
              variant={view === "week" ? "default" : "outline"}
              onClick={() => setView("week")}
            >
              Semana
            </Button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-[320px]">
            <Search className="absolute left-sm top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar clientes agendados hoje"
              className="pl-9"
            />
          </div>

          {/* +Agendar */}
          {canSchedule && (
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
          )}

          {canSchedule && (
            <Button
              size="sm"
              variant="outline"
              className="gap-xs"
              data-testid="block-open"
              onClick={() => setBlockOpen(true)}
            >
              <Ban className="h-4 w-4" />
              Bloquear horário
            </Button>
          )}

          {/* Filtros (mobile) */}
          <Button
            variant="outline"
            size="sm"
            data-testid="filters-open"
            onClick={() => setFiltersOpen(true)}
            className="lg:hidden gap-xs min-h-[44px] min-w-[44px]"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="text-label">Filtros</span>
          </Button>

          {/* Cluster avatares — alinhado à direita */}
          <div className="flex items-center gap-xs ml-auto min-w-0 max-w-full">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mostrar/ocultar profissionais"
              className="h-11 w-11 shrink-0 text-neutral-500"
              onClick={() => {
                const allVisible = visibleProfIds.size === professionals.length;
                if (allVisible) {
                  setVisibleProfIds(
                    new Set([professionals[0]?.id].filter(Boolean) as string[]),
                  );
                } else {
                  setVisibleProfIds(new Set(professionals.map((p) => p.id)));
                }
              }}
            >
              {visibleProfIds.size === professionals.length ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
            <div
              className="flex items-center gap-xs overflow-x-auto"
              data-testid="prof-avatars"
            >
              {professionals.slice(0, 4).map((pro) => {
                const visible = visibleProfIds.has(pro.id);
                return (
                  <button
                    key={pro.id}
                    type="button"
                    onClick={() => toggleProf(pro.id)}
                    title={pro.name}
                    aria-label={`Agenda de ${pro.name}`}
                    aria-pressed={visible}
                    className={cn(
                      "shrink-0 flex items-center gap-xs rounded-md min-h-[44px] min-w-[44px] px-2.5 border transition-colors",
                      visible
                        ? "bg-neutral-100 border-neutral-200 text-neutral-800"
                        : "bg-white border-transparent text-neutral-500 hover:bg-neutral-50",
                    )}
                  >
                    <span
                      className={cn(
                        "h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold",
                        visible ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600",
                      )}
                    >
                      {pro.initials}
                    </span>
                    <span className="truncate max-w-[120px] text-label">
                      {shortProfessionalName(pro.name)}
                    </span>
                  </button>
                );
              })}
              {professionals.length > 4 && (
                <span className="h-11 min-w-[44px] shrink-0 rounded-md border border-neutral-200 bg-white px-xs text-label tabular-nums text-neutral-500 flex items-center justify-center">
                  +{professionals.length - 4}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* GRID — single scroll container */}
        <div className="flex-1 overflow-auto">
          {view === "week" ? (
            <WeekGrid
              days={week.days}
              appointments={dayAppointments}
              timeBlocks={timeBlocksData?.timeBlocks ?? []}
              onOpenDay={(d) => {
                setSelectedDate(d);
                setView("day");
              }}
              onOpenAppointment={setDetailsId}
            />
          ) : (
            <DayGrid
              date={selectedDate}
              professionals={visibleProfs}
              appointments={dayAppointments}
              timeBlocks={timeBlocksData?.timeBlocks ?? []}
              slotHeight={slotHeight}
              colWidth={COL_WIDTHS[colSize]}
              canSchedule={canSchedule}
              canDrag={canSchedule}
              showFolga={showFolga}
              onSlotClick={openModalAt}
              onOpenAppointment={setDetailsId}
              onOpenTimeBlock={canSchedule ? setBlockToRemove : undefined}
            />
          )}
        </div>

      </div>

      {canSchedule && (
        <VisitFormDialog
          open={modalOpen}
          onOpenChange={setModalOpen}
          initialTime={modalSeed}
          date={selectedDate}
          professionals={professionals}
          onCreated={refetchAll}
        />
      )}

      {canSchedule && (
        <TimeBlockDialog
          open={blockOpen}
          onOpenChange={setBlockOpen}
          professionals={professionals}
          defaultDate={selectedDate}
          onCreated={refetchAll}
        />
      )}

      <AppointmentDetailsDialog
        appointment={
          (appointmentsData?.appointments ?? []).find(
            (a) => a.id === detailsId,
          ) ?? null
        }
        open={detailsId !== null}
        onOpenChange={(o) => {
          if (!o) setDetailsId(null);
        }}
        canWrite={canSchedule}
        onChanged={refetchAll}
      />

      <AlertDialog
        open={blockToRemove !== null}
        onOpenChange={(o) => {
          if (!o) setBlockToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover bloqueio</AlertDialogTitle>
            <AlertDialogDescription>
              {blockToRemove
                ? `Remover bloqueio de ${(TIME_BLOCK_KINDS.find((k) => k.value === blockToRemove.kind)?.label ?? blockToRemove.kind).toLowerCase()} das ${formatHM(new Date(blockToRemove.startsAt))} às ${formatHM(new Date(blockToRemove.endsAt))}?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="block-remove-confirm"
              onClick={() => void removeBlock()}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canSchedule && (
        <BuscarAgendarModal
          open={buscarAgendarOpen}
          onOpenChange={setBuscarAgendarOpen}
          professionals={professionals}
        />
      )}

      <SelecaoProfissionaisModal
        open={selecaoProfOpen}
        onOpenChange={setSelecaoProfOpen}
        visibleProfIds={visibleProfIds}
        onChangeVisible={setVisibleProfIds}
        professionals={professionals}
      />
    </div>
  );
}
