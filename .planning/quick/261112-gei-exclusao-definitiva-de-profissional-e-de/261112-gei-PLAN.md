---
quick_id: 261112-gei
type: quick
autonomous: true
files_modified:
  - apps/backend/prisma/migrations/20261112000000_hard_delete_member_bridal/migration.sql (novo)
  - apps/backend/src/graphql/schema/identity.graphql
  - apps/backend/src/graphql/schema/bridal.graphql
  - apps/backend/src/identity/members.service.ts
  - apps/backend/src/identity/members.resolver.ts
  - apps/backend/src/bridal/bridal.service.ts
  - apps/backend/src/bridal/bridal.resolver.ts
  - apps/backend/test/integration/hard-delete-member-bridal.e2e.spec.ts (novo)
  - apps/frontend/src/components/ui/confirm-by-name-dialog.tsx (novo)
  - apps/frontend/src/features/catalog/api/members.api.ts
  - apps/frontend/src/features/bridal/api/bridal.api.ts
  - apps/frontend/src/pages/ProfissionaisPage.tsx
  - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx
  - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  - apps/frontend/src/components/ui/__tests__/confirm-by-name-dialog.test.tsx (novo)
  - apps/e2e/tests/exclusao-definitiva.spec.ts (novo)
must_haves:
  truths:
    - "Admin exclui de vez uma profissional sem nada em aberto: a linha some de members (e o users dela, se não tiver outra organização) e ela não aparece mais em Profissionais"
    - "Com atendimento scheduled/confirmed/in_progress ou comanda open com item dela, a exclusão é recusada com mensagem do tipo '3 atendimentos agendados, 1 comanda aberta' e nada é apagado"
    - "Não dá para excluir a si mesma nem o dono (ADMIN mais antigo da organização)"
    - "Admin/gerente exclui de vez um grupo de noiva com contrato, parcelas, pagamento e caixa: somem grupo, membros, agendamentos, contratos e dependentes, comandas do grupo e lançamentos de caixa; as clientes continuam"
    - "Nos dois casos a UI exige digitar o nome exato antes de liberar o botão destrutivo, e o audit_log ganha uma linha (member.delete_permanent / bridal.delete_permanent) com o nome no metadata"
  artifacts:
    - path: "apps/backend/prisma/migrations/20261112000000_hard_delete_member_bridal/migration.sql"
      contains: "purge_member"
    - path: "apps/backend/test/integration/hard-delete-member-bridal.e2e.spec.ts"
    - path: "apps/frontend/src/components/ui/confirm-by-name-dialog.tsx"
    - path: "apps/e2e/tests/exclusao-definitiva.spec.ts"
  key_links:
    - from: "members.service.ts deletePermanently"
      to: "purge_member(uuid)"
      via: "tx.$queryRaw dentro de runWithTenant"
    - from: "bridal.service.ts deletePermanently"
      to: "purge_bridal_group(uuid)"
      via: "tx.$queryRaw dentro de runWithTenant"
---

<objective>
Pedido do usuário (12/11): apagar de verdade do banco profissionais e noivas de teste (ex.: "A definir 2"). Hoje só
há `deactivateMember` (status inactive) e `cancelBridalGroup` (exige contrato cancelado). Decisões travadas em
261112-gei-CONTEXT.md.

Fatos levantados no sgs_dev (pg_constraint / has_table_privilege) que moldam o desenho:
- `sgs_app` NÃO tem UPDATE/DELETE em `commission_records`, `audit_log`, `cash_movements`, `contract_versions`,
  `contract_acceptances`, `contract_payments`, `client_credit_movements` (append-only, REVOKE na migration
  20261101000000). Logo a exclusão não cabe em Prisma puro → funções `SECURITY DEFINER` (dono `sgs_migrator`, que é
  superuser e ignora RLS: TODA instrução da função filtra por `organization_id = v_org`). Mesmo padrão de
  `member_user_org_count` (migration 20260929120000): `SET search_path = public, pg_temp`, `REVOKE ALL ... FROM
  PUBLIC`, `GRANT EXECUTE ... TO sgs_app` dentro do `DO $$ IF EXISTS sgs_app`.
- NOT NULL sem cascade apontando para members: `appointments.professional_id`, `comanda_items.professional_id`,
  `commission_records.member_id`; `member_categories` é CASCADE; o resto (created_by, opened_by, closed_by,
  cancelled_by, member_id de pagamento/caixa/notificação, audit_log.actor_member_id, time_blocks.professional_id,
  commission_rules.member_id) é nulável. Sem migration de nulabilidade: tornar `appointments.professional_id` /
  `comanda_items.professional_id` nuláveis quebraria `professional: Member!` no GraphQL e no frontend — o histórico
  fechado dela é APAGADO (permitido pela decisão), não desvinculado.
- `users` ← `members.user_id`, `refresh_tokens.user_id`, `email_verification_tokens.user_id` (sem cascade).
- Dono = ADMIN não excluído mais antigo (`ORDER BY m.created_at LIMIT 1`, mesmo critério de admin_list_clients).
- Permissões: `MEMBER_REMOVE` = só ADMIN (mesma de deactivateMember); `CONTRACT_CANCEL` = ADMIN+MANAGER (mesma de
  cancelBridalGroup). Frontend: `canManageMembers(roleName)` e `useBridalPermission('contract.cancel')`.
</objective>

<context>
@apps/backend/src/identity/members.service.ts (deactivate ~l.593, isLastActiveAdmin, member_user_org_count ~l.555, errPayload)
@apps/backend/src/bridal/bridal.service.ts (cancelGroup ~l.851, fail(), BridalError, recordAudit, BRIDAL_SCHEDULE_TX_OPTIONS)
@apps/backend/src/common/audit-log.ts (recordAudit(tx, {orgId, actorMemberId, action, entityType, entityId, reason, metadata}))
@apps/backend/prisma/migrations/20260929120000_member_contact_and_categories/migration.sql (padrão SECURITY DEFINER)
@apps/backend/test/integration/members-lifecycle.e2e.spec.ts, phase4-contract-payments.e2e.spec.ts (fixtures a reusar)
@apps/frontend/src/features/identity/components/DeactivateMemberDialog.tsx, features/bridal/components/CancelBridalGroupDialog.tsx
@apps/e2e/tests/equipe-desativar-bloqueado.spec.ts, noivas-contrato.spec.ts, support/phase3.ts, support/phase4.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Backend — funções de purge, mutations e testes de integração</name>
  <files>apps/backend/prisma/migrations/20261112000000_hard_delete_member_bridal/migration.sql, apps/backend/src/graphql/schema/identity.graphql, apps/backend/src/graphql/schema/bridal.graphql, apps/backend/src/identity/members.service.ts, apps/backend/src/identity/members.resolver.ts, apps/backend/src/bridal/bridal.service.ts, apps/backend/src/bridal/bridal.resolver.ts, apps/backend/test/integration/hard-delete-member-bridal.e2e.spec.ts</files>
  <behavior>
    - Profissional com 1 appointment `scheduled` → payload `errors[0].code = 'MEMBER_HAS_OPEN_WORK'`, `openAppointmentCount = 1`, linha de members intacta.
    - Profissional com item numa comanda `open` (atendimento já completed) → mesmo código, `openComandaCount = 1`, mensagem "1 comanda aberta".
    - Profissional só com histórico fechado (appointment completed + comanda closed com item dela + commission_record + commission_rule + time_block + notification + cash_movement.member_id + audit_log como ator) → `deletedId` = id; member, users (sem outra org), refresh_tokens dela, appointments/itens/commission_records/rules/time_blocks/notifications dela somem; comanda fechada, pagamento e cash_movement continuam com member_id/appointment_id NULL; audit_log antigo fica com actor NULL; nova linha `member.delete_permanent` com `metadata.displayName`.
    - users com membership em outra org → member apagado, users mantido.
    - Excluir a si mesma → `CANNOT_DELETE_SELF`; excluir o dono → `CANNOT_DELETE_OWNER`; id de outra org → `MEMBER_NOT_FOUND` (RLS).
    - Grupo com contrato + versão + aceite + token + parcela + pagamento (gera cash_movement) + agendamentos + comanda do agendamento + deslocamento → `deletedId`; todas essas linhas somem, `clients` das pessoas continuam; audit `bridal.delete_permanent` com `metadata.name`. Funciona com grupo ativo e com contrato não cancelado.
    - Comanda do grupo que tem item de agendamento fora do grupo → `BRIDAL_SHARED_COMANDA`, nada apagado.
  </behavior>
  <action>
  **Migration** (SQL puro, sem mudança no schema.prisma) cria duas funções `LANGUAGE plpgsql SECURITY DEFINER SET
  search_path = public, pg_temp`, cada uma começando com `v_org := nullif(current_setting('app.current_organization',
  true), '')::uuid; IF v_org IS NULL THEN RAISE EXCEPTION 'tenant ausente'` e confirmando que a linha alvo pertence a
  v_org (senão RAISE). Toda instrução filtra `organization_id = v_org`. Retornam `void`. REVOKE de PUBLIC + GRANT
  EXECUTE para sgs_app.

  `purge_member(p_member uuid)`: (defesa) RAISE se houver appointment dela em scheduled/confirmed/in_progress ou item
  dela em comanda open. Ordem: `A` = ids de appointments com professional_id = p_member →
  `cash_movements`/`client_credit_movements` SET appointment_id = NULL WHERE appointment_id IN A; DELETE
  commission_records WHERE member_id = p_member; DELETE comanda_items WHERE professional_id = p_member; DELETE
  appointments IN A (comanda_items.appointment_id é SET NULL automático); DELETE commission_rules, time_blocks
  (professional_id), notifications WHERE member_id = p_member (regra/bloqueio/aviso dela; NÃO nular rule — viraria
  regra geral); UPDATE ... SET col = NULL nas colunas de autoria: appointments.cancelled_by, ai_schedule_suggestions.
  created_by, audit_log.actor_member_id, bridal_groups.created_by, cash_movements.member_id,
  client_credit_movements.created_by, comanda_items.created_by, comanda_payments.member_id, comandas.opened_by/
  closed_by, contract_settings.updated_by, contracts.cancelled_by/created_by, contract_access_tokens.created_by,
  contract_letterheads.uploaded_by, contract_payments.member_id, contract_versions.created_by,
  stock_movements.performed_by, time_blocks.created_by; guarda user_id; DELETE members (member_categories cascade);
  se `NOT EXISTS (members WHERE user_id = v_user)` (sem filtro de org — é o ponto), DELETE refresh_tokens,
  email_verification_tokens e users. Antes de escrever, rodar a query de pg_constraint
  (`confrelid = 'members'::regclass`) no sgs_dev para confirmar que nenhuma FK nova ficou de fora.

  `purge_bridal_group(p_group uuid)`: `A` = appointments do grupo; `C` = contracts do grupo; `K` = comandas com
  item em A ou com contract_id em C, mais appointments.comanda_id de A. RAISE 'BRIDAL_SHARED_COMANDA' se alguma
  comanda de K tiver item com appointment_id fora de A e contract_id fora de C. Ordem: DELETE commission_records
  (comanda_id IN K); DELETE cash_movements (comanda_id IN K OR contract_id IN C OR appointment_id IN A); DELETE
  client_credit_movements (comanda_id IN K OR appointment_id IN A); DELETE comandas IN K (itens/pagamentos cascade,
  stock_movements SET NULL); DELETE contract_payments de C (primeiro os com reverses_payment_id NOT NULL); DELETE
  contract_acceptances, contract_access_tokens, depois contract_versions de C; DELETE contracts C (items/parcelas
  cascade); DELETE appointments A; DELETE bridal_groups (members→services, time_blocks, ai_schedule_suggestions
  cascade). Conferir no sgs_dev a lista de FKs para contracts/contract_versions/bridal_group_members antes.

  **SDL**: `identity.graphql` → `deleteMemberPermanently(id: UUID!): DeleteMemberPermanentlyPayload!` com
  `deletedId: UUID, openAppointmentCount: Int!, openComandaCount: Int!, errors: [UserError!]!`. `bridal.graphql` →
  `deleteBridalGroupPermanently(id: UUID!): DeleteBridalGroupPermanentlyPayload!` com `deletedId: UUID, errors:
  [UserError!]!`. Docstring: "Exclusão definitiva e irreversível".

  **MembersService.deletePermanently(orgId, callerMemberId, id)** em `runWithTenant`: não achou → MEMBER_NOT_FOUND;
  id === caller → CANNOT_DELETE_SELF; dono (query do ADMIN mais antigo `deletedAt: null`, ordem createdAt) →
  CANNOT_DELETE_OWNER; conta `appointment` (professionalId, status in scheduled/confirmed/in_progress) e `comanda`
  (status 'open', items some professionalId = id); se >0 → MEMBER_HAS_OPEN_WORK com mensagem montada só das partes
  não-zero, singular/plural: `"${displayName} tem 3 atendimentos agendados e 1 comanda aberta. Conclua ou remaneje
  antes de excluir."`. Senão `` tx.$executeRaw`SELECT purge_member(${id}::uuid)` `` e `recordAudit(tx, { orgId,
  actorMemberId: callerMemberId, action: 'member.delete_permanent', entityType: 'member', entityId: id, metadata:
  { displayName, email } })` DEPOIS do purge (o ator é quem chama, que continua existindo). Resolver
  `@RequirePermission(PERMISSIONS.MEMBER_REMOVE)` passando `tenantCtx.memberId`.

  **BridalService.deletePermanently(orgId, memberId, id)** em `runWithTenant(..., BRIDAL_SCHEDULE_TX_OPTIONS)` com
  try/`fail(e)`: grupo inexistente → BridalError 'GROUP_NOT_FOUND' (reusar o código/mensagem de requireActiveGroup,
  mas sem exigir ativo); pré-checar comanda compartilhada em TS (mesmo critério) para devolver
  BRIDAL_SHARED_COMANDA amigável; purge; recordAudit `bridal.delete_permanent`, entityType 'bridal_group',
  metadata { name, eventDate, contracts: n, appointments: n }. Resolver `@RequirePermission(PERMISSIONS.CONTRACT_CANCEL)`.
  NÃO exige contrato cancelado; clientes não são apagados.

  **Integração** (`test/integration/hard-delete-member-bridal.e2e.spec.ts`, Postgres real sgs_dev, reusando os
  helpers/fixtures de members-lifecycle e phase4-contract-payments): um teste por bullet do `<behavior>`, mais
  `rls`: org B não consegue excluir member/grupo da org A. Asserções por contagem direta via cliente admin/migrator
  dos helpers (sgs_app não lê audit/users de outra org). Teste unitário do montador de mensagem de bloqueio
  (função pura exportada `openWorkMessage(name, appts, comandas)`) em `src/identity/members-delete.spec.ts`.
  </action>
  <verify>
    <automated>cd /root/sgs/apps/backend && pnpm prisma migrate deploy && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration -- hard-delete-member-bridal members-lifecycle phase4-bridal-group</automated>
  </verify>
  <done>Migration aplica no sgs_dev; as duas mutations respondem conforme o behavior; integração e unit verdes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Frontend — confirmação digitando o nome nas duas telas</name>
  <files>apps/frontend/src/components/ui/confirm-by-name-dialog.tsx, apps/frontend/src/components/ui/__tests__/confirm-by-name-dialog.test.tsx, apps/frontend/src/features/catalog/api/members.api.ts, apps/frontend/src/features/bridal/api/bridal.api.ts, apps/frontend/src/pages/ProfissionaisPage.tsx, apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx, apps/frontend/src/infrastructure/i18n/locales/pt-BR.json</files>
  <behavior>
    - Botão "Excluir definitivamente" fica desabilitado até o texto digitado bater com o nome (trim, sem diferenciar maiúsculas; acentos contam).
    - Ao confirmar chama `onConfirm`; erro do payload aparece dentro do diálogo (role="alert") e o diálogo fica aberto.
    - Texto do diálogo avisa "Esta ação é irreversível" e lista o que será apagado.
  </behavior>
  <action>
  `ConfirmByNameDialog` genérico sobre `components/ui/dialog.tsx` (props: open, onOpenChange, title, description
  ReactNode, expectedName, confirmLabel, loading, error?: string | null, onConfirm). Input com label "Digite
  <strong>{nome}</strong> para confirmar", `autoComplete="off"`, `data-testid="confirm-name-input"`; botão
  `variant="destructive"` `data-testid="confirm-delete"`. Vitest cobre o behavior.

  API: `DeleteMemberPermanentlyMutation` em members.api.ts (deletedId, openAppointmentCount, openComandaCount,
  errors{code message field}) e `DeleteBridalGroupPermanentlyMutation` em bridal.api.ts, com tipos de resposta no
  mesmo estilo das vizinhas.

  ProfissionaisPage: novo `DropdownMenuItem` "Excluir definitivamente" (ícone Trash2, classe text-destructive) no menu
  de ações, dentro do mesmo `canManage` (ADMIN = MEMBER_REMOVE); escondido na linha do próprio usuário logado.
  Sucesso → `refetchQueries` de allMembers/members, toast (sonner, igual ao deactivate) "Profissional excluída". Bloqueio
  → mostra `errors[0].message` no diálogo. Chaves novas em pt-BR.json sob `team.actions.deletePermanent` e
  `team.deletePermanent.*`.

  BridalGroupDetailPage: botão `variant="outline"` com texto destrutivo "Excluir definitivamente"
  (`data-testid="delete-group-permanent"`) visível com `canCancel` (contract.cancel), independente de `active`.
  Descrição lista: pessoas do grupo, agendamentos, contrato(s), parcelas, pagamentos e lançamentos de caixa; "as
  clientes continuam cadastradas". Sucesso → toast e `navigate('/noivas')` com refetch de bridalGroups.

  Formatação À MÃO (aspas simples, ~100 colunas, estilo do arquivo); NÃO rodar `prettier --write` em arquivo
  existente.
  </action>
  <verify>
    <automated>cd /root/sgs/apps/frontend && pnpm lint && pnpm typecheck && pnpm test</automated>
  </verify>
  <done>Os dois botões aparecem só para quem tem a permissão; o diálogo só libera com o nome digitado; vitest verde.</done>
</task>

<task type="auto">
  <name>Task 3: E2E Playwright — fluxo de exclusão digitando o nome</name>
  <files>apps/e2e/tests/exclusao-definitiva.spec.ts</files>
  <action>
  Spec autônoma (não mexer no seed compartilhado): cria via API com `ownerToken(seed)` uma profissional descartável
  (`createProfessional`, nome único com sufixo Date.now()) e um grupo de noiva com contrato (helpers de phase4 /
  `createBridalPackage`, igual noivas-contrato.spec.ts).
  Teste 1 (profissional): login do owner via UI → Profissionais → ações da linha (`openRowActions`) → "Excluir
  definitivamente" → botão desabilitado; digita nome errado → continua desabilitado; digita o nome certo →
  confirma → linha some; `gql` allMembers não contém mais o id.
  Teste 2 (bloqueio): profissional com agendamento futuro (createVisit/appointment) → confirma com o nome → diálogo
  mostra "1 atendimento agendado" e a linha continua.
  Teste 3 (noiva): abre o grupo → "Excluir definitivamente" → digita o nome do grupo → confirma → cai em /noivas sem
  o grupo; `gql bridalGroup(id)` retorna null.
  </action>
  <verify>
    <automated>cd /root/sgs/apps/e2e && pnpm exec playwright test exclusao-definitiva equipe-desativar-bloqueado noivas-contrato</automated>
  </verify>
  <done>3 testes verdes junto com os specs vizinhos de equipe e noivas.</done>
</task>

</tasks>

<verification>
Gate completo antes do commit (memória de workflow): backend lint + tsc + jest unit + integração completa (sgs_dev);
frontend lint + tsc + vitest; E2E completo. Commit em `master`, push, deploy staging (a migration roda no deploy) e
acompanhar CI. Depois, no staging, excluir "A definir 2" e as noivas teste pela UI para validar de ponta a ponta.
</verification>

<success_criteria>
- `deleteMemberPermanently` e `deleteBridalGroupPermanently` existem, protegidas por MEMBER_REMOVE e CONTRACT_CANCEL.
- Bloqueio de profissional só por atendimento aberto / comanda aberta, com contagem na mensagem; self e dono bloqueados.
- Nenhuma tabela append-only ganhou GRANT de UPDATE/DELETE para sgs_app (tudo via funções SECURITY DEFINER com filtro de org).
- audit_log registra cada exclusão com o nome no metadata.
- Confirmação por nome nas duas telas; testes de integração, vitest e E2E verdes.
</success_criteria>

<output>
Ao concluir, criar `.planning/quick/261112-gei-exclusao-definitiva-de-profissional-e-de/261112-gei-SUMMARY.md`
</output>
