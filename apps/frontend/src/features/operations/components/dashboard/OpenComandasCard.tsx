import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import { ComandasQuery, type ComandasQueryResult } from '../../api/comandas.api';
import { openComandaRows } from '../../lib/operational-dashboard';
import { ORG_TIMEZONE_DEFAULT, addDays, todayInTimeZone } from '../../lib/period';
import { useHasPermission } from '../../operations-permissions';
import { BlockError, BlockLoading, SECTION_TITLE_CLASS } from './BlockState';

const MAX_ROWS = 5;
const ROW_LINK = 'inline-flex min-h-[44px] items-center hover:underline';

export function OpenComandasCard() {
  const canRead = useHasPermission('comanda.read');
  const canFinance = useHasPermission('financial.read');
  const today = todayInTimeZone(ORG_TIMEZONE_DEFAULT);
  const { data, error, refetch } = useQuery<ComandasQueryResult>(ComandasQuery, {
    variables: { from: '2000-01-01', to: addDays(today, 1), status: 'open', clientId: null },
    fetchPolicy: 'cache-and-network',
    skip: !canRead,
  });
  if (!canRead) return null;

  const all = data ? openComandaRows(data.comandas) : null;
  const rows = all?.slice(0, MAX_ROWS) ?? null;

  return (
    <Card data-testid="open-comandas" className="max-w-none p-md">
      <div className="mb-sm flex flex-wrap items-baseline justify-between gap-sm">
        <h2 className={SECTION_TITLE_CLASS}>Comandas em aberto</h2>
        {all && <p className="text-data tabular-nums text-neutral-700">{all.length} em aberto</p>}
      </div>
      {error && !rows ? (
        <BlockError what="as comandas" onRetry={() => void refetch()} />
      ) : !rows || !all ? (
        <BlockLoading testId="open-comandas-loading" />
      ) : all.length === 0 ? (
        <p className="text-body text-neutral-700">Nenhuma comanda em aberto</p>
      ) : (
        <div className="flex flex-col">
          <table className="hidden w-full border-collapse text-left md:table">
            <thead>
              <tr className="bg-neutral-50 text-overline uppercase text-neutral-700">
                <th scope="col" className="p-sm font-semibold">Nº</th>
                <th scope="col" className="p-sm font-semibold">Cliente</th>
                <th scope="col" className="p-sm font-semibold">Profissional</th>
                <th scope="col" className="p-sm font-semibold">Itens</th>
                {canFinance && <th scope="col" className="p-sm text-right font-semibold">Total</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-testid="comanda-row" className="border-t border-neutral-200 text-body text-neutral-900">
                  <td className="p-sm tabular-nums">
                    <Link to={r.href} className={ROW_LINK}>{r.code}</Link>
                  </td>
                  <td className="p-sm font-serif text-headline-sm">
                    <Link to={r.href} className={ROW_LINK}>{r.clientName}</Link>
                  </td>
                  <td className="p-sm">{r.professionals.join(', ')}</td>
                  <td className="p-sm text-neutral-700">{r.itemsLabel}</td>
                  {canFinance && (
                    <td className="p-sm text-right tabular-nums">R$ {formatCurrencyDisplay(r.total)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-sm md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md bg-neutral-50 p-sm">
                <Link to={r.href} className="flex min-h-[44px] items-center justify-between gap-sm">
                  <span className="min-w-0">
                    <span className="block text-body font-semibold text-neutral-900">
                      <span className="tabular-nums">{r.code}</span> • {r.clientName}
                    </span>
                    <span className="block truncate text-data text-neutral-700">{r.itemsLabel}</span>
                  </span>
                  {canFinance && (
                    <span className="whitespace-nowrap text-body font-semibold tabular-nums text-neutral-900">
                      R$ {formatCurrencyDisplay(r.total)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/comanda"
            className="mt-sm inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-neutral-100 text-label font-semibold text-neutral-900 md:w-auto md:self-start md:bg-transparent md:px-0 md:text-primary-500 md:hover:underline"
          >
            Ver todas as comandas
          </Link>
        </div>
      )}
    </Card>
  );
}

