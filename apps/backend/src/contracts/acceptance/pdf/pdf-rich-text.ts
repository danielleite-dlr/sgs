import { parseBold, toWinAnsi } from '../../domain/contract-texts';

export const BODY_FONT_SIZE = 9.5;
/** Entrelinha 1,3 sobre 9,5 pt (aprox.). */
export const LINE_GAP = 2.85;

export interface LayoutProbe {
  /** Maior `y` ocupado por conteúdo em cada página (índice = página - 1). */
  maxY: number[];
  /** Página (1-based) onde cada seção começou. */
  sectionPage: Record<string, number>;
}

export function createProbe(): LayoutProbe {
  return { maxY: [], sectionPage: {} };
}

/** Número (1-based) da página corrente. */
export function currentPageNumber(doc: PDFKit.PDFDocument): number {
  return doc.bufferedPageRange().count;
}

/** Registra a posição `y` na página corrente. */
export function track(doc: PDFKit.PDFDocument, probe: LayoutProbe, y: number = doc.y): void {
  const idx = currentPageNumber(doc) - 1;
  probe.maxY[idx] = Math.max(probe.maxY[idx] ?? 0, y);
}

export function pageBottom(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.bottom;
}

/** Abre nova página se `height` não couber acima da margem inferior. */
export function ensureSpace(doc: PDFKit.PDFDocument, height: number): void {
  if (doc.y + height > pageBottom(doc)) {
    doc.addPage();
  }
}

interface Piece {
  text: string;
  bold: boolean;
}
/** Palavra = pedaços colados (podem ter fontes diferentes); `hardBreak` termina a linha após ela. */
interface Word {
  pieces: Piece[];
  width: number;
  hardBreak: boolean;
}
interface Line {
  words: Word[];
  justify: boolean;
}

function fontName(bold: boolean): string {
  return bold ? 'Helvetica-Bold' : 'Helvetica';
}

function tokenize(doc: PDFKit.PDFDocument, text: string, size: number): Word[] {
  const words: Word[] = [];
  let cur: Piece[] = [];
  const flush = (hardBreak: boolean): void => {
    if (cur.length > 0) {
      let width = 0;
      for (const p of cur) {
        width += doc.font(fontName(p.bold)).fontSize(size).widthOfString(p.text);
      }
      words.push({ pieces: cur, width, hardBreak });
      cur = [];
    } else if (hardBreak && words.length > 0) {
      words[words.length - 1].hardBreak = true;
    }
  };
  for (const run of parseBold(toWinAnsi(text))) {
    for (const chunk of run.text.split(/(\n|[ \t]+)/)) {
      if (chunk === '') continue;
      if (chunk === '\n') flush(true);
      else if (/^[ \t]+$/.test(chunk)) flush(false);
      else cur.push({ text: chunk, bold: run.bold });
    }
  }
  flush(false);
  return words;
}

/**
 * Parágrafo com `**negrito**`. A justificação distribui o espaço entre TODAS as palavras da linha
 * (qualquer fonte); a última linha do parágrafo e as linhas terminadas em `\n` não são justificadas.
 */
export function drawRichParagraph(
  doc: PDFKit.PDFDocument,
  text: string,
  opts: {
    width: number;
    align?: 'justify' | 'left' | 'center';
    fontSize?: number;
    probe?: LayoutProbe;
  },
): void {
  const size = opts.fontSize ?? BODY_FONT_SIZE;
  const align = opts.align ?? 'justify';
  const left = doc.page.margins.left;
  const words = tokenize(doc, text, size);
  const space = doc.font('Helvetica').fontSize(size).widthOfString(' ');
  const lineH = doc.currentLineHeight() + LINE_GAP;

  const lines: Line[] = [];
  let cur: Word[] = [];
  let curW = 0;
  const close = (justify: boolean): void => {
    lines.push({ words: cur, justify });
    cur = [];
    curW = 0;
  };
  for (const w of words) {
    if (cur.length > 0 && curW + space + w.width > opts.width) close(true);
    curW += cur.length === 0 ? w.width : space + w.width;
    cur.push(w);
    if (w.hardBreak) close(false);
  }
  if (cur.length > 0) close(false);

  for (const line of lines) {
    if (doc.y + lineH > pageBottom(doc)) doc.addPage();
    const y = doc.y;
    const sum = line.words.reduce((a, w) => a + w.width, 0);
    let gap = space;
    let x = left;
    if (align === 'justify' && line.justify && line.words.length > 1) {
      gap = (opts.width - sum) / (line.words.length - 1);
    } else if (align === 'center') {
      x = left + (opts.width - (sum + space * (line.words.length - 1))) / 2;
    }
    for (const w of line.words) {
      for (const p of w.pieces) {
        doc.font(fontName(p.bold)).fontSize(size);
        doc.text(p.text, x, y, { lineBreak: false });
        x += doc.widthOfString(p.text);
      }
      x += gap;
    }
    doc.x = left;
    doc.y = y + lineH;
    if (opts.probe) track(doc, opts.probe, doc.y);
  }
  doc.x = left;
}
