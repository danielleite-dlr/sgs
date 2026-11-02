/** D-25: faixa visível fixa da agenda; sem horário de funcionamento. */
export const GRID_START_HOUR = 7;
export const GRID_END_HOUR = 22; // exclusivo: último slot 21:30
export const SLOT_MINUTES = 30;

export interface GridSlot {
  hour: number;
  minute: number;
  label: string;
}

export const GRID_SLOTS: GridSlot[] = Array.from(
  { length: ((GRID_END_HOUR - GRID_START_HOUR) * 60) / SLOT_MINUTES },
  (_, i) => {
    const total = GRID_START_HOUR * 60 + i * SLOT_MINUTES;
    const hour = Math.floor(total / 60);
    const minute = total % 60;
    return {
      hour,
      minute,
      label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    };
  },
);

export function minutesFromGridStart(d: Date): number {
  return (d.getHours() - GRID_START_HOUR) * 60 + d.getMinutes();
}

export function shiftStartBySlots(start: Date, slots: number): Date {
  return new Date(start.getTime() + slots * SLOT_MINUTES * 60_000);
}

export function slotsFromDelta(deltaY: number, slotHeight: number): number {
  const n = Math.round(deltaY / slotHeight);
  return n === 0 ? 0 : n;
}
