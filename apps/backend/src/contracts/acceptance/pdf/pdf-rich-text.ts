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
  const runs = parseBold(toWinAnsi(text));
  const left = doc.page.margins.left;
  // Evita começar uma linha que atravessaria a margem inferior.
  ensureSpace(doc, size * 1.3 + LINE_GAP);
  doc.x = left;
  runs.forEach((run, i) => {
    doc.font(run.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
    const o = {
      continued: i < runs.length - 1,
      align: opts.align ?? 'justify',
      lineGap: LINE_GAP,
      width: opts.width,
    };
    if (i === 0) doc.text(run.text, left, doc.y, o);
    else doc.text(run.text, o);
  });
  doc.x = left;
  if (opts.probe) track(doc, opts.probe);
}
