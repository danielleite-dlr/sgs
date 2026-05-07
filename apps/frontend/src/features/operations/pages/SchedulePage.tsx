import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Construction } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  MOCK_PROFESSIONALS,
  MOCK_APPOINTMENTS,
  getMockWeekDays,
  TIME_SLOTS,
  type MockAppointment,
} from '../mocks/schedule.mock';
import { cn } from '@/lib/utils';

const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

function formatDay(date: Date): string {
  return `${DAY_NAMES[date.getDay() - 1 < 0 ? 0 : date.getDay() - 1]} ${date.getDate()}`;
}

function getAppointmentStyle(appt: MockAppointment): React.CSSProperties {
  // Each 30-min slot = 48px height; starts at hour 8
  const slotHeight = 48;
  const startOffset = (appt.startHour - 8) * 2 + appt.startMinute / 30;
  const top = startOffset * slotHeight;
  const height = (appt.durationMinutes / 30) * slotHeight - 4;
  return {
    top: `${top}px`,
    height: `${height}px`,
    backgroundColor: appt.categoryColor + '22',
    borderLeft: `3px solid ${appt.categoryColor}`,
  };
}

export function SchedulePage() {
  const { t } = useTranslation();
  const weekDays = getMockWeekDays();
  const [selectedDay, setSelectedDay] = useState(0);

  const dayAppointments = MOCK_APPOINTMENTS.filter((a) => a.dayOfWeek === selectedDay);

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center gap-sm">
        <Badge
          variant="outline"
          className="gap-xs border-warning-500 text-warning-600 bg-warning-50 text-xs"
        >
          <Construction className="h-3 w-3" />
          Mockup — Funcionalidade Phase 3 (em breve)
        </Badge>
      </div>

      <PageHeader
        title={t('operations.schedule.title', 'Agenda')}
        cta={
          <Button size="sm" className="gap-xs">
            <Plus className="h-4 w-4" />
            {t('operations.schedule.newAppointment', 'Novo agendamento')}
          </Button>
        }
      />

      {/* Week navigation */}
      <div className="flex items-center gap-sm">
        <Button variant="ghost" size="icon" aria-label="Semana anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-xs">
          {weekDays.map((day, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDay(idx)}
              className={cn(
                'flex flex-col items-center px-md py-sm rounded-md text-sm font-medium transition-colors',
                selectedDay === idx
                  ? 'bg-primary-500 text-white'
                  : 'text-neutral-700 hover:bg-neutral-50',
              )}
            >
              <span className="text-xs font-normal">{DAY_NAMES[idx]}</span>
              <span className="text-base font-semibold">{day.getDate()}</span>
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" aria-label="Próxima semana">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="ml-sm gap-xs">
          <CalendarDays className="h-4 w-4" />
          Hoje
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
        {/* Header: professionals */}
        <div className="grid border-b border-neutral-200 bg-neutral-50" style={{ gridTemplateColumns: `64px repeat(${MOCK_PROFESSIONALS.length}, minmax(0,1fr))` }}>
          <div className="p-sm border-r border-neutral-200" />
          {MOCK_PROFESSIONALS.map((pro) => (
            <div key={pro.id} className="p-sm border-r border-neutral-200 last:border-r-0 flex items-center gap-xs">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                style={{ backgroundColor: pro.color }}
              >
                {pro.initials}
              </div>
              <span className="text-sm font-medium text-neutral-800 truncate">{pro.name}</span>
            </div>
          ))}
        </div>

        {/* Time slots + appointments */}
        <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
          <div className="grid" style={{ gridTemplateColumns: `64px repeat(${MOCK_PROFESSIONALS.length}, minmax(0,1fr))` }}>
            {/* Time labels column */}
            <div className="border-r border-neutral-200">
              {TIME_SLOTS.map((slot) => (
                <div
                  key={`${slot.hour}-${slot.minute}`}
                  className="h-12 border-b border-neutral-100 flex items-start justify-end pr-sm pt-xs"
                >
                  {slot.minute === 0 && (
                    <span className="text-xs text-neutral-500 font-mono">{slot.label}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Professional columns */}
            {MOCK_PROFESSIONALS.map((pro) => (
              <div
                key={pro.id}
                className="border-r border-neutral-200 last:border-r-0 relative"
                style={{ height: `${TIME_SLOTS.length * 48}px` }}
              >
                {/* Grid lines */}
                {TIME_SLOTS.map((slot, i) => (
                  <div
                    key={i}
                    className={cn(
                      'absolute w-full border-b',
                      slot.minute === 0 ? 'border-neutral-200' : 'border-neutral-100 border-dashed',
                    )}
                    style={{ top: `${i * 48}px`, height: '48px' }}
                  />
                ))}

                {/* Appointments */}
                <TooltipProvider delayDuration={200}>
                  {dayAppointments
                    .filter((a) => a.professionalId === pro.id)
                    .map((appt) => (
                      <Tooltip key={appt.id}>
                        <TooltipTrigger asChild>
                          <div
                            className="absolute left-1 right-1 rounded-md px-xs py-xs cursor-pointer hover:brightness-95 transition-all overflow-hidden z-10"
                            style={getAppointmentStyle(appt)}
                          >
                            <p className="text-xs font-semibold text-neutral-800 truncate leading-tight">
                              {appt.clientName}
                            </p>
                            <p className="text-xs text-neutral-600 truncate leading-tight">
                              {appt.service}
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-sm space-y-xs">
                            <p className="font-semibold">{appt.clientName}</p>
                            <p className="text-neutral-600">{appt.service}</p>
                            <p className="text-neutral-500 text-xs">
                              {String(appt.startHour).padStart(2,'0')}:{String(appt.startMinute).padStart(2,'0')}
                              {' '}— {appt.durationMinutes} min
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                </TooltipProvider>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
