import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { isPathEnabled } from '@/config/features';
import { NATIVE_SELECT_CLASS } from '@/lib/field-classes';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import { ClientHistoryQuery } from '../api/clients.api';
import type { ClientHistoryResult, ClientOpenComandaData } from '../api/clients.api';
import { FROM_STATE, historyHref } from '../lib/client-links';

const KIND_OPTIONS: [string, string][] = [
  ['all', 'Tudo'],
  ['appointment', 'Atendimentos'],
  ['comanda', 'Comandas'],
  ['product', 'Produtos'],
];

const KIND_LABEL: Record<string, string> = {
  appointment: 'Atendimento',
  comanda: 'Comanda',
  product: 'Produto',
  contract_payment: 'Contrato',
};

function OpenComandaCard({ comanda: c }: { comanda: ClientOpenComandaData }) {
  const { t } = useTranslation();
  const when = new Date(c.firstAppointmentAt ?? c.openedAt);
  const body = (
    <CardContent className="flex items-start justify-between gap-sm p-sm">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-xs">
          <span className="text-sm font-semibold text-neutral-800">{c.code}</span>
          <Badge variant="warning">{t('clients.history.open.badge')}</Badge>
        </div>
        {c.serviceNames.length > 0 && (
          <span className="block break-words text-sm text-neutral-800">
            {c.serviceNames.join(', ')}
          </span>
        )}
        {c.professionalNames.length > 0 && (
          <span className="block text-[12px] text-neutral-500">
            {c.professionalNames.join(', ')}
          </span>
        )}
        <span className="block text-[12px] tabular-nums text-neutral-500">
          {when.toLocaleDateString('pt-BR')} ·{' '}
          {when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-800">
        R$ {formatCurrencyDisplay(c.total)}
      </span>
    </CardContent>
  );
  return (
    <Card data-testid="client-open-comanda" className="border-neutral-200">
      {isPathEnabled('/comanda') ? (
        <Link to={`/comanda/${c.id}`} state={FROM_STATE} className="block hover:bg-neutral-50">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

/**
 * Histórico real da cliente: bloco "Comandas abertas" no topo e, abaixo, atendimentos, comandas
 * (fechadas e abertas) e pagamentos de contrato.
 */
export function ClientHistoryTab({
  clientId,
  openComandas = [],
}: {
  clientId: string;
  openComandas?: ClientOpenComandaData[];
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filters = {
    kind,
    ...(from ? { fromDate: new Date(`${from}T00:00:00`).toISOString() } : {}),
    ...(to ? { toDate: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
  };
  const { data, loading } = useQuery<ClientHistoryResult>(ClientHistoryQuery, {
    variables: { clientId, filters },
    fetchPolicy: 'cache-and-network',
  });
  const items = data?.clientHistory ?? [];

  return (
    <div className="space-y-lg">
      {openComandas.length > 0 && (
        <section className="space-y-sm" data-testid="client-open-comandas">
          <h3 className="text-base font-semibold text-neutral-800">
            {t('clients.history.open.heading')}
          </h3>
          {openComandas.map((c) => (
            <OpenComandaCard key={c.id} comanda={c} />
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 gap-md md:grid-cols-3">
        <div>
          <label htmlFor="hist-from" className="mb-1 block text-sm font-semibold text-neutral-500">
            {t('clients.history.filters.period')} (de)
          </label>
          <input
            id="hist-from"
            type="date"
            className={NATIVE_SELECT_CLASS}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="hist-to" className="mb-1 block text-sm font-semibold text-neutral-500">
            {t('clients.history.filters.period')} (até)
          </label>
          <input
            id="hist-to"
            type="date"
            className={NATIVE_SELECT_CLASS}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="hist-kind" className="mb-1 block text-sm font-semibold text-neutral-500">
            {t('clients.history.filters.kind')}
          </label>
          <select
            id="hist-kind"
            className={NATIVE_SELECT_CLASS}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {KIND_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && !data ? (
        <Skeleton className="h-40" />
      ) : items.length === 0 && openComandas.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-md py-2xl text-center">
          <Clock className="h-12 w-12 text-neutral-500" aria-hidden="true" />
          <h3 className="text-base font-semibold text-neutral-800">
            {t('clients.history.empty.heading')}
          </h3>
          <p className="max-w-md text-sm text-neutral-500">{t('clients.history.empty.body')}</p>
        </div>
      ) : items.length === 0 ? null : (
        <ol className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
          {items.map((item) => {
            const href = historyHref(item);
            const when = new Date(item.occurredAt);
            const body = (
              <>
                <span className="block text-[12px] tabular-nums text-neutral-500">
                  {when.toLocaleDateString('pt-BR')} ·{' '}
                  {when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                  {KIND_LABEL[item.kind] ?? item.kind}
                </span>
                <span className="block break-words text-sm font-medium text-neutral-800">
                  {item.description}
                </span>
                {item.professionalName && (
                  <span className="block text-[12px] text-neutral-500">{item.professionalName}</span>
                )}
              </>
            );
            return (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex items-start justify-between gap-sm p-sm"
                data-testid="client-history-item"
              >
                {href ? (
                  <Link to={href} state={FROM_STATE} className="min-w-0 flex-1 hover:underline">
                    {body}
                  </Link>
                ) : (
                  <div className="min-w-0 flex-1">{body}</div>
                )}
                {item.amount != null && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-800">
                    R$ {formatCurrencyDisplay(item.amount)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
