import type { CSSProperties, KeyboardEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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
            "absolute left-1 right-1 rounded-md px-xs py-xs overflow-hidden z-10 transition-colors hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500",
            draggable ? "cursor-grab touch-none" : "cursor-pointer",
            isDragging && "z-30 shadow-lg cursor-grabbing opacity-90",
          )}
          style={merged}
        >
          <p className="text-xs font-semibold text-neutral-800 truncate leading-tight">
            {appointment.clientName}
          </p>
          <p className="text-xs text-neutral-600 truncate leading-tight">
            {appointment.service}
          </p>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm space-y-xs">
          <p className="font-semibold">{appointment.clientName}</p>
          <p className="text-neutral-300">{appointment.service}</p>
          <p className="text-neutral-300 text-xs">
            {starts} — {appointment.durationMinutes} min
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
