# @sgs/frontend

React 19 + Vite 6 + Tailwind 3 + shadcn/ui SPA for SGS.

## Local development

```bash
pnpm dev        # vite dev server at http://localhost:5173
pnpm build      # production build (tsc + vite build)
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
pnpm codegen    # generate GraphQL types from live backend schema (requires backend running)
```

Set `VITE_API_URL` in `.env` (defaults to `http://localhost:3000` for local dev).

## Layout

```
src/
  components/ui/        shadcn primitives (Button, Input, Card, Alert, Form, ...)
  components/           App-level shared components (ProtectedRoute, ...)
  features/auth/        Auth feature module
    api/                Apollo mutation wrappers (auth.api.ts) + .graphql files
    components/         Shared auth UI (AuthShell, AuthCard, Logo, PasswordInput, StepIndicator)
    hooks/              useAuth, useResendCooldown
    pages/              LoginPage, SignupPage, VerifyEmailPending, VerifyEmailSuccess, InvitationPage, NotFoundPage
    types.ts            TypeScript interfaces mirroring backend SDL
  infrastructure/
    apollo/             Apollo Client + authLink + errorLink
    i18n/               i18next setup + pt-BR locale
    stores/             Zustand auth store (persisted to localStorage as "sgs-auth")
  pages/                Top-level pages (DashboardPlaceholder)
  gql/                  Generated GraphQL types (graphql-codegen output — do not edit)
  styles/               globals.css with Tailwind base + design tokens
```

## Design tokens

Defined in `tailwind.config.ts` and `src/styles/globals.css`.

**Source of truth:** `.planning/phases/01-foundation/01-UI-SPEC.md`

Rules:
- Exactly 4 typography sizes: `text-label` (14px/600), `text-body` (16px/400), `text-heading` (20px/600), `text-display` (28px/700)
- 7 spacing tokens: `xs` (4px), `sm` (8px), `md` (16px), `lg` (24px), `xl` (32px), `2xl` (48px), `3xl` (64px)
- Color palette: `primary-*` (indigo), `neutral-*` (slate), `error-*` (rose), `success-*` (green), `warning-*` (amber)

Do not introduce new typography sizes or colors without updating UI-SPEC.

## GraphQL codegen

Types are generated from the live backend schema via `graphql-codegen` (see `codegen.ts`):

```bash
# Start backend first
docker compose up -d postgres pgbouncer valkey meilisearch backend
# Generate types
pnpm codegen
```

Generated output: `src/gql/graphql.ts` and related files. These are committed to the repo so
the frontend typechecks without requiring a live backend in CI (the `frontend-codegen` CI job
regenerates them to verify no drift).

## Auth store

`useAuthStore` (Zustand, persisted to `sgs-auth` key in localStorage):
- `session` — full `AuthSession` shape: `{ userId, email, fullName, memberships[] }`
- `accessToken`, `refreshToken` — JWT tokens
- `setSession(payload)` — applies an `AuthPayload` response
- `logout()` — clears all session data

Selector: `selectIsAuthenticated` — returns `true` when `accessToken` is non-null.
