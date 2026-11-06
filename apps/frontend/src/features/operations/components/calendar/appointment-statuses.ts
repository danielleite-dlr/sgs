export const APPT_STATUSES = [
  { id: "absent", label: "Ausência de profissional", color: "#E2DFE5", textOnColor: "#221E26" },
  { id: "scheduled", label: "Agendado", color: "#570080", textOnColor: "#FFFFFF" },
  { id: "confirmed", label: "Confirmado", color: "#1B7A43", textOnColor: "#FFFFFF" },
  { id: "no_show", label: "Cliente não compareceu", color: "#BA1A1A", textOnColor: "#FFFFFF" },
  { id: "in_progress", label: "Em atendimento", color: "#0E61A8", textOnColor: "#FFFFFF" },
  { id: "completed", label: "Finalizado", color: "#49454F", textOnColor: "#FFFFFF" },
  { id: "cancelled", label: "Cancelado", color: "#BA1A1A", textOnColor: "#FFFFFF" },
] as const;

export function statusColor(status: string): string {
  return APPT_STATUSES.find((s) => s.id === status)?.color ?? "#6B6670";
}

/** Status que nao ocupam lugar na grade. */
export const HIDDEN_STATUSES = new Set(["cancelled", "no_show"]);
