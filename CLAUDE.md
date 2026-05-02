<!-- GSD:project-start source:PROJECT.md -->
## Project

**SGS — Plataforma de Gestão para Salões de Beleza**

Sistema SaaS multi-tenant de gestão inteligente para salões de beleza, barbearias, clínicas estéticas e estúdios de noivas no Brasil. Substitui planilhas, agendas em papel e WhatsApp manual por uma plataforma unificada de agendamento, financeiro, clientes e comunicação. Voltado para proprietários e profissionais que precisam de controle operacional completo sem complexidade técnica.

**Core Value:** Profissional do beleza consegue agendar, atender, cobrar e comunicar com cliente em um único fluxo — sem sair da plataforma.

### Constraints

- **Stack**: Node.js 20 LTS + NestJS 10 + GraphQL (Apollo) + Prisma 5 + PostgreSQL 16 + Redis 7 — já decidido nos PRDs
- **Frontend**: React 18 + TypeScript + Vite 5 + Apollo Client 3 + Tailwind CSS 3 + shadcn/ui — já decidido
- **Multi-tenancy**: Row-Level Security no PostgreSQL — abordagem definida, não negociável
- **Compliance**: LGPD, WCAG 2.1 AA, OWASP — obrigatórios
- **Scalabilidade**: 250 orgs Ano 1 → 1000 orgs Ano 3
- **Testes**: 80% cobertura unitária no domínio, E2E para fluxos críticos, bloqueio de PR em falha
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Validation of Decided Stack
### Backend
#### Node.js 20 LTS — VALID, but flag Node 22 LTS
#### NestJS 10 — VALID, watch NestJS 11
#### GraphQL via Apollo Server (Schema-first SDL) — VALID
- SDL is the contract, reviewable in PRs without understanding TypeScript decorators.
- Persisted queries (documented in PRD backend section 4.2) require stable, pre-known queries — schema-first makes this operationally cleaner.
- The DataLoader pattern (section 4.5.2) is well-supported regardless of schema approach.
#### Prisma 5 — VALID, but Prisma 6 is current
- Omit fields feature (useful for hiding sensitive columns without custom middleware)
- Updated migrations engine with parallel migration application
- Improved TypeScript inference
- Native PostgreSQL JSON operations
#### PostgreSQL 16 — VALID
#### Redis 7 — VALID
#### BullMQ — VALID
#### CASL — VALID
#### Zod (for validation) — VALID, but version not specified
#### Missing Backend Libraries
| Library | Purpose | Why Needed |
|---------|---------|------------|
| `graphql-scalars` | Custom GraphQL scalars (UUID, DateTime, Money, JSONB) | PRD defines custom scalars; this library provides battle-tested implementations |
| `@bull-board/nestjs` | BullMQ admin UI | PRD section 7.4 requires dead-letter queue dashboard |
| `argon2` | Password hashing | SDD section 8.1 mandates Argon2id; needs explicit library |
| `otplib` | TOTP implementation | Backend PRD section 5.1.4 — TOTP setup/verify |
| `pino` / `nestjs-pino` | Structured JSON logging | PRD section 10.1 mandates JSON logs; NestJS default logger is not JSON |
| `@opentelemetry/node` | Distributed tracing | PRD section 10.3 mandates OpenTelemetry tracing |
| `circuit-breaker-js` or `opossum` | Circuit breaker pattern | PRD section 9.8 mandates circuit breakers on all external calls |
| `@nestjs/config` + Zod | Env validation | PRD section 11.2 shows Zod-based env schema |
| `@graphql-codegen/cli` | Type generation | PRD frontend section 6.1 — types must be generated from schema |
| `dataloader` | N+1 prevention | PRD backend section 4.5.2 — DataLoaders per request |
### Frontend
#### React 18 — VALID, but React 19 is current
- Actions API (replaces manual `useTransition` + state for form mutations)
- `use()` hook for promises and context
- Server Components support (not relevant for this SPA)
- Improved `<form>` integration
#### TypeScript — Not versioned in the decided stack
#### Vite 5 — VALID, but Vite 6 is current
#### Apollo Client 3 — VALID, watch Apollo Client 4
#### Zustand 4 — VALID
#### Tailwind CSS 3 — VALID, but Tailwind CSS v4 is current
#### shadcn/ui — VALID
- Full control over component code — important for LGPD-compliant form patterns
- Radix UI primitives underneath — correct accessibility primitives for WCAG 2.1 AA requirement
- No npm package to pin versions — components live in the repo
#### React Router 6 — VALID, but React Router 7 is current
#### Recharts — VALID
#### React Hook Form 7 + Zod — VALID
#### date-fns + date-fns-tz — VALID
#### Missing Frontend Libraries
| Library | Purpose | Why Needed |
|---------|---------|------------|
| `@graphql-codegen/cli` | Generates TypeScript types from schema | PRD Frontend section 6.1 — mandatory |
| `graphql-ws` | WebSocket transport for Apollo subscriptions | PRD Frontend section 6.2.3 uses subscriptions; replaces deprecated `subscriptions-transport-ws` |
| `react-i18next` | i18n | PRD Frontend section 12 — fully specified |
| `i18next` | Base i18n library | Required by react-i18next |
| `clsx` + `tailwind-merge` | Conditional class composition | PRD Frontend section 13.3 explicitly lists `clsx`; `tailwind-merge` prevents class conflicts |
| `class-variance-authority` (cva) | Component variants | PRD Frontend section 13.3 explicitly lists `cva` |
| `lucide-react` | Icons | PRD Frontend section 1.4 explicitly lists it |
| `react-virtual` or `@tanstack/react-virtual` | List virtualization | PRD Frontend section 10.2.3 — required for >500 item lists |
| `workbox-webpack-plugin` / Vite plugin | PWA/Service Worker | PRD Frontend section 10.2.4, SDD section 5.1 lists Workbox |
| `@radix-ui/*` | Underlying primitives for shadcn/ui | Indirect dependency, but important to understand |
| `immer` | Immutable state updates in Zustand | PRD Frontend section 5.3 references Immer via Zustand |
| `@sentry/react` | Frontend error tracking | SDD section 5.4; Sentry in the decided infra stack |
| `react-hook-form` + `@hookform/resolvers` | Form library (resolvers package) | PRD Frontend section 8 — needs the resolvers package |
| `axios` or native `fetch` | Non-GraphQL HTTP calls | ViaCEP integration (PRD section 8.5), webhook endpoints |
### External Integrations
#### WhatsApp Cloud API (Meta) — VALID, HIGH PRIORITY
- **Business Verification required:** Meta requires Business Manager verification before getting access to high volume messaging. This takes 1-4 weeks and blocks WhatsApp features entirely. Flag for early initiation.
- **Template approval:** Each message template requires Meta review (typically 24-72 hours). The PRD's reminder and confirmation templates (SDD section 9.1) need to be submitted before Phase 3 launch.
- **Pricing model changed:** Meta shifted to conversation-based pricing in 2023. Template messages (BSP-initiated) cost per 24h conversation window, not per message. For 250 orgs with 30 clients each receiving daily reminders, this is a meaningful cost to model.
- **LGPD + WhatsApp:** Client consent for WhatsApp communications must be explicit and logged. The PRD's architecture needs a consent field on `clients` and audit trail for consent.
- **Phone number format:** Must be E.164 (`+5511999999999`). The PRD Frontend section 8.5 correctly handles this normalization.
#### Pagar.me vs Stripe Connect — DECISION PENDING, recommendation follows
- Native Brazilian gateway. PIX support is first-class.
- BRL-native settlement — no currency conversion complexity.
- Boleto support (relevant if you later target B2B clients who pay suppliers by boleto).
- Split payments (marketplace model) supported via Pagar.me Marketplace API.
- Documentation is in Portuguese.
- Known pain points: API versioning has been inconsistent historically; SDK quality is uneven.
- Better for "Brazilian-only, simpler" use case.
- Best-in-class documentation and SDK.
- PIX is supported (Stripe added PIX in 2022).
- `Stripe Connect` (the marketplace model the PRD requires for splitting between platform and salon) is mature and battle-tested.
- Settlement in BRL requires Stripe Brazil entity — available but requires local company registration or entity.
- Higher baseline fees than Brazilian-native processors.
- Multi-currency support useful for future expansion.
- Better for "future-proofed, international expansion" use case.
#### Anthropic Claude API — VALID
- Bridal schedule optimization (structured reasoning over durations and constraints)
- Financial summary generation (text generation from structured data)
- WhatsApp template generation
- Cache responses for identical prompts (PRD section 9.6 — up to 24h)
- Per-plan usage limits (requires tracking token consumption per organization)
- The `anthropic` npm SDK is the correct library
#### Resend — VALID
#### S3 / Cloudflare R2 — VALID, lean toward R2
- Zero egress fees (unlike AWS S3 which charges per GB out)
- S3-compatible API — same `@aws-sdk/client-s3` SDK works
- No request costs for most operations
- CDN integration via Cloudflare Workers if you add image optimization later
- Brazil is in Cloudflare's Tier 1 CDN coverage
#### Focus NFe / eNotas — OUT OF SCOPE for MVP
#### SMS Backup: Twilio vs Zenvia
- Native Brazilian provider with local numbers and better carrier relationships
- ANATEL-compliant for Brazilian SMS regulations
- Better delivery rates for Brazilian carriers (Vivo, TIM, Claro, OI)
- Lower cost than Twilio for Brazilian numbers
### Infrastructure
#### Docker + Docker Compose — VALID
#### GitHub Actions — VALID
#### Sentry — VALID
#### Grafana — VALID, specify the stack
- **Grafana Cloud** (or self-hosted Grafana) for dashboards
- **Prometheus** for metrics scraping from the `/metrics` endpoint
- **Grafana Loki** for log aggregation (collects JSON logs from Docker)
- **Grafana Tempo** for distributed tracing (OpenTelemetry backend — PRD section 10.3)
#### Missing Infrastructure Components
| Component | Purpose | Why Needed |
|-----------|---------|------------|
| PgBouncer | Connection pooling (transaction mode) | DB PRD section 7.2 — "obrigatório". Required for RLS + multi-instance safety |
| Meilisearch | Full-text search | SDD section 5.3 — client/appointment search. Not in decided stack. |
| ClickHouse | Analytics warehouse | SDD section 5.3, DB PRD section 7.6 — Fase 4, but worth noting |
| Unleash | Feature flags | PRD Backend section 11.4 — feature flags per org/plan |
| Workbox | PWA service worker | SDD section 5.1, Frontend PRD section 10.2.4 |
| k6 | Load/performance testing | SDD section 3.5 — performance SLA validation |
| Playwright | E2E testing | SDD section 3.4, Frontend PRD — listed in PRDs but not in decided stack |
| pgBackRest or wal-g | WAL archiving for PITR | DB PRD section 10.1 — 5-minute RPO requires WAL archiving |
| Patroni | PostgreSQL HA failover | DB PRD section 7.3 — at 200+ orgs. Note: complex, can defer |
| Storybook | Component documentation | Frontend PRD section 4.5 — design system documentation |
| Terraform | Infrastructure as code | SDD section 5.5 — listed but not in decided stack |
## LGPD-Specific Concerns
## Pix-Specific Concerns
## WhatsApp-Specific Concerns
## Gaps / Recommendations
### Critical Gaps (must address before coding starts)
| Gap | Action |
|-----|--------|
| PgBouncer not in decided stack | Add to infrastructure. Required for transaction-mode pooling + RLS safety |
| RLS session variable injection pattern | Decide on Prisma middleware pattern before any data access code. Write a reference implementation in Phase 1 |
| WhatsApp WABA registration | Start Meta business verification immediately — takes weeks |
| `clients` table missing LGPD consent columns | Add `whatsapp_consent_at`, `whatsapp_consent_channel` to DB schema |
| Password hashing library (`argon2`) not listed | Add to backend dependencies |
| TOTP library (`otplib`) not listed | Add to backend dependencies |
| Structured logging library (`nestjs-pino`) not listed | Add; NestJS default logger does not produce JSON |
| `graphql-scalars` not listed | Required for custom GraphQL scalar types in PRD schema |
### Version Upgrades Recommended
| Component | Current | Recommended | Priority |
|-----------|---------|-------------|----------|
| Node.js | 20 LTS | 22 LTS | High — Node 20 enters Maintenance in Apr 2026 |
| React | 18 | 19 | High — ecosystem moving to 19 |
| Vite | 5 | 6 | Medium — greenfield, no migration cost |
| Prisma | 5 | 6 | Medium — better features for greenfield |
| Tailwind CSS | 3 | 4 (if shadcn/ui compatible) | Low — verify compatibility first |
| Redis | 7.x (any) | 7.2.x or Valkey 7.2 | Low — licensing concern only |
### Architecture-Level Additions
| Addition | Rationale |
|----------|-----------|
| Meilisearch | SDD lists it; not in decided stack; required for client search UX |
| Unleash | Feature flags per org/plan — needed for phased rollout strategy |
| pgBackRest | WAL archiving for 5-minute RPO — required for SLA |
| k6 | Performance testing tool — SDD mandates performance SLAs |
| Storybook | Design system documentation — Frontend PRD mandates it |
| `@graphql-codegen/cli` | Type generation — Frontend PRD section 6.1 — mandatory workflow |
## Confidence Levels
| Component | Confidence | Notes |
|-----------|------------|-------|
| NestJS 10 | HIGH | Battle-tested; NestJS 11 timing unconfirmed |
| Node.js 20 | MEDIUM | Recommend Node 22 LTS; release schedule well-known |
| GraphQL / Apollo Server | HIGH | No concerns; architecture is sound |
| Prisma 5 | MEDIUM | Prisma 6 released Nov 2024; greenfield should start there |
| PostgreSQL 16 | HIGH | Production-proven; PG 17 is an option |
| Redis 7 | MEDIUM | Licensing change concern; Valkey as alternative |
| BullMQ | HIGH | Correct choice; well-maintained |
| CASL | HIGH | Correct choice for RBAC pattern |
| React 18 | MEDIUM | React 19 is current; recommend upgrade for greenfield |
| Vite 5 | MEDIUM | Vite 6 is current; no migration cost at greenfield |
| Apollo Client 3 | HIGH | Stable; AC4 timeline unknown |
| Zustand 4 | HIGH | No concerns |
| Tailwind CSS 3 | LOW | Tailwind v4 + shadcn/ui compatibility uncertain |
| shadcn/ui | HIGH | Correct choice; verify Tailwind v4 compatibility |
| React Router 6 | MEDIUM | RR7 is current; breaking changes require evaluation |
| Recharts | HIGH | Appropriate for the financial chart use cases |
| React Hook Form 7 + Zod | HIGH | Current stable, correct pattern |
| date-fns | HIGH | v3 is current; Brazilian locale well-supported |
| WhatsApp Cloud API | HIGH | Correct choice; business verification lag is the real risk |
| Pagar.me | MEDIUM | Recommended for BR market; verify current API docs |
| Stripe Connect | MEDIUM | Valid alternative; stronger for future expansion |
| Anthropic Claude API | HIGH | Correct choice for the use cases described |
| Resend | HIGH | Modern standard; appropriate for this use case |
| Cloudflare R2 | HIGH | Better economics than S3 for this workload |
| Docker/GitHub Actions | HIGH | No concerns |
| Sentry | HIGH | No concerns |
| Grafana Cloud | HIGH | Free tier sufficient for Year 1 scale |
| PgBouncer (missing) | HIGH | Critical gap; must be added |
| Meilisearch (missing) | HIGH | In SDD but not in decided stack |
| pgBackRest (missing) | HIGH | Required for 5-minute RPO SLA |
## Summary
- **The decided stack is fundamentally sound** for a 2025/2026 Brazilian SaaS. Technology choices are coherent, well-justified in the PRDs, and the architecture (Clean Architecture + Modular Monolith + RLS) is appropriate for the scale targets (1000 orgs by Year 3).
- **Version drift is the primary concern.** Node 20, React 18, Vite 5, and Prisma 5 were excellent choices 18 months ago, but for a greenfield project starting now, their successors (Node 22, React 19, Vite 6, Prisma 6) are stable and add value. Starting on older versions creates upgrade debt in year 1.
- **Three critical omissions from the decided stack:** PgBouncer (architecturally required for RLS correctness), Meilisearch (in the SDD but missing from the decided stack), and pgBackRest/wal-g (required for the 5-minute RPO SLA). These are not optional additions.
- **Brazilian market specifics require early action on two fronts:** WhatsApp WABA business verification must start immediately (multi-week process outside engineering control), and LGPD consent tracking needs a column addition to the `clients` table before Phase 3 communication features.
- **Pix is non-negotiable.** It is the primary payment method. Pagar.me is the recommended gateway for MVP (better Pix DX, Brazilian-native), but the architecture must abstract the gateway cleanly so Stripe Connect can be added for future expansion without a rewrite — which the PRD's adapter pattern already does correctly.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
