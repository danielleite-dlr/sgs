import { createPortal } from 'react-dom';
import {
  brl,
  formatDay,
  periodLabel,
  type CommissionReportInput,
} from '../lib/commission-report';

export const PRINT_BODY_CLASS = 'printing-commission-report';

/**
 * Versão do relatório para imprimir/salvar em PDF. Fica num portal direto no
 * <body> e só aparece quando o body recebe PRINT_BODY_CLASS (ver globals.css).
 */
export function CommissionPrintReport({ report }: { report: CommissionReportInput }) {
  return createPortal(
    <div className="print-report text-neutral-900" data-testid="commission-print-report">
      <header className="mb-4 border-b border-neutral-300 pb-3">
        {report.salonName && <p className="text-sm text-neutral-600">{report.salonName}</p>}
        <h1 className="text-xl font-bold">Relatório de comissões</h1>
        <p className="mt-1 text-sm">
          <strong>Profissional:</strong> {report.memberName}
        </p>
        <p className="text-sm">
          <strong>Período:</strong> {periodLabel(report.from, report.to)}
        </p>
      </header>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-400 text-left">
            <th className="py-1 pr-2">Data</th>
            <th className="py-1 pr-2">Cliente</th>
            <th className="py-1 pr-2">Serviço</th>
            <th className="py-1 pr-2 text-right">Valor cobrado</th>
            <th className="py-1 text-right">Comissão</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-3 text-center text-neutral-600">
                Nenhum atendimento com comissão no período.
              </td>
            </tr>
          ) : (
            report.rows.map((r, i) => (
              <tr key={i} className="border-b border-neutral-200">
                <td className="py-1 pr-2">{formatDay(r.serviceDate)}</td>
                <td className="py-1 pr-2">{r.clientName ?? '—'}</td>
                <td className="py-1 pr-2">
                  {r.itemName}
                  {r.kind === 'reversal' && ' (estorno)'}
                </td>
                <td className="py-1 pr-2 text-right">{brl(r.chargedAmount)}</td>
                <td className="py-1 text-right">{brl(r.calculatedAmount)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-neutral-400 font-bold">
            <td colSpan={4} className="py-2 text-right">
              Total
            </td>
            <td className="py-2 text-right">{brl(report.total)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-6 text-xs text-neutral-500">
        Gerado em {new Date().toLocaleString('pt-BR')}
      </p>
    </div>,
    document.body,
  );
}
