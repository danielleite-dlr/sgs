import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import { useHasPermission } from '../operations-permissions';
import { CashForecastQuery, FORECAST_COST_GROUP_LABELS, forecastWindow, weekLabel, type CashForecastResult } from '../api/forecast.api';
import { CHART_COLORS, CHART_GRID_STROKE, CHART_TICK, CHART_TOOLTIP_STYLE } from '../lib/chart-theme';

// Gráfico da Previsão de caixa (D-26). Constantes locais até a junção com o tema
// compartilhado de gráficos (chart-theme.ts, 06-06). Os textos usam os tokens do Tailwind.

const LINK_CLASS =
  'inline-flex min-h-[44px] items-center self-start text-label font-semibold text-primary-500 underline-offset-4 hover:underline';

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

function ddMm(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function lastDay(toExclusive: string): string {
  const [y, m, d] = toExclusive.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().slice(0, 10);
}

export function ForecastCard() {
  const canRead = useHasPermission('financial.read');
  const { data, error, refetch } = useQuery<CashForecastResult>(CashForecastQuery, {
    variables: forecastWindow(),
    fetchPolicy: 'cache-and-network',
    skip: !canRead,
  });

  if (!canRead) return null;

  const forecast = data?.cashForecast;
  const negative = forecast ? Number(forecast.balance) < 0 : false;
  const balanceAbs = forecast ? forecast.balance.replace('-', '') : '0.00';

  const chartData = (forecast?.buckets ?? []).map((b) => ({
    label: weekLabel(b.start, b.end),
    inflow: Number(b.inflow),
    outflow: Number(b.outflow),
  }));

  return (
    <Card data-testid="forecast-card" className="max-w-none">
      <CardHeader className="flex-row flex-wrap items-baseline justify-between gap-sm space-y-0">
        <CardTitle className="text-headline-md font-semibold text-neutral-900">Previsão de caixa</CardTitle>
        {forecast && (
          <p className="text-data tabular-nums text-neutral-500">
            {ddMm(forecast.from)} a {ddMm(lastDay(forecast.to))}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-md">
        {error && !forecast ? (
          <Alert variant="destructive">
            <AlertDescription>
              Não foi possível carregar a previsão.{' '}
              <Button type="button" variant="outline" onClick={() => void refetch()}>
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        ) : !forecast ? (
          <div className="flex flex-col gap-sm" data-testid="forecast-loading">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : forecast.items.length === 0 ? (
          <div className="flex flex-col gap-xs text-body text-neutral-500">
            <p>Nenhum valor previsto nos próximos 30 dias.</p>
            <Link to="/financeiro/despesas-fixas" className={LINK_CLASS}>
              Cadastrar despesas fixas
            </Link>
          </div>
        ) : (
          <>
            {/* Faixa de números do painel: Entradas, Saídas e Saldo (destaque pelo tamanho). */}
            <Link
              to="/financeiro/previsao"
              aria-label="Ver detalhe da previsão de caixa"
              className="grid grid-cols-1 divide-y divide-neutral-200 rounded-lg border border-neutral-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
            >
              <div className="flex flex-col gap-xs p-sm">
                <p className="text-overline uppercase text-neutral-500">Entradas previstas</p>
                <p
                  data-testid="forecast-inflow"
                  className="whitespace-nowrap text-[20px] font-bold leading-7 tabular-nums text-success"
                >
                  {brl(forecast.inflowTotal)}
                </p>
              </div>
              <div className="flex flex-col gap-xs p-sm">
                <p className="text-overline uppercase text-neutral-500">Saídas previstas</p>
                <p
                  data-testid="forecast-outflow"
                  className="whitespace-nowrap text-[20px] font-bold leading-7 tabular-nums text-outflow"
                >
                  {brl(forecast.outflowTotal)}
                </p>
                <dl className="flex flex-col gap-0.5" data-testid="forecast-cost-groups">
                  {(
                    [
                      ['professional', forecast.professionalOutflowTotal],
                      ['operational', forecast.operationalOutflowTotal],
                      ['fixed', forecast.fixedOutflowTotal],
                    ] as const
                  ).map(([group, value]) => (
                    <div key={group} className="flex justify-between gap-sm text-[12px] leading-4">
                      <dt className="text-neutral-500">{FORECAST_COST_GROUP_LABELS[group]}</dt>
                      <dd className="whitespace-nowrap font-medium tabular-nums text-outflow-700">{brl(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="flex flex-col gap-xs p-sm">
                <p className="text-overline uppercase text-neutral-500">Saldo previsto</p>
                <p
                  data-testid="forecast-balance"
                  className={cn(
                    'whitespace-nowrap font-sans text-display font-semibold tabular-nums lg:text-display-lg',
                    negative ? 'text-outflow' : 'text-neutral-900',
                  )}
                >
                  {negative ? '−' : ''}
                  {brl(balanceAbs)}
                </p>
              </div>
            </Link>

            {forecast.overdueInflowTotal !== '0.00' && (
              <div>
                <Badge variant="warning">Inclui {brl(forecast.overdueInflowTotal)} em atraso</Badge>
              </div>
            )}

            <figure aria-label="Entradas e saídas previstas por semana" className="m-0">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={CHART_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  />
                  <Legend />
                  <Bar dataKey="inflow" name="Entradas" fill={CHART_COLORS.inflow} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="outflow" name="Saídas" fill={CHART_COLORS.outflow} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
              <table className="sr-only">
                <caption>Entradas e saídas previstas por semana</caption>
                <thead>
                  <tr>
                    <th scope="col">Semana</th>
                    <th scope="col">Entradas</th>
                    <th scope="col">Saídas</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.buckets.map((b) => (
                    <tr key={b.start}>
                      <th scope="row">{weekLabel(b.start, b.end)}</th>
                      <td>{brl(b.inflow)}</td>
                      <td>{brl(b.outflow)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </figure>

            <Link to="/financeiro/previsao" className={LINK_CLASS}>
              Ver detalhe
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
