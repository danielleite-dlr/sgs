---
phase: 01-foundation
plan: 06
type: execute
wave: 5
depends_on: [03, 04, 05]
files_modified:
  - apps/frontend/src/features/auth/api/queries.graphql
  - apps/frontend/src/features/auth/api/mutations.graphql
  - apps/frontend/src/features/auth/api/auth.api.ts
  - apps/frontend/src/features/auth/components/AuthCard.tsx
  - apps/frontend/src/features/auth/components/AuthShell.tsx
  - apps/frontend/src/features/auth/components/Logo.tsx
  - apps/frontend/src/features/auth/components/PasswordInput.tsx
  - apps/frontend/src/features/auth/components/StepIndicator.tsx
  - apps/frontend/src/features/auth/hooks/useAuth.ts
  - apps/frontend/src/features/auth/hooks/useResendCooldown.ts
  - apps/frontend/src/features/auth/pages/LoginPage.tsx
  - apps/frontend/src/features/auth/pages/SignupPage.tsx
  - apps/frontend/src/features/auth/pages/SignupStep1.tsx
  - apps/frontend/src/features/auth/pages/SignupStep2.tsx
  - apps/frontend/src/features/auth/pages/VerifyEmailPendingPage.tsx
  - apps/frontend/src/features/auth/pages/VerifyEmailSuccessPage.tsx
  - apps/frontend/src/features/auth/pages/InvitationPage.tsx
  - apps/frontend/src/features/auth/pages/NotFoundPage.tsx
  - apps/frontend/src/features/auth/types.ts
  - apps/frontend/src/router.tsx
  - apps/frontend/src/components/ProtectedRoute.tsx
  - apps/frontend/src/pages/DashboardPlaceholder.tsx
  - apps/frontend/codegen.ts
autonomous: false
requirements: [AUTH-01, AUTH-02, AUTH-03]

must_haves:
  truths:
    - "User can navigate to /login and submit credentials; on success, accessToken/refreshToken are stored in Zustand auth store and they are redirected to /dashboard placeholder"
    - "User can navigate to /signup, complete the 2-step flow, and be redirected to /verificar-email"
    - "User can land on /verificar-email/sucesso with a token query param, see success state, and click 'Entrar agora' to navigate to /login"
    - "User can land on /convite/{token}, set name + password, accept the invitation, and be logged in directly"
    - "Browser refresh with valid stored tokens preserves the session (auth store hydrated from localStorage)"
    - "All UI strings match the UI-SPEC copywriting contract verbatim"
    - "Forms validate on blur per UI-SPEC; submit disabled until valid; Loader2 spinner shown on loading state"
    - "PasswordInput toggles visibility via Eye/EyeOff with aria-label"
  artifacts:
    - path: "apps/frontend/src/features/auth/pages/LoginPage.tsx"
      provides: "Login screen consuming the login mutation"
      min_lines: 60
    - path: "apps/frontend/src/features/auth/pages/SignupPage.tsx"
      provides: "Signup orchestrator routing between step 1 and step 2"
      min_lines: 30
    - path: "apps/frontend/src/features/auth/pages/InvitationPage.tsx"
      provides: "Invitation acceptance screen with expired/used error states"
      min_lines: 60
    - path: "apps/frontend/src/features/auth/components/AuthShell.tsx"
      provides: "Shared shell (centered card on background) used by all 6 auth screens"
      exports: ["AuthShell"]
    - path: "apps/frontend/src/features/auth/components/PasswordInput.tsx"
      provides: "Custom shadcn-styled input with Eye/EyeOff toggle"
      exports: ["PasswordInput"]
    - path: "apps/frontend/src/features/auth/components/StepIndicator.tsx"
      provides: "2-dot step indicator (UI-SPEC §Layout)"
      exports: ["StepIndicator"]
    - path: "apps/frontend/src/router.tsx"
      provides: "Router with real auth pages wired (replacing placeholders from plan 03)"
      contains: "LoginPage"
  key_links:
    - from: "LoginPage submit handler"
      to: "login GraphQL mutation"
      via: "Apollo useMutation"
      pattern: "useLoginMutation"
    - from: "Login success handler"
      to: "useAuthStore.setSession"
      via: "AuthPayload → Zustand"
      pattern: "setSession"
    - from: "VerifyEmailSuccess page on mount"
      to: "verifyEmail GraphQL mutation"
      via: "URL ?token query param"
      pattern: "verifyEmail"
    - from: "InvitationPage submit"
      to: "acceptInvitation GraphQL mutation"
      via: "Token from URL :token route param"
      pattern: "acceptInvitation"
---

<objective>
Build the 6 auth pages from UI-SPEC: Login, Signup (2-step), Email verification pending, Email verification success, Member invitation acceptance, and 404. Wire each to the GraphQL mutations from plan 04 + plan 05. Honor every UI-SPEC contract: copywriting verbatim, exact tokens (colors, spacing, typography), form validation timing (on blur), loading states (Loader2 + disabled button), accessibility (aria-labels, focus management, WCAG contrast).

Output: A user can complete the full auth flow visible at http://localhost:5173 — sign up, verify email (via the link in the dev console / Resend), log in, refresh the browser and stay logged in (AUTH-02 verifiable end-to-end).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-UI-SPEC.md
@.planning/phases/01-foundation/01-03-SUMMARY.md
@.planning/phases/01-foundation/01-04-SUMMARY.md
@.planning/phases/01-foundation/01-05-SUMMARY.md
@PRD_Frontend_Plataforma_Saloes.md
@apps/frontend/src/infrastructure/apollo/client.ts
@apps/frontend/src/infrastructure/stores/auth.store.ts
@apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
@apps/frontend/src/router.tsx
@apps/frontend/src/components/ui/button.tsx
@apps/frontend/src/components/ui/input.tsx
@apps/frontend/src/components/ui/card.tsx
@apps/frontend/src/components/ui/alert.tsx
@apps/frontend/src/components/ui/form.tsx
@apps/backend/src/graphql/schema/auth.graphql
@apps/backend/src/graphql/schema/identity.graphql

<interfaces>
<!-- From plan 03 (frontend scaffold): -->
- shadcn primitives in apps/frontend/src/components/ui/: Button, Input, Label, Card, Alert, Form, Separator, Sonner
- Apollo Client at @/infrastructure/apollo/client (httpLink → ${VITE_API_URL}/graphql, with auth-link, error-link)
- useAuthStore (Zustand, persisted to localStorage as 'sgs-auth') exposes:
    - state: accessToken, refreshToken, userId, memberId, organizationId, roleName, permissions
    - actions: setSession({...}), updateAccessToken(t), clearSession()
- selectIsAuthenticated(state)
- react-i18next initialized with pt-BR (use `useTranslation()` and `t('login.cardHeading')`)
- React Router 6 with placeholder routes — this plan replaces the placeholders

<!-- From plan 04 (backend auth): -->
- Mutations: signup(SignupInput), verifyEmail(VerifyEmailInput), resendVerification(ResendVerificationInput), login(LoginInput), refreshSession(RefreshInput), logout(RefreshInput)
- Query: me
- AuthPayload shape: { accessToken: String, refreshToken: String, session: { userId, email, fullName, memberships: [{memberId, organizationId, organizationName, roleName}] }, errors: [{code, message, field?}] }
- Error codes: INVALID_CREDENTIALS, ACCOUNT_UNVERIFIED, EMAIL_TAKEN, TOKEN_EXPIRED, TOKEN_INVALID, TOKEN_ALREADY_USED, TOKEN_REUSE_DETECTED, INVITATION_EXPIRED, INVITATION_USED, PASSWORD_TOO_SHORT, NAME_TOO_SHORT

<!-- From plan 05 (RBAC + invitations): -->
- Mutations: inviteMember (requires permission), acceptInvitation (Public), revokeInvitation, pendingInvitations
- AcceptInvitationInput: { token: String!, fullName: String!, password: String! }
- The X-Organization-Id header is read from useAuthStore.organizationId (set in setSession on login/signup)

<!-- UI-SPEC contracts: -->
- All copy from i18n keys (already in pt-BR.json from plan 03)
- Auth shell: min-h-screen flex items-center justify-center bg-neutral-50, padding 16px mobile, card max-width 400px
- Card: bg-neutral-0, border 1px neutral-200, rounded-lg (12px), padding 32px desktop / 24px mobile, shadow-card
- Validate on blur, submit disabled until valid
- 60s cooldown on resend email button
- Eye/EyeOff icons inside password input
- 2-dot step indicator with active state primary-500, inactive neutral-200
- Auth-level errors: shadcn Alert with variant="destructive" above submit button
- Field errors: text-error-500 below the field
- Toasts (sonner) for success states (email resent)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build shared auth components (AuthShell, AuthCard, Logo, PasswordInput, StepIndicator) and auth API client</name>
  <files>apps/frontend/src/features/auth/api/queries.graphql, apps/frontend/src/features/auth/api/mutations.graphql, apps/frontend/src/features/auth/api/auth.api.ts, apps/frontend/src/features/auth/components/AuthCard.tsx, apps/frontend/src/features/auth/components/AuthShell.tsx, apps/frontend/src/features/auth/components/Logo.tsx, apps/frontend/src/features/auth/components/PasswordInput.tsx, apps/frontend/src/features/auth/components/StepIndicator.tsx, apps/frontend/src/features/auth/hooks/useAuth.ts, apps/frontend/src/features/auth/hooks/useResendCooldown.ts, apps/frontend/src/features/auth/types.ts</files>
  <read_first>
    - .planning/phases/01-foundation/01-UI-SPEC.md (entire file — visual contract)
    - apps/frontend/src/components/ui/* (shadcn primitives to compose)
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json (the strings to render)
    - apps/frontend/src/infrastructure/stores/auth.store.ts (setSession signature)
    - apps/backend/src/graphql/schema/auth.graphql (mutations + payload shape)
    - apps/backend/src/graphql/schema/identity.graphql (acceptInvitation signature)
  </read_first>
  <behavior>
    AuthShell:
    - Test: Renders children inside `<main className="min-h-screen flex items-center justify-center bg-background p-md">` (visible via DOM query)

    AuthCard:
    - Test: Renders Card with `max-w-[400px]`, `bg-neutral-0`, `border`, `border-neutral-200`, `rounded-lg`, `p-xl`, `shadow-card`

    PasswordInput:
    - Test: Default type="password"; clicking the trailing eye icon switches to type="text"
    - Test: aria-label switches between "Mostrar senha" and "Ocultar senha"

    StepIndicator:
    - Test: With currentStep=1, totalSteps=2 → renders 2 dots; first has bg-primary-500, second has bg-neutral-200
    - Test: With currentStep=2 → both dots have bg-primary-500

    useResendCooldown(initialSeconds):
    - Test: starts at initialSeconds, decrements every second to 0, returns {remainingSeconds, isActive, start(seconds)}
  </behavior>
  <action>
    **Create `apps/frontend/src/features/auth/types.ts`** — shared types (mirrors backend AuthPayload but defined locally; codegen replaces these in plan 07 followup):
    ```typescript
    export type AuthErrorCode =
      | 'INVALID_CREDENTIALS' | 'ACCOUNT_UNVERIFIED' | 'EMAIL_TAKEN'
      | 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'TOKEN_ALREADY_USED' | 'TOKEN_REUSE_DETECTED'
      | 'INVITATION_EXPIRED' | 'INVITATION_USED'
      | 'PASSWORD_TOO_SHORT' | 'NAME_TOO_SHORT' | 'FORBIDDEN' | 'UNKNOWN';

    export interface UserError { code: AuthErrorCode; message: string; field?: string | null; }

    export interface Membership {
      memberId: string;
      organizationId: string;
      organizationName: string;
      roleName: 'ADMIN' | 'MANAGER' | 'ATTENDANT' | 'PROFESSIONAL';
    }

    export interface AuthSession {
      userId: string;
      email: string;
      fullName: string;
      memberships: Membership[];
    }

    export interface AuthPayload {
      accessToken: string | null;
      refreshToken: string | null;
      session: AuthSession | null;
      errors: UserError[];
    }
    ```

    **Create `apps/frontend/src/features/auth/api/queries.graphql`:**
    ```graphql
    query Me {
      me {
        userId
        email
        fullName
        memberships { memberId organizationId organizationName roleName }
      }
    }
    ```

    **Create `apps/frontend/src/features/auth/api/mutations.graphql`:**
    ```graphql
    mutation Signup($input: SignupInput!) {
      signup(input: $input) {
        accessToken refreshToken
        session { userId email fullName memberships { memberId organizationId organizationName roleName } }
        errors { code message field }
      }
    }

    mutation Login($input: LoginInput!) {
      login(input: $input) {
        accessToken refreshToken
        session { userId email fullName memberships { memberId organizationId organizationName roleName } }
        errors { code message field }
      }
    }

    mutation VerifyEmail($input: VerifyEmailInput!) {
      verifyEmail(input: $input) { success errors { code message } }
    }

    mutation ResendVerification($input: ResendVerificationInput!) {
      resendVerification(input: $input) { success cooldownSeconds errors { code message } }
    }

    mutation RefreshSession($input: RefreshInput!) {
      refreshSession(input: $input) {
        accessToken refreshToken
        session { userId email fullName memberships { memberId organizationId organizationName roleName } }
        errors { code message }
      }
    }

    mutation Logout($input: RefreshInput!) {
      logout(input: $input) { success }
    }

    mutation AcceptInvitation($input: AcceptInvitationInput!) {
      acceptInvitation(input: $input) {
        accessToken refreshToken
        session { userId email fullName memberships { memberId organizationId organizationName roleName } }
        errors { code message }
      }
    }
    ```

    **Create `apps/frontend/src/features/auth/api/auth.api.ts`** — typed Apollo wrappers (manual gql until codegen runs):
    ```typescript
    import { gql, useMutation, useQuery } from '@apollo/client';
    import type { AuthPayload, AuthSession } from '../types';

    const SIGNUP = gql`
      mutation Signup($input: SignupInput!) {
        signup(input: $input) {
          accessToken refreshToken
          session { userId email fullName memberships { memberId organizationId organizationName roleName } }
          errors { code message field }
        }
      }`;
    const LOGIN = gql`
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          accessToken refreshToken
          session { userId email fullName memberships { memberId organizationId organizationName roleName } }
          errors { code message field }
        }
      }`;
    const VERIFY = gql`
      mutation VerifyEmail($input: VerifyEmailInput!) {
        verifyEmail(input: $input) { success errors { code message } }
      }`;
    const RESEND = gql`
      mutation ResendVerification($input: ResendVerificationInput!) {
        resendVerification(input: $input) { success cooldownSeconds errors { code message } }
      }`;
    const REFRESH = gql`
      mutation RefreshSession($input: RefreshInput!) {
        refreshSession(input: $input) {
          accessToken refreshToken
          session { userId email fullName memberships { memberId organizationId organizationName roleName } }
          errors { code message }
        }
      }`;
    const LOGOUT = gql`
      mutation Logout($input: RefreshInput!) { logout(input: $input) { success } }`;
    const ACCEPT = gql`
      mutation AcceptInvitation($input: AcceptInvitationInput!) {
        acceptInvitation(input: $input) {
          accessToken refreshToken
          session { userId email fullName memberships { memberId organizationId organizationName roleName } }
          errors { code message }
        }
      }`;
    const ME = gql`
      query Me { me { userId email fullName memberships { memberId organizationId organizationName roleName } } }`;

    export const useSignupMutation = () => useMutation<{ signup: AuthPayload }>(SIGNUP);
    export const useLoginMutation = () => useMutation<{ login: AuthPayload }>(LOGIN);
    export const useVerifyEmailMutation = () => useMutation<{ verifyEmail: { success: boolean; errors: { code: string; message: string }[] } }>(VERIFY);
    export const useResendVerificationMutation = () => useMutation<{ resendVerification: { success: boolean; cooldownSeconds: number | null; errors: { code: string; message: string }[] } }>(RESEND);
    export const useRefreshMutation = () => useMutation<{ refreshSession: AuthPayload }>(REFRESH);
    export const useLogoutMutation = () => useMutation<{ logout: { success: boolean } }>(LOGOUT);
    export const useAcceptInvitationMutation = () => useMutation<{ acceptInvitation: AuthPayload }>(ACCEPT);
    export const useMeQuery = () => useQuery<{ me: AuthSession | null }>(ME);
    ```

    **Create `apps/frontend/src/features/auth/components/AuthShell.tsx`:**
    ```typescript
    import { ReactNode } from 'react';

    export function AuthShell({ children }: { children: ReactNode }) {
      return (
        <main className="min-h-screen flex items-center justify-center bg-background p-md md:p-0">
          <div className="w-full max-w-[400px]">
            {children}
          </div>
        </main>
      );
    }
    ```

    **Create `apps/frontend/src/features/auth/components/Logo.tsx`** (text placeholder per UI-SPEC):
    ```typescript
    export function Logo() {
      return (
        <div className="text-center mb-lg">
          <span className="text-display text-primary-700 font-semibold">SGS</span>
        </div>
      );
    }
    ```

    **Create `apps/frontend/src/features/auth/components/AuthCard.tsx`** (uses shadcn Card under the hood):
    ```typescript
    import { ReactNode } from 'react';
    import { Card, CardContent } from '@/components/ui/card';
    import { Logo } from './Logo';

    interface AuthCardProps {
      heading: string;
      stepIndicator?: ReactNode;
      children: ReactNode;
    }

    export function AuthCard({ heading, stepIndicator, children }: AuthCardProps) {
      return (
        <>
          <Logo />
          <Card className="bg-neutral-0 border-neutral-200 rounded-lg shadow-card">
            <CardContent className="p-lg md:p-xl space-y-md">
              <h1 className="text-heading text-neutral-800">{heading}</h1>
              {stepIndicator}
              {children}
            </CardContent>
          </Card>
        </>
      );
    }
    ```

    **Create `apps/frontend/src/features/auth/components/StepIndicator.tsx`** (UI-SPEC §"Signup Step Indicator"):
    ```typescript
    export function StepIndicator({ current, total }: { current: number; total: number }) {
      return (
        <div className="flex items-center gap-sm" role="status" aria-label={`Passo ${current} de ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`h-[8px] w-[8px] rounded-full ${i < current ? 'bg-primary-500' : 'bg-neutral-200'}`}
              aria-hidden="true"
            />
          ))}
          <span className="ml-xs text-label text-neutral-500">Passo {current} de {total}</span>
        </div>
      );
    }
    ```

    **Create `apps/frontend/src/features/auth/components/PasswordInput.tsx`:**
    ```typescript
    import { forwardRef, useState } from 'react';
    import { Eye, EyeOff } from 'lucide-react';
    import { Input } from '@/components/ui/input';

    type Props = React.InputHTMLAttributes<HTMLInputElement>;

    export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(props, ref) {
      const [visible, setVisible] = useState(false);
      return (
        <div className="relative">
          <Input ref={ref} type={visible ? 'text' : 'password'} {...props} className={`pr-10 ${props.className ?? ''}`} />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            tabIndex={0}
          >
            {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
      );
    });
    ```

    **Create `apps/frontend/src/features/auth/hooks/useResendCooldown.ts`:**
    ```typescript
    import { useEffect, useRef, useState } from 'react';

    export function useResendCooldown() {
      const [remaining, setRemaining] = useState(0);
      const intervalRef = useRef<number | null>(null);

      useEffect(() => () => { if (intervalRef.current) window.clearInterval(intervalRef.current); }, []);

      function start(seconds: number) {
        setRemaining(seconds);
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        intervalRef.current = window.setInterval(() => {
          setRemaining((r) => {
            if (r <= 1) { if (intervalRef.current) window.clearInterval(intervalRef.current); return 0; }
            return r - 1;
          });
        }, 1000);
      }

      return { remainingSeconds: remaining, isActive: remaining > 0, start };
    }
    ```

    **Create `apps/frontend/src/features/auth/hooks/useAuth.ts`** — convenience hook composing the auth store + mutations:
    ```typescript
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

      const applyAuthPayload = useCallback((payload: AuthPayload) => {
        if (!payload.accessToken || !payload.refreshToken || !payload.session) return false;
        const m = payload.session.memberships[0];
        setSession({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          userId: payload.session.userId,
          memberId: m?.memberId ?? null,
          organizationId: m?.organizationId ?? null,
          roleName: m?.roleName ?? null,
          permissions: [],  // populated by /me query later or derived from memberships
        });
        return true;
      }, [setSession]);

      const logout = useCallback(async () => {
        if (refreshToken) {
          await logoutMutation({ variables: { input: { refreshToken } } }).catch(() => {});
        }
        clearSession();
        navigate('/login', { replace: true });
      }, [refreshToken, logoutMutation, clearSession, navigate]);

      return { applyAuthPayload, logout };
    }
    ```
  </action>
  <verify>
    <automated>cd d:/SGS/apps/frontend && pnpm typecheck && pnpm test --run --reporter=basic 2>&1 || true</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/frontend/src/features/auth/components/AuthShell.tsx` contains `min-h-screen flex items-center justify-center bg-background`
    - File `apps/frontend/src/features/auth/components/AuthCard.tsx` uses `text-heading text-neutral-800` for the heading
    - File `apps/frontend/src/features/auth/components/StepIndicator.tsx` renders dots with `bg-primary-500` (active) and `bg-neutral-200` (inactive)
    - File `apps/frontend/src/features/auth/components/PasswordInput.tsx` toggles between `type="password"` and `type="text"` AND uses `aria-label="Mostrar senha"` / `"Ocultar senha"`
    - File `apps/frontend/src/features/auth/components/PasswordInput.tsx` imports `Eye` AND `EyeOff` from `lucide-react`
    - File `apps/frontend/src/features/auth/api/auth.api.ts` exports all 7 hooks: useSignupMutation, useLoginMutation, useVerifyEmailMutation, useResendVerificationMutation, useRefreshMutation, useLogoutMutation, useAcceptInvitationMutation, useMeQuery
    - File `apps/frontend/src/features/auth/hooks/useAuth.ts` exposes `applyAuthPayload` AND `logout`
    - Command `pnpm --filter @sgs/frontend typecheck` exits 0
  </acceptance_criteria>
  <done>
    All shared auth components and the API client are in place. Pages in task 2 can compose them.
  </done>
</task>

<task type="auto">
  <name>Task 2: Build Login, Signup (2-step), VerifyEmailPending, VerifyEmailSuccess, Invitation, NotFound pages and wire router</name>
  <files>apps/frontend/src/features/auth/pages/LoginPage.tsx, apps/frontend/src/features/auth/pages/SignupPage.tsx, apps/frontend/src/features/auth/pages/SignupStep1.tsx, apps/frontend/src/features/auth/pages/SignupStep2.tsx, apps/frontend/src/features/auth/pages/VerifyEmailPendingPage.tsx, apps/frontend/src/features/auth/pages/VerifyEmailSuccessPage.tsx, apps/frontend/src/features/auth/pages/InvitationPage.tsx, apps/frontend/src/features/auth/pages/NotFoundPage.tsx, apps/frontend/src/components/ProtectedRoute.tsx, apps/frontend/src/pages/DashboardPlaceholder.tsx, apps/frontend/src/router.tsx</files>
  <read_first>
    - .planning/phases/01-foundation/01-UI-SPEC.md (every screen's copy + interaction contract)
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json (i18n keys to use)
    - apps/frontend/src/features/auth/api/auth.api.ts (mutation hooks)
    - apps/frontend/src/features/auth/components/* (created in task 1)
    - apps/frontend/src/features/auth/hooks/useAuth.ts (applyAuthPayload, logout)
    - apps/frontend/src/router.tsx (current placeholder router to replace)
    - apps/frontend/src/infrastructure/stores/auth.store.ts (selectIsAuthenticated)
  </read_first>
  <action>
    **All pages follow these patterns:**
    - Wrap content in `<AuthShell>` then `<AuthCard heading={t('...cardHeading')}>`
    - Use react-hook-form + zodResolver for validation
    - Validate on blur (`mode: 'onBlur'`)
    - Submit button disabled while form invalid OR while `loading`
    - Loading state: button shows i18n loading copy + Loader2 spinner
    - Error display:
        - Field errors: `<FormMessage>` from shadcn Form (text-error-500 below field)
        - Auth errors (server): `<Alert variant="destructive">` ABOVE submit button
    - Auto-focus first field on mount
    - All copy via `useTranslation()` + i18n keys

    ---

    **`LoginPage.tsx`** (UI-SPEC §"Login"):
    ```typescript
    import { useEffect, useRef, useState } from 'react';
    import { useNavigate, Link } from 'react-router-dom';
    import { useTranslation } from 'react-i18next';
    import { useForm } from 'react-hook-form';
    import { zodResolver } from '@hookform/resolvers/zod';
    import { z } from 'zod';
    import { Loader2 } from 'lucide-react';
    import { AuthShell } from '../components/AuthShell';
    import { AuthCard } from '../components/AuthCard';
    import { PasswordInput } from '../components/PasswordInput';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Alert, AlertDescription } from '@/components/ui/alert';
    import { useLoginMutation } from '../api/auth.api';
    import { useAuth } from '../hooks/useAuth';

    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });
    type FormValues = z.infer<typeof schema>;

    export function LoginPage() {
      const { t } = useTranslation();
      const navigate = useNavigate();
      const emailRef = useRef<HTMLInputElement>(null);
      const [authError, setAuthError] = useState<{ code: string; message: string } | null>(null);
      const [login, { loading }] = useLoginMutation();
      const { applyAuthPayload } = useAuth();

      const { register, handleSubmit, formState: { errors, isValid } } = useForm<FormValues>({
        resolver: zodResolver(schema), mode: 'onBlur',
      });

      useEffect(() => { document.title = t('login.pageTitle'); emailRef.current?.focus(); }, [t]);

      async function onSubmit(values: FormValues) {
        setAuthError(null);
        const res = await login({ variables: { input: values } });
        const payload = res.data?.login;
        if (!payload) { setAuthError({ code: 'UNKNOWN', message: t('login.errors.serverGeneric') }); return; }
        if (payload.errors.length > 0) {
          const e = payload.errors[0];
          if (e.code === 'INVALID_CREDENTIALS') setAuthError({ code: e.code, message: t('login.errors.wrongCredentials') });
          else if (e.code === 'ACCOUNT_UNVERIFIED') setAuthError({ code: e.code, message: t('login.errors.unverified') });
          else setAuthError({ code: e.code, message: t('login.errors.serverGeneric') });
          return;
        }
        const ok = applyAuthPayload(payload);
        if (ok) navigate('/dashboard', { replace: true });
      }

      return (
        <AuthShell>
          <AuthCard heading={t('login.cardHeading')}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-md" noValidate>
              {authError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {authError.message}
                    {authError.code === 'ACCOUNT_UNVERIFIED' && (
                      <> <Link to="/verificar-email" className="text-primary-500 underline">{t('login.errors.resendVerification')}</Link></>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-xs">
                <Label htmlFor="email">{t('login.emailLabel')}</Label>
                <Input id="email" type="email" autoComplete="email" placeholder={t('login.emailPlaceholder')}
                       aria-invalid={!!errors.email} {...register('email')} ref={(el) => { register('email').ref(el); emailRef.current = el; }} />
                {errors.email && <p className="text-label text-error-500">{t('signup.step1.errors.emailFormat')}</p>}
              </div>

              <div className="space-y-xs">
                <Label htmlFor="password">{t('login.passwordLabel')}</Label>
                <PasswordInput id="password" autoComplete="current-password" placeholder={t('login.passwordPlaceholder')}
                               aria-invalid={!!errors.password} {...register('password')} />
              </div>

              <Button type="submit" className="w-full" disabled={!isValid || loading}>
                {loading ? <><Loader2 size={16} className="mr-xs animate-spin" />{t('login.loadingCta')}</> : t('login.primaryCta')}
              </Button>

              <div className="flex flex-col items-center gap-xs">
                <Link to="/signup" className="text-label text-primary-500 hover:text-primary-700">{t('login.linkToSignup')}</Link>
                <Link to="/recuperar-senha" className="text-label text-primary-500 hover:text-primary-700">{t('login.forgotPassword')}</Link>
              </div>
            </form>
          </AuthCard>
        </AuthShell>
      );
    }
    ```

    NOTE: `/recuperar-senha` is a placeholder link — password recovery is in CONTEXT.md `<deferred>` as "Claude decides include or not". For Phase 1 we keep the link visible but route it to /404 or a 'coming soon' placeholder. Reasonable choice: render a `Link` that navigates to `/recuperar-senha`, then add a route mapping that to `NotFoundPage` with a custom message. Keep a TODO comment.

    ---

    **`SignupPage.tsx`** (orchestrates step 1 → step 2 with state lifted up):
    ```typescript
    import { useState } from 'react';
    import { SignupStep1 } from './SignupStep1';
    import { SignupStep2 } from './SignupStep2';

    export interface SignupDraft {
      fullName: string;
      email: string;
      password: string;
      salonName: string;
    }

    export function SignupPage() {
      const [step, setStep] = useState<1 | 2>(1);
      const [draft, setDraft] = useState<SignupDraft>({ fullName: '', email: '', password: '', salonName: '' });

      if (step === 1) {
        return <SignupStep1 draft={draft} onNext={(d) => { setDraft(d); setStep(2); }} />;
      }
      return <SignupStep2 draft={draft} onBack={() => setStep(1)} onUpdate={(d) => setDraft(d)} />;
    }
    ```

    **`SignupStep1.tsx`** (UI-SPEC §"Signup — Step 1"):
    Full implementation with react-hook-form, zod schema validating fullName ≥2, valid email, password ≥8, validates on blur, shows step indicator "Passo 1 de 2", primary CTA "Continuar". On submit: copies values into draft, calls onNext. Email-already-registered detection happens server-side in step 2 (acceptable simplification for Phase 1; alternatively call a checkEmailAvailability query — defer that to a refinement).

    **`SignupStep2.tsx`** (UI-SPEC §"Signup — Step 2"):
    Same shell with heading "Qual é o nome do seu salão?", step indicator "Passo 2 de 2", input for salonName (≥2 chars), back link to step 1, submit calls signup mutation with full draft. On success: navigate to `/verificar-email` passing the email via state. Show server errors via Alert. Loading state "Criando conta…" with Loader2.

    **`VerifyEmailPendingPage.tsx`** (UI-SPEC §"Email verification pending"):
    Reads email from `useLocation().state?.email` or falls back to a default. Shows the body copy with email interpolation. Has a "Reenviar e-mail" button that calls `useResendVerificationMutation`; on success uses `useResendCooldown` to disable for 60s; shows toast (sonner) "E-mail reenviado. Verifique sua caixa de entrada."; if cooldownSeconds returned in errors, show "Aguarde Xs". Has a "Voltar ao cadastro" link.

    **`VerifyEmailSuccessPage.tsx`** (UI-SPEC §"Email verified success"):
    On mount: read `?token` from query string, call `useVerifyEmailMutation`. Show 3 states:
    - Loading: spinner + "Verificando…"
    - Success: card with "E-mail verificado com sucesso!" + "Sua conta está ativa." + button "Entrar agora" → navigates to /login
    - Error: Alert with the error code mapped to a friendly message ("Token inválido", "Token expirado", "Token já utilizado")

    **`InvitationPage.tsx`** (UI-SPEC §"Member invitation acceptance"):
    Read `:token` from `useParams()`. On mount: validate token format (non-empty); does NOT call any pre-validation query (would need new backend endpoint — accept on submit covers all error cases). Render form: fullName + password (PasswordInput). Submit calls `useAcceptInvitationMutation`. Three error states with dedicated rendering when `errors[0].code` is:
    - `INVITATION_EXPIRED` → no form, just error card with heading "Este convite expirou" + body
    - `INVITATION_USED` → no form, error card "Este convite já foi utilizado..."
    - else → toast error + keep form
    On success: applyAuthPayload + navigate to /dashboard. The salon name and inviter name come from server-side response (currently the AcceptInvitation mutation does not return them — show a generic heading "Aceitar convite" or extend the schema to include orgName + inviterName in errors. For Phase 1 simplicity: show generic heading; followup improvement noted in SUMMARY).

    **`NotFoundPage.tsx`** (UI-SPEC §"Error / 404"):
    Sets document title, renders AuthShell + AuthCard with heading "Página não encontrada" + body + button "Voltar ao início" → navigates to "/".

    **`ProtectedRoute.tsx`** in `apps/frontend/src/components/`:
    ```typescript
    import { Navigate, useLocation } from 'react-router-dom';
    import { useAuthStore, selectIsAuthenticated } from '@/infrastructure/stores/auth.store';

    export function ProtectedRoute({ children }: { children: React.ReactNode }) {
      const isAuth = useAuthStore(selectIsAuthenticated);
      const location = useLocation();
      if (!isAuth) return <Navigate to="/login" state={{ from: location }} replace />;
      return <>{children}</>;
    }
    ```

    **`DashboardPlaceholder.tsx`** in `apps/frontend/src/pages/`:
    ```typescript
    import { useTranslation } from 'react-i18next';
    import { useAuthStore } from '@/infrastructure/stores/auth.store';
    import { Button } from '@/components/ui/button';
    import { useAuth } from '@/features/auth/hooks/useAuth';

    export function DashboardPlaceholder() {
      const { t } = useTranslation();
      const userId = useAuthStore((s) => s.userId);
      const orgId = useAuthStore((s) => s.organizationId);
      const role = useAuthStore((s) => s.roleName);
      const { logout } = useAuth();
      return (
        <main className="min-h-screen p-xl bg-background">
          <header className="flex items-center justify-between mb-xl">
            <h1 className="text-display text-neutral-800">SGS Dashboard</h1>
            <Button variant="outline" onClick={logout}>Sair</Button>
          </header>
          <section className="bg-neutral-0 border border-neutral-200 rounded-lg p-lg shadow-card">
            <h2 className="text-heading text-neutral-800 mb-md">Sessão ativa (Phase 1 placeholder)</h2>
            <dl className="text-body text-neutral-800 space-y-xs">
              <div><dt className="text-label inline">User: </dt><dd className="inline">{userId}</dd></div>
              <div><dt className="text-label inline">Org: </dt><dd className="inline">{orgId}</dd></div>
              <div><dt className="text-label inline">Role: </dt><dd className="inline">{role}</dd></div>
            </dl>
          </section>
        </main>
      );
    }
    ```

    **Update `apps/frontend/src/router.tsx`** to wire the real pages and add /dashboard:
    ```typescript
    import { createBrowserRouter, Navigate } from 'react-router-dom';
    import { LoginPage } from '@/features/auth/pages/LoginPage';
    import { SignupPage } from '@/features/auth/pages/SignupPage';
    import { VerifyEmailPendingPage } from '@/features/auth/pages/VerifyEmailPendingPage';
    import { VerifyEmailSuccessPage } from '@/features/auth/pages/VerifyEmailSuccessPage';
    import { InvitationPage } from '@/features/auth/pages/InvitationPage';
    import { NotFoundPage } from '@/features/auth/pages/NotFoundPage';
    import { ProtectedRoute } from '@/components/ProtectedRoute';
    import { DashboardPlaceholder } from '@/pages/DashboardPlaceholder';

    export const router = createBrowserRouter([
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '/verificar-email', element: <VerifyEmailPendingPage /> },
      { path: '/verificar-email/sucesso', element: <VerifyEmailSuccessPage /> },
      { path: '/convite/:token', element: <InvitationPage /> },
      { path: '/recuperar-senha', element: <NotFoundPage /> },  // password recovery deferred
      { path: '/dashboard', element: <ProtectedRoute><DashboardPlaceholder /></ProtectedRoute> },
      { path: '*', element: <NotFoundPage /> },
    ]);
    ```
  </action>
  <verify>
    <automated>cd d:/SGS/apps/frontend && pnpm typecheck && pnpm build</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/frontend/src/features/auth/pages/LoginPage.tsx` calls `useLoginMutation` AND `applyAuthPayload`
    - File `apps/frontend/src/features/auth/pages/LoginPage.tsx` references both `t('login.cardHeading')` AND `t('login.primaryCta')`
    - File `apps/frontend/src/features/auth/pages/SignupPage.tsx` orchestrates 2 steps (renders SignupStep1 OR SignupStep2 based on state)
    - File `apps/frontend/src/features/auth/pages/SignupStep2.tsx` calls `useSignupMutation` and navigates to `/verificar-email` on success
    - File `apps/frontend/src/features/auth/pages/VerifyEmailSuccessPage.tsx` calls `useVerifyEmailMutation` AND reads `?token` from URL search params
    - File `apps/frontend/src/features/auth/pages/InvitationPage.tsx` reads `:token` from `useParams` AND calls `useAcceptInvitationMutation`
    - File `apps/frontend/src/features/auth/pages/InvitationPage.tsx` handles error codes `INVITATION_EXPIRED` AND `INVITATION_USED` with dedicated UI (no form shown)
    - File `apps/frontend/src/router.tsx` imports all 6 page components AND wires them to the correct paths
    - File `apps/frontend/src/router.tsx` wraps `/dashboard` in `<ProtectedRoute>`
    - File `apps/frontend/src/components/ProtectedRoute.tsx` redirects to `/login` when `selectIsAuthenticated` is false
    - Command `pnpm --filter @sgs/frontend typecheck` exits 0
    - Command `pnpm --filter @sgs/frontend build` exits 0 and dist/index.html exists
  </acceptance_criteria>
  <done>
    All 6 auth pages built per UI-SPEC. Router updated. ProtectedRoute guards /dashboard. Frontend typechecks and builds cleanly.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Manually verify the auth flow end-to-end in the browser</name>
  <what-built>
    Complete frontend auth flow rendered on http://localhost:5173:
    - /login — Login form with email/password, submits to backend, stores tokens, redirects to /dashboard
    - /signup — 2-step signup (personal info → salon name) creating org + user + ADMIN member
    - /verificar-email — Pending verification page with resend cooldown
    - /verificar-email/sucesso?token=... — Token consumption page → "Entrar agora"
    - /convite/{token} — Invitation acceptance with expired/used error states
    - /404 — NotFound page
    - /dashboard — Protected placeholder showing userId / orgId / role and Logout button

    All copy in pt-BR matching UI-SPEC verbatim. Design tokens applied (Inter font, primary #5D54C7, neutral palette, Card 12px rounded with shadow).
  </what-built>
  <how-to-verify>
    Prereqs:
    - `docker compose up -d` (all services from plans 01-05 running)
    - Backend migrations applied (plan 02 + plan 05)
    - .env has JWT secrets ≥32 chars
    - Optional: set RESEND_API_KEY for real email; otherwise check `docker compose logs backend` for the verification token printed by the email-fallback logger

    Steps:
    1. Open http://localhost:5173 — should redirect to /login (unauthenticated)
    2. Click "Não tem conta? Criar conta" → should land on /signup step 1
    3. Fill: nome="Maria Silva", email="maria@test.com", senha="senha12345" → click "Continuar"
    4. Fill: salonName="Studio Maria" → click "Criar conta" → should redirect to /verificar-email showing "Enviamos um link para maria@test.com"
    5. Run `docker compose logs backend | grep "email-fallback"` — copy the verification URL printed
    6. Open that URL in the browser — should land on /verificar-email/sucesso, show success card, click "Entrar agora"
    7. On /login enter maria@test.com + senha12345 → click "Entrar" → should redirect to /dashboard showing the userId/orgId/role
    8. Hard refresh the browser (Ctrl+F5) — should STAY on /dashboard (AUTH-02 verified: session persisted via localStorage)
    9. Click "Sair" → should clear session and redirect to /login; /dashboard now blocks (redirects to /login)

    Visual checks (UI-SPEC compliance):
    10. Confirm font is Inter (not Times/system default)
    11. Confirm submit button background is #5D54C7 (purple)
    12. Confirm card has rounded corners (12px) and a subtle shadow
    13. Tab through form fields — visible focus ring on each in primary-500 color
    14. Click eye icon next to password → password becomes visible
    15. Submit empty form → button disabled (validation prevents submission)

    RBAC check (Phase 1 Success Criterion #3):
    16. As maria@test.com (ADMIN), use GraphQL Playground at http://localhost:3000/graphql to call `inviteMember(input: {email: "test@inv.com", roleName: "PROFESSIONAL"})` with Authorization header → should succeed
    17. (Optional) Accept the invitation at /convite/{token printed in backend logs} → become PROFESSIONAL
    18. Log in as the PROFESSIONAL → /dashboard works
    19. Try the same `inviteMember` mutation as the PROFESSIONAL → should return FORBIDDEN

    Tenant isolation check (Phase 1 Success Criterion #4 already automated in CI from plan 02 — manual spot-check):
    20. Create a SECOND organization via signup (different email) → confirm /dashboard shows ONLY that org's id; the first user's data is invisible
  </how-to-verify>
  <resume-signal>
    Type "approved" if all 20 checks pass. If anything fails, describe:
    - Which step failed (number)
    - Visual issue (color, spacing, font, layout)
    - Functional issue (error message, wrong navigation, broken mutation)
    - Console errors (browser devtools)
  </resume-signal>
</task>

</tasks>

<verification>
- All 6 auth pages render correctly with UI-SPEC copy and tokens
- Login + signup + verify + invitation + logout flows all complete end-to-end
- AUTH-02 verified visually: session survives browser refresh
- AUTH-03 verified visually: PROFESSIONAL gets FORBIDDEN on inviteMember
- ProtectedRoute redirects unauthenticated users
</verification>

<success_criteria>
- AUTH-01 fully satisfied (signup + email verification + login working in UI)
- AUTH-02 fully satisfied (session persisted via localStorage; refresh-token rotation in error-link of plan 03 already wired but not exercised in Phase 1 — refresh on access-token expiry is plan 07 enhancement or v2)
- AUTH-03 visually confirmed
- Phase 1 Success Criterion #2 satisfied: user creates org, logs in, session persists across browser refresh
- Phase 1 Success Criterion #3 satisfied: PROFESSIONAL → FORBIDDEN on admin route
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-06-SUMMARY.md` documenting:
- Pages built and the URL each maps to
- Any UI-SPEC strings that needed minor adaptation (e.g., signup-step-2 server error mapping to a generic message)
- The deferred items: password recovery (links to /404), pre-flight email-availability check (deferred), invitation pre-validation query (deferred)
- Visual checkpoint outcome — which UI-SPEC dimension(s) were noted as needing minor follow-up if any
- The exact Apollo error-link handling note: refresh-token auto-rotation on 401 is not yet implemented in Phase 1 (deferred); for now any UNAUTHENTICATED clears session → forces re-login. Sufficient for AUTH-02 success criterion (browser refresh works as long as access token is still valid; 15-min window is fine for development; production needs rotation in plan 07 followup or v2 hardening)
</output>
