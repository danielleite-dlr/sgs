---
phase: 03-core-operations
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/backend/prisma/migrations/20261101000000_phase3_operations/migration.sql
  - apps/backend/prisma/schema.prisma
  - apps/backend/src/authz/permissions.catalog.ts
  - apps/backend/src/common/money.ts
  - apps/backend/src/common/money.spec.ts
  - apps/backend/src/comandas/comandas.module.ts
  - apps/backend/src/financial/financial.module.ts
  - apps/backend/src/app.module.ts
  - apps/backend/test/integration/phase3-schema-smoke.e2e.spec.ts
  - apps/backend/test/integration/helpers/phase3-fixtures.ts
  - apps/backend/test/integration/helpers/phase3-cleanup.ts
  - apps/backend/test/integration/members-lifecycle.e2e.spec.ts
  - apps/backend/test/integration/members.e2e.spec.ts
  - apps/backend/test/integration/professional-categories.e2e.spec.ts
  - .planning/REQUIREMENTS.md
autonomous: true
requirements: [SCHED-01, SCHED-03, SCHED-04, POS-01, POS-02, POS-03, FIN-01, FIN-02]

must_haves:
  truths:
    - "A migration da fase 3 aplica sem erro sobre o banco atual (prisma migrate deploy)"
    - "A exclusion constraint de appointments protege os status scheduled, confirmed, in_progress e completed (23P01 ao sobrepor um in_progress)"
    - "As 9 tabelas novas têm ROW LEVEL SECURITY ENABLE + FORCE e a policy tenant_isolation"
    - "sgs_app não consegue UPDATE nem DELETE em commission_records, audit_log, cash_movements e client_credit_movements"
    - "As 8 permissões novas existem em PERMISSIONS, em ROLE_PERMISSIONS e em role_permissions no banco, com a mesma matriz"
    - "ComandasModule e FinancialModule vazios estão registrados no AppModule e o backend sobe"
    - "As suítes de integração existentes que apagam appointments continuam verdes depois que appointments passam a ter comanda"
  artifacts:
    - path: "apps/backend/prisma/migrations/20261101000000_phase3_operations/migration.sql"
      provides: "DDL de time_blocks, comandas, comanda_sequences, comanda_items, comanda_payments, client_credit_movements, cash_movements, commission_records, audit_log + ALTER appointments/stock_movements + RLS + REVOKE + seed de permissões"
      contains: "ex_appointments_professional_interval"
    - path: "apps/backend/prisma/schema.prisma"
      provides: "Modelos Prisma TimeBlock, Comanda, ComandaSequence, ComandaItem, ComandaPayment, ClientCreditMovement, CashMovement, CommissionRecord, AuditLog"
      contains: "model CommissionRecord"
    - path: "apps/backend/src/common/money.ts"
      provides: "toCents, fromCents, splitProportional, parseMoneyInput"
      exports: ["toCents", "fromCents", "splitProportional", "parseMoneyInput"]
    - path: "apps/backend/test/integration/helpers/phase3-fixtures.ts"
      provides: "createPhase3World(): org + membros por papel + tokens + cliente + categoria + serviço + produto + regra"
      exports: ["createPhase3World", "gqlAs"]
    - path: "apps/backend/test/integration/helpers/phase3-cleanup.ts"
      provides: "deletePhase3Rows(orgFilterSql) na ordem de FK"
      exports: ["deletePhase3Rows"]
  key_links:
    - from: "apps/backend/src/authz/permissions.catalog.ts"
      to: "role_permissions (seed na migration)"
      via: "mesma matriz nas duas fontes"
      pattern: "comanda\\.reopen"
    - from: "migration RLS policies"
      to: "TenantContextService SET LOCAL"
      via: "current_setting('app.current_organization')"
      pattern: "nullif\\(current_setting\\('app.current_organization'"
---

<objective>
Criar toda a fundação de banco da Fase 3 numa migration única (padrão da Fase 2): tabelas de agenda (bloqueios), comanda, pagamentos, crédito de cliente, caixa, comissões e auditoria; alargar a exclusion constraint de `appointments`; REVOKE de UPDATE/DELETE nos ledgers; seed das permissões novas. Também pré-montar os arquivos compartilhados (schema.prisma, permissions.catalog.ts, app.module.ts com módulos vazios, helper de dinheiro, fixtures/cleanup de teste) para que os planos da wave 2 rodem em paralelo sem conflito.

Purpose: os planos 03-03, 03-04 e 03-05 (wave 2) dependem do mesmo schema e das mesmas permissões. Este plano é dono de todos os arquivos transversais de backend.
Output: 1 migration, schema.prisma atualizado, catálogo de permissões, `src/common/money.ts` testado, módulos vazios registrados, smoke test do schema, fixtures e cleanup para as ~12 suítes novas, cleanups antigos ajustados, nota de redução de escopo do POS-02 no REQUIREMENTS.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-core-operations/03-CONTEXT.md
@.planning/phases/03-core-operations/03-RESEARCH.md
@apps/backend/prisma/schema.prisma
@apps/backend/prisma/migrations/20260919113000_appointments/migration.sql
@apps/backend/prisma/migrations/20260506000000_phase2_catalog_clients/migration.sql
@apps/backend/prisma/migrations/20260506010000_seed_phase2_permissions/migration.sql
@apps/backend/src/authz/permissions.catalog.ts
@apps/backend/src/app.module.ts

**Ambiente de execução (vale para todos os comandos deste plano):**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
# .env tem DATABASE_URL com '&' sem aspas: carregar linha a linha, nunca `source .env`
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
# pnpm não está no PATH: sempre `corepack pnpm ...`
```
Branch: `master`. Gate antes de cada commit de task: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test`. Nunca usar `test:e2e` do backend (config inexistente). Suítes de integração novas se chamam `phase3-*.e2e.spec.ts`.

<interfaces>
Convenções já existentes (copiar):
- id: `UUID NOT NULL DEFAULT gen_uuid_v7()`; Prisma `@id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid`
- timestamps: `TIMESTAMPTZ(6)`; `created_at/updated_at DEFAULT NOW()`; trigger `fn_set_updated_at()` (já existe) via `CREATE TRIGGER tg_<tabela>_before_update BEFORE UPDATE ON <tabela> FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();`
- dinheiro: `NUMERIC(12,2)` / Prisma `Decimal @db.Decimal(12, 2)`; GraphQL expõe `String` "80.00"
- RLS (copiar literalmente para cada tabela nova):
  ```sql
  ALTER TABLE {t} ENABLE ROW LEVEL SECURITY;
  ALTER TABLE {t} FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON {t}
    USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
    WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);
  ```
- `ALTER DEFAULT PRIVILEGES` já concede SELECT/INSERT/UPDATE/DELETE ao `sgs_app` em tabelas novas — por isso o REVOKE explícito é obrigatório nos ledgers.
- Constraint atual (a ser recriada): `ex_appointments_professional_interval EXCLUDE USING gist (organization_id WITH =, professional_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status IN ('scheduled','confirmed'))`; CHECK atual `chk_appointments_status`.
- Papéis de sistema: `SELECT id FROM roles WHERE name='ADMIN' AND is_system=true` (idem MANAGER/ATTENDANT/PROFESSIONAL).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migration única da Fase 3 (tabelas, constraint recriada, RLS, REVOKE, seed de permissões)</name>
  <files>apps/backend/prisma/migrations/20261101000000_phase3_operations/migration.sql</files>
  <read_first>
    - apps/backend/prisma/migrations/20260919113000_appointments/migration.sql (constraint e CHECK atuais, RLS, bloco DO $$ de permissões)
    - apps/backend/prisma/migrations/20260506000000_phase2_catalog_clients/migration.sql (estilo de CONSTRAINT pk_/fk_/uq_/chk_, índices, triggers, bloco IF EXISTS pg_roles 'sgs_app')
    - apps/backend/prisma/migrations/20260506010000_seed_phase2_permissions/migration.sql (seed idempotente ON CONFLICT DO NOTHING)
    - .planning/phases/03-core-operations/03-RESEARCH.md seção "Modelo de dados"
  </read_first>
  <action>
Criar `apps/backend/prisma/migrations/20261101000000_phase3_operations/migration.sql` com as seções abaixo, nesta ordem (todas as tabelas com o estilo de nomes de constraint `pk_`, `fk_`, `uq_`, `chk_`, `ix_` da Fase 2):

**A. ALTER appointments (D-01 ajustado, D-03, D-15):**
```sql
ALTER TABLE appointments
  ADD COLUMN comanda_id UUID NULL,
  ADD COLUMN service_variant_id UUID NULL,
  ADD COLUMN deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN cancel_reason TEXT NULL,
  ADD COLUMN cancel_reason_tag VARCHAR(30) NULL,
  ADD COLUMN cancelled_at TIMESTAMPTZ(6) NULL,
  ADD COLUMN cancelled_by UUID NULL;
ALTER TABLE appointments DROP CONSTRAINT chk_appointments_status;
ALTER TABLE appointments ADD CONSTRAINT chk_appointments_status
  CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled','no_show'));
ALTER TABLE appointments ADD CONSTRAINT chk_appointments_deposit CHECK (deposit_amount >= 0);
ALTER TABLE appointments DROP CONSTRAINT ex_appointments_professional_interval;
ALTER TABLE appointments ADD CONSTRAINT ex_appointments_professional_interval EXCLUDE USING gist (
  organization_id WITH =,
  professional_id WITH =,
  tstzrange(starts_at, ends_at, '[)') WITH &&
) WHERE (status IN ('scheduled','confirmed','in_progress','completed'));
```

**B. `time_blocks` (D-02, D-25):** colunas `id, organization_id UUID NOT NULL, professional_id UUID NULL, kind VARCHAR(20) NOT NULL, starts_at TIMESTAMPTZ(6) NOT NULL, ends_at TIMESTAMPTZ(6) NOT NULL, all_day BOOLEAN NOT NULL DEFAULT false, note TEXT NULL, created_by UUID NULL, created_at, updated_at`. Constraints: `fk_time_blocks_organization` → organizations(id); `fk_time_blocks_professional` → members(id); `fk_time_blocks_created_by` → members(id); `chk_time_blocks_kind CHECK (kind IN ('folga','intervalo','feriado','indisponibilidade'))`; `chk_time_blocks_scope CHECK ((kind = 'feriado') = (professional_id IS NULL))`; `chk_time_blocks_interval CHECK (ends_at > starts_at)`. Índice `ix_time_blocks_org_prof_starts ON time_blocks(organization_id, professional_id, starts_at)`. Trigger `tg_time_blocks_before_update`.

**C. `comandas` (D-05, D-19):** colunas `id, organization_id NOT NULL, code VARCHAR(20) NOT NULL, client_id UUID NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'open', total NUMERIC(12,2) NOT NULL DEFAULT 0, opened_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), opened_by UUID NULL, closed_at TIMESTAMPTZ(6) NULL, closed_by UUID NULL, close_cycle INTEGER NOT NULL DEFAULT 0, cancelled_at TIMESTAMPTZ(6) NULL, cancel_reason TEXT NULL, created_at, updated_at`. Constraints: fk organization, `fk_comandas_client` → clients(id), `fk_comandas_opened_by`/`fk_comandas_closed_by` → members(id), `uq_comandas_org_code UNIQUE (organization_id, code)`, `chk_comandas_status CHECK (status IN ('open','closed','cancelled'))`, `chk_comandas_total CHECK (total >= 0)`, `chk_comandas_closed CHECK ((status = 'closed') = (closed_at IS NOT NULL))`. Índices: `ix_comandas_org_status_opened (organization_id, status, opened_at)`, `ix_comandas_org_closed (organization_id, closed_at) WHERE status = 'closed'`, `ix_comandas_org_client (organization_id, client_id)`. Trigger `tg_comandas_before_update`.

**D. `comanda_sequences` (D-19, discrição: tabela contador em vez de SEQUENCE):** `organization_id UUID NOT NULL, year INTEGER NOT NULL, last_value INTEGER NOT NULL, CONSTRAINT pk_comanda_sequences PRIMARY KEY (organization_id, year)`, fk organization, `chk_comanda_sequences_value CHECK (last_value > 0)`.

**E. `comanda_items` (D-13, D-23):** colunas `id, organization_id NOT NULL, comanda_id UUID NOT NULL, kind VARCHAR(10) NOT NULL, service_id UUID NULL, service_variant_id UUID NULL, product_id UUID NULL, package_id UUID NULL, appointment_id UUID NULL, professional_id UUID NOT NULL, name_snapshot VARCHAR(200) NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, list_unit_price NUMERIC(12,2) NOT NULL, unit_price NUMERIC(12,2) NOT NULL, total NUMERIC(12,2) NOT NULL, created_by UUID NULL, created_at, updated_at`. `list_unit_price` = preço cheio/normal (variante aplicável ou base_price/sale_price); `unit_price` = preço cobrado (rateado se veio de pacote); `total = unit_price * quantity`. FKs: `comanda_id → comandas(id) ON DELETE CASCADE`, `service_id → services(id)`, `service_variant_id → service_pricing_variants(id) ON DELETE SET NULL`, `product_id → products(id)`, `package_id → packages(id)`, `appointment_id → appointments(id) ON DELETE SET NULL`, `professional_id → members(id)`, `created_by → members(id)`. CHECKs: `chk_comanda_items_kind CHECK (kind IN ('service','product'))`, `chk_comanda_items_ref CHECK ((kind = 'service' AND service_id IS NOT NULL AND product_id IS NULL) OR (kind = 'product' AND product_id IS NOT NULL AND service_id IS NULL))`, `chk_comanda_items_quantity CHECK (quantity > 0)`, `chk_comanda_items_prices CHECK (list_unit_price >= 0 AND unit_price >= 0 AND total >= 0)`. Índices `ix_comanda_items_comanda (comanda_id)`, `ix_comanda_items_org_professional (organization_id, professional_id)`. Trigger `tg_comanda_items_before_update`.

**F. `comanda_payments` (D-07, D-09):** `id, organization_id NOT NULL, comanda_id UUID NOT NULL → comandas(id) ON DELETE CASCADE, method VARCHAR(20) NOT NULL, amount NUMERIC(12,2) NOT NULL, paid_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), member_id UUID NULL → members(id), created_at`. CHECKs `chk_comanda_payments_method CHECK (method IN ('cash','pix','credit_card','debit_card','transfer','client_credit'))`, `chk_comanda_payments_amount CHECK (amount > 0)`. Índice `ix_comanda_payments_comanda (comanda_id)`.

**G. `client_credit_movements` (D-03, D-11):** `id, organization_id NOT NULL, client_id UUID NOT NULL → clients(id), amount NUMERIC(12,2) NOT NULL, kind VARCHAR(30) NOT NULL, appointment_id UUID NULL → appointments(id), comanda_id UUID NULL → comandas(id), cycle INTEGER NULL, reason TEXT NULL, created_by UUID NULL → members(id), created_at`. CHECKs `chk_ccm_amount CHECK (amount <> 0)`, `chk_ccm_kind CHECK (kind IN ('deposit','manual_adjustment','consumption','reopen_refund'))`. Índice `ix_ccm_org_client (organization_id, client_id)`.

**H. `cash_movements` (D-07, D-22):** `id, organization_id NOT NULL, kind VARCHAR(20) NOT NULL, method VARCHAR(20) NOT NULL, amount NUMERIC(12,2) NOT NULL, comanda_id UUID NULL → comandas(id), appointment_id UUID NULL → appointments(id), client_id UUID NULL → clients(id), cycle INTEGER NULL, occurred_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), member_id UUID NULL → members(id), note TEXT NULL, created_at`. CHECKs `chk_cash_movements_kind CHECK (kind IN ('deposit_in','payment_in','change_out','reversal'))`, `chk_cash_movements_method CHECK (method IN ('cash','pix','credit_card','debit_card','transfer'))`, `chk_cash_movements_amount CHECK (amount <> 0)`. Índice `ix_cash_movements_org_occurred (organization_id, occurred_at)`.

**I. `commission_records` (D-12, D-14 esclarecido, D-23, D-24):** `id, organization_id NOT NULL, comanda_id UUID NOT NULL → comandas(id), comanda_item_id UUID NOT NULL (SEM FK — o item pode ser removido depois de uma reabertura; o snapshot guarda o nome), member_id UUID NOT NULL → members(id), kind VARCHAR(10) NOT NULL, cycle INTEGER NOT NULL, base_amount NUMERIC(12,2) NOT NULL, charged_amount NUMERIC(12,2) NOT NULL, rule_id UUID NULL (SEM FK — regra pode ser apagada), rule_kind VARCHAR(20) NULL, rule_value NUMERIC(12,4) NULL, no_rule BOOLEAN NOT NULL DEFAULT false, rule_snapshot JSONB NOT NULL, calculated_amount NUMERIC(12,2) NOT NULL, reverses_record_id UUID NULL → commission_records(id), calculated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), created_at`. CHECKs: `chk_cr_kind CHECK (kind IN ('accrual','reversal'))`, `chk_cr_rule_kind CHECK (rule_kind IS NULL OR rule_kind IN ('fixed','percentage'))`, `chk_cr_no_rule CHECK (no_rule = (rule_kind IS NULL))`, `chk_cr_no_rule_zero CHECK (no_rule = false OR calculated_amount = 0)`, `chk_cr_reversal CHECK ((kind = 'reversal') = (reverses_record_id IS NOT NULL))`. `uq_cr_item_cycle_kind UNIQUE (comanda_item_id, cycle, kind)`. Índices `ix_cr_org_calculated (organization_id, calculated_at)`, `ix_cr_org_member_calculated (organization_id, member_id, calculated_at)`, `ix_cr_comanda (comanda_id)`. **Sem colunas `reversed_at`/`reversed_by_record_id`** (estorno é derivado de existir um `reversal` com `reverses_record_id`).

**J. `audit_log` (D-08, discrição: tabela genérica):** `id, organization_id NOT NULL, actor_member_id UUID NULL → members(id), action VARCHAR(60) NOT NULL, entity_type VARCHAR(40) NOT NULL, entity_id UUID NOT NULL, reason TEXT NULL, metadata JSONB NOT NULL DEFAULT '{}', created_at`. Índice `ix_audit_log_org_entity (organization_id, entity_type, entity_id)`.

**K. ALTER stock_movements (D-21):** `ALTER TABLE stock_movements ADD COLUMN comanda_id UUID NULL;` + `CONSTRAINT fk_stock_movements_comanda FOREIGN KEY (comanda_id) REFERENCES comandas(id) ON DELETE SET NULL` + índice `ix_sm_comanda (comanda_id)`.

**L. FKs que dependem de comandas:** `ALTER TABLE appointments ADD CONSTRAINT fk_appointments_comanda FOREIGN KEY (comanda_id) REFERENCES comandas(id) ON DELETE SET NULL, ADD CONSTRAINT fk_appointments_service_variant FOREIGN KEY (service_variant_id) REFERENCES service_pricing_variants(id) ON DELETE SET NULL, ADD CONSTRAINT fk_appointments_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES members(id);` + `CREATE INDEX ix_appointments_comanda ON appointments(comanda_id);`

**M. RLS** (bloco literal da interface) para: `time_blocks, comandas, comanda_sequences, comanda_items, comanda_payments, client_credit_movements, cash_movements, commission_records, audit_log`.

**N. Imutabilidade (D-14):**
```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN
    REVOKE UPDATE, DELETE ON commission_records FROM sgs_app;
    REVOKE UPDATE, DELETE ON audit_log FROM sgs_app;
    REVOKE UPDATE, DELETE ON cash_movements FROM sgs_app;
    REVOKE UPDATE, DELETE ON client_credit_movements FROM sgs_app;
  END IF;
END $$;
```
Não criar trigger de bloqueio (quebraria o cleanup dos testes, que usa `sgs_migrator`).

**O. Seed de permissões (D-20)** — bloco `DO $$ DECLARE v_admin uuid; v_manager uuid; v_attendant uuid; v_professional uuid; BEGIN ... INSERT INTO role_permissions (role_id, permission) VALUES ... ON CONFLICT DO NOTHING; END $$;` com exatamente esta matriz:
- ADMIN: `comanda.read, comanda.write, comanda.close, comanda.reopen, credit.read, credit.adjust, financial.read, commissionRecord.read`
- MANAGER: `comanda.read, comanda.write, comanda.close, comanda.reopen, credit.read, credit.adjust, financial.read, commissionRecord.read`
- ATTENDANT: `comanda.read, comanda.write, comanda.close, credit.read`
- PROFESSIONAL: `comanda.read, commissionRecord.read`
(`appointment.read/write` já existem; bloqueios e cancelamento reaproveitam `appointment.write`. "commission.adjust" de D-20 = `commission.write` já existente, só ADMIN.)

Aplicar: `cd apps/backend && corepack pnpm prisma:migrate:deploy`.
  </action>
  <verify>
    <automated>cd /root/sgs/apps/backend && corepack pnpm prisma:migrate:deploy && psql "$DIRECT_URL" -Atc "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='ex_appointments_professional_interval'" | grep -q "in_progress"</automated>
  </verify>
  <acceptance_criteria>
    - Arquivo contém `WHERE (status IN ('scheduled','confirmed','in_progress','completed'))`
    - Arquivo contém `CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled','no_show'))`
    - `grep -c "FORCE ROW LEVEL SECURITY" migration.sql` retorna 9
    - Arquivo contém `REVOKE UPDATE, DELETE ON commission_records FROM sgs_app;` e as outras 3 linhas REVOKE
    - Arquivo contém `uq_cr_item_cycle_kind UNIQUE (comanda_item_id, cycle, kind)` e `chk_cr_no_rule_zero`
    - Arquivo contém `(v_attendant, 'comanda.close')` e não contém `(v_attendant, 'comanda.reopen')`
    - Arquivo não contém `reversed_at`
    - `prisma migrate deploy` termina com "All migrations have been successfully applied" ou "No pending migrations"
  </acceptance_criteria>
  <done>Migration aplicada no banco local; constraint alargada; 9 tabelas com RLS; ledgers sem UPDATE/DELETE para sgs_app; permissões semeadas.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: schema.prisma, catálogo de permissões, money.ts e módulos vazios registrados</name>
  <files>apps/backend/prisma/schema.prisma, apps/backend/src/authz/permissions.catalog.ts, apps/backend/src/common/money.ts, apps/backend/src/common/money.spec.ts, apps/backend/src/comandas/comandas.module.ts, apps/backend/src/financial/financial.module.ts, apps/backend/src/app.module.ts</files>
  <read_first>
    - apps/backend/prisma/schema.prisma (modelos Appointment, StockMovement, Organization, Member, Client, Service, Product, Package, ServicePricingVariant)
    - apps/backend/src/authz/permissions.catalog.ts
    - apps/backend/src/app.module.ts
    - apps/backend/src/appointments/appointments.module.ts (forma de módulo com DatabaseModule + AuthzModule)
    - apps/backend/src/catalog/packages/packages.service.ts (como a Fase 2 já soma/rateia em centavos — manter compatível)
  </read_first>
  <behavior>
    - toCents("80.00") === 8000; toCents("80") === 8000; toCents("80.5") === 8050; toCents(new Prisma.Decimal("12.34")) === 1234; toCents("-5.00") === -500
    - fromCents(8050) === "80.50"; fromCents(0) === "0.00"; fromCents(-500) === "-5.00"
    - parseMoneyInput("50.00") === 5000; parseMoneyInput("50,00") lança/retorna null (só formato backend "^\d+(\.\d{1,2})?$"); parseMoneyInput("0") === 0; parseMoneyInput("abc") === null
    - splitProportional([8000, 2000], 9000) === [7200, 1800] (soma exata = 9000)
    - splitProportional([3333, 3333, 3334], 10000) soma exatamente 10000, resto vai no último elemento
    - splitProportional([0, 0], 1000) === [0, 1000] (pesos zerados: tudo no último)
  </behavior>
  <action>
**schema.prisma** — adicionar modelos (nomes de campo camelCase com `@map` snake_case e `@@map` da tabela, como no resto do arquivo):
- `TimeBlock` (@@map "time_blocks"): id, organizationId, professionalId String? , kind String @db.VarChar(20), startsAt, endsAt, allDay Boolean @default(false), note String?, createdBy String? @db.Uuid (escalar, sem relação), createdAt, updatedAt. Relações: organization, `professional Member? @relation("TimeBlockProfessional", fields: [professionalId], references: [id])`.
- `Comanda` (@@map "comandas"): id, organizationId, code String @db.VarChar(20), clientId, status String @default("open") @db.VarChar(20), total Decimal @default(0) @db.Decimal(12,2), openedAt, openedBy String? @db.Uuid, closedAt DateTime?, closedBy String? @db.Uuid, closeCycle Int @default(0), cancelledAt DateTime?, cancelReason String?, createdAt, updatedAt. Relações: organization, client, `items ComandaItem[]`, `payments ComandaPayment[]`, `appointments Appointment[]`, `commissionRecords CommissionRecord[]`, `creditMovements ClientCreditMovement[]`, `cashMovements CashMovement[]`, `stockMovements StockMovement[]`. `@@unique([organizationId, code], name: "uq_comandas_org_code")`.
- `ComandaSequence` (@@map "comanda_sequences"): organizationId, year Int, lastValue Int @map("last_value"); `@@id([organizationId, year])`; relação organization.
- `ComandaItem` (@@map "comanda_items"): todos os campos da tabela; `listUnitPrice/unitPrice/total Decimal @db.Decimal(12,2)`; relações comanda (onDelete: Cascade), service?, serviceVariant? (`ServicePricingVariant`), product?, package?, appointment? , `professional Member @relation("ComandaItemProfessional", ...)`. `createdBy` escalar.
- `ComandaPayment` (@@map "comanda_payments"): id, organizationId, comandaId, method, amount Decimal(12,2), paidAt, memberId String? (escalar), createdAt; relação comanda (Cascade).
- `ClientCreditMovement` (@@map "client_credit_movements"): campos da tabela; relações client, appointment?, comanda?; `createdBy` escalar.
- `CashMovement` (@@map "cash_movements"): campos; relações comanda?, appointment?, client?; `memberId` escalar.
- `CommissionRecord` (@@map "commission_records"): campos; `ruleSnapshot Json @db.JsonB`; `ruleValue Decimal? @db.Decimal(12,4)`; relações comanda, `member Member @relation("CommissionRecordMember", ...)`, `reverses CommissionRecord? @relation("CommissionReversal", fields: [reversesRecordId], references: [id])` + `reversedBy CommissionRecord[] @relation("CommissionReversal")`. `comandaItemId`/`ruleId` escalares.
- `AuditLog` (@@map "audit_log"): campos; `metadata Json @default("{}") @db.JsonB`; `actorMemberId` escalar.
- `Appointment`: + `comandaId String? @map("comanda_id") @db.Uuid`, `serviceVariantId String?`, `depositAmount Decimal @default(0) @map("deposit_amount") @db.Decimal(12,2)`, `cancelReason String?`, `cancelReasonTag String? @db.VarChar(30)`, `cancelledAt DateTime?`, `cancelledBy String? @db.Uuid` (escalar); relações `comanda Comanda?` (onDelete: SetNull), `serviceVariant ServicePricingVariant?` (SetNull), `comandaItems ComandaItem[]`, `creditMovements ClientCreditMovement[]`, `cashMovements CashMovement[]`.
- `StockMovement`: + `comandaId String? @map("comanda_id") @db.Uuid` + relação `comanda Comanda?` (SetNull).
- Adicionar os campos inversos em Organization (todas as listas), Member (`timeBlocks @relation("TimeBlockProfessional")`, `comandaItems @relation("ComandaItemProfessional")`, `commissionRecords @relation("CommissionRecordMember")`), Client (`comandas`, `creditMovements`, `cashMovements`), Service/Product/Package/ServicePricingVariant (`comandaItems`, e `appointments` em ServicePricingVariant).
Rodar `corepack pnpm --filter @sgs/backend prisma:generate`.

**permissions.catalog.ts** — adicionar na seção `// ===== Phase 3: Operations =====`:
`COMANDA_READ: 'comanda.read', COMANDA_WRITE: 'comanda.write', COMANDA_CLOSE: 'comanda.close', COMANDA_REOPEN: 'comanda.reopen', CREDIT_READ: 'credit.read', CREDIT_ADJUST: 'credit.adjust', FINANCIAL_READ: 'financial.read', COMMISSION_RECORD_READ: 'commissionRecord.read'`. Em `ROLE_PERMISSIONS`, acrescentar exatamente a matriz da Task 1 (ADMIN e MANAGER: as 8; ATTENDANT: COMANDA_READ, COMANDA_WRITE, COMANDA_CLOSE, CREDIT_READ; PROFESSIONAL: COMANDA_READ, COMMISSION_RECORD_READ). Atualizar o comentário de cabeçalho citando a migration `20261101000000_phase3_operations`.

**src/common/money.ts** (helpers puros, usados por comandas e financial; nunca somar dinheiro em float):
```ts
import { Prisma } from '@prisma/client';
export type MoneyLike = string | number | Prisma.Decimal;
/** "80.50" | Decimal | 80.5 → 8050 (centavos inteiros, half-up). */
export function toCents(v: MoneyLike): number;
/** 8050 → "80.50"; aceita negativo. */
export function fromCents(cents: number): string;
/** Entrada de API: só "^\d+(\.\d{1,2})?$" → centavos; senão null. */
export function parseMoneyInput(s: string): number | null;
/** Rateia `totalCents` proporcional a `weights` (centavos); floor em cada parte e resto no último; pesos todos zero → tudo no último. */
export function splitProportional(weights: number[], totalCents: number): number[];
```
Implementar `toCents` via `new Prisma.Decimal(v).mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber()`. Escrever `money.spec.ts` com os casos do `<behavior>` primeiro (RED), depois implementar (GREEN).

**Módulos vazios** (mesma forma de `AppointmentsModule`): `src/comandas/comandas.module.ts` → `@Module({ imports: [DatabaseModule, AuthzModule], providers: [], exports: [] }) export class ComandasModule {}`; `src/financial/financial.module.ts` → `FinancialModule` idem. Registrar ambos em `app.module.ts` `imports[]` logo após `AppointmentsModule`. Os planos 03-04 e 03-05 preenchem providers sem tocar `app.module.ts`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend prisma:generate && corepack pnpm --filter @sgs/backend test -- money && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^model " apps/backend/prisma/schema.prisma` aumentou em 9 (TimeBlock, Comanda, ComandaSequence, ComandaItem, ComandaPayment, ClientCreditMovement, CashMovement, CommissionRecord, AuditLog)
    - schema.prisma contém `@@map("commission_records")` e `depositAmount` e `@relation("CommissionReversal"`
    - permissions.catalog.ts contém `COMANDA_REOPEN: 'comanda.reopen'` e `COMMISSION_RECORD_READ: 'commissionRecord.read'`
    - `src/common/money.ts` exporta `toCents`, `fromCents`, `parseMoneyInput`, `splitProportional`
    - app.module.ts contém `ComandasModule` e `FinancialModule` no array imports
    - `corepack pnpm --filter @sgs/backend test -- money` passa com ≥ 6 testes
  </acceptance_criteria>
  <done>Prisma client gerado com os modelos novos, catálogo de permissões sincronizado com a migration, helpers de dinheiro testados, módulos vazios no AppModule.</done>
</task>

<task type="auto">
  <name>Task 3: Smoke test do schema, fixtures/cleanup de integração, ajuste dos cleanups existentes e nota POS-02</name>
  <files>apps/backend/test/integration/phase3-schema-smoke.e2e.spec.ts, apps/backend/test/integration/helpers/phase3-fixtures.ts, apps/backend/test/integration/helpers/phase3-cleanup.ts, apps/backend/test/integration/members-lifecycle.e2e.spec.ts, apps/backend/test/integration/members.e2e.spec.ts, apps/backend/test/integration/professional-categories.e2e.spec.ts, .planning/REQUIREMENTS.md</files>
  <read_first>
    - apps/backend/test/integration/setup.ts (adminPrisma = sgs_migrator, appPrisma = sgs_app)
    - apps/backend/test/integration/phase2-schema-smoke.spec.ts (modelo)
    - apps/backend/test/integration/professional-categories.e2e.spec.ts (bootstrap AppModule + FastifyAdapter + EMAIL_ADAPTER override, criação de org/membros/argon2/login, cleanup)
    - apps/backend/test/integration/members-lifecycle.e2e.spec.ts e members.e2e.spec.ts (linhas com `DELETE FROM appointments`)
    - apps/backend/src/authz/permissions.catalog.ts (ROLE_PERMISSIONS)
    - .planning/REQUIREMENTS.md (linha POS-02)
  </read_first>
  <action>
**helpers/phase3-cleanup.ts** — `export async function deletePhase3Rows(orgFilterSql: string): Promise<void>` onde `orgFilterSql` é um SELECT de ids de organização (ex.: `SELECT id FROM organizations WHERE legal_name LIKE 'procat-%'`). Executa via `adminPrisma.$executeRawUnsafe`, nesta ordem, cada um com `WHERE organization_id IN (${orgFilterSql})`: `commission_records`, `audit_log`, `cash_movements`, `client_credit_movements`, `comanda_payments`, `comanda_items`, `UPDATE stock_movements SET comanda_id = NULL`, `UPDATE appointments SET comanda_id = NULL`, `comandas`, `comanda_sequences`, `time_blocks`. (Só o teste chama isso; o texto do filtro é constante do próprio teste.)

**Cleanups existentes** — em `members-lifecycle.e2e.spec.ts` (2 lugares), `members.e2e.spec.ts` (2 lugares) e `professional-categories.e2e.spec.ts` (1 lugar), inserir `await deletePhase3Rows("SELECT id FROM organizations WHERE legal_name LIKE '<prefixo>-%'")` imediatamente ANTES de cada `DELETE FROM appointments ...`, usando o mesmo prefixo já usado na linha (`memlc`, `memlife-test`, `procat`). Motivo: a partir do 03-06 `createAppointment` abre comanda (D-05) e a FK `comandas.client_id` impediria apagar clients (Pitfall 12).

**helpers/phase3-fixtures.ts** — exportar:
```ts
export interface Phase3World {
  app: INestApplication; orgId: string; otherOrgId: string; prefix: string;
  members: { admin: string; manager: string; attendant: string; proA: string; proB: string }; // ids de member
  tokens: { admin: string; manager: string; attendant: string; proA: string; proB: string; otherAdmin: string };
  clientId: string; categoryId: string; childCategoryId: string;
  serviceId: string;      // base_price "100.00", 60 min, na childCategory
  serviceBId: string;     // base_price "50.00", 30 min, na childCategory
  variantId: string;      // variante "Sênior" de serviceId, price "120.00", seniority_tier 'senior'
  productId: string;      // sale_price "35.00", stock_quantity 10, min_stock_level 2
  packageId: string;      // price "135.00" com serviceId (qty 1) + serviceBId (qty 1)
}
export async function createPhase3World(prefix: string): Promise<Phase3World>;
export async function destroyPhase3World(w: Phase3World): Promise<void>; // deletePhase3Rows + mesmos DELETEs de professional-categories (appointments, clients, package_services, packages, commission_rules, service_pricing_variants, services, products, stock_movements, member_categories, members, refresh_tokens, users, categories, organizations) filtrando por legal_name LIKE `${prefix}-%`, depois app.close()
export function gqlAs(w: Phase3World, token: string): (query: string, variables?: Record<string, unknown>) => Promise<{ data?: any; errors?: { message: string; extensions?: any }[] }>;
```
Criar o app exatamente como `professional-categories.e2e.spec.ts` (Test.createTestingModule AppModule + override EMAIL_ADAPTER → TestEmailAdapter + FastifyAdapter + `getInstance().ready()`), orgs `${prefix}-org-a`/`${prefix}-org-b` (documentNumber único com `Date.now()`), usuários com `argon2.hash('password1234', {type: argon2id})`, `emailVerifiedAt: new Date()`, membros com papéis de sistema (proA/proB `isProfessional: true`, papel PROFESSIONAL; proA `seniorityTier: 'senior'`), login via mutation `login(input:{email,password})` para cada token. Não criar regras de comissão no world (cada suíte cria as suas).

**phase3-schema-smoke.e2e.spec.ts** (`describe('Phase 3 schema smoke')`, usa adminPrisma/appPrisma):
1. `pg_class.relforcerowsecurity = true` para as 9 tabelas novas.
2. `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='ex_appointments_professional_interval'` contém `in_progress` e `completed`.
3. Com fixture mínima (org+membro+cliente+serviço via adminPrisma, prefixo `p3smoke`): inserir appointment `status='in_progress'` 10:00–11:00 e tentar inserir outro `scheduled` 10:30–11:30 do mesmo profissional → rejeita com mensagem contendo `ex_appointments_professional_interval`.
4. `SELECT has_table_privilege('sgs_app', 'commission_records', 'UPDATE')` = false e `'DELETE'` = false; idem `audit_log`, `cash_movements`, `client_credit_movements`; `'INSERT'` = true.
5. Para cada papel de `ROLE_PERMISSIONS`, as permissões Phase 3 (`comanda.*`, `credit.*`, `financial.read`, `commissionRecord.read`) presentes em `role_permissions` do papel de sistema são exatamente as do catálogo TS (Pitfall 11).
6. Delegates `prisma.comanda`, `comandaItem`, `comandaPayment`, `commissionRecord`, `cashMovement`, `clientCreditMovement`, `timeBlock`, `auditLog`, `comandaSequence` existem.
Cleanup com `deletePhase3Rows` + deletes do prefixo `p3smoke`.

**REQUIREMENTS.md** — na linha do POS-02, acrescentar ao final: ` — **Fase 3 (redução de escopo aceita, D-09/D-10):** Pix por registro manual (sem QR/gateway, que vai para a Fase 5) e sem voucher; crédito na conta incluído.` Não marcar o checkbox.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern "phase3-schema-smoke|members|professional-categories"</automated>
  </verify>
  <acceptance_criteria>
    - `apps/backend/test/integration/phase3-schema-smoke.e2e.spec.ts` existe e passa (≥ 6 `it`)
    - `grep -c "deletePhase3Rows" apps/backend/test/integration/members-lifecycle.e2e.spec.ts` ≥ 2; em `members.e2e.spec.ts` ≥ 2; em `professional-categories.e2e.spec.ts` ≥ 1
    - `helpers/phase3-fixtures.ts` exporta `createPhase3World`, `destroyPhase3World`, `gqlAs`
    - `.planning/REQUIREMENTS.md` contém `redução de escopo aceita, D-09/D-10`
    - Suítes `members*`, `professional-categories` e `phase3-schema-smoke` verdes
  </acceptance_criteria>
  <done>Schema provado por teste (RLS, constraint, REVOKE, permissões), fixtures reutilizáveis prontos para as suítes da fase, cleanups antigos à prova das FKs novas, redução de escopo do POS-02 registrada.</done>
</task>

</tasks>

<verification>
Gate completo (ambiente da seção context): lint + typecheck + `test` + `test:integration` + frontend `test`, todos verdes. `prisma migrate deploy` idempotente (segunda execução: "No pending migrations").
</verification>

<success_criteria>
- Migration aplicada; 9 tabelas com RLS FORCE; constraint cobre 4 status ativos; ledgers append-only para sgs_app
- Catálogo TS = seed SQL (teste prova)
- money.ts testado; módulos vazios registrados; fixtures/cleanup disponíveis
- Nenhuma suíte existente regrediu
</success_criteria>

<output>
After completion, create `.planning/phases/03-core-operations/03-01-SUMMARY.md`
</output>
