# Stack Research: SGS Beauty Salon SaaS

**Project:** SGS — Plataforma de Gestão para Salões de Beleza
**Researched:** 2026-05-02
**Research mode:** Validation of decided stack against 2025 best practices
**Web access:** Unavailable — analysis based on training data (cutoff Aug 2025) + PRD documents

---

## Validation of Decided Stack

### Backend

#### Node.js 20 LTS — VALID, but flag Node 22 LTS

Node.js 20 LTS (Codename "Iron") entered Active LTS in October 2023, with Maintenance LTS through April 2026. As of May 2026, Node.js 20 is in late Maintenance phase and **Node.js 22 LTS** ("Jod") became the Active LTS line in October 2024, with support through April 2027. For a greenfield project starting now, **Node 22 LTS is the more defensible choice**: it is the current active LTS, ships with native ESM improvements, faster V8, and native `--env-file` support. Node 20 is not broken — it runs fine — but starting on an LTS that is entering Maintenance in a few months creates unnecessary upgrade pressure in year 1.

**Verdict:** Upgrade to Node 22 LTS. Low migration cost for a greenfield start.
**Confidence:** MEDIUM (based on Node.js release schedule known at training cutoff; verify at https://nodejs.org/en/about/previous-releases)

---

#### NestJS 10 — VALID, watch NestJS 11

NestJS 10 was released in February 2023 and remains the broadly-adopted production version. NestJS 11 was announced in late 2024 with breaking changes in how application bootstrapping works and updated dependency minimums (requires Node 18.18+ minimum, ships with Fastify 5 compatibility). For a greenfield start in 2025/2026, NestJS 10 is stable and well-understood. The ecosystem (plugins, community modules) is mature on v10.

However, if starting from scratch: check whether NestJS 11 has a stable release. If it does (likely by mid-2025), prefer v11 to avoid a major upgrade mid-project. The PRD correctly documents Apollo Server compatibility — NestJS 11 maintains `@nestjs/graphql` compatibility.

**Decision:** Start on the latest stable NestJS. If NestJS 11 is stable at project start, use it. If not, NestJS 10 is solid.
**Confidence:** MEDIUM — NestJS 11 release timeline was ongoing at training cutoff.

---

#### GraphQL via Apollo Server (Schema-first SDL) — VALID

Apollo Server 4 is the current major version and the integration `@nestjs/graphql` with `apollo-server-express` (or the standalone adapter) is the standard NestJS pattern. The PRD's decision to go **schema-first (SDL) over code-first** is the correct choice for this project. Rationale:

- SDL is the contract, reviewable in PRs without understanding TypeScript decorators.
- Persisted queries (documented in PRD backend section 4.2) require stable, pre-known queries — schema-first makes this operationally cleaner.
- The DataLoader pattern (section 4.5.2) is well-supported regardless of schema approach.

The `@nestjs/graphql` package with `ApolloDriver` is the correct NestJS integration. `graphql-scalars` library fills the gap for custom scalars (UUID, DateTime, Money, JSONB) referenced in the PRD schema.

**Missing library flagged:** `graphql-scalars` — needed for the custom scalar types (`UUID`, `DateTime`, `Money`) defined in the PRD schema section 4.3. Not listed in the decided stack.

**Confidence:** HIGH

---

#### Prisma 5 — VALID, but Prisma 6 is current

Prisma 5 introduced significant performance improvements (accelerated engine, connection pooling via Prisma Accelerate). However, **Prisma 6** was released in November 2024 with further improvements:

- Omit fields feature (useful for hiding sensitive columns without custom middleware)
- Updated migrations engine with parallel migration application
- Improved TypeScript inference
- Native PostgreSQL JSON operations

For a greenfield start in 2026, **Prisma 6 is the version to start with.** Migrating from Prisma 5 to 6 has breaking changes primarily around `jsonProtocol` (now the only protocol) and some deprecated result extension APIs.

**Critical gap — RLS implementation with Prisma:** The PRD relies on `SET LOCAL app.current_organization` per connection to activate RLS. Prisma does not natively support per-query session variable injection. This is a known friction point. The standard pattern is:

1. Use `$executeRaw` or a middleware to set the session variable before each transaction.
2. Use Prisma's `$extends` to wrap every operation with a transaction that first sets the session variable.
3. Use PgBouncer in **transaction pooling mode** (already documented in the PRD's DB section 7.2) — critical because session variables do NOT persist across requests in transaction mode, which is exactly what you want.

The PRD documents the middleware approach correctly (section 2.2.2 of the DB PRD and section 5.2 of the Backend PRD). This is implementable but requires careful discipline. Flag for Phase 1 as the first critical implementation challenge.

**Confidence:** MEDIUM-HIGH (Prisma 6 release timeline verified at training cutoff)

---

#### PostgreSQL 16 — VALID

PostgreSQL 16 is stable and production-proven. PostgreSQL 17 is available (released September 2024) with native UUIDv7 generation (`gen_random_uuid()` already existed but v7 is now built-in), improved VACUUM performance, and better logical replication. The PRD's DB section 12.1 already acknowledges this: "using UUIDv7 via custom function until PG 17, migrate to native afterwards."

**Verdict:** PostgreSQL 16 is safe. Starting on PostgreSQL 17 is also viable and eliminates the UUIDv7 custom function workaround. If the hosting provider (Hostinger VPS) supports PG 17, prefer it. If not, PG 16 is production-ready with no blocking concerns.

**Confidence:** HIGH

---

#### Redis 7 — VALID

Redis 7.x (currently 7.2.x) is the production standard. Redis 7.0 introduced Redis Functions (replacing Lua scripts for complex atomic operations), improved ACL support, and AOF format improvements. BullMQ works well on Redis 7.

One concern: **Redis licensing changed in 2024.** Redis Ltd. changed the Redis Server license to RSALv2/SSPL (no longer MIT/BSD), affecting Redis 7.4+. For self-hosted production use, this is not a legal barrier, but it matters for commercial SaaS. The open-source fork **Valkey** (Linux Foundation) is binary-compatible with Redis 7.2. For a production SaaS targeting growth, evaluate Valkey as the BullMQ-compatible drop-in replacement.

**Recommendation:** Redis 7.2.x (last MIT-licensed series) OR Valkey 7.2+ for long-term licensing safety. BullMQ is explicitly compatible with both.
**Confidence:** MEDIUM (licensing situation was evolving at training cutoff)

---

#### BullMQ — VALID

BullMQ (v4/v5) is the correct choice for this use case. The PRD's queue architecture (section 7.2) with 8 named queues, dead-letter queues, and exponential backoff is precisely what BullMQ supports natively. The SDD decision note (section 13.4) correctly identifies Temporal as an overkill alternative.

**Gap:** BullMQ Board (the open-source UI formerly at `bull-board`) or **Bull Monitor** should be included as a development/ops dependency for the admin dead-letter dashboard referenced in PRD section 7.4. The library `@bull-board/api` + `@bull-board/nestjs` is the standard NestJS integration.

**Confidence:** HIGH

---

#### CASL — VALID

CASL v6 is the current version and the `@casl/ability` package with NestJS guards is the standard RBAC-meets-ABAC pattern. The PRD's double-validation pattern (decorator on resolver + CASL policy on entity, section 5.3.2) is a well-established pattern and CASL v6 supports it cleanly with `subject()` helpers.

**Confidence:** HIGH

---

#### Zod (for validation) — VALID, but version not specified

The PRD mentions Zod throughout (env validation, form validation, input validation). Zod v3 is the current stable version and the correct choice. **Zod v4** was in beta at training cutoff with significant performance improvements. For greenfield, start with Zod v3 stable, monitor v4 for migration.

**Confidence:** HIGH (Zod v3)

---

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

---

### Frontend

#### React 18 — VALID, but React 19 is current

React 19 was released in December 2024 as the stable major version. Key changes from React 18 to 19:

- Actions API (replaces manual `useTransition` + state for form mutations)
- `use()` hook for promises and context
- Server Components support (not relevant for this SPA)
- Improved `<form>` integration

For a greenfield SPA project starting in 2025/2026, **React 19 is the correct starting point.** The Apollo Client compatibility question is worth checking — Apollo Client 3.9+ added React 19 support. React 18 is not broken, but the ecosystem (shadcn/ui v2, React Hook Form v8, etc.) is moving to React 19.

**Verdict:** Upgrade to React 19. Starting on React 18 for a greenfield project adds debt.
**Confidence:** MEDIUM (React 19 stable release confirmed at training cutoff; ecosystem compatibility requires verification)

---

#### TypeScript — Not versioned in the decided stack

TypeScript 5.x is the current series (5.4+ at training cutoff). For this project, TypeScript 5.3+ is the minimum recommended to access `import attributes`, improved type inference, and `const` type parameters. The PRDs mandate strict mode throughout, which is compatible with all TS 5.x versions.

**Recommendation:** TypeScript 5.4+ with `strict: true`, `noUncheckedIndexedAccess: true` (extra safety for array indexing).

---

#### Vite 5 — VALID, but Vite 6 is current

Vite 5 (released November 2023) remains widely used. **Vite 6** was released in November 2024 with the Environment API, improved HMR, and better compatibility with Rolldown (the Rust-based bundler). For a greenfield start, Vite 6 is the current version and should be the default choice.

**Verdict:** Use Vite 6. No migration friction for a new project.
**Confidence:** MEDIUM

---

#### Apollo Client 3 — VALID, watch Apollo Client 4

Apollo Client 3.8+ is the production stable series. Apollo Client 3 added `useBackgroundQuery`, `useLoadableQuery`, and improved cache policies. The PRD's usage pattern (section 6.1–6.3 of Frontend PRD) is compatible with Apollo Client 3.

**Apollo Client 4** was in development at training cutoff. If not yet stable, Apollo Client 3.9+ is the correct choice. The PRD's configuration (`errorLink`, `persistedQueryLink`, `retryLink`, `authLink` chain) is compatible with AC3.

**Confidence:** HIGH (AC3), MEDIUM (AC4 timeline)

---

#### Zustand 4 — VALID

Zustand 4 is stable and the correct choice. The usage pattern in the PRD (section 5.3 of Frontend PRD — three stores: auth, ui, notifications) is straightforward and well-supported. No breaking changes expected from Zustand 5 that would affect this pattern.

**Confidence:** HIGH

---

#### Tailwind CSS 3 — VALID, but Tailwind CSS v4 is current

**Tailwind CSS v4** was released in January 2025 with a complete architecture rewrite: CSS-first configuration (no more `tailwind.config.js`), built on Lightning CSS, faster build times, and new features like `@starting-style` and container queries without plugins. The ecosystem catch-up (shadcn/ui, class-variance-authority) was underway at training cutoff.

**Risk:** shadcn/ui compatibility with Tailwind v4 was in transition at training cutoff. shadcn/ui v2+ was being redesigned around Tailwind v4. If shadcn/ui has full Tailwind v4 support now, prefer Tailwind v4. If not, Tailwind CSS 3 + shadcn/ui stable is the safer combination.

**Verdict:** Check shadcn/ui compatibility. If Tailwind v4 + shadcn/ui v2 is stable, use it. Otherwise, Tailwind v3 + shadcn/ui v1 is the safer production choice.
**Confidence:** LOW (Tailwind v4 + shadcn/ui compatibility was unresolved at training cutoff)

---

#### shadcn/ui — VALID

shadcn/ui (code-in-project, not a package) is the correct choice for this product. The PRD's component list (section 4.3 of Frontend PRD) maps directly to the shadcn/ui component set. Key reasons for this project:

- Full control over component code — important for LGPD-compliant form patterns
- Radix UI primitives underneath — correct accessibility primitives for WCAG 2.1 AA requirement
- No npm package to pin versions — components live in the repo

**Note:** shadcn/ui requires a CLI installation process (`npx shadcn-ui@latest init`). Components should be committed, not treated as dependencies.

**Confidence:** HIGH

---

#### React Router 6 — VALID, but React Router 7 is current

**React Router v7** was released in November 2024, merging the Remix framework and React Router into one. For a pure SPA use case (the PRD explicitly avoids SSR for the MVP), React Router v7 in "SPA mode" works similarly to v6. The routing patterns in the PRD (section 7 of Frontend PRD — nested routes, lazy loading, protected routes) map to React Router v7.

However, React Router v7 introduces breaking changes (new file-based routing option, loader/action patterns from Remix). For a team that knows RR6, the upgrade has friction. RR6 is still maintained.

**Verdict:** React Router v7 for greenfield. The SPA mode is explicitly supported and the new patterns (loaders, actions) align well with the PRD's architecture. If the team is not ready for v7 patterns, RR6 is acceptable.
**Confidence:** MEDIUM

---

#### Recharts — VALID

Recharts 2.x is stable and appropriate for the financial dashboard use cases in the PRD (line charts, bar charts in `finance/reports`). The PRD correctly notes dynamic import for Recharts to avoid adding to the initial bundle.

**Confidence:** HIGH

---

#### React Hook Form 7 + Zod — VALID

RHF v7 with `@hookform/resolvers` and `zodResolver` is the current standard. The PRD's form pattern (section 8 of Frontend PRD) is exactly the recommended RHF + Zod pattern.

**Confidence:** HIGH

---

#### date-fns + date-fns-tz — VALID

date-fns v3 (released 2023) is the current major version. The PRD's usage of `date-fns` with locale support and `date-fns-tz` for timezone handling is correct. Brazilian timezone `America/Sao_Paulo` is well-supported. Daylight saving time in Brazil was abolished in 2019, simplifying timezone handling.

**Confidence:** HIGH

---

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

---

### External Integrations

#### WhatsApp Cloud API (Meta) — VALID, HIGH PRIORITY

The SDD section 9.1 correctly chooses the official Meta Cloud API over unofficial providers (Z-API, BotConversa, Evolution API). This is the right call for a production SaaS. Key implementation notes:

- **Business Verification required:** Meta requires Business Manager verification before getting access to high volume messaging. This takes 1-4 weeks and blocks WhatsApp features entirely. Flag for early initiation.
- **Template approval:** Each message template requires Meta review (typically 24-72 hours). The PRD's reminder and confirmation templates (SDD section 9.1) need to be submitted before Phase 3 launch.
- **Pricing model changed:** Meta shifted to conversation-based pricing in 2023. Template messages (BSP-initiated) cost per 24h conversation window, not per message. For 250 orgs with 30 clients each receiving daily reminders, this is a meaningful cost to model.
- **LGPD + WhatsApp:** Client consent for WhatsApp communications must be explicit and logged. The PRD's architecture needs a consent field on `clients` and audit trail for consent.
- **Phone number format:** Must be E.164 (`+5511999999999`). The PRD Frontend section 8.5 correctly handles this normalization.

**Missing:** The decided stack does not list a WhatsApp Cloud API client library. The official `whatsapp-cloud-api-js` or `@green-api/whatsapp-api-client` are options. Given the adapter pattern in the PRD, a thin custom wrapper is likely better than a heavy SDK.

---

#### Pagar.me vs Stripe Connect — DECISION PENDING, recommendation follows

This is the most consequential Brazilian-market decision. Analysis:

**Pagar.me (Stone company):**
- Native Brazilian gateway. PIX support is first-class.
- BRL-native settlement — no currency conversion complexity.
- Boleto support (relevant if you later target B2B clients who pay suppliers by boleto).
- Split payments (marketplace model) supported via Pagar.me Marketplace API.
- Documentation is in Portuguese.
- Known pain points: API versioning has been inconsistent historically; SDK quality is uneven.
- Better for "Brazilian-only, simpler" use case.

**Stripe Connect:**
- Best-in-class documentation and SDK.
- PIX is supported (Stripe added PIX in 2022).
- `Stripe Connect` (the marketplace model the PRD requires for splitting between platform and salon) is mature and battle-tested.
- Settlement in BRL requires Stripe Brazil entity — available but requires local company registration or entity.
- Higher baseline fees than Brazilian-native processors.
- Multi-currency support useful for future expansion.
- Better for "future-proofed, international expansion" use case.

**Recommendation for this project:** **Pagar.me** for MVP. Rationale:
1. PIX is the primary payment method for Brazilian consumers; Pagar.me's PIX implementation is mature and has lower latency.
2. Marketplace split (platform fee + salon payout) via Pagar.me Marketplace avoids Stripe's compliance overhead for Brazilian entities.
3. Target market is purely Brazilian for years 1-3 (per SDD).
4. Pagar.me is owned by Stone, which has strong compliance with Brazilian financial regulation (BACEN, CMN).

Revisit Stripe if the platform expands to other Latin American countries.

**Confidence:** MEDIUM (business/pricing details may have changed)

---

#### Anthropic Claude API — VALID

The Claude API (claude-3-5-sonnet / claude-3-haiku) is the correct choice for the PRD's AI use cases:
- Bridal schedule optimization (structured reasoning over durations and constraints)
- Financial summary generation (text generation from structured data)
- WhatsApp template generation

Key implementation notes from the PRD:
- Cache responses for identical prompts (PRD section 9.6 — up to 24h)
- Per-plan usage limits (requires tracking token consumption per organization)
- The `anthropic` npm SDK is the correct library

**Missing from decided stack:** The `anthropic` npm package should be listed explicitly.

**Confidence:** HIGH

---

#### Resend — VALID

Resend is the modern standard for transactional email in Node.js, positioned as the developer-friendly alternative to SendGrid/Mailgun. The `resend` npm package with React Email templates is the common pattern. For Brazilian LGPD compliance, SPF/DKIM/DMARC configuration is required (PRD section 9.5 acknowledges this).

**Confidence:** HIGH

---

#### S3 / Cloudflare R2 — VALID, lean toward R2

**Cloudflare R2** is the better choice for this project:
- Zero egress fees (unlike AWS S3 which charges per GB out)
- S3-compatible API — same `@aws-sdk/client-s3` SDK works
- No request costs for most operations
- CDN integration via Cloudflare Workers if you add image optimization later
- Brazil is in Cloudflare's Tier 1 CDN coverage

The PRD stores anamnesis files, photos, and contract PDFs — moderate volume but accessed on each client visit. R2 egress savings are meaningful over time.

**Recommendation:** Cloudflare R2 with the S3-compatible SDK. Use `@aws-sdk/client-s3` with R2 endpoint — no code changes if you ever need to switch to S3.

**Confidence:** HIGH

---

#### Focus NFe / eNotas — OUT OF SCOPE for MVP

Correctly scoped to Phase 4 (SDD section 9.3, 11.4). Both are valid Brazilian NFe providers. Defer the comparison to when Phase 4 approaches.

---

#### SMS Backup: Twilio vs Zenvia

**Zenvia** is the better choice for Brazil:
- Native Brazilian provider with local numbers and better carrier relationships
- ANATEL-compliant for Brazilian SMS regulations
- Better delivery rates for Brazilian carriers (Vivo, TIM, Claro, OI)
- Lower cost than Twilio for Brazilian numbers

Twilio has better global coverage but higher cost and slightly worse delivery for Brazilian numbers in practice.

**Recommendation:** Zenvia as the SMS backup provider.
**Confidence:** MEDIUM

---

### Infrastructure

#### Docker + Docker Compose — VALID

Correct for the VPS-first strategy (SDD section 10.1 — Hostinger VPS, Docker Compose). The PRD's migration path to Kubernetes at 200 organizations is a sound decision. Docker Compose for local development and initial production is straightforward.

**Gap:** The decided stack does not list **PgBouncer** — which the DB PRD section 7.2 marks as "obrigatório" (mandatory). PgBouncer in transaction pooling mode is architecturally required for the RLS session variable approach to work safely. This must be in the infrastructure stack from day one.

**Confidence:** HIGH

---

#### GitHub Actions — VALID

GitHub Actions is the correct choice for CI/CD. The SDD pipeline (section 10.2) is implementable entirely with GitHub Actions. No concerns.

**Confidence:** HIGH

---

#### Sentry — VALID

Sentry for error tracking is the standard. Both `@sentry/node` (backend) and `@sentry/react` (frontend) are needed. The PRD's correlation ID propagation (section 10.6) requires configuring Sentry with custom context.

**Confidence:** HIGH

---

#### Grafana — VALID, specify the stack

"Grafana" in the decided stack is underspecified. The full observability stack from the PRD:

- **Grafana Cloud** (or self-hosted Grafana) for dashboards
- **Prometheus** for metrics scraping from the `/metrics` endpoint
- **Grafana Loki** for log aggregation (collects JSON logs from Docker)
- **Grafana Tempo** for distributed tracing (OpenTelemetry backend — PRD section 10.3)

For the VPS-first deployment, **Grafana Cloud free tier** covers the initial scale (250 orgs Year 1). Self-hosted is more complex than the value it adds at this stage.

**Recommendation:** Grafana Cloud (free tier initially) with Prometheus remote write from the VPS, Loki for logs, Tempo for traces. This avoids self-hosting Prometheus and Grafana alongside the application.

**Confidence:** HIGH

---

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

---

## LGPD-Specific Concerns

LGPD (Lei Geral de Proteção de Dados) compliance is mandatory from launch (SDD section 8.4). Stack implications:

1. **Encryption at rest for anamneses:** The DB PRD specifies `encrypted_data BYTEA` column in `anamneses`. The encryption library must be decided: `pgcrypto` at the database level, or application-level encryption with a KMS. Recommendation: application-level with AWS KMS or Cloudflare Workers KV as the key store — gives better audit trail and key rotation capability without database overhead.

2. **Data retention automation:** The PRD's 5-year retention + anonymization on LGPD request requires a job. Not a library choice, but an implementation requirement from day one.

3. **Consent tracking:** The `clients` table in the DB PRD does not include a `consent_given_at` or `consent_channel` column. This is a gap. Brazilian WhatsApp messaging requires documented opt-in consent per LGPD Article 7.

4. **Log sanitization:** The PRD backend section 10.1.3 documents field sanitization (CPF, CNPJ, cardNumber). `pino-noir` or a custom Pino serializer handles this for structured logs.

---

## Pix-Specific Concerns

Pix is the primary payment method in Brazil (used by 70%+ of consumers). Implementation notes:

1. **Pix QR Code:** Both static (fixed amount) and dynamic (variable, with `txid`) are needed. Dynamic Pix QR is required for reconciliation (the `txid` links the payment notification to the order).

2. **Instant settlement:** Pix settles in seconds 24/7. Webhooks arrive within seconds of payment. The job queue (`payments` queue in BullMQ) must process Pix webhooks with high priority.

3. **Pagar.me vs Stripe for Pix:** Both support Pix, but Pagar.me has native Pix generation without additional configuration. Stripe requires specific product activation.

4. **No chargeback on Pix:** Unlike credit cards, Pix has no chargeback mechanism. Refunds are manual or via `Pix Devolução` API. Factor into the payment flow.

---

## WhatsApp-Specific Concerns

1. **Business Account registration:** Meta requires a WABA (WhatsApp Business Account) tied to a verified business. For a SaaS where each salon sends from the platform's number (shared sender), the platform registers one WABA. If each salon needs their own number, they each need their own WABA — significant UX friction for onboarding.

2. **Shared sender vs per-org number:** The PRD does not specify. For MVP, a shared platform number is simpler (one WABA, one number). For production, per-org numbers give better deliverability and allow salons to use their own business number.

3. **24-hour session window:** After a client responds, you have 24h to send free-form messages. After 24h (or if the client never responded), only approved templates work. The PRD's lembretes (reminders) are template messages. Confirming this in the message flow is important.

4. **Meta template category:** In 2023, Meta reorganized templates into Utility, Marketing, and Authentication. Appointment reminders are Utility (lower cost). Birthday/retorno campaigns are Marketing (higher cost, requires opt-in). Pricing impacts per-plan cost modeling.

---

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

---

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

---

## Summary

- **The decided stack is fundamentally sound** for a 2025/2026 Brazilian SaaS. Technology choices are coherent, well-justified in the PRDs, and the architecture (Clean Architecture + Modular Monolith + RLS) is appropriate for the scale targets (1000 orgs by Year 3).

- **Version drift is the primary concern.** Node 20, React 18, Vite 5, and Prisma 5 were excellent choices 18 months ago, but for a greenfield project starting now, their successors (Node 22, React 19, Vite 6, Prisma 6) are stable and add value. Starting on older versions creates upgrade debt in year 1.

- **Three critical omissions from the decided stack:** PgBouncer (architecturally required for RLS correctness), Meilisearch (in the SDD but missing from the decided stack), and pgBackRest/wal-g (required for the 5-minute RPO SLA). These are not optional additions.

- **Brazilian market specifics require early action on two fronts:** WhatsApp WABA business verification must start immediately (multi-week process outside engineering control), and LGPD consent tracking needs a column addition to the `clients` table before Phase 3 communication features.

- **Pix is non-negotiable.** It is the primary payment method. Pagar.me is the recommended gateway for MVP (better Pix DX, Brazilian-native), but the architecture must abstract the gateway cleanly so Stripe Connect can be added for future expansion without a rewrite — which the PRD's adapter pattern already does correctly.
