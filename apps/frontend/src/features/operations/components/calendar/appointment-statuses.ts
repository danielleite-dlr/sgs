import { STATUS_SPINE_COLORS } from "../../lib/appointment-status-style";

export const APPT_STATUSES = [
  { id: "absent", label: "Ausência de profissional", color: "#E2DFE5", textOnColor: "#221E26" },
  { id: "scheduled", label: "Agendado", color: STATUS_SPINE_COLORS.scheduled, textOnColor: "#FFFFFF" },
  { id: "confirmed", label: "Confirmado", color: STATUS_SPINE_COLORS.confirmed, textOnColor: "#FFFFFF" },
  { id: "no_show", label: "Cliente não compareceu", color: STATUS_SPINE_COLORS.no_show, textOnColor: "#FFFFFF" },
  { id: "in_progress", label: "Em atendimento", color: STATUS_SPINE_COLORS.in_progress, textOnColor: "#FFFFFF" },
  { id: "completed", label: "Finalizado", color: STATUS_SPINE_COLORS.completed, textOnColor: "#FFFFFF" },
  { id: "cancelled", label: "Cancelado", color: STATUS_SPINE_COLORS.cancelled, textOnColor: "#FFFFFF" },
] as const;

export function statusColor(status: string): string {
  return APPT_STATUSES.find((s) => s.id === status)?.color ?? "#6B6670";
}

/** Status que nao ocupam lugar na grade. */
export const HIDDEN_STATUSES = new Set(["cancelled", "no_show"]);
