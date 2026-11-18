import { useMemo } from 'react';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { menuForRole, type MenuItem } from './menu-config';

/** Menu do produto já filtrado pelo papel de quem está logado. */
export function useMenu(): MenuItem[] {
  const roleName = useAuthStore((s) => s.roleName);
  return useMemo(() => menuForRole(roleName), [roleName]);
}
