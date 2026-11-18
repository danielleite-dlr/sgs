import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/** Linhas e totais do relatório comercial; reaproveitado pelo serviço e pela exportação. */
export interface CommercialReportRowData {
  dealId: string;
  leadName: string;
  phone: string | null;
  kind: string;
  eventDate: string | null;
  stageName: string;
  status: string;
  assigneeName: string | null;
  source: string;
  packageName: string | null;
  /** decimal em texto ("1500.00") */
  finalAmount: string | null;
  lostReasonLabel: string | null;
  lostReasonText: string | null;
  createdAt: Date;
  closedAt: Date | null;
}

export interface CommercialReportData {
  orgName: string;
  geradoEm: Date;
  filtros: { from: string; to: string; descricao: string[] };
  totals: {
    deals: number;
    open: number;
    won: number;
    lost: number;
    openAmount: string;
    wonAmount: string;
    conversionRate: number | null;
  };
  byStage: { name: string; kind: string; count: number; amount: string }[];
  byAssignee: { name: string; deals: number; won: number; lost: number; wonAmount: string }[];
  bySource: { label: string; deals: number; won: number }[];
  lostReasons: { label: string; count: number }[];
  rows: CommercialReportRowData[];
  truncated: boolean;
}

/**
 * Neutraliza injeção de fórmula em planilha: valores que começam com = + - @ (ou TAB/CR)
 * ganham um apóstrofo na frente.
 */
export function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

const KIND_LABEL: Record<string, string> = { noiva: 'Noiva', debutante: 'Debutante' };
const STATUS_LABEL: Record<string, string> = { open: 'Aberto', won: 'Ganho', lost: 'Perdido' };
const MONEY_FMT = '"R$" #,##0.00';

const kindLabel = (k: string) => KIND_LABEL[k] ?? k;
const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;

function brDate(d: Date | null | undefined): string {
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(d);
}

function brDateTime(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

export function brMoney(amount: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '';
  return Number(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pct(rate: number | null): string {
  return rate === null ? '-' : `${(rate * 100).toFixed(1).replace('.', ',')}%`;
}

function ymdToBr(ymd: string | null): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

const ROW_HEADERS = [
  'Lead',
  'Telefone',
  'Tipo',
  'Data do evento',
  'Etapa',
  'Status',
  'Responsável',
  'Origem',
  'Pacote',
  'Valor final',
  'Motivo da perda',
  'Detalhe da perda',
  'Criado em',
  'Fechado em',
];

export async function buildReportXlsx(data: CommercialReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = data.orgName;
  wb.created = data.geradoEm;

  const resumo = wb.addWorksheet('Resumo');
  resumo.addRow(['Relatório comercial']).font = { bold: true, size: 14 };
  resumo.addRow([escapeCell(data.orgName)]);
  resumo.addRow(['Período', `${ymdToBr(data.filtros.from)} a ${ymdToBr(data.filtros.to)}`]);
  for (const d of data.filtros.descricao) resumo.addRow(['Filtro', escapeCell(d)]);
  resumo.addRow(['Gerado em', brDateTime(data.geradoEm)]);
  resumo.addRow([]);
  const t = data.totals;
  resumo.addRow(['Negócios', t.deals]);
  resumo.addRow(['Em aberto', t.open]);
  resumo.addRow(['Ganhos', t.won]);
  resumo.addRow(['Perdidos', t.lost]);
  const addMoney = (label: string, v: string) => {
    const r = resumo.addRow([label, Number(v)]);
    r.getCell(2).numFmt = MONEY_FMT;
  };
  addMoney('Valor em negociação', t.openAmount);
  addMoney('Valor ganho', t.wonAmount);
  resumo.addRow(['Taxa de conversão', pct(t.conversionRate)]);

  const section = (title: string, head: string[], lines: (string | number)[][]) => {
    resumo.addRow([]);
    resumo.addRow([title]).font = { bold: true };
    resumo.addRow(head).font = { bold: true };
    for (const l of lines) resumo.addRow(l.map((c) => (typeof c === 'number' ? c : escapeCell(c))));
  };
  section(
    'Por etapa',
    ['Etapa', 'Negócios', 'Valor'],
    data.byStage.map((s) => [s.name, s.count, brMoney(s.amount)]),
  );
  section(
    'Por responsável',
    ['Responsável', 'Negócios', 'Ganhos', 'Perdidos', 'Valor ganho'],
    data.byAssignee.map((a) => [a.name, a.deals, a.won, a.lost, brMoney(a.wonAmount)]),
  );
  section(
    'Por origem',
    ['Origem', 'Negócios', 'Ganhos'],
    data.bySource.map((s) => [s.label, s.deals, s.won]),
  );
  section(
    'Motivos de perda',
    ['Motivo', 'Quantidade'],
    data.lostReasons.map((r) => [r.label, r.count]),
  );
  resumo.getColumn(1).width = 28;
  resumo.getColumn(2).width = 24;

  const neg = wb.addWorksheet('Negócios');
  neg.addRow(ROW_HEADERS).font = { bold: true };
  for (const r of data.rows) {
    const row = neg.addRow([
      escapeCell(r.leadName),
      escapeCell(r.phone),
      escapeCell(kindLabel(r.kind)),
      escapeCell(ymdToBr(r.eventDate)),
      escapeCell(r.stageName),
      escapeCell(statusLabel(r.status)),
      escapeCell(r.assigneeName),
      escapeCell(r.source),
      escapeCell(r.packageName),
      r.finalAmount === null ? '' : Number(r.finalAmount),
      escapeCell(r.lostReasonLabel),
      escapeCell(r.lostReasonText),
      escapeCell(brDate(r.createdAt)),
      escapeCell(brDate(r.closedAt)),
    ]);
    if (r.finalAmount !== null) row.getCell(10).numFmt = MONEY_FMT;
  }
  ROW_HEADERS.forEach((_, i) => {
    neg.getColumn(i + 1).width = i === 0 ? 30 : 18;
  });
  neg.views = [{ state: 'frozen', ySplit: 1 }];

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

const PDF_ROW_LIMIT = 1000;

export function buildReportPdf(
  data: CommercialReportData,
  opts: { compress?: boolean } = {},
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 30,
      bufferPages: true,
      compress: opts.compress ?? true,
      info: { Title: 'Relatório comercial', Author: data.orgName },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      const left = doc.page.margins.left;
      const width = doc.page.width - left - doc.page.margins.right;
      const bottom = () => doc.page.height - doc.page.margins.bottom;

      doc.font('Helvetica-Bold').fontSize(16).text('Relatório comercial', left);
      doc.font('Helvetica').fontSize(9);
      doc.text(data.orgName);
      doc.text(`Período: ${ymdToBr(data.filtros.from)} a ${ymdToBr(data.filtros.to)}`);
      for (const d of data.filtros.descricao) doc.text(`Filtro: ${d}`);
      doc.text(`Gerado em ${brDateTime(data.geradoEm)}`);
      doc.moveDown();

      const t = data.totals;
      doc.font('Helvetica-Bold').fontSize(11).text('Totais');
      doc.font('Helvetica').fontSize(9);
      doc.text(
        `Negócios: ${t.deals}   Em aberto: ${t.open}   Ganhos: ${t.won}   Perdidos: ${t.lost}   ` +
          `Em negociação: ${brMoney(t.openAmount)}   Ganho: ${brMoney(t.wonAmount)}   ` +
          `Conversão: ${pct(t.conversionRate)}`,
      );
      doc.moveDown();

      const smallTable = (title: string, lines: string[][]) => {
        if (lines.length === 0) return;
        if (doc.y > bottom() - 60) doc.addPage();
        doc.font('Helvetica-Bold').fontSize(11).text(title, left);
        doc.font('Helvetica').fontSize(9);
        for (const l of lines) doc.text(l.join('   |   '), left);
        doc.moveDown();
      };
      smallTable(
        'Por origem',
        data.bySource.map((s) => [s.label, `${s.deals} negócios`, `${s.won} ganhos`]),
      );
      smallTable(
        'Motivos de perda',
        data.lostReasons.map((r) => [r.label, String(r.count)]),
      );

      const cols: { h: string; w: number; get: (r: CommercialReportRowData) => string }[] = [
        { h: 'Lead', w: 130, get: (r) => r.leadName },
        { h: 'Tipo', w: 55, get: (r) => kindLabel(r.kind) },
        { h: 'Evento', w: 55, get: (r) => ymdToBr(r.eventDate) },
        { h: 'Etapa', w: 80, get: (r) => r.stageName },
        { h: 'Status', w: 50, get: (r) => statusLabel(r.status) },
        { h: 'Responsável', w: 100, get: (r) => r.assigneeName ?? '' },
        { h: 'Origem', w: 60, get: (r) => r.source },
        { h: 'Valor final', w: 75, get: (r) => brMoney(r.finalAmount) },
        { h: 'Perda', w: 100, get: (r) => r.lostReasonLabel ?? '' },
        { h: 'Criado em', w: 60, get: (r) => brDate(r.createdAt) },
      ];
      const scale = width / cols.reduce((a, c) => a + c.w, 0);
      const drawLine = (cells: string[], bold: boolean) => {
        if (doc.y > bottom() - 14) doc.addPage();
        const y = doc.y;
        let x = left;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5);
        cols.forEach((c, i) => {
          const w = c.w * scale;
          doc.text(cells[i] ?? '', x, y, {
            width: w - 4,
            height: 10,
            lineBreak: false,
            ellipsis: true,
          });
          x += w;
        });
        doc.y = y + 11;
      };
      if (doc.y > bottom() - 40) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(11).text('Negócios', left);
      drawLine(
        cols.map((c) => c.h),
        true,
      );
      for (const r of data.rows.slice(0, PDF_ROW_LIMIT)) {
        drawLine(
          cols.map((c) => c.get(r)),
          false,
        );
      }
      if (data.rows.length > PDF_ROW_LIMIT) {
        const total = data.truncated ? `${data.rows.length}+` : String(data.rows.length);
        doc.moveDown(0.5);
        doc
          .font('Helvetica-Oblique')
          .fontSize(8)
          .text(`mostrando ${PDF_ROW_LIMIT} de ${total}`, left);
      }
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
