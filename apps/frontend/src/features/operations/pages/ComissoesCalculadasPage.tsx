import { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, FileText, MessageCircle } from 'lucide-react';
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/layout/PageHeader';
import { isPathEnabled } from '@/config/features';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { useHasPermission } from '../operations-permissions';
import { MembersQuery, type MembersQueryResult } from '@/features/catalog/api/members.api';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import {
  CommissionRecordsQuery,
  CommissionTotalsQuery,
  type CommissionRecordsResult,
  type CommissionTotalsResult,
} from '../api/financial.api';
import { PeriodFilter } from '../components/PeriodFilter';
import { CommissionPrintReport, PRINT_BODY_CLASS } from '../components/CommissionPrintReport';
import { defaultPeriod, type PeriodValue } from '../lib/period-value';
import {
  brl,
  buildWhatsAppText,
  formatDay,
  periodLabel,
  reportRows,
  sumMemberTotals,
  whatsAppUrl,
  type CommissionReportInput,
} from '../lib/commission-report';

const ALL = '__all__';
const HEAD = 'text-xs font-semibold text-neutral-500 uppercase tracking-wide';

/** Imprime só o relatório; o título vira o nome sugerido do PDF. */
function printReport(title: string) {
  const body = document.body;
  const previousTitle = document.title;
  const done = () => {
    body.classList.remove(PRINT_BODY_CLASS);
    document.title = previousTitle;
    window.removeEventListener('afterprint', done);
  };
  body.classList.add(PRINT_BODY_CLASS);
  document.title = title;
  window.addEventListener('afterprint', done);
  window.print();
}

export function ComissoesCalculadasPage() {
  const { t } = useTranslation();
  const roleName = useAuthStore((s) => s.roleName);
  const salonName = useAuthStore((s) => s.organizationName);
  const isProfessional = roleName === 'PROFESSIONAL';
  const canRead = useHasPermission('commissionRecord.read');
  const canReviewRules =
    useHasPermission('commission.write') || roleName === 'ADMIN' || roleName === 'MANAGER';

  const [period, setPeriod] = useState<PeriodValue>(() => defaultPeriod());
  const [memberId, setMemberId] = useState<string>(ALL);
  const [showReversals, setShowReversals] = useState(false);

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

  /** Registros em ordem de atendimento (mais antigo primeiro), como no relatório. */
  const recordRows = useMemo(
    () =>
      [...(records.data?.commissionRecords ?? [])].sort(
        (a, b) => new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime(),
      ),
    [records.data],
  );
  /** Uma linha por atendimento: sem pares estornados e com o teste de noiva no dia da noiva. */
  const attendanceRows = useMemo(() => reportRows(recordRows), [recordRows]);
  const tableRows = showReversals ? recordRows : attendanceRows;

  const selectedTotal = isProfessional
    ? totalRows[0]
    : totalRows.find((r) => r.memberId === filterId);
  const selectedName =
    selectedTotal?.memberName ??
    recordRows[0]?.memberName ??
    professionals.find((m) => m.id === filterId)?.displayName ??
    '';

  const report: CommissionReportInput | null =
    showRecords && records.data && selectedName
      ? {
          salonName,
          memberName: selectedName,
          from: period.from,
          to: period.to,
          rows: attendanceRows,
          total: selectedTotal?.total ?? '0.00',
        }
      : null;

  const onPrint = () => {
    if (!report) return;
    printReport(
      `Comissões - ${report.memberName} - ${periodLabel(report.from, report.to).replace(/\//g, '-')}`,
    );
  };
  const onWhatsApp = () => {
    if (!report) return;
    window.open(
      whatsAppUrl(selectedTotal?.memberPhone, buildWhatsAppText(report)),
      '_blank',
      'noopener,noreferrer',
    );
  };

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
                      {t('operations.commissions.services', 'Atendimentos')}
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
                    totalRows.map((r) => {
                      const selected = filterId === r.memberId;
                      const select = isProfessional ? undefined : () => setMemberId(r.memberId);
                      return (
                        <TableRow
                          key={r.memberId}
                          data-testid={`commission-total-${r.memberId}`}
                          data-state={selected ? 'selected' : undefined}
                          onClick={select}
                          className={
                            isProfessional
                              ? undefined
                              : `cursor-pointer ${selected ? 'bg-primary-50' : 'hover:bg-neutral-50'}`
                          }
                        >
                          <TableCell className="text-sm font-medium text-neutral-800">
                            {isProfessional ? (
                              r.memberName
                            ) : (
                              <button
                                type="button"
                                className="text-left font-medium text-primary-700 hover:underline"
                                aria-pressed={selected}
                                aria-label={`Ver atendimentos de ${r.memberName}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMemberId(r.memberId);
                                }}
                              >
                                {r.memberName}
                              </button>
                            )}
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
                      );
                    })
                  )}
                </TableBody>
                {!isProfessional && totalRows.length > 0 && (
                  <TableFooter>
                    <TableRow data-testid="commission-totals-sum">
                      <TableCell className="text-sm font-semibold text-neutral-800">
                        {t('operations.commissions.totalToPay', 'Total a pagar')}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-neutral-800 text-right">
                        {sumMemberTotals(totalRows).records}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-neutral-800 text-right">
                        {brl(sumMemberTotals(totalRows).total)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          )}

          {!showRecords ? (
            <p className="text-xs text-neutral-500 text-center">
              {t(
                'operations.commissions.selectToSee',
                'Clique em uma profissional para ver os atendimentos e gerar o relatório.',
              )}
            </p>
          ) : records.loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-sm">
                <h2 className="text-sm font-semibold text-neutral-800">
                  {selectedName ? `Atendimentos de ${selectedName}` : 'Atendimentos'}
                  {selectedTotal && (
                    <span className="ml-sm font-normal text-neutral-600">
                      · Total {brl(selectedTotal.total)}
                    </span>
                  )}
                </h2>
                <div className="flex flex-wrap gap-xs">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPrint}
                    disabled={!report}
                    data-testid="commission-print"
                  >
                    <FileText className="h-4 w-4 mr-xs" />
                    Gerar relatório (PDF)
                  </Button>
                  {!isProfessional && (
                    <Button
                      size="sm"
                      onClick={onWhatsApp}
                      disabled={!report}
                      data-testid="commission-whatsapp"
                      title={
                        selectedTotal?.memberPhone
                          ? undefined
                          : 'Profissional sem telefone: o WhatsApp vai pedir o contato'
                      }
                    >
                      <MessageCircle className="h-4 w-4 mr-xs" />
                      Enviar por WhatsApp
                    </Button>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-xs text-xs text-neutral-600">
                <input
                  type="checkbox"
                  checked={showReversals}
                  onChange={(e) => setShowReversals(e.target.checked)}
                  data-testid="commission-show-reversals"
                />
                {t(
                  'operations.commissions.showReversals',
                  'Mostrar estornos e lançamentos separados (auditoria)',
                )}
              </label>
              <div className="border border-neutral-200 rounded-lg overflow-x-auto bg-white">
                <Table data-testid="commission-records">
                  <TableHeader>
                    <TableRow className="bg-neutral-50">
                      <TableHead className={HEAD}>{t('operations.commissions.date', 'Data')}</TableHead>
                      <TableHead className={HEAD}>{t('operations.commissions.client', 'Cliente')}</TableHead>
                      <TableHead className={HEAD}>{t('operations.commissions.service', 'Serviço')}</TableHead>
                      {!isProfessional && (
                        <TableHead className={`${HEAD} text-right`}>{t('operations.commissions.charged', 'Cobrado')}</TableHead>
                      )}
                      <TableHead className={`${HEAD} text-right`}>{t('operations.commissions.commission', 'Comissão')}</TableHead>
                      {!isProfessional && (
                        <TableHead className={HEAD}>{t('operations.commissions.rule', 'Regra')}</TableHead>
                      )}
                      <TableHead className={HEAD}>{t('operations.commissions.comanda', 'Comanda')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isProfessional ? 4 : 7} className="text-center py-xl text-neutral-500 text-sm">
                          {t('operations.commissions.empty', 'Nenhuma comissão no período.')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      tableRows.map((r) => {
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
                            <TableCell className="text-sm whitespace-nowrap">
                              {formatDay(r.serviceDate)}
                            </TableCell>
                            <TableCell className="text-sm">{r.clientName ?? '—'}</TableCell>
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
                              {r.note && (
                                <span
                                  className="block text-xs text-neutral-500"
                                  data-testid="commission-record-note"
                                >
                                  {r.note}
                                </span>
                              )}
                              {r.noRule && !isReversal && (
                                <Badge variant="warning" className="ml-xs">
                                  {t('operations.commissions.noRuleBadge', 'Sem regra')}
                                </Badge>
                              )}
                            </TableCell>
                            {!isProfessional && (
                              <TableCell className="text-sm text-right whitespace-nowrap">
                                {brl(r.chargedAmount)}
                              </TableCell>
                            )}
                            <TableCell className="text-sm font-semibold text-right whitespace-nowrap">
                              {brl(r.calculatedAmount)}
                            </TableCell>
                            {!isProfessional && (
                              <TableCell className="text-xs text-neutral-500 whitespace-nowrap">
                                {rule}
                                {r.baseAmount !== r.chargedAmount && (
                                  <span className="block">cheio {brl(r.baseAmount)}</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell className="text-xs text-neutral-500">
                              {comandaLinks ? (
                                <Link to={`/comanda/${r.comandaId}`} className="underline">
                                  {r.comandaCode}
                                </Link>
                              ) : (
                                r.comandaCode
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {report && <CommissionPrintReport report={report} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
