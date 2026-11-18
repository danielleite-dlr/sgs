import { isPathEnabled } from '@/config/features';
import { toAgendaDateParam } from '@/features/operations/lib/agenda-link';
import type { ClientHistoryItemData } from '../api/clients.api';

/** Estado de navegação para a ficha saber que veio de outra tela (botão Voltar). */
export const FROM_STATE = { voltar: true } as const;

/** "Hoje" / "Amanhã" / "Ontem" quando o dia local bate; senão null. */
export function relativeDay(date: Date, now: Date = new Date()): string | null {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((a - b) / 86_400_000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  return null;
}

/** Destino do item do histórico na aplicação (null quando não há tela). */
export function historyHref(item: ClientHistoryItemData): string | null {
  if (!item.entityType || !item.entityId) return null;
  if (item.entityType === 'comanda') {
    return isPathEnabled('/comanda') ? `/comanda/${item.entityId}` : null;
  }
  if (item.entityType === 'contract') {
    return isPathEnabled('/contratos') ? `/contratos/${item.entityId}` : null;
  }
  if (item.entityType === 'appointment') {
    return `/agenda?data=${toAgendaDateParam(new Date(item.occurredAt))}&visao=day`;
  }
  return null;
}
