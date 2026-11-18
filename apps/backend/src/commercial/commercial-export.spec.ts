import ExcelJS from 'exceljs';
import {
  buildReportPdf,
  buildReportXlsx,
  escapeCell,
  type CommercialReportData,
  type CommercialReportRowData,
} from './commercial-export';

function row(i: number, leadName = `Lead ${i}`): CommercialReportRowData {
  return {
    dealId: `d${i}`,
    leadName,
    phone: '(11) 99999-0000',
    kind: 'noiva',
    eventDate: '2027-03-10',
    stageName: 'Proposta',
    status: 'open',
    assigneeName: 'Ana',
    source: 'instagram',
    packageName: 'Pacote Noiva',
    finalAmount: '1500.50',
    lostReasonLabel: null,
    lostReasonText: null,
    createdAt: new Date('2026-11-10T12:00:00Z'),
    closedAt: null,
  };
}

function report(rows: CommercialReportRowData[], truncated = false): CommercialReportData {
  return {
    orgName: 'Studio Teste',
    geradoEm: new Date('2026-11-18T12:00:00Z'),
    filtros: { from: '2026-11-01', to: '2026-11-30', descricao: [] },
    totals: {
      deals: rows.length,
      open: rows.length,
      won: 0,
      lost: 0,
      openAmount: '3001.00',
      wonAmount: '0.00',
      conversionRate: null,
    },
    byStage: [{ name: 'Proposta', kind: 'open', count: rows.length, amount: '3001.00' }],
    byAssignee: [{ name: 'Ana', deals: rows.length, won: 0, lost: 0, wonAmount: '0.00' }],
    bySource: [{ label: 'Instagram', deals: rows.length, won: 0 }],
    lostReasons: [{ label: 'Preço', count: 0 }],
    rows,
    truncated,
  };
}

describe('escapeCell', () => {
  it('prefixa apóstrofo em valores que começam com = + - @ ou TAB', () => {
    expect(escapeCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCell('+55 11')).toBe("'+55 11");
    expect(escapeCell('-10')).toBe("'-10");
    expect(escapeCell('@x')).toBe("'@x");
    expect(escapeCell('\tx')).toBe("'\tx");
  });
  it('mantém texto comum e trata nulos', () => {
    expect(escapeCell('Ana')).toBe('Ana');
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
  });
});

describe('buildReportXlsx', () => {
  it('gera Resumo e Negócios com cabeçalho + N linhas e escapa fórmulas', async () => {
    const buf = await buildReportXlsx(report([row(1, '=cmd'), row(2), row(3)]));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Resumo')).toBeDefined();
    const neg = wb.getWorksheet('Negócios')!;
    expect(neg.rowCount).toBe(4);
    expect(neg.getRow(1).getCell(1).value).toBe('Lead');
    expect(neg.getRow(2).getCell(1).value).toBe("'=cmd");
    expect(neg.getRow(2).getCell(10).value).toBe(1500.5);
  });
});

/** Texto do PDF sem compressão: junta as strings hex de cada operador TJ. */
function pdfText(buf: Buffer): string {
  const raw = buf.toString('latin1');
  const out: string[] = [];
  for (const m of raw.matchAll(/\[((?:<[0-9a-fA-F]*>|[^\]<])*)\]\s*TJ/g)) {
    let line = '';
    for (const h of m[1].matchAll(/<([0-9a-fA-F]*)>/g)) {
      line += Buffer.from(h[1], 'hex').toString('latin1');
    }
    out.push(line);
  }
  return out.join('\n');
}

describe('buildReportPdf', () => {
  it('gera PDF com o título', async () => {
    const buf = await buildReportPdf(report([row(1)]), { compress: false });
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdfText(buf)).toContain('Relatório comercial');
  });
  it('gera PDF com mais de 1.000 linhas (corta com aviso)', async () => {
    const rows = Array.from({ length: 1005 }, (_, i) => row(i));
    const buf = await buildReportPdf(report(rows), { compress: false });
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdfText(buf)).toContain('mostrando 1000 de 1005');
  });
});
