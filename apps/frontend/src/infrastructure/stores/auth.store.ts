import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
}

export interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
}

export interface AuthActions {
  setSession: (token: string, user: AuthUser) => void;
  clearSession: () => void;
  updateUser: (partial: Partial<AuthUser>) => void;
}

export type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  accessToken: null,
  user: null,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    immer((set) => ({
      ...initialState,

      setSession: (token: string, user: AuthUser) =>
        set((state) => {
          state.accessToken = token;
          state.user = user;
          state.isAuthenticated = true;
        }),

      clearSession: () =>
        set((state) => {
          state.accessToken = null;
          state.user = null;
          state.isAuthenticated = false;
        }),

      updateUser: (partial: Partial<AuthUser>) =>
        set((state) => {
          if (state.user) {
            Object.assign(state.user, partial);
          }
        }),
    })),
    {
      name: 'sgs-auth',
      storage: createJSONStorage(() => localStorage),
      // Only persist the token and user data, not actions
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
