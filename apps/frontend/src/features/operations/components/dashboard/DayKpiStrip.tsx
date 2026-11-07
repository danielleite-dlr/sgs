import { useQuery } from '@apollo/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import { useBridalPermission } from '@/features/bridal/bridal-permissions';
import { cn } from '@/lib/utils';
import { FinancialSummaryQuery } from '../../api/financial.api';
import { DashboardContractsQuery, type DashboardContractsResult } from '../../api/dashboard.api';
import { ORG_TIMEZONE_DEFAULT, addDays, todayInTimeZone } from '../../lib/period';
import { contractsKpi, summarizeAppointments } from '../../lib/operational-dashboard';
import { useHasPermission } from '../../operations-permissions';
import { useTodayAppointments } from './use-today-appointments';

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

interface SummaryResult {
  financialSummary: { billedTotal: string; closedComandas: number; averageTicket: string };
}

const COLS: Record<number, string> = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' };

const BIG = 'whitespace-nowrap font-sans text-headline-md font-semibold tabular-nums text-neutral-900 lg:text-display';
const SUB = 'text-data text-neutral-700';

function Column({
  label,
  children,
  testId,
}: {
  label: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex items-start justify-between gap-sm p-sm lg:flex-col lg:justify-start lg:p-md"
    >
      <p className="text-overline uppercase text-neutral-700">{label}</p>
      <div className="flex min-w-0 flex-col items-end gap-xs text-right lg:items-start lg:text-left">
        {children}
      </div>
    </div>
  );
}

function ColumnError({ onRetry }: { onRetry: () => void }) {
  return (
    <p className={SUB}>
      Não foi possível carregar.{' '}
      <button type="button" className="min-h-[44px] font-semibold underline" onClick={onRetry}>
        Tentar novamente
      </button>
    </p>
  );
}

export function DayKpiStrip() {
  const canFinance = useHasPermission('financial.read');
  const canContract = useBridalPermission('contract.read');
  const today = todayInTimeZone(ORG_TIMEZONE_DEFAULT);

  const appts = useTodayAppointments();
  const fin = useQuery<SummaryResult>(FinancialSummaryQuery, {
    variables: { from: today, to: addDays(today, 1), granularity: 'day' },
    fetchPolicy: 'cache-and-network',
    skip: !canFinance,
  });
  const contracts = useQuery<DashboardContractsResult>(DashboardContractsQuery, {
    fetchPolicy: 'cache-and-network',
    skip: !canContract,
  });

  const summary = appts.data ? summarizeAppointments(appts.data.appointments) : null;
  const kpi = contracts.data ? contractsKpi(contracts.data.contracts, today) : null;
  const money = fin.data?.financialSummary;
  const colCount = 1 + (canFinance ? 2 : 0) + (canContract ? 1 : 0);

  return (
    <Card data-testid="day-kpi-strip" className="max-w-none">
      <h2 className="px-sm pt-sm text-overline uppercase text-neutral-700 lg:sr-only">
        Métricas do dia
      </h2>
      <div
        className={cn(
          'grid grid-cols-1 divide-y divide-neutral-200 lg:divide-x lg:divide-y-0',
          COLS[colCount],
        )}
      >
        <Column label="Atendimentos hoje" testId="kpi-appointments">
          {appts.error && !summary ? (
            <ColumnError onRetry={() => void appts.refetch()} />
          ) : !summary ? (
            <Skeleton data-testid="kpi-appointments-loading" className="h-12 w-40" />
          ) : (
            <>
              <p className={BIG} data-testid="kpi-appointments-total">
                {summary.total}
              </p>
              <p className={SUB}>
                {summary.completed} concluídos • {summary.inProgress} em andamento •{' '}
                {summary.pending} pendentes
              </p>
              {summary.total > 0 && (
                <div aria-hidden="true" className="flex h-1.5 w-full min-w-[120px] overflow-hidden rounded-full bg-neutral-100">
                  <span className="bg-status-done" style={{ width: `${(summary.completed / summary.total) * 100}%` }} />
                  <span className="bg-status-scheduled" style={{ width: `${(summary.inProgress / summary.total) * 100}%` }} />
                  <span className="bg-primary-200" style={{ width: `${(summary.pending / summary.total) * 100}%` }} />
                </div>
              )}
            </>
          )}
        </Column>

        {canFinance && (
          <Column label="Faturado hoje" testId="kpi-billed">
            {fin.error && !money ? (
              <ColumnError onRetry={() => void fin.refetch()} />
            ) : !money ? (
              <Skeleton data-testid="kpi-billed-loading" className="h-12 w-40" />
            ) : (
              <>
                <p className={BIG} data-testid="kpi-billed-value">
                  {brl(money.billedTotal)}
                </p>
                <p className={SUB}>Comandas e pagamentos de contrato</p>
              </>
            )}
          </Column>
        )}

        {canContract && (
          <Column label="Noivas" testId="kpi-brides">
            {contracts.error && !kpi ? (
              <ColumnError onRetry={() => void contracts.refetch()} />
            ) : !kpi ? (
              <Skeleton data-testid="kpi-brides-loading" className="h-12 w-40" />
            ) : (
              <>
                <p className={BIG} data-testid="kpi-brides-month">
                  {kpi.month}
                </p>
                <p className={SUB}>no mês • {kpi.week} nesta semana</p>
              </>
            )}
          </Column>
        )}

        {canFinance && (
          <Column label="Ticket médio hoje" testId="kpi-ticket">
            {fin.error && !money ? (
              <ColumnError onRetry={() => void fin.refetch()} />
            ) : !money ? (
              <Skeleton data-testid="kpi-ticket-loading" className="h-12 w-40" />
            ) : (
              <>
                <p className={BIG} data-testid="kpi-ticket-value">
                  {brl(money.averageTicket)}
                </p>
                <p className={SUB}>Base: {money.closedComandas} comandas fechadas</p>
              </>
            )}
          </Column>
        )}
      </div>
    </Card>
  );
}
