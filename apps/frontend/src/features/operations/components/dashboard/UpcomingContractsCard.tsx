import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { useBridalPermission } from '@/features/bridal/bridal-permissions';
import { DashboardContractsQuery, type DashboardContractsResult } from '../../api/dashboard.api';
import { upcomingContracts } from '../../lib/operational-dashboard';
import { ORG_TIMEZONE_DEFAULT, todayInTimeZone } from '../../lib/period';
import { useHasPermission } from '../../operations-permissions';
import { BlockError, BlockLoading, LINK_CLASS, SECTION_TITLE_CLASS } from './BlockState';

function ddMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function UpcomingContractsCard() {
  const canContract = useBridalPermission('contract.read');
  const canFinance = useHasPermission('financial.read');
  const { data, error, refetch } = useQuery<DashboardContractsResult>(DashboardContractsQuery, {
    fetchPolicy: 'cache-and-network',
    skip: !canContract,
  });
  if (!canContract) return null;

  const rows = data
    ? upcomingContracts(data.contracts, todayInTimeZone(ORG_TIMEZONE_DEFAULT))
    : null;

  return (
    <Card data-testid="upcoming-contracts" className="max-w-none p-md">
      <div className="mb-sm flex flex-wrap items-baseline justify-between gap-sm">
        <h2 className={SECTION_TITLE_CLASS}>Contratos de noivas próximos</h2>
        <Link to="/contratos" className={LINK_CLASS}>
          Ver todos
        </Link>
      </div>
      {error && !rows ? (
        <BlockError what="os contratos" onRetry={() => void refetch()} />
      ) : !rows ? (
        <BlockLoading testId="upcoming-contracts-loading" rows={2} />
      ) : rows.length === 0 ? (
        <p className="text-body text-neutral-700">Nenhum contrato com evento próximo</p>
      ) : (
        <ul className="flex flex-col gap-sm">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                to={c.href}
                data-testid="contract-row"
                className="flex min-h-[44px] flex-col gap-xs rounded-md bg-neutral-50 p-sm hover:bg-neutral-100"
              >
                <span className="text-overline uppercase text-neutral-700">{c.label}</span>
                <span className="flex items-baseline justify-between gap-sm">
                  <span className="font-serif text-headline-sm font-semibold text-neutral-900">
                    {c.brideName}
                  </span>
                  <span className="whitespace-nowrap text-data tabular-nums text-neutral-900">
                    {ddMmYyyy(c.eventDate)}
                  </span>
                </span>
                {canFinance && (
                  <span className="flex flex-col gap-1">
                    <span className="text-data text-neutral-700">
                      Quitação: <span className="tabular-nums">{c.percent}%</span> quitado
                    </span>
                    <span
                      role="progressbar"
                      aria-label="Quitação do contrato"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={c.percent}
                      className="block h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
                    >
                      <span className="block h-full bg-primary-800" style={{ width: `${c.percent}%` }} />
                    </span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
