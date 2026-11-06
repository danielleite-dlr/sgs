import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import { useHasPermission } from '../operations-permissions';
import {
  CashForecastQuery,
  FORECAST_KIND_LABELS,
  forecastWindow,
  weekLabel,
  type CashForecastResult,
} from '../api/forecast.api';

const GREEN = '#1D9E75';
const RED = '#B42318';

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v.replace('-', ''))}`;
const signed = (v: string) => (Number(v) < 0 ? `−${brl(v)}` : brl(v));

function ddMm(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function PrevisaoPage() {
  const canRead = useHasPermission('financial.read');
  const { data, error, refetch } = useQuery<CashForecastResult>(CashForecastQuery, {
    variables: forecastWindow(),
    skip: !canRead,
  });
  const forecast = data?.cashForecast;

  return (
    <div className="p-md">
      <PageHeader
        title="Previsão de caixa"
        breadcrumbs={[{ label: 'Financeiro', to: '/financeiro' }, { label: 'Previsão de caixa' }]}
      />
      <p className="-mt-sm mb-md text-sm text-neutral-600">
        Agendamentos confirmados e parcelas de contratos a receber, menos comissões estimadas e despesas fixas.
      </p>

      {!canRead ? (
        <div className="rounded-md border border-neutral-200 bg-white p-md text-sm text-neutral-600">
          Você não tem acesso ao financeiro.
        </div>
      ) : error && !forecast ? (
        <Alert variant="destructive">
          <AlertDescription>
            Não foi possível carregar a previsão.{' '}
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : !forecast ? (
        <div className="flex flex-col gap-sm">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-lg">
          <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
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
            </div>
            <div>
              <p className="text-sm text-neutral-600">Saldo previsto</p>
              <p
                className="text-xl font-semibold text-neutral-900"
                style={Number(forecast.balance) < 0 ? { color: RED } : undefined}
              >
                {signed(forecast.balance)}
              </p>
            </div>
          </div>
          {forecast.overdueInflowTotal !== '0.00' && (
            <div>
              <Badge variant="warning">Inclui {brl(forecast.overdueInflowTotal)} em atraso</Badge>
            </div>
          )}

          {forecast.buckets.map((b, i) => {
            const items = forecast.items.filter((it) => it.date >= b.start && it.date < b.end);
            return (
              <section
                key={b.start}
                className="rounded-md border border-neutral-200 bg-white p-md"
                aria-label={`Semana ${i + 1}`}
              >
                <h2 className="text-sm font-semibold text-neutral-800">
                  Semana {i + 1} · {weekLabel(b.start, b.end)}
                </h2>
                <p className="mb-sm text-sm text-neutral-600">
                  Entradas {brl(b.inflow)} · Saídas {brl(b.outflow)} · Saldo {signed(b.balance)}
                </p>
                {items.length === 0 ? (
                  <p className="text-sm text-neutral-500">Nada previsto nesta semana.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it, idx) => (
                        <TableRow key={`${it.kind}-${it.refId ?? idx}-${idx}`}>
                          <TableCell>{ddMm(it.date)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{FORECAST_KIND_LABELS[it.kind]}</Badge>
                          </TableCell>
                          <TableCell>
                            <span>{it.label}</span>{' '}
                            {it.overdue && <Badge variant="warning">em atraso</Badge>}{' '}
                            {it.withoutProfessional && (
                              <Badge variant="secondary">estimada — sem profissional definido</Badge>
                            )}{' '}
                            {it.noRule && <Badge variant="secondary">sem regra de comissão</Badge>}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            style={{ color: it.direction === 'in' ? GREEN : RED }}
                          >
                            {it.direction === 'in' ? '+' : '−'}
                            {brl(it.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </section>
            );
          })}

          <footer className="flex flex-col gap-xs text-sm text-neutral-600">
            {forecast.noRuleCount > 0 && (
              <p>
                {forecast.noRuleCount} comissão(ões) sem regra cadastrada foram contadas como R$ 0,00. Cadastre as
                regras em Catálogo → Comissões.
              </p>
            )}
            <Link to="/financeiro/despesas-fixas" className="font-medium text-primary underline">
              Cadastrar despesas fixas
            </Link>
            <p>
              As comissões são estimadas pela regra de cada profissional; atendimentos de contrato ainda sem
              profissional usam a regra padrão do salão ou, sem ela, a maior regra do serviço.
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}
