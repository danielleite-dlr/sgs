import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FIELD_LABEL_CLASS } from '@/lib/field-classes';
import { cn } from '@/lib/utils';
import { SEGMENT_SELECTED_CLASS } from '../lib/chart-theme';
import { brDateToIso, isoToBrDate, maskDateBR } from '../lib/input-masks';
import type { PeriodValue } from '../lib/period-value';
import {
  ORG_TIMEZONE_DEFAULT,
  PERIOD_PRESETS,
  addDays,
  customPeriod,
  resolvePeriod,
} from '../lib/period';

export function PeriodFilter({
  value,
  onChange,
  timeZone = ORG_TIMEZONE_DEFAULT,
}: {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
  timeZone?: string;
}) {
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom');
  const [fromBr, setFromBr] = useState(
    value.preset === 'custom' ? isoToBrDate(value.from) : '',
  );
  const [toBr, setToBr] = useState(
    value.preset === 'custom' ? isoToBrDate(addDays(value.to, -1)) : '',
  );

  const fromIso = brDateToIso(fromBr);
  const toIso = brDateToIso(toBr);
  const customValid = fromIso !== null && toIso !== null;

  return (
    <div className="flex flex-col gap-sm">
      <div role="group" aria-label="Período" className="flex flex-wrap gap-xs">
        {PERIOD_PRESETS.map((p) => {
          const active = !customOpen && value.preset === p.value;
          return (
            <Button
              key={p.value}
              type="button"
              variant={active ? 'default' : 'outline'}
              className={cn(active && SEGMENT_SELECTED_CLASS)}
              aria-pressed={active}
              data-testid={`period-preset-${p.value}`}
              onClick={() => {
                setCustomOpen(false);
                onChange({ preset: p.value, ...resolvePeriod(p.value, timeZone) });
              }}
            >
              {p.label}
            </Button>
          );
        })}
        <Button
          type="button"
          variant={customOpen ? 'default' : 'outline'}
          className={cn(customOpen && SEGMENT_SELECTED_CLASS)}
          aria-pressed={customOpen}
          data-testid="period-preset-custom"
          onClick={() => setCustomOpen(true)}
        >
          Personalizado
        </Button>
      </div>
      {customOpen && (
        <div className="flex flex-wrap items-end gap-sm">
          <label className={cn('flex flex-col gap-xs', FIELD_LABEL_CLASS)}>
            De
            <Input
              className="w-[140px] tabular-nums"
              placeholder="dd/mm/aaaa"
              inputMode="numeric"
              value={fromBr}
              onChange={(e) => setFromBr(maskDateBR(e.target.value))}
              data-testid="period-custom-from"
            />
          </label>
          <label className={cn('flex flex-col gap-xs', FIELD_LABEL_CLASS)}>
            Até
            <Input
              className="w-[140px] tabular-nums"
              placeholder="dd/mm/aaaa"
              inputMode="numeric"
              value={toBr}
              onChange={(e) => setToBr(maskDateBR(e.target.value))}
              data-testid="period-custom-to"
            />
          </label>
          <Button
            type="button"
            disabled={!customValid}
            data-testid="period-custom-apply"
            onClick={() => {
              if (!fromIso || !toIso) return;
              onChange({ preset: 'custom', ...customPeriod(fromIso, toIso) });
            }}
          >
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}
