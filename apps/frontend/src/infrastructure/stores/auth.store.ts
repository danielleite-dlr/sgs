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
  isPlatformAdmin: boolean;
  isPlatformMaster: boolean;
  canAccessClientOrgs: boolean;
  mustChangePassword: boolean;
  /** Sessão aberta pelo seletor, dentro do salão de um cliente. */
  impersonating: boolean;
  organizationName: string | null;
  permissions: string[];
}

interface AuthActions {
  setSession: (s: AuthSession) => void;
  updateAccessToken: (accessToken: string) => void;
  setMustChangePassword: (mustChangePassword: boolean) => void;
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
  isPlatformAdmin: false,
  isPlatformMaster: false,
  canAccessClientOrgs: false,
  mustChangePassword: false,
  impersonating: false,
  organizationName: null,
  permissions: [],
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      setSession: (s: AuthSession) => set(s),

      updateAccessToken: (accessToken: string) => set({ accessToken }),

      setMustChangePassword: (mustChangePassword: boolean) =>
        set({ mustChangePassword }),

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
        isPlatformAdmin: s.isPlatformAdmin,
        isPlatformMaster: s.isPlatformMaster,
        canAccessClientOrgs: s.canAccessClientOrgs,
        mustChangePassword: s.mustChangePassword,
        impersonating: s.impersonating,
        organizationName: s.organizationName,
        permissions: s.permissions,
      }),
    },
  ),
);

export function selectMustChangePassword(
  s: ReturnType<typeof useAuthStore.getState>,
): boolean {
  return !!s.accessToken && !!s.mustChangePassword;
}

export function selectIsPlatformAdmin(
  s: ReturnType<typeof useAuthStore.getState>,
): boolean {
  return !!s.accessToken && !!s.isPlatformAdmin && !s.impersonating;
}

export function selectIsAuthenticated(
  s: ReturnType<typeof useAuthStore.getState>,
): boolean {
  return !!s.accessToken && !!s.userId;
}
