// Cor automática por profissional na agenda (quick-261108-n4s).
// Borda esquerda = status (statusSpineColor); fundo do cartão = profissional.
// Atribuição por posição na lista ordenada por id (UUID v7 = ordem de criação), sem hash:
// até 12 profissionais nenhuma cor se repete; a partir da 13ª a paleta recomeça.
export interface ProfessionalTone {
  name: string;
  bg: string;
  bgHover: string;
  avatarBg: string;
}

// Visual de antes da cor por profissional (cartão branco, bolinha primary-50).
export const NEUTRAL_TONE: ProfessionalTone = {
  name: 'neutro',
  bg: '#FFFFFF',
  bgHover: '#F9FAFB',
  avatarBg: '#F5E6FB',
};

// Ordem pensada para vizinhas bem diferentes; tons claros, longe das cores de status.
export const PROFESSIONAL_TONES: readonly ProfessionalTone[] = [
  { name: 'lilás', bg: '#F3E8FF', bgHover: '#E9D5FF', avatarBg: '#D8B4FE' },
  { name: 'verde', bg: '#DCFCE7', bgHover: '#BBF7D0', avatarBg: '#86EFAC' },
  { name: 'azul', bg: '#DBEAFE', bgHover: '#BFDBFE', avatarBg: '#93C5FD' },
  { name: 'âmbar', bg: '#FEF3C7', bgHover: '#FDE68A', avatarBg: '#FCD34D' },
  { name: 'rosa', bg: '#FFE4E6', bgHover: '#FECDD3', avatarBg: '#FDA4AF' },
  { name: 'turquesa', bg: '#CCFBF1', bgHover: '#99F6E4', avatarBg: '#5EEAD4' },
  { name: 'laranja', bg: '#FFEDD5', bgHover: '#FED7AA', avatarBg: '#FDBA74' },
  { name: 'índigo', bg: '#E0E7FF', bgHover: '#C7D2FE', avatarBg: '#A5B4FC' },
  { name: 'lima', bg: '#ECFCCB', bgHover: '#D9F99D', avatarBg: '#BEF264' },
  { name: 'fúcsia', bg: '#FAE8FF', bgHover: '#F5D0FE', avatarBg: '#F0ABFC' },
  { name: 'ciano', bg: '#CFFAFE', bgHover: '#A5F3FC', avatarBg: '#67E8F9' },
  { name: 'areia', bg: '#E7E5E4', bgHover: '#D6D3D1', avatarBg: '#A8A29E' },
];

/** Recebe a lista COMPLETA de profissionais (não a filtrada), em qualquer ordem. */
export function buildProfessionalToneMap(
  ids: readonly string[],
): Map<string, ProfessionalTone> {
  const sorted = [...new Set(ids)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const map = new Map<string, ProfessionalTone>();
  sorted.forEach((id, i) => {
    map.set(id, PROFESSIONAL_TONES[i % PROFESSIONAL_TONES.length]);
  });
  return map;
}
