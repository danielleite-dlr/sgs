import { formatBRL, formatDateBR } from '../../domain/contract-template';
import type { ContractSnapshot } from '../../domain/contract-snapshot';
import { formatDateLongBR, splitParagraphs, toWinAnsi } from '../../domain/contract-texts';
import type { ContractPdfData } from '../contract-acceptance.service';
import {
  BODY_FONT_SIZE,
  createProbe,
  currentPageNumber,
  drawRichParagraph,
  ensureSpace,
  LINE_GAP,
  track,
  type LayoutProbe,
} from './pdf-rich-text';
import { drawTable, type TableRow } from './pdf-table';

export const mm = (v: number): number => (v * 72) / 25.4;

export interface StructuredOpts {
  letterhead: Buffer | null;
  acceptance: ContractPdfData['acceptance'];
  notice: string | null;
}

const PARAGRAPH_GAP = 4;

function title(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  probe: LayoutProbe,
  align: 'left' | 'center' = 'center',
): void {
  const left = doc.page.margins.left;
  ensureSpace(doc, 24);
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text(toWinAnsi(text), left, doc.y, { width, align });
  doc.moveDown(0.4);
  doc.x = left;
  track(doc, probe);
}

function contractorRows(s: ContractSnapshot): TableRow[] {
  const c = s.contractor;
  const first: TableRow =
    s.kind === 'debutante'
      ? {
          cells: [
            { text: `**Contratante:** ${c.name}`, colspan: 2 },
            { text: `**Debutante:** ${s.debutanteName ?? ''}` },
          ],
        }
      : { cells: [{ text: `**Contratante:** ${c.name}`, colspan: 3 }] };
  return [
    first,
    {
      cells: [
        { text: `**endereço:** ${c.address}`, colspan: 2 },
        { text: `**CEP:** ${c.postalCode}` },
      ],
    },
    {
      cells: [
        { text: `**CPF:** ${c.cpf}` },
        { text: `**RG:** ${c.rg}` },
        { text: `**email:**\n${c.email}` },
      ],
    },
    {
      cells: [
        { text: `**Celular 1:** ${c.phone1}` },
        { text: `**Celular 2:** ${c.phone2}` },
        { text: `**Celular 3:** ${c.phone3}` },
      ],
    },
    {
      cells: [
        {
          text: `**Data do Evento:** ${formatDateBR(s.event.date)}`,
          colspan: 2,
        },
        { text: `**Horário do evento:** ${s.event.time}` },
      ],
    },
    { cells: [{ text: `**Local:** ${s.event.locationName}`, colspan: 3 }] },
    {
      cells: [
        {
          text: `**Endereço do atendimento:** ${s.event.serviceAddress}`,
          colspan: 3,
        },
      ],
    },
  ];
}

const EXTRA_PREFIX = 'Serviço Adicional:';
function boldExtraLabel(label: string): string {
  return label.startsWith(EXTRA_PREFIX)
    ? `**${EXTRA_PREFIX}**${label.slice(EXTRA_PREFIX.length)}`
    : label;
}

function budgetRows(s: ContractSnapshot): TableRow[] {
  const rows: TableRow[] = [];
  const b = s.budget;
  if (b.package) {
    rows.push({
      cells: [
        {
          text: `**Pacote contratado:** ${b.package.name}`,
          subText: b.package.description ? `**Descrição:** ${b.package.description}` : undefined,
        },
        { text: formatBRL(b.package.cents) },
      ],
    });
  }
  for (const e of b.extras) {
    rows.push({
      cells: [{ text: boldExtraLabel(e.label) }, { text: formatBRL(e.cents) }],
    });
  }
  if (b.discount) {
    rows.push({
      cells: [{ text: b.discount.label }, { text: `- ${formatBRL(b.discount.cents)}` }],
    });
  }
  rows.push({
    cells: [{ text: '**Total de serviços**' }, { text: `**Total: ${formatBRL(b.totalCents)}**` }],
  });
  return rows;
}

function paymentRows(s: ContractSnapshot): TableRow[] {
  const { mode, installments, balanceDueDaysBefore } = s.payment;
  const rows: TableRow[] = [
    {
      cells: [
        { text: 'Parcela', bold: true },
        { text: 'Data', bold: true },
        { text: 'Valor', bold: true },
      ],
    },
  ];
  for (const i of installments) {
    const label =
      mode === 'a_vista'
        ? 'À VISTA'
        : mode === 'sinal'
          ? 'SINAL'
          : `SINAL ${i.seq}/${installments.length}`;
    rows.push({
      cells: [
        { text: label, bold: true },
        { text: formatDateBR(i.dueDate) },
        { text: formatBRL(i.cents) },
      ],
    });
  }
  if (mode !== 'a_vista') {
    rows.push({
      cells: [
        { text: 'RESTANTE PAGAMENTO', bold: true },
        {
          text: `Até ${balanceDueDaysBefore ?? 0} dias antes do evento`,
          colspan: 2,
        },
      ],
    });
  }
  return rows;
}

function drawSignatures(doc: PDFKit.PDFDocument, s: ContractSnapshot, width: number): void {
  const left = doc.page.margins.left;
  ensureSpace(doc, 60);
  const y = doc.y + 30;
  const lineW = width * 0.4;
  const x2 = left + width * 0.6;
  doc.lineWidth(0.75).strokeColor('#000000');
  doc
    .moveTo(left, y)
    .lineTo(left + lineW, y)
    .stroke();
  doc
    .moveTo(x2, y)
    .lineTo(x2 + lineW, y)
    .stroke();
  doc.font('Helvetica-Bold').fontSize(BODY_FONT_SIZE);
  doc.text('CONTRATANTE', left, y + 4, {
    width: lineW,
    align: 'center',
    lineBreak: false,
  });
  doc.text(toWinAnsi(s.studio.name.toUpperCase()), x2, y + 4, {
    width: lineW,
    align: 'center',
    lineBreak: false,
  });
  doc.x = left;
  doc.y = y + 4 + BODY_FONT_SIZE * 1.3 + 6;
}

function drawAcceptance(
  doc: PDFKit.PDFDocument,
  a: NonNullable<ContractPdfData['acceptance']>,
  probe: LayoutProbe,
): void {
  const left = doc.page.margins.left;
  ensureSpace(doc, 110);
  doc.moveDown(1);
  doc.x = left;
  doc.font('Helvetica-Bold').fontSize(10).text('Aceite digital', left, doc.y);
  doc.font('Helvetica').fontSize(8);
  doc.text(`Nome: ${toWinAnsi(a.name)}`, left);
  doc.text(`CPF: ${a.cpfMasked}`, left);
  doc.text(`Data e hora: ${a.acceptedAtLocal}`, left);
  doc.text(`IP: ${a.ip}`, left);
  doc.text(`Versão do contrato: ${a.version}`, left);
  doc.text(`SHA-256: ${a.sha256}`, left);
  doc.x = left;
  track(doc, probe);
}

function drawNotice(
  doc: PDFKit.PDFDocument,
  notice: string,
  width: number,
  probe: LayoutProbe,
): void {
  const left = doc.page.margins.left;
  const pad = 6;
  const text = toWinAnsi(notice);
  doc.font('Helvetica-Bold').fontSize(9);
  const h = doc.heightOfString(text, { width: width - 2 * pad }) + 2 * pad;
  ensureSpace(doc, h + 12);
  const y = doc.y + 12;
  doc.lineWidth(0.75).strokeColor('#000000').rect(left, y, width, h).stroke();
  doc.text(text, left + pad, y + pad, {
    width: width - 2 * pad,
    align: 'center',
  });
  doc.x = left;
  doc.y = y + h;
  track(doc, probe);
}

/** Monta o contrato estruturado (2 páginas de modelo, mais as que o conteúdo exigir). */
export function renderStructuredContract(
  doc: PDFKit.PDFDocument,
  s: ContractSnapshot,
  opts: StructuredOpts,
): LayoutProbe {
  const probe = createProbe();
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // `openImage` existe no pdfkit 0.20 (objeto reutilizável), mas falta nos @types.
  const open = (doc as unknown as { openImage(src: Buffer): unknown }).openImage.bind(doc);
  const bg = opts.letterhead ? open(opts.letterhead) : null;
  const paint = (): void => {
    if (!bg) return;
    const sx = doc.x;
    const sy = doc.y;
    doc.save();
    doc.opacity(0.8);
    doc.image(bg as never, 0, 0, {
      width: doc.page.width,
      height: doc.page.height,
    });
    doc.restore();
    doc.x = sx;
    doc.y = sy;
  };
  paint();
  doc.on('pageAdded', () => {
    paint();
    doc.x = doc.page.margins.left;
    doc.y = doc.page.margins.top;
  });

  doc.x = left;
  doc.y = doc.page.margins.top;
  probe.sectionPage.header = 1;

  const t = s.texts;
  title(doc, t.title.toUpperCase(), width, probe, 'left');
  drawRichParagraph(doc, t.intro, { width, probe });
  doc.moveDown(0.3);
  for (const p of splitParagraphs(t.parties)) {
    drawRichParagraph(doc, p, { width, probe });
    doc.y += PARAGRAPH_GAP;
  }

  doc.y += 2;
  drawTable(doc, {
    x: left,
    width,
    columns: [0.35, 0.35, 0.3],
    rows: contractorRows(s),
    probe,
  });

  doc.y += 10;
  title(doc, 'Orçamento', width, probe);
  drawTable(doc, {
    x: left,
    width,
    columns: [0.7, 0.3],
    rows: budgetRows(s),
    probe,
  });

  doc.y += 8;
  drawRichParagraph(doc, t.trialNote, { width, probe });

  doc.y += 6;
  title(doc, 'FORMA DE PAGAMENTO', width, probe);
  drawTable(doc, {
    x: left,
    width,
    columns: [0.4, 0.3, 0.3],
    rows: paymentRows(s),
    probe,
  });

  // Cláusulas sempre começam em página nova.
  doc.addPage();
  probe.sectionPage.clauses = currentPageNumber(doc);
  for (const p of splitParagraphs(t.clauses)) {
    drawRichParagraph(doc, p, { width, probe });
    doc.y += PARAGRAPH_GAP;
  }

  doc.y += 18;
  const place = toWinAnsi(s.studio.forumCity || s.studio.address);
  drawRichParagraph(doc, `${place}, ${formatDateLongBR(s.generatedOn)}`, {
    width,
    align: 'left',
    probe,
  });
  doc.y += 18 - LINE_GAP;
  drawSignatures(doc, s, width);
  track(doc, probe);

  if (opts.acceptance) drawAcceptance(doc, opts.acceptance, probe);
  else if (opts.notice) drawNotice(doc, opts.notice, width, probe);

  return probe;
}
