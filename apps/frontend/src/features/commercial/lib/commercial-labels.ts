/** Rótulos do Comercial. Os códigos espelham apps/backend/src/commercial/commercial-constants.ts. */

export const KIND_LABEL: Record<string, string> = {
  noiva: 'Noiva',
  debutante: 'Debutante',
};

export const SOURCE_OPTIONS = [
  { code: 'manual', label: 'Manual' },
  { code: 'instagram', label: 'Instagram' },
  { code: 'indicacao', label: 'Indicação' },
  { code: 'site', label: 'Site' },
  { code: 'whatsapp', label: 'WhatsApp' },
  { code: 'import', label: 'Importação' },
  { code: 'outro', label: 'Outro' },
] as const;

export const LOST_REASON_OPTIONS = [
  { code: 'price', label: 'Preço' },
  { code: 'date_unavailable', label: 'Data indisponível' },
  { code: 'chose_other', label: 'Fechou com outra' },
  { code: 'no_response', label: 'Sem resposta' },
  { code: 'gave_up', label: 'Desistiu' },
  { code: 'other', label: 'Outro' },
] as const;

export const INTERACTION_TYPE_OPTIONS = [
  { code: 'call', label: 'Ligação' },
  { code: 'whatsapp', label: 'WhatsApp' },
  { code: 'email', label: 'E-mail' },
  { code: 'meeting', label: 'Reunião' },
  { code: 'visit', label: 'Visita' },
  { code: 'other', label: 'Outro' },
] as const;

function labelOf(list: readonly { code: string; label: string }[], code: string): string {
  return list.find((i) => i.code === code)?.label ?? code;
}

export const sourceLabel = (code: string) => labelOf(SOURCE_OPTIONS, code);
export const lostReasonLabel = (code: string) => labelOf(LOST_REASON_OPTIONS, code);
export const interactionTypeLabel = (code: string) => labelOf(INTERACTION_TYPE_OPTIONS, code);

/** Aceita '450', '450.5', '450,50', '1.450,00' e devolve centavos inteiros; null se inválido. */
export function toCents(value: string): number | null {
  let v = value.trim();
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(v);
  if (!m) return null;
  const cents = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0') || '0');
  return m[1] ? -cents : cents;
}

/** Centavos -> '450.00' (formato que a API espera). */
export function centsToDecimal(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** '450.00' -> 'R$ 450,00' (texto, sem float). */
export function formatMoney(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const cents = toCents(value);
  if (cents == null) return value;
  const abs = Math.abs(cents);
  const reais = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cents < 0 ? '-' : ''}R$ ${reais},${String(abs % 100).padStart(2, '0')}`;
}

/** '2027-05-10' -> '10/05/2027' (sem Date, evita deslocamento de fuso). */
export function formatYmd(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ymd;
}

export function formatDateTime(
  iso: string | null | undefined,
  timeZone = 'America/Sao_Paulo',
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(d)
    .replace(',', '');
}

/** Mensagem do primeiro erro da API ou texto padrão. */
export function firstError(errors: { message: string }[] | undefined, fallback: string): string {
  return errors && errors.length > 0 ? errors[0]!.message : fallback;
}
