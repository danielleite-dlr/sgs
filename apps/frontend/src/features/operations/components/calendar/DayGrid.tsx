import { useMemo, useRef } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type Modifier,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toDisplayName } from "@/lib/format-name";
import type {
  AppointmentData,
  TimeBlockData,
} from "../../api/appointments.api";
import { useMoveAppointment } from "../../hooks/useMoveAppointment";
import {
  GRID_END_HOUR,
  GRID_SLOTS,
  GRID_START_HOUR,
  SLOT_MINUTES,
  minutesFromGridStart,
  shiftStartBySlots,
  slotsFromDelta,
} from "../../lib/schedule-grid";
import { AppointmentCard } from "./AppointmentCard";
import { TimeBlockOverlay } from "./TimeBlockOverlay";
import {
  appointmentToSchedule,
  formatHM,
  getAppointmentStyle,
  type ScheduleProfessional,
} from "./types";

/** Faixas "fora do expediente" são só visuais (D-25: não bloqueiam nada). */
const VISUAL_WORK_START_HOUR = 9;
const VISUAL_WORK_END_HOUR = 19;
/** Papel neutro das horas fora do expediente (fase 6, D-19; era azul-claro). */
const OFF_HOURS_BG = "#F3F4F6";

export interface DayGridProps {
  date: Date;
  professionals: ScheduleProfessional[];
  appointments: AppointmentData[];
  timeBlocks: TimeBlockData[];
  slotHeight: number;
  colWidth: string;
  canSchedule: boolean;
  canDrag: boolean;
  showFolga: boolean;
  onSlotClick: (hour: number, minute: number, professionalId: string) => void;
  onOpenAppointment?: (id: string) => void;
  onOpenTimeBlock?: (b: TimeBlockData) => void;
}

const announcements = {
  onDragStart: () => "Agendamento levantado. Use as setas para mover e espaço para soltar.",
  onDragOver: () => undefined,
  onDragEnd: () => "Agendamento solto.",
  onDragCancel: () => "Movimento cancelado.",
};

interface LaneProps {
  professional: ScheduleProfessional;
  date: Date;
  slotHeight: number;
  canSchedule: boolean;
  canDrag: boolean;
  blocks: TimeBlockData[];
  appointments: AppointmentData[];
  onSlotClick: DayGridProps["onSlotClick"];
  onOpenAppointment?: (id: string) => void;
  onOpenTimeBlock?: (b: TimeBlockData) => void;
}

function ProfessionalLane({
  professional,
  date,
  slotHeight,
  canSchedule,
  canDrag,
  blocks,
  appointments,
  onSlotClick,
  onOpenAppointment,
  onOpenTimeBlock,
}: LaneProps) {
  const { setNodeRef } = useDroppable({ id: professional.id });
  const gridHeight = GRID_SLOTS.length * slotHeight;
  const beforeWorkHeight =
    (VISUAL_WORK_START_HOUR - GRID_START_HOUR) * 2 * slotHeight;
  const afterWorkTop = (VISUAL_WORK_END_HOUR - GRID_START_HOUR) * 2 * slotHeight;
  const afterWorkHeight = (GRID_END_HOUR - VISUAL_WORK_END_HOUR) * 2 * slotHeight;

  function slotBlocked(hour: number, minute: number): boolean {
    const s = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
    const e = new Date(s.getTime() + SLOT_MINUTES * 60_000);
    return blocks.some(
      (b) => new Date(b.startsAt) < e && new Date(b.endsAt) > s,
    );
  }

  return (
    <div
      ref={setNodeRef}
      data-testid={`lane-${professional.id}`}
      className="border-r border-neutral-200 last:border-r-0 relative"
      style={{ height: gridHeight }}
    >
      <div
        aria-hidden="true"
        className="absolute left-0 right-0 pointer-events-none"
        style={{ top: 0, height: beforeWorkHeight, backgroundColor: OFF_HOURS_BG }}
      />
      <div
        aria-hidden="true"
        className="absolute left-0 right-0 pointer-events-none"
        style={{ top: afterWorkTop, height: afterWorkHeight, backgroundColor: OFF_HOURS_BG }}
      />

      {GRID_SLOTS.map((slot, i) => {
        const blocked = slotBlocked(slot.hour, slot.minute);
        return (
          <button
            key={slot.label}
            type="button"
            data-testid={`slot-${professional.id}-${slot.label}`}
            disabled={!canSchedule || blocked}
            onClick={() => onSlotClick(slot.hour, slot.minute, professional.id)}
            className={cn(
              // Borda no topo do slot: linha cheia na hora cheia, tracejada na meia hora (D-19).
              "absolute w-full border-t text-left",
              slot.minute === 0 ? "border-neutral-200" : "border-neutral-200 border-dashed",
              canSchedule && !blocked ? "hover:bg-primary-50/40" : "cursor-default",
            )}
            style={{ top: i * slotHeight, height: slotHeight }}
            aria-label={
              canSchedule
                ? `Cadastrar agendamento às ${slot.label} para ${professional.name}`
                : `${slot.label} — ${professional.name}`
            }
          />
        );
      })}

      {blocks.map((b) => (
        <TimeBlockOverlay
          key={b.id}
          block={b}
          day={date}
          slotHeight={slotHeight}
          onClick={onOpenTimeBlock}
        />
      ))}

      {appointments.map((a) => {
        const appt = appointmentToSchedule(a);
        return (
          <AppointmentCard
            key={a.id}
            appointment={appt}
            style={getAppointmentStyle(appt, slotHeight)}
            draggable={canDrag}
            onOpen={onOpenAppointment}
          />
        );
      })}
    </div>
  );
}

export function DayGrid({
  date,
  professionals,
  appointments,
  timeBlocks,
  slotHeight,
  colWidth,
  canSchedule,
  canDrag,
  showFolga,
  onSlotClick,
  onOpenAppointment,
  onOpenTimeBlock,
}: DayGridProps) {
  const move = useMoveAppointment();
  const gridRef = useRef<HTMLDivElement>(null);
  const columns = `64px repeat(${Math.max(professionals.length, 1)}, ${colWidth})`;
  const gridHeight = GRID_SLOTS.length * slotHeight;

  const coordinateGetter: KeyboardCoordinateGetter = (event, { currentCoordinates }) => {
    const laneWidth =
      gridRef.current
        ?.querySelector('[data-testid^="lane-"]')
        ?.getBoundingClientRect().width || 150;
    const { x, y } = currentCoordinates;
    switch (event.code) {
      case "ArrowDown":
        return { x, y: y + slotHeight };
      case "ArrowUp":
        return { x, y: y - slotHeight };
      case "ArrowRight":
        return { x: x + laneWidth, y };
      case "ArrowLeft":
        return { x: x - laneWidth, y };
      default:
        return undefined;
    }
  };

  const pointer = useSensor(PointerSensor, { activationConstraint: { distance: 6 } });
  const touch = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } });
  const keyboard = useSensor(KeyboardSensor, { coordinateGetter });
  const sensors = useSensors(...(canDrag ? [pointer, touch, keyboard] : []));

  const snapY: Modifier = ({ transform }) => ({
    ...transform,
    y: Math.round(transform.y / slotHeight) * slotHeight,
  });

  const laneBlocks = useMemo(() => {
    const visible = timeBlocks.filter((b) => showFolga || b.kind !== "folga");
    const map = new Map<string, TimeBlockData[]>();
    for (const pro of professionals) {
      map.set(
        pro.id,
        visible.filter((b) => b.professionalId === pro.id || b.professionalId === null),
      );
    }
    return map;
  }, [timeBlocks, professionals, showFolga]);

  function handleDragEnd({ active, over, delta }: DragEndEvent) {
    const appt = appointments.find((a) => a.id === active.id);
    if (!appt) return;
    const slots = slotsFromDelta(delta.y, slotHeight);
    const professionalId = String(over?.id ?? appt.professionalId);
    if (slots === 0 && professionalId === appt.professionalId) return;
    const original = new Date(appt.startsAt);
    const startsAt = shiftStartBySlots(original, slots);
    const duration = new Date(appt.endsAt).getTime() - original.getTime();
    const endsAt = new Date(startsAt.getTime() + duration);
    const gridMinutes = (GRID_END_HOUR - GRID_START_HOUR) * 60;
    const startMin = minutesFromGridStart(startsAt);
    const endMin = startMin + duration / 60000;
    if (startMin < 0 || endMin > gridMinutes || endsAt.getDate() !== startsAt.getDate()) {
      toast.error("Não foi possível mover: fora da faixa da agenda");
      return;
    }
    const professionalName =
      professionals.find((p) => p.id === professionalId)?.name ??
      appt.professional.displayName;
    void move(appt, { professionalId, professionalName, startsAt });
  }

  const countByProfessional = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) map.set(a.professionalId, (map.get(a.professionalId) ?? 0) + 1);
    return map;
  }, [appointments]);

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const nowLineTop = (minutesFromGridStart(now) / SLOT_MINUTES) * slotHeight;

  return (
    <TooltipProvider delayDuration={200}>
      <DndContext
        sensors={sensors}
        modifiers={[snapY]}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Para mover o agendamento, pressione espaço, use as setas para escolher horário e profissional e pressione espaço novamente para soltar.",
          },
        }}
      >
        <div ref={gridRef} className="bg-white border border-neutral-200 m-md rounded-md overflow-hidden">
          <div
            className="grid border-b border-neutral-200 bg-neutral-50 sticky top-0 z-10"
            style={{ gridTemplateColumns: columns }}
          >
            <div className="p-sm border-r border-neutral-200" />
            {professionals.length === 0 ? (
              <div className="p-md text-xs text-neutral-500">Nenhum profissional selecionado.</div>
            ) : (
              professionals.map((pro) => {
                const n = countByProfessional.get(pro.id) ?? 0;
                return (
                  <div
                    key={pro.id}
                    className="px-sm py-sm border-r border-neutral-200 last:border-r-0 flex items-center gap-sm min-w-0"
                  >
                    <span
                      aria-hidden="true"
                      className="h-8 w-8 shrink-0 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold flex items-center justify-center"
                    >
                      {pro.initials}
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate font-serif text-[14px] font-semibold leading-5 text-neutral-800">
                        {toDisplayName(pro.name)}
                      </span>
                      <span
                        data-testid={`lane-count-${pro.id}`}
                        className="block text-[11px] leading-4 tabular-nums text-neutral-500"
                      >
                        {n} {n === 1 ? "atendimento" : "atendimentos"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="grid relative" style={{ gridTemplateColumns: columns }}>
            <div className="border-r border-neutral-200 relative">
              {GRID_SLOTS.map((slot) => (
                <div
                  key={slot.label}
                  data-testid="time-row"
                  className={cn(
                    "flex items-start justify-end pr-sm pt-[2px]",
                    slot.minute === 0 && "border-t border-neutral-200",
                  )}
                  style={{ height: slotHeight }}
                >
                  {slot.minute === 0 && (
                    <span className="text-data tabular-nums text-neutral-500">
                      {String(slot.hour).padStart(2, "0")}:00
                    </span>
                  )}
                </div>
              ))}
            </div>

            {professionals.length === 0 ? (
              <div
                className="border-r border-neutral-200 relative bg-neutral-50/40"
                style={{ height: gridHeight }}
              />
            ) : (
              professionals.map((pro) => (
                <ProfessionalLane
                  key={pro.id}
                  professional={pro}
                  date={date}
                  slotHeight={slotHeight}
                  canSchedule={canSchedule}
                  canDrag={canDrag}
                  blocks={laneBlocks.get(pro.id) ?? []}
                  appointments={appointments.filter((a) => a.professionalId === pro.id)}
                  onSlotClick={onSlotClick}
                  onOpenAppointment={onOpenAppointment}
                  onOpenTimeBlock={onOpenTimeBlock}
                />
              ))
            )}

            {isToday && nowLineTop > 0 && nowLineTop < gridHeight && (
              <div
                data-testid="now-line"
                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center -translate-y-1/2"
                style={{ top: nowLineTop }}
              >
                <span className="ml-[4px] rounded-md bg-primary px-1 py-0.5 text-[10px] font-semibold leading-none tabular-nums text-white">
                  {formatHM(now)}
                </span>
                <div className="flex-1 h-[1.5px] bg-primary" />
              </div>
            )}
          </div>
        </div>
      </DndContext>
    </TooltipProvider>
  );
}

