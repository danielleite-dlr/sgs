---
phase: 04-bridal-contracts
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/backend/prisma/migrations/20261103000000_phase4_bridal_contracts/migration.sql
  - apps/backend/prisma/schema.prisma
  - apps/backend/src/authz/permissions.catalog.ts
  - apps/backend/src/config/env.schema.ts
  - apps/backend/src/config/app-config.service.ts
  - apps/backend/package.json
  - pnpm-lock.yaml
  - .env.example
  - apps/backend/src/app.module.ts
  - apps/backend/src/bridal/bridal.module.ts
  - apps/backend/src/bridal/ai/ai-schedule.module.ts
  - apps/backend/src/contracts/contracts.module.ts
  - apps/backend/src/contracts/payments/contract-payments.module.ts
  - apps/backend/src/contracts/acceptance/contract-acceptance.module.ts
  - apps/backend/src/contracts/alerts/contract-alerts.module.ts
  - apps/backend/test/integration/setup.ts
  - apps/backend/test/integration/helpers/phase4-fixtures.ts
  - apps/backend/test/integration/helpers/phase4-cleanup.ts
  - apps/backend/test/integration/phase4-schema-smoke.e2e.spec.ts
  - apps/backend/test/integration/phase4-job-orgs.e2e.spec.ts
  - .planning/REQUIREMENTS.md
autonomous: true
requirements: [CLI-03, CONT-01, CONT-02, CONT-03, AI-01]

must_haves:
  truths:
    - "A migration da fase 4 aplica sem erro sobre o banco atual (prisma migrate deploy)"
    - "As 13 tabelas novas têm ROW LEVEL SECURITY ENABLE + FORCE e a policy tenant_isolation"
    - "sgs_app não consegue UPDATE nem DELETE em contract_payments, contract_acceptances e contract_versions"
    - "job_list_active_orgs() chamada como sgs_app (sem tenant) devolve todas as orgs ativas"
    - "As 8 permissões novas existem em PERMISSIONS, ROLE_PERMISSIONS e role_permissions com a mesma matriz"
    - "Os 6 módulos novos (vazios) estão no AppModule e o backend sobe sem ANTHROPIC_API_KEY"
    - "As suítes de integração da fase 3 continuam verdes"
  artifacts:
    - path: "apps/backend/prisma/migrations/20261103000000_phase4_bridal_contracts/migration.sql"
      provides: "DDL de contract_settings, bridal_groups, bridal_group_members, bridal_member_services, contract_sequences, contracts, contract_items, contract_versions, contract_access_tokens, contract_acceptances, contract_payments, ai_schedule_suggestions, contract_alert_runs + ALTERs + RLS + REVOKE + função + seed"
      contains: "job_list_active_orgs"
    - path: "apps/backend/prisma/schema.prisma"
      provides: "Modelos Prisma das 13 tabelas novas + colunas novas"
      contains: "model ContractPayment"
    - path: "apps/backend/test/integration/helpers/phase4-fixtures.ts"
      provides: "createPhase4World + insertBridalGroupRow + insertContractRow"
      exports: ["createPhase4World", "destroyPhase4World", "insertBridalGroupRow", "insertContractRow", "gqlAs"]
  key_links:
    - from: "apps/backend/src/authz/permissions.catalog.ts"
      to: "role_permissions (seed na migration)"
      via: "mesma matriz nas duas fontes"
      pattern: "contract\\.cancel"
    - from: "migration RLS policies"
      to: "TenantContextService SET LOCAL"
      via: "current_setting('app.current_organization')"
      pattern: "nullif\\(current_setting\\('app.current_organization'"
---

<objective>
Criar toda a fundação de banco da Fase 4 numa migration única (padrão das fases 2 e 3) e pré-montar os arquivos transversais de backend (schema.prisma, catálogo de permissões, env, dependências novas, módulos vazios registrados, fixtures e cleanup de teste) para que os planos das waves 2–4 rodem em paralelo sem conflito de arquivo.

Purpose: todos os planos de backend da fase dependem do mesmo schema, das mesmas permissões e dos mesmos módulos. Este plano é dono de todos os arquivos transversais.
Output: 1 migration, schema.prisma, permissões, env (`ANTHROPIC_*`, `AI_SCHEDULE_DAILY_LIMIT`, `CONTRACT_ALERTS_SCHEDULER`), deps (`@anthropic-ai/sdk`, `pdfkit`, `@nestjs/throttler`), 6 módulos vazios, fixtures/cleanup, smoke do schema e teste da função de job.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@.planning/phases/04-bridal-contracts/04-RESEARCH.md
@apps/backend/prisma/schema.prisma
@apps/backend/prisma/migrations/20261101000000_phase3_operations/migration.sql
@apps/backend/prisma/migrations/20260918220000_auth_user_memberships_fn/migration.sql
@apps/backend/src/authz/permissions.catalog.ts
@apps/backend/src/app.module.ts
@apps/backend/test/integration/helpers/phase3-fixtures.ts

**Ambiente de execução (vale para todos os comandos deste plano):**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
# .env tem DATABASE_URL com '&' sem aspas: carregar linha a linha, nunca `source .env`
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
# pnpm não está no PATH: sempre `corepack pnpm ...`
```
Branch: `master`. Gate antes de cada commit de task: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test`. Nunca usar `test:e2e` do backend (config inexistente). Suítes de integração novas se chamam `phase4-*.e2e.spec.ts`. **Não rodar `pnpm update`** (bullmq 6 / @nestjs/bullmq 12 exigem Nest 12; @fastify/rate-limit 11 exige Fastify 5 — Pitfall 12).

<interfaces>
Convenções já existentes (copiar da migration 20261101000000_phase3_operations):
- id: `UUID NOT NULL DEFAULT gen_uuid_v7()`; Prisma `@id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid`
- timestamps `TIMESTAMPTZ(6)`, `created_at/updated_at DEFAULT NOW()`, trigger `CREATE TRIGGER tg_<t>_before_update BEFORE UPDATE ON <t> FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();`
- dinheiro `NUMERIC(12,2)` / Prisma `Decimal @db.Decimal(12, 2)`; GraphQL expõe `String` "80.00"
- nomes de constraint `pk_`, `fk_`, `uq_`, `chk_`, `ix_`
- RLS literal por tabela:
  ```sql
  ALTER TABLE {t} ENABLE ROW LEVEL SECURITY;
  ALTER TABLE {t} FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON {t}
    USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
    WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);
  ```
- `ALTER DEFAULT PRIVILEGES` já concede CRUD a `sgs_app` em tabelas novas → REVOKE explícito nos ledgers.
- CHECKs atuais a recriar: `chk_time_blocks_kind CHECK (kind IN ('folga','intervalo','feriado','indisponibilidade'))`; `chk_cash_movements_kind CHECK (kind IN ('deposit_in','payment_in','change_out','reversal'))`.
- `organizations` tem `status VARCHAR(20) DEFAULT 'active'` e `timezone VARCHAR(50)`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migration única da Fase 4 (tabelas, ALTERs, RLS, REVOKE, função de job, seed de permissões)</name>
  <files>apps/backend/prisma/migrations/20261103000000_phase4_bridal_contracts/migration.sql</files>
  <read_first>
    - apps/backend/prisma/migrations/20261101000000_phase3_operations/migration.sql (estilo, blocos M/N/O de RLS, REVOKE e seed)
    - apps/backend/prisma/migrations/20260918220000_auth_user_memberships_fn/migration.sql (formato SECURITY DEFINER + REVOKE/GRANT em DO $$)
    - .planning/phases/04-bridal-contracts/04-RESEARCH.md seção "Pattern 1: Modelo de dados"
    - .planning/phases/04-bridal-contracts/04-CONTEXT.md (D-01..D-25)
  </read_first>
  <action>
Criar `apps/backend/prisma/migrations/20261103000000_phase4_bridal_contracts/migration.sql` com as seções abaixo nesta ordem. Toda tabela nova tem `organization_id UUID NOT NULL` com `fk_<t>_organization → organizations(id)`.

**A. ALTER packages (D-12):** `ADD COLUMN deposit_kind VARCHAR(10) NULL, ADD COLUMN deposit_value NUMERIC(12,2) NULL`; `chk_packages_deposit CHECK ((deposit_kind IS NULL AND deposit_value IS NULL) OR (deposit_kind = 'fixed' AND deposit_value >= 0) OR (deposit_kind = 'percent' AND deposit_value >= 0 AND deposit_value <= 100))`.

**B. `contract_settings` (D-12, D-16, D-20, D-22, D-25):** `organization_id UUID PRIMARY KEY (pk_contract_settings)`, `balance_due_days_before INTEGER NOT NULL DEFAULT 10`, `template_body TEXT NULL` (NULL = modelo padrão do código), `cancellation_clause TEXT NULL` (NULL = cláusula padrão do código), `alert_deposit_unpaid_days INTEGER NOT NULL DEFAULT 3`, `alert_not_accepted_days INTEGER NOT NULL DEFAULT 3`, `alert_companion_deposit_days INTEGER NOT NULL DEFAULT 15`, `schedule_day_start TIME NOT NULL DEFAULT '06:00'`, `schedule_day_end TIME NOT NULL DEFAULT '20:00'`, `updated_by UUID NULL → members(id)`, `created_at`, `updated_at`. CHECKs: `chk_cs_due_days CHECK (balance_due_days_before BETWEEN 0 AND 365)`, `chk_cs_alert_days CHECK (alert_deposit_unpaid_days BETWEEN 0 AND 90 AND alert_not_accepted_days BETWEEN 0 AND 90 AND alert_companion_deposit_days BETWEEN 0 AND 365)`, `chk_cs_day_window CHECK (schedule_day_end > schedule_day_start)`. Trigger updated_at.

**C. `bridal_groups` (D-01, D-04):** `id, organization_id, name VARCHAR(160) NOT NULL, event_date DATE NOT NULL, ready_by TIMESTAMPTZ(6) NULL` (hora em que a noiva precisa estar pronta), `location_kind VARCHAR(10) NOT NULL DEFAULT 'studio'`, `location_address TEXT NULL`, `travel_minutes_before INTEGER NOT NULL DEFAULT 0`, `travel_minutes_after INTEGER NOT NULL DEFAULT 0`, `status VARCHAR(12) NOT NULL DEFAULT 'active'`, `notes TEXT NULL`, `cancelled_at TIMESTAMPTZ(6) NULL`, `cancel_reason TEXT NULL`, `created_by UUID NULL → members(id)`, `created_at`, `updated_at`. CHECKs: `chk_bg_location CHECK (location_kind IN ('studio','external'))`, `chk_bg_address CHECK (location_kind = 'studio' OR (location_address IS NOT NULL AND length(trim(location_address)) > 0))`, `chk_bg_travel CHECK (travel_minutes_before BETWEEN 0 AND 240 AND travel_minutes_after BETWEEN 0 AND 240)`, `chk_bg_status CHECK (status IN ('active','completed','cancelled'))`. Índice `ix_bg_org_event (organization_id, event_date)`. Trigger.

**D. `bridal_group_members` (D-02, D-06):** `id, organization_id, group_id UUID NOT NULL → bridal_groups(id) ON DELETE CASCADE, client_id UUID NOT NULL → clients(id), role VARCHAR(10) NOT NULL, relation_label VARCHAR(60) NULL, covered_by_contract BOOLEAN NOT NULL DEFAULT false, sort_order INTEGER NOT NULL DEFAULT 0, created_at, updated_at`. `chk_bgm_role CHECK (role IN ('bride','companion'))`, `uq_bgm_group_client UNIQUE (group_id, client_id)`, `CREATE UNIQUE INDEX uq_bgm_one_bride ON bridal_group_members(group_id) WHERE role = 'bride';`, índice `ix_bgm_org_client (organization_id, client_id)`. Trigger.

**E. `bridal_member_services` (D-01, D-05 — serviços planejados por pessoa, entrada da IA e do contrato):** `id, organization_id, group_member_id UUID NOT NULL → bridal_group_members(id) ON DELETE CASCADE, service_id UUID NOT NULL → services(id), purpose VARCHAR(10) NOT NULL DEFAULT 'event', sort_order INTEGER NOT NULL DEFAULT 0, created_at`. `chk_bms_purpose CHECK (purpose IN ('event','trial'))`, `uq_bms_member_service_purpose UNIQUE (group_member_id, service_id, purpose)`.

**F. `contract_sequences`:** `organization_id UUID NOT NULL, year INTEGER NOT NULL, last_value INTEGER NOT NULL, CONSTRAINT pk_contract_sequences PRIMARY KEY (organization_id, year)`, `chk_contract_sequences_value CHECK (last_value > 0)` (clone de comanda_sequences).

**G. `contracts` (D-06, D-10..D-12, D-15, D-19, D-22):** `id, organization_id, code VARCHAR(20) NOT NULL, bridal_group_id UUID NOT NULL → bridal_groups(id), bride_client_id UUID NOT NULL → clients(id), package_id UUID NULL → packages(id), status VARCHAR(20) NOT NULL DEFAULT 'draft', items_total NUMERIC(12,2) NOT NULL DEFAULT 0, discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0, total_amount NUMERIC(12,2) NOT NULL DEFAULT 0, deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0, balance_due_days_before INTEGER NOT NULL, balance_due_date DATE NOT NULL, cancellation_policy JSONB NOT NULL, current_version INTEGER NOT NULL DEFAULT 0, accepted_version INTEGER NULL, link_generated_at TIMESTAMPTZ(6) NULL, accepted_at TIMESTAMPTZ(6) NULL, cancelled_at TIMESTAMPTZ(6) NULL, cancelled_by UUID NULL → members(id), cancel_reason TEXT NULL, cancelled_by_party VARCHAR(10) NULL, created_by UUID NULL → members(id), created_at, updated_at`. CHECKs: `chk_contracts_status CHECK (status IN ('draft','awaiting_acceptance','active','completed','cancelled'))`, `chk_contracts_amounts CHECK (items_total >= 0 AND discount_amount >= 0 AND discount_amount <= items_total AND total_amount = items_total - discount_amount AND deposit_amount >= 0 AND deposit_amount <= total_amount)`, `chk_contracts_party CHECK (cancelled_by_party IS NULL OR cancelled_by_party IN ('client','studio'))`, `chk_contracts_cancelled CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))`. `uq_contracts_org_code UNIQUE (organization_id, code)`; `CREATE UNIQUE INDEX uq_contracts_group_live ON contracts(bridal_group_id) WHERE status <> 'cancelled';` (um contrato vivo por grupo); índice `ix_contracts_org_status (organization_id, status)`. Trigger.

**H. `contract_items` (D-09):** `id, organization_id, contract_id UUID NOT NULL → contracts(id) ON DELETE CASCADE, group_member_id UUID NOT NULL → bridal_group_members(id), service_id UUID NOT NULL → services(id), package_id UUID NULL → packages(id), description_snapshot VARCHAR(200) NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, unit_price NUMERIC(12,2) NOT NULL, total NUMERIC(12,2) NOT NULL, purpose VARCHAR(10) NOT NULL DEFAULT 'event', sort_order INTEGER NOT NULL DEFAULT 0, created_at, updated_at`. CHECKs `chk_ci_quantity CHECK (quantity > 0)`, `chk_ci_prices CHECK (unit_price >= 0 AND total = unit_price * quantity)`, `chk_ci_purpose CHECK (purpose IN ('event','trial'))`. Índice `ix_ci_contract (contract_id)`. Trigger.

**I. `contract_versions` (D-16, append-only):** `id, organization_id, contract_id UUID NOT NULL → contracts(id), version INTEGER NOT NULL, rendered_text TEXT NOT NULL, text_sha256 CHAR(64) NOT NULL, created_by UUID NULL → members(id), created_at`. `uq_cv_contract_version UNIQUE (contract_id, version)`, `chk_cv_version CHECK (version > 0)`.

**J. `contract_access_tokens` (D-23; NÃO é ledger — revoked_at é atualizado):** `id, organization_id, contract_id UUID NOT NULL → contracts(id), version_id UUID NOT NULL → contract_versions(id), token_hash CHAR(64) NOT NULL, expires_at TIMESTAMPTZ(6) NOT NULL, revoked_at TIMESTAMPTZ(6) NULL, created_by UUID NULL → members(id), created_at`. `uq_cat_token_hash UNIQUE (token_hash)`, índice `ix_cat_contract (contract_id)`.

**K. `contract_acceptances` (D-15, append-only):** `id, organization_id, contract_id UUID NOT NULL → contracts(id), version_id UUID NOT NULL → contract_versions(id), accepted_name VARCHAR(255) NOT NULL, accepted_cpf VARCHAR(11) NOT NULL, accepted_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), ip VARCHAR(45) NOT NULL, user_agent TEXT NULL, text_sha256 CHAR(64) NOT NULL, created_at`. `uq_ca_version UNIQUE (version_id)` (aceite duplo impossível sob corrida), `chk_ca_cpf CHECK (accepted_cpf ~ '^[0-9]{11}$')`.

**L. `contract_payments` (D-13, D-14, D-19, append-only):** `id, organization_id, contract_id UUID NOT NULL → contracts(id), kind VARCHAR(10) NOT NULL, method VARCHAR(20) NOT NULL, amount NUMERIC(12,2) NOT NULL` (assinado: payment > 0; refund/reversal < 0), `paid_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), member_id UUID NULL → members(id), reverses_payment_id UUID NULL → contract_payments(id), note TEXT NULL, created_at`. CHECKs `chk_cp_kind CHECK (kind IN ('payment','refund','reversal'))`, `chk_cp_method CHECK (method IN ('cash','pix','credit_card','debit_card','transfer'))`, `chk_cp_sign CHECK ((kind = 'payment' AND amount > 0) OR (kind IN ('refund','reversal') AND amount < 0))`, `chk_cp_reversal CHECK ((kind = 'reversal') = (reverses_payment_id IS NOT NULL))`. `CREATE UNIQUE INDEX uq_cp_reverses ON contract_payments(reverses_payment_id) WHERE reverses_payment_id IS NOT NULL;` índice `ix_cp_org_paid (organization_id, paid_at)`, `ix_cp_contract (contract_id)`.

**M. ALTERs de tabelas da fase 3:**
```sql
ALTER TABLE appointments
  ADD COLUMN bridal_group_id UUID NULL,
  ADD COLUMN contract_id UUID NULL,
  ADD COLUMN purpose VARCHAR(10) NULL,
  ADD CONSTRAINT fk_appointments_bridal_group FOREIGN KEY (bridal_group_id) REFERENCES bridal_groups(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_appointments_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_appointments_purpose CHECK (purpose IS NULL OR purpose IN ('event','trial'));
CREATE INDEX ix_appointments_bridal_group ON appointments(bridal_group_id) WHERE bridal_group_id IS NOT NULL;
ALTER TABLE time_blocks ADD COLUMN bridal_group_id UUID NULL,
  ADD CONSTRAINT fk_time_blocks_bridal_group FOREIGN KEY (bridal_group_id) REFERENCES bridal_groups(id) ON DELETE CASCADE;
ALTER TABLE time_blocks DROP CONSTRAINT chk_time_blocks_kind;
ALTER TABLE time_blocks ADD CONSTRAINT chk_time_blocks_kind CHECK (kind IN ('folga','intervalo','feriado','indisponibilidade','deslocamento'));
ALTER TABLE time_blocks ADD CONSTRAINT chk_time_blocks_travel CHECK ((kind = 'deslocamento') = (bridal_group_id IS NOT NULL));
ALTER TABLE cash_movements ADD COLUMN contract_id UUID NULL,
  ADD CONSTRAINT fk_cash_movements_contract FOREIGN KEY (contract_id) REFERENCES contracts(id);
ALTER TABLE cash_movements DROP CONSTRAINT chk_cash_movements_kind;
ALTER TABLE cash_movements ADD CONSTRAINT chk_cash_movements_kind CHECK (kind IN ('deposit_in','payment_in','change_out','reversal','contract_in','contract_refund'));
ALTER TABLE comanda_items ADD COLUMN contract_id UUID NULL,
  ADD CONSTRAINT fk_comanda_items_contract FOREIGN KEY (contract_id) REFERENCES contracts(id);
CREATE INDEX ix_comanda_items_contract ON comanda_items(contract_id) WHERE contract_id IS NOT NULL;
```

**N. `ai_schedule_suggestions` (AI-01, cache + contador):** `id, organization_id, group_id UUID NOT NULL → bridal_groups(id) ON DELETE CASCADE, input_hash CHAR(64) NOT NULL, source VARCHAR(10) NOT NULL, model VARCHAR(60) NULL, proposal JSONB NOT NULL, warnings JSONB NOT NULL DEFAULT '[]', input_tokens INTEGER NULL, output_tokens INTEGER NULL, created_by UUID NULL → members(id), created_at`. `chk_ass_source CHECK (source IN ('claude','heuristic'))`, índices `ix_ass_lookup (organization_id, group_id, input_hash, created_at)`, `ix_ass_org_created (organization_id, created_at) WHERE source = 'claude'`.

**O. `contract_alert_runs` (D-20 idempotência):** `organization_id UUID NOT NULL, run_date DATE NOT NULL, created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), CONSTRAINT pk_contract_alert_runs PRIMARY KEY (organization_id, run_date)`.

**P. Função de job (Pitfall 1 — organizations tem FORCE RLS):**
```sql
CREATE OR REPLACE FUNCTION job_list_active_orgs()
RETURNS TABLE (organization_id uuid, timezone varchar(50))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT o.id, o.timezone FROM organizations o WHERE o.status = 'active' ORDER BY o.id; $$;
REVOKE ALL ON FUNCTION job_list_active_orgs() FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN
  GRANT EXECUTE ON FUNCTION job_list_active_orgs() TO sgs_app; END IF; END $$;
```
Comentário no topo explicando por que (mesmo estilo de auth_user_memberships).

**Q. RLS** (bloco literal da interface) para as 13 tabelas: `contract_settings, bridal_groups, bridal_group_members, bridal_member_services, contract_sequences, contracts, contract_items, contract_versions, contract_access_tokens, contract_acceptances, contract_payments, ai_schedule_suggestions, contract_alert_runs`.

**R. Imutabilidade:** `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN REVOKE UPDATE, DELETE ON contract_payments FROM sgs_app; REVOKE UPDATE, DELETE ON contract_acceptances FROM sgs_app; REVOKE UPDATE, DELETE ON contract_versions FROM sgs_app; END IF; END $$;` (sem trigger — o cleanup dos testes usa sgs_migrator).

**S. Seed de permissões** (mesmo bloco DO $$ com v_admin/v_manager/v_attendant da migration da fase 3, `ON CONFLICT DO NOTHING`), matriz exata:
- ADMIN: `bridal.read, bridal.write, bridal.aiSuggest, contract.read, contract.write, contract.payment, contract.cancel, contract.settings`
- MANAGER: `bridal.read, bridal.write, bridal.aiSuggest, contract.read, contract.write, contract.payment, contract.cancel` (sem `contract.settings`)
- ATTENDANT: `bridal.read, bridal.write, contract.read, contract.payment`
- PROFESSIONAL: nenhuma
  </action>
  <verify>
    <automated>cd /root/sgs/apps/backend && corepack pnpm exec prisma migrate deploy && psql "$DIRECT_URL" -c "SELECT count(*) FROM pg_class WHERE relname IN ('contract_settings','bridal_groups','bridal_group_members','bridal_member_services','contract_sequences','contracts','contract_items','contract_versions','contract_access_tokens','contract_acceptances','contract_payments','ai_schedule_suggestions','contract_alert_runs') AND relrowsecurity AND relforcerowsecurity"</automated>
  </verify>
  <acceptance_criteria>
    - `prisma migrate deploy` termina sem erro e a consulta acima devolve `13`
    - `grep -c "CREATE POLICY tenant_isolation" apps/backend/prisma/migrations/20261103000000_phase4_bridal_contracts/migration.sql` = 13
    - `grep -c "REVOKE UPDATE, DELETE ON" .../migration.sql` = 3
    - O arquivo contém `uq_contracts_group_live`, `uq_bgm_one_bride`, `uq_ca_version`, `'deslocamento'`, `'contract_in','contract_refund'`, `SECURITY DEFINER`, `contract.settings`
    - O arquivo NÃO contém `contract_installments`
  </acceptance_criteria>
  <done>Migration aplicada; 13 tabelas com RLS forçada; ledgers protegidos; função de job e permissões criadas.</done>
</task>

<task type="auto">
  <name>Task 2: schema.prisma, permissões, env, dependências e módulos vazios</name>
  <files>apps/backend/prisma/schema.prisma, apps/backend/src/authz/permissions.catalog.ts, apps/backend/src/config/env.schema.ts, apps/backend/src/config/app-config.service.ts, apps/backend/package.json, pnpm-lock.yaml, .env.example, apps/backend/src/app.module.ts, apps/backend/src/bridal/bridal.module.ts, apps/backend/src/bridal/ai/ai-schedule.module.ts, apps/backend/src/contracts/contracts.module.ts, apps/backend/src/contracts/payments/contract-payments.module.ts, apps/backend/src/contracts/acceptance/contract-acceptance.module.ts, apps/backend/src/contracts/alerts/contract-alerts.module.ts</files>
  <read_first>
    - apps/backend/prisma/schema.prisma (models Appointment, TimeBlock, CashMovement, ComandaItem, Package, Organization, Client, Member)
    - apps/backend/src/authz/permissions.catalog.ts
    - apps/backend/src/config/env.schema.ts e apps/backend/src/config/app-config.service.ts
    - apps/backend/src/app.module.ts e apps/backend/src/comandas/comandas.module.ts (forma de módulo)
  </read_first>
  <action>
1. **schema.prisma:** adicionar models `ContractSettings` (@@map contract_settings, `organizationId @id`), `BridalGroup`, `BridalGroupMember`, `BridalMemberService`, `ContractSequence` (@@id([organizationId, year])), `Contract`, `ContractItem`, `ContractVersion`, `ContractAccessToken`, `ContractAcceptance`, `ContractPayment` (relação self `reverses`/`reversedBy` com nome `"ContractPaymentReversal"`), `AiScheduleSuggestion`, `ContractAlertRun` (@@id([organizationId, runDate])), espelhando exatamente as colunas da Task 1 (`@map` snake_case, `@db.Date` em `event_date`/`balance_due_date`/`run_date`, `@db.Time(6)` em `schedule_day_*`, `@db.Char(64)` nos hashes). Adicionar campos: `Package.depositKind String? @map("deposit_kind") @db.VarChar(10)`, `Package.depositValue Decimal? @map("deposit_value") @db.Decimal(12,2)`; `Appointment.bridalGroupId`, `Appointment.contractId`, `Appointment.purpose`; `TimeBlock.bridalGroupId`; `CashMovement.contractId`; `ComandaItem.contractId` — com as relações inversas em Organization/Client/Member/Service/Package/BridalGroup/Contract. Rodar `corepack pnpm --filter @sgs/backend exec prisma generate` e `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL"` se a env existir (senão `prisma validate`).
2. **permissions.catalog.ts:** bloco `// ===== Phase 4: Bridal & Contracts =====` com `BRIDAL_READ: 'bridal.read'`, `BRIDAL_WRITE: 'bridal.write'`, `BRIDAL_AI_SUGGEST: 'bridal.aiSuggest'`, `CONTRACT_READ: 'contract.read'`, `CONTRACT_WRITE: 'contract.write'`, `CONTRACT_PAYMENT: 'contract.payment'`, `CONTRACT_CANCEL: 'contract.cancel'`, `CONTRACT_SETTINGS: 'contract.settings'`; atualizar `ROLE_PERMISSIONS` com a mesma matriz da Task 1 seção S e o comentário de migrations (`Phase 4: 20261103000000_phase4_bridal_contracts`).
3. **env.schema.ts:** adicionar `ANTHROPIC_API_KEY: z.string().optional().transform((v) => (v && v.trim() ? v.trim() : undefined))`, `ANTHROPIC_MODEL: z.string().min(1).default('claude-sonnet-5-5')`, `AI_SCHEDULE_DAILY_LIMIT: z.coerce.number().int().min(0).default(20)`, `CONTRACT_ALERTS_SCHEDULER: z.enum(['true','false']).default('true').transform((v) => v === 'true')`. **app-config.service.ts:** getters `anthropicApiKey(): string | undefined`, `anthropicModel(): string`, `aiScheduleDailyLimit(): number`, `contractAlertsSchedulerEnabled(): boolean` (seguir o estilo dos getters existentes). `.env.example`: acrescentar as 4 variáveis com comentário ("sem ANTHROPIC_API_KEY a sugestão de agenda usa a heurística").
4. **Dependências:** `corepack pnpm --filter @sgs/backend add @anthropic-ai/sdk@1.4.0 pdfkit@0.20.2 @nestjs/throttler@6.7.1` e `corepack pnpm --filter @sgs/backend add -D @types/pdfkit` (se `@types/pdfkit` não existir, registrar no SUMMARY e declarar `declare module 'pdfkit';` em `src/types/pdfkit.d.ts` — nesse caso adicionar o arquivo ao files list do SUMMARY).
5. **Módulos vazios** (`@Module({})`, cada um exportando a classe): `BridalModule` (`src/bridal/bridal.module.ts`), `AiScheduleModule` (`src/bridal/ai/ai-schedule.module.ts`), `ContractsModule` (`src/contracts/contracts.module.ts`), `ContractPaymentsModule` (`src/contracts/payments/contract-payments.module.ts`), `ContractAcceptanceModule` (`src/contracts/acceptance/contract-acceptance.module.ts`), `ContractAlertsModule` (`src/contracts/alerts/contract-alerts.module.ts`). Registrar os 6 em `AppModule.imports` depois de `FinancialModule`. Cada plano posterior preenche o seu módulo (dono exclusivo).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend exec prisma validate && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^model " apps/backend/prisma/schema.prisma` aumentou em 13 em relação ao início do plano
    - `grep -n "contract.settings" apps/backend/src/authz/permissions.catalog.ts` encontra a constante e `ROLE_PERMISSIONS.MANAGER` não contém `CONTRACT_SETTINGS`
    - `grep -n "claude-sonnet-5-5" apps/backend/src/config/env.schema.ts` encontra o default
    - `apps/backend/package.json` contém `"@anthropic-ai/sdk": "1.4.0"` (ou `^1.4.0`), `"pdfkit"` e `"@nestjs/throttler"`
    - `grep -c "Module" apps/backend/src/app.module.ts` inclui `BridalModule`, `AiScheduleModule`, `ContractsModule`, `ContractPaymentsModule`, `ContractAcceptanceModule`, `ContractAlertsModule`
    - typecheck e testes unitários verdes
  </acceptance_criteria>
  <done>Prisma client gerado com os modelos novos; permissões espelhadas; env opcional da IA; libs instaladas; 6 módulos vazios registrados.</done>
</task>

<task type="auto">
  <name>Task 3: Fixtures, cleanup, smoke do schema, teste da função de job e nota de escopo</name>
  <files>apps/backend/test/integration/setup.ts, apps/backend/test/integration/helpers/phase4-fixtures.ts, apps/backend/test/integration/helpers/phase4-cleanup.ts, apps/backend/test/integration/phase4-schema-smoke.e2e.spec.ts, apps/backend/test/integration/phase4-job-orgs.e2e.spec.ts, .planning/REQUIREMENTS.md</files>
  <read_first>
    - apps/backend/test/integration/helpers/phase3-fixtures.ts (createPhase3World, gqlAs, cleanupRows, destroyPhase3World)
    - apps/backend/test/integration/helpers/phase3-cleanup.ts
    - apps/backend/test/integration/phase3-schema-smoke.e2e.spec.ts (padrão de asserts de RLS/REVOKE)
    - apps/backend/test/integration/setup.ts
  </read_first>
  <action>
1. **setup.ts:** primeira linha executável: `process.env.CONTRACT_ALERTS_SCHEDULER ??= 'false';` (suítes que bootam AppModule não registram o scheduler BullMQ; o plano 04-10 tem seu próprio smoke com `true`).
2. **phase4-cleanup.ts:** `export async function deletePhase4Rows(orgFilterSql: string)` apagando via `adminPrisma.$executeRawUnsafe` nesta ordem (FK): `notifications WHERE kind LIKE 'contract_%' OR kind LIKE 'bridal_%'`, `contract_alert_runs`, `ai_schedule_suggestions`, `contract_acceptances`, `contract_access_tokens`, `DELETE FROM cash_movements WHERE contract_id IS NOT NULL` (adminPrisma usa sgs_migrator, então o REVOKE não se aplica), `UPDATE comanda_items SET contract_id = NULL`, `UPDATE appointments SET contract_id = NULL, bridal_group_id = NULL`, `contract_payments` (primeiro as linhas com `reverses_payment_id IS NOT NULL`, depois o resto), `contract_versions` (depois de apagar tokens/aceites), `contract_items`, `contracts`, `contract_sequences`, `time_blocks WHERE bridal_group_id IS NOT NULL`, `bridal_member_services`, `bridal_group_members`, `bridal_groups`, `contract_settings`; sempre `WHERE organization_id IN (${orgFilterSql})`.
3. **phase4-fixtures.ts:** `export interface Phase4World extends Phase3World { bridalPackageId: string; /* price "500.00", deposit_kind 'percent', deposit_value 30, com serviceId + serviceBId */ }`; `createPhase4World(prefix)` = `createPhase3World(prefix)` + insere o pacote de noiva via adminPrisma (com package_services); `destroyPhase4World(w)` chama `deletePhase4Rows(orgFilter)` e depois `destroyPhase3World(w)`; reexportar `gqlAs`. Helpers SQL diretos (para planos que rodam em paralelo sem depender das mutations uns dos outros):
   - `insertBridalGroupRow(w, opts: { companions?: number; eventDate?: string; covered?: boolean[]; locationKind?: 'studio'|'external'; travelBefore?: number; travelAfter?: number; readyBy?: string }) => Promise<{ groupId: string; brideMemberId: string; brideClientId: string; companionMemberIds: string[]; companionClientIds: string[] }>` — cria clientes mínimos (nome `${prefix}-noiva`, `${prefix}-acomp-N`), grupo e membros (`bride` coberta por padrão).
   - `insertContractRow(w, opts: { groupId: string; brideClientId: string; totalAmount: string; depositAmount: string; status?: string; balanceDueDate?: string; items?: { groupMemberId: string; serviceId: string; unitPrice: string }[] }) => Promise<{ contractId: string; code: string }>` — insere contrato (code `CT-TEST-<n>`, `cancellation_policy` = `{"version":1,"clientCancels":"retain_all_paid","studioCancels":"refund_all","clause":"Cláusula de teste."}`), itens e `contract_versions` v1 (`rendered_text` 'texto', `text_sha256` = sha256 de 'texto').
4. **phase4-schema-smoke.e2e.spec.ts:** (a) as 13 tabelas têm `relrowsecurity AND relforcerowsecurity`; (b) como `appPrisma` dentro de `SET LOCAL app.current_organization` (use `$transaction`), `UPDATE contract_payments ...` e `DELETE FROM contract_acceptances ...` falham com `permission denied`; (c) `role_permissions` tem exatamente a matriz da Task 1 S para os 4 papéis de sistema; (d) inserir `time_blocks` com kind `deslocamento` sem `bridal_group_id` viola `chk_time_blocks_travel`; (e) segundo contrato vivo no mesmo grupo viola `uq_contracts_group_live`; (f) `createPhase4World`/`destroyPhase4World` sobem e limpam sem erro.
5. **phase4-job-orgs.e2e.spec.ts:** com 2 orgs da world, `appPrisma.$queryRaw\`SELECT organization_id, timezone FROM job_list_active_orgs()\`` (SEM tenant context) devolve ambas; `appPrisma.organization.findMany()` sem tenant devolve 0 (prova de que a função é necessária).
6. **REQUIREMENTS.md:** sob CONT-01 e CONT-03 acrescentar nota "(Fase 4: parcelamento reinterpretado como entrada + restante livre até D-10 — 04 D-10/D-11; retenção = cliente cancela retém tudo o que foi pago, estúdio cancela devolve tudo — 04 D-22, sem faixas por antecedência)".
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase4-schema-smoke phase4-job-orgs && corepack pnpm --filter @sgs/backend test:integration -- phase3</automated>
  </verify>
  <acceptance_criteria>
    - `phase4-schema-smoke` e `phase4-job-orgs` verdes; todas as suítes `phase3-*` continuam verdes
    - `grep -n "export async function insertContractRow" apps/backend/test/integration/helpers/phase4-fixtures.ts` encontra o helper
    - `grep -n "CONTRACT_ALERTS_SCHEDULER" apps/backend/test/integration/setup.ts` encontra a linha
    - `grep -n "04 D-22" .planning/REQUIREMENTS.md` encontra a nota
  </acceptance_criteria>
  <done>Fixtures e cleanup prontos para as ~14 suítes novas; RLS/REVOKE/permissões provados; função de job comprovada sob sgs_app.</done>
</task>

</tasks>

<verification>
- `corepack pnpm --filter @sgs/backend test:integration -- phase4` verde
- Suíte de integração completa verde (regressão da fase 3)
- Backend sobe sem `ANTHROPIC_API_KEY` (`corepack pnpm --filter @sgs/backend build` + boot no smoke)
</verification>

<success_criteria>
Schema da Fase 4 aplicado com RLS em 13 tabelas, 3 ledgers imutáveis, função de job, 8 permissões; módulos vazios e helpers de teste prontos para os planos paralelos.
</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-01-SUMMARY.md`
</output>
