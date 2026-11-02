import type { AppointmentData, TimeBlockData } from "../../api/appointments.api";
import { TIME_BLOCK_KINDS } from "../../lib/operations-labels";
import { cn } from "@/lib/utils";
import { statusColor } from "./appointment-statuses";
import { formatHM } from "./types";

interface WeekGridProps {
  days: Date[];
  appointments: AppointmentData[];
  timeBlocks: TimeBlockData[];
  onOpenDay: (d: Date) => void;
  onOpenAppointment?: (id: string) => void;
}

function sameDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

/** Vista Semana (D-18): colunas por dia, cards mínimos, sem DnD nem detalhe de profissional. */
export function WeekGrid({
  days,
  appointments,
  timeBlocks,
  onOpenDay,
  onOpenAppointment,
}: WeekGridProps) {
  const holidayClass =
    TIME_BLOCK_KINDS.find((k) => k.value === "feriado")?.className ?? "";
  return (
    <div
      data-testid="week-grid"
      className="grid grid-cols-1 md:grid-cols-7 gap-px bg-neutral-200 border border-neutral-200 m-md rounded-lg overflow-hidden"
    >
      {days.map((day) => {
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
        const holiday = timeBlocks.some(
          (b) =>
            b.kind === "feriado" &&
            new Date(b.startsAt) < dayEnd &&
            new Date(b.endsAt) > dayStart,
        );
        const items = appointments
          .filter((a) => sameDay(a.startsAt, day))
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        const label = day
          .toLocaleDateString("pt-BR", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
          })
          .replace(".", "");
        return (
          <section
            key={day.toISOString()}
            data-testid={`week-day-${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`}
            className="bg-white min-h-[200px] flex flex-col"
          >
            <button
              type="button"
              onClick={() => onOpenDay(day)}
              className="px-sm py-sm text-left text-xs font-bold uppercase tracking-wider text-neutral-700 hover:bg-primary-50 border-b border-neutral-200 capitalize"
            >
              {label}
            </button>
            <div className="flex-1 p-xs space-y-xs">
              {holiday && (
                <span
                  className={cn(
                    "inline-block rounded px-xs text-[11px] font-semibold border-l-4",
                    holidayClass,
                  )}
                >
                  Feriado
                </span>
              )}
              {items.length === 0 ? (
                <p className="text-xs text-neutral-500 px-xs">Sem agendamentos</p>
              ) : (
                items.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    data-testid={`week-card-${a.id}`}
                    onClick={() => onOpenAppointment?.(a.id)}
                    className="w-full text-left rounded-md px-xs py-xs text-xs bg-neutral-50 hover:brightness-95 truncate"
                    style={{ borderLeft: `3px solid ${statusColor(a.status)}` }}
                  >
                    {formatHM(new Date(a.startsAt))} · {a.client.fullName} · {a.service.name}
                  </button>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
