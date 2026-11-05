import { parseBold, toWinAnsi } from '../../domain/contract-texts';
import { BODY_FONT_SIZE, pageBottom, track, type LayoutProbe } from './pdf-rich-text';

export interface TableCell {
  /** Aceita `**negrito**`. */
  text: string;
  colspan?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Texto em 7 pt abaixo do principal. */
  subText?: string;
}
export interface TableRow {
  cells: TableCell[];
}

const SUB_FONT_SIZE = 7;
const CELL_LINE_GAP = 1.5;

interface Placed {
  cell: TableCell;
  x: number;
  w: number;
}

function placeRow(row: TableRow, x: number, width: number, columns: number[]): Placed[] {
  const total = columns.reduce((a, b) => a + b, 0);
  const out: Placed[] = [];
  let col = 0;
  let cx = x;
  for (const cell of row.cells) {
    const span = Math.max(1, cell.colspan ?? 1);
    const frac = columns.slice(col, col + span).reduce((a, b) => a + b, 0) / total;
    const w = frac * width;
    out.push({ cell, x: cx, w });
    cx += w;
    col += span;
  }
  return out;
}

function measure(
  doc: PDFKit.PDFDocument,
  text: string,
  bold: boolean,
  size: number,
  w: number,
): number {
  const plain = parseBold(toWinAnsi(text))
    .map((r) => r.text)
    .join('');
  if (plain === '') return 0;
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
  return doc.heightOfString(plain, { width: w, lineGap: CELL_LINE_GAP });
}

function cellHeight(doc: PDFKit.PDFDocument, p: Placed, size: number, pad: number): number {
  const inner = p.w - 2 * pad;
  let h = measure(doc, p.cell.text, !!p.cell.bold, size, inner);
  if (h === 0) h = size;
  if (p.cell.subText) h += measure(doc, p.cell.subText, false, SUB_FONT_SIZE, inner) + 1;
  return h + 2 * pad;
}

function writeRuns(
  doc: PDFKit.PDFDocument,
  text: string,
  baseBold: boolean,
  size: number,
  x: number,
  y: number,
  w: number,
  align: 'left' | 'center' | 'right',
): void {
  const runs = parseBold(toWinAnsi(text));
  runs.forEach((run, i) => {
    doc.font(run.bold || baseBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
    const o = {
      continued: i < runs.length - 1,
      width: w,
      align,
      lineGap: CELL_LINE_GAP,
    };
    if (i === 0) doc.text(run.text, x, y, o);
    else doc.text(run.text, o);
  });
}

export function drawTable(
  doc: PDFKit.PDFDocument,
  opts: {
    x: number;
    width: number;
    columns: number[];
    rows: TableRow[];
    fontSize?: number;
    padding?: number;
    probe?: LayoutProbe;
  },
): { endY: number; pages: number } {
  const size = opts.fontSize ?? BODY_FONT_SIZE;
  const pad = opts.padding ?? 3.75;
  const left = doc.page.margins.left;
  let pages = 1;
  let y = doc.y;

  for (const row of opts.rows) {
    const placed = placeRow(row, opts.x, opts.width, opts.columns);
    const h = Math.max(...placed.map((p) => cellHeight(doc, p, size, pad)));
    if (y + h > pageBottom(doc)) {
      doc.addPage();
      pages += 1;
      y = doc.page.margins.top;
    }
    for (const p of placed) {
      doc.lineWidth(0.75).strokeColor('#000000').rect(p.x, y, p.w, h).stroke();
      const inner = p.w - 2 * pad;
      const align = p.cell.align ?? 'left';
      writeRuns(doc, p.cell.text, !!p.cell.bold, size, p.x + pad, y + pad, inner, align);
      if (p.cell.subText) {
        const mainH = measure(doc, p.cell.text, !!p.cell.bold, size, inner);
        writeRuns(
          doc,
          p.cell.subText,
          false,
          SUB_FONT_SIZE,
          p.x + pad,
          y + pad + mainH + 1,
          inner,
          align,
        );
      }
    }
    y += h;
    if (opts.probe) track(doc, opts.probe, y);
  }
  doc.fillColor('#000000');
  doc.x = left;
  doc.y = y;
  return { endY: y, pages };
}
