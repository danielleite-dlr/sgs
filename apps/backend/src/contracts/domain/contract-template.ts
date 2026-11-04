import { createHash } from 'node:crypto';

export const TEMPLATE_VARIABLES = [
  'noiva_nome',
  'noiva_cpf',
  'evento_data',
  'evento_local',
  'itens',
  'valor_total',
  'entrada',
  'prazo_restante',
  'politica_cancelamento',
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export const DEFAULT_BRIDAL_TEMPLATE = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS — {{noiva_nome}}

CONTRATANTE: {{noiva_nome}}, CPF {{noiva_cpf}}.

CLÁUSULA 1 – DO OBJETO
O CONTRATADO prestará à CONTRATANTE os seguintes serviços de beleza:
{{itens}}

CLÁUSULA 2 – DO VALOR E DO PAGAMENTO
O valor total dos serviços é de {{valor_total}}. A entrada de {{entrada}} é paga na assinatura deste contrato e o restante deve ser quitado até {{prazo_restante}}.

CLÁUSULA 3 – DO EVENTO
Os serviços serão prestados na data de {{evento_data}}, no local: {{evento_local}}.

CLÁUSULA 4 – DO CANCELAMENTO
{{politica_cancelamento}}

CLÁUSULA 5 – DO ACEITE DIGITAL
A CONTRATANTE declara ter lido e concordado com este contrato, e o aceite digital, com registro de data, hora e endereço de acesso, tem validade como assinatura.`;

const VAR_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

export function validateTemplate(body: string): { unknown: string[]; missing: string[] } {
  const known: readonly string[] = TEMPLATE_VARIABLES;
  const found = new Set<string>();
  for (const m of body.matchAll(VAR_RE)) found.add(m[1]);
  return {
    unknown: [...found].filter((n) => !known.includes(n)),
    missing: TEMPLATE_VARIABLES.filter((n) => !found.has(n)),
  };
}

export function normalizeText(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
}

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/** Substitui as variáveis em passada única (valores não são reinterpretados). Texto puro. */
export function renderContract(body: string, vars: Record<TemplateVariable, string>): string {
  const known: readonly string[] = TEMPLATE_VARIABLES;
  const out = body.replace(VAR_RE, (_all, name: string) => {
    if (!known.includes(name)) throw new Error(`UNKNOWN_VARIABLE:${name}`);
    return vars[name as TemplateVariable];
  });
  return normalizeText(out);
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(cents: number): string {
  return BRL.format(cents / 100).replace(/ /g, ' ');
}

/** '12345678909' -> '***.456.789-**'; entrada inválida -> ''. */
export function maskCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return '';
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function formatDateBR(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}
