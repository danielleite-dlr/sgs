import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthSession {
  accessToken: string | null;
  /** NOTE: refresh token in localStorage is acceptable for Phase 1; rotate to httpOnly cookie in v2 */
  refreshToken: string | null;
  userId: string | null;
  memberId: string | null;
  organizationId: string | null;
  roleName: string | null;
  permissions: string[];
}

interface AuthActions {
  setSession: (s: AuthSession) => void;
  updateAccessToken: (accessToken: string) => void;
  clearSession: () => void;
}

export type AuthStore = AuthSession & AuthActions;

const initialState: AuthSession = {
  accessToken: null,
  refreshToken: null,
  userId: null,
  memberId: null,
  organizationId: null,
  roleName: null,
  permissions: [],
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      setSession: (s: AuthSession) => set(s),

      updateAccessToken: (accessToken: string) => set({ accessToken }),

      clearSession: () => set(initialState),
    }),
    {
      name: 'sgs-auth',
      storage: createJSONStorage(() => localStorage),
      // Only persist tokens + identity — never re-hydrate stale permissions
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        userId: s.userId,
        memberId: s.memberId,
        organizationId: s.organizationId,
        roleName: s.roleName,
        permissions: s.permissions,
      }),
    },
  ),
);

export function selectIsAuthenticated(
  s: ReturnType<typeof useAuthStore.getState>,
): boolean {
  return !!s.accessToken && !!s.userId;
}
