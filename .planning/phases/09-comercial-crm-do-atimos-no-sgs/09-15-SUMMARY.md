---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 15
subsystem: e2e
tags: [playwright, feature-flag, kanban, dnd-kit, formulario-publico]
requires: [09-12, 09-13, 09-14]
provides:
  - flag comercial ligada (menu Comercial, /comercial/*, /contato/*)
  - support/phase9.ts (helpers de seed por GraphQL)
  - E2E do funil, da visibilidade por papel e do formulário público
affects: [09-16]
key-files:
  created:
    - apps/e2e/support/phase9.ts
    - apps/e2e/tests/comercial-funil.spec.ts
    - apps/e2e/tests/comercial-visibilidade.spec.ts
    - apps/e2e/tests/comercial-formulario.spec.ts
  modified:
    - apps/frontend/src/config/features.ts
    - apps/frontend/src/config/__tests__/features.test.ts
    - apps/frontend/src/features/commercial/__tests__/commercial-permissions.test.ts
key-decisions:
  - "Arrastar no E2E pega o card pelo texto do tipo do negócio (o link do nome barra o arraste por stopPropagation) e move o mouse em passos por causa do distance: 8 do PointerSensor"
  - "Profissional do teste de visibilidade é o da fase 3 (seed.phase3.proEmail), não proEditable"
requirements-completed: [COM-01, COM-03, COM-06, COM-07, COM-08, COM-09, COM-10, COM-11]
duration: 50min
completed: 2026-11-18
---

# Phase 9 Plan 15: Liga a flag e E2E do Comercial Summary

Flag `comercial: true` e três specs Playwright que percorrem o Comercial no navegador real: lead, negócio Noiva com pacote, arrastar e "Mover para…", interação com lembrete, ganho com sinal até `/contratos/{id}` em Rascunho, perdido com motivo, visibilidade por papel e formulário público.

## Tarefas

1. Liga a flag, ajusta `features.test.ts` e cria `support/phase9.ts`: `aa8ab68`
2. Specs E2E (funil, visibilidade, formulário): `00e73fc`
3. Teste antigo de permissões que esperava a flag desligada: `e12df5f`

## Verificação

- Frontend: lint e typecheck verdes; vitest 152 arquivos, 1065 testes (1 ajustado, ver desvio 2).
- E2E dos 3 specs novos: 9 testes verdes (3 funil/perdido, 4 visibilidade com o setup, 2 formulário).
- Suíte E2E completa: 64 passed (11,6 min), 0 falhas.

## Deviations from Plan

**1. [Rule 3 - Bloqueio] `proEditable` não loga**
- **Issue:** o `proEditable` do seed mantém a senha provisória (login cai em `/trocar-senha`), então não dá para entrar com ele.
- **Fix:** o teste usa o profissional da fase 3 (`seed.phase3.proEmail/proPassword`), também do papel PROFESSIONAL. O critério do plano que procurava `proEditable` no spec não se aplica ao pé da letra.
- **Commit:** 00e73fc

**2. [Rule 1 - Bug] commercial-permissions.test.ts**
- **Issue:** o teste "flag desligada até o 09-15" falhava com a flag ligada (arquivo fora da lista do plano).
- **Fix:** passou a afirmar a flag ligada.
- **Commit:** e12df5f

**3. Valor do sinal digitado** — o diálogo de ganho não sugere o valor do sinal (09-12, desvio 3); o E2E digita 30% de R$ 4.950,00 (R$ 1.485,00).

**4. Botão "Registrar interação"** fica na aba Interações da ficha; o spec abre a aba antes.

**5. Prettier** não está instalado no ambiente; os specs novos foram formatados à mão (aspas simples, ~100 colunas).

Nenhum código de produção foi alterado além da flag.

## Known Stubs

Nenhum.

## Self-Check: PASSED

Arquivos e commits (aa8ab68, 00e73fc, e12df5f) conferidos.
