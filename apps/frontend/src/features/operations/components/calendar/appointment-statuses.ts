export const APPT_STATUSES = [
  { id: "absent", label: "Ausência de profissional", color: "#D9D9D9", textOnColor: "#5C5C5C" },
  { id: "scheduled", label: "Agendado", color: "#EF9F27", textOnColor: "#FFFFFF" },
  { id: "confirmed", label: "Confirmado", color: "#1D9E75", textOnColor: "#FFFFFF" },
  { id: "no_show", label: "Cliente não compareceu", color: "#3F3F3F", textOnColor: "#FFFFFF" },
  { id: "in_progress", label: "Em atendimento", color: "#28A89F", textOnColor: "#FFFFFF" },
  { id: "completed", label: "Finalizado", color: "#5D54C7", textOnColor: "#FFFFFF" },
  { id: "cancelled", label: "Cancelado", color: "#FBE4E4", textOnColor: "#A03A3A" },
] as const;

export function statusColor(status: string): string {
  return APPT_STATUSES.find((s) => s.id === status)?.color ?? "#9CA3AF";
}

/** Status que nao ocupam lugar na grade. */
export const HIDDEN_STATUSES = new Set(["cancelled", "no_show"]);
