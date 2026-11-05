import PDFDocument from 'pdfkit';
import { createProbe, drawRichParagraph, pageBottom } from './pdf-rich-text';
import { drawTable, type TableRow } from './pdf-table';

const mm = (v: number) => (v * 72) / 25.4;

function newDoc(): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: mm(40), bottom: mm(30), left: mm(20), right: mm(20) },
    bufferPages: true,
  });
  doc.on('data', () => undefined);
  return doc;
}
const X = mm(20);
const W = 595.28 - 2 * mm(20);

describe('drawTable', () => {
  it('colspan ocupa a largura total', () => {
    const doc = newDoc();
    const spy = jest.spyOn(doc, 'rect');
    drawTable(doc, {
      x: X,
      width: W,
      columns: [0.25, 0.25, 0.5],
      rows: [{ cells: [{ text: 'tudo', colspan: 3 }] }],
    });
    expect(spy.mock.calls[0][2]).toBeCloseTo(W, 5);
    doc.end();
  });

  it('texto longo deixa a linha mais alta; células da linha têm a mesma altura', () => {
    const doc = newDoc();
    const spy = jest.spyOn(doc, 'rect');
    drawTable(doc, {
      x: X,
      width: W,
      columns: [0.5, 0.5],
      rows: [
        { cells: [{ text: 'curto' }, { text: 'curto' }] },
        { cells: [{ text: 'palavra '.repeat(40) }, { text: 'curto' }] },
      ],
    });
    const hs = spy.mock.calls.map((c) => c[3] as number);
    expect(hs[0]).toBe(hs[1]);
    expect(hs[2]).toBe(hs[3]);
    expect(hs[2]).toBeGreaterThan(hs[0]);
    doc.end();
  });

  it('subText aumenta a altura da célula', () => {
    const doc = newDoc();
    const spy = jest.spyOn(doc, 'rect');
    drawTable(doc, {
      x: X,
      width: W,
      columns: [1],
      rows: [{ cells: [{ text: 'a' }] }, { cells: [{ text: 'a', subText: 'descrição' }] }],
    });
    expect(spy.mock.calls[1][3] as number).toBeGreaterThan(spy.mock.calls[0][3] as number);
    doc.end();
  });

  it('tabela longa quebra de página sem passar da margem inferior', () => {
    const doc = newDoc();
    const probe = createProbe();
    doc.y = 400;
    const rows: TableRow[] = Array.from({ length: 60 }, (_, i) => ({
      cells: [{ text: `linha ${i}` }, { text: 'x' }],
    }));
    const r = drawTable(doc, { x: X, width: W, columns: [0.5, 0.5], rows, probe });
    expect(r.pages).toBeGreaterThanOrEqual(2);
    expect(probe.maxY.length).toBeGreaterThanOrEqual(2);
    for (const y of probe.maxY) expect(y).toBeLessThanOrEqual(pageBottom(doc) + 1e-6);
    doc.end();
  });
});

describe('drawRichParagraph', () => {
  it('alterna Helvetica/Helvetica-Bold e fecha com continued=false', () => {
    const doc = newDoc();
    const font = jest.spyOn(doc, 'font');
    const text = jest.spyOn(doc, 'text');
    drawRichParagraph(doc, 'a **b** c', { width: W });
    expect(font.mock.calls.map((c) => c[0])).toEqual(['Helvetica', 'Helvetica-Bold', 'Helvetica']);
    const last = text.mock.calls[text.mock.calls.length - 1];
    expect((last[last.length - 1] as { continued: boolean }).continued).toBe(false);
    doc.end();
  });
});
