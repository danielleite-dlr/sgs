# Pitfalls Research: SGS Beauty Salon SaaS

**Domain:** Multi-tenant SaaS, Scheduling + POS + Financial + Automation
**Stack:** NestJS + GraphQL + Prisma + PostgreSQL 16 + RLS + BullMQ + WhatsApp
**Market:** Brazil — LGPD, Pix, WhatsApp-first
**Researched:** 2026-05-02
**Confidence:** HIGH (core PostgreSQL/Prisma/NestJS patterns), MEDIUM (Brazilian regulatory specifics — verify with official sources)

---

## Critical Pitfalls

---

### Category: Multi-Tenancy / Row-Level Security

#### Pitfall: RLS Bypass via Superuser or SECURITY DEFINER Functions

**Risk:** Any function declared `SECURITY DEFINER` in PostgreSQL runs with the privileges of the function owner (typically a superuser), completely bypassing RLS policies. If Prisma migrations or database functions are created this way, a bug in a query could silently return or mutate rows belonging to other tenants. This is the single most dangerous data isolation failure mode.

**Warning signs:**
- Database functions created during migrations have `SECURITY DEFINER` without explicit tenant filtering inside the function body
- Application connects as a DB role with `BYPASSRLS` attribute (e.g., the migration role is reused at runtime)
- Queries that run in background jobs, cron workers, or analytics reports use the same DB connection as application queries without explicitly setting `app.current_tenant_id`

**Prevention:**
- Maintain two separate DB roles: `sgs_migrator` (has `BYPASSRLS` + schema DDL rights) and `sgs_app` (no `BYPASSRLS`, RLS is enforced). Never use `sgs_migrator` at runtime.
- In every request lifecycle, execute `SET app.current_tenant_id = $1` before any query — wrap this in a NestJS middleware or interceptor that runs before the resolver chain.
- All Prisma `$executeRaw` and stored procedures must be reviewed for `SECURITY DEFINER`. Default to `SECURITY INVOKER`.
- Write automated tests that attempt cross-tenant queries and assert empty results — make this part of the CI pipeline.

**Phase to address:** Phase 1 / Core Infrastructure — must be in place before any tenant data is written.

---

#### Pitfall: Missing `SET LOCAL` in Transaction Scope

**Risk:** When using `SET app.current_tenant_id` within a transaction, using `SET` (session-level) instead of `SET LOCAL` (transaction-level) means the tenant context persists on the connection after the transaction commits, contaminating subsequent requests from the same connection pool slot. Under load, connection pool reuse causes requests from Tenant B to run under Tenant A's RLS context.

**Warning signs:**
- Intermittent cross-tenant data appearing in production logs but not reproducible in dev (low-pool dev environments mask it)
- Bug reports only appearing after traffic spikes (when pool connections are reused rapidly)

**Prevention:**
- Always use `SET LOCAL app.current_tenant_id = $1` inside a transaction block, never bare `SET`.
- In Prisma, wrap the tenant context set inside `$transaction`:
  ```typescript
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.current_tenant_id = ${tenantId}`;
    // all queries here are tenant-scoped
  });
  ```
- Add a connection pool "afterConnect" hook that resets `app.current_tenant_id` to an invalid value as a safety net.

**Phase to address:** Phase 1 / Core Infrastructure.

---

#### Pitfall: RLS Policies Not Covering All CRUD Operations

**Risk:** Developers write `SELECT` policies but forget `INSERT`, `UPDATE`, and `DELETE` policies. In PostgreSQL, if a permissive policy for `SELECT` exists but no `INSERT` policy exists, inserts are blocked by default (when `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` are set). However, the common mistake is enabling RLS but not forcing it, meaning table owners bypass all policies.

**Warning signs:**
- `ALTER TABLE t ENABLE ROW LEVEL SECURITY` without `ALTER TABLE t FORCE ROW LEVEL SECURITY` in migration scripts
- Only `SELECT` policies defined; `INSERT`/`UPDATE`/`DELETE` policies absent
- Tests only verify reads, not writes across tenants

**Prevention:**
- Always pair `ENABLE ROW LEVEL SECURITY` with `FORCE ROW LEVEL SECURITY` on every tenant-scoped table.
- Define explicit policies for all four operations. For `INSERT`, the `WITH CHECK` clause must enforce `organization_id = current_setting('app.current_tenant_id')::uuid`.
- Use a migration linting step (custom or via pgTAP) that asserts every tenant-scoped table has policies for all four operations.

**Phase to address:** Phase 1 / Database Schema + RLS setup.

---

#### Pitfall: Prisma Schema-Level Multi-tenancy Gaps

**Risk:** Prisma's query engine operates above RLS. If a developer uses `prisma.user.findMany()` without a `where: { organizationId }` clause, they rely entirely on RLS to filter. But during development with a `sgs_migrator` role (BYPASSRLS), tests and seeds will silently return all-tenant data. Developers build features assuming the filter is there, only to discover in production that certain code paths were never properly filtered at the application layer.

**Warning signs:**
- Prisma calls in service layer without `organizationId` in the `where` clause — acceptable only if RLS is trusted, but dangerous if the wrong DB role is ever used
- Development and test DBs seeded with a superuser role
- Integration tests passing despite missing `organizationId` because test DB uses BYPASSRLS role

**Prevention:**
- Create a Prisma middleware (or Prisma extension) that automatically injects `organizationId` into every query as a double-safety layer:
  ```typescript
  prisma.$use(async (params, next) => {
    if (params.model && TENANT_SCOPED_MODELS.includes(params.model)) {
      params.args.where = { ...params.args.where, organizationId: ctx.tenantId };
    }
    return next(params);
  });
  ```
- Test environments must use the `sgs_app` role (same as production), not a superuser.

**Phase to address:** Phase 1 / Application Layer.

---

### Category: Scheduling / Concurrency

#### Pitfall: Double-Booking Race Condition

**Risk:** Two concurrent requests for the same professional and overlapping time slot pass the "is slot available?" check simultaneously, because both reads happen before either write commits. This is a classic TOCTOU (time-of-check/time-of-use) race. In a busy salon on a Monday morning with appointment reminders triggering simultaneous self-booking, this is not hypothetical — it will happen.

**Warning signs:**
- Availability check is done in application code (`SELECT COUNT(*) WHERE overlaps...`) before an `INSERT` in a separate statement
- No database-level locking around the slot reservation
- Booking logic doesn't use serializable isolation or advisory locks

**Prevention:**
- Use `SELECT ... FOR UPDATE` on the professional's availability row, or use PostgreSQL advisory locks keyed on `(organizationId, professionalId, date)`:
  ```sql
  SELECT pg_advisory_xact_lock(hashtext(org_id || prof_id || slot_date::text));
  ```
- Execute availability check AND insert within a single serializable transaction.
- Add a UNIQUE constraint or partial index on `(professional_id, start_time)` WHERE `status NOT IN ('cancelled', 'no_show')` as a last-line-of-defense database guard.
- Return a clear "slot already taken" error to the client (not a 500) and expose retry logic in the public booking link UI.

**Phase to address:** Phase 2 / Scheduling Module.

---

#### Pitfall: Time Zone Mishandling in Appointment Storage

**Risk:** Brazil spans four time zones (UTC-2 to UTC-5), and daylight saving time (horário de verão) was abolished in 2019 but Brazilian developers and third-party APIs sometimes still handle it inconsistently. Storing appointment times as local timestamps without a timezone reference causes appointments to drift when servers are in UTC, clients display in local time, and WhatsApp reminders are sent using yet another reference. A 1-hour error in a reminder means the client shows up at the wrong time.

**Warning signs:**
- Database column type is `TIMESTAMP WITHOUT TIME ZONE` (bare `timestamp`) instead of `TIMESTAMPTZ`
- Application converts to local time in the service layer before storing
- WhatsApp reminder scheduled offset calculated in local time and passed to BullMQ as a millisecond delay without UTC normalization

**Prevention:**
- Store ALL timestamps as `TIMESTAMPTZ` (timestamp with time zone) in PostgreSQL. PostgreSQL stores internally as UTC and displays in session timezone.
- Store the organization's canonical timezone (e.g., `America/Sao_Paulo`) in the `organizations` table and apply it explicitly during display/reminder scheduling — never rely on server locale.
- Use `date-fns-tz` or `luxon` for time zone–aware date arithmetic; ban native `Date` math for scheduling logic.
- BullMQ job delay must be calculated as `targetUTC.getTime() - Date.now()` in milliseconds, not a local-time-relative offset.

**Phase to address:** Phase 2 / Scheduling Module + Phase 3 / WhatsApp Automation.

---

#### Pitfall: Slot Calculation Ignoring Service Duration Overlap

**Risk:** Salons offer services of 30, 60, 90, 120 minutes. A slot-availability query that only checks if `start_time` is free — not if the entire `[start_time, start_time + duration]` interval is free — will create phantom availability. A 90-minute color treatment booked at 10:00 blocks 10:00–11:30, but a naive check says 10:30 and 11:00 are "free."

**Warning signs:**
- SQL availability query uses `WHERE start_time = $slot` instead of an overlap check
- No overlap index exists on the appointments table

**Prevention:**
- Use PostgreSQL range overlap operator: `WHERE tsrange(start_time, end_time) && tsrange($start, $end)`
- Add a GiST index on `tsrange(start_time, end_time)` for performance.
- Model `Appointment` with both `startTime` and `endTime` explicitly — never derive `endTime` only at display time.

**Phase to address:** Phase 2 / Scheduling Module.

---

### Category: Financial Calculations

#### Pitfall: Floating-Point Money Arithmetic

**Risk:** JavaScript `Number` (IEEE 754 double) cannot represent many decimal values exactly. `0.1 + 0.2 === 0.30000000000000004`. In a commission calculation or POS total, rounding errors accumulate across line items. A checkout with 5 services may produce a total that is R$0.01 off, leading to cash register discrepancies and customer-facing display errors. Over a month of transactions, reconciliation becomes a nightmare.

**Warning signs:**
- Money stored as `FLOAT` or `DOUBLE PRECISION` in PostgreSQL instead of `NUMERIC(10,2)`
- Application arithmetic using native JavaScript `+`, `-`, `*` on monetary values
- Commission calculations that produce results like `R$ 12.500000000000002`

**Prevention:**
- Store all monetary values in PostgreSQL as `NUMERIC(10,2)` (or `NUMERIC(12,4)` for intermediate commission rates). Never `FLOAT`.
- Use the `dinero.js` v2 library (integer-based arithmetic) or `decimal.js` for all money calculations in TypeScript. Never do raw `number * number` for money.
- Represent monetary values internally as integer centavos (e.g., `R$ 12.50` = `1250`) and only convert to decimal for display.
- All Prisma schema monetary fields: `Decimal` type (maps to `NUMERIC` in PostgreSQL, handled as `Decimal` objects in JavaScript via Prisma's bundled `decimal.js`).

**Phase to address:** Phase 1 / Domain Model + Phase 3 / POS Module.

---

#### Pitfall: Commission Calculation Rounding Mode Ambiguity

**Risk:** Commission rates like 30% on R$ 33.33 = R$ 9.999, which rounds to either R$ 9.99 or R$ 10.00 depending on rounding mode. If the application uses one rounding mode and the salon owner mentally uses another, the total commissions paid across 200 transactions per month will be visibly different. This causes professional distrust and support tickets.

**Warning signs:**
- Commission calculation uses JavaScript's default `Math.round()` (rounds half-up for positive, half-down for negative)
- Rounding mode is not documented or configured per-organization
- Commission totals in reports differ from per-transaction manual sums by small amounts

**Prevention:**
- Choose a single rounding mode (recommend HALF_UP / "round half away from zero") and document it explicitly in the domain layer.
- Implement commission calculation as a pure domain function with the rounding mode as a named constant.
- Add snapshot tests for commission calculation edge cases: round numbers, half-cent results, zero-commission items, package discounts applied before commission.
- Consider making the rounding mode configurable at the organization level (some accountants prefer HALF_EVEN / banker's rounding).

**Phase to address:** Phase 2 / Commission Module.

---

#### Pitfall: Cashier Session Not Atomic on Close

**Risk:** Closing a cashier session involves reading all transactions, computing totals, comparing against physical count, and writing a closure record. If this operation is not wrapped in a single serializable transaction, a payment that arrives mid-close creates an inconsistency: it's counted in the physical total but not in the system closure record (or vice versa).

**Warning signs:**
- Cashier close logic reads transaction sum in one query, then inserts closure record in a separate query
- No locking mechanism prevents new payments being registered during the close operation
- Cashier reports show recurring small discrepancies with no explanation

**Prevention:**
- Wrap the entire cashier close operation in a `SERIALIZABLE` transaction or use `SELECT ... FOR UPDATE` on the cashier session row as an exclusive lock.
- Set cashier session status to `CLOSING` before computing totals (prevents new transactions via application-level guard), then finalize to `CLOSED`.
- Emit a domain event `CashierClosed` from within the transaction via the Outbox Pattern so downstream reconciliation is consistent.

**Phase to address:** Phase 3 / POS / Cashier Module.

---

### Category: Commission Calculation Edge Cases

#### Pitfall: Commission on Discounted vs. Full Price

**Risk:** If a service is sold at a discount (e.g., promotional pricing, package deal, or manual discount applied at POS), should the professional's commission be calculated on the original price or the discounted price? Different salon owners have different rules. Building in a hard assumption in the data model makes it impossible to support the other case without schema changes.

**Warning signs:**
- `commission_base` not stored on the order item — calculated at report time from `current_price`
- No `commission_base_type` field (enum: `SALE_PRICE` | `FULL_PRICE` | `CUSTOM`) on organization or service level
- Commission reports change retroactively when service prices are updated

**Prevention:**
- Snapshot the commission calculation inputs at order creation time: store `unit_price`, `discount_amount`, `commission_rate`, `commission_base`, and `commission_amount` on the order item row — immutable after creation.
- Add `commission_base_type` as a configurable setting per organization (defaulting to `SALE_PRICE`).
- Never recalculate historical commissions from current service prices; always use the snapshotted values.

**Phase to address:** Phase 2 / Commission Module + Phase 3 / POS.

---

#### Pitfall: Multi-Professional Service Split Commissions

**Risk:** Some services involve two professionals (e.g., colorist + hairdresser). Splitting commission 50/50 seems obvious until someone leaves mid-service, a replacement steps in, or the split ratio is negotiated. If the data model only supports one professional per appointment, this entire scenario requires a workaround that breaks reporting.

**Warning signs:**
- `Appointment` has a single `professionalId` foreign key
- Commission report uses `appointment.professionalId` directly
- Business requirement for bridal groups (noivas) involves multiple professionals

**Prevention:**
- Model `AppointmentProfessional` as a join table with `(appointmentId, professionalId, commissionSplit NUMERIC(5,4))` from day one — even if MVP only ever writes one row.
- Validate that commission splits sum to 1.0 (100%) at the application layer.
- This is especially critical for the bridal/event module where multi-professional coordination is core.

**Phase to address:** Phase 1 / Domain Model — schema change after data exists is expensive.

---

### Category: WhatsApp API / Automation

#### Pitfall: WhatsApp Business API Rate Limiting and Template Enforcement

**Risk:** Meta's WhatsApp Business API (via official BSPs like Twilio, Vonage, or direct cloud API) enforces strict rate limits and message template requirements. Sending non-template messages to users who haven't initiated contact in the last 24 hours violates policy and results in account suspension. For a Brazilian salon with 500 active clients, a poorly timed campaign burst can trigger quality rating drops, which reduce daily sending limits in a feedback loop that's difficult to recover from.

**Warning signs:**
- Using a single WhatsApp number for all tenants (shared sender) — one tenant's spam causes all tenants to lose sending capacity
- Reminder messages sent as free-form text instead of pre-approved HSM templates
- BullMQ jobs that send 200 reminders at midnight without per-second rate throttling

**Prevention:**
- Each organization should use its own WhatsApp Business number (or at minimum its own WABA ID) to isolate quality rating per tenant.
- All outbound messages must use pre-approved HSM (Highly Structured Message) templates for non-session messages. Store template IDs per notification type.
- Implement a BullMQ rate-limited queue: use `limiter: { max: 20, duration: 1000 }` (20 messages/second per sender) — stay well below Meta's limits.
- Implement exponential backoff on 429 responses; do not retry immediately.
- Monitor `message_status` webhooks for `failed` / `undeliverable` and alert when failure rate exceeds 2%.

**Phase to address:** Phase 3 / WhatsApp Automation Module.

---

#### Pitfall: WhatsApp Webhook Reliability and Idempotency

**Risk:** Meta sends webhook events for message status updates (delivered, read, failed). If the webhook handler crashes or returns a non-200, Meta retries — sometimes for hours. Without idempotency keys, a crashed handler that partially processed an event will double-process when the retry arrives: duplicate "message delivered" records, duplicate status updates, potentially duplicate outbound replies.

**Warning signs:**
- Webhook handler does not check for duplicate `message_id` before processing
- No idempotency table (`processed_webhook_events`) in the database
- Webhook endpoint returns 200 before finishing all side effects (fire-and-forget pattern)

**Prevention:**
- Store `message_id` in a `whatsapp_webhook_events` table with a UNIQUE constraint. Upsert on arrival — if already processed, return 200 immediately.
- Webhook handler should: (1) persist the raw event, (2) return 200, (3) enqueue a BullMQ job for processing. Never do heavy processing synchronously in the webhook handler.
- BullMQ job for processing should be idempotent: "set appointment confirmed" should be a no-op if already confirmed.

**Phase to address:** Phase 3 / WhatsApp Automation Module.

---

#### Pitfall: Evolution/Baileys Unofficial API Risk

**Risk:** Many Brazilian developers use `@whiskeysockets/baileys` (unofficial WhatsApp web automation) to avoid Meta BSP costs. This approach violates WhatsApp Terms of Service, can result in permanent number bans with no recourse, and has no SLA. For a production SaaS with 250+ salon clients depending on WhatsApp automation, a ban that takes down all notifications simultaneously is a critical business outage with no fast recovery path.

**Warning signs:**
- Cost evaluation favors Baileys/Evolution API over official BSP purely on price
- "We'll switch to official API later" is in the plan but no migration path exists
- Single WhatsApp number shared across all tenants via Baileys

**Prevention:**
- Use only official WhatsApp Business API via a Meta-approved BSP (Twilio, Infobip, Zenvia — the last two have strong Brazilian market presence and BRL pricing).
- Budget the BSP cost into the pricing model from day one. Estimated cost: R$ 0.08–0.15 per template message; for 500 orgs sending 50 reminders/month = ~R$ 2,000–3,750/month.
- Document this as a non-negotiable architectural constraint in the project.

**Phase to address:** Phase 1 / Architecture Decision + Phase 3 / Implementation.

---

### Category: LGPD Compliance

#### Pitfall: Consent Without Audit Trail

**Risk:** LGPD (Lei 13.709/2018) requires that data collection consent be freely given, specific, informed, and unambiguous — and that the controller can prove it. Salons collect sensitive data: photos, health anamneses (skin conditions, allergies, medications), and biometric data in some cases. If a client revokes consent or files a complaint with ANPD, the salon (and by extension SGS as the data processor) must produce evidence of when and how consent was obtained. A missing audit trail results in regulatory liability for the salon and reputational risk for SGS.

**Warning signs:**
- Consent checkbox in onboarding with no server-side logging of IP, timestamp, and consent version
- Client profile form collects health/anamnese data without a separate explicit consent for sensitive data (Art. 11 LGPD requires stricter basis for sensitive personal data)
- No mechanism for clients to request data export or deletion

**Prevention:**
- Implement a `consent_records` table: `(client_id, organization_id, consent_type, consent_version, consented_at, ip_address, user_agent, revoked_at)`.
- Separate consent flows for: (1) general profile data, (2) health/anamnese data (sensitive — requires explicit consent under Art. 11), (3) marketing communications.
- Build a client-facing "My Data" page (accessible via the public booking link) with: view my data, export my data (JSON), request deletion.
- Deletion must be soft-delete with a 5-year retention override for financial records (Receita Federal requirement conflicts with LGPD erasure — implement a "anonymize but retain financial record" pattern).

**Phase to address:** Phase 1 / Auth + Client Module — cannot be retrofitted without data migration.

---

#### Pitfall: Data Retention Conflict: LGPD Erasure vs. Financial Record Keeping

**Risk:** LGPD Art. 16 grants data subjects the right to deletion. However, Brazilian tax law (Código Tributário Nacional) requires retention of fiscal records for 5 years, and labor law requires commission records for 2 years. A naive "delete everything" on an erasure request will destroy records the salon is legally required to keep, exposing it to tax authority penalties. But ignoring the erasure request violates LGPD.

**Warning signs:**
- `DELETE FROM clients WHERE id = $1` as the "right to erasure" implementation
- No distinction between personal identifiers (name, phone, CPF) and transactional records (order totals, commissions paid)

**Prevention:**
- Implement a two-stage erasure: (1) anonymize PII (replace name with "Cliente Anonimizado", nullify CPF, phone, email, photo) while keeping all financial/commission records intact with a pseudonymous ID; (2) schedule full deletion after the mandatory retention period expires.
- Document the legal basis for retention in the privacy policy.
- The `clients` table should have `anonymized_at`, `scheduled_deletion_at`, and `deletion_legal_hold_until` fields.

**Phase to address:** Phase 2 / Client Module + Legal review before launch.

---

#### Pitfall: Health Data (Anamnese) Stored Without Adequate Protection

**Risk:** Anamnese forms in salons capture data about allergies, skin conditions, medications, and prior reactions. Under LGPD Art. 11, this is "sensitive personal data" (dados pessoais sensíveis) requiring stricter legal basis. Storing this data in plaintext in the same table as booking records, with the same access controls as a front-desk attendant, violates the principle of data minimization and adequate protection.

**Warning signs:**
- `anamnese` stored as a `JSONB` column on the `clients` table without encryption
- All staff roles (Atendente, Gerente) can read anamnese data
- No separate consent record for anamnese data collection

**Prevention:**
- Encrypt anamnese data at rest using column-level encryption (PostgreSQL `pgcrypto` extension, or application-layer AES-256 encryption before storage).
- Restrict anamnese access to role `Profissional` and `Administrador` only — enforce via RLS policy on the anamnese table.
- Separate consent record for sensitive data collection.

**Phase to address:** Phase 2 / Client Module.

---

### Category: GraphQL / API Performance

#### Pitfall: N+1 Query Problem in Appointment List

**Risk:** A salon dashboard fetching 50 appointments for the week, each with a nested `professional`, `client`, `service`, and `payments` resolver, generates 50×4 = 200 database queries instead of 5 (one per entity with a batched IN query). At 250 organizations each fetching a weekly view, this degrades to thousands of queries per request, blowing through database connection limits and violating the P95 ≤ 300ms SLA.

**Warning signs:**
- Apollo Server logs showing >10 queries for a single `appointments` query
- Response time for weekly calendar view increases linearly with number of appointments
- PostgreSQL `pg_stat_activity` shows connection saturation during peak hours

**Prevention:**
- Use `DataLoader` for all nested resolver relationships. Each entity type gets a DataLoader keyed by ID that batches all requests within a single event loop tick.
- For NestJS + Apollo, use `@nestjs/dataloader` or implement DataLoaders in the GraphQL context factory — one DataLoader instance per request, not per application lifecycle.
- Use persisted queries (already decided in PROJECT.md) to prevent clients sending arbitrary N+1-generating queries in production.
- Add query complexity analysis middleware (Apollo's `graphql-query-complexity` or custom directive-based limits) to reject queries exceeding a complexity threshold before execution.

**Phase to address:** Phase 1 / GraphQL Layer + Phase 2 when complex resolvers are built.

---

#### Pitfall: GraphQL Subscription Memory Leak on Abandoned Connections

**Risk:** Apollo Subscriptions over WebSocket maintain a persistent connection. In a salon context, staff leave browsers open overnight, mobile browsers put tabs to sleep, or network interruptions cause silent disconnects. If the server doesn't detect and clean up stale subscriptions, memory usage grows unboundedly — each subscription holding a PubSub event listener, a Prisma context reference, and potentially a Redis subscription.

**Warning signs:**
- Server memory grows over time without obvious memory leaks in profiling (hidden in subscription listener accumulation)
- Redis `PUBSUB NUMSUB` shows channels with zero active subscribers still accumulating events
- Subscription count in Apollo Studio increases over days without corresponding decrease

**Prevention:**
- Implement subscription keep-alive with a ping/pong timeout (Apollo Server supports `keepAlive` option). Terminate connections that don't respond within 30 seconds.
- Use `graphql-ws` (not the deprecated `subscriptions-transport-ws`) — it has better connection lifecycle management.
- Limit concurrent subscriptions per connection and per organization.
- Only subscribe to events at a per-organization level (not per-user per-entity) to reduce subscription cardinality.

**Phase to address:** Phase 2 / Real-time Features.

---

### Category: Prisma + PostgreSQL Specific

#### Pitfall: Prisma Migrations in Multi-Tenant Shared Schema

**Risk:** Prisma migrations run as a single DDL operation against the database. In a shared-schema multi-tenant model, an `ALTER TABLE` that locks a table (e.g., adding a non-nullable column without a default) will lock that table for all tenants simultaneously. In production, this causes complete service outage for all 250+ organizations during the migration, which is unacceptable even at MVP scale.

**Warning signs:**
- Migrations add `NOT NULL` columns without a `DEFAULT` value in the same migration step
- Long-running `ALTER TABLE` operations not using PostgreSQL's `ADD COLUMN ... DEFAULT` optimization (PG 11+ handles this online for fixed defaults, but variable defaults still lock)
- No migration testing against production data volume before deployment

**Prevention:**
- Follow the expand/contract pattern for schema changes: (1) add nullable column, (2) backfill in batches, (3) add constraint, (4) remove old column — each step as a separate deployment.
- For new `NOT NULL` columns, always provide a database-level `DEFAULT` in the same `ADD COLUMN` statement (PostgreSQL 11+ does this without a table rewrite for most types).
- Test migrations against a production-size data snapshot (use `pgcopy` or anonymized backup) before deploying.
- Schedule migrations during low-traffic windows (e.g., 03:00 BRT) and use `pg_stat_activity` monitoring to detect locks.

**Phase to address:** Every phase — establish migration discipline in Phase 1.

---

#### Pitfall: Prisma `$queryRaw` Returning Wrong Types for NUMERIC Fields

**Risk:** When Prisma executes raw SQL queries returning `NUMERIC` columns (monetary values, commission rates), the results come back as JavaScript `string` type, not `number` or Prisma's `Decimal`. If a developer assumes the result is a number and performs arithmetic on it, the operation silently does string concatenation instead of addition (`"12.50" + "7.30" === "12.507.30"`). This is particularly insidious because it only affects raw queries — Prisma model queries handle `Decimal` correctly.

**Warning signs:**
- Raw queries used for commission aggregates or financial summaries
- `console.log(typeof result.total)` returns `"string"` for money fields
- Financial totals in reports show concatenated strings that look like large numbers

**Prevention:**
- Always cast monetary results in raw SQL: `SELECT SUM(amount)::float8 AS total` or handle as strings and parse with `new Decimal(result.total)`.
- Prefer Prisma model queries with `groupBy` and `aggregate` over raw SQL for financial summaries — they handle `Decimal` types correctly.
- Add a TypeScript ESLint rule that flags arithmetic operators on variables typed as `string` in financial service files.

**Phase to address:** Phase 3 / Financial Reporting.

---

### Category: BullMQ Job Reliability

#### Pitfall: Lost Jobs on Redis Restart Without Persistence

**Risk:** BullMQ queues jobs in Redis. By default, Redis is configured with either no persistence (`save ""`) or RDB snapshots every 15 minutes. If Redis crashes between snapshots, all scheduled WhatsApp reminders, commission calculation jobs, and Outbox processor jobs in the queue are permanently lost. For a salon whose clients have appointments the next morning, missing reminders cause no-shows, which are a direct revenue loss the salon will blame on SGS.

**Warning signs:**
- Redis deployed without `appendonly yes` (AOF persistence) or with RDB-only persistence
- BullMQ jobs have no result stored — only queued; no way to audit what was lost after a Redis crash
- No dead letter queue or job failure alerting

**Prevention:**
- Configure Redis with AOF persistence (`appendonly yes`, `appendfsync everysec`) for near-real-time durability. Accept the minor performance tradeoff.
- For critical jobs (WhatsApp reminders, Outbox events): store job intent in PostgreSQL before enqueuing to Redis. A recovery worker on startup scans PostgreSQL for "should have been sent but wasn't" and re-enqueues.
- Set BullMQ `removeOnComplete: false` for 24 hours to allow audit.
- Configure `attempts: 3, backoff: { type: 'exponential', delay: 2000 }` on all queues.
- Alert on dead letter queue depth exceeding 10 jobs.

**Phase to address:** Phase 1 / Infrastructure + Phase 3 / Automation.

---

#### Pitfall: Outbox Pattern Without Poison Pill Handling

**Risk:** The Outbox Pattern (write domain events to DB table, worker polls and publishes) is reliable — until a malformed event or a downstream integration bug causes the worker to fail processing the same event repeatedly, blocking all subsequent events in the queue. This "poison pill" can halt all WhatsApp notifications, all commission calculations, and all real-time updates for the entire platform until manually resolved.

**Warning signs:**
- Outbox worker processes events in strict FIFO order with no skip-on-failure mechanism
- No maximum retry count on individual outbox events
- All event types in a single queue — one bad event blocks all event types

**Prevention:**
- Add `retry_count` and `max_retries` fields to the `outbox_events` table. Events exceeding max retries transition to `FAILED` status and are moved to a `dead_letter` table — NOT blocking subsequent events.
- Use per-event-type queues in BullMQ so a failing WhatsApp event doesn't block commission calculation events.
- Implement an admin alert when events accumulate in `dead_letter` state.
- The Outbox worker should use `SELECT ... WHERE status = 'PENDING' ORDER BY created_at LIMIT 100 SKIP LOCKED` — `SKIP LOCKED` is critical for multi-instance worker deployment without re-processing.

**Phase to address:** Phase 1 / Outbox Infrastructure.

---

### Category: Brazilian Payment Integration

#### Pitfall: Pix Key Validation and Fraud Edge Cases

**Risk:** Pix transactions are instant and irreversible in Brazil. If a bug causes a Pix payment to be registered as paid before the webhook confirms it (optimistic confirmation), or a webhook is replayed due to network retry causing a double-confirmation, the salon's financial records show a payment that either wasn't received or was received once but counted twice.

**Warning signs:**
- Payment status updated to `PAID` before receiving the `pixPaymentConfirmed` webhook from the gateway
- Webhook handler for Pix confirmation not idempotent — processes the same `txid` twice
- Pix webhook signature validation (`x-api-key` or HMAC header) not verified, leaving the endpoint open to spoofed confirmations

**Prevention:**
- Never update payment status to `PAID` before webhook confirmation. Display "Aguardando confirmação Pix" until the gateway webhook arrives.
- Validate webhook authenticity: verify gateway-provided HMAC signature or API key on every incoming webhook. Reject requests without valid signatures with 401.
- Store `txid` (Pix transaction ID) with a UNIQUE constraint; idempotent upsert on webhook arrival.
- Implement a reconciliation job that polls the gateway API for Pix statuses older than 10 minutes with `PENDING` status — handle webhook delivery failures.

**Phase to address:** Phase 3 / Payment Module.

---

#### Pitfall: Pagar.me vs. Stripe Connect Architectural Lock-in

**Risk:** The PROJECT.md lists "Pagar.me vs Stripe Connect — both viable; decide at implementation start." Delaying this decision until implementation means the payment module is designed without knowing the API model. Stripe Connect has a marketplace/platform model with sub-accounts per tenant; Pagar.me has a different recipient model. The wrong abstraction layer in the payment service means the chosen gateway drives the domain model rather than the domain model driving the gateway adapter.

**Warning signs:**
- Payment service directly calls gateway SDK methods rather than going through a domain-level `PaymentGateway` interface
- Database schema uses gateway-specific field names (`stripe_payment_intent_id` instead of `gateway_payment_reference`)
- Integration tests are written against the real gateway SDK with no mock boundary

**Prevention:**
- Define a `PaymentGateway` interface in the domain layer before writing any implementation:
  ```typescript
  interface PaymentGateway {
    createIntent(params: CreateIntentParams): Promise<PaymentIntent>;
    confirmWebhook(payload: unknown, signature: string): WebhookEvent;
    refund(intentId: string, amount: Money): Promise<RefundResult>;
  }
  ```
- Store only gateway-agnostic references in the DB: `gateway_provider`, `gateway_reference`, `gateway_status`.
- This decision MUST be made before Phase 3 begins — the abstraction layer costs almost nothing to build, but switching gateways without it costs weeks.

**Phase to address:** Phase 1 Architecture Decision + Phase 3 Implementation.

---

#### Pitfall: Brazilian CPF/CNPJ Validation Beyond Regex

**Risk:** Brazilian CPF (individual) and CNPJ (business) numbers have check digits validated by a specific algorithm. A simple regex like `/^\d{11}$/` will accept `00000000000` and `11111111111` as valid CPFs — these are syntactically valid patterns but fail the check digit algorithm and are used extensively in test data and fraud. Accepting fake CPFs breaks LGPD compliance (identity verification), Pix registration (CPF must match account holder), and any future tax integration.

**Warning signs:**
- CPF validation only checks format (11 digits, optionally formatted) without running the check-digit algorithm
- Test data uses `111.111.111-11` or similar repeated-digit CPFs
- No server-side CPF validation — only frontend validation

**Prevention:**
- Implement CPF/CNPJ validation with the full check-digit algorithm (or use the `cpf-cnpj-validator` npm package, well-maintained Brazilian library).
- Validate on both client and server. Client validation is UX; server validation is security.
- Reject all-same-digit CPFs explicitly (they pass the algorithm but are invalid by Receita Federal rules).
- Store CPF/CNPJ in normalized format (digits only, no formatting) to simplify comparison and indexing.

**Phase to address:** Phase 2 / Client Module + Phase 3 / Payment Module.

---

### Category: Architecture / Cross-Cutting

#### Pitfall: Event-Driven Outbox Breaking Domain Isolation

**Risk:** The Outbox Pattern with a shared `outbox_events` table creates a hidden coupling point. If event schema evolves (new fields added, payload structure changed), the Outbox worker that serializes/deserializes events must be updated in lockstep with the module that emits them. In a modular monolith, bounded context isolation means modules should not share infrastructure details — but a global outbox table breaks this.

**Warning signs:**
- All modules write to the same `outbox_events` table with the same `payload JSONB` schema
- No versioning on event schemas (`event_version` field missing)
- A schema change in the `AppointmentConfirmed` event payload breaks the WhatsApp notification processor

**Prevention:**
- Add `event_version` (integer or semver string) to every outbox event. Processors must handle all supported versions gracefully before deprecating old versions.
- Consider per-module outbox tables if module isolation is paramount: `scheduling_outbox`, `financial_outbox` — this prevents one module's broken events from blocking another's.
- Use an event schema registry (even a simple TypeScript discriminated union in a shared `events` package) as the contract between emitters and consumers.

**Phase to address:** Phase 1 / Event Architecture.

---

#### Pitfall: GraphQL Schema Growing Without Deprecation Strategy

**Risk:** A mobile app (planned for Phase 5) and public booking link (live from Phase 2) will consume the GraphQL API. Once external clients depend on specific fields, removing or renaming those fields is a breaking change. Without a deprecation strategy, the schema accumulates dead fields forever, or breaking changes break the booking link without warning.

**Warning signs:**
- No `@deprecated` directive usage in the schema
- Schema changes happen without a CHANGELOG or versioning consideration
- The public booking link and internal dashboard share the same schema with no field-level access control

**Prevention:**
- Mark deprecated fields with `@deprecated(reason: "Use X instead")` and maintain them for at least one full release cycle.
- Use persisted queries (already decided) — this makes breaking changes detectable: a persisted query that references a removed field will fail at registration time, not at runtime.
- Consider schema stitching or separate schemas for public (booking link) vs. private (management dashboard) endpoints if they diverge significantly.

**Phase to address:** Phase 2 / Public Booking Link — establish deprecation policy before first external consumer.

---

## Summary: Top 5 Most Critical Pitfalls

| Rank | Pitfall | Why Critical | First Phase to Address |
|------|---------|-------------|----------------------|
| 1 | **RLS Bypass via Wrong DB Role / SET vs SET LOCAL** | Silent data leakage across tenants — existential business risk, LGPD liability, immediate churn if discovered | Phase 1 |
| 2 | **Double-Booking Race Condition** | No-shows and double-booked professionals destroy salon trust in the platform faster than any other bug; irreversible reputation damage | Phase 2 |
| 3 | **Floating-Point Money Arithmetic** | Accumulates silently across thousands of transactions; reconciliation failures and professional payment disputes | Phase 1 (model) / Phase 3 (POS) |
| 4 | **LGPD Consent + Erasure Without Audit Trail** | Regulatory fine risk (up to 2% of Brazilian revenue, capped at R$ 50M), personal liability for salon owners as data controllers | Phase 1 (auth) / Phase 2 (clients) |
| 5 | **WhatsApp Unofficial API (Baileys) Business Risk** | Account ban = all 250+ organizations lose notifications simultaneously; no recovery path; no SLA | Phase 1 (architectural decision) |

---

## Phase-Specific Warning Matrix

| Phase | Module | Pitfall to Watch | Mitigation |
|-------|--------|-----------------|------------|
| Phase 1 | DB / RLS Setup | RLS FORCE not set; wrong DB role at runtime | Two-role strategy + integration test cross-tenant queries |
| Phase 1 | Domain Model | Money as float; single professionalId on Appointment | Use `NUMERIC` + `Decimal.js`; multi-professional join table |
| Phase 1 | Outbox | Poison pill blocking all events; no event versioning | `SKIP LOCKED` + per-type queues + `event_version` field |
| Phase 2 | Scheduling | Race condition on slot reservation; timezone errors | Advisory locks + `TIMESTAMPTZ` + overlap range index |
| Phase 2 | Commission | Rounding ambiguity; no commission base snapshot | Snapshot inputs at order creation; explicit rounding mode |
| Phase 2 | Client | Health data unencrypted; no consent audit trail | Column encryption for anamnese; consent_records table |
| Phase 3 | POS | Cashier close not atomic; Pix optimistic confirmation | Serializable transaction; webhook-only confirmation |
| Phase 3 | WhatsApp | Rate limit bursts; unofficial API; webhook non-idempotent | Official BSP only; rate-limited BullMQ queue; idempotency table |
| Phase 3 | Payments | Gateway lock-in; CPF not algorithm-validated | PaymentGateway interface first; cpf-cnpj-validator |
| Phase 4+ | GraphQL | N+1 on complex reports; subscription leaks | DataLoader mandatory; query complexity limits; graphql-ws |
| Phase 4+ | Migrations | Table locks during ALTER TABLE on shared schema | Expand/contract pattern; test on production-size data |

---

## Sources

**Confidence levels:**
- PostgreSQL RLS, advisory locks, TIMESTAMPTZ behavior, NUMERIC type — HIGH (official PostgreSQL documentation, well-established behavior)
- Prisma type mapping behavior (`NUMERIC` → `Decimal`, `$queryRaw` string returns) — HIGH (Prisma official docs, known behavior)
- BullMQ patterns (`SKIP LOCKED`, rate limiters, AOF persistence requirement) — HIGH (BullMQ documentation, Redis documentation)
- WhatsApp Business API template enforcement, quality rating mechanics — MEDIUM (Meta policy docs, known BSP partner guidance; verify current Meta policy for Brazil)
- LGPD Article 11 sensitive data requirements, Art. 16 erasure vs. retention conflict — MEDIUM (LGPD text is HIGH confidence; ANPD enforcement interpretation is MEDIUM — consult Brazilian legal counsel before launch)
- Pix webhook mechanics, gateway HMAC validation — MEDIUM (Banco Central do Brasil Pix documentation + gateway-specific implementation details; verify with chosen gateway's current docs)
- Pagar.me vs Stripe Connect architectural model — MEDIUM (current API documentation; Pagar.me's API may have evolved; verify before Phase 3 start)
- CPF/CNPJ check-digit algorithm — HIGH (Receita Federal specification, widely documented)
