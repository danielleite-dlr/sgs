---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 20
subsystem: bridal/comandas/commissions
tags: [assistant-role, commission, debutante, G-01]
requires: ["11-18"]
provides:
  - "Assistente elegível para noiva e debutante no estúdio"
  - "Assistente (ASSISTANT) sem comissão de serviço: só a diária"
affects: [11-24]
key-files:
  modified:
    - apps/backend/src/bridal/bridal-assistant-rules.ts
    - apps/backend/src/bridal/bridal-assistant-rules.spec.ts
    - apps/backend/src/bridal/bridal-assistant.ts
    - apps/backend/src/comandas/comanda-items.ts
    - apps/backend/src/comandas/comanda-close.ts
    - apps/backend/src/catalog/commissions/commissions.service.ts
    - apps/backend/test/integration/phase91-bridal-assistant.e2e.spec.ts
    - apps/backend/test/integration/phase91-bridal-assistant-ciclo.e2e.spec.ts
  created:
    - apps/backend/test/integration/phase11-assistant-pay.e2e.spec.ts
key-decisions:
  - "Debutante no estúdio com pacote marcado tem assistente (revoga em parte 09.1 D-03); sem migração de dados"
  - "Fechamento filtra itens de ASSISTANT antes das comissões; a diária (bridalAssistantAccrualsTx) segue igual"
requirements-completed: [PRIO-15]
duration: ~40min
completed: 2026-11-26
---

# Phase 11 Plan 20: Assistente só com diária e para debutante Summary

Elegibilidade de assistente passa a noiva OU debutante (estúdio, pacote marcado), com textos por tipo de evento, e a Assistente nunca recebe comissão de serviço (item, regra e fechamento).

## Tasks
1. Debutante no estúdio (regras, textos, testes) - af3e360
2. Sem comissão de serviço para ASSISTANT + integração - commit seguinte (feat(11-20) assistente sem comissão)

## Verificação
- Unit src/comandas src/catalog src/bridal: 207 verdes; tsc e eslint limpos.
- Integração phase11-assistant-pay (5) + phase91 + phase3-comanda: 91 verdes.

## Deviations from Plan
- [Rule 1] A query SQL de `bridalAssistantAccrualsTx` não selecionava `event_kind`; adicionado para o nome "Assistente da Debutante".
- Mensagem esperada em phase91-bridal-assistant-ciclo atualizada para "o pacote não inclui assistente" (fora da lista de arquivos do plano).
- Não rodei prettier em comanda-close.ts para não reformatar linhas alheias; typecheck/lint ok.

## Known Stubs
Nenhum.

## Self-Check: PASSED
