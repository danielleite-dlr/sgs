import { PageHeader } from '@/components/layout/PageHeader';
import { useHasAccess } from '@/features/access/access-hooks';
import { DayKpiStrip } from '@/features/operations/components/dashboard/DayKpiStrip';
import { OpenComandasCard } from '@/features/operations/components/dashboard/OpenComandasCard';
import { UpcomingAppointmentsCard } from '@/features/operations/components/dashboard/UpcomingAppointmentsCard';
import { UpcomingContractsCard } from '@/features/operations/components/dashboard/UpcomingContractsCard';
import { ForecastCard } from '@/features/operations/components/ForecastCard';
import { formatLongDate } from '@/lib/format-date-long';
import { cn } from '@/lib/utils';

// Início no layout Dashboard operacional (quick 261107-in8): KPIs do dia, próximos
// atendimentos, comandas em aberto, contratos de noivas e, abaixo, a previsão de caixa.
export default function DashboardPage() {
  const canContract = useHasAccess('contratos');
  const canAgenda = useHasAccess('agenda');
  const canComandas = useHasAccess('fin-comandas');
  const canLeft = canAgenda || canComandas;
  return (
    <div className="flex flex-col gap-md">
      <PageHeader
        eyebrow="Painel do dia"
        title="Início"
        description={formatLongDate(new Date())}
        variant="display"
      />
      <DayKpiStrip />
      <div className="grid gap-md lg:grid-cols-3">
        {canLeft && (
          <div
            className={cn(
              'flex min-w-0 flex-col gap-md',
              canContract ? 'lg:col-span-2' : 'lg:col-span-3',
            )}
          >
            <UpcomingAppointmentsCard />
            <OpenComandasCard />
          </div>
        )}
        {canContract && (
          <div className={cn('min-w-0', !canLeft && 'lg:col-span-3')}>
            <UpcomingContractsCard />
          </div>
        )}
      </div>
      <ForecastCard />
    </div>
  );
}
