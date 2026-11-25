import { useAuthStore } from '@/infrastructure/stores/auth.store';
import type { MyAccessData } from './access.api';

/**
 * Sem acesso carregado não esconde nada (a API protege); 'home' é sempre liberado;
 * item ausente = desligado.
 */
export function hasAccessIn(access: MyAccessData | null, itemId: string): boolean {
  if (!access) return true;
  if (itemId === 'home') return true;
  return access.items.find((i) => i.id === itemId)?.enabled ?? false;
}

export function itemPermissionIn(
  access: MyAccessData | null,
  itemId: string,
  permission: string,
): boolean {
  if (!access) return false;
  const item = access.items.find((i) => i.id === itemId);
  return !!item && item.enabled && item.permissions.includes(permission);
}

export function useAccess(): MyAccessData | null {
  return useAuthStore((s) => s.access);
}

/** true só quando o acesso veio da rede nesta sessão do app. */
export function useAccessFresh(): boolean {
  return useAuthStore((s) => s.accessFresh);
}

export function useHasAccess(itemId: string): boolean {
  const access = useAuthStore((s) => s.access);
  return hasAccessIn(access, itemId);
}

export function useItemPermission(itemId: string, permission: string): boolean {
  const access = useAuthStore((s) => s.access);
  return itemPermissionIn(access, itemId, permission);
}
