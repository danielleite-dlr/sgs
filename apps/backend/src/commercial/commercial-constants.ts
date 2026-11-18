/**
 * Listas fixas do Comercial. Espelham os CHECKs de 20261122000000_phase9_commercial:
 * qualquer código novo precisa entrar aqui e na migration.
 */

export const LOST_REASONS = [
  { code: 'price', label: 'Preço' },
  { code: 'date_unavailable', label: 'Data indisponível' },
  { code: 'chose_other', label: 'Fechou com outra' },
  { code: 'no_response', label: 'Sem resposta' },
  { code: 'gave_up', label: 'Desistiu' },
  { code: 'other', label: 'Outro' },
] as const;

export const INTERACTION_TYPES = [
  { code: 'call', label: 'Ligação' },
  { code: 'whatsapp', label: 'WhatsApp' },
  { code: 'email', label: 'E-mail' },
  { code: 'meeting', label: 'Reunião' },
  { code: 'visit', label: 'Visita' },
  { code: 'other', label: 'Outro' },
] as const;

export const DEAL_KINDS = [
  { code: 'noiva', label: 'Noiva' },
  { code: 'debutante', label: 'Debutante' },
] as const;

export const COMMERCIAL_SOURCES = [
  { code: 'manual', label: 'Manual' },
  { code: 'instagram', label: 'Instagram' },
  { code: 'indicacao', label: 'Indicação' },
  { code: 'site', label: 'Site' },
  { code: 'whatsapp', label: 'WhatsApp' },
  { code: 'import', label: 'Importação' },
  { code: 'outro', label: 'Outro' },
] as const;

export type LostReasonCode = (typeof LOST_REASONS)[number]['code'];
export type InteractionType = (typeof INTERACTION_TYPES)[number]['code'];
export type DealKind = (typeof DEAL_KINDS)[number]['code'];
export type CommercialSource = (typeof COMMERCIAL_SOURCES)[number]['code'];

const has = (list: readonly { code: string }[], code: unknown): boolean =>
  typeof code === 'string' && list.some((i) => i.code === code);

export const isLostReason = (code: unknown): code is LostReasonCode => has(LOST_REASONS, code);
export const isInteractionType = (code: unknown): code is InteractionType =>
  has(INTERACTION_TYPES, code);
export const isDealKind = (code: unknown): code is DealKind => has(DEAL_KINDS, code);
export const isCommercialSource = (code: unknown): code is CommercialSource =>
  has(COMMERCIAL_SOURCES, code);
