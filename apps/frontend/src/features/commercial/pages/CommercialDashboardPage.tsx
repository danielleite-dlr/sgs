import { useState, type ReactNode } from 'react';
import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CommercialDashboardQuery,
  formatRate,
  type CommercialDashboard,
} from '../api/reports.api';
import {
  KIND_LABEL,
  formatDateTime,
  formatMoney,
  interactionTypeLabel,
} from '../lib/commercial-labels';

const PERIODS = [7, 30, 90] as const;
const CARD = 'rounded-md border border-neutral-200 bg-white p-md';
const SELECT_CLASS =
  'min-h-[44px] rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm';

function Stat({
  label,
  value,
  to,
  alert,
}: {
  label: string;
  value: number;
  to?: string;
  alert?: boolean;
}) {
  const body = (
    <>
      <p className="text-xs text-neutral-600">{label}</p>
      <p
        className={`text-lg font-bold tabular-nums ${
          alert && value > 0 ? 'text-error-700' : 'text-neutral-800'
        }`}
      >
        {value}
      </p>
    </>
  );
  const cls = `${CARD} block`;
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={CARD}>
      <h2 className="mb-sm font-serif text-base font-bold text-neutral-800">{title}</h2>
      {children}
    </section>
  );
}

export function CommercialDashboardPage() {
  const [periodDays, setPeriodDays] = useState<number>(30);
  const { data, loading, error } = useQuery<{ commercialDashboard: CommercialDashboard }>(
    CommercialDashboardQuery,
    { variables: { periodDays }, fetchPolicy: 'cache-and-network' },
  );
  const d = data?.commercialDashboard;

  return (
    <div>
      <PageHeader
        title="Painel comercial"
        cta={
          <div>
            <label className="sr-only" htmlFor="dash-period">
              Período
            </label>
            <select
              id="dash-period"
              className={SELECT_CLASS}
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  Últimos {p} dias
                </option>
              ))}
            </select>
          </div>
        }
      />

      {error && (
        <p role="alert" className="mb-md text-sm text-error-700">
          Não foi possível carregar o painel.
        </p>
      )}
      {loading && !d && <Skeleton className="h-40 w-full" />}

      {d && (
        <div className="space-y-md">
          <div className="grid grid-cols-2 gap-sm md:grid-cols-5">
            <Stat label="Novos leads hoje" value={d.newLeadsToday} />
            <Stat label="Novos negócios hoje" value={d.newDealsToday} />
            <Stat label="Interações hoje" value={d.interactionsToday} />
            <Stat
              label="Lembretes vencidos"
              value={d.remindersOverdue}
              to="/comercial/lembretes"
              alert
            />
            <Stat label="Lembretes de hoje" value={d.remindersToday} to="/comercial/lembretes" />
          </div>

          <div className="grid grid-cols-1 gap-sm md:grid-cols-2">
            <div className={CARD}>
              <p className="text-xs text-neutral-600">Em negociação</p>
              <p className="text-lg font-bold tabular-nums text-neutral-800">
                {formatMoney(d.openAmount)}
              </p>
            </div>
            <div className={CARD}>
              <p className="text-xs text-neutral-600">Conversão ({d.periodDays} dias)</p>
              <p className="text-lg font-bold tabular-nums text-neutral-800">
                {formatRate(d.conversionRate)}
              </p>
              <p className="text-xs tabular-nums text-neutral-600">
                {d.wonCount} ganho(s) · {formatMoney(d.wonAmount)} · {d.lostCount} perdido(s)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
            <Section title={`Follow-ups pendentes (${d.followUpsPending})`}>
              {d.followUps.length === 0 ? (
                <p className="text-sm text-neutral-600">Nenhum follow-up atrasado.</p>
              ) : (
                <ul className="divide-y divide-neutral-200">
                  {d.followUps.slice(0, 10).map((f) => (
                    <li key={f.dealId} className="flex flex-wrap items-center gap-xs py-xs text-sm">
                      <Link
                        to={`/comercial/leads/${f.leadId}`}
                        className="font-semibold text-primary-700 underline"
                      >
                        {f.leadName}
                      </Link>
                      <span className="text-neutral-600">{KIND_LABEL[f.kind] ?? f.kind}</span>
                      <span className="inline-flex items-center gap-xs">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: f.stageColor }}
                        />
                        {f.stageName}
                      </span>
                      <span className="tabular-nums text-error-700">
                        atrasado desde {formatDateTime(f.overdueSince).slice(0, 5)}
                      </span>
                      {f.assigneeName && (
                        <span className="text-neutral-600">· {f.assigneeName}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Últimas interações">
              {d.lastInteractions.length === 0 ? (
                <p className="text-sm text-neutral-600">Nenhuma interação recente.</p>
              ) : (
                <ul className="divide-y divide-neutral-200">
                  {d.lastInteractions.map((i) => (
                    <li key={i.id} className="py-xs text-sm">
                      <Link
                        to={`/comercial/leads/${i.leadId}`}
                        className="font-semibold text-primary-700 underline"
                      >
                        {i.leadName}
                      </Link>{' '}
                      <span className="text-neutral-600">
                        · {interactionTypeLabel(i.type)} ·{' '}
                        <span className="tabular-nums">{formatDateTime(i.occurredAt)}</span>
                        {i.createdByName ? ` · ${i.createdByName}` : ''}
                      </span>
                      {i.notes && <p className="break-words text-neutral-700">{i.notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <Section title="Funil">
            <div className="h-[220px]" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.stages} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                  <YAxis allowDecimals={false} width={28} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Negócios" isAnimationActive={false}>
                    {d.stages.map((s) => (
                      <Cell key={s.stageId} fill={s.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="mt-sm w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-600">
                  <th className="py-xs font-semibold">Etapa</th>
                  <th className="py-xs text-right font-semibold">Negócios</th>
                  <th className="py-xs text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {d.stages.map((s) => (
                  <tr key={s.stageId} className="border-t border-neutral-200">
                    <td className="py-xs">
                      <span
                        aria-hidden="true"
                        className="mr-xs inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.name}
                    </td>
                    <td className="py-xs text-right tabular-nums">{s.count}</td>
                    <td className="py-xs text-right tabular-nums">{formatMoney(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>
      )}
    </div>
  );
}
