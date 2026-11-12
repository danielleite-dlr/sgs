import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import { FIELD_LABEL_CLASS } from '@/lib/field-classes';
import { cn } from '@/lib/utils';
import { SEGMENT_SELECTED_CLASS } from '../lib/chart-theme';
import { useHasPermission } from '../operations-permissions';
import { brDateToIso, isoToBrDate, maskDateBR } from '../lib/input-masks';
import { addDays, customPeriod } from '../lib/period';
import {
  CashForecastQuery,
  FORECAST_COST_GROUP_LABELS,
  FORECAST_KIND_LABELS,
  forecastWindow,
  weekLabel,
  type CashForecastResult,
} from '../api/forecast.api';

// Entrada e saída (D-26/D-27): os valores são texto, então usam os tons 700 (4,5:1, WCAG AA);
// verde e laranja 500 ficam para gráficos e para o ponto dos selos.
const INFLOW_TEXT = 'text-success-700';
const OUTFLOW_TEXT = 'text-outflow-700';
const TOTAL_VALUE = 'text-[22px] leading-8 font-semibold tabular-nums whitespace-nowrap';

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v.replace('-', ''))}`;
const signed = (v: string) => (Number(v) < 0 ? `−${brl(v)}` : brl(v));

function ddMm(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

type ForecastPreset = 7 | 15 | 30 | 'custom';

const FORECAST_PRESETS: { value: 7 | 15 | 30; label: string }[] = [
  { value: 7, label: '7 dias' },
  { value: 15, label: '15 dias' },
  { value: 30, label: '30 dias' },
];

/** Período da previsão: 7, 15 ou 30 dias a partir de hoje (padrão 30) ou personalizado. `to` é exclusivo. */
function ForecastPeriodFilter({
  preset,
  onChange,
}: {
  preset: ForecastPreset;
  onChange: (preset: ForecastPreset, range: { from: string; to: string }) => void;
}) {
  const [customOpen, setCustomOpen] = useState(preset === 'custom');
  const [fromBr, setFromBr] = useState('');
  const [toBr, setToBr] = useState('');
  const fromIso = brDateToIso(fromBr);
  const toIso = brDateToIso(toBr);

  return (
    <div className="flex flex-col gap-sm">
      <div role="group" aria-label="Período" className="flex flex-wrap gap-xs">
        {FORECAST_PRESETS.map((p) => {
          const active = !customOpen && preset === p.value;
          return (
            <Button
              key={p.value}
              type="button"
              variant={active ? 'default' : 'outline'}
              className={cn(active && SEGMENT_SELECTED_CLASS)}
              aria-pressed={active}
              data-testid={`forecast-preset-${p.value}`}
              onClick={() => {
                setCustomOpen(false);
                onChange(p.value, forecastWindow(undefined, undefined, p.value));
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
          data-testid="forecast-preset-custom"
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
              className="w-[150px] tabular-nums"
              placeholder="dd/mm/aaaa"
              inputMode="numeric"
              value={fromBr}
              onChange={(e) => setFromBr(maskDateBR(e.target.value))}
              data-testid="forecast-custom-from"
            />
          </label>
          <label className={cn('flex flex-col gap-xs', FIELD_LABEL_CLASS)}>
            Até
            <Input
              className="w-[150px] tabular-nums"
              placeholder="dd/mm/aaaa"
              inputMode="numeric"
              value={toBr}
              onChange={(e) => setToBr(maskDateBR(e.target.value))}
              data-testid="forecast-custom-to"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={fromIso === null || toIso === null}
            data-testid="forecast-custom-apply"
            onClick={() => {
              if (!fromIso || !toIso) return;
              onChange('custom', customPeriod(fromIso, toIso));
            }}
          >
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}

export function PrevisaoPage() {
  const canRead = useHasPermission('financial.read');
  const [preset, setPreset] = useState<ForecastPreset>(30);
  const [range, setRange] = useState(() => forecastWindow());
  const { data, error, refetch } = useQuery<CashForecastResult>(CashForecastQuery, {
    variables: range,
    skip: !canRead,
  });
  const forecast = data?.cashForecast;
  const rangeLabel = `${isoToBrDate(range.from)} a ${isoToBrDate(addDays(range.to, -1))}`;

  return (
    <div className="flex flex-col gap-md">
      <PageHeader
        title="Previsão de caixa"
        breadcrumbs={[{ label: 'Financeiro', to: '/financeiro' }, { label: 'Previsão de caixa' }]}
      />
      <p className="-mt-md text-body text-neutral-500">
        Agendamentos confirmados e parcelas de contratos a receber, menos custos: profissional (comissões estimadas), operacional (outros custos dos pacotes, como lanche, champagne e assistente, uma vez por contrato na data do evento) e fixo (despesas fixas).
      </p>
      {canRead && (
        <div className="flex flex-col gap-xs">
          <ForecastPeriodFilter
            preset={preset}
            onChange={(p, r) => {
              setPreset(p);
              setRange(r);
            }}
          />
          <p className="text-data tabular-nums text-neutral-500" data-testid="forecast-range">
            Período: {rangeLabel}
          </p>
        </div>
      )}

      {!canRead ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-md text-body text-neutral-600">
          Você não tem acesso ao financeiro.
        </div>
      ) : error && !forecast ? (
        <Alert variant="destructive">
          <AlertDescription>
            Não foi possível carregar a previsão.
            {error.graphQLErrors[0]?.message ? ` ${error.graphQLErrors[0].message}` : ''}{' '}
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
          <div
            data-testid="forecast-totals"
            className={cn(
              'grid grid-cols-1 divide-y divide-neutral-200 rounded-lg border border-neutral-200',
              'bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0',
            )}
          >
            <div className="p-sm sm:px-md">
              <p className="text-overline uppercase text-neutral-500">Entradas previstas</p>
              <p className={cn(TOTAL_VALUE, INFLOW_TEXT)}>{brl(forecast.inflowTotal)}</p>
            </div>
            <div className="p-sm sm:px-md">
              <p className="text-overline uppercase text-neutral-500">Saídas previstas</p>
              <p className={cn(TOTAL_VALUE, OUTFLOW_TEXT)}>{brl(forecast.outflowTotal)}</p>
            </div>
            <div className="p-sm sm:px-md">
              <p className="text-overline uppercase text-neutral-500">Saldo previsto</p>
              <p
                className={cn(
                  TOTAL_VALUE,
                  Number(forecast.balance) < 0 ? OUTFLOW_TEXT : 'text-neutral-800',
                )}
              >
                {signed(forecast.balance)}
              </p>
            </div>
          </div>
          <div
            className="rounded-lg border border-neutral-200 bg-white p-md shadow-sm"
            data-testid="forecast-cost-groups"
            aria-label="Saídas por grupo de custo"
          >
            <h2 className="mb-sm font-serif text-headline-sm text-neutral-800">
              Saídas por grupo de custo
            </h2>
            <dl className="grid grid-cols-1 gap-md sm:grid-cols-3">
              {(
                [
                  ['professional', forecast.professionalOutflowTotal],
                  ['operational', forecast.operationalOutflowTotal],
                  ['fixed', forecast.fixedOutflowTotal],
                ] as const
              ).map(([group, value]) => (
                <div key={group}>
                  <dt className="text-overline uppercase text-neutral-500">
                    {FORECAST_COST_GROUP_LABELS[group]}
                  </dt>
                  <dd
                    className={cn(
                      'text-[17px] leading-6 font-semibold tabular-nums whitespace-nowrap',
                      OUTFLOW_TEXT,
                    )}
                  >
                    {brl(value)}
                  </dd>
                </div>
              ))}
            </dl>
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
                className="rounded-lg border border-neutral-200 bg-white p-md shadow-sm"
                aria-label={`Semana ${i + 1}`}
              >
                <h2 className="font-serif text-headline-sm text-neutral-800">
                  Semana {i + 1} · {weekLabel(b.start, b.end)}
                </h2>
                <p className="text-body tabular-nums text-neutral-600">
                  Entradas {brl(b.inflow)} · Saídas {brl(b.outflow)} · Saldo {signed(b.balance)}
                </p>
                <p
                  className="mb-sm text-[12px] leading-4 tabular-nums text-neutral-500"
                  data-testid={`forecast-week-groups-${i + 1}`}
                >
                  Custo profissional {brl(b.professionalOutflow)} · Custo operacional {brl(b.operationalOutflow)} ·
                  Custo fixo {brl(b.fixedOutflow)}
                </p>
                {items.length === 0 ? (
                  <p className="text-body text-neutral-500">Nada previsto nesta semana.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Grupo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it, idx) => (
                        <TableRow key={`${it.kind}-${it.refId ?? idx}-${idx}`}>
                          <TableCell className="tabular-nums">{ddMm(it.date)}</TableCell>
                          <TableCell>
                            <Badge variant={it.direction === 'in' ? 'success' : 'outflow'}>
                              {FORECAST_KIND_LABELS[it.kind]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {it.costGroup ? (
                              <Badge variant="secondary">{FORECAST_COST_GROUP_LABELS[it.costGroup]}</Badge>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="min-w-[220px]">
                            <span>{it.label}</span>{' '}
                            {it.overdue && <Badge variant="destructive">em atraso</Badge>}{' '}
                            {it.withoutProfessional && (
                              <Badge variant="secondary">estimada — sem profissional definido</Badge>
                            )}{' '}
                            {it.noRule && <Badge variant="secondary">sem regra de comissão</Badge>}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-right tabular-nums whitespace-nowrap',
                              it.direction === 'in' ? INFLOW_TEXT : OUTFLOW_TEXT,
                            )}
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

          <footer className="flex flex-col gap-xs text-body text-neutral-600">
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
