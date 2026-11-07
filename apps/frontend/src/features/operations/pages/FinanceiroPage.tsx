import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { useHasPermission } from '../operations-permissions';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import {
  CashMovementsQuery,
  FinancialSummaryQuery,
  type CashMovementsResult,
  type FinancialSummaryResult,
} from '../api/financial.api';
import { PeriodFilter } from '../components/PeriodFilter';
import { defaultPeriod, type PeriodValue } from '../lib/period-value';
import { cashKindLabel, paymentMethodLabel } from '../lib/operations-labels';
import { toDisplayName } from '@/lib/format-name';
import { cn } from '@/lib/utils';
import {
  CHART_COLORS,
  CHART_GRID_STROKE,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  SEGMENT_SELECTED_CLASS,
} from '../lib/chart-theme';

type Granularity = 'day' | 'week' | 'month';

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
];

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

/** Valor com sinal na frente ("+ R$ 10,00" / "- R$ 10,00"), como no Stitch. */
function signedBrl(cents: number): string {
  const abs = (Math.abs(cents) / 100).toFixed(2);
  return `${cents < 0 ? '-' : '+'} ${brl(abs)}`;
}

const toCents = (v: string) => Math.round(Number(v) * 100);

// Blocos no padrão da Previsão de caixa (D-26): 8 px, borda #E5E7EB e sombra leve.
const BLOCK_CLASS = 'rounded-lg border border-neutral-200 bg-white shadow-sm';
const SECTION_TITLE_CLASS = 'text-headline-sm font-semibold text-neutral-800';
const TH_CLASS = 'px-sm py-xs text-left text-overline uppercase text-neutral-500';
const TD_CLASS = 'px-sm py-sm text-body text-neutral-800';
// Valor em texto pequeno: tons 700 (D-27); saída em laranja, nunca em vermelho de erro.
const valueColor = (cents: number) => (cents < 0 ? 'text-outflow-700' : 'text-success-700');

function kindVariant(kind: string): 'accent' | 'secondary' {
  return kind.startsWith('contract') ? 'accent' : 'secondary';
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function bucketLabel(bucketStart: string, granularity: Granularity): string {
  const [y, m, d] = bucketStart.slice(0, 10).split('-');
  return granularity === 'month' ? `${m}/${y}` : `${d}/${m}`;
}

function Kpi({
  id,
  label,
  hint,
  hintId,
  value,
  extra,
}: {
  id: string;
  label: string;
  hint?: string;
  hintId?: string;
  value: string;
  extra?: string;
}) {
  return (
    <article className={cn(BLOCK_CLASS, 'p-sm')}>
      <p className="text-overline uppercase text-neutral-500">{label}</p>
      <p
        className="mt-xs text-headline-md font-semibold tabular-nums whitespace-nowrap text-neutral-800"
        data-testid={id}
      >
        {value}
      </p>
      {extra && (
        <p className="text-[12px] font-semibold text-primary-700 mt-xs" data-testid={`${id}-extra`}>
          {extra}
        </p>
      )}
      {hint && (
        <p className="text-xs text-neutral-600 mt-xs" data-testid={hintId}>
          {hint}
        </p>
      )}
    </article>
  );
}

export function FinanceiroPage() {
  const canRead = useHasPermission('financial.read');

  const [period, setPeriod] = useState<PeriodValue>(() => defaultPeriod());
  const [granularity, setGranularity] = useState<Granularity>('day');

  const rangeDays = daysBetween(period.from, period.to);
  useEffect(() => {
    if (rangeDays > 62 && granularity === 'day') setGranularity('week');
  }, [rangeDays, granularity]);

  const { data, loading, error } = useQuery<FinancialSummaryResult>(FinancialSummaryQuery, {
    variables: { from: period.from, to: period.to, granularity },
    skip: !canRead,
  });
  const movements = useQuery<CashMovementsResult>(CashMovementsQuery, {
    variables: { from: period.from, to: period.to },
    skip: !canRead,
  });

  const summary = data?.financialSummary;

  const chartData = useMemo(
    () =>
      (summary?.buckets ?? []).map((b) => ({
        label: bucketLabel(b.bucketStart, granularity),
        billed: Number(b.billed),
        received: Number(b.received),
      })),
    [summary, granularity],
  );

  const receivedTotalNum = Number(summary?.receivedTotal ?? 0);

  const cashList = useMemo(() => movements.data?.cashMovements ?? [], [movements.data]);
  const totals = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const mv of cashList) {
      const c = toCents(mv.amount);
      if (c < 0) outflow += c;
      else inflow += c;
    }
    return { inflow, outflow, balance: inflow + outflow };
  }, [cashList]);

  return (
    <>
      <PageHeader
        title="Financeiro"
        breadcrumbs={[{ label: 'Financeiro' }, { label: 'Visão geral' }]}
      />

      {!canRead ? (
        <div className="rounded-md border border-neutral-200 bg-white p-md text-sm text-neutral-600">
          Você não tem acesso ao financeiro.
        </div>
      ) : (
        <div className="flex flex-col gap-lg">
          <div
            data-testid="financeiro-filtros"
            className="flex flex-col gap-sm md:flex-row md:flex-wrap md:items-end md:gap-md"
          >
            <PeriodFilter value={period} onChange={setPeriod} />
            <div role="group" aria-label="Agrupar por" className="flex gap-xs">
              {GRANULARITIES.map((g) => (
                <Button
                  key={g.value}
                  type="button"
                  variant={granularity === g.value ? 'default' : 'outline'}
                  className={cn(granularity === g.value && SEGMENT_SELECTED_CLASS)}
                  aria-pressed={granularity === g.value}
                  data-testid={`granularity-${g.value}`}
                  onClick={() => setGranularity(g.value)}
                >
                  {g.label}
                </Button>
              ))}
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>Não foi possível carregar o financeiro.</AlertDescription>
            </Alert>
          ) : loading || !summary ? (
            <div className="flex flex-col gap-md" aria-busy="true">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : (
            <>
              <div data-testid="financeiro-kpis" className="grid grid-cols-2 lg:grid-cols-5 gap-sm">
                <Kpi
                  id="kpi-billed"
                  label="Faturado"
                  hintId="card-hint-faturado"
                  hint="Comandas fechadas no período mais os pagamentos de contrato do período."
                  value={brl(summary.billedTotal)}
                  extra={
                    Number(summary.contractBilledTotal) > 0
                      ? `inclui ${brl(summary.contractBilledTotal)} de contratos`
                      : undefined
                  }
                />
                <Kpi
                  id="kpi-received"
                  label="Recebido"
                  hintId="card-hint-recebido"
                  hint="Dinheiro que entrou no período: sinais, pagamentos de comanda e parcelas de contrato, menos estornos, troco e devoluções. Pode ser diferente do faturado, porque o sinal entra antes de a comanda fechar."
                  value={brl(summary.receivedTotal)}
                />
                <Kpi
                  id="kpi-closed-comandas"
                  label="Comandas fechadas (sem contratos)"
                  hintId="card-hint-comandas"
                  hint="Só comandas com valor a pagar; serviços cobertos por contrato entram em Faturado."
                  value={String(summary.closedComandas)}
                />
                <Kpi
                  id="kpi-average-ticket"
                  label="Ticket médio"
                  hintId="card-hint-ticket"
                  hint="Faturado das comandas dividido pelas comandas fechadas."
                  value={brl(summary.averageTicket)}
                />
                <Kpi
                  id="kpi-commissions"
                  label="Comissões"
                  value={brl(summary.commissionsTotal)}
                />
              </div>

              <section
                aria-label="Faturado e recebido por período"
                className={cn(BLOCK_CLASS, 'p-md')}
                data-testid="financial-chart"
              >
                <h2 className={cn(SECTION_TITLE_CLASS, 'mb-sm')}>Faturado e recebido</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={CHART_TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(v: number) =>
                        `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      }
                    />
                    <Legend />
                    <Bar
                      dataKey="billed"
                      name="Faturado"
                      fill={CHART_COLORS.billed}
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="received"
                      name="Recebido"
                      fill={CHART_COLORS.received}
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </section>

              <section className={cn(BLOCK_CLASS, 'p-md')}>
                <h2 className={cn(SECTION_TITLE_CLASS, 'mb-sm')}>Recebido por forma de pagamento</h2>
                {summary.receivedByMethod.length === 0 ? (
                  <p className="text-body text-neutral-500">Nenhum recebimento no período.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-neutral-200">
                    <table className="w-full" data-testid="received-by-method">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className={TH_CLASS}>Forma</th>
                          <th className={cn(TH_CLASS, 'text-right')}>Valor</th>
                          <th className={cn(TH_CLASS, 'text-right')}>Parte</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.receivedByMethod.map((m) => {
                          const pct =
                            receivedTotalNum > 0
                              ? ((Number(m.total) / receivedTotalNum) * 100).toFixed(1).replace('.', ',')
                              : '0,0';
                          return (
                            <tr
                              key={m.method}
                              data-testid={`received-method-${m.method}`}
                              className="border-t border-neutral-100"
                            >
                              <td className={TD_CLASS}>{paymentMethodLabel(m.method)}</td>
                              <td
                                className={cn(
                                  TD_CLASS,
                                  'text-right font-semibold tabular-nums whitespace-nowrap',
                                )}
                              >
                                {brl(m.total)}
                              </td>
                              <td
                                className={cn(
                                  TD_CLASS,
                                  'text-right tabular-nums whitespace-nowrap text-neutral-500',
                                )}
                              >
                                {pct}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          <section className="flex flex-col gap-sm">
            <div className="flex flex-col gap-xs md:flex-row md:items-baseline md:justify-between md:gap-md">
              <h2 className={SECTION_TITLE_CLASS}>Lançamentos</h2>
              {!movements.loading && !movements.error && cashList.length > 0 && (
                <p
                  data-testid="cash-movements-totals"
                  className="flex flex-wrap items-baseline gap-x-sm gap-y-xs text-body text-neutral-500"
                >
                  <span>
                    Saldo do período{' '}
                    <span
                      data-testid="cash-totals-balance"
                      className={cn(
                        'font-semibold tabular-nums whitespace-nowrap',
                        totals.balance < 0 ? 'text-outflow-700' : 'text-neutral-800',
                      )}
                    >
                      {totals.balance < 0 ? signedBrl(totals.balance) : brl((totals.balance / 100).toFixed(2))}
                    </span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Entradas{' '}
                    <span
                      data-testid="cash-totals-in"
                      className="font-semibold tabular-nums whitespace-nowrap text-success-700"
                    >
                      {signedBrl(totals.inflow)}
                    </span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Saídas{' '}
                    <span
                      data-testid="cash-totals-out"
                      className="font-semibold tabular-nums whitespace-nowrap text-outflow-700"
                    >
                      {totals.outflow < 0 ? signedBrl(totals.outflow) : brl('0.00')}
                    </span>
                  </span>
                </p>
              )}
            </div>
            {movements.loading ? (
              <Skeleton className="h-16 w-full" />
            ) : movements.error ? (
              <p className="text-body text-error-700">Não foi possível carregar os lançamentos.</p>
            ) : cashList.length === 0 ? (
              <p className={cn(BLOCK_CLASS, 'p-md text-body text-neutral-500')}>
                Nenhum lançamento no período.
              </p>
            ) : (
              <>
                <ul data-testid="cash-movements-cards" className="flex flex-col gap-sm md:hidden">
                  {cashList.map((mv) => {
                    const cents = toCents(mv.amount);
                    const d = new Date(mv.occurredAt);
                    const origem = mv.comandaCode ?? mv.contractCode;
                    return (
                      <li key={mv.id} className={cn(BLOCK_CLASS, 'p-sm')}>
                        <div className="flex items-start justify-between gap-sm">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-xs text-[12px] text-neutral-500">
                              <span className="tabular-nums">
                                {d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              </span>
                              <Badge variant={kindVariant(mv.kind)}>{cashKindLabel(mv.kind)}</Badge>
                              <span>{paymentMethodLabel(mv.method)}</span>
                            </div>
                            {mv.clientName && (
                              <p className="mt-xs break-words text-body font-medium text-neutral-800">
                                {toDisplayName(mv.clientName)}
                              </p>
                            )}
                            {origem && (
                              <p className="text-[12px] text-neutral-500 tabular-nums">{origem}</p>
                            )}
                          </div>
                          <span
                            className={cn(
                              'shrink-0 text-body font-semibold tabular-nums whitespace-nowrap',
                              valueColor(cents),
                            )}
                          >
                            {signedBrl(cents)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className={cn(BLOCK_CLASS, 'hidden overflow-x-auto md:block')}>
                  <table className="w-full" data-testid="cash-movements">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className={TH_CLASS}>Data</th>
                        <th className={TH_CLASS}>Tipo</th>
                        <th className={TH_CLASS}>Forma</th>
                        <th className={TH_CLASS}>Cliente</th>
                        <th className={TH_CLASS}>Origem</th>
                        <th className={cn(TH_CLASS, 'text-right')}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashList.map((mv) => {
                        const cents = toCents(mv.amount);
                        const d = new Date(mv.occurredAt);
                        return (
                          <tr key={mv.id} className="h-10 border-t border-neutral-100">
                            <td className={cn(TD_CLASS, 'tabular-nums whitespace-nowrap')}>
                              {d.toLocaleDateString('pt-BR')}{' '}
                              {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className={TD_CLASS}>
                              <Badge variant={kindVariant(mv.kind)}>{cashKindLabel(mv.kind)}</Badge>
                            </td>
                            <td className={TD_CLASS}>{paymentMethodLabel(mv.method)}</td>
                            <td className={TD_CLASS}>
                              {mv.clientName ? toDisplayName(mv.clientName) : '—'}
                            </td>
                            <td className={cn(TD_CLASS, 'tabular-nums')}>
                              {mv.comandaCode ?? mv.contractCode ?? '—'}
                            </td>
                            <td
                              data-testid={`cash-movement-value-${mv.id}`}
                              className={cn(
                                TD_CLASS,
                                'text-right font-semibold tabular-nums whitespace-nowrap',
                                valueColor(cents),
                              )}
                            >
                              {signedBrl(cents)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
