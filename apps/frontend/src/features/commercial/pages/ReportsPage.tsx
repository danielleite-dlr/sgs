import { useMemo, useState, type ReactNode } from 'react';
import { useLazyQuery, useQuery } from '@apollo/client';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CommercialAssigneesQuery,
  CommercialStagesQuery,
  type CommercialMember,
  type CommercialStage,
} from '../api/leads.api';
import {
  CommercialReportQuery,
  ExportCommercialReportQuery,
  formatRate,
  type CommercialReport,
  type CommercialReportFilterInput,
} from '../api/reports.api';
import {
  KIND_LABEL,
  SOURCE_OPTIONS,
  formatMoney,
  formatYmd,
  sourceLabel,
} from '../lib/commercial-labels';
import { downloadBase64File } from '../lib/download-file';

const STATUS_LABEL: Record<string, string> = { open: 'Aberto', won: 'Ganho', lost: 'Perdido' };
const REASON_MESSAGE: Record<string, string> = {
  PERIOD_INVALID: 'Período inválido. Use datas válidas, com no máximo 366 dias.',
  STATUS_INVALID: 'Situação inválida.',
  KIND_INVALID: 'Tipo inválido.',
  SOURCE_INVALID: 'Origem inválida.',
  FORMAT_INVALID: 'Formato de exportação inválido.',
};

const CARD = 'rounded-md border border-neutral-200 bg-white p-md';
const LABEL_CLASS = 'text-xs font-semibold text-neutral-700';
const SELECT_CLASS =
  'mt-xs block min-h-[44px] w-full rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm';

/** Primeiro e último dia do mês corrente no fuso de São Paulo, como AAAA-MM-DD. */
function currentMonthRange(now = new Date()): { from: string; to: string } {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
  const [y, m] = ymd.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

function errorMessage(err: unknown, fallback: string): string {
  const gql = (err as { graphQLErrors?: { extensions?: { reason?: string } }[] } | null)
    ?.graphQLErrors?.[0];
  const reason = gql?.extensions?.reason;
  return (reason && REASON_MESSAGE[reason]) || fallback;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={CARD}>
      <h2 className="mb-sm font-serif text-base font-bold text-neutral-800">{title}</h2>
      {children}
    </section>
  );
}

export function ReportsPage() {
  const initial = useMemo(() => currentMonthRange(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [assignee, setAssignee] = useState('');
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [source, setSource] = useState('');
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);

  const filter: CommercialReportFilterInput = {
    from,
    to,
    assigneeMemberId: assignee || null,
    stageId: stage || null,
    status: status || null,
    kind: kind || null,
    source: source || null,
  };

  const { data, loading, error } = useQuery<{ commercialReport: CommercialReport }>(
    CommercialReportQuery,
    { variables: { filter }, fetchPolicy: 'cache-and-network', skip: !from || !to },
  );
  const stagesQ = useQuery<{ commercialStages: CommercialStage[] }>(CommercialStagesQuery);
  const assigneesQ = useQuery<{ commercialAssignees: CommercialMember[] }>(
    CommercialAssigneesQuery,
  );
  const [runExport] = useLazyQuery<{
    exportCommercialReport: { filename: string; mimeType: string; base64: string };
  }>(ExportCommercialReportQuery, { fetchPolicy: 'no-cache' });

  const report = data?.commercialReport;

  async function doExport(format: 'xlsx' | 'pdf') {
    setExporting(format);
    try {
      const res = await runExport({ variables: { filter, format } });
      const file = res.data?.exportCommercialReport;
      if (res.error || !file) {
        toast.error(errorMessage(res.error, 'Não foi possível gerar o arquivo.'));
        return;
      }
      downloadBase64File(file.filename, file.mimeType, file.base64);
    } catch (e) {
      toast.error(errorMessage(e, 'Não foi possível gerar o arquivo.'));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Relatórios"
        cta={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={exporting !== null}
              onClick={() => void doExport('xlsx')}
            >
              <Download className="mr-xs h-4 w-4" aria-hidden="true" />
              Exportar Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={exporting !== null}
              onClick={() => void doExport('pdf')}
            >
              <Download className="mr-xs h-4 w-4" aria-hidden="true" />
              Exportar PDF
            </Button>
          </>
        }
      />

      <div className="mb-md grid grid-cols-2 gap-sm md:grid-cols-4 lg:grid-cols-7">
        <div>
          <Label className={LABEL_CLASS} htmlFor="rep-from">
            De
          </Label>
          <Input
            id="rep-from"
            type="date"
            className="mt-xs"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <Label className={LABEL_CLASS} htmlFor="rep-to">
            Até
          </Label>
          <Input
            id="rep-to"
            type="date"
            className="mt-xs"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div>
          <Label className={LABEL_CLASS} htmlFor="rep-assignee">
            Responsável
          </Label>
          <select
            id="rep-assignee"
            className={SELECT_CLASS}
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="">Todos</option>
            {(assigneesQ.data?.commercialAssignees ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className={LABEL_CLASS} htmlFor="rep-stage">
            Etapa
          </Label>
          <select
            id="rep-stage"
            className={SELECT_CLASS}
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="">Todas</option>
            {(stagesQ.data?.commercialStages ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className={LABEL_CLASS} htmlFor="rep-status">
            Situação
          </Label>
          <select
            id="rep-status"
            className={SELECT_CLASS}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todas</option>
            {Object.entries(STATUS_LABEL).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className={LABEL_CLASS} htmlFor="rep-kind">
            Tipo
          </Label>
          <select
            id="rep-kind"
            className={SELECT_CLASS}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(KIND_LABEL).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className={LABEL_CLASS} htmlFor="rep-source">
            Origem
          </Label>
          <select
            id="rep-source"
            className={SELECT_CLASS}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">Todas</option>
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-md text-sm text-error-700">
          {errorMessage(error, 'Não foi possível carregar o relatório.')}
        </p>
      )}
      {loading && !report && <Skeleton className="h-40 w-full" />}

      {report && (
        <div className="space-y-md">
          <div className="grid grid-cols-2 gap-sm md:grid-cols-4">
            <div className={CARD}>
              <p className="text-xs text-neutral-600">Negócios</p>
              <p className="text-lg font-bold tabular-nums">{report.totals.deals}</p>
              <p className="text-xs tabular-nums text-neutral-600">
                {report.totals.open} abertos · {report.totals.won} ganhos · {report.totals.lost}{' '}
                perdidos
              </p>
            </div>
            <div className={CARD}>
              <p className="text-xs text-neutral-600">Em negociação</p>
              <p className="text-lg font-bold tabular-nums">
                {formatMoney(report.totals.openAmount)}
              </p>
            </div>
            <div className={CARD}>
              <p className="text-xs text-neutral-600">Vendido</p>
              <p className="text-lg font-bold tabular-nums">
                {formatMoney(report.totals.wonAmount)}
              </p>
            </div>
            <div className={CARD}>
              <p className="text-xs text-neutral-600">Conversão</p>
              <p className="text-lg font-bold tabular-nums">
                {formatRate(report.totals.conversionRate)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
            <Section title="Por etapa">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-600">
                    <th className="py-xs font-semibold">Etapa</th>
                    <th className="py-xs text-right font-semibold">Negócios</th>
                    <th className="py-xs text-right font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byStage.map((s) => (
                    <tr key={s.stageId} className="border-t border-neutral-200">
                      <td className="py-xs">{s.name}</td>
                      <td className="py-xs text-right tabular-nums">{s.count}</td>
                      <td className="py-xs text-right tabular-nums">{formatMoney(s.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Por responsável">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-600">
                    <th className="py-xs font-semibold">Responsável</th>
                    <th className="py-xs text-right font-semibold">Negócios</th>
                    <th className="py-xs text-right font-semibold">Ganhos</th>
                    <th className="py-xs text-right font-semibold">Perdidos</th>
                    <th className="py-xs text-right font-semibold">Vendido</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byAssignee.map((a) => (
                    <tr key={a.memberId ?? 'none'} className="border-t border-neutral-200">
                      <td className="py-xs">{a.name}</td>
                      <td className="py-xs text-right tabular-nums">{a.deals}</td>
                      <td className="py-xs text-right tabular-nums">{a.won}</td>
                      <td className="py-xs text-right tabular-nums">{a.lost}</td>
                      <td className="py-xs text-right tabular-nums">{formatMoney(a.wonAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Por origem">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-600">
                    <th className="py-xs font-semibold">Origem</th>
                    <th className="py-xs text-right font-semibold">Negócios</th>
                    <th className="py-xs text-right font-semibold">Ganhos</th>
                  </tr>
                </thead>
                <tbody>
                  {report.bySource.map((s) => (
                    <tr key={s.source} className="border-t border-neutral-200">
                      <td className="py-xs">{s.label || sourceLabel(s.source)}</td>
                      <td className="py-xs text-right tabular-nums">{s.deals}</td>
                      <td className="py-xs text-right tabular-nums">{s.won}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Motivos de perda">
              {report.lostReasons.length === 0 ? (
                <p className="text-sm text-neutral-600">Nenhuma perda no período.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-neutral-600">
                      <th className="py-xs font-semibold">Motivo</th>
                      <th className="py-xs text-right font-semibold">Negócios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.lostReasons.map((r) => (
                      <tr key={r.code} className="border-t border-neutral-200">
                        <td className="py-xs">{r.label}</td>
                        <td className="py-xs text-right tabular-nums">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          </div>

          <Section title="Negócios">
            {report.truncated && (
              <p className="mb-sm text-sm text-warning-700">Mostrando 5.000 primeiros</p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-600">
                    <th className="py-xs font-semibold">Lead</th>
                    <th className="py-xs font-semibold">Tipo</th>
                    <th className="py-xs font-semibold">Data do evento</th>
                    <th className="py-xs font-semibold">Etapa</th>
                    <th className="py-xs font-semibold">Situação</th>
                    <th className="py-xs font-semibold">Responsável</th>
                    <th className="py-xs font-semibold">Origem</th>
                    <th className="py-xs text-right font-semibold">Valor final</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.dealId} className="border-t border-neutral-200">
                      <td className="py-xs">{r.leadName}</td>
                      <td className="py-xs">{KIND_LABEL[r.kind] ?? r.kind}</td>
                      <td className="py-xs tabular-nums">{formatYmd(r.eventDate)}</td>
                      <td className="py-xs">{r.stageName}</td>
                      <td className="py-xs">
                        {STATUS_LABEL[r.status] ?? r.status}
                        {r.lostReasonLabel ? ` (${r.lostReasonLabel})` : ''}
                      </td>
                      <td className="py-xs">{r.assigneeName ?? '—'}</td>
                      <td className="py-xs">{sourceLabel(r.source)}</td>
                      <td className="py-xs text-right tabular-nums">{formatMoney(r.finalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.rows.length === 0 && (
              <p className="mt-sm text-sm text-neutral-600">Nenhum negócio no período.</p>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
