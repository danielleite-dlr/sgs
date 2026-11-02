/** Status que ocupam a agenda (= predicado da exclusion constraint). */
export const BLOCKING_STATUSES = [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
] as const;
export const MOVABLE_STATUSES = ["scheduled", "confirmed", "in_progress"] as const;
export const CANCELLABLE_STATUSES = ["scheduled", "confirmed", "in_progress"] as const;
/** Status definíveis via updateAppointmentStatus (completed só pelo fechamento da comanda). */
export const SETTABLE_STATUSES = ["confirmed", "in_progress"] as const;

const TRANSITIONS: Record<string, string[]> = {
  scheduled: ["confirmed", "in_progress"],
  confirmed: ["in_progress"],
};

export function canTransition(from: string, to: string): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
