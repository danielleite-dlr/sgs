# Architecture Research: SGS Beauty Salon SaaS

**Researched:** 2026-05-02
**Sources:** PRD_Backend, PRD_Banco_Dados, SDD (all v1.0-1.1), industry knowledge
**Overall confidence:** HIGH — architecture is already well-documented in PRDs; assessment validates and identifies gaps

---

## Validation of Decided Architecture

### Multi-Tenancy Model

**Verdict: CORRECT choice for the stated scale. No change needed.**

Shared Database / Shared Schema with PostgreSQL Row-Level Security is the right model for 1–1000 tenants. The decision is well-justified in PRD_Banco_Dados Section 2.1, and the industry backs it:

- At 1000 organisations with ~200 GB of primary data (per PRD projections), a single well-tuned PostgreSQL 16 instance (16 vCPU / 64 GB RAM / NVMe) handles the load comfortably. The PRD's own estimate says sharding or per-tenant DBs only become necessary above 5000 active tenants.
- RLS overhead in PostgreSQL 16 is ~5–15% per query when indexes include `organization_id` as the leading column. The PRD's composite index strategy already addresses this correctly.
- The three-layer isolation defence (RLS + NestJS middleware + GraphQL resolver guard) is the right pattern. Any single layer failing is caught by the others.

**Comparison to alternatives:**

| Model | When to use | Why NOT here |
|-------|------------|--------------|
| Shared DB / Shared Schema + RLS | < 5 000 tenants, cost-sensitive, ops simplicity | — This is the right choice |
| Shared DB / Separate Schema | 100–2000 tenants, strict compliance | Migration tooling complexity, Prisma multi-schema support is immature |
| Separate DB per tenant | > 2000 tenants or strict legal isolation | Operational cost, connection count, backup complexity |

**Critical RLS implementation gaps identified in the PRDs that must be addressed in build:**

1. `FORCE ROW LEVEL SECURITY` — the PRD correctly calls this out (Section 8.1 of DB PRD). It must be applied on every new table without exception. A linter check is mentioned; this must be in the CI pipeline from day zero.
2. PgBouncer transaction pooling — session variables (`SET LOCAL app.current_organization`) only work safely with transaction-mode pooling. Session-mode pooling would leak tenant context across requests. The PRD mandates transaction pooling; this must be verified before first production deploy.
3. `SECURITY DEFINER` functions bypass RLS silently. Any stored procedure or function that requires org-scoped data must either avoid `SECURITY DEFINER` or explicitly re-apply `SET LOCAL` inside. This is the single most common RLS bypass in production — deserves a dedicated ADR.
4. Views must be created with `WITH (security_barrier = true)`. Missing this allows the query planner to push predicates above the RLS check.
5. The `outbox` table is mentioned in PRD_Backend but does not appear in PRD_Banco_Dados entity lists. It needs `organization_id` and an RLS policy, or it becomes a cross-tenant information leak vector. **This is a gap between the two PRDs.**

**Scale inflection points for the 250–1000 org range:**

- At ~100 orgs: add a streaming read replica for reports and dashboard queries. The PRD identifies this correctly.
- At ~200 orgs: PgBouncer + Patroni for HA. Also identified.
- At ~500 orgs: the `appointments` table is projected to hit ~5M rows (780 rows/month × 500 orgs × ~12 months). This is exactly when range partitioning by `starts_at` should be applied. Decision 12.5 in DB PRD leaves this open — **recommend resolving before Phase 3 of the roadmap, not after**. Creating the table already partitioned from day zero is the lower-risk path; Postgres supports a single-partition table with no operational cost.
- At 1000 orgs: ClickHouse for analytics (already planned for Phase 4), read replica (already planned), partitioned `appointments` and `audit_log` (already planned). The architecture handles this.

---

### Bounded Context Analysis

**Verdict: 12 modules are well-drawn for this domain. Two boundary concerns worth noting.**

The bounded context list from the Backend PRD:

```
identity | catalog | clients | scheduling | pos | finance |
commissions | contracts | communication | intelligence | reporting | audit
```

This maps cleanly to the salon domain. Each context owns a distinct business capability with minimal cross-cutting. Assessment by context:

| Context | Assessment | Notes |
|---------|-----------|-------|
| `identity` | Correct | User/member/org separation is sound. The `users` table (cross-org) vs `members` table (org-scoped) is the right split. |
| `catalog` | Correct | Services, products, packages, promotions belong together. |
| `clients` | Correct | Client profiles, anamneses, bridal groups. BridalGroup living here (not in `scheduling`) is debatable but defensible — it's primarily a client grouping. |
| `scheduling` | Correct | Appointments, time blocks, slot logic, bridal schedule calculation. |
| `pos` | Correct | Orders and order_items form a cohesive transactional unit. Separating from `finance` is good — POS is about recording consumption; finance is about cash movement. |
| `finance` | Correct | Cashier, payments, payables. Correct separation from POS. |
| `commissions` | Correct | Commission calculation is complex enough to warrant its own context. Lives off `OrderClosed` event — clean dependency direction. |
| `contracts` | Correct | Event contracts have different lifecycle rules (installments, deadlines, cancellation policy) that justify separation from POS. |
| `communication` | Correct | Messages, templates, campaigns. Purely reactive — consumes events, never drives them. |
| `intelligence` | Correct | AI suggestions, demand forecasting, operational alerts. Keeps AI concerns isolated; easy to swap provider. |
| `reporting` | Correct | Dashboards, KPIs, exports. Correct to separate from transactional contexts. Will eventually move to ClickHouse. |
| `audit` | Correct | Append-only log, compliance retention. Correct to isolate. |

**Boundary concern 1: BridalGroup ownership across two contexts**

`bridal_groups` and `bridal_group_members` live in the `clients` module (per the SDD entity list) but `BridalSchedule` lives in `scheduling`. `BridalGroupCreated` is the event that bridges them.

The concern: when calculating a bridal schedule, `scheduling` needs to know the services assigned to each member of the group. That data currently sits in `contracts` (via `contract_services`) and `catalog`. This creates a cross-context query path: `scheduling` → `contracts` → `catalog`.

**Recommendation:** `BridalGroup` should expose a read-side interface (not a repository import) that `scheduling` can query for group member service lists. A `BridalGroupServicesQuery` interface in the application layer of `clients` keeps the boundary intact while giving `scheduling` what it needs.

**Boundary concern 2: Commission trigger placement**

`commissions` calculates off `OrderClosed`. But commission rules are configured at two levels: service-level (`services.commission_type/value`) and member-level (`members.commission_type/value`). Both live in `catalog` and `identity` respectively.

The commission calculation use case in `commissions` must read from `catalog` (service rates) and `identity` (member rates). This is a legitimate cross-context read — not a boundary violation if done via interfaces/query ports, not repository imports. The PRD's rule is correct: "módulo A invocar interface pública exposta por B via DI." This path needs explicit ports defined.

**Missing context: `subscription` / `billing`**

The project mentions `plans`, `subscriptions`, `Subscription` entity, and a pending pricing decision. There is no `billing` or `subscription` bounded context in the module list. As the platform grows to 1000 orgs, subscription management (plan changes, billing cycles, feature flag enforcement, overdue handling) will be non-trivial.

**Recommendation:** Add `billing` as a planned bounded context, even if MVP implements it minimally (just `plans` and `subscriptions` tables). Without it, subscription logic leaks into `identity`, which already has enough responsibility.

---

### Event-Driven Design

**Verdict: Outbox Pattern is the correct choice. Implementation details are sound.**

The choice of table-based Outbox over Debezium (CDC capture from WAL) is correct for MVP:

- Debezium requires Kafka or similar as the event broker, adds significant operational weight, and the failure modes are harder to reason about in a small team.
- The table-based outbox is understood by any developer, debuggable with a SQL query, and sufficient for the event volume this system will generate.

**Quantifying the outbox worker load at 1000 orgs:**
- ~9.3M appointments/year = ~25,000/day across all orgs
- ~18M order_items/year → commission calculations
- Outbox events per day estimate: ~100,000–200,000 across all event types
- This is well within what a single BullMQ worker can process

**Outbox implementation correctness checklist (against PRD_Backend Section 6.3):**

- Write event to `outbox` table INSIDE the same transaction as the business change — YES, the PRD specifies this correctly.
- Only deliver event AFTER transaction commits — YES, handled by the outbox worker polling after commit.
- Idempotent handlers — YES, the PRD requires this with an event processing table `(handler, event_id)`.
- `outbox` worker on the `outbox` BullMQ queue with infinite retries — YES, specified in job table.

**Gap: `outbox` table definition is in PRD_Backend (Section 6.3.1) but absent from PRD_Banco_Dados entity catalogue.** The table needs:
- `organization_id` for RLS
- `published_at` (nullable, NULL = pending)
- Index on `(published_at IS NULL, created_at)` for the worker polling query
- RLS policy (or explicit decision to exempt it from RLS as a platform-level table)

**BullMQ vs Temporal:**

The decision to use BullMQ for MVP is correct. The bridal schedule planning flow (multi-step: collect services → calculate timeline → suggest slots → confirm) is the first candidate for Temporal-style durable workflows once it hits production complexity. Flag this as a Phase 4 re-evaluation point.

---

### Critical Data Flows

#### Appointment Booking

```
Client Browser
  │
  ▼ mutation createAppointment(input) [JWT + org context]
NestJS HTTP Layer
  │
  ├── Tenant Middleware: extract org from subdomain/header/JWT, SET LOCAL
  ├── Auth Guard: validate JWT, check permissions['appointment.create']
  └── AppointmentResolver
        │
        ▼ Zod input validation (dates, duration, required fields)
        │
        ▼ CreateAppointmentUseCase.execute()
              │
              ├── BEGIN TRANSACTION
              │
              ├── AvailabilityCheck (scheduling domain):
              │     SELECT appointments WHERE professional_id = ? AND
              │     starts_at < input.ends_at AND ends_at > input.starts_at
              │     AND status NOT IN ('cancelled','no_show')
              │     [RLS auto-filters by org]
              │
              ├── TimeBlockCheck:
              │     SELECT time_blocks WHERE professional_id = ? AND ...
              │
              ├── INSERT appointments (with organization_id)
              ├── INSERT appointment_services
              │
              ├── INSERT outbox (AppointmentCreated payload)
              │
              └── COMMIT
                    │
                    ▼ [async, after commit]
              Outbox Worker polls outbox
                    │
                    ├── Publish AppointmentCreated to Redis Pub/Sub
                    │
                    └── Event handlers (parallel):
                          ├── NotificationHandler → enqueue 'send-whatsapp-confirmation'
                          │     → BullMQ 'notifications' queue
                          │     → WhatsApp Cloud API (template 'appointment-confirmation')
                          │     → INSERT messages (status: sent)
                          │
                          └── ForecastHandler → invalidate Redis cache
                                key: query:{orgId}:financial-forecast:*

Resolver returns: CreateAppointmentPayload { appointment, errors[] }
```

**Key data dependencies for this flow:**
- `catalog.services` — to resolve service duration for `ends_at` calculation
- `identity.members` — to validate professional exists and is active in org
- `clients.clients` — to validate client belongs to org
- `scheduling.appointments` + `scheduling.time_blocks` — availability check

**Conflict detection gap:** The current schema uses application-level overlap detection (SELECT + INSERT in transaction). This works but has a race condition window with concurrent bookings for the same slot. PostgreSQL advisory locks on `(professional_id, slot)` should be used inside the transaction to prevent double-booking under concurrent load. At 1000 orgs this becomes relevant during morning peak hours.

---

#### Order Close + Commission Calculation

```
Atendente/Professional initiates closeOrder mutation
  │
  ▼ mutation closeOrder(input: { orderId, payments[] })
CloseOrderUseCase.execute()
  │
  ├── BEGIN TRANSACTION
  │
  ├── Load order + order_items (RLS-scoped)
  ├── Validate: sum(payments) >= order.total - order.paid
  ├── Validate: order.status == 'open'
  │
  ├── For each payment in input:
  │     INSERT payments (order_id, amount, method, paid_at)
  │     UPDATE orders SET paid = paid + payment.amount
  │
  ├── If order fully paid:
  │     UPDATE orders SET status='closed', closed_at=NOW()
  │
  │     For each order_item (services only):
  │       Resolve commission rate:
  │         1. Check order_item.service.commission_type
  │         2. If 'inherit': use member.commission_type / commission_value
  │         3. If 'percentage': amount = item.total * rate / 100
  │         4. If 'fixed': amount = fixed_value
  │       INSERT commissions (professional_id, order_item_id, amount, status='pending')
  │
  │     INSERT cashier_movements (inflow, total_payment_amount)
  │     UPDATE cashiers SET ... (if cashier tracking needed)
  │
  ├── INSERT outbox (OrderClosed payload: {orderId, orgId, items[], totalAmount})
  │
  └── COMMIT
        │
        ▼ [async]
  Outbox Worker
        │
        └── OrderClosed event → handlers:
              ├── CommissionsHandler (commissions module):
              │     [Commission rows already written in transaction above,
              │      handler may recalculate or just mark as 'approved']
              │
              ├── StockHandler (catalog module):
              │     For each product order_item:
              │       UPDATE products SET stock_quantity = stock_quantity - item.quantity
              │
              ├── FinancialCacheHandler:
              │     Invalidate Redis keys for daily/monthly financial panels
              │
              └── AppointmentStatusHandler (scheduling module):
                    If order.appointment_id IS NOT NULL:
                      UPDATE appointments SET status='completed'
```

**Design decision to document as ADR:** Commission rows are written inside the `closeOrder` transaction (not by the event handler). This is correct because:
- Commission data must be consistent with the order in the same transaction
- Commission rules at the time of service (not at time of payment report) are captured
- Avoids eventual consistency gap between order close and commission visibility

The `CommissionsHandler` on `OrderClosed` then handles downstream actions (notify professional, aggregate reports) — not the initial write.

**Commission rule resolution order (implicit in schema, needs explicit documentation):**
1. `order_item.service.commission_type` — service-level override
2. If `'inherit'` → fall back to `member.commission_type` / `commission_value`
3. If member has `'none'` → commission_amount = 0
4. Packages: apply commission to the package price proportionally, or per-service? **This is not specified in the PRDs — a gap that needs a decision before Phase 1 ships commissions.**

---

## Build Order (Dependency Analysis)

Module dependency graph (→ means "depends on"):

```
identity          [no domain deps — foundation]
catalog           → identity (org context only)
clients           → identity (org context)
scheduling        → identity, catalog, clients
pos               → identity, catalog, clients, scheduling
finance           → identity, pos
commissions       → identity, catalog, pos (via OrderClosed event)
contracts         → identity, catalog, clients (via BridalGroup)
communication     → identity, clients (consumes events from scheduling, pos, contracts)
reporting         → identity, pos, finance, commissions, contracts
intelligence      → clients, scheduling, contracts (reads data; calls Claude API)
audit             → all (cross-cutting, appends to log from any context)
```

**Recommended build sequence:**

### Foundation (build first — everything blocks on this)
1. **`core` + `database` + `auth`** — Prisma setup, RLS middleware, JWT, tenant context. Zero business logic but every module depends on it. Must be production-quality from day zero — retrofitting RLS is high-risk.

### Phase 1 core modules (MVP — weeks 1–12)
2. **`identity`** — Organizations, users, members, roles, permissions, subscription stubs. First functional module and the reference implementation for all others.
3. **`catalog`** — Categories, services, products, packages. Needed before any appointment or order can be created.
4. **`clients`** — Client profiles. BridalGroup can be a stub (just the entity, no bridal schedule logic) in Phase 1.
5. **`scheduling`** — Appointments, time blocks, availability check. Slot conflict detection must be correct before go-live.
6. **`pos`** — Orders, order items, close order with payment. The core revenue flow.
7. **`finance`** — Cashier, payments, payables. Tightly coupled to POS close flow.
8. **`commissions`** — Commission calculation triggered by OrderClosed. Simple percentage/fixed rules for MVP.
9. **`audit`** — Append-only audit log. Should be wired in Phase 1 for financial and config changes.
10. **`reporting`** (Phase 1 subset) — Basic financial dashboard. Can be built on direct PostgreSQL queries before ClickHouse exists.

### Phase 2 (Bridal differentiation — weeks 13–20)
11. **`contracts`** — Event contracts, installments, payment deadlines. Requires `clients` (BridalGroup) and `finance` (payments).
12. **`clients`** (BridalGroup full) — Bridal group members, schedule planning. Requires `scheduling` and `catalog` (service durations).

### Phase 3 (Communication — weeks 21–28)
13. **`communication`** — WhatsApp reminders, campaigns. Purely reactive; consumes events. Requires WhatsApp Cloud API integration. Can be partially implemented in Phase 1 (appointment confirmation) but full campaign engine is Phase 3.

### Phase 4 (Intelligence and Scale — weeks 29–40)
14. **`intelligence`** — Claude API integration, demand forecasting, operational alerts. Requires historical data from `scheduling`, `pos`, `contracts`. Cannot deliver value without several months of data.
15. **`reporting`** (full) — ClickHouse integration, materialized views, exportable dashboards.

**Critical path dependencies:**

- `pos` cannot ship without `catalog` (service/product pricing), `clients` (who is buying), and `scheduling` (which appointment does this order relate to). These must be in the same phase.
- `commissions` requires `pos` to be complete — the trigger is `OrderClosed`. Building it in the same sprint as POS close is natural.
- `contracts` requires `clients.BridalGroup` to exist, but BridalGroup can be simplified for Phase 1 (no schedule planning, just the grouping).
- `communication` WhatsApp integration requires Meta Business Account setup and template approval (~1–2 week lead time). Start the approval process 4 weeks before Phase 3 begins.

---

## Scale Analysis

### Risks at 250–1000 Organisations

**Risk 1: Appointment table query latency under concurrent load — MEDIUM severity**

At 1000 orgs with 30 appointments/day/org, the appointments table accumulates 9.3M rows/year. The agenda view (load all appointments for org X on day Y) executes the most frequent query in the system.

The composite index `ix_appointments_org_starts` covers this pattern, but with RLS also evaluating `organization_id = current_setting(...)::uuid`, the planner must cast the setting string to UUID on every row evaluated. This is cheap individually but adds up under concurrent load.

Mitigation: benchmark with k6 at 500 concurrent users loading their agenda before Phase 3 go-live. If P95 degrades beyond 300ms, switch from `current_setting()::uuid` cast to a prepared statement with typed parameter.

**Risk 2: Outbox worker single point of failure — LOW severity (easily mitigated)**

The outbox worker is a single BullMQ processor. If it falls behind (e.g., WhatsApp API is slow), events queue up. At 200,000 events/day, a 1-hour outage creates a 8,300-event backlog.

The outbox queue uses `priority: 'critical'` with infinite retries, which is correct. The additional mitigation is to run 2–3 outbox worker instances (BullMQ supports concurrent workers on the same queue). This is trivial to configure.

**Risk 3: Redis as single-point-of-failure for sessions AND queues — MEDIUM severity**

Redis holds: BullMQ queues, session cache, permission cache, pub/sub for subscriptions, and outbox worker coordination. A Redis failure causes: job processing stops, GraphQL subscriptions die, permission checks degrade to DB queries, and session cache miss forces DB lookups.

At 250+ orgs, Redis Sentinel (or a managed Redis cluster like Upstash or ElastiCache) is recommended. The PRD plans a VPS start — add Redis Sentinel to the Docker Compose setup before Phase 1 production launch.

**Risk 4: PgBouncer session variable leakage — HIGH severity if not validated**

Transaction pooling is required for `SET LOCAL` to work correctly. If the PgBouncer configuration ever reverts to session pooling (e.g., after an upgrade or misconfiguration), `app.current_organization` variables would persist between requests, breaking tenant isolation silently.

Mitigation: the tenant isolation test suite (SDD Section 3.6) must explicitly test that PgBouncer is in transaction mode and that concurrent requests for different orgs never see each other's data. Add this assertion to the CI smoke test that runs against the staging environment.

**Risk 5: Commission calculation correctness at scale — HIGH severity for business trust**

Commission errors are the #1 reason small salons distrust software. The rules have edge cases:
- Package commission: per service inside the package or on the package total?
- Multi-professional order: two professionals share one comanda — which items belong to which?
- Discount applied to a service: is commission calculated on full price or discounted price?
- Partial order close: client pays a deposit today and the rest next week — when is commission triggered?

The PRD partially addresses these (order_item has `professional_id` and `commission_amount`), but the calculation rules for packages and partial payments are not explicitly specified. **These edge cases must be resolved and unit-tested before Phase 1 ships.**

**Risk 6: GraphQL N+1 in the bridal group schedule — LOW severity (addressed by DataLoaders)**

Loading a bridal group with 10 companions, each with 5 services, could trigger 50 catalog service queries if DataLoaders are not used. The PRD mandates DataLoaders for all related-field resolution. Verify that the `BridalSchedule` resolver uses DataLoaders before Phase 2 ships.

**Risk 7: Concurrent appointment booking (race condition) — MEDIUM severity**

Described in the Appointment Booking flow above. Two simultaneous booking requests for the same professional at the same time window both pass the SELECT availability check before either inserts. The transaction isolation level (READ COMMITTED by default in PostgreSQL) does not prevent this.

Mitigation options (in order of preference):
1. PostgreSQL advisory lock: `SELECT pg_try_advisory_xact_lock(professional_id_hash, slot_start_epoch)` inside the transaction. Lightweight, transactional (auto-released on commit/rollback).
2. Unique constraint on `(organization_id, professional_id, starts_at)` — rejects duplicate booking attempts with a constraint error.
3. Application-level Redis lock with TTL — adds a network round trip but works if DB-level locking is not preferred.

Option 1 is recommended. Add before Phase 1 go-live.

**Risk 8: LGPD anonimisation with financial history retention — MEDIUM severity**

The DB PRD (Section 10.4) correctly describes anonimisation: name becomes a hash, phone/email deleted, but financial records retained for 5 years. The challenge is that `order_items`, `payments`, `commissions` all reference `client_id`. After anonimisation, `clients.full_name` is hashed but the FK still exists.

The reporting module must handle the case where `clients.full_name` is a hash. Dashboard views that display "top 10 clients by revenue" should degrade gracefully for anonimised records.

**Infrastructure scale path:**

| Org count | Infra change required |
|-----------|----------------------|
| 0–100 | Single VPS with Docker Compose. PgBouncer. Redis. |
| 100–200 | Add streaming read replica. Move to Redis Sentinel. |
| 200–500 | Patroni for Postgres HA. `appointments` partitioning (if not pre-created). CDN for assets. |
| 500–1000 | ClickHouse for analytics (Phase 4 plan). Consider Kubernetes. Separate worker instances from API instances. |
| 1000+ | Re-evaluate multi-tenant model. Not needed within 3-year horizon. |

---

## Summary

1. **Shared DB / Shared Schema + RLS is validated** for the 1000-org scale target. The architecture handles the volume with standard PostgreSQL tuning. The PRDs correctly identify the inflection points (partitioning at 5M rows, read replica at 100 orgs, ClickHouse at Phase 4). No re-architecture needed.

2. **The 12 bounded contexts are correctly drawn** with one gap: a `billing`/`subscription` context is missing. Subscription management will leak into `identity` without an explicit boundary. Add it as a planned context even if the MVP implementation is minimal.

3. **The Outbox Pattern is correctly designed**, but the `outbox` table definition is absent from the DB PRD — a concrete gap that will cause the table to be built without RLS or proper indexes. Define it explicitly in the schema before Phase 1 work begins.

4. **Build order is dictated by clear dependencies**: `identity` → `catalog` → `clients` → `scheduling` + `pos` + `finance` + `commissions` must all ship together in Phase 1. They form a single cohesive transaction loop (book → attend → pay → commission). Attempting to ship scheduling without POS, or POS without commissions, delivers a system that salon owners cannot use in production.

5. **Three risks need resolution before Phase 1 production go-live**: (a) advisory locks for concurrent appointment booking, (b) PgBouncer transaction-mode validation in CI, and (c) commission edge-case rules for packages and partial payments must be fully specified and unit-tested. These are the most likely causes of a rewrite at scale if left unaddressed.
