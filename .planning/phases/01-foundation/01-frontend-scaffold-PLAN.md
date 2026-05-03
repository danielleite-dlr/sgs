---
phase: 01-foundation
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/frontend/package.json
  - apps/frontend/tailwind.config.ts
  - apps/frontend/postcss.config.js
  - apps/frontend/components.json
  - apps/frontend/src/styles/globals.css
  - apps/frontend/src/lib/utils.ts
  - apps/frontend/src/lib/cn.ts
  - apps/frontend/src/components/ui/button.tsx
  - apps/frontend/src/components/ui/input.tsx
  - apps/frontend/src/components/ui/label.tsx
  - apps/frontend/src/components/ui/card.tsx
  - apps/frontend/src/components/ui/alert.tsx
  - apps/frontend/src/components/ui/form.tsx
  - apps/frontend/src/components/ui/separator.tsx
  - apps/frontend/src/components/ui/sonner.tsx
  - apps/frontend/src/infrastructure/apollo/client.ts
  - apps/frontend/src/infrastructure/apollo/error-link.ts
  - apps/frontend/src/infrastructure/apollo/auth-link.ts
  - apps/frontend/src/infrastructure/stores/auth.store.ts
  - apps/frontend/src/infrastructure/i18n/index.ts
  - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  - apps/frontend/src/router.tsx
  - apps/frontend/src/App.tsx
  - apps/frontend/src/main.tsx
  - apps/frontend/src/types/env.d.ts
  - apps/frontend/.env.example
  - apps/frontend/codegen.ts
  - apps/frontend/eslint.config.js
autonomous: true
requirements: [INFRA-01]

must_haves:
  truths:
    - "Frontend dev server boots and renders a placeholder route at http://localhost:5173/login"
    - "Tailwind CSS 3 is installed and the design tokens from UI-SPEC are present in globals.css and tailwind.config.ts"
    - "shadcn/ui Button, Input, Label, Card, Alert, Form, Separator components exist in src/components/ui/"
    - "Apollo Client is configured with HttpLink, error-link, auth-link, and InMemoryCache"
    - "Zustand auth store exposes accessToken, setSession, clearSession; persists across reloads via localStorage"
    - "react-i18next is initialized with pt-BR locale and the auth-screen copywriting from UI-SPEC"
    - "React Router 6 is wired with placeholder routes for /login, /signup, /verificar-email, /verificar-email/sucesso, /convite/:token, /404"
  artifacts:
    - path: "apps/frontend/tailwind.config.ts"
      provides: "Design tokens (colors, spacing, typography) from UI-SPEC"
      contains: "primary"
    - path: "apps/frontend/src/styles/globals.css"
      provides: "CSS variables for colors and font setup (Inter)"
      contains: "--color-primary-500"
    - path: "apps/frontend/src/components/ui/button.tsx"
      provides: "shadcn Button primitive"
      exports: ["Button", "buttonVariants"]
    - path: "apps/frontend/src/infrastructure/apollo/client.ts"
      provides: "Apollo Client singleton with auth + error links"
      exports: ["apolloClient"]
    - path: "apps/frontend/src/infrastructure/stores/auth.store.ts"
      provides: "Zustand auth store"
      exports: ["useAuthStore"]
    - path: "apps/frontend/src/router.tsx"
      provides: "React Router 6 route table"
      exports: ["router"]
  key_links:
    - from: "Apollo Client httpLink"
      to: "VITE_API_URL/graphql"
      via: "HttpLink uri"
      pattern: "VITE_API_URL"
    - from: "Apollo Client authLink"
      to: "useAuthStore"
      via: "Authorization Bearer header from accessToken"
      pattern: "Authorization"
    - from: "router.tsx"
      to: "lazy-loaded auth pages (created in plan 06)"
      via: "React.lazy"
      pattern: "lazy"
---

<objective>
Scaffold the frontend infrastructure: Tailwind CSS 3 with the UI-SPEC design tokens, shadcn/ui base components, Apollo Client (with auth + error links), Zustand auth store, react-i18next with pt-BR copy from UI-SPEC, React Router 6 route table with placeholders for the 6 auth screens.

Purpose: Plan 06 (frontend auth pages) needs every primitive and provider this plan installs. Without this scaffold, plan 06 would be 8+ tasks of setup before any actual page work.

Output: A frontend that boots, renders the design system, exposes Apollo + auth + i18n contexts, and has navigable placeholder routes ready for plan 06 to fill in.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-UI-SPEC.md
@.planning/phases/01-foundation/01-01-SUMMARY.md
@PRD_Frontend_Plataforma_Saloes.md
@CLAUDE.md

<interfaces>
<!-- From plan 01: -->
- apps/frontend/ exists with React 19 + Vite 6 + TypeScript stub
- Frontend container exposes :5173 and reads .env via env_file from docker-compose

<!-- Locked decisions from CONTEXT.md driving this plan: -->
- D-03: React 19
- D-05: Tailwind latest stable — but UI-SPEC §"Design System" mandates "Use Tailwind CSS 3 (not v4 — compatibility with shadcn/ui unverified per CLAUDE.md)". USE Tailwind 3.

<!-- Locked design tokens from UI-SPEC (must be in tailwind.config.ts and globals.css verbatim): -->
Colors (CSS variables, exact hex):
- --color-primary-500: #5D54C7 (accent — submit buttons, links, focus)
- --color-primary-700: #3C3489 (accent hover only)
- --color-neutral-0:   #FFFFFF (surface — auth card)
- --color-neutral-50:  #FAFAF8 (background — page canvas)
- --color-neutral-200: #E5E3DC (borders, dividers)
- --color-neutral-500: #888780 (text muted)
- --color-neutral-800: #2C2C2A (text primary)
- --color-success-500: #1D9E75
- --color-error-500:   #D85A30
- --color-warning-500: #EF9F27 (NOT used in Phase 1 but defined)

Typography (UI-SPEC mandates EXACTLY 4 sizes, 2 weights):
- 14px / 600 — labels, errors, step indicators, button text
- 16px / 400 — body, helper text, placeholders
- 20px / 600 — card headings
- 24px / 600 — display / brand
Font: Inter (Google Fonts) — fallback: ui-sans-serif, system-ui, sans-serif

Spacing (4px base):
- xs 4 / sm 8 / md 16 / lg 24 / xl 32 / 2xl 48 / 3xl 64

Auth card:
- background: white, border 1px #E5E3DC, border-radius 12px, max-width 400px, padding 32px desktop / 24px mobile, shadow `0 1px 3px rgba(0,0,0,0.08)`

<!-- Routes (UI-SPEC §"Copywriting Contract" defines copy; plan 06 implements pages): -->
- `/login` — Login screen
- `/signup` — Signup 2-step
- `/verificar-email` — Email verification pending
- `/verificar-email/sucesso` — Email verified success
- `/convite/:token` — Member invitation acceptance
- `*` — 404

<!-- Components per UI-SPEC §"Component Inventory": -->
shadcn: Button, Input, Label, Form, Alert, Card, Separator, Toast/Sonner.
Custom: PasswordInput (Eye/EyeOff toggle), StepIndicator (2-dot).
Icons: lucide-react (Loader2, Eye, EyeOff).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Tailwind CSS 3 + shadcn/ui base components with UI-SPEC design tokens</name>
  <files>apps/frontend/package.json, apps/frontend/tailwind.config.ts, apps/frontend/postcss.config.js, apps/frontend/components.json, apps/frontend/src/styles/globals.css, apps/frontend/src/lib/utils.ts, apps/frontend/src/lib/cn.ts, apps/frontend/src/components/ui/button.tsx, apps/frontend/src/components/ui/input.tsx, apps/frontend/src/components/ui/label.tsx, apps/frontend/src/components/ui/card.tsx, apps/frontend/src/components/ui/alert.tsx, apps/frontend/src/components/ui/form.tsx, apps/frontend/src/components/ui/separator.tsx, apps/frontend/src/components/ui/sonner.tsx, apps/frontend/src/main.tsx</files>
  <read_first>
    - .planning/phases/01-foundation/01-UI-SPEC.md (THE design contract — colors, typography, spacing, components)
    - apps/frontend/package.json (current deps from plan 01)
    - apps/frontend/src/main.tsx (current bootstrap to update with globals.css import)
    - PRD_Frontend_Plataforma_Saloes.md §4.2 (token system — confirms hex values match UI-SPEC)
  </read_first>
  <action>
    **Update `apps/frontend/package.json` deps (add to existing):**

    dependencies:
    - `tailwindcss@^3.4.13` (NOT v4 — UI-SPEC mandates v3)
    - `tailwindcss-animate@^1.0.7`
    - `class-variance-authority@^0.7.0`
    - `clsx@^2.1.1`
    - `tailwind-merge@^2.5.0`
    - `lucide-react@^0.460.0`
    - `@radix-ui/react-slot@^1.1.0`
    - `@radix-ui/react-label@^2.1.0`
    - `@radix-ui/react-separator@^1.1.0`
    - `react-hook-form@^7.53.0`
    - `@hookform/resolvers@^3.9.0`
    - `zod@^3.23.8`
    - `sonner@^1.5.0`

    devDependencies:
    - `autoprefixer@^10.4.20`
    - `postcss@^8.4.47`

    Run `pnpm install` after writing the package.json.

    **Create `apps/frontend/postcss.config.js`:**
    ```javascript
    export default {
      plugins: {
        tailwindcss: {},
        autoprefixer: {},
      },
    };
    ```

    **Create `apps/frontend/components.json`** (shadcn config, satisfies UI-SPEC "Initialize at implementation time"):
    ```json
    {
      "$schema": "https://ui.shadcn.com/schema.json",
      "style": "default",
      "rsc": false,
      "tsx": true,
      "tailwind": {
        "config": "tailwind.config.ts",
        "css": "src/styles/globals.css",
        "baseColor": "neutral",
        "cssVariables": true,
        "prefix": ""
      },
      "aliases": {
        "components": "@/components",
        "utils": "@/lib/utils",
        "ui": "@/components/ui",
        "lib": "@/lib",
        "hooks": "@/hooks"
      }
    }
    ```

    **Update `apps/frontend/vite.config.ts` to add `@/*` alias:**
    ```typescript
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import path from 'node:path';

    export default defineConfig({
      plugins: [react()],
      resolve: {
        alias: { '@': path.resolve(__dirname, './src') },
      },
      server: { host: '0.0.0.0', port: 5173, strictPort: true },
    });
    ```

    **Update `apps/frontend/tsconfig.json` paths:**
    Add to compilerOptions: `"baseUrl": ".", "paths": { "@/*": ["./src/*"] }`.

    **Create `apps/frontend/tailwind.config.ts` with EXACT UI-SPEC tokens:**
    ```typescript
    import type { Config } from 'tailwindcss';

    const config: Config = {
      darkMode: ['class'],
      content: ['./index.html', './src/**/*.{ts,tsx}'],
      theme: {
        container: { center: true, padding: '1rem' },
        extend: {
          colors: {
            border: 'hsl(var(--border))',
            input: 'hsl(var(--border))',
            ring: 'hsl(var(--ring))',
            background: 'var(--color-background)',
            foreground: 'var(--color-text)',
            primary: {
              50: '#EEEDFE',
              500: '#5D54C7',
              700: '#3C3489',
              900: '#26215C',
              DEFAULT: '#5D54C7',
              foreground: '#FFFFFF',
            },
            success: { 500: '#1D9E75', DEFAULT: '#1D9E75' },
            warning: { 500: '#EF9F27', DEFAULT: '#EF9F27' },
            error: { 500: '#D85A30', DEFAULT: '#D85A30' },
            destructive: { DEFAULT: '#D85A30', foreground: '#FFFFFF' },
            neutral: {
              0:   '#FFFFFF',
              50:  '#FAFAF8',
              200: '#E5E3DC',
              500: '#888780',
              800: '#2C2C2A',
            },
            muted: { DEFAULT: '#FAFAF8', foreground: '#888780' },
            accent: { DEFAULT: '#EEEDFE', foreground: '#3C3489' },
            card: { DEFAULT: '#FFFFFF', foreground: '#2C2C2A' },
            popover: { DEFAULT: '#FFFFFF', foreground: '#2C2C2A' },
            secondary: { DEFAULT: '#FAFAF8', foreground: '#2C2C2A' },
          },
          spacing: {
            xs: '4px',
            sm: '8px',
            md: '16px',
            lg: '24px',
            xl: '32px',
            '2xl': '48px',
            '3xl': '64px',
          },
          fontFamily: {
            sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
          },
          fontSize: {
            // UI-SPEC mandates exactly 4 sizes
            label:   ['14px', { lineHeight: '1.4', fontWeight: '600' }],
            body:    ['16px', { lineHeight: '1.5', fontWeight: '400' }],
            heading: ['20px', { lineHeight: '1.25', fontWeight: '600' }],
            display: ['24px', { lineHeight: '1.2', fontWeight: '600' }],
          },
          borderRadius: {
            lg: '12px',
            md: '8px',
            sm: '4px',
          },
          boxShadow: {
            card: '0 1px 3px rgba(0,0,0,0.08)',
          },
        },
      },
      plugins: [require('tailwindcss-animate')],
    };

    export default config;
    ```

    **Create `apps/frontend/src/styles/globals.css` with CSS variables matching UI-SPEC:**
    ```css
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
    @tailwind base;
    @tailwind components;
    @tailwind utilities;

    @layer base {
      :root {
        /* Colors — exact hex from UI-SPEC */
        --color-primary-50:  #EEEDFE;
        --color-primary-500: #5D54C7;
        --color-primary-700: #3C3489;
        --color-primary-900: #26215C;

        --color-success-500: #1D9E75;
        --color-warning-500: #EF9F27;
        --color-error-500:   #D85A30;

        --color-neutral-0:   #FFFFFF;
        --color-neutral-50:  #FAFAF8;
        --color-neutral-200: #E5E3DC;
        --color-neutral-500: #888780;
        --color-neutral-800: #2C2C2A;

        --color-background: var(--color-neutral-50);
        --color-surface:    var(--color-neutral-0);
        --color-text:       var(--color-neutral-800);
        --color-text-muted: var(--color-neutral-500);
        --color-border:     var(--color-neutral-200);

        /* shadcn HSL bridges (matches the Tailwind theme above) */
        --border: 41 14% 87%;
        --ring: 245 53% 56%;
      }

      html, body, #root { height: 100%; }
      body {
        @apply bg-background text-foreground font-sans antialiased;
      }

      /* WCAG 2.1 AA — visible focus ring on all interactive elements (UI-SPEC §"Color") */
      *:focus-visible {
        outline: 2px solid var(--color-primary-500);
        outline-offset: 2px;
      }
    }
    ```

    **Create `apps/frontend/src/lib/utils.ts` and `cn.ts`** (shadcn convention):
    ```typescript
    // apps/frontend/src/lib/utils.ts
    export { cn } from './cn';
    ```
    ```typescript
    // apps/frontend/src/lib/cn.ts
    import { clsx, type ClassValue } from 'clsx';
    import { twMerge } from 'tailwind-merge';

    export function cn(...inputs: ClassValue[]) {
      return twMerge(clsx(inputs));
    }
    ```

    **Create shadcn primitives** in `apps/frontend/src/components/ui/`. Use the canonical shadcn templates adapted to our token system. Key files:

    `button.tsx` — variants: default (bg-primary text-primary-foreground), outline (border border-neutral-200 text-neutral-800), ghost, destructive. Min height 44px on mobile (UI-SPEC accessibility). Includes Loader2 spinner support via prop or icon child.

    `input.tsx` — uses border-neutral-200 default, border-error-500 on aria-invalid="true". Min height 44px on mobile.

    `label.tsx` — uses text-label class, color text-neutral-800.

    `card.tsx` — Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription. Card root uses `bg-neutral-0 border border-neutral-200 rounded-lg shadow-card`.

    `alert.tsx` — Alert, AlertTitle, AlertDescription. Variants: default, destructive (border-error-500 text-error-500).

    `form.tsx` — react-hook-form + Radix Form integration: Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage.

    `separator.tsx` — Radix Separator wrapper.

    `sonner.tsx` — Sonner Toaster component (export `<Toaster richColors position="top-right" />`).

    **Update `apps/frontend/src/main.tsx`** to import globals.css:
    ```typescript
    import { StrictMode } from 'react';
    import { createRoot } from 'react-dom/client';
    import './styles/globals.css';
    import App from './App';

    createRoot(document.getElementById('root')!).render(
      <StrictMode><App /></StrictMode>
    );
    ```
  </action>
  <verify>
    <automated>cd d:/SGS && pnpm install && cd apps/frontend && pnpm typecheck && pnpm build</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/frontend/tailwind.config.ts` contains literal hex `#5D54C7` (primary-500) AND `#FAFAF8` (neutral-50) AND `#2C2C2A` (text)
    - File `apps/frontend/tailwind.config.ts` contains all 4 fontSize keys: `label`, `body`, `heading`, `display`
    - File `apps/frontend/tailwind.config.ts` contains all 7 spacing tokens: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`
    - File `apps/frontend/src/styles/globals.css` contains literal `--color-primary-500: #5D54C7`
    - File `apps/frontend/src/styles/globals.css` imports the Inter font family
    - File `apps/frontend/components.json` exists and is valid JSON
    - All 8 shadcn primitive files exist: `button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `alert.tsx`, `form.tsx`, `separator.tsx`, `sonner.tsx`
    - File `apps/frontend/src/components/ui/button.tsx` exports both `Button` and `buttonVariants`
    - File `apps/frontend/src/lib/utils.ts` re-exports `cn`
    - File `apps/frontend/package.json` declares `"tailwindcss": "^3` (NOT v4)
    - Command `pnpm --filter @sgs/frontend typecheck` exits 0
    - Command `pnpm --filter @sgs/frontend build` exits 0 and produces `apps/frontend/dist/index.html`
  </acceptance_criteria>
  <done>
    Tailwind CSS 3 with the UI-SPEC design tokens is installed and working. All required shadcn primitives are in place. The frontend builds cleanly with the new CSS pipeline.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire Apollo Client + Zustand auth store + react-i18next + React Router 6</name>
  <files>apps/frontend/package.json, apps/frontend/src/infrastructure/apollo/client.ts, apps/frontend/src/infrastructure/apollo/auth-link.ts, apps/frontend/src/infrastructure/apollo/error-link.ts, apps/frontend/src/infrastructure/stores/auth.store.ts, apps/frontend/src/infrastructure/i18n/index.ts, apps/frontend/src/infrastructure/i18n/locales/pt-BR.json, apps/frontend/src/router.tsx, apps/frontend/src/App.tsx, apps/frontend/src/types/env.d.ts, apps/frontend/.env.example, apps/frontend/codegen.ts, apps/frontend/eslint.config.js</files>
  <read_first>
    - .planning/phases/01-foundation/01-UI-SPEC.md §"Copywriting Contract" (every string for pt-BR.json — Login, Signup, VerificarEmail, Convite, 404)
    - apps/frontend/src/main.tsx (where to inject providers)
    - apps/frontend/src/App.tsx (current placeholder)
    - PRD_Frontend_Plataforma_Saloes.md §5.2 (Apollo configuration), §5.3 (Zustand), §7 (router structure), §12 (i18n)
  </read_first>
  <action>
    **Add to `apps/frontend/package.json` deps:**

    dependencies:
    - `@apollo/client@^3.11.8`
    - `graphql@^16.9.0`
    - `graphql-ws@^5.16.0`
    - `zustand@^5.0.0`
    - `immer@^10.1.1`
    - `i18next@^23.16.0`
    - `react-i18next@^15.0.3`
    - `react-router-dom@^6.27.0`

    devDependencies:
    - `@graphql-codegen/cli@^5.0.3`
    - `@graphql-codegen/client-preset@^4.4.0`
    - `eslint@^9.13.0`
    - `eslint-plugin-react-hooks@^5.0.0`
    - `eslint-plugin-react-refresh@^0.4.14`
    - `@typescript-eslint/eslint-plugin@^8.10.0`
    - `@typescript-eslint/parser@^8.10.0`
    - `vitest@^2.1.3`
    - `@testing-library/react@^16.0.1`
    - `@testing-library/jest-dom@^6.5.0`
    - `jsdom@^25.0.1`

    **Create `apps/frontend/.env.example`:**
    ```
    VITE_API_URL=http://localhost:3000
    VITE_APP_NAME=SGS
    ```

    **Create `apps/frontend/src/types/env.d.ts`:**
    ```typescript
    /// <reference types="vite/client" />
    interface ImportMetaEnv {
      readonly VITE_API_URL: string;
      readonly VITE_APP_NAME: string;
    }
    interface ImportMeta { readonly env: ImportMetaEnv; }
    ```

    **Create `apps/frontend/src/infrastructure/stores/auth.store.ts`** (Zustand with localStorage persistence — required by AUTH-02 "session persists across browser refresh"):
    ```typescript
    import { create } from 'zustand';
    import { persist, createJSONStorage } from 'zustand/middleware';

    interface AuthSession {
      accessToken: string | null;
      refreshToken: string | null;       // NOTE: storing refresh token in localStorage is acceptable for Phase 1; rotate to httpOnly cookie in v2
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

    const initialState: AuthSession = {
      accessToken: null,
      refreshToken: null,
      userId: null,
      memberId: null,
      organizationId: null,
      roleName: null,
      permissions: [],
    };

    export const useAuthStore = create<AuthSession & AuthActions>()(
      persist(
        (set) => ({
          ...initialState,
          setSession: (s) => set(s),
          updateAccessToken: (accessToken) => set({ accessToken }),
          clearSession: () => set(initialState),
        }),
        {
          name: 'sgs-auth',
          storage: createJSONStorage(() => localStorage),
          // Only persist tokens + identity — never persist permissions (re-fetched on refresh)
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

    export function selectIsAuthenticated(s: ReturnType<typeof useAuthStore.getState>): boolean {
      return !!s.accessToken && !!s.userId;
    }
    ```

    **Create `apps/frontend/src/infrastructure/apollo/auth-link.ts`:**
    ```typescript
    import { setContext } from '@apollo/client/link/context';
    import { useAuthStore } from '@/infrastructure/stores/auth.store';

    export const authLink = setContext((_op, { headers }) => {
      const token = useAuthStore.getState().accessToken;
      const orgId = useAuthStore.getState().organizationId;
      return {
        headers: {
          ...headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(orgId ? { 'X-Organization-Id': orgId } : {}),
        },
      };
    });
    ```

    **Create `apps/frontend/src/infrastructure/apollo/error-link.ts`** — handles 401 by clearing session (refresh-token rotation handled in plan 06's auth flow):
    ```typescript
    import { onError } from '@apollo/client/link/error';
    import { useAuthStore } from '@/infrastructure/stores/auth.store';

    export const errorLink = onError(({ graphQLErrors, networkError }) => {
      if (graphQLErrors) {
        for (const err of graphQLErrors) {
          if (err.extensions?.code === 'UNAUTHENTICATED' || err.extensions?.code === 'FORBIDDEN') {
            useAuthStore.getState().clearSession();
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
              window.location.assign('/login');
            }
          }
        }
      }
      if (networkError) {
        // Sentry capture wired in QA phase. Console for now.
        console.error('[apollo] networkError', networkError);
      }
    });
    ```

    **Create `apps/frontend/src/infrastructure/apollo/client.ts`:**
    ```typescript
    import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
    import { authLink } from './auth-link';
    import { errorLink } from './error-link';

    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

    const httpLink = new HttpLink({
      uri: `${apiUrl}/graphql`,
      credentials: 'include',
    });

    export const apolloClient = new ApolloClient({
      link: from([errorLink, authLink, httpLink]),
      cache: new InMemoryCache(),
      defaultOptions: {
        watchQuery: { fetchPolicy: 'cache-and-network', errorPolicy: 'all' },
        query: { fetchPolicy: 'network-only', errorPolicy: 'all' },
        mutate: { errorPolicy: 'all' },
      },
    });
    ```

    **Create `apps/frontend/src/infrastructure/i18n/locales/pt-BR.json`** — copy EVERY string from UI-SPEC §"Copywriting Contract" verbatim. Structure:
    ```json
    {
      "common": {
        "appName": "SGS",
        "loading": "Carregando…",
        "error": "Algo deu errado. Tente novamente."
      },
      "login": {
        "pageTitle": "Entrar — SGS",
        "cardHeading": "Entrar na sua conta",
        "emailLabel": "E-mail",
        "emailPlaceholder": "seu@email.com",
        "passwordLabel": "Senha",
        "passwordPlaceholder": "••••••••",
        "primaryCta": "Entrar",
        "loadingCta": "Entrando…",
        "linkToSignup": "Não tem conta? Criar conta",
        "forgotPassword": "Esqueceu a senha?",
        "errors": {
          "wrongCredentials": "E-mail ou senha incorretos.",
          "unverified": "Verifique seu e-mail antes de entrar.",
          "resendVerification": "Reenviar verificação",
          "serverGeneric": "Algo deu errado. Tente novamente."
        }
      },
      "signup": {
        "pageTitle": "Criar conta — SGS",
        "step1": {
          "cardHeading": "Crie sua conta",
          "stepIndicator": "Passo 1 de 2",
          "nameLabel": "Nome completo",
          "namePlaceholder": "Maria da Silva",
          "emailLabel": "E-mail",
          "emailPlaceholder": "seu@email.com",
          "passwordLabel": "Senha",
          "passwordPlaceholder": "Mínimo 8 caracteres",
          "primaryCta": "Continuar",
          "linkToLogin": "Já tem conta? Entrar",
          "errors": {
            "emailExists": "E-mail já cadastrado.",
            "loginInstead": "Entrar na conta",
            "emailFormat": "Digite um e-mail válido.",
            "passwordTooShort": "A senha deve ter pelo menos 8 caracteres.",
            "nameTooShort": "Digite seu nome completo."
          }
        },
        "step2": {
          "cardHeading": "Qual é o nome do seu salão?",
          "stepIndicator": "Passo 2 de 2",
          "salonNameLabel": "Nome do salão",
          "salonNamePlaceholder": "Ex.: Studio Beleza, Salão da Ana",
          "primaryCta": "Criar conta",
          "loadingCta": "Criando conta…",
          "backLink": "Voltar",
          "errors": {
            "salonNameTooShort": "Digite o nome do seu salão.",
            "serverGeneric": "Não foi possível criar sua conta. Tente novamente."
          }
        }
      },
      "verifyEmail": {
        "pageTitle": "Verifique seu e-mail — SGS",
        "cardHeading": "Verifique seu e-mail",
        "body": "Enviamos um link de verificação para {{email}}. Acesse sua caixa de entrada e clique no link para ativar sua conta.",
        "resendCta": "Reenviar e-mail",
        "loadingCta": "Reenviando…",
        "successAfterResend": "E-mail reenviado. Verifique sua caixa de entrada.",
        "rateLimitNote": "Aguarde {{seconds}} segundos para reenviar novamente.",
        "wrongEmailLink": "E-mail errado? Voltar ao cadastro"
      },
      "verifyEmailSuccess": {
        "pageTitle": "E-mail verificado — SGS",
        "cardHeading": "E-mail verificado com sucesso!",
        "body": "Sua conta está ativa. Agora você pode entrar na plataforma.",
        "primaryCta": "Entrar agora"
      },
      "invitation": {
        "pageTitle": "Convite — SGS",
        "cardHeading": "Você foi convidado para {{salonName}}",
        "body": "{{inviterName}} convidou você para entrar na equipe. Crie sua senha para aceitar o convite.",
        "nameLabel": "Seu nome",
        "namePlaceholder": "Como você quer ser chamado(a)",
        "passwordLabel": "Crie uma senha",
        "passwordPlaceholder": "Mínimo 8 caracteres",
        "primaryCta": "Aceitar convite",
        "loadingCta": "Aceitando…",
        "errors": {
          "expiredHeading": "Este convite expirou",
          "expiredBody": "Peça ao administrador do salão para enviar um novo convite.",
          "alreadyUsed": "Este convite já foi utilizado. Tente entrar com sua conta.",
          "serverGeneric": "Não foi possível aceitar o convite. Tente novamente."
        }
      },
      "notFound": {
        "pageTitle": "Página não encontrada — SGS",
        "heading": "Página não encontrada",
        "body": "O endereço que você acessou não existe ou foi movido.",
        "primaryCta": "Voltar ao início"
      }
    }
    ```

    **Create `apps/frontend/src/infrastructure/i18n/index.ts`:**
    ```typescript
    import i18n from 'i18next';
    import { initReactI18next } from 'react-i18next';
    import ptBR from './locales/pt-BR.json';

    i18n.use(initReactI18next).init({
      resources: { 'pt-BR': { translation: ptBR } },
      lng: 'pt-BR',
      fallbackLng: 'pt-BR',
      interpolation: { escapeValue: false },
      returnNull: false,
    });

    export default i18n;
    ```

    **Create `apps/frontend/src/router.tsx`** with placeholder routes (real pages come in plan 06 via React.lazy):
    ```typescript
    import { createBrowserRouter, Navigate } from 'react-router-dom';
    import { lazy } from 'react';

    // Plan 06 will replace these placeholders with the real auth pages.
    const Placeholder = ({ name }: { name: string }) => (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <section className="max-w-[400px] w-full bg-neutral-0 border border-neutral-200 rounded-lg p-xl shadow-card">
          <h1 className="text-heading text-neutral-800 mb-md">SGS — {name}</h1>
          <p className="text-body text-neutral-500">Página em construção (plano 06).</p>
        </section>
      </main>
    );

    const NotFound = lazy(async () => ({
      default: () => <Placeholder name="Página não encontrada" />,
    }));

    export const router = createBrowserRouter([
      { path: '/', element: <Navigate to="/login" replace /> },
      { path: '/login', element: <Placeholder name="Login" /> },
      { path: '/signup', element: <Placeholder name="Criar conta" /> },
      { path: '/verificar-email', element: <Placeholder name="Verifique seu e-mail" /> },
      { path: '/verificar-email/sucesso', element: <Placeholder name="E-mail verificado" /> },
      { path: '/convite/:token', element: <Placeholder name="Aceitar convite" /> },
      { path: '*', element: <Placeholder name="404" /> },
    ]);
    ```

    **Update `apps/frontend/src/App.tsx`** to compose all providers:
    ```typescript
    import { ApolloProvider } from '@apollo/client';
    import { RouterProvider } from 'react-router-dom';
    import { Suspense } from 'react';
    import { Toaster } from '@/components/ui/sonner';
    import { apolloClient } from '@/infrastructure/apollo/client';
    import { router } from '@/router';
    import '@/infrastructure/i18n';

    export default function App() {
      return (
        <ApolloProvider client={apolloClient}>
          <Suspense fallback={null}>
            <RouterProvider router={router} />
          </Suspense>
          <Toaster richColors position="top-right" />
        </ApolloProvider>
      );
    }
    ```

    **Create `apps/frontend/codegen.ts`** (graphql-codegen config — schema source provided in plan 04 once GraphQL is wired):
    ```typescript
    import type { CodegenConfig } from '@graphql-codegen/cli';

    const config: CodegenConfig = {
      schema: process.env.VITE_API_URL ? `${process.env.VITE_API_URL}/graphql` : 'http://localhost:3000/graphql',
      documents: ['src/**/*.{ts,tsx}', 'src/features/**/api/*.graphql'],
      generates: {
        './src/types/graphql.ts': {
          preset: 'client',
          plugins: [],
          config: { useTypeImports: true },
        },
      },
      ignoreNoDocuments: true,
    };

    export default config;
    ```

    **Create `apps/frontend/eslint.config.js`** (flat config, ESLint 9):
    ```javascript
    import js from '@eslint/js';
    import tseslint from '@typescript-eslint/eslint-plugin';
    import tsparser from '@typescript-eslint/parser';
    import reactHooks from 'eslint-plugin-react-hooks';
    import reactRefresh from 'eslint-plugin-react-refresh';

    export default [
      js.configs.recommended,
      {
        files: ['**/*.{ts,tsx}'],
        languageOptions: { parser: tsparser, ecmaVersion: 2022, sourceType: 'module' },
        plugins: { '@typescript-eslint': tseslint, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
        rules: {
          '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
          'react-hooks/rules-of-hooks': 'error',
          'react-hooks/exhaustive-deps': 'warn',
        },
      },
      { ignores: ['dist/**', 'node_modules/**', 'src/types/graphql.ts'] },
    ];
    ```
  </action>
  <verify>
    <automated>cd d:/SGS && pnpm install && cd apps/frontend && pnpm typecheck && pnpm build && grep -q "Entrar na sua conta" src/infrastructure/i18n/locales/pt-BR.json && grep -q "Crie sua conta" src/infrastructure/i18n/locales/pt-BR.json</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/frontend/src/infrastructure/apollo/client.ts` exports `apolloClient` from `ApolloClient`
    - File `apps/frontend/src/infrastructure/apollo/auth-link.ts` reads `useAuthStore.getState().accessToken` and adds `Authorization: Bearer` header
    - File `apps/frontend/src/infrastructure/stores/auth.store.ts` exports `useAuthStore` AND uses `persist` with name `sgs-auth`
    - File `apps/frontend/src/infrastructure/i18n/locales/pt-BR.json` is valid JSON containing all of: `"Entrar na sua conta"`, `"Crie sua conta"`, `"Verifique seu e-mail"`, `"E-mail verificado com sucesso!"`, `"Você foi convidado para {{salonName}}"`, `"Página não encontrada"`
    - File `apps/frontend/src/router.tsx` exports `router` AND declares 7 routes including `/login`, `/signup`, `/verificar-email`, `/verificar-email/sucesso`, `/convite/:token`, `*`
    - File `apps/frontend/src/App.tsx` wraps content in `ApolloProvider` AND `RouterProvider`
    - Command `pnpm --filter @sgs/frontend typecheck` exits 0
    - Command `pnpm --filter @sgs/frontend build` exits 0
    - File `apps/frontend/codegen.ts` exists and is valid TypeScript
  </acceptance_criteria>
  <done>
    Frontend boots with Apollo Client, Zustand auth store (persisted to localStorage so AUTH-02 session-persists works), react-i18next (pt-BR), and React Router 6 with placeholder routes. Plan 06 can directly slot pages into the router.
  </done>
</task>

</tasks>

<verification>
- `pnpm --filter @sgs/frontend dev` boots Vite at :5173
- Visiting / redirects to /login and shows the placeholder card with design tokens applied (background #FAFAF8, card #FFFFFF, text #2C2C2A, Inter font)
- `localStorage.getItem('sgs-auth')` returns null initially; setting via `useAuthStore.getState().setSession(...)` persists across hard refresh
- Tailwind config has all UI-SPEC tokens
- 8 shadcn primitives installed and typecheck cleanly
- Apollo Client + auth/error links wired
- pt-BR translations cover all 6 auth screens
</verification>

<success_criteria>
- Frontend dev server boots cleanly via `docker compose up frontend` and renders the placeholder routes with correct design tokens
- All UI-SPEC copywriting strings are present verbatim in pt-BR.json
- Plan 06 (frontend auth pages) has zero infrastructure work to do — it can build pages directly using the installed primitives
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-03-SUMMARY.md` documenting:
- Final pinned versions of: Tailwind, shadcn primitives, Apollo Client, Zustand, react-i18next, React Router
- The exact path layout for shadcn primitives (so plan 06 imports from the right place)
- The Zustand auth store API surface (selectors, actions) — exact function names plan 06 will consume
- Any UI-SPEC strings that were ambiguous and needed interpretation
</output>
