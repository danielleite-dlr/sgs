/**
 * Textos do modelo de contrato (fase 04.1, D-17): texto padrão por seção com variáveis,
 * renderização segura, parser de **negrito**, sanitização WinAnsi e data por extenso.
 * Domínio puro: sem Prisma, sem Nest. O módulo legado `contract-template.ts` não é tocado.
 */

export const CONTRACT_TEXT_SECTIONS = [
  'title',
  'intro',
  'parties',
  'trialNote',
  'clauses',
] as const;
export type ContractTextSection = (typeof CONTRACT_TEXT_SECTIONS)[number];
export type ContractTexts = Record<ContractTextSection, string>;

export const CONTRACT_TEXT_VARIABLES = [
  'tipo_cliente',
  'prazo_restante_dias',
  'prazo_desistencia_dias',
  'cidade_foro',
  'uf_foro',
  'studio_nome',
  'studio_cnpj',
  'studio_endereco',
  'studio_representante',
  'studio_representante_rg',
] as const;
export type ContractTextVariable = (typeof CONTRACT_TEXT_VARIABLES)[number];

export const MAX_SECTION_LENGTH = 20000;

const CLAUSES_PARAGRAPHS: string[] = [
  '**II. Do objeto do contrato e do Orçamento:**\nO presente contrato tem como OBJETO a prestação de serviços descritos no orçamento acima.\n**Parágrafo Primeiro:** Os serviços da CONTRATADA serão prestados no local, no dia, mês, ano e horário confirmados no fechamento do contrato.\n**Parágrafo Segundo:** O sinal pago no ato da contratação tem como finalidade a reserva da data do evento.',
  '**III. Das obrigações da Contratada:**\nA contratada se compromete a realizar seus serviços no local a combinado e descrito nesse contrato.',
  '**IV. Agendamento de Testes**\nO agendamento dos testes ficará condicionado à quitação integral do contrato, conforme disposto no orçamento.',
  '**V. Cláusula penal**\nCaso o CONTRATANTE desista de promover a festa ou serviço contratado, ou seja, o evento seja cancelado por sua culpa, ficam estipuladas as seguintes cláusulas penais:\n**Parágrafo Primeiro.** Os valores pagos a título de sinal têm natureza de arras confirmatórias, não sendo passíveis de devolução em caso de cancelamento por iniciativa da CONTRATANTE.\n**Parágrafo Segundo.** A desistência deve ser informada com até {{prazo_desistencia_dias}} dias de antecedência ao evento.\n**Parágrafo Terceiro.** O reagendamento do evento ficará sujeito à disponibilidade de agenda da CONTRATADA, não havendo garantia de manutenção da data originalmente contratada.\n**Parágrafo Quarto.** Caso a desistência se dê por culpa da CONTRATADA esta deverá devolver integralmente a importância já paga pela CONTRATANTE.\n**Parágrafo Quinto.** O não pagamento do valor restante até {{prazo_restante_dias}} dias antes do evento autoriza a CONTRATADA a rescindir o presente contrato, sem obrigação de prestar os serviços, mantendo integralmente os valores já pagos.',
  '**VI. Caso Fortuito, Força Maior e Atrasos**\nA CONTRATADA não se responsabiliza por atrasos decorrentes de fatos alheios à sua vontade, tais como atrasos da CONTRATANTE, terceiros, condições climáticas, trânsito ou força maior.\n**Parágrafo Primeiro.** A CONTRATADA não se responsabiliza por prejuízos decorrentes de atrasos, ausência ou condutas da CONTRATANTE ou de seus acompanhantes que comprometam o cronograma do atendimento.',
  '**VII. Imagem**\nA CONTRATANTE autoriza, de forma gratuita, a utilização de sua imagem para fins institucionais e publicitários da CONTRATADA. A revogação desta autorização deverá ser solicitada por escrito e produzirá efeitos apenas para usos futuros.',
  '**VIII. Exclusividade Profissional**\nDurante a execução dos serviços, não será permitida a atuação de profissionais externos de maquiagem e penteado no local contratado, visando a organização, o cronograma e o padrão estético do atendimento.',
  '**Das disposições finais.**\nE por estarem de pleno acordo, as partes elegem o foro da comarca da Cidade de {{cidade_foro}}, Estado de {{uf_foro}}, sendo excluído qualquer outro, por mais privilegiado que seja para resolver qualquer litígio que porventura venha a surgir em razão do presente contrato.',
];

export const DEFAULT_CONTRACT_TEXTS: ContractTexts = {
  title: 'CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇO',
  intro:
    'Ao assinar este contrato, a CONTRATANTE declara ter lido, compreendido e concordado integralmente com todas as cláusulas, não cabendo alegação futura de desconhecimento.',
  parties:
    '**I. Das partes:** têm entre os mesmos, de maneira justa e acordada, o presente **CONTRATO PARA PRESTAÇÃO DE SERVIÇOS**, ficando desde já aceito, pelas partes as cláusulas abaixo descritas.\n\n**Contratado: {{studio_nome}}**, CNPJ {{studio_cnpj}}, situada na {{studio_endereco}}, e neste contrato representado por {{studio_representante}} portadora do RG: {{studio_representante_rg}}.',
  trialNote:
    '**Obs.:** Os testes de maquiagem e penteado da {{tipo_cliente}} poderão ser realizados em até {{prazo_restante_dias}} dias antes do evento, mediante agendamento prévio, disponibilidade de agenda da CONTRATADA e desde que o contrato esteja integralmente quitado.',
  clauses: CLAUSES_PARAGRAPHS.join('\n\n'),
};

const VARIABLE_REGEX = /\{\{\s*([a-z_]+)\s*\}\}/g;
const KNOWN = new Set<string>(CONTRACT_TEXT_VARIABLES);

/** Nomes de variáveis (únicos, em ordem) que não pertencem ao conjunto permitido. */
export function findUnknownVariables(body: string): string[] {
  const unknown: string[] = [];
  for (const m of body.matchAll(VARIABLE_REGEX)) {
    if (!KNOWN.has(m[1]) && !unknown.includes(m[1])) unknown.push(m[1]);
  }
  return unknown;
}

/** Substitui `{{var}}`; asteriscos dos valores são removidos para nunca abrir/fechar negrito. */
export function renderContractText(
  body: string,
  vars: Record<ContractTextVariable, string>,
): string {
  if (findUnknownVariables(body).length > 0) throw new RangeError('UNKNOWN_TEMPLATE_VARIABLE');
  return body.replace(VARIABLE_REGEX, (_m, name: string) =>
    (vars[name as ContractTextVariable] ?? '').replace(/\*/g, ''),
  );
}

export interface ContractTextIssue {
  section: ContractTextSection;
  code: 'UNKNOWN_TEMPLATE_VARIABLE' | 'TEXT_TOO_LONG' | 'TEXT_UNSUPPORTED_CHARS' | 'TEXT_EMPTY';
  detail: string;
}

export function validateContractTexts(
  texts: Partial<Record<ContractTextSection, string | null>>,
): ContractTextIssue[] {
  const issues: ContractTextIssue[] = [];
  for (const section of CONTRACT_TEXT_SECTIONS) {
    const body = texts[section];
    if (body === null || body === undefined) continue;
    if (body.trim().length === 0) {
      issues.push({ section, code: 'TEXT_EMPTY', detail: '' });
      continue;
    }
    if (body.length > MAX_SECTION_LENGTH) {
      issues.push({
        section,
        code: 'TEXT_TOO_LONG',
        detail: String(body.length),
      });
    }
    for (const name of findUnknownVariables(body)) {
      issues.push({ section, code: 'UNKNOWN_TEMPLATE_VARIABLE', detail: name });
    }
    const bad = unsupportedChars(body);
    if (bad.length > 0) {
      issues.push({
        section,
        code: 'TEXT_UNSUPPORTED_CHARS',
        detail: bad.join(''),
      });
    }
  }
  return issues;
}

export interface TextRun {
  text: string;
  bold: boolean;
}

/** `**negrito**` vira runs; marcadores soltos permanecem como texto literal. */
export function parseBold(s: string): TextRun[] {
  const runs: TextRun[] = [];
  for (const part of s.split(/(\*\*[^*]+\*\*)/g)) {
    if (part === '') continue;
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      runs.push({ text: part.slice(2, -2), bold: true });
    } else {
      runs.push({ text: part, bold: false });
    }
  }
  return runs;
}

/** Parágrafos separados por uma ou mais linhas em branco; `\n` simples fica dentro do parágrafo. */
export function splitParagraphs(s: string): string[] {
  return s
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

const CP1252_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

function isWinAnsi(ch: string): boolean {
  const c = ch.codePointAt(0) as number;
  return (
    (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || c === 0x0a || CP1252_EXTRAS.includes(ch)
  );
}

/** Caracteres (únicos) fora do WinAnsi, em ordem de aparição. */
export function unsupportedChars(s: string): string[] {
  const out: string[] = [];
  for (const ch of s.normalize('NFC')) {
    if (!isWinAnsi(ch) && !out.includes(ch)) out.push(ch);
  }
  return out;
}

/** Normaliza NFC e remove o que o WinAnsi não suporta. */
export function toWinAnsi(s: string): string {
  return Array.from(s.normalize('NFC')).filter(isWinAnsi).join('');
}

const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** `2026-11-04` -> `04 de novembro de 2026` (sem Intl). */
export function formatDateLongBR(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new RangeError('INVALID_DATE');
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new RangeError('INVALID_DATE');
  }
  return `${m[3]} de ${MONTHS_PT[mo - 1]} de ${m[1]}`;
}
