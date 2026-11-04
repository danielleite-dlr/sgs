---
phase: 04-bridal-contracts
plan: 15
type: execute
wave: 6
depends_on: ["04-09", "04-10", "04-11", "04-12", "04-13", "04-14"]
files_modified:
  - apps/frontend/src/config/features.ts
  - .planning/ROADMAP-MOCKS.md
  - apps/backend/test/integration/phase4-rls-rbac.e2e.spec.ts
  - apps/e2e/support/phase4.ts
  - apps/e2e/tests/noivas-contrato.spec.ts
  - apps/e2e/scripts/start-backend.mjs
  - .planning/phases/04-bridal-contracts/04-VALIDATION.md
autonomous: true
requirements: [CLI-03, CONT-01, CONT-02, CONT-03, AI-01]

must_haves:
  truths:
    - "Os menus Grupos de noivas e Contratos aparecem para quem tem permissão (flags noivas e contratos ligadas)"
    - "Nenhuma das 13 tabelas novas vaza entre orgs e a matriz de permissões da fase 4 vale por papel em todas as operações GraphQL novas"
    - "O fluxo crítico roda ponta a ponta no navegador: pacote com entrada → grupo com noiva + 4 acompanhantes → contrato → link → aceite público → entrada → dashboard → Sugerir agenda IA (sem chave = sugestão simples) → confirmar → alertas → cancelar"
    - "A suíte completa (typecheck, lint, unit, integração incl. fase 3, vitest, Playwright) fica verde"
  artifacts:
    - path: "apps/e2e/tests/noivas-contrato.spec.ts"
      provides: "E2E do fluxo crítico da fase 4 (QA-02 'criar contrato')"
    - path: "apps/backend/test/integration/phase4-rls-rbac.e2e.spec.ts"
      provides: "Suíte transversal RLS/RBAC da fase 4"
  key_links:
    - from: "features.ts"
      to: "rotas /noivas e /contratos (04-04)"
      via: "flags noivas/contratos = true"
      pattern: "noivas: true"
    - from: "noivas-contrato.spec.ts"
      to: "página pública /aceite/:orgId/:token"
      via: "link copiado na tela do contrato"
      pattern: "/aceite/"
---

<objective>
Fechar a fase: ligar as flags `noivas` e `contratos`, suíte transversal de RLS/RBAC da fase 4, E2E Playwright do fluxo crítico de noivas/contratos (a verificação humana dos itens manuais fica no 04-16).

Purpose: CLAUDE.md exige E2E dos fluxos críticos e isolamento de tenant testado; VALIDATION.md lista os itens manuais.
Output: flags ligadas, `phase4-rls-rbac`, `noivas-contrato.spec.ts` + helper, VALIDATION.md atualizado (`nyquist_compliant: true`).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@.planning/phases/04-bridal-contracts/04-VALIDATION.md
@apps/backend/test/integration/phase3-rls-rbac.e2e.spec.ts
@apps/e2e/tests/fluxo-agendamento-comanda-pagamento.spec.ts
@apps/e2e/support/phase3.ts
@apps/e2e/playwright.config.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
```
Branch `master`; sempre `corepack pnpm`. Gate final (suíte completa): `corepack pnpm -r typecheck && corepack pnpm -r --if-present lint && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test && corepack pnpm --filter @sgs/e2e test:e2e`. E2E sobe backend em `localhost:3100` e frontend com `VITE_API_URL` (playwright.config.ts) — sem `ANTHROPIC_API_KEY`.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ligar flags e suíte transversal phase4-rls-rbac</name>
  <files>apps/frontend/src/config/features.ts, .planning/ROADMAP-MOCKS.md, apps/backend/test/integration/phase4-rls-rbac.e2e.spec.ts</files>
  <read_first>
    - apps/frontend/src/config/features.ts
    - apps/backend/test/integration/phase3-rls-rbac.e2e.spec.ts (NINE_TABLES e matriz de papéis)
    - apps/backend/test/integration/helpers/phase4-fixtures.ts
  </read_first>
  <action>
1. `features.ts`: `noivas: true` ("Grupos de noivas — backend real 04-05/04-08/04-12") e `contratos: true` ("Contratos — backend real 04-06/04-09/04-10/04-11"). `.planning/ROADMAP-MOCKS.md`: marcar o item de noivas/contratos como religado em 04-15.
2. `phase4-rls-rbac.e2e.spec.ts` (copiar a estrutura do phase3-rls-rbac): `PHASE4_TABLES` = as 13 tabelas do 04-01; montar dados nas 2 orgs (grupo, membros, serviços planejados, contrato com itens/versão/token/aceite/pagamento, sugestão IA, alert run, settings) via mutations da org A e adminPrisma; para cada tabela, como `appPrisma` com tenant B, `count` das linhas da org A = 0 e INSERT com `organization_id` da A falha (WITH CHECK). Matriz RBAC: tabela `[operação, permissão, papéis permitidos]` para `bridalGroups`, `createBridalGroup`, `scheduleBridalEvent`, `cancelBridalGroup`, `suggestBridalSchedule`, `confirmBridalSchedule`, `contracts`, `createContract`, `generateContractLink`, `recordContractPayment`, `reverseContractPayment`, `cancelContract`, `contractSettings`, `updateContractSettings`, `contractPdf`, `runContractAlertsNow` — para cada papel (admin, manager, attendant, proA) conferir permitido × `FORBIDDEN`. Rota pública: token da org A com `orgId` da B → 404.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase4-rls-rbac && corepack pnpm --filter @sgs/frontend test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "noivas: true" apps/frontend/src/config/features.ts` e `grep -n "contratos: true"` encontram
    - `grep -c "'contract_\|'bridal_\|'ai_schedule_suggestions'" apps/backend/test/integration/phase4-rls-rbac.e2e.spec.ts` ≥ 13
    - Suíte verde; vitest verde com as flags ligadas
  </acceptance_criteria>
  <done>Isolamento e permissões da fase 4 provados num só lugar; telas visíveis.</done>
</task>

<task type="auto">
  <name>Task 2: E2E Playwright noivas-contrato</name>
  <files>apps/e2e/support/phase4.ts, apps/e2e/tests/noivas-contrato.spec.ts, apps/e2e/scripts/start-backend.mjs</files>
  <read_first>
    - apps/e2e/tests/fluxo-agendamento-comanda-pagamento.spec.ts (estrutura, login, seed)
    - apps/e2e/support/phase3.ts, support/graphql.ts, support/outbox.ts, support/ui.ts
    - apps/e2e/scripts/start-backend.mjs (env do backend no E2E)
  </read_first>
  <action>
1. `start-backend.mjs`: garantir `ANTHROPIC_API_KEY` vazio/ausente (modo heurístico determinístico), `CONTRACT_ALERTS_SCHEDULER=false` (o E2E dispara via `runContractAlertsNow`) e `FRONTEND_URL` = URL do frontend do E2E (CORS da rota pública e link de aceite).
2. `support/phase4.ts`: `createBridalPackage(token, { price, depositPercent })`, `extractAcceptLink(page)` (lê a URL exibida no `ContractLinkCard`), `todayPlusDays(n)` (reusar `spDate`), helpers GraphQL para preparar profissionais/serviços (reusar `createProfessional` da fase 3).
3. `tests/noivas-contrato.spec.ts` — UM fluxo serial, todo pela UI salvo o seed:
   a. Owner cria pacote "Pacote Noiva" (R$ 8.000,00, entrada 30%) em Catálogo › Pacotes.
   b. `/noivas` → "Novo grupo": evento em 40 dias, pronta até 15:00, noiva (nova cliente) + 4 acompanhantes novas (2 com telefone), mãe marcada "Incluída no contrato", serviços planejados → detalhe mostra 5 pessoas (critério 1).
   c. "Criar contrato" → formulário com o pacote → total R$ 8.000,00, entrada R$ 2.400,00, prazo = evento − 10 → salvar → detalhe com código `CT-`.
   d. "Gerar link de aceite" → copiar URL → abrir em contexto anônimo (`browser.newContext()`) → página pública mostra o texto → preencher nome + CPF válido (`52998224725`) + marcar aceite → "Aceito" → "Contrato aceito" e botão "Baixar PDF" (download com `%PDF`).
   e. Voltar ao contrato (recarregar) → "Aceito em …"; "Registrar pagamento" R$ 2.400,00 Pix → "Entrada pendente" some; pagar R$ 3.000,00 em 2 linhas (dinheiro + débito) → pago R$ 5.400,00.
   f. `/financeiro` hoje → Faturado inclui "R$ 5.400,00 de contratos".
   g. Grupo → aba "Agenda do evento" → "Sugerir agenda IA" → aviso "IA não configurada — sugestão simples." → "Confirmar agenda" → lista de agendamentos com "Coberto pelo contrato" na noiva/mãe; `/agenda` no dia do evento mostra os agendamentos (critério 3 em modo fallback).
   h. Via GraphQL, mover o prazo (updateContract com `balanceDueDaysBefore` tal que o prazo seja daqui a 2 dias) e `runContractAlertsNow` → o sino mostra contador ≥ 1 e o item "Restante vence em 2 dia(s)"; clicar leva ao contrato; e-mail de resumo presente no outbox (`support/outbox.ts`) (critério 4).
   i. "Cancelar contrato" → "Pela noiva" → prévia "Devolver R$ 0,00" → motivo → confirmar → status "Cancelado"; agendamentos cobertos cancelados; acompanhantes avulsas continuam na agenda.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/e2e typecheck && corepack pnpm --filter @sgs/e2e test:e2e -- noivas-contrato</automated>
  </verify>
  <acceptance_criteria>
    - `corepack pnpm --filter @sgs/e2e test:e2e -- noivas-contrato` verde
    - `grep -n "Sugerir agenda IA" apps/e2e/tests/noivas-contrato.spec.ts` e `grep -n "/aceite/" apps/e2e/tests/noivas-contrato.spec.ts` encontram
    - `grep -n "runContractAlertsNow" apps/e2e/support/phase4.ts apps/e2e/tests/noivas-contrato.spec.ts` encontra
    - As demais specs E2E continuam verdes
  </acceptance_criteria>
  <done>Fluxo crítico da fase 4 automatizado no navegador.</done>
</task>

<task type="auto">
  <name>Task 3: Suíte completa e VALIDATION.md</name>
  <files>.planning/phases/04-bridal-contracts/04-VALIDATION.md</files>
  <read_first>
    - .planning/phases/04-bridal-contracts/04-VALIDATION.md
    - .planning/phases/04-bridal-contracts/04-*-SUMMARY.md
  </read_first>
  <action>Rodar o gate final completo (ver contexto). Atualizar `04-VALIDATION.md`: preencher a coluna de Task IDs do mapa com os planos/tarefas que cobrem cada linha (ex.: `04-05 T3`, `04-07 T3`, `04-12 T3`), marcar `File Exists ✅` e `Status ✅ green` nas linhas verdes, marcar os itens de Wave 0 como concluídos, e no frontmatter `nyquist_compliant: true`, `wave_0_complete: true`, `status: complete`. Qualquer falha do gate: corrigir no código correspondente (desvio documentado no SUMMARY) até ficar verde.</action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm -r typecheck && corepack pnpm -r --if-present lint && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test && corepack pnpm --filter @sgs/e2e test:e2e</automated>
  </verify>
  <acceptance_criteria>
    - Gate completo verde
    - `grep -n "nyquist_compliant: true" .planning/phases/04-bridal-contracts/04-VALIDATION.md` encontra
    - `grep -c "✅ green" .planning/phases/04-bridal-contracts/04-VALIDATION.md` ≥ 15
  </acceptance_criteria>
  <done>Fase validada por automação completa.</done>
</task>

</tasks>

<verification>Gate completo verde.</verification>

<success_criteria>Os 4 critérios de sucesso do ROADMAP (com o critério 2 reinterpretado por D-10/D-11/D-22) estão demonstrados por E2E (itens manuais no 04-16).</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-15-SUMMARY.md`
</output>
