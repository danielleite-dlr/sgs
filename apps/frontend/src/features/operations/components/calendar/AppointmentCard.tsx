import type { CSSProperties, KeyboardEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toDisplayName } from "@/lib/format-name";
import { statusSpineColor } from "../../lib/appointment-status-style";
import { APPOINTMENT_STATUS_LABELS } from "../../lib/operations-labels";
import { formatHM, type ScheduleAppointment } from "./types";

interface AppointmentCardProps {
  appointment: ScheduleAppointment;
  style: CSSProperties;
  draggable: boolean;
  onOpen?: (id: string) => void;
}

export function AppointmentCard({
  appointment,
  style,
  draggable,
  onOpen,
}: AppointmentCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: appointment.id,
      disabled: !draggable,
      data: { professionalId: appointment.professionalId },
    });
  const starts = formatHM(appointment.start);
  const ends = formatHM(appointment.end);
  const displayName = toDisplayName(appointment.clientName);
  const ariaLabel = `${appointment.clientName}, ${appointment.service}, ${starts} a ${ends}${draggable ? ". Pressione espaço para mover" : ""}`;
  const merged: CSSProperties = {
    ...style,
    ...(transform
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
      : null),
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          {...(draggable ? attributes : { tabIndex: 0, role: "button" })}
          {...(draggable ? listeners : {})}
          ref={setNodeRef}
          data-testid={`appointment-card-${appointment.id}`}
          data-starts={starts}
          data-ends={ends}
          data-professional-id={appointment.professionalId}
          aria-label={ariaLabel}
          onClick={() => onOpen?.(appointment.id)}
          {...(draggable
            ? null
            : {
                onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen?.(appointment.id);
                  }
                },
              })}
          className={cn(
            "absolute left-1 right-1 rounded-md border border-neutral-200 bg-[var(--appt-bg,#FFFFFF)] px-[12px] py-[6px] overflow-hidden z-10 transition-colors hover:bg-[var(--appt-bg-hover,#F9FAFB)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500",
            draggable ? "cursor-grab touch-none" : "cursor-pointer",
            isDragging &&
              "z-30 cursor-grabbing opacity-90 outline outline-[1.5px] outline-primary-500",
          )}
          style={merged}
        >
          <p
            data-testid={`appointment-name-${appointment.id}`}
            className="truncate font-serif text-[15px] font-semibold leading-5 text-neutral-800"
          >
            {displayName}
          </p>
          <p className="truncate text-[12px] leading-4 text-neutral-600">
            {appointment.service}
          </p>
          <p
            data-testid={`appointment-time-${appointment.id}`}
            className="truncate text-[12px] leading-4 tabular-nums text-neutral-600"
          >
            {starts} - {ends} • {appointment.durationMinutes} min
          </p>
          {appointment.durationMinutes >= 60 && (
            <div className="mt-[2px] flex">
              <span
                data-testid={`appointment-status-${appointment.id}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 text-[11px] font-semibold leading-5 text-neutral-800"
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: statusSpineColor(appointment.status) }}
                />
                {APPOINTMENT_STATUS_LABELS[appointment.status] ?? appointment.status}
              </span>
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm space-y-xs">
          <p className="font-semibold">{displayName}</p>
          <p className="text-white/80">{appointment.service}</p>
          <p className="text-white/80 text-xs tabular-nums">
            {starts} — {appointment.durationMinutes} min
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
