---
phase: 03-core-operations
plan: 12
subsystem: e2e-verification
tags: [playwright, rls, rbac, validation]
requires: [03-06, 03-07, 03-08, 03-09, 03-10, 03-11]
provides:
  - phase3-rls-rbac (RLS das 9 tabelas, cross-tenant, matriz de 19 linhas)
  - 4 specs Playwright dos critérios #1 a #5
  - operations-permissions.ts (gate de UI por papel)
key-files:
  created:
    - apps/backend/test/integration/phase3-rls-rbac.e2e.spec.ts
    - apps/e2e/tests/agenda-dnd.spec.ts
    - apps/e2e/tests/agenda-concorrencia.spec.ts
    - apps/e2e/tests/fluxo-agendamento-comanda-pagamento.spec.ts
    - apps/e2e/tests/financeiro-dashboard.spec.ts
    - apps/e2e/support/phase3.ts
    - apps/e2e/support/agenda-ui.ts
    - apps/frontend/src/features/operations/operations-permissions.ts
  modified:
    - apps/e2e/tests/seed.setup.ts
    - apps/e2e/support/seed-state.ts
    - apps/backend/test/integration/phase3-comanda-close.e2e.spec.ts
    - .planning/phases/03-core-operations/03-VALIDATION.md
requirements-completed: []
completed: 2026-11-02
---

# Phase 3 Plan 12: Verificação E2E Summary

RLS/RBAC transversais no backend e 4 specs Playwright cobrem os 5 critérios de sucesso; gate completo verde. Falta a verificação humana (Task 3).

## Commits
- `907eabc` suíte phase3-rls-rbac (+ ajuste do phase3-comanda-close)
- `220dfda` fix: gate de UI por papel
- `3fc4b32` seed, specs E2E e VALIDATION

## Testes (gate completo)
Backend unit 107; integração 293 (31 suítes); vitest frontend 296; E2E 13 passando. Specs novos com `--repeat-each=3` estáveis; o spec do fluxo passou 5/5 com `--repeat-each=5`.

## Deviations from Plan
- **[Rule 1 - Bug] Permissões da UI:** `useAuthStore.permissions` nunca é preenchido, então atendente não via botões de item/pagamento/fechar. Criado `operations-permissions.ts` (por `roleName`, espelha o backend) e aplicado em 5 páginas.
- **[Rule 3] phase3-comanda-close:** contagem global de `consumption` era poluída pelos dados do E2E; filtrada por organização.
- Serviço do seed custa R$ 80: fluxo com total 115, crédito 50 + Pix 15 + dinheiro 60, troco 10, comissão 32,00.
- Concorrência na UI: horário tomado via API com o formulário aberto (slot ocupado fica coberto pelo card).
- Specs criam profissional e cliente próprios para isolar repetições.
- CI (`ci.yml`, job e2e) não precisou de mudança.

## Known Stubs
None.

## Pendente
Task 3: verificação humana (checkpoint), aprovação do usuário.
