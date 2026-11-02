import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import { ComandasQuery, type ComandasQueryResult } from '../api/comandas.api';
import { PeriodFilter } from '../components/PeriodFilter';
import { WalkInDialog } from '../components/comanda/WalkInDialog';
import { COMANDA_STATUS_LABELS } from '../lib/operations-labels';
import { defaultPeriod, type PeriodValue } from '../lib/period-value';

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

const STATUS_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'open', label: 'Abertas' },
  { value: 'closed', label: 'Fechadas' },
  { value: 'cancelled', label: 'Canceladas' },
] as const;

function formatOpenedAt(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

export function ComandaListPage() {
  const { t } = useTranslation();
  const canWrite = useAuthStore((s) => s.permissions.includes('comanda.write'));
  const [period, setPeriod] = useState<PeriodValue>(() => defaultPeriod());
  const [status, setStatus] = useState('');
  const [walkInOpen, setWalkInOpen] = useState(false);

  const { data, loading } = useQuery<ComandasQueryResult>(ComandasQuery, {
    variables: { from: period.from, to: period.to, status: status || null },
    fetchPolicy: 'cache-and-network',
  });
  const rows = data?.comandas ?? [];

  return (
    <div className="flex flex-col gap-md">
      <PageHeader
        title="Comandas"
        breadcrumbs={[{ label: 'Financeiro' }, { label: 'Comandas' }]}
        cta={
          canWrite ? (
            <Button
              type="button"
              className="gap-xs"
              data-testid="comanda-new"
              onClick={() => setWalkInOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t('operations.pos.newComanda', 'Nova comanda')}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-md">
        <PeriodFilter value={period} onChange={setPeriod} />
        <div role="group" aria-label="Status" className="flex flex-wrap gap-xs">
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s.value || 'all'}
              type="button"
              size="sm"
              variant={status === s.value ? 'default' : 'outline'}
              aria-pressed={status === s.value}
              data-testid={`comanda-status-filter-${s.value || 'all'}`}
              onClick={() => setStatus(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="p-md">
              <Skeleton className="h-24 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-md text-sm text-neutral-600" data-testid="comanda-list-empty">
              Nenhuma comanda no período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="comanda-list">
                <thead>
                  <tr className="text-left text-xs text-neutral-600">
                    <th className="p-sm">Código</th>
                    <th>Cliente</th>
                    <th>Aberta em</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                    <th className="p-sm text-right">Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      data-testid={`comanda-row-${c.id}`}
                      className="border-t border-neutral-100"
                    >
                      <td className="p-sm">
                        <Link
                          to={`/comanda/${c.id}`}
                          className="font-semibold text-primary-700 underline"
                        >
                          {c.code}
                        </Link>
                      </td>
                      <td>{c.client.fullName}</td>
                      <td>{formatOpenedAt(c.openedAt)}</td>
                      <td>
                        <Badge variant="outline" className="text-xs">
                          {COMANDA_STATUS_LABELS[c.status] ?? c.status}
                        </Badge>
                      </td>
                      <td className="text-right">{brl(c.total)}</td>
                      <td className="p-sm text-right">{brl(c.paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {walkInOpen && <WalkInDialog open onOpenChange={(o) => !o && setWalkInOpen(false)} />}
    </div>
  );
}
