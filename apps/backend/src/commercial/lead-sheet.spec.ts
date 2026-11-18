import ExcelJS from 'exceljs';
import { CommercialError } from './commercial-errors';
import {
  matchAssignee,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  normalizePersonName,
  parseLeadSheet,
} from './lead-sheet';

async function xlsx(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Leads');
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const HEAD = ['Nome', 'Celular', 'E-mail', 'Tipo', 'Data do evento', 'Origem', 'Observações'];

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof CommercialError) return e.code;
    throw e;
  }
  return 'NO_ERROR';
}

describe('parseLeadSheet', () => {
  it('lê xlsx com cabeçalhos normalizados', async () => {
    const buf = await xlsx([
      ['NOME', 'celular', 'E-MAIL', 'tipo', 'Data do Evento', 'origem', 'Observacoes'],
      [
        'Ana Souza',
        '(11) 98888-7777',
        'ana@x.com',
        'Noiva',
        '10/05/2027',
        'instagram',
        'quer sábado',
      ],
    ]);
    const r = await parseLeadSheet(buf, 'leads.xlsx');
    expect(r.invalid).toEqual([]);
    expect(r.valid).toEqual([
      {
        line: 2,
        fullName: 'Ana Souza',
        phone: '(11) 98888-7777',
        email: 'ana@x.com',
        kind: 'noiva',
        eventDate: '2027-05-10',
        source: 'instagram',
        notes: 'quer sábado',
        assigneeRef: null,
      },
    ]);
  });

  it('csv com ; e BOM e csv com , dão o mesmo resultado', async () => {
    const semi = Buffer.from('﻿Nome;Celular;E-mail;Tipo\nAna;11988887777;a@x.com;noiva\n');
    const comma = Buffer.from('Nome,Celular,E-mail,Tipo\nAna,11988887777,a@x.com,noiva\n');
    const a = await parseLeadSheet(semi, 'a.csv');
    const b = await parseLeadSheet(comma, 'b.csv');
    expect(a.valid).toHaveLength(1);
    expect(a).toEqual(b);
    expect(a.valid[0].fullName).toBe('Ana');
    expect(a.valid[0].kind).toBe('noiva');
  });

  it('fórmula nunca é avaliada: usa o resultado ou o texto', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('L');
    ws.addRow(HEAD);
    ws.addRow(['Ana', '11988887777']);
    ws.getCell('A2').value = { formula: 'HYPERLINK("http://x","Ana Link")', result: 'Ana Link' };
    ws.addRow(['Bia', '11977776666']);
    ws.getCell('A3').value = { formula: 'HYPERLINK("http://x","y")' } as ExcelJS.CellValue;
    const r = await parseLeadSheet(Buffer.from(await wb.xlsx.writeBuffer()), 'f.xlsx');
    expect(r.valid[0].fullName).toBe('Ana Link');
    // sem resultado: a fórmula vira texto, nunca é executada
    expect(r.valid[1].fullName).toContain('HYPERLINK');
  });

  it('datas em três formatos viram YYYY-MM-DD; inválida marca a linha', async () => {
    const buf = await xlsx([
      HEAD,
      ['A', '11988887777', '', '', '10/05/2027'],
      ['B', '11988887778', '', '', '2027-05-10'],
      ['C', '11988887779', '', '', new Date(Date.UTC(2027, 4, 10))],
      ['D', '11988887770', '', '', '31/02/2027'],
    ]);
    const r = await parseLeadSheet(buf, 'd.xlsx');
    expect(r.valid.map((v) => v.eventDate)).toEqual(['2027-05-10', '2027-05-10', '2027-05-10']);
    expect(r.invalid).toEqual([{ line: 5, reason: 'Data do evento inválida' }]);
  });

  it('tipo: noiva, debutante, vazio e inválido', async () => {
    const buf = await xlsx([
      HEAD,
      ['A', '11988887771', '', 'NOIVA'],
      ['B', '11988887772', '', '15 anos'],
      ['C', '11988887773', '', 'debutante'],
      ['D', '11988887774', '', ''],
      ['E', '11988887775', '', 'madrinha'],
    ]);
    const r = await parseLeadSheet(buf, 't.xlsx');
    expect(r.valid.map((v) => v.kind)).toEqual(['noiva', 'debutante', 'debutante', null]);
    expect(r.invalid).toEqual([{ line: 6, reason: 'Tipo deve ser noiva ou debutante' }]);
  });

  it('nome e contato obrigatórios; origem desconhecida vira import', async () => {
    const buf = await xlsx([
      HEAD,
      ['', '11988887771'],
      ['Sem contato'],
      ['Ok', '11988887772', '', '', '', 'tiktok'],
      ['Ok2', '11988887773', '', '', '', 'Site'],
    ]);
    const r = await parseLeadSheet(buf, 'n.xlsx');
    expect(r.invalid).toEqual([
      { line: 2, reason: 'Nome obrigatório' },
      { line: 3, reason: 'Informe telefone ou e-mail' },
    ]);
    expect(r.valid.map((v) => v.source)).toEqual(['import', 'site']);
  });

  it('telefone repetido no arquivo vai para inválidas', async () => {
    const buf = await xlsx([HEAD, ['A', '(11) 98888-7777'], ['B', '+55 11 98888-7777']]);
    const r = await parseLeadSheet(buf, 'r.xlsx');
    expect(r.valid).toHaveLength(1);
    expect(r.invalid).toEqual([{ line: 3, reason: 'Repetido na planilha (linha 2)' }]);
  });

  it('coluna de responsável reconhecida por vários cabeçalhos; sem a coluna é null', async () => {
    for (const h of ['Responsável', 'Dono', 'Vendedora', 'E-mail do responsável', 'Atendente']) {
      const r = await parseLeadSheet(
        await xlsx([
          ['Nome', 'Celular', h],
          ['A', '11988887771', '  Julia  '],
          ['B', '11988887772', ''],
        ]),
        'x.xlsx',
      );
      expect(r.valid.map((v) => v.assigneeRef)).toEqual(['Julia', null]);
    }
    const none = await parseLeadSheet(
      await xlsx([
        ['Nome', 'Celular'],
        ['A', '11988887771'],
      ]),
      'x.xlsx',
    );
    expect(none.valid[0].assigneeRef).toBeNull();
  });

  it('erros de arquivo', async () => {
    expect(MAX_IMPORT_BYTES).toBe(2_500_000);
    expect(await codeOf(parseLeadSheet(Buffer.alloc(MAX_IMPORT_BYTES + 1), 'a.csv'))).toBe(
      'FILE_TOO_LARGE',
    );
    expect(await codeOf(parseLeadSheet(Buffer.from('x'), 'a.txt'))).toBe('FILE_TYPE_INVALID');
    expect(await codeOf(parseLeadSheet(Buffer.from('not a zip'), 'a.xlsx'))).toBe(
      'FILE_TYPE_INVALID',
    );
    expect(await codeOf(parseLeadSheet(Buffer.from('Telefone\n1199\n'), 'a.csv'))).toBe(
      'HEADER_MISSING',
    );
    const lines = ['Nome,Celular'];
    for (let i = 0; i < MAX_IMPORT_ROWS + 1; i++) lines.push(`P${i},11${String(900000000 + i)}`);
    expect(await codeOf(parseLeadSheet(Buffer.from(lines.join('\n')), 'a.csv'))).toBe(
      'TOO_MANY_ROWS',
    );
  });
});

describe('normalizePersonName', () => {
  it('tira acento, caixa e espaços extras', () => {
    expect(normalizePersonName('  Júlia  Câmara ')).toBe('julia camara');
  });
});

describe('matchAssignee', () => {
  const members = [
    { id: 'm1', email: 'julia@studio.com', displayName: 'Julia Camara' },
    { id: 'm2', email: 'bia@studio.com', displayName: 'Bia' },
    { id: 'm3', email: 'ana1@studio.com', displayName: 'Ana Lima' },
    { id: 'm4', email: 'ana2@studio.com', displayName: 'ana  lima' },
  ];
  it('e-mail exato sem caixa', () => {
    expect(matchAssignee('JULIA@STUDIO.COM', members)).toEqual({ memberId: 'm1', warning: null });
  });
  it('nome normalizado', () => {
    expect(matchAssignee('Júlia Câmara', members)).toEqual({ memberId: 'm1', warning: null });
  });
  it('e-mail tem prioridade sobre nome', () => {
    const r = matchAssignee('bia@studio.com', [
      { id: 'x', email: 'x@s.com', displayName: 'bia@studio.com' },
      ...members,
    ]);
    expect(r.memberId).toBe('m2');
  });
  it('nenhum casamento e ambíguo viram aviso', () => {
    expect(matchAssignee('Fulana Inexistente', members)).toEqual({
      memberId: null,
      warning: 'responsável não encontrado: Fulana Inexistente',
    });
    expect(matchAssignee('Ana Lima', members).memberId).toBeNull();
    expect(matchAssignee('Ana Lima', members).warning).toContain('responsável não encontrado');
  });
  it('vazio não gera aviso', () => {
    expect(matchAssignee(null, members)).toEqual({ memberId: null, warning: null });
    expect(matchAssignee('  ', members)).toEqual({ memberId: null, warning: null });
  });
});
