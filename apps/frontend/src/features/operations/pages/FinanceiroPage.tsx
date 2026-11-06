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

type Granularity = 'day' | 'week' | 'month';

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
];

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

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
    <article className="rounded-md border border-neutral-200 bg-white p-md">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-semibold text-neutral-800" data-testid={id}>
        {value}
      </p>
      {extra && (
        <p className="text-xs font-semibold text-primary-700 mt-xs" data-testid={`${id}-extra`}>
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
                  size="sm"
                  variant={granularity === g.value ? 'default' : 'outline'}
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
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-md">
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
                className="rounded-md border border-neutral-200 bg-white p-md"
                data-testid="financial-chart"
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip
                      formatter={(v: number) =>
                        `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      }
                    />
                    <Legend />
                    <Bar dataKey="billed" name="Faturado" fill="#570080" isAnimationActive={false} />
                    <Bar dataKey="received" name="Recebido" fill="#1B7A43" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </section>

              <section className="rounded-md border border-neutral-200 bg-white p-md">
                <h2 className="text-sm font-semibold text-neutral-800 mb-sm">
                  Recebido por forma de pagamento
                </h2>
                {summary.receivedByMethod.length === 0 ? (
                  <p className="text-sm text-neutral-500">Nenhum recebimento no período.</p>
                ) : (
                  <table className="w-full text-sm" data-testid="received-by-method">
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
                            <td className="py-xs">{paymentMethodLabel(m.method)}</td>
                            <td className="py-xs text-right font-medium">{brl(m.total)}</td>
                            <td className="py-xs text-right text-neutral-500">{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )}

          <section className="rounded-md border border-neutral-200 bg-white p-md">
            <h2 className="text-sm font-semibold text-neutral-800 mb-sm">Lançamentos</h2>
            {movements.loading ? (
              <Skeleton className="h-16 w-full" />
            ) : movements.error ? (
              <p className="text-sm text-error-600">Não foi possível carregar os lançamentos.</p>
            ) : (movements.data?.cashMovements ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhum lançamento no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="cash-movements">
                  <thead>
                    <tr className="text-left text-xs text-neutral-500">
                      <th className="py-xs">Data</th>
                      <th>Tipo</th>
                      <th>Forma</th>
                      <th>Cliente</th>
                      <th>Origem</th>
                      <th className="text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.data!.cashMovements.map((mv) => {
                      const negative = Number(mv.amount) < 0;
                      const d = new Date(mv.occurredAt);
                      return (
                        <tr key={mv.id} className="border-t border-neutral-100">
                          <td className="py-xs">
                            {d.toLocaleDateString('pt-BR')}{' '}
                            {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td>{cashKindLabel(mv.kind)}</td>
                          <td>{paymentMethodLabel(mv.method)}</td>
                          <td>{mv.clientName ? toDisplayName(mv.clientName) : '—'}</td>
                          <td>{mv.comandaCode ?? mv.contractCode ?? '—'}</td>
                          <td className={`text-right ${negative ? 'text-error-600' : ''}`}>
                            {brl(mv.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
