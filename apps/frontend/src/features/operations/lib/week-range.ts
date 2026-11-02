export interface WeekRange {
  days: Date[];
  startsAt: string;
  endsAt: string;
}

/** Semana de segunda 00:00 local até a segunda seguinte 00:00 (exclusivo). */
export function weekRange(date: Date): WeekRange {
  const dow = date.getDay(); // 0 = domingo
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((dow + 6) % 7));
  const days = Array.from(
    { length: 7 },
    (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i),
  );
  const next = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  return { days, startsAt: monday.toISOString(), endsAt: next.toISOString() };
}
