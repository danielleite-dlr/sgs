---
phase: 05-uso-no-dia-a-dia
plan: 20
type: execute
wave: 5
depends_on: ["05-07", "05-08"]
files_modified:
  - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
  - .env.audit
autonomous: false
requirements: [UX-DAY, FIN-03]

must_haves:
  truths:
    - "Cada item aprovado da auditoria está marcado como corrigido (commit) e verificado no staging"
    - "A usuária confirmou no staging o painel com a previsão de 30 dias e as correções aprovadas"
    - "O usuário de auditoria está desativado no staging e não consegue mais entrar (D-12)"
    - "A senha de auditoria não existe mais em arquivo local"
  artifacts:
    - path: ".planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md"
      provides: "Seção Correções com Corrigido em e Verificado no staging preenchidos"
      contains: "Verificado no staging"
  key_links:
    - from: "members (staging)"
      to: "auth_user_memberships"
      via: "status = 'inactive' exclui a membership do login"
      pattern: "status = 'inactive'"
---

<objective>
Fechamento da fase 5 (UX-DAY, FIN-03; D-01, D-12; critério de sucesso 1 e 2): reverificar no staging os itens aprovados, conferir a previsão com dados reais, obter o aceite da usuária e desativar o usuário de auditoria.

Nota de dependência: o plano 05-08 atualiza `depends_on`/`wave` deste arquivo para incluir o último lote de correção (05-09…05-19). Se `depends_on` ainda for só `["05-07", "05-08"]` e existirem planos `05-09*`…`05-19*`, PARAR e corrigir antes de executar.

Purpose: a fase termina com tudo no ar, conferido pela usuária, e sem credencial de teste ativa no staging.
Output: `05-AUDITORIA.md` com verificação no staging, aceite registrado, usuário de auditoria inativo.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-uso-no-dia-a-dia/05-CONTEXT.md
@.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
@.planning/phases/05-uso-no-dia-a-dia/05-01-SUMMARY.md
@.planning/phases/05-uso-no-dia-a-dia/05-07-SUMMARY.md
@.planning/phases/05-uso-no-dia-a-dia/05-08-SUMMARY.md

<interfaces>
- Credencial de auditoria: `/root/sgs/.env.audit` (`AUDIT_EMAIL=auditoria.ux@sgs.invalid`, `AUDIT_USER_ID`, `AUDIT_MEMBER_ID`, `AUDIT_ORG_ID=01a0b681-8b9b-790b-921d-4518350e534b`).
- Staging DB: `cd /root/sgs && set -a && . ./.env.staging && set +a && docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" sgs_stg_postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"`.
- Login só aceita memberships com `members.status = 'active'` (função `auth_user_memberships`); refresh tokens em `refresh_tokens(user_id, revoked_at)`.
- Roteiros: `apps/e2e/audit/telas.audit.ts`, `apps/e2e/audit/previsao-staging.audit.ts`, config `apps/e2e/playwright.audit.config.ts`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reverificar no staging os itens corrigidos e a previsão</name>
  <files>.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md</files>
  <read_first>
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md (seção Correções)
    - apps/e2e/audit/telas.audit.ts e apps/e2e/audit/previsao-staging.audit.ts
    - SUMMARYs dos lotes 05-09…05-19 que existirem
  </read_first>
  <action>
1. Conferir que todo item aprovado tem `Corrigido em (commit)` preenchido em `## Correções`; faltando algum, PARAR e reportar qual lote não terminou.
2. Conferir que o staging está com o último commit: `git log origin/master -1 --format=%h` igual ao último deploy (rodar `./scripts/deploy-staging.sh` se `git log` mostrar commit posterior ao último deploy registrado nos SUMMARYs) e CI verde (`gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion'` = `success`).
3. Rodar a auditoria somente leitura de novo no staging: `cd /root/sgs/apps/e2e && corepack pnpm exec playwright test -c playwright.audit.config.ts audit/telas.audit.ts audit/previsao-staging.audit.ts`. Para cada item aprovado, abrir (Read) a screenshot nova da tela correspondente e comparar com o "Esperado" do item. Preencher `Verificado no staging` com `ok (AAAA-MM-DD)` ou `falhou: <motivo>`. Item que falhou: reabrir como pendente na seção e reportar (não marcar a fase como pronta).
4. Previsão com dados reais: no staging, comparar (via consulta somente leitura no banco com `SET LOCAL app.current_organization`) a soma das despesas fixas ativas que vencem nos próximos 30 dias e a soma das parcelas pendentes do contrato `active` da Studio JS com o que o detalhe `/financeiro/previsao` mostra (screenshot `90-previsao-*`). Registrar no SUMMARY os totais conferidos (valores agregados, sem dados de clientes).
  </action>
  <verify>
    <automated>cd /root/sgs && F=.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md && ! grep -E '^\| UX-[0-9]+ \| 05-[0-9]+ \|' $F | grep -qE '\| — \|' && ! grep -q 'falhou:' $F && (cd apps/e2e && corepack pnpm exec playwright test -c playwright.audit.config.ts audit/previsao-staging.audit.ts)</automated>
  </verify>
  <acceptance_criteria>
    - Toda linha `| UX-xx | 05-NN |` da seção `## Correções` tem commit e `ok (AAAA-MM-DD)` (nenhum `—` e nenhum `falhou:`)
    - `previsao-staging.audit.ts` passa no staging
    - SUMMARY registra os totais da previsão conferidos contra o banco
  </acceptance_criteria>
  <done>Correções e previsão conferidas no staging pelo roteiro automatizado.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Aceite da usuária no staging</name>
  <files>.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md</files>
  <read_first>
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
  </read_first>
  <action>Apresentar à usuária, em PT-BR, a lista de itens corrigidos (ID, tela, o que mudou) e os passos abaixo. Registrar a resposta em `05-AUDITORIA.md` (nova seção `## Aceite final` com data e resumo) e em `.planning/STATE.md`. Problema relatado vira item novo `UX-xx` com `Aprovado? = sim` e um lote extra (repetir 05-08 só para ele) antes de seguir para a Task 3.</action>
  <what-built>Previsão financeira de 30 dias no painel (cartão + gráfico por semana + detalhe em Financeiro → Previsão de 30 dias), cadastro de despesas fixas, painel como tela inicial de ADMIN/MANAGER e as correções de usabilidade aprovadas, tudo no staging.</what-built>
  <how-to-verify>
    1. Entrar em https://sgs.jessicaseixasmakeup.com.br com a conta da Studio JS (como dona/ADMIN) — deve abrir o **Início** com o cartão "Previsão dos próximos 30 dias".
    2. Em Financeiro → Despesas fixas, cadastrar uma despesa real (ex.: aluguel, com valor e dia) e voltar ao Início: a despesa entra em "Saídas previstas".
    3. Clicar no cartão: o detalhe mostra cada valor com a origem (agendamento, parcela de contrato, comissão, despesa fixa) e marca "em atraso" o que venceu.
    4. Percorrer as telas dos itens corrigidos (lista acima) no computador e no celular.
    5. Responder "aprovado" ou descrever o que ainda incomoda.
  </how-to-verify>
  <verify>
    <automated>cd /root/sgs && grep -q '^## Aceite final' .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md</automated>
  </verify>
  <acceptance_criteria>
    - `05-AUDITORIA.md` contém `## Aceite final` com data e a resposta resumida
    - `.planning/STATE.md` registra o aceite da fase 5
  </acceptance_criteria>
  <resume-signal>Digite "aprovado" ou descreva o que ainda precisa mudar.</resume-signal>
  <done>Usuária aceitou a fase no staging.</done>
</task>

<task type="auto">
  <name>Task 3: Desativar o usuário de auditoria no staging (D-12) e apagar a senha local</name>
  <files>.env.audit</files>
  <read_first>
    - /root/sgs/.env.audit (ids do usuário e do member)
    - apps/backend/src/identity/members.service.ts (método deactivate: só muda members.status para 'inactive')
  </read_first>
  <action>
1. No staging (comando psql de `<interfaces>`), numa transação:
```sql
BEGIN;
SET LOCAL app.current_organization = '01a0b681-8b9b-790b-921d-4518350e534b';
UPDATE members SET status = 'inactive', updated_at = now()
 WHERE id = '<AUDIT_MEMBER_ID>' AND organization_id = '01a0b681-8b9b-790b-921d-4518350e534b';
UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = '<AUDIT_USER_ID>' AND revoked_at IS NULL;
COMMIT;
```
   (o primeiro UPDATE deve afetar exatamente 1 linha). Não apagar o usuário (o histórico de login fica).
2. Conferir que o login falhou: mesmo `curl` de login do 05-01 com a senha atual agora retorna `errors` (credenciais/sem organização).
3. Reescrever `/root/sgs/.env.audit` sem a senha: manter `AUDIT_EMAIL`, `AUDIT_USER_ID`, `AUDIT_MEMBER_ID`, `AUDIT_ORG_ID` e acrescentar `AUDIT_DEACTIVATED_AT=<AAAA-MM-DD>`; remover a linha `AUDIT_PASSWORD=`.
4. Registrar no SUMMARY: e-mail do usuário, data da desativação e como reativar numa próxima auditoria (`UPDATE members SET status='active' …` + nova senha pelo mesmo mecanismo do 05-01, Task 1).
  </action>
  <verify>
    <automated>cd /root/sgs && ! grep -q '^AUDIT_PASSWORD=' .env.audit && grep -q '^AUDIT_DEACTIVATED_AT=' .env.audit && set -a && . ./.env.staging && set +a && test "$(docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" sgs_stg_postgres psql -tA -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT m.status FROM members m JOIN users u ON u.id = m.user_id WHERE u.email = 'auditoria.ux@sgs.invalid'")" = "inactive"</automated>
  </verify>
  <acceptance_criteria>
    - Consulta no staging `SELECT m.status FROM members m JOIN users u ON u.id=m.user_id WHERE u.email='auditoria.ux@sgs.invalid'` retorna `inactive`
    - Nenhum `refresh_tokens` do usuário com `revoked_at IS NULL`
    - Login do usuário de auditoria retorna erro
    - `.env.audit` não contém `AUDIT_PASSWORD=` e contém `AUDIT_DEACTIVATED_AT=`
  </acceptance_criteria>
  <done>Usuário de auditoria desativado no staging, sem sessão válida e sem senha guardada.</done>
</task>

</tasks>

<verification>
- Correções verificadas no staging; aceite da usuária registrado; usuário de auditoria inativo
</verification>

<success_criteria>
Critério de sucesso 1 completo (lista aprovada e itens corrigidos no staging) e critério 2 confirmado pela usuária com dados reais. D-12 cumprido (usuário desativado ao fim da fase).
</success_criteria>

<output>
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-20-SUMMARY.md`
</output>
