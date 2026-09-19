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

interface PlatformStash {
  /**
   * Sessão de plataforma guardada enquanto o admin está dentro do salão de um
   * cliente. Sem isso não há caminho de volta: o token do salão substitui o do
   * admin e a única saída seria logar de novo.
   */
  platformSession: AuthSession | null;
}

interface AuthActions {
  setSession: (s: AuthSession) => void;
  updateAccessToken: (accessToken: string) => void;
  setMustChangePassword: (mustChangePassword: boolean) => void;
  /** Guarda a sessão atual e entra no salão do cliente. */
  enterImpersonation: (next: AuthSession) => void;
  /** Devolve a sessão de plataforma guardada. Null se não houver. */
  takePlatformStash: () => AuthSession | null;
  clearSession: () => void;
}

export type AuthStore = AuthSession & PlatformStash & AuthActions;

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

const initialStash: PlatformStash = { platformSession: null };

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      ...initialStash,

      setSession: (s: AuthSession) => set(s),

      updateAccessToken: (accessToken: string) => set({ accessToken }),

      setMustChangePassword: (mustChangePassword: boolean) =>
        set({ mustChangePassword }),

      enterImpersonation: (next: AuthSession) => {
        const current = get();
        set({
          ...next,
          platformSession: {
            accessToken: current.accessToken,
            refreshToken: current.refreshToken,
            userId: current.userId,
            memberId: current.memberId,
            organizationId: current.organizationId,
            roleName: current.roleName,
            isPlatformAdmin: current.isPlatformAdmin,
            isPlatformMaster: current.isPlatformMaster,
            canAccessClientOrgs: current.canAccessClientOrgs,
            mustChangePassword: current.mustChangePassword,
            impersonating: false,
            organizationName: current.organizationName,
            permissions: current.permissions,
          },
        });
      },

      takePlatformStash: () => {
        const stash = get().platformSession;
        if (!stash) return null;
        set({ ...stash, platformSession: null });
        return stash;
      },

      clearSession: () => set({ ...initialState, ...initialStash }),
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
        platformSession: s.platformSession,
      }),
    },
  ),
);

export function selectHasPlatformStash(
  s: ReturnType<typeof useAuthStore.getState>,
): boolean {
  return !!s.platformSession?.accessToken;
}

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
