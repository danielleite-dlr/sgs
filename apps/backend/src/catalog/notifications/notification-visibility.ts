import { ALERT_KINDS } from '../../contracts/alerts/alert-candidates';
import type { ResolvedAccess } from '../../authz/access/access-resolve';

/** Tipos que a pessoa não vê porque o item está desligado (fase 10, PERM-12). */
export function hiddenNotificationKinds(access: ResolvedAccess | null): string[] {
  if (!access) return [];
  const hidden: string[] = [];
  if (!access.items.get('produtos-todos')?.enabled) hidden.push('stock_low');
  if (!access.items.get('contratos')?.enabled) hidden.push(...ALERT_KINDS);
  return hidden;
}
