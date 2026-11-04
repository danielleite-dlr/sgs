---
phase: 04-bridal-contracts
plan: 15
subsystem: testing
tags: [playwright, rls, rbac, feature-flags, e2e, validation]
requires:
  - phase: 04-bridal-contracts
    provides: backend e frontend de noivas, contratos, aceite público, alertas e agenda IA (04-01..04-14)
provides:
  - flags noivas e contratos ligadas (menu Eventos visível)
  - suíte transversal phase4-rls-rbac (13 tabelas, 16 operações x 4 papéis, rota pública)
  - E2E Playwright noivas-contrato (fluxo crítico da fase 4)
  - 04-VALIDATION.md completo (nyquist_compliant)
affects: [04-16-human-verification]
tech-stack:
  added: []
  patterns:
    - "E2E da fase 4 usa helpers GraphQL só para preparar (pacote, prazo, alertas) e a UI para o fluxo"
key-files:
  created:
    - apps/backend/test/integration/phase4-rls-rbac.e2e.spec.ts
    - apps/e2e/support/phase4.ts
    - apps/e2e/tests/noivas-contrato.spec.ts
  modified:
    - apps/frontend/src/config/features.ts
    - apps/e2e/scripts/e2e-env.mjs
    - apps/e2e/tests/equipe-acoes-por-papel.spec.ts
    - apps/frontend/src/__tests__/router.test.tsx
    - apps/frontend/src/config/__tests__/features.test.ts
    - apps/frontend/src/components/layout/__tests__/sidebar-nav.test.tsx
    - .planning/ROADMAP-MOCKS.md
    - .planning/phases/04-bridal-contracts/04-VALIDATION.md
key-decisions:
  - "Env do E2E (ANTHROPIC_API_KEY vazio, CONTRACT_ALERTS_SCHEDULER=false) fica em e2e-env.mjs, onde já ficam os overrides, e não em start-backend.mjs"
  - "Pacote do E2E é criado por GraphQL (createBridalPackage), como o plano lista no helper; o formulário de pacotes usa combobox/i18n e não é o foco do fluxo"
patterns-established:
  - "Editar contrato aceito exige reaceite (reacceptContract) antes de esperar alertas de saldo"
requirements-completed: []
duration: ~95min
completed: 2026-11-04
---

# Phase 4 Plan 15: Verificação E2E da fase 4 Summary

**Flags de noivas/contratos ligadas, suíte transversal RLS/RBAC das 13 tabelas novas e E2E Playwright do fluxo pacote -> grupo -> contrato -> aceite público -> pagamentos -> agenda IA (heurística) -> alertas -> cancelamento.**

## Tarefas

1. **Flags e phase4-rls-rbac** (`95d9ffa`): `noivas: true`, `contratos: true`; suíte com 82 testes (13 tabelas com contagem A>0/B=0/INSERT cruzado bloqueado, GraphQL e rota pública cross-tenant, matriz 16 operações x 4 papéis).
2. **E2E noivas-contrato** (`616a8f5`): 6 testes seriais, passam isolados e na suíte completa.
3. **Gate e VALIDATION.md** (`78881bc`, `bf15e29`, `4f360ca`): mapa preenchido (16 linhas green), `nyquist_compliant: true`, `wave_0_complete: true`, `status: complete`.

## Resultado do gate

- typecheck e lint (backend, frontend, e2e): verdes.
- backend unit: 24 suítes, 209 testes verdes.
- backend integração: 48/49 suítes (475/477 testes). A única falha é `phase4-alerts-boot` (NOAUTH do Valkey local, conhecido e fora de escopo).
- frontend vitest: 53 arquivos, 346 testes verdes.
- Playwright completo: 19 testes verdes (incluindo os existentes) após o ajuste abaixo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] Testes de frontend presumiam flags desligadas**
- **Found during:** Task 1
- **Issue:** `router.test.tsx`, `features.test.ts` e `sidebar-nav.test.tsx` afirmavam que `/noivas`, `/contratos` e o menu Eventos não existiam.
- **Fix:** invertidos para afirmar que as rotas/flags estão ligadas.
- **Commit:** `95d9ffa`

**2. [Rule 1 - Bug] E2E de equipe quebrou com o sino de notificações**
- **Found during:** Task 3 (suíte E2E completa)
- **Issue:** `getByRole('button', { name: 'Ações' })` casa por substring sem diferenciar maiúsculas e pegava o botão "Notificações" (sino da 04-04).
- **Fix:** `exact: true` em `equipe-acoes-por-papel.spec.ts`.
- **Commit:** `4f360ca`

**3. [Divergência do plano] E-mail de resumo não é verificado no E2E**
- `runContractAlertsNow` é execução forçada e, por desenho do backend (04-10), não envia o e-mail de resumo; só o tick diário envia (agendador desligado no E2E). O E2E confere `emailed === 0` e o sino; o e-mail segue coberto por `phase4-contract-alerts.e2e.spec.ts`.

**4. [Divergência do plano] Reaceite antes dos alertas**
- Editar o contrato (prazo) volta o status para "aguardando aceite", que só gera o alerta "não aceito". O E2E gera novo link e aceita pela rota pública (`reacceptContract`) para o contrato voltar a ativo e então dispara os alertas.

**5. [Divergência do plano] Mãe sem serviços planejados**
- Com pacote, os itens das demais pessoas somam ao preço do pacote; para o total ficar em R$ 8.000,00 a mãe é marcada como incluída no contrato sem serviços. "Coberto pelo contrato" é verificado na noiva; as 3 acompanhantes com serviço ficam avulsas e permanecem na agenda após o cancelamento. Evento na primeira quarta-feira a 40+ dias.

**6. [Divergência do plano] Local do override de env**
- Overrides no `e2e-env.mjs` em vez de `start-backend.mjs` (mesmo efeito, já é o ponto único de env do E2E).

## Auth gates

Nenhum.

## Known Stubs

Nenhum.

## Issues Encountered

`phase4-alerts-boot` falha localmente por NOAUTH no Valkey (senha fora do .env), já conhecido; não relacionado a este plano.

## Self-Check: PASSED
