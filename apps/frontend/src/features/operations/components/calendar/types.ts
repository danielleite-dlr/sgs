import type { CSSProperties } from "react";
import type { AppointmentData, TimeBlockData } from "../../api/appointments.api";
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  SLOT_MINUTES,
  minutesFromGridStart,
} from "../../lib/schedule-grid";
import { statusSpineColor } from "../../lib/appointment-status-style";

export interface ScheduleProfessional {
  id: string;
  name: string;
  initials: string;
  color: string;
  seniorityTier?: string | null;
}

export interface ScheduleAppointment {
  id: string;
  professionalId: string;
  clientName: string;
  service: string;
  categoryColor: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  status: string;
}

// Todas aceitam texto branco com contraste AA (fase 6, D-11/D-12).
export const PROFESSIONAL_COLORS = [
  "#570080",
  "#0B7A53",
  "#0E61A8",
  "#49454F",
  "#8A5300",
];

export function formatHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function appointmentToSchedule(
  appointment: AppointmentData,
): ScheduleAppointment {
  const start = new Date(appointment.startsAt);
  const end = new Date(appointment.endsAt);
  return {
    id: appointment.id,
    professionalId: appointment.professionalId,
    clientName: appointment.client.fullName,
    service: appointment.service.name,
    categoryColor:
      PROFESSIONAL_COLORS[
        Math.abs(appointment.service.name.length) % PROFESSIONAL_COLORS.length
      ],
    start,
    end,
    durationMinutes: Math.round((end.getTime() - start.getTime()) / 60000),
    status: appointment.status,
  };
}

export function getAppointmentStyle(
  appt: ScheduleAppointment,
  slotHeight: number,
): CSSProperties {
  const top = (minutesFromGridStart(appt.start) / SLOT_MINUTES) * slotHeight;
  const height = (appt.durationMinutes / SLOT_MINUTES) * slotHeight - 4;
  return {
    top: `${top}px`,
    height: `${height}px`,
    backgroundColor: "#FFFFFF",
    borderLeft: `3px solid ${statusSpineColor(appt.status)}`,
  };
}

const GRID_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;

/** Minutos de [start, end) relativos ao início da grade do dia, recortados à faixa 07h-22h. */
export function blockGridRange(
  block: Pick<TimeBlockData, "startsAt" | "endsAt">,
  day?: Date,
): { from: number; to: number } {
  const start = new Date(block.startsAt);
  const end = new Date(block.endsAt);
  const ref = day ?? start;
  const gridStart = new Date(
    ref.getFullYear(),
    ref.getMonth(),
    ref.getDate(),
    GRID_START_HOUR,
  ).getTime();
  const from = Math.max(0, (start.getTime() - gridStart) / 60000);
  const to = Math.min(GRID_MINUTES, (end.getTime() - gridStart) / 60000);
  return { from, to };
}

