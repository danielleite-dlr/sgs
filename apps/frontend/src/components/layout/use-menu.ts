import { useMemo } from 'react';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { menuForAccess, type MenuItem } from './menu-config';

/** Menu do produto já filtrado pelo acesso de quem está logado (fase 10). */
export function useMenu(): MenuItem[] {
  const access = useAuthStore((s) => s.access);
  const roleName = useAuthStore((s) => s.roleName);
  return useMemo(() => menuForAccess(access, roleName), [access, roleName]);
}
