import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import { useHasPermission } from '../operations-permissions';
import { CashForecastQuery, FORECAST_COST_GROUP_LABELS, forecastWindow, weekLabel, type CashForecastResult } from '../api/forecast.api';

// Entrada e saída da Previsão de caixa (D-26).
const GREEN = '#109868';
const RED = '#D85A30';
// Texto pequeno: tom escuro com 5,37:1 sobre branco (WCAG AA).
const RED_TEXT = '#B5481F';

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
    <Card data-testid="forecast-card">
      <CardHeader>
        <CardTitle>Previsão de caixa</CardTitle>
        {forecast && (
          <p className="text-sm text-neutral-600">
            {ddMm(forecast.from)} a {ddMm(lastDay(forecast.to))}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-md">
        {error && !forecast ? (
          <Alert variant="destructive">
            <AlertDescription>
              Não foi possível carregar a previsão.{' '}
              <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
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
          <div className="flex flex-col gap-sm text-sm text-neutral-600">
            <p>Nenhum valor previsto nos próximos 30 dias.</p>
            <Link to="/financeiro/despesas-fixas" className="font-medium text-primary underline">
              Cadastrar despesas fixas
            </Link>
          </div>
        ) : (
          <>
            <Link
              to="/financeiro/previsao"
              aria-label="Ver detalhe da previsão de caixa"
              className="grid grid-cols-1 gap-md rounded-md sm:grid-cols-3"
            >
              <div>
                <p className="text-sm text-neutral-600">Entradas previstas</p>
                <p className="text-xl font-semibold" style={{ color: GREEN }}>
                  {brl(forecast.inflowTotal)}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-600">Saídas previstas</p>
                <p className="text-xl font-semibold" style={{ color: RED }}>
                  {brl(forecast.outflowTotal)}
                </p>
                <dl className="mt-xs flex flex-col gap-0.5 text-sm" data-testid="forecast-cost-groups">
                  {(
                    [
                      ['professional', forecast.professionalOutflowTotal],
                      ['operational', forecast.operationalOutflowTotal],
                      ['fixed', forecast.fixedOutflowTotal],
                    ] as const
                  ).map(([group, value]) => (
                    <div key={group} className="flex justify-between gap-sm">
                      <dt className="text-neutral-700">{FORECAST_COST_GROUP_LABELS[group]}</dt>
                      <dd className="font-medium" style={{ color: RED_TEXT }}>
                        {brl(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <p className="text-sm text-neutral-600">Saldo previsto</p>
                <p
                  className="text-xl font-semibold text-neutral-900"
                  style={negative ? { color: RED } : undefined}
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
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                  <Legend />
                  <Bar dataKey="inflow" name="Entradas" fill={GREEN} isAnimationActive={false} />
                  <Bar dataKey="outflow" name="Saídas" fill={RED} isAnimationActive={false} />
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

            <Link to="/financeiro/previsao" className="text-sm font-medium text-primary underline">
              Ver detalhe
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
