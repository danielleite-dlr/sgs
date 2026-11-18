---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql
  - apps/backend/prisma/schema.prisma
  - apps/backend/src/authz/permissions.catalog.ts
  - apps/backend/src/authz/permissions.catalog.spec.ts
  - apps/backend/test/integration/helpers/phase9-fixtures.ts
  - apps/backend/test/integration/helpers/phase9-cleanup.ts
  - apps/backend/test/integration/phase9-rls-rbac.e2e.spec.ts
autonomous: true
requirements: [COM-05, COM-10]

must_haves:
  truths:
    - "As 6 tabelas commercial_* existem com ENABLE + FORCE ROW LEVEL SECURITY e a política tenant_isolation; sgs_app de uma organização não lê nem grava linha de outra"
    - "Toda organização existente tem as 6 etapas padrão (Novo, Contato, Proposta, Negociação, Ganho, Perdido) depois da migração, com Ganho/Perdido is_system e kind won/lost (D-07)"
    - "role_permissions tem commercial.read e commercial.write para ADMIN, MANAGER e ATTENDANT e commercial.manage só para ADMIN e MANAGER; PROFESSIONAL não tem nenhuma (D-11, D-13)"
    - "purge_member e purge_bridal_group continuam funcionando quando há linhas commercial_* apontando para o membro, o contrato ou a cliente (FKs ON DELETE SET NULL)"
    - "O negócio só aceita kind noiva ou debutante (D-05) e o perdido exige lost_reason_code (D-10), garantidos por CHECK"
  artifacts:
    - path: "apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql"
      provides: "tabelas, RLS, backfill de etapas, permissões"
      contains: "FORCE ROW LEVEL SECURITY"
    - path: "apps/backend/prisma/schema.prisma"
      provides: "models CommercialStage, CommercialLead, CommercialDeal, CommercialInteraction, CommercialReminder, CommercialFormSettings"
      contains: "model CommercialDeal"
    - path: "apps/backend/test/integration/helpers/phase9-fixtures.ts"
      provides: "createPhase9World, insertLeadRow, insertDealRow, stageIdOf"
      exports: ["createPhase9World", "destroyPhase9World", "insertLeadRow", "insertDealRow", "stageIdOf"]
  key_links:
    - from: "apps/backend/src/authz/permissions.catalog.ts"
      to: "role_permissions (migração)"
      via: "mesmas 3 permissões nas duas fontes"
      pattern: "commercial\\.manage"
    - from: "apps/backend/test/integration/helpers/phase9-fixtures.ts"
      to: "createPhase4World"
      via: "mundo da fase 4 + atendente B"
      pattern: "createPhase4World"
---

<objective>
Base de dados e acesso do Comercial: migração com as 6 tabelas `commercial_*` (RLS forçada), backfill das etapas padrão, as permissões `commercial.read/write/manage`, models Prisma, fixtures de integração da fase 9 e a suíte de isolamento/permissões.

Purpose: tudo o mais da fase (serviços, telas, push) se apoia nessas tabelas e permissões. Resolve também o item "não verificado" da pesquisa sobre `purge_*`.
Output: migração, schema Prisma, catálogo de permissões, fixtures e `phase9-rls-rbac`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-RESEARCH.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md

**Ambiente de execução (vale para todos os planos da fase 9):**
- Carregar o env linha a linha (o `.env` tem `&` sem aspas no `DATABASE_URL`; `source` quebra):
  `set -a; while IFS= read -r l; do [[ -z "$l" || "$l" == \#* ]] && continue; export "$l"; done < /root/sgs/.env; set +a`
- Banco LOCAL `sgs_dev` (container `sgs_postgres` em 127.0.0.1:5434, `sgs_pgbouncer` em 5433, `sgs_valkey` em 6379). NUNCA o staging (`sgs_stg_*`). Se a integração travar no boot, `docker exec sgs_valkey valkey-cli ping` primeiro.
- Migração aplicada com `corepack pnpm --filter @sgs/backend exec prisma migrate deploy` e cliente com `corepack pnpm --filter @sgs/backend exec prisma generate`.
- Backend: prettier só nos arquivos tocados. Frontend: SEM prettier (aspas simples, ~100 colunas, formatado à mão); nunca `prettier --write` em arquivo existente. Nunca importar `tailwind.config.ts` de `src/` nem de testes.
- Tudo em PT-BR (mensagens, comentários, commits). Commits `feat(09-NN): ...` / `test(09-NN): ...`.
- Integração filtrada: `corepack pnpm --filter @sgs/backend test:integration -- phase9-xxx`.

**Achados verificados no planejamento (não reabrir):**
- `purge_member` (`20261112000000_hard_delete_member_bridal`) é SECURITY DEFINER e faz `DELETE FROM members`; `purge_bridal_group` apaga `contracts`. As ações de FK (`ON DELETE SET NULL`) rodam sem RLS, então basta TODA coluna nova que aponte para `members`, `contracts`, `clients` ou `packages` ser anulável e `ON DELETE SET NULL`. Não é preciso alterar as funções `purge_*`; o teste do Task 3 prova isso.
- Privilégios de `sgs_app` em tabela nova vêm de `ALTER DEFAULT PRIVILEGES` (`infra/postgres/init/01-create-roles.sql`): não escrever GRANT.
- Última migração existente: `20261121000000_device_tokens_webpush`.

<interfaces>
Padrão RLS (de `20261114000000_bridal_timeline`):
```sql
ALTER TABLE x ENABLE ROW LEVEL SECURITY;
ALTER TABLE x FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON x
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);
```
Trigger: `CREATE TRIGGER trg_x_updated_at BEFORE UPDATE ON x FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();`
Permissão: `DO $$ DECLARE v_admin uuid; ... SELECT id INTO v_admin FROM roles WHERE name='ADMIN' AND is_system=true LIMIT 1; INSERT INTO role_permissions (role_id, permission) VALUES (...) ON CONFLICT DO NOTHING; END $$;`
`test/integration/helpers/phase4-fixtures.ts`: `createPhase4World(prefix)` → `Phase4World extends Phase3World { bridalPackageId }`; `Phase3World` tem `app, orgId, otherOrgId, prefix, members { admin, manager, attendant, proA, proB }, tokens { admin, manager, attendant, proA, proB, otherAdmin }, clientId, serviceId, serviceBId, packageId`; `destroyPhase4World(w)`; `COMPLETE_CLIENT`; `gqlAs`. `phase5-cleanup.ts::deletePhase5Rows(orgFilterSql)` é o modelo de cleanup.
`setup.ts` exporta `adminPrisma` (DIRECT_URL, BYPASSRLS) e `appPrisma` (DATABASE_URL, RLS).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migração phase9_commercial e models Prisma</name>
  <files>apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql, apps/backend/prisma/schema.prisma</files>
  <read_first>
    - apps/backend/prisma/migrations/20261114000000_bridal_timeline/migration.sql (padrão de tabela, RLS, permissão)
    - apps/backend/prisma/migrations/20261112000000_hard_delete_member_bridal/migration.sql (purge_member / purge_bridal_group)
    - apps/backend/prisma/schema.prisma (models Organization, Member, Client, Package, Contract, BridalTimeline como modelo de mapeamento)
    - .planning/phases/09-comercial-crm-do-atimos-no-sgs/09-RESEARCH.md (seção "Modelagem")
  </read_first>
  <action>
Criar `migration.sql` com as seções A (tabelas), B (índices), C (RLS), D (triggers), E (backfill de etapas), F (permissões). Todas as tabelas: `id UUID NOT NULL DEFAULT gen_uuid_v7()`, `organization_id UUID NOT NULL` com FK `organizations(id)`, `created_at/updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()`, PK nomeada `pk_<tabela>`.

`commercial_stages`: `name VARCHAR(60) NOT NULL`, `color VARCHAR(7) NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$')`, `position INT NOT NULL`, `sla_days INT NULL CHECK (sla_days IS NULL OR sla_days BETWEEN 1 AND 365)`, `kind VARCHAR(10) NOT NULL CHECK (kind IN ('open','won','lost'))`, `is_system BOOLEAN NOT NULL DEFAULT false`, `CONSTRAINT chk_cs_sla_open CHECK (kind = 'open' OR sla_days IS NULL)`. Índices: `CREATE UNIQUE INDEX uq_cs_won ON commercial_stages (organization_id) WHERE kind = 'won'`, idem `uq_cs_lost` para `'lost'`, `ix_cs_org_position (organization_id, position)`.

`commercial_leads`: `full_name VARCHAR(255) NOT NULL`, `phone VARCHAR(30) NULL`, `phone_digits VARCHAR(15) NULL`, `email VARCHAR(255) NULL`, `source VARCHAR(20) NOT NULL DEFAULT 'manual'`, `notes TEXT NULL`, `client_id UUID NULL REFERENCES clients(id) ON DELETE SET NULL`, `created_by UUID NULL REFERENCES members(id) ON DELETE SET NULL`, `consent_at TIMESTAMPTZ(6) NULL`, `consent_text_version VARCHAR(40) NULL`, `deleted_at TIMESTAMPTZ(6) NULL`; `CONSTRAINT chk_cl_source CHECK (source IN ('manual','instagram','indicacao','site','whatsapp','import','outro'))`, `CONSTRAINT chk_cl_contact CHECK (phone IS NOT NULL OR email IS NOT NULL)`. Índices `ix_cl_org_phone (organization_id, phone_digits)`, `ix_cl_org_email (organization_id, lower(email))`, `ix_cl_org_created_by (organization_id, created_by)`.

`commercial_deals`: `lead_id UUID NOT NULL REFERENCES commercial_leads(id) ON DELETE CASCADE`, `stage_id UUID NOT NULL REFERENCES commercial_stages(id)`, `status VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost'))`, `kind VARCHAR(10) NOT NULL CHECK (kind IN ('noiva','debutante'))` (D-05), `beneficiary_name VARCHAR(255) NULL` (D-18: nome da debutante), `event_date DATE NULL`, `package_id UUID NULL REFERENCES packages(id) ON DELETE SET NULL`, `package_name VARCHAR(160) NULL`, `package_price NUMERIC(12,2) NULL`, `discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0)`, `final_amount NUMERIC(12,2) NULL`, `assignee_member_id UUID NULL REFERENCES members(id) ON DELETE SET NULL`, `source VARCHAR(20) NOT NULL DEFAULT 'manual'` (mesmo CHECK de origem, `chk_cd_source`), `location VARCHAR(255) NULL`, `notes TEXT NULL`, `stage_entered_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()`, `last_interaction_at TIMESTAMPTZ(6) NULL`, `lost_reason_code VARCHAR(30) NULL CHECK (lost_reason_code IS NULL OR lost_reason_code IN ('price','date_unavailable','chose_other','no_response','gave_up','other'))`, `lost_reason_text VARCHAR(500) NULL`, `closed_at TIMESTAMPTZ(6) NULL`, `won_contract_id UUID NULL REFERENCES contracts(id) ON DELETE SET NULL`, `won_client_id UUID NULL REFERENCES clients(id) ON DELETE SET NULL`, `created_by UUID NULL REFERENCES members(id) ON DELETE SET NULL`, `deleted_at TIMESTAMPTZ(6) NULL`; `CONSTRAINT chk_cd_lost CHECK (status <> 'lost' OR lost_reason_code IS NOT NULL)`. Índices `CREATE UNIQUE INDEX uq_cd_won_contract ON commercial_deals (won_contract_id) WHERE won_contract_id IS NOT NULL`, `ix_cd_org_stage (organization_id, stage_id) WHERE deleted_at IS NULL`, `ix_cd_org_assignee (organization_id, assignee_member_id)`, `ix_cd_org_lead (organization_id, lead_id)`.

`commercial_interactions`: `lead_id UUID NOT NULL REFERENCES commercial_leads(id) ON DELETE CASCADE`, `deal_id UUID NULL REFERENCES commercial_deals(id) ON DELETE SET NULL`, `type VARCHAR(10) NOT NULL CHECK (type IN ('call','whatsapp','email','meeting','visit','other'))`, `notes TEXT NULL`, `occurred_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()`, `created_by UUID NULL REFERENCES members(id) ON DELETE SET NULL`. Índice `ix_ci_org_lead (organization_id, lead_id, occurred_at DESC)`.

`commercial_reminders`: `lead_id UUID NULL REFERENCES commercial_leads(id) ON DELETE CASCADE`, `deal_id UUID NULL REFERENCES commercial_deals(id) ON DELETE SET NULL`, `interaction_id UUID NULL REFERENCES commercial_interactions(id) ON DELETE SET NULL`, `title VARCHAR(160) NOT NULL`, `description TEXT NULL`, `due_at TIMESTAMPTZ(6) NOT NULL`, `completed_at TIMESTAMPTZ(6) NULL`, `notified_at TIMESTAMPTZ(6) NULL`, `created_by UUID NULL REFERENCES members(id) ON DELETE SET NULL`. Índices `ix_cr_due (organization_id, due_at) WHERE completed_at IS NULL AND notified_at IS NULL`, `ix_cr_org_deal (organization_id, deal_id)`.

`commercial_form_settings`: `organization_id` com `CONSTRAINT uq_cfs_org UNIQUE (organization_id)`, `token VARCHAR(64) NOT NULL`, `is_active BOOLEAN NOT NULL DEFAULT false`, `default_assignee_member_id UUID NULL REFERENCES members(id) ON DELETE SET NULL`, `success_message VARCHAR(300) NULL`, `consent_text TEXT NOT NULL DEFAULT 'Autorizo o salão a usar meus dados para entrar em contato sobre o orçamento, conforme a LGPD.'`, `consent_text_version VARCHAR(40) NOT NULL DEFAULT 'v1'`, `updated_by UUID NULL REFERENCES members(id) ON DELETE SET NULL`.

C: bloco RLS do `<interfaces>` para as 6 tabelas. D: trigger `fn_set_updated_at` nas 6.
E: backfill idempotente das etapas para orgs existentes:
```sql
INSERT INTO commercial_stages (organization_id, name, color, position, sla_days, kind, is_system)
SELECT o.id, s.name, s.color, s.position, s.sla_days, s.kind, s.is_system
FROM organizations o
CROSS JOIN (VALUES
  ('Novo', '#64748B', 0, 1, 'open', false),
  ('Contato', '#3B82F6', 1, 3, 'open', false),
  ('Proposta', '#8B5CF6', 2, 3, 'open', false),
  ('Negociação', '#F59E0B', 3, 2, 'open', false),
  ('Ganho', '#16A34A', 100, NULL, 'won', true),
  ('Perdido', '#DC2626', 101, NULL, 'lost', true)
) AS s(name, color, position, sla_days, kind, is_system)
WHERE NOT EXISTS (SELECT 1 FROM commercial_stages cs WHERE cs.organization_id = o.id);
```
(prazos 1/3/3/2 dias: padrão sugerido na pesquisa, editáveis pelo salão.)
F: `commercial.read` e `commercial.write` para ADMIN, MANAGER e ATTENDANT; `commercial.manage` para ADMIN e MANAGER; nada para PROFESSIONAL (D-11, D-13).

`schema.prisma`: models `CommercialStage` (`@@map("commercial_stages")`), `CommercialLead`, `CommercialDeal`, `CommercialInteraction`, `CommercialReminder`, `CommercialFormSettings`, campos camelCase com `@map`, `Decimal @db.Decimal(12, 2)`, `DateTime @db.Date` para `eventDate`, `@db.Timestamptz(6)` nos timestamps, `@default(dbgenerated("gen_uuid_v7()"))`. Relações nomeadas quando houver mais de uma FK para o mesmo model (ex.: `@relation("CommercialDealAssignee")`, `@relation("CommercialDealCreatedBy")`, `@relation("CommercialDealWonClient")`), com os back-relations correspondentes acrescentados em `Organization`, `Member`, `Client`, `Package`, `Contract`. Não usar `prisma migrate dev` (SQL é escrito à mão): aplicar com `prisma migrate deploy` e conferir com `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` (sem diferença, exceto índices parciais/expressão que o Prisma não modela; registrar no SUMMARY se houver só isso).
Commit `feat(09-01): tabelas commercial_* com RLS e etapas padrão`.
  </action>
  <verify>
    <automated>cd /root/sgs/apps/backend && corepack pnpm exec prisma migrate deploy && corepack pnpm exec prisma generate && corepack pnpm typecheck && psql "$DIRECT_URL" -Atc "select count(*) from pg_class where relname like 'commercial_%' and relkind='r' and relrowsecurity and relforcerowsecurity"</automated>
  </verify>
  <acceptance_criteria>
    - o `psql` do `<verify>` imprime `6`
    - `grep -c "CREATE POLICY tenant_isolation ON commercial_" apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql` = 6
    - `grep -c "FORCE ROW LEVEL SECURITY" apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql` = 6
    - `grep -n "kind IN ('noiva','debutante')" apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql` encontra
    - `grep -n "chk_cd_lost" apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql` encontra
    - `grep -c "REFERENCES members(id) ON DELETE SET NULL" apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql` ≥ 7 e `grep -cE "REFERENCES members\(id\),?$" apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql` = 0
    - `grep -n "commercial.manage" apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql` encontra
    - `psql "$DIRECT_URL" -Atc "select count(*) from organizations o where (select count(*) from commercial_stages s where s.organization_id=o.id) <> 6"` = 0
    - `grep -n "model CommercialDeal" apps/backend/prisma/schema.prisma` encontra e `corepack pnpm --filter @sgs/backend typecheck` sai 0
  </acceptance_criteria>
  <done>Tabelas e etapas no banco local, Prisma gerado, typecheck verde.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Permissões commercial.* no catálogo</name>
  <files>apps/backend/src/authz/permissions.catalog.ts, apps/backend/src/authz/permissions.catalog.spec.ts</files>
  <read_first>
    - apps/backend/src/authz/permissions.catalog.ts
    - apps/backend/src/authz/permissions.catalog.spec.ts (se existir; senão criar)
  </read_first>
  <behavior>
    - ROLE_PERMISSIONS.ADMIN e .MANAGER contêm 'commercial.read', 'commercial.write', 'commercial.manage'
    - ROLE_PERMISSIONS.ATTENDANT contém 'commercial.read' e 'commercial.write' e NÃO contém 'commercial.manage'
    - ROLE_PERMISSIONS.PROFESSIONAL não contém nenhuma permissão começando com 'commercial.'
    - ATTENDANT continua sem 'contract.write' (D-21: o ganho não depende dela)
  </behavior>
  <action>
Em `PERMISSIONS`, nova seção `// ===== Phase 9: Comercial =====` com `COMMERCIAL_READ: 'commercial.read'`, `COMMERCIAL_WRITE: 'commercial.write'`, `COMMERCIAL_MANAGE: 'commercial.manage'`. Acrescentar ao comentário de migrações `Phase 9: 20261122000000_phase9_commercial`. ADMIN e MANAGER: as três; ATTENDANT: read e write; PROFESSIONAL: nenhuma. Spec com os casos do `<behavior>` (criar o arquivo se não existir, com `describe('ROLE_PERMISSIONS — fase 9')`).
Commit `feat(09-01): permissões do Comercial`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- permissions.catalog && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "COMMERCIAL_MANAGE: 'commercial.manage'" apps/backend/src/authz/permissions.catalog.ts` encontra
    - `grep -c "PERMISSIONS.COMMERCIAL_" apps/backend/src/authz/permissions.catalog.ts` = 8 (3 ADMIN + 3 MANAGER + 2 ATTENDANT)
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Catálogo espelha a migração.</done>
</task>

<task type="auto">
  <name>Task 3: Fixtures da fase 9 e suíte phase9-rls-rbac</name>
  <files>apps/backend/test/integration/helpers/phase9-fixtures.ts, apps/backend/test/integration/helpers/phase9-cleanup.ts, apps/backend/test/integration/phase9-rls-rbac.e2e.spec.ts</files>
  <read_first>
    - apps/backend/test/integration/helpers/phase4-fixtures.ts
    - apps/backend/test/integration/helpers/phase3-fixtures.ts (createPhase3World: como cria membros e tokens)
    - apps/backend/test/integration/helpers/phase5-cleanup.ts
    - apps/backend/test/integration/phase4-rls-rbac.e2e.spec.ts (modelo de isolamento)
    - apps/backend/test/integration/hard-delete-member-bridal.e2e.spec.ts (modelo de chamada de purge_member/purge_bridal_group)
    - apps/backend/test/integration/setup.ts
  </read_first>
  <action>
1. `phase9-cleanup.ts`: `export async function deletePhase9Rows(orgFilterSql: string)` apagando, nesta ordem, `commercial_reminders`, `commercial_interactions`, `commercial_deals`, `commercial_leads`, `commercial_form_settings` (`WHERE organization_id IN (${orgFilterSql})`) via `adminPrisma.$executeRawUnsafe`. Etapas NÃO são apagadas aqui (ficam até a org sumir); `destroyPhase9World` apaga `commercial_stages` das orgs do prefixo antes de `destroyPhase4World`.
2. `phase9-fixtures.ts`:
   - `export interface Phase9World extends Phase4World { attendantB: { memberId: string; token: string }; debutantePackageId: string; }`
   - `createPhase9World(prefix)`: chama `deletePhase9Rows` + apaga etapas do prefixo, depois `createPhase4World(prefix)`; cria a segunda atendente (ATTENDANT, `isProfessional: false`) do mesmo jeito que `createPhase3World` cria `attendant` (usuário + membro + token pelo mesmo helper de login/JWT usado lá); cria o pacote `${prefix}-spa-dos-15` (price '900.00', depositKind 'percent', depositValue '30.00', com `serviceId`); garante as 6 etapas padrão nas duas orgs (`orgId`, `otherOrgId`) com o mesmo INSERT do backfill (orgs criadas depois da migração não têm etapas).
   - `stageIdOf(orgId, kindOrName: 'Novo'|'Contato'|'Proposta'|'Negociação'|'won'|'lost')`.
   - `insertLeadRow(w, opts: { fullName?, phone?, email?, createdBy?, clientId?, source?, orgId? })` e `insertDealRow(w, opts: { leadId, stageName?, kind?: 'noiva'|'debutante', assignee?: string|null, packageId?, eventDate?, status?, beneficiaryName?, lastInteractionAt?, stageEnteredAt?, orgId? })` via `adminPrisma` (devolvem id). Padrões: telefone `(11) 9${random 8 dígitos}`, `phone_digits` coerente, kind 'noiva', etapa 'Novo', `packageId = w.bridalPackageId`.
   - `destroyPhase9World(w)`.
3. `phase9-rls-rbac.e2e.spec.ts` (`describe('fase 9 — RLS e permissões do Comercial')`):
   - Para cada uma das 6 tabelas: `appPrisma.$transaction` com `SET LOCAL app.current_organization = '<otherOrgId>'` não enxerga a linha criada em `orgId` (SELECT count = 0) e INSERT com `organization_id = orgId` falha por política.
   - `pg_class.relforcerowsecurity = true` para as 6.
   - `role_permissions`: consulta por papel de sistema confirma a matriz (ADMIN/MANAGER: 3; ATTENDANT: read+write; PROFESSIONAL: 0).
   - Etapas: org do mundo tem exatamente uma `won` e uma `lost`; segundo INSERT `kind='won'` na mesma org viola `uq_cs_won`.
   - CHECKs: INSERT de negócio com `kind='social'` falha; UPDATE para `status='lost'` sem `lost_reason_code` falha.
   - Exclusão definitiva: lead + negócio com `assignee_member_id = proB`, `created_by = proB` e `won_contract_id` de um contrato criado por `insertContractRow` (fase 4) num grupo de `insertBridalGroupRow`; chamar `purge_member(proB)` e `purge_bridal_group(grupo)` como o teste de hard delete faz (dentro de transação com `app.current_organization`); ambas terminam sem erro e o negócio fica com `assignee_member_id`, `created_by` e `won_contract_id` nulos.
   Commit `test(09-01): fixtures da fase 9 e isolamento do Comercial`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase9-rls-rbac && corepack pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export async function createPhase9World" apps/backend/test/integration/helpers/phase9-fixtures.ts` encontra
    - `grep -n "export async function insertDealRow" apps/backend/test/integration/helpers/phase9-fixtures.ts` encontra
    - `grep -c "purge_member\|purge_bridal_group" apps/backend/test/integration/phase9-rls-rbac.e2e.spec.ts` ≥ 2
    - `grep -n "relforcerowsecurity" apps/backend/test/integration/phase9-rls-rbac.e2e.spec.ts` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Isolamento entre orgs, matriz de permissões e compatibilidade com as exclusões definitivas provados no banco real.</done>
</task>

</tasks>

<verification>
`prisma migrate deploy` limpo, typecheck, unit de permissões e `phase9-rls-rbac` verdes.
</verification>

<success_criteria>
Base de dados do Comercial pronta, isolada por organização e com as permissões que os planos seguintes usam.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-01-SUMMARY.md`
</output>
