import ExcelJS from 'exceljs';
import { COMMERCIAL_SOURCES } from './commercial-constants';
import { CommercialError } from './commercial-errors';
import { phoneDigits, phoneKey } from './commercial-phone';

/** 2,5 MB: em base64 vira ~3,4 MB e cabe no bodyLimit de 4 MiB do Fastify. */
export const MAX_IMPORT_BYTES = 2_500_000;
export const MAX_IMPORT_ROWS = 2000;

export interface ParsedLeadRow {
  line: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  kind: 'noiva' | 'debutante' | null;
  eventDate: string | null;
  source: string;
  notes: string | null;
  assigneeRef: string | null;
}

export interface ParsedLeadSheet {
  valid: ParsedLeadRow[];
  invalid: { line: number; reason: string }[];
}

/** Sem acento, minúsculo, espaços colapsados. */
export function normalizePersonName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface AssigneeCandidate {
  id: string;
  email: string | null;
  displayName: string;
  /** nome completo do usuário, segunda chance de casamento por nome */
  userName?: string | null;
}

/**
 * D-22: casa o texto da coluna Responsável com um membro. E-mail exato (sem caixa) primeiro;
 * depois nome normalizado. Ambíguo ou sem casamento vira aviso e o lead entra sem responsável.
 */
export function matchAssignee(
  ref: string | null,
  members: AssigneeCandidate[],
): { memberId: string | null; warning: string | null } {
  const raw = (ref ?? '').trim();
  if (raw === '') return { memberId: null, warning: null };
  if (raw.includes('@')) {
    const mail = raw.toLowerCase();
    const byMail = members.filter((m) => m.email?.trim().toLowerCase() === mail);
    if (byMail.length === 1) return { memberId: byMail[0].id, warning: null };
  }
  const name = normalizePersonName(raw);
  const byName = members.filter(
    (m) =>
      normalizePersonName(m.displayName) === name ||
      (m.userName ? normalizePersonName(m.userName) === name : false),
  );
  if (byName.length === 1) return { memberId: byName[0].id, warning: null };
  return { memberId: null, warning: `responsável não encontrado: ${raw}` };
}

type Field =
  | 'fullName'
  | 'phone'
  | 'email'
  | 'kind'
  | 'eventDate'
  | 'source'
  | 'notes'
  | 'assigneeRef';

const HEADERS: Record<string, Field> = {
  nome: 'fullName',
  name: 'fullName',
  'nome completo': 'fullName',
  telefone: 'phone',
  celular: 'phone',
  whatsapp: 'phone',
  fone: 'phone',
  phone: 'phone',
  'e-mail': 'email',
  email: 'email',
  tipo: 'kind',
  'evento tipo': 'kind',
  'data do evento': 'eventDate',
  data: 'eventDate',
  'data evento': 'eventDate',
  origem: 'source',
  source: 'source',
  observacoes: 'notes',
  obs: 'notes',
  notas: 'notes',
  responsavel: 'assigneeRef',
  dono: 'assigneeRef',
  owner: 'assigneeRef',
  vendedor: 'assigneeRef',
  vendedora: 'assigneeRef',
  atendente: 'assigneeRef',
  usuario: 'assigneeRef',
  'e-mail do responsavel': 'assigneeRef',
  'email do responsavel': 'assigneeRef',
};

const fileError = (code: string, message: string) => new CommercialError(code, message, 'base64');

/** Texto da célula; fórmula nunca é avaliada (resultado, ou a própria fórmula como texto). */
function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return dateIso(v) ?? '';
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText)) {
      return (o.richText as { text?: string }[])
        .map((r) => r.text ?? '')
        .join('')
        .trim();
    }
    if ('formula' in o || 'sharedFormula' in o) {
      const result = o.result;
      if (result !== undefined && result !== null) {
        if (typeof result === 'object' && !(result instanceof Date)) return '';
        return cellText(result as ExcelJS.CellValue);
      }
      return typeof o.formula === 'string' ? o.formula.trim() : '';
    }
    if (typeof o.text === 'string') return o.text.trim();
    if (typeof o.error === 'string') return '';
  }
  return '';
}

function dateIso(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function realDate(y: number, m: number, d: number): string | null {
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return t.toISOString().slice(0, 10);
}

function parseDate(text: string): string | null {
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (br) return realDate(Number(br[3]), Number(br[2]), Number(br[1]));
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(text);
  if (iso) return realDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  return null;
}

function parseKind(text: string): 'noiva' | 'debutante' | null | 'invalid' {
  const k = normalizePersonName(text);
  if (k === '') return null;
  if (k === 'noiva') return 'noiva';
  if (k === 'debutante' || k === '15 anos' || k === '15anos') return 'debutante';
  return 'invalid';
}

function parseSource(text: string): string {
  const k = normalizePersonName(text);
  const hit = COMMERCIAL_SOURCES.find((s) => s.code === k || normalizePersonName(s.label) === k);
  return hit ? hit.code : 'import';
}

/** CSV simples com aspas; delimitador ';' ou ',' pela primeira linha; BOM removido. */
function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== '' || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

/** Linhas cruas (texto por célula) com o número da linha na planilha. */
async function readRaw(
  buffer: Buffer,
  filename: string,
): Promise<{ line: number; cells: string[] }[]> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) {
    return parseCsv(buffer.toString('utf8')).map((cells, i) => ({
      line: i + 1,
      cells: cells.map((c) => c.trim()),
    }));
  }
  if (buffer.length < 2 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw fileError('FILE_TYPE_INVALID', 'Arquivo .xlsx inválido.');
  }
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw fileError('FILE_TYPE_INVALID', 'Não foi possível ler a planilha.');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw fileError('HEADER_MISSING', 'A planilha está vazia.');
  const out: { line: number; cells: string[] }[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    const cells: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) cells.push(cellText(row.getCell(c).value));
    out.push({ line: n, cells });
  });
  return out;
}

const cut = (s: string | undefined, max: number): string | null => {
  const t = (s ?? '').trim().slice(0, max);
  return t === '' ? null : t;
};

export async function parseLeadSheet(buffer: Buffer, filename: string): Promise<ParsedLeadSheet> {
  const lower = filename.toLowerCase();
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.csv')) {
    throw fileError('FILE_TYPE_INVALID', 'Envie um arquivo .xlsx ou .csv.');
  }
  if (buffer.length > MAX_IMPORT_BYTES) {
    throw fileError('FILE_TOO_LARGE', 'O arquivo passa de 2,5 MB.');
  }
  const raw = (await readRaw(buffer, filename)).filter((r) => r.cells.some((c) => c !== ''));
  if (raw.length === 0) throw fileError('HEADER_MISSING', 'A planilha está vazia.');

  const [head, ...body] = raw;
  const col = new Map<Field, number>();
  head.cells.forEach((h, i) => {
    const f = HEADERS[normalizePersonName(h)];
    if (f && !col.has(f)) col.set(f, i);
  });
  if (!col.has('fullName')) {
    throw fileError('HEADER_MISSING', 'Não achei a coluna de nome (Nome).');
  }
  if (body.length > MAX_IMPORT_ROWS) {
    throw fileError('TOO_MANY_ROWS', `A planilha passa de ${MAX_IMPORT_ROWS} linhas.`);
  }
  const get = (cells: string[], f: Field) => {
    const i = col.get(f);
    return i === undefined ? '' : (cells[i] ?? '');
  };

  const valid: ParsedLeadRow[] = [];
  const invalid: { line: number; reason: string }[] = [];
  const seen = new Map<string, number>();
  for (const { line, cells } of body) {
    const fullName = cut(get(cells, 'fullName'), 255);
    const phone = cut(get(cells, 'phone'), 30);
    const email = cut(get(cells, 'email'), 255)?.toLowerCase() ?? null;
    const bad = (reason: string) => invalid.push({ line, reason });
    if (!fullName) {
      bad('Nome obrigatório');
      continue;
    }
    if (!phone && !email) {
      bad('Informe telefone ou e-mail');
      continue;
    }
    if (phone && phoneDigits(phone) === null) {
      bad('Telefone inválido');
      continue;
    }
    if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) {
      bad('E-mail inválido');
      continue;
    }
    const kind = parseKind(get(cells, 'kind'));
    if (kind === 'invalid') {
      bad('Tipo deve ser noiva ou debutante');
      continue;
    }
    const dateText = get(cells, 'eventDate').trim();
    let eventDate: string | null = null;
    if (dateText !== '') {
      eventDate = parseDate(dateText);
      if (!eventDate) {
        bad('Data do evento inválida');
        continue;
      }
    }
    const key = phoneKey(phone);
    if (key) {
      const first = seen.get(key);
      if (first !== undefined) {
        bad(`Repetido na planilha (linha ${first})`);
        continue;
      }
      seen.set(key, line);
    }
    valid.push({
      line,
      fullName,
      phone,
      email,
      kind,
      eventDate,
      source: parseSource(get(cells, 'source')),
      notes: cut(get(cells, 'notes'), 2000),
      assigneeRef: cut(get(cells, 'assigneeRef'), 255),
    });
  }
  return { valid, invalid };
}
