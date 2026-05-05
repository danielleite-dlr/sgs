import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { useLogoutMutation } from '../api/auth.api';
import type { AuthPayload } from '../types';

export function useAuth() {
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const navigate = useNavigate();
  const [logoutMutation] = useLogoutMutation();

  const applyAuthPayload = useCallback(
    (payload: AuthPayload): boolean => {
      if (!payload.accessToken || !payload.refreshToken || !payload.session) {
        return false;
      }
      const m = payload.session.memberships[0];
      setSession({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        userId: payload.session.userId,
        memberId: m?.memberId ?? null,
        organizationId: m?.organizationId ?? null,
        roleName: m?.roleName ?? null,
        // permissions populated by /me query later or derived from memberships
        permissions: [],
      });
      return true;
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    if (refreshToken) {
      await logoutMutation({
        variables: { input: { refreshToken } },
      }).catch(() => {
        // ignore logout errors — always clear local session
      });
    }
    clearSession();
    navigate('/login', { replace: true });
  }, [refreshToken, logoutMutation, clearSession, navigate]);

  return { applyAuthPayload, logout };
}
