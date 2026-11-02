import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/layout/PageHeader';
import { isPathEnabled } from '@/config/features';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { MembersQuery, type MembersQueryResult } from '@/features/catalog/api/members.api';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import {
  CommissionRecordsQuery,
  CommissionTotalsQuery,
  type CommissionRecordsResult,
  type CommissionTotalsResult,
} from '../api/financial.api';
import { PeriodFilter } from '../components/PeriodFilter';
import { defaultPeriod, type PeriodValue } from '../lib/period-value';

const ALL = '__all__';
const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;
const HEAD = 'text-xs font-semibold text-neutral-500 uppercase tracking-wide';

export function ComissoesCalculadasPage() {
  const { t } = useTranslation();
  const permissions = useAuthStore((s) => s.permissions);
  const roleName = useAuthStore((s) => s.roleName);
  const isProfessional = roleName === 'PROFESSIONAL';
  const canRead = permissions.includes('commissionRecord.read');
  const canReviewRules =
    permissions.includes('commission.write') || roleName === 'ADMIN' || roleName === 'MANAGER';

  const [period, setPeriod] = useState<PeriodValue>(() => defaultPeriod());
  const [memberId, setMemberId] = useState<string>(ALL);

  const members = useQuery<MembersQueryResult>(MembersQuery, { skip: !canRead || isProfessional });
  const professionals = (members.data?.members ?? []).filter((m) => m.isProfessional);

  const filterId = !isProfessional && memberId !== ALL ? memberId : null;

  const totals = useQuery<CommissionTotalsResult>(CommissionTotalsQuery, {
    variables: { from: period.from, to: period.to, memberId: filterId },
    skip: !canRead,
  });
  const showRecords = isProfessional || filterId !== null;
  const records = useQuery<CommissionRecordsResult>(CommissionRecordsQuery, {
    variables: { from: period.from, to: period.to, memberId: filterId },
    skip: !canRead || !showRecords,
  });

  const totalRows = totals.data?.commissionTotals ?? [];
  const hasNoRule = totalRows.some((r) => r.noRuleCount > 0);
  const comandaLinks = isPathEnabled('/comanda');

  return (
    <div className="flex flex-col gap-md">
      <PageHeader
        title={t('operations.commissions.title', 'Comissões calculadas')}
        breadcrumbs={[{ label: 'Financeiro', to: '/financeiro' }, { label: 'Comissões' }]}
        cta={
          <Button variant="outline" size="sm" asChild>
            <Link to="/financeiro">
              <ChevronLeft className="h-4 w-4 mr-xs" />
              Voltar ao Financeiro
            </Link>
          </Button>
        }
      />

      {!canRead ? (
        <div className="rounded-md border border-neutral-200 bg-white p-md text-sm text-neutral-600">
          {t('operations.commissions.noAccess', 'Você não tem acesso às comissões.')}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-md">
            <PeriodFilter value={period} onChange={setPeriod} />
            {!isProfessional && (
              <div className="flex items-center gap-xs">
                <span className="text-sm text-neutral-600 font-medium">
                  {t('operations.commissions.professional', 'Profissional')}:
                </span>
                <Select value={memberId} onValueChange={setMemberId}>
                  <SelectTrigger
                    className="w-[200px] h-9 text-sm"
                    aria-label="Profissional"
                    data-testid="commission-member-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>
                      {t('operations.commissions.allProfessionals', 'Todos')}
                    </SelectItem>
                    {professionals.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {hasNoRule && canReviewRules && (
            <Alert data-testid="commission-no-rule-banner">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t(
                  'operations.commissions.noRuleWarning',
                  'Há itens sem regra de comissão no período. Eles foram registrados com R$ 0,00.',
                )}{' '}
                <Link to="/catalogo/comissoes" className="font-medium underline">
                  {t('operations.commissions.reviewRules', 'Revisar regras de comissão')}
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {totals.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {t('operations.commissions.loadError', 'Não foi possível carregar as comissões.')}
              </AlertDescription>
            </Alert>
          ) : totals.loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
              <Table data-testid="commission-totals">
                <TableHeader>
                  <TableRow className="bg-neutral-50">
                    <TableHead className={HEAD}>{t('operations.commissions.professional', 'Profissional')}</TableHead>
                    <TableHead className={`${HEAD} text-right`}>
                      {t('operations.commissions.item', 'Item')}
                    </TableHead>
                    <TableHead className={`${HEAD} text-right`}>
                      {t('operations.commissions.totalEarned', 'Total ganho')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {totalRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-xl text-neutral-500 text-sm">
                        {t('operations.commissions.empty', 'Nenhuma comissão no período.')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    totalRows.map((r) => (
                      <TableRow key={r.memberId} data-testid={`commission-total-${r.memberId}`}>
                        <TableCell className="text-sm font-medium text-neutral-800">
                          {r.memberName}
                          {r.noRuleCount > 0 && (
                            <Badge variant="warning" className="ml-sm">
                              {t('operations.commissions.noRuleBadge', 'Sem regra')}: {r.noRuleCount}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-neutral-700 text-right">{r.records}</TableCell>
                        <TableCell className="text-sm font-semibold text-neutral-800 text-right">
                          {brl(r.total)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {!showRecords ? (
            <p className="text-xs text-neutral-400 text-center">
              {t('operations.commissions.selectToSee', 'Selecione um profissional para ver os registros.')}
            </p>
          ) : records.loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
              <Table data-testid="commission-records">
                <TableHeader>
                  <TableRow className="bg-neutral-50">
                    <TableHead className={HEAD}>{t('operations.commissions.date', 'Data')}</TableHead>
                    <TableHead className={HEAD}>{t('operations.commissions.comanda', 'Comanda')}</TableHead>
                    <TableHead className={HEAD}>{t('operations.commissions.item', 'Item')}</TableHead>
                    <TableHead className={`${HEAD} text-right`}>{t('operations.commissions.base', 'Preço cheio')}</TableHead>
                    <TableHead className={`${HEAD} text-right`}>{t('operations.commissions.charged', 'Cobrado')}</TableHead>
                    <TableHead className={HEAD}>{t('operations.commissions.rule', 'Regra')}</TableHead>
                    <TableHead className={`${HEAD} text-right`}>{t('operations.commissions.commission', 'Comissão')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(records.data?.commissionRecords ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-xl text-neutral-500 text-sm">
                        {t('operations.commissions.empty', 'Nenhuma comissão no período.')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.data!.commissionRecords.map((r) => {
                      const isReversal = r.kind === 'reversal';
                      const rule = r.noRule
                        ? '—'
                        : r.ruleKind === 'percentage'
                          ? `${formatCurrencyDisplay(r.ruleValue ?? '0')}%`
                          : r.ruleKind
                            ? brl(r.ruleValue ?? '0')
                            : '—';
                      return (
                        <TableRow
                          key={r.id}
                          data-testid={`commission-record-${r.id}`}
                          className={isReversal ? 'italic' : undefined}
                        >
                          <TableCell className="text-sm">
                            {new Date(r.calculatedAt).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-sm">
                            {comandaLinks ? (
                              <Link to={`/comanda/${r.comandaId}`} className="underline">
                                {r.comandaCode}
                              </Link>
                            ) : (
                              r.comandaCode
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.itemName}
                            {isReversal && (
                              <span className="ml-xs text-neutral-500">
                                ({t('operations.commissions.reversal', 'Estorno')})
                              </span>
                            )}
                            {r.reversed && (
                              <Badge variant="outline" className="ml-xs">
                                {t('operations.commissions.reversed', 'Estornada')}
                              </Badge>
                            )}
                            {r.noRule && !isReversal && (
                              <Badge variant="warning" className="ml-xs">
                                {t('operations.commissions.noRuleBadge', 'Sem regra')}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-right">{brl(r.baseAmount)}</TableCell>
                          <TableCell className="text-sm text-right">{brl(r.chargedAmount)}</TableCell>
                          <TableCell className="text-sm">{rule}</TableCell>
                          <TableCell className="text-sm font-semibold text-right">
                            {brl(r.calculatedAmount)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
