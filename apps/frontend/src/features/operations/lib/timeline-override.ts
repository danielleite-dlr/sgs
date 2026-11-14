import { useSyncExternalStore } from 'react';

/** Códigos do servidor (04.2-04) que Gerente/Administrador podem forçar com motivo. */
export const OVERRIDABLE_TIMELINE_CODES = [
  'TIMELINE_AFTER_REGISTRY',
  'TIMELINE_PROFESSIONAL_WITH_BRIDE',
] as const;

export function isOverridableTimelineError(e: { code: string } | null | undefined): boolean {
  return e != null && (OVERRIDABLE_TIMELINE_CODES as readonly string[]).includes(e.code);
}

export interface TimelineOverrideRequest {
  message: string;
  resolve(reason: string | null): void;
}

let pending: TimelineOverrideRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Abre o diálogo do host; resolve com o motivo digitado ou null se cancelar. */
export function requestTimelineOverride(message: string): Promise<string | null> {
  if (pending) {
    const old = pending;
    pending = null;
    old.resolve(null);
  }
  return new Promise<string | null>((resolve) => {
    const req: TimelineOverrideRequest = {
      message,
      resolve(reason) {
        if (pending === req) {
          pending = null;
          emit();
        }
        resolve(reason);
      },
    };
    pending = req;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTimelineOverrideRequest(): TimelineOverrideRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  );
}
