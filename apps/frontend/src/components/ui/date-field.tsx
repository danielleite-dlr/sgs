import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { brDateToIso, isoToBrDate, maskDateBR } from '@/lib/date-br';
import {
  WEEKDAY_INITIALS,
  WEEKDAY_NAMES,
  dayLabel,
  monthGrid,
  monthTitle,
  shiftMonth,
  toIsoLocal,
} from '@/lib/month-grid';
import { cn } from '@/lib/utils';

export interface DateFieldProps {
  id: string;
  /** dd/mm/aaaa, pode estar incompleto. */
  value: string;
  onChange: (br: string) => void;
  /** Vai no <Input>. */
  'data-testid'?: string;
  /** Padrão `${id}-picker`. */
  pickerTestId?: string;
  className?: string;
  inputClassName?: string;
}

function initialView(value: string): { year: number; month: number } {
  const iso = brDateToIso(value);
  if (iso) {
    const [y, m] = iso.split('-').map(Number);
    return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function DateField({
  id,
  value,
  onChange,
  'data-testid': testId,
  pickerTestId,
  className,
  inputClassName,
}: DateFieldProps) {
  const picker = pickerTestId ?? `${id}-picker`;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => initialView(value));
  const selectedIso = brDateToIso(value);
  const todayIso = toIsoLocal(new Date());

  function handleOpenChange(next: boolean) {
    if (next) setView(initialView(value));
    setOpen(next);
  }

  return (
    <div className={cn('flex items-center gap-xs', className)}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(maskDateBR(e.target.value))}
        placeholder="dd/mm/aaaa"
        inputMode="numeric"
        maxLength={10}
        data-testid={testId}
        className={cn('min-w-0 flex-1 tabular-nums', inputClassName)}
      />
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Abrir calendário"
            data-testid={picker}
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          collisionPadding={8}
          data-testid={`${picker}-panel`}
          className="z-[60] w-[min(20rem,calc(100vw-1rem))] p-sm"
        >
          <div className="mb-xs flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Mês anterior"
              onClick={() => setView((v) => shiftMonth(v.year, v.month, -1))}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <p
              data-testid={`${picker}-title`}
              aria-live="polite"
              className="font-serif text-[15px] font-semibold text-neutral-800"
            >
              {monthTitle(view.year, view.month)}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Próximo mês"
              onClick={() => setView((v) => shiftMonth(v.year, v.month, 1))}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="grid grid-cols-7 text-center" data-testid={`${picker}-weekdays`}>
            {WEEKDAY_INITIALS.map((initial, i) => (
              <abbr
                key={i}
                title={WEEKDAY_NAMES[i]}
                className="text-overline text-neutral-500 no-underline"
              >
                {initial}
              </abbr>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {monthGrid(view.year, view.month).map((cell) => {
              const selected = cell.iso === selectedIso;
              const today = cell.iso === todayIso;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  data-testid={`${picker}-day-${cell.iso}`}
                  aria-label={dayLabel(cell.iso)}
                  aria-pressed={selected}
                  aria-current={today ? 'date' : undefined}
                  onClick={() => {
                    onChange(isoToBrDate(cell.iso));
                    setOpen(false);
                  }}
                  className={cn(
                    'h-11 w-full rounded-md text-body tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'bg-primary font-semibold text-white'
                      : cn(
                          today && 'ring-1 ring-primary-300',
                          cell.inMonth
                            ? 'text-neutral-800 hover:bg-primary-100'
                            : 'text-neutral-400 hover:bg-primary-100',
                        ),
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
