import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import type { AuthSession as StoredSession } from '@/infrastructure/stores/auth.store';
import { useLogoutMutation, useRefreshMutation } from '../api/auth.api';
import type { AuthPayload } from '../types';

function toStoredSession(payload: AuthPayload): StoredSession | null {
  if (!payload.accessToken || !payload.session) return null;
  const m = payload.session.memberships[0];
  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken ?? null,
    userId: payload.session.userId,
    memberId: m?.memberId ?? null,
    organizationId: m?.organizationId ?? null,
    roleName: m?.roleName ?? null,
    isPlatformAdmin: payload.session.isPlatformAdmin ?? false,
    isPlatformMaster: payload.session.isPlatformMaster ?? false,
    canAccessClientOrgs: payload.session.canAccessClientOrgs ?? false,
    mustChangePassword: payload.session.mustChangePassword ?? false,
    impersonating: payload.session.impersonating ?? false,
    organizationName: m?.organizationName ?? null,
    // permissions populated by /me query later or derived from memberships
    permissions: [],
  };
}

export function useAuth() {
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const enterImpersonation = useAuthStore((s) => s.enterImpersonation);
  const takePlatformStash = useAuthStore((s) => s.takePlatformStash);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const impersonating = useAuthStore((s) => s.impersonating);
  const navigate = useNavigate();
  const [logoutMutation] = useLogoutMutation();
  const [refreshSession] = useRefreshMutation();

  const applyAuthPayload = useCallback(
    (payload: AuthPayload): boolean => {
      const session = toStoredSession(payload);
      if (!session) return false;
      setSession(session);
      return true;
    },
    [setSession],
  );

  /** Entra no salão do cliente guardando a sessão de plataforma para a volta. */
  const enterClient = useCallback(
    (payload: AuthPayload): boolean => {
      const session = toStoredSession(payload);
      if (!session) return false;
      enterImpersonation(session);
      return true;
    },
    [enterImpersonation],
  );

  /**
   * Volta do salão para o painel.
   *
   * O access token de plataforma guardado dura 15 minutos e o admin costuma
   * passar mais tempo que isso dentro do cliente, então a volta renova pelo
   * refresh token em vez de restaurar um token provavelmente vencido. Se a
   * renovação falhar, o jeito é logar de novo.
   */
  const exitClient = useCallback(async () => {
    const stash = takePlatformStash();
    if (!stash?.refreshToken) {
      clearSession();
      navigate('/login', { replace: true });
      return;
    }

    try {
      const res = await refreshSession({
        variables: { input: { refreshToken: stash.refreshToken } },
      });
      const payload = res.data?.refreshSession;
      if (payload?.accessToken && applyAuthPayload(payload)) {
        navigate('/admin', { replace: true });
        return;
      }
    } catch {
      // cai no fallback abaixo
    }

    clearSession();
    navigate('/login', { replace: true });
  }, [takePlatformStash, refreshSession, applyAuthPayload, clearSession, navigate]);

  const logout = useCallback(async () => {
    // Sair pelo menu do salão enquanto se está dentro de um cliente não deve
    // derrubar a sessão de plataforma: volta para o painel, que é o que o
    // admin quer em 100% dos casos.
    if (impersonating) {
      await exitClient();
      return;
    }

    if (refreshToken) {
      await logoutMutation({
        variables: { input: { refreshToken } },
      }).catch(() => {
        // ignore logout errors — always clear local session
      });
    }
    clearSession();
    navigate('/login', { replace: true });
  }, [impersonating, exitClient, refreshToken, logoutMutation, clearSession, navigate]);

  return { applyAuthPayload, enterClient, exitClient, logout };
}
