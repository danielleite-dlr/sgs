import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';

/** Linha do relatório de comissões que vai para a profissional. */
export interface CommissionReportRow {
  serviceDate: string;
  clientName: string | null;
  itemName: string;
  chargedAmount: string;
  calculatedAmount: string;
  kind: string;
}

export interface CommissionReportInput {
  salonName: string | null;
  memberName: string;
  from: string;
  /** Exclusivo (YYYY-MM-DD), como no PeriodFilter. */
  to: string;
  rows: CommissionReportRow[];
  total: string;
}

export const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

export const formatDay = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

/** YYYY-MM-DD → DD/MM/AAAA sem passar por fuso. */
function ymd(s: string): string {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

/** Período para exibir: o `to` exclusivo vira o último dia incluído. */
export function periodLabel(from: string, to: string): string {
  const [y, m, d] = to.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  return last <= from ? ymd(from) : `${ymd(from)} a ${ymd(last)}`;
}

export function buildWhatsAppText(r: CommissionReportInput): string {
  const lines: string[] = [];
  lines.push(`*Relatório de comissões${r.salonName ? ` — ${r.salonName}` : ''}*`);
  lines.push(`Profissional: ${r.memberName}`);
  lines.push(`Período: ${periodLabel(r.from, r.to)}`);
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('Nenhum atendimento com comissão no período.');
  } else {
    for (const row of r.rows) {
      const estorno = row.kind === 'reversal' ? ' (estorno)' : '';
      lines.push(
        `${formatDay(row.serviceDate)} · ${row.clientName ?? 'Cliente não informado'} · ` +
          `${row.itemName}${estorno} · ${brl(row.calculatedAmount)}`,
      );
    }
  }
  lines.push('');
  lines.push(`*Total: ${brl(r.total)}*`);
  return lines.join('\n');
}

/**
 * Link do WhatsApp. Telefone brasileiro sem DDI (10–11 dígitos) ganha o 55;
 * sem telefone abre o WhatsApp para escolher o contato.
 */
export function whatsAppUrl(phone: string | null | undefined, text: string): string {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  const q = `text=${encodeURIComponent(text)}`;
  return digits.length >= 12 ? `https://wa.me/${digits}?${q}` : `https://wa.me/?${q}`;
}
