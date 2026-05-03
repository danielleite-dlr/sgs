---
phase: 01-foundation
plan: 03
subsystem: frontend-scaffold
tags: [frontend, tailwind, shadcn, apollo, zustand, i18n, react-router]
dependency_graph:
  requires: [01-01-monorepo-docker]
  provides:
    - UI design token system (Tailwind CSS 3 + CSS vars)
    - shadcn/ui primitive components (Button, Input, Label, Card, Alert, Form, Separator, Sonner)
    - Apollo Client singleton with auth+error links
    - Zustand auth store persisted to localStorage (sgs-auth)
    - react-i18next initialized with pt-BR locale
    - React Router v7 route table with placeholder routes
  affects:
    - 01-06-frontend-auth-pages (directly depends on all primitives this plan installs)
tech_stack:
  added:
    - tailwindcss@3.4.13
    - tailwindcss-animate@1.0.7
    - class-variance-authority@0.7.0
    - clsx@2.1.1
    - tailwind-merge@2.5.0
    - lucide-react@0.475.0
    - "@radix-ui/react-slot@1.1.0"
    - "@radix-ui/react-label@2.1.0"
    - "@radix-ui/react-separator@1.1.0"
    - "@apollo/client@3.13.4"
    - graphql@16.10.0
    - graphql-ws@5.16.0
    - zustand@5.0.0
    - immer@10.1.1
    - i18next@23.16.0
    - react-i18next@15.0.3
    - react-router-dom@7.1.5
    - sonner@1.5.0
    - react-hook-form@7.53.0
    - "@hookform/resolvers@3.9.0"
    - zod@3.23.8
  patterns:
    - Tailwind CSS 3 with CSS custom properties for color tokens
    - shadcn/ui component architecture (cva + Radix primitives)
    - Apollo Link chain (errorLink → authLink → httpLink)
    - Zustand store with immer middleware + persist middleware
    - i18next side-effect initialization pattern
    - React Router v7 createBrowserRouter
key_files:
  created:
    - apps/frontend/tailwind.config.ts
    - apps/frontend/postcss.config.js
    - apps/frontend/components.json
    - apps/frontend/src/styles/globals.css
    - apps/frontend/src/lib/cn.ts
    - apps/frontend/src/lib/utils.ts
    - apps/frontend/src/components/ui/button.tsx
    - apps/frontend/src/components/ui/input.tsx
    - apps/frontend/src/components/ui/label.tsx
    - apps/frontend/src/components/ui/card.tsx
    - apps/frontend/src/components/ui/alert.tsx
    - apps/frontend/src/components/ui/form.tsx
    - apps/frontend/src/components/ui/separator.tsx
    - apps/frontend/src/components/ui/sonner.tsx
    - apps/frontend/src/infrastructure/apollo/client.ts
    - apps/frontend/src/infrastructure/apollo/auth-link.ts
    - apps/frontend/src/infrastructure/apollo/error-link.ts
    - apps/frontend/src/infrastructure/stores/auth.store.ts
    - apps/frontend/src/infrastructure/i18n/index.ts
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
    - apps/frontend/src/router.tsx
    - apps/frontend/src/types/env.d.ts
    - apps/frontend/.env.example
    - apps/frontend/codegen.ts
    - apps/frontend/eslint.config.js
  modified:
    - apps/frontend/package.json
    - apps/frontend/src/App.tsx
    - apps/frontend/src/main.tsx
    - apps/frontend/index.html
    - apps/frontend/tsconfig.node.json
    - apps/frontend/vite.config.ts
    - .gitignore
    - pnpm-lock.yaml
decisions:
  - "Tailwind CSS 3 (not v4) per CLAUDE.md shadcn/ui compatibility constraint"
  - "Google Fonts import moved to index.html link tag (PostCSS @import url() caused build hang)"
  - "Auth store uses full session shape: accessToken, refreshToken, userId, memberId, organizationId, roleName, permissions"
  - "react-router-dom v7 used (already installed by Plan 01-01, plan called for v6)"
  - "errorLink placed before authLink in Apollo chain so auth errors are caught before token injection"
  - "Zustand immer middleware used for immutable state updates (CLAUDE.md recommends immer)"
metrics:
  duration_minutes: 120
  completed: "2026-05-03T21:32:51Z"
  tasks_completed: 2
  files_created: 25
  files_modified: 8
  commits: 3
---

# Phase 1 Plan 03: Frontend Scaffold Summary

Frontend infrastructure scaffolded with Tailwind CSS 3 design tokens, shadcn/ui primitives, Apollo Client (auth+error links), Zustand auth store persisted as `sgs-auth` in localStorage, react-i18next with complete pt-BR copy from UI-SPEC, and React Router v7 route table with placeholder routes for all 6 auth screens.

## Commits

| Hash | Message |
|------|---------|
| `7dbfd44` | feat(01-03): install Tailwind CSS 3 + shadcn/ui base components |
| `534e042` | feat(01-03): wire Apollo Client, Zustand auth store, i18next, React Router |
| `a1d4027` | fix(01-03): align router routes and i18n strings to UI-SPEC contract |

## What Was Built

### Task 1: Tailwind CSS 3 + shadcn/ui (commit `7dbfd44`)

**Design Tokens** — exact hex values from UI-SPEC §"Design System":
- Primary: `primary-500: #5D54C7`, `primary-700: #3C3489`, `primary-900: #26215C`
- Neutral: `neutral-0: #FFFFFF`, `neutral-50: #FAFAF8`, `neutral-200: #E5E3DC`, `neutral-500: #888780`, `neutral-800: #2C2C2A`
- Semantic: `error-500: #D85A30`, `success-500: #1D9E75`, `warning-500: #EF9F27`
- Typography: 4 sizes only — `label` (14px/600), `body` (16px/400), `heading` (20px/600), `display` (24px/600)
- Spacing: `xs=4px`, `sm=8px`, `md=16px`, `lg=24px`, `xl=32px`, `2xl=48px`, `3xl=64px`

**CSS Variables** (`globals.css`): Mirrors Tailwind tokens as CSS custom properties so both `@apply text-primary-500` and `var(--color-primary-500)` work.

**shadcn/ui Primitives**:
- `Button` — min-h-[44px] WCAG touch target; variants: default, destructive, outline, secondary, ghost, link
- `Input` — min-h-[44px]; aria-invalid error state uses border-error-500
- `Label` — text-label size, text-neutral-800
- `Card` — bg-neutral-0 border border-neutral-200 rounded-lg shadow-card max-w-[400px]
- `Alert` — destructive variant uses border-error-500 text-error-500
- `Form` — full react-hook-form integration (FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage)
- `Separator` — Radix wrapper using neutral-200
- `Sonner` — Toaster with richColors and position="top-right"

### Task 2: Apollo + Zustand + i18n + Router (commits `534e042`, `a1d4027`)

**Apollo Client** (`src/infrastructure/apollo/`):
- `client.ts` — exports `apolloClient` as singleton; link chain: errorLink → authLink → httpLink; httpLink uri from `VITE_API_URL/graphql`
- `auth-link.ts` — reads `useAuthStore.getState().accessToken` + `organizationId`; adds `Authorization: Bearer <token>` and `X-Organization-Id` headers
- `error-link.ts` — handles UNAUTHENTICATED/FORBIDDEN: calls `clearSession()` + `window.location.assign('/login')`

**Zustand Auth Store** (`src/infrastructure/stores/auth.store.ts`):
```typescript
export const useAuthStore = create<AuthStore>()(persist(..., { name: 'sgs-auth' }));

// State shape:
{
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  memberId: string | null;
  organizationId: string | null;
  roleName: string | null;
  permissions: string[];
}

// Actions:
setSession(s: AuthSession): void        // hydrate after login
updateAccessToken(token: string): void  // rotate access token silently
clearSession(): void                    // logout / UNAUTHENTICATED
```

**i18next** (`src/infrastructure/i18n/`):
- Initialized with `lng: 'pt-BR'`, `fallbackLng: 'pt-BR'`, `escapeValue: false`
- `pt-BR.json` contains all 6 auth screen namespaces: `login`, `signup`, `verifyEmail`, `verifyEmailSuccess`, `invitation`, `notFound`
- Side-effect import in `App.tsx`: `import '@/infrastructure/i18n'`

**React Router v7** (`src/router.tsx`):
- Exports `router` as `createBrowserRouter` instance
- 8 routes including all 6 UI-SPEC auth screens:
  - `/` → redirect to `/login`
  - `/login`
  - `/signup`
  - `/verificar-email`
  - `/verificar-email/sucesso`
  - `/convite/:token`
  - `/dashboard` (placeholder for Phase 2)
  - `*` (404)

**App.tsx** — composed provider tree:
```tsx
<ApolloProvider client={apolloClient}>
  <Suspense fallback={null}>
    <RouterProvider router={router} />
  </Suspense>
  <Toaster richColors position="top-right" />
</ApolloProvider>
```

## Design Token Reference

Plan 06 must import from these exact paths:

| Import | Path |
|--------|------|
| `cn()` | `@/lib/utils` |
| `Button`, `buttonVariants` | `@/components/ui/button` |
| `Input` | `@/components/ui/input` |
| `Label` | `@/components/ui/label` |
| `Card`, `CardHeader`, `CardContent`, `CardFooter` | `@/components/ui/card` |
| `Alert`, `AlertTitle`, `AlertDescription` | `@/components/ui/alert` |
| `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` | `@/components/ui/form` |
| `Separator` | `@/components/ui/separator` |
| `Toaster` | `@/components/ui/sonner` |
| `useAuthStore` | `@/infrastructure/stores/auth.store` |
| `apolloClient` | `@/infrastructure/apollo/client` |
| `router` | `@/router` |

## Decisions Made

1. **Tailwind CSS 3 not v4** — CLAUDE.md explicitly mandates v3 due to unverified shadcn/ui compatibility with v4.
2. **Google Fonts moved to index.html** — PostCSS `@import url('https://...')` caused vite build to hang for 5+ minutes. Moved to `<link>` in index.html.
3. **react-router-dom v7** — Plan called for v6 but v7 was already installed by Plan 01-01. v7 has compatible API; no change needed.
4. **Full auth session shape** — Added `refreshToken`, `userId`, `memberId`, `organizationId`, `roleName`, `permissions` per PRD §5.2. Phase 1 stores refresh token in localStorage (acceptable for MVP; Phase 3 rotates to httpOnly cookie).
5. **errorLink before authLink in chain** — Ensures auth errors from the server are caught before any token injection on the next retry.
6. **setContext API for authLink** — Used `setContext` from `@apollo/client/link/context` (provides cleaner `headers` object access than raw `ApolloLink`).

## Verification

```bash
# TypeScript clean (exit 0)
cd apps/frontend && pnpm typecheck

# Build passes (exit 0), produces dist/index.html
pnpm build

# Design token checks
grep -q "#5D54C7" apps/frontend/tailwind.config.ts
grep -q "--color-primary-500: #5D54C7" apps/frontend/src/styles/globals.css

# Auth strings present
node -e "const j=JSON.parse(require('fs').readFileSync('apps/frontend/src/infrastructure/i18n/locales/pt-BR.json','utf8')); console.log('login.cardHeading:', j.login.cardHeading);"
# → "Entrar na sua conta"
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pnpm install Windows race condition**
- **Found during:** Task 1 dependency installation
- **Issue:** Multiple parallel agent worktrees running pnpm install simultaneously caused Windows filesystem rename failures (ENOENT, EEXIST on `_tmp_NNNNN` directories). Affected @apollo/server, @graphql-typed-document-node, @prisma/client.
- **Fix:** Deleted nested `node_modules` from `@prisma/client`, `@prisma/engines`, `@nestjs/core`. Used PowerShell to clean all `_tmp_NNNNN` directories. Switched to `pnpm install --config.node-linker=hoisted` for flat node_modules layout.
- **Files modified:** Root `node_modules/` (package installation only, not committed)
- **Commit:** Infrastructure only — no source commit needed

**2. [Rule 3 - Blocking] TypeScript project reference config error**
- **Found during:** Task 1 verification
- **Issue:** `tsconfig.json` references `tsconfig.node.json` but `tsconfig.node.json` lacked `composite: true` and `emitDeclarationOnly: true`.
- **Fix:** Added `"composite": true` and `"emitDeclarationOnly": true` to `tsconfig.node.json`.
- **Files modified:** `apps/frontend/tsconfig.node.json`
- **Commit:** `7dbfd44`

**3. [Rule 1 - Bug] tailwind.config.ts used `require()` in ESM context**
- **Found during:** Task 1 TypeScript check
- **Issue:** `plugins: [require('tailwindcss-animate')]` fails in ESM module context with "Cannot find name 'require'".
- **Fix:** Changed to `import tailwindcssAnimate from 'tailwindcss-animate'` and used `plugins: [tailwindcssAnimate]`.
- **Files modified:** `apps/frontend/tailwind.config.ts`
- **Commit:** `7dbfd44`

**4. [Rule 1 - Bug] vite.config.ts used `__dirname` and CJS `path`**
- **Found during:** Task 1 TypeScript check
- **Issue:** `path.resolve(__dirname, './src')` fails in ESM context with "Cannot find name '__dirname'".
- **Fix:** Rewrote to use `fileURLToPath(new URL('./src', import.meta.url))`.
- **Files modified:** `apps/frontend/vite.config.ts`
- **Commit:** `7dbfd44`

**5. [Rule 1 - Bug] Google Fonts @import caused vite build hang**
- **Found during:** Task 1 vite build verification
- **Issue:** `@import url('https://fonts.googleapis.com/...')` in globals.css caused PostCSS to attempt a network fetch during build, hanging indefinitely.
- **Fix:** Removed @import from globals.css. Moved to `<link rel="preconnect">` + `<link href="...googleapis.com...">` in `index.html`.
- **Files modified:** `apps/frontend/src/styles/globals.css`, `apps/frontend/index.html`
- **Commit:** `7dbfd44`

**6. [Rule 2 - Missing] .gitignore missing tsc -b generated files**
- **Found during:** Task 1 git status
- **Issue:** `tsc -b` (composite project mode) generates `.d.ts` declaration files for config files. These should not be committed.
- **Fix:** Added `*.tsbuildinfo`, `apps/frontend/tailwind.config.d.ts`, `apps/frontend/vite.config.d.ts` to root `.gitignore`.
- **Files modified:** `.gitignore`
- **Commit:** `7dbfd44`

**7. [Rule 2 - Missing] Route paths didn't match UI-SPEC**
- **Found during:** Task 2 acceptance criteria review
- **Issue:** Initial router used `/register`, `/forgot-password`, `/reset-password` instead of UI-SPEC routes `/signup`, `/verificar-email`, `/verificar-email/sucesso`, `/convite/:token`.
- **Fix:** Rewrote router.tsx to use exact UI-SPEC route structure.
- **Files modified:** `apps/frontend/src/router.tsx`
- **Commit:** `a1d4027`

## Known Stubs

The following placeholder pages will be replaced by Plan 06 (frontend-auth-pages):

| File | Route | Reason |
|------|-------|--------|
| `src/router.tsx` — `Placeholder` component | `/login`, `/signup`, `/verificar-email`, `/verificar-email/sucesso`, `/convite/:token` | Placeholder routes; real pages in Plan 06 |
| `src/pages/DashboardPage.tsx` | `/dashboard` | Placeholder; real dashboard in Phase 2 |

These stubs DO NOT prevent Plan 03's goal — the plan's purpose is to install infrastructure (tokens, components, client config), not render real pages. Plan 06 depends on this plan and will replace all placeholder pages.

## Self-Check: PASSED

All key files verified:
- FOUND: apps/frontend/tailwind.config.ts
- FOUND: apps/frontend/src/styles/globals.css
- FOUND: apps/frontend/src/components/ui/button.tsx
- FOUND: apps/frontend/src/infrastructure/apollo/client.ts
- FOUND: apps/frontend/src/infrastructure/stores/auth.store.ts
- FOUND: apps/frontend/src/router.tsx
- FOUND: apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
- FOUND: apps/frontend/dist/index.html

Commits verified:
- `7dbfd44` feat(01-03): install Tailwind CSS 3 + shadcn/ui base components
- `534e042` feat(01-03): wire Apollo Client, Zustand auth store, i18next, React Router
- `a1d4027` fix(01-03): align router routes and i18n strings to UI-SPEC contract
