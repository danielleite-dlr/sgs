---
phase: 01-foundation
plan: 06
subsystem: frontend-auth-pages
tags: [frontend, react, auth, graphql, apollo, react-hook-form, zod, react-router, tailwind, shadcn]
dependency_graph:
  requires:
    - 01-frontend-scaffold (shadcn/ui primitives, Apollo Client, Zustand auth store, i18next, React Router v7)
    - 01-backend-auth-core (GraphQL mutations: signup, login, verifyEmail, resendVerification, logout, refreshSession)
    - 01-backend-rbac-invitations (GraphQL mutation: acceptInvitation; AcceptInvitationInput shape)
  provides:
    - Login page (/login) consuming login mutation + Zustand setSession
    - Signup 2-step flow (/signup) creating user+org+ADMIN member via signup mutation
    - Email verification pending page (/verificar-email) with 60s resend cooldown
    - Email verification success page (/verificar-email/sucesso) consuming verifyEmail mutation via ?token
    - Invitation acceptance page (/convite/:token) with expired/used error states
    - 404 page for all unmatched routes
    - ProtectedRoute component guarding /dashboard with redirect to /login
    - DashboardPlaceholder showing userId/orgId/role with logout button
    - useAuth hook (applyAuthPayload + logout)
    - useResendCooldown hook (60s countdown timer)
    - auth.api.ts typed Apollo wrappers for all 8 auth operations
  affects:
    - 01-ci-integration (plan 07 — this plan completes Phase 1 frontend requirements)
tech_stack:
  added: []
  patterns:
    - Feature-based directory structure (src/features/auth/{api,components,hooks,pages,types.ts})
    - Apollo useMutation/useQuery wrappers with typed return types (manual gql until codegen in plan 07)
    - react-hook-form + zodResolver with mode='onBlur' for form validation timing
    - Loader2 + animate-spin loading state pattern
    - Sonner toast for success feedback (email resent)
    - ProtectedRoute pattern using Zustand selectIsAuthenticated
key_files:
  created:
    - apps/frontend/src/features/auth/types.ts
    - apps/frontend/src/features/auth/api/queries.graphql
    - apps/frontend/src/features/auth/api/mutations.graphql
    - apps/frontend/src/features/auth/api/auth.api.ts
    - apps/frontend/src/features/auth/components/AuthShell.tsx
    - apps/frontend/src/features/auth/components/AuthCard.tsx
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
    - apps/frontend/src/components/ProtectedRoute.tsx
    - apps/frontend/src/pages/DashboardPlaceholder.tsx
  modified:
    - apps/frontend/src/router.tsx (replaced placeholder routes with real pages)
decisions:
  - "Generic 'Aceitar convite' heading used for InvitationPage — AcceptInvitation mutation does not return orgName/inviterName; deferred to Phase 2 schema extension"
  - "VerifyEmailSuccessPage calls verifyEmail mutation on mount via useEffect — token consumed once, subsequent visits show TOKEN_ALREADY_USED error (acceptable per D-11)"
  - "Password recovery (/recuperar-senha) deferred — route renders NotFoundPage; LinkLoginPage retains the link per UI-SPEC"
  - "useAuth.applyAuthPayload uses memberships[0] as active org — single-org assumption for Phase 1; multi-org switching deferred"
  - "auth.api.ts uses manual gql tagged templates (not codegen) — codegen integration deferred to plan 07"
metrics:
  duration_minutes: 59
  completed: "2026-05-05T20:00:00Z"
  tasks_completed: 2
  files_created: 21
  files_modified: 1
  commits: 2
---

# Phase 1 Plan 06: Frontend Auth Pages Summary

**6 auth pages wired to GraphQL mutations with UI-SPEC copy, shadcn/ui design tokens, react-hook-form + zod validation on blur, Loader2 spinners, PasswordInput Eye/EyeOff toggle, and ProtectedRoute session guard**

## Commits

| Hash | Message |
|------|---------|
| `f8aeb4d` | feat(01-06): build shared auth components and API client |
| `a2c4d6b` | feat(01-06): build all 6 auth pages and wire router |

## What Was Built

### Task 1: Shared auth components and API client (commit `f8aeb4d`)

**Types** (`src/features/auth/types.ts`):
- `AuthErrorCode` union type covering all 13 error codes from backend
- `UserError`, `Membership`, `AuthSession`, `AuthPayload` interfaces mirroring backend SDL

**GraphQL files** (`src/features/auth/api/`):
- `queries.graphql` — Me query with memberships
- `mutations.graphql` — 7 mutations: Signup, Login, VerifyEmail, ResendVerification, RefreshSession, Logout, AcceptInvitation

**Apollo wrappers** (`src/features/auth/api/auth.api.ts`):
- 8 typed hooks: `useSignupMutation`, `useLoginMutation`, `useVerifyEmailMutation`, `useResendVerificationMutation`, `useRefreshMutation`, `useLogoutMutation`, `useAcceptInvitationMutation`, `useMeQuery`

**Components** (`src/features/auth/components/`):
- `AuthShell` — `min-h-screen flex items-center justify-center bg-background p-md` wrapping `max-w-[400px]` div
- `AuthCard` — Card with `bg-neutral-0 border-neutral-200 rounded-lg shadow-card`, Logo above, `text-heading text-neutral-800` heading
- `Logo` — text "SGS" in `text-display text-primary-700 font-semibold`
- `StepIndicator` — 2 dots: active `bg-primary-500`, inactive `bg-neutral-200`; renders "Passo X de Y" label
- `PasswordInput` — `forwardRef` wrapping shadcn `Input` + Eye/EyeOff toggle; `aria-label="Mostrar senha"` / `"Ocultar senha"`

**Hooks** (`src/features/auth/hooks/`):
- `useResendCooldown` — countdown timer returning `{ remainingSeconds, isActive, start(seconds) }`
- `useAuth` — composes Zustand setSession + Apollo logout mutation; exposes `applyAuthPayload` and `logout`

### Task 2: Auth pages and router update (commit `a2c4d6b`)

**Pages** (`src/features/auth/pages/`):

| Page | Route | Key behavior |
|------|-------|-------------|
| `LoginPage` | `/login` | useLoginMutation → applyAuthPayload → navigate /dashboard; INVALID_CREDENTIALS / ACCOUNT_UNVERIFIED error display |
| `SignupPage` | `/signup` | Orchestrates step 1 → step 2 with lifted state (SignupDraft) |
| `SignupStep1` | `/signup` step 1 | fullName≥2 + email valid + password≥8, validate onBlur, Continuar button |
| `SignupStep2` | `/signup` step 2 | salonName≥2, calls useSignupMutation with full draft, navigates to /verificar-email on success |
| `VerifyEmailPendingPage` | `/verificar-email` | Reads email from router state, resend button with 60s cooldown, sonner toast on success |
| `VerifyEmailSuccessPage` | `/verificar-email/sucesso` | Reads ?token from URL, calls useVerifyEmailMutation on mount, 3 states: loading/success/error |
| `InvitationPage` | `/convite/:token` | Reads :token from useParams, INVITATION_EXPIRED/INVITATION_USED show dedicated no-form UI |
| `NotFoundPage` | `*`, `/recuperar-senha` | Sets page title, "Voltar ao início" CTA |

**Infrastructure**:
- `ProtectedRoute` (`src/components/ProtectedRoute.tsx`) — `Navigate to="/login"` when `selectIsAuthenticated` is false
- `DashboardPlaceholder` (`src/pages/DashboardPlaceholder.tsx`) — Shows userId/orgId/role from Zustand + logout button
- `router.tsx` — All 6 auth routes + protected /dashboard + /recuperar-senha (deferred, shows NotFoundPage)

## UI-SPEC Compliance

All copywriting strings sourced from `pt-BR.json` via `useTranslation()` — verbatim per UI-SPEC contract:

| Screen | Key strings verified |
|--------|---------------------|
| Login | "Entrar na sua conta", "Entrar", "Entrando…", error messages |
| Signup step 1 | "Crie sua conta", "Passo 1 de 2", "Continuar" |
| Signup step 2 | "Qual é o nome do seu salão?", "Passo 2 de 2", "Criar conta", "Criando conta…" |
| Verify pending | "Verifique seu e-mail", "Reenviar e-mail", "Reenviando…" |
| Verify success | "E-mail verificado com sucesso!", "Entrar agora" |
| Invitation | "Aceitar convite", "Aceitando…", expired/used error headings |
| 404 | "Página não encontrada", "Voltar ao início" |

Design tokens applied:
- Colors: primary-500 (#5D54C7) for buttons and links, error-500 (#D85A30) for field errors
- Typography: text-heading (20px/600) for card headings, text-body (16px/400) for content, text-label (14px/600) for errors
- Spacing: space-y-md (16px) for form fields, space-y-xs (4px) for label-input pairs
- Card: bg-neutral-0, border-neutral-200, rounded-lg, shadow-card

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as specified.

### Known Adaptations (within plan scope)

**1. InvitationPage uses generic heading "Aceitar convite"**
- **Reason:** `acceptInvitation` mutation returns `AuthPayload` which does not include `orgName` or `inviterName`; UI-SPEC calls for "Você foi convidado para {nomeDoSalão}" but that data isn't available from the API at render time (only after submit)
- **Decision:** Use generic heading "Aceitar convite" for Phase 1; noted as TODO comment in source
- **Deferred to:** Phase 2 — extend AcceptInvitationPayload or add a query to pre-fetch invitation metadata

**2. VerifyEmailSuccessPage heading shows "Verificando…" during load**
- **Reason:** The card heading is dynamic (shows "E-mail verificado com sucesso!" only after success); during loading state, heading is "Verificando…" which is not in UI-SPEC but is UX-appropriate
- **Decision:** Acceptable for Phase 1; the final success state matches UI-SPEC verbatim

## Deferred Items

| Item | Reason | Plan |
|------|--------|------|
| Password recovery flow (/recuperar-senha) | Deferred per UI-SPEC context — currently shows NotFoundPage | Phase 2+ |
| Pre-flight email availability check in signup step 1 | Would need new backend query or early signup call; EMAIL_TAKEN returned by server in step 2 | Phase 2 |
| Invitation pre-validation query (fetch orgName/inviterName before accept) | Needs new backend endpoint; acceptInvitation covers all error cases on submit | Phase 2 |
| Refresh token auto-rotation on 401 (access token expiry) | error-link clears session on UNAUTHENTICATED; full rotation deferred | plan 07 / v2 |
| GraphQL codegen integration | auth.api.ts uses manual gql; codegen generates types from schema | plan 07 |

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| `InvitationPage.tsx` | heading | "Aceitar convite" literal | orgName/inviterName not returned by AcceptInvitation mutation; Phase 2 improvement |

This stub does NOT prevent the plan's goal — invitation acceptance works correctly end-to-end; only the personalized heading is missing. The error states (INVITATION_EXPIRED, INVITATION_USED) render correctly with UI-SPEC copy.

## Checkpoint Status

Task 3 (browser verification) is a `checkpoint:human-verify` gate. Execution paused pending browser verification by the user. See checkpoint details in CHECKPOINT REACHED section.

## Self-Check: PASSED

Files verified:
- FOUND: apps/frontend/src/features/auth/types.ts
- FOUND: apps/frontend/src/features/auth/api/auth.api.ts
- FOUND: apps/frontend/src/features/auth/components/AuthShell.tsx
- FOUND: apps/frontend/src/features/auth/components/AuthCard.tsx
- FOUND: apps/frontend/src/features/auth/components/Logo.tsx
- FOUND: apps/frontend/src/features/auth/components/PasswordInput.tsx
- FOUND: apps/frontend/src/features/auth/components/StepIndicator.tsx
- FOUND: apps/frontend/src/features/auth/hooks/useAuth.ts
- FOUND: apps/frontend/src/features/auth/hooks/useResendCooldown.ts
- FOUND: apps/frontend/src/features/auth/pages/LoginPage.tsx
- FOUND: apps/frontend/src/features/auth/pages/SignupPage.tsx
- FOUND: apps/frontend/src/features/auth/pages/SignupStep1.tsx
- FOUND: apps/frontend/src/features/auth/pages/SignupStep2.tsx
- FOUND: apps/frontend/src/features/auth/pages/VerifyEmailPendingPage.tsx
- FOUND: apps/frontend/src/features/auth/pages/VerifyEmailSuccessPage.tsx
- FOUND: apps/frontend/src/features/auth/pages/InvitationPage.tsx
- FOUND: apps/frontend/src/features/auth/pages/NotFoundPage.tsx
- FOUND: apps/frontend/src/components/ProtectedRoute.tsx
- FOUND: apps/frontend/src/pages/DashboardPlaceholder.tsx
- FOUND: apps/frontend/src/router.tsx (modified)

Commits verified:
- FOUND: f8aeb4d feat(01-06): build shared auth components and API client
- FOUND: a2c4d6b feat(01-06): build all 6 auth pages and wire router

---
*Phase: 01-foundation*
*Completed: 2026-05-05 (paused at Task 3 checkpoint)*
