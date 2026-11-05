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
    const r = drawTable(doc, {
      x: X,
      width: W,
      columns: [0.5, 0.5],
      rows,
      probe,
    });
    expect(r.pages).toBeGreaterThanOrEqual(2);
    expect(probe.maxY.length).toBeGreaterThanOrEqual(2);
    for (const y of probe.maxY) expect(y).toBeLessThanOrEqual(pageBottom(doc) + 1e-6);
    doc.end();
  });
});

describe('drawRichParagraph', () => {
  interface Call {
    text: string;
    x: number;
    y: number;
    bold: boolean;
    w: number;
  }

  function capture(text: string, align?: 'justify' | 'left'): Call[] {
    const doc = newDoc();
    const calls: Call[] = [];
    let bold = false;
    const origFont = doc.font.bind(doc);
    jest.spyOn(doc, 'font').mockImplementation(((name: string) => {
      bold = name === 'Helvetica-Bold';
      return origFont(name);
    }) as never);
    const origText = doc.text.bind(doc);
    jest.spyOn(doc, 'text').mockImplementation(((t: string, x: number, y: number, o: object) => {
      calls.push({ text: t, x, y, bold, w: doc.widthOfString(t) });
      return origText(t, x, y, o);
    }) as never);
    drawRichParagraph(doc, text, { width: W, align });
    doc.end();
    return calls;
  }

  const LONG =
    'Os serviços da **CONTRATADA** serão prestados no local, no dia, mês, ano e **horário confirmado** no fechamento do contrato. ' +
    'Parágrafo **Segundo:** o sinal pago no ato da contratação tem como finalidade a reserva da data do evento e nada mais.';

  it('usa Helvetica e Helvetica-Bold conforme os ** e escreve tudo', () => {
    const calls = capture('a **b** c');
    expect(calls.map((c) => [c.text, c.bold])).toEqual([
      ['a', false],
      ['b', true],
      ['c', false],
    ]);
  });

  it('justifica a linha inteira (todas as runs): mesma folga entre palavras e borda direita alinhada', () => {
    const calls = capture(LONG);
    const firstY = calls[0].y;
    const first = calls.filter((c) => c.y === firstY);
    expect(first.length).toBeGreaterThan(5);
    expect(first.some((c) => c.bold)).toBe(true);
    const last = first[first.length - 1];
    expect(last.x + last.w).toBeCloseTo(X + W, 3);
    const gaps = first.slice(1).map((c, i) => c.x - (first[i].x + first[i].w));
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0], 3);
  });

  it('a última linha do parágrafo não é justificada', () => {
    const calls = capture(LONG);
    const lastY = calls[calls.length - 1].y;
    const row = calls.filter((c) => c.y === lastY);
    const end = row[row.length - 1];
    expect(end.x + end.w).toBeLessThan(X + W - 5);
  });

  it('linha terminada em \\n (quebra dura) não é justificada', () => {
    const calls = capture('**Título:**\n' + LONG);
    expect(calls[0].text).toBe('Título:');
    const row = calls.filter((c) => c.y === calls[0].y);
    expect(row).toHaveLength(1);
    const next = calls.find((c) => c.y > calls[0].y);
    expect(next?.x).toBeCloseTo(X, 3);
  });
});
