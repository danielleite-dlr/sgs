export type TimelineKind = 'make' | 'hair';

export interface TimelineRuleStep {
  name: string;
  offsetMinutes: number;
  isExtra: boolean;
  kind: TimelineKind | null;
  startsRegistry: boolean;
  displayOrder: number;
  durationMinutes: number | null;
  serviceId?: string | null;
}

export interface TimelineInput {
  packageName: string;
  brideLabel: string;
  eventDateDdMm: string;
  departureMinutes: number;
  steps: TimelineRuleStep[];
  makeProfessionalName?: string | null;
  hairProfessionalName?: string | null;
}

export interface TimelineRow {
  minutes: number;
  time: string;
  name: string;
  label: string;
  kind: TimelineKind | null;
  professionalName: string | null;
  isExtra: boolean;
  isRegistry: boolean;
  durationMinutes: number | null;
  serviceId: string | null;
}

export type TimelineWarningCode =
  | 'ARRIVAL_BEFORE_06'
  | 'PROFESSIONAL_UNDEFINED'
  | 'NO_REGISTRY_STEP'
  | 'SERVICE_UNDEFINED';
export interface TimelineWarning {
  code: TimelineWarningCode;
  message: string;
}

export interface TimelineResult {
  rows: TimelineRow[];
  text: string;
  registryStartMinutes: number | null;
  registryName: string | null;
  warnings: TimelineWarning[];
}

export type TimelineDomainErrorCode =
  | 'TIMELINE_RULES_MISSING'
  | 'BEFORE_MIDNIGHT'
  | 'INVALID_DEPARTURE';
export class TimelineDomainError extends Error {
  constructor(
    public readonly code: TimelineDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function formatHour(_totalMinutes: number): string {
  throw new Error('not implemented');
}
export function parseDepartureTime(_hhmm: string): number {
  throw new Error('not implemented');
}
export function formatDdMm(_isoDate: string): string {
  throw new Error('not implemented');
}
export function defaultBrideLabel(_fullName: string): string {
  throw new Error('not implemented');
}
export function computeTimeline(_input: TimelineInput): TimelineResult {
  throw new Error('not implemented');
}
export function brideWindows(_result: TimelineResult): {
  kind: TimelineKind;
  serviceId: string | null;
  startMinutes: number;
  endMinutes: number;
}[] {
  throw new Error('not implemented');
}
