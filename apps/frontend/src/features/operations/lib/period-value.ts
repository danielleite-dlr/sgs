import { DEFAULT_PRESET, ORG_TIMEZONE_DEFAULT, resolvePeriod, type PeriodPreset } from './period';

/** Valor do PeriodFilter; `to` é exclusivo (YYYY-MM-DD). */
export interface PeriodValue {
  preset: PeriodPreset | 'custom';
  from: string;
  to: string;
}

export function defaultPeriod(tz: string = ORG_TIMEZONE_DEFAULT): PeriodValue {
  return { preset: DEFAULT_PRESET, ...resolvePeriod(DEFAULT_PRESET, tz) };
}
