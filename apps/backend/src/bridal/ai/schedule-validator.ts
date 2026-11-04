import type { Proposal, ScheduleContext } from "./ai-schedule.schema";

export type ViolationCode =
  | "UNKNOWN_PERSON"
  | "UNKNOWN_SERVICE"
  | "MISSING_SERVICE"
  | "DUPLICATE_SERVICE"
  | "UNKNOWN_PROFESSIONAL"
  | "PROFESSIONAL_NOT_ELIGIBLE"
  | "INVALID_TIME"
  | "WRONG_DURATION"
  | "OUTSIDE_DAY_WINDOW"
  | "AFTER_READY_BY"
  | "PROFESSIONAL_OVERLAP"
  | "BUSY_CONFLICT"
  | "PERSON_OVERLAP"
  | "TRAVEL_CONFLICT";

export interface Violation {
  code: ViolationCode;
  personRef?: string;
  serviceId?: string;
  professionalId?: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  violations: Violation[];
  warnings: { code: "BRIDE_NOT_LAST"; message: string }[];
}

export function validateProposal(
  _p: Proposal,
  _ctx: ScheduleContext,
): ValidationResult {
  throw new Error("not implemented");
}
