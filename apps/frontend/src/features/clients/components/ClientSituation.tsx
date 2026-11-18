import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { CalendarDays, FileText, Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isPathEnabled } from '@/config/features';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import { toAgendaDateParam } from '@/features/operations/lib/agenda-link';
import { APPOINTMENT_STATUS_LABELS } from '@/features/operations/lib/operations-labels';
import { CONTRACT_STATUS_LABEL, GROUP_STATUS_LABEL } from '@/features/bridal/lib/bridal-labels';
import { ClientOverviewQuery } from '../api/clients.api';
import type { ClientOverviewData, ClientOverviewResult } from '../api/clients.api';
import { FROM_STATE, relativeDay } from '../lib/client-links';

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

const ROLE_LABEL: Record<string, string> = {
  bride: 'Noiva',
  debutante: 'Debutante',
  companion: 'Acompanhante',
  responsible: 'Responsável',
};

const KIND_LABEL: Record<string, string> = {
  trial: 'Teste',
  event: 'Dia do evento',
  normal: '',
};

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

function formatHM(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function DayLabel({ date, withTime }: { date: Date; withTime?: boolean }) {
  const rel = relativeDay(date);
  return (
    <span className="tabular-nums">
      {rel ? <strong className="text-primary-900">{rel}</strong> : formatDay(date)}
      {withTime ? ` às ${formatHM(date)}` : ''}
      {rel ? ` (${formatDay(date)})` : ''}
    </span>
  );
}

export function ClientSituation({ clientId }: { clientId: string }) {
  const { data } = useQuery<ClientOverviewResult>(ClientOverviewQuery, {
    variables: { clientId },
    fetchPolicy: 'cache-and-network',
  });
  const o = data?.clientOverview;
  if (!o) return null;
  return <ClientSituationView overview={o} />;
}

export function ClientSituationView({ overview: o }: { overview: ClientOverviewData }) {
  const hasStats = o.stats.completedCount > 0 || Number(o.stats.creditBalance) > 0;
  const hasAnything =
    o.bridalGroups.length > 0 || o.contracts.length > 0 || o.upcomingAppointments.length > 0 || hasStats;
  if (!hasAnything) return null;

  const noivasOn = isPathEnabled('/noivas');
  const contratosOn = isPathEnabled('/contratos');
  const comandaOn = isPathEnabled('/comanda');

  return (
    <section className="mb-md space-y-md" data-testid="client-situation" aria-label="Situação">
      <h2 className="font-serif text-[17px] font-semibold text-neutral-800">Situação</h2>

      {hasStats && (
        <dl
          className="grid grid-cols-2 gap-sm rounded-md border border-neutral-200 bg-white p-md text-sm md:grid-cols-4"
          data-testid="client-stats"
        >
          <Stat label="Atendimentos" value={String(o.stats.completedCount)} />
          <Stat
            label="Último atendimento"
            value={o.stats.lastVisitAt ? formatDay(new Date(o.stats.lastVisitAt)) : '—'}
          />
          <Stat label="Total gasto" value={brl(o.stats.totalSpent)} />
          <Stat label="Crédito" value={brl(o.stats.creditBalance)} />
        </dl>
      )}

      {o.bridalGroups.length > 0 && (
        <div className="grid grid-cols-1 gap-sm md:grid-cols-2" data-testid="client-groups">
          {o.bridalGroups.map((g) => (
            <Card key={g.id} className="max-w-none" data-testid={`client-group-${g.id}`}>
              <CardHeader className="flex-row items-start justify-between gap-sm space-y-0 pb-sm">
                <CardTitle className="flex min-w-0 items-center gap-xs text-[15px]">
                  <Heart className="h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
                  <span className="break-words">{g.name}</span>
                </CardTitle>
                <Badge variant="accent" className="shrink-0">
                  {ROLE_LABEL[g.role] ?? g.role}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-xs text-sm text-neutral-700">
                <p>
                  Dia do evento: <DayLabel date={parseIsoDate(g.eventDate)} />
                  {g.eventTime ? ` às ${g.eventTime}` : ''}
                </p>
                {g.trialDates.length > 0 ? (
                  g.trialDates.map((t) => (
                    <p key={t} data-testid="client-group-trial">
                      Teste: <DayLabel date={new Date(t)} withTime />
                    </p>
                  ))
                ) : (
                  <p className="text-neutral-500">Sem teste agendado.</p>
                )}
                <div className="flex items-center justify-between gap-sm pt-xs">
                  <Badge variant="neutral">{GROUP_STATUS_LABEL[g.status] ?? g.status}</Badge>
                  {noivasOn && (
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <Link to={`/noivas/${g.id}`} state={FROM_STATE}>
                        Abrir grupo
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {o.contracts.length > 0 && (
        <div className="grid grid-cols-1 gap-sm md:grid-cols-2" data-testid="client-contracts">
          {o.contracts.map((c) => (
            <Card key={c.id} className="max-w-none" data-testid={`client-contract-${c.id}`}>
              <CardHeader className="flex-row items-start justify-between gap-sm space-y-0 pb-sm">
                <CardTitle className="flex min-w-0 items-center gap-xs text-[15px]">
                  <FileText className="h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
                  <span className="tabular-nums">{c.code}</span>
                </CardTitle>
                <Badge variant="neutral" className="shrink-0">
                  {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-xs text-sm text-neutral-700">
                <p className="tabular-nums">
                  Pago {brl(c.paid)} de {brl(c.totalAmount)}
                </p>
                <p className="font-semibold tabular-nums">Saldo: {brl(c.balance)}</p>
                {c.nextDueDate && c.nextDueAmount && (
                  <p className="tabular-nums text-neutral-500">
                    Próxima parcela: {brl(c.nextDueAmount)} em {formatDay(parseIsoDate(c.nextDueDate))}
                  </p>
                )}
                {contratosOn && (
                  <div className="flex justify-end pt-xs">
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <Link to={`/contratos/${c.id}`} state={FROM_STATE}>
                        Abrir contrato
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {o.upcomingAppointments.length > 0 && (
        <Card className="max-w-none" data-testid="client-upcoming">
          <CardHeader className="pb-sm">
            <CardTitle className="flex items-center gap-xs text-[15px]">
              <CalendarDays className="h-4 w-4 text-primary-700" aria-hidden="true" />
              Próximos atendimentos
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-neutral-200">
            {o.upcomingAppointments.map((a) => {
              const start = new Date(a.startsAt);
              const kind = KIND_LABEL[a.kind];
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-sm py-sm text-sm"
                  data-testid="client-upcoming-item"
                >
                  <Link
                    to={`/agenda?data=${toAgendaDateParam(start)}&visao=day`}
                    className="min-w-0 flex-1 text-neutral-800 hover:underline"
                  >
                    <span className="block font-semibold">
                      <DayLabel date={start} withTime />
                    </span>
                    <span className="block text-neutral-600">
                      {kind ? `${kind} — ` : ''}
                      {a.serviceName} · {a.professionalName}
                      {a.status !== 'scheduled' ? ` · ${APPOINTMENT_STATUS_LABELS[a.status] ?? a.status}` : ''}
                    </span>
                  </Link>
                  {a.comandaId && comandaOn && (
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <Link to={`/comanda/${a.comandaId}`} state={FROM_STATE}>
                        Abrir comanda
                      </Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-neutral-800">{value}</dd>
    </div>
  );
}
