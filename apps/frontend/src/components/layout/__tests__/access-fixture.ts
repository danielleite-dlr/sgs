import type { AccessItemData, MyAccessData } from '@/features/access/access.api';

/** myAccess de teste: só os ids em `enabled` ficam ligados; `all` lista o universo. */
export function accessWith(enabled: readonly string[], all: readonly string[] = []): MyAccessData {
  const ids = Array.from(new Set([...all, ...enabled]));
  const items: AccessItemData[] = ids.map((id) => ({
    id,
    label: id,
    group: 'g',
    groupLabel: 'G',
    enabled: enabled.includes(id),
    defaultEnabled: enabled.includes(id),
    source: 'DEFAULT',
    adjustable: true,
    lockReason: null,
    permissions: [],
  }));
  return { memberId: 'm1', roleName: 'PROFESSIONAL', permissions: [], canManageAccess: false, items };
}

/** Os 9 itens padrão da PROFISSIONAL (catálogo do 10-01). */
export const PADRAO_PROFISSIONAL = [
  'agenda',
  'clientes-todos',
  'profissionais-todos',
  'servicos-todos',
  'produtos-todos',
  'pacotes-todos',
  'categorias',
  'fin-comissoes',
  'fin-comandas',
] as const;

export const FINANCEIRO = [
  'fin-controle',
  'fin-previsao',
  'fin-despesas-fixas',
  'fin-comissoes',
  'fin-credito',
  'fin-comandas',
  'fin-regras-comissao',
] as const;
