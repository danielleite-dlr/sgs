import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  useAuthStore,
  selectMustChangePassword,
} from '@/infrastructure/stores/auth.store';

interface RequirePasswordChangeProps {
  children: ReactNode;
}

/**
 * RequirePasswordChange — prende quem entrou com senha temporária na tela de
 * troca, até que ele defina uma senha própria.
 *
 * Só bloqueia navegação. Quem garante de fato é o backend, que mantém a flag
 * must_change_password no usuário até a troca acontecer.
 */
export function RequirePasswordChange({ children }: RequirePasswordChangeProps) {
  const mustChange = useAuthStore(selectMustChangePassword);
  const location = useLocation();

  if (mustChange && location.pathname !== '/trocar-senha') {
    return <Navigate to="/trocar-senha" replace />;
  }

  return <>{children}</>;
}
