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
import { useHasPermission } from '../operations-permissions';
import { brDateToIso, isoToBrDate, maskDateBR } from '../lib/input-masks';
import { addDays, customPeriod } from '../lib/period';
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
              size="sm"
              variant={active ? 'default' : 'outline'}
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
          size="sm"
          variant={customOpen ? 'default' : 'outline'}
          aria-pressed={customOpen}
          data-testid="forecast-preset-custom"
          onClick={() => setCustomOpen(true)}
        >
          Personalizado
        </Button>
      </div>
      {customOpen && (
        <div className="flex flex-wrap items-end gap-sm">
          <label className="flex flex-col gap-xs text-xs font-semibold text-neutral-600">
            De
            <Input
              className="h-9 w-[130px] text-sm"
              placeholder="dd/mm/aaaa"
              inputMode="numeric"
              value={fromBr}
              onChange={(e) => setFromBr(maskDateBR(e.target.value))}
              data-testid="forecast-custom-from"
            />
          </label>
          <label className="flex flex-col gap-xs text-xs font-semibold text-neutral-600">
            Até
            <Input
              className="h-9 w-[130px] text-sm"
              placeholder="dd/mm/aaaa"
              inputMode="numeric"
              value={toBr}
              onChange={(e) => setToBr(maskDateBR(e.target.value))}
              data-testid="forecast-custom-to"
            />
          </label>
          <Button
            type="button"
            size="sm"
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
    <div className="p-md">
      <PageHeader
        title="Previsão de caixa"
        breadcrumbs={[{ label: 'Financeiro', to: '/financeiro' }, { label: 'Previsão de caixa' }]}
      />
      <p className="-mt-sm mb-md text-sm text-neutral-600">
        Agendamentos confirmados e parcelas de contratos a receber, menos comissões estimadas e despesas fixas.
      </p>
      {canRead && (
        <div className="mb-md flex flex-col gap-xs">
          <ForecastPeriodFilter
            preset={preset}
            onChange={(p, r) => {
              setPreset(p);
              setRange(r);
            }}
          />
          <p className="text-sm text-neutral-600" data-testid="forecast-range">
            Período: {rangeLabel}
          </p>
        </div>
      )}

      {!canRead ? (
        <div className="rounded-md border border-neutral-200 bg-white p-md text-sm text-neutral-600">
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
