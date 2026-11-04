import type { NotificationData } from '../api/notifications.api';

export interface NotificationView {
  title: string;
  message: string;
  href: string | null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Traduz uma notificação do backend em título, mensagem e destino de navegação. */
export function describeNotification(
  n: Pick<NotificationData, 'kind' | 'payload'>,
): NotificationView {
  const p = n.payload ?? {};

  if (n.kind === 'stock_low') {
    const name = str(p.productName) ?? 'Produto';
    const current = p.currentStock;
    const min = p.minStockLevel;
    const detail =
      typeof current === 'number' && typeof min === 'number'
        ? ` (estoque ${current}, mínimo ${min})`
        : '';
    return {
      title: 'Estoque baixo',
      message: `${name} está com estoque baixo${detail}.`,
      href: '/catalogo/produtos',
    };
  }

  if (n.kind.startsWith('contract_') || n.kind.startsWith('bridal_')) {
    const contractId = str(p.contractId);
    const groupId = str(p.groupId);
    return {
      title: str(p.title) ?? n.kind,
      message: str(p.message) ?? '',
      href: contractId ? `/contratos/${contractId}` : groupId ? `/noivas/${groupId}` : null,
    };
  }

  return { title: n.kind, message: str(p.message) ?? '', href: null };
}

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

/** "há 5 minutos", "ontem" etc. (date-fns não é dependência do frontend). */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return 'agora mesmo';
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}
