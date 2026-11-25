import type { AccessItemData, MyAccessData } from '../access.api';

/** Acesso de teste: itens listados em `off` ficam desligados, o resto ligado. */
export function accessWithout(off: readonly string[], all: readonly string[]): MyAccessData {
  const items: AccessItemData[] = all.map((id) => ({
    id,
    label: id,
    group: 'g',
    groupLabel: 'G',
    enabled: !off.includes(id),
    defaultEnabled: !off.includes(id),
    source: 'DEFAULT',
    adjustable: true,
    lockReason: null,
    permissions: [],
  }));
  return { memberId: 'm1', roleName: 'MANAGER', permissions: [], canManageAccess: false, items };
}

export const PAINEL_ITEMS = ['agenda', 'fin-comandas', 'fin-controle', 'fin-previsao', 'contratos'];
