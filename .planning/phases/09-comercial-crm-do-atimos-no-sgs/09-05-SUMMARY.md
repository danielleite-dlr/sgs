---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 05
subsystem: backend/commercial
tags: [nestjs, graphql, negocios, interacoes, sla, perdido, rbac]
requires: [09-01, 09-02, 09-04]
provides:
  - commercial-deals.graphql (negócios, interações, extend type CommercialLead)
  - CommercialDealsService (criar, editar, mover, atribuir, perder, reabrir, excluir, listar)
  - CommercialInteractionsService (registrar com próximo contato, listar, excluir)
  - CommercialDealsResolver e CommercialLeadDealsResolver (lead.deals, lead.interactions)
affects: [09-06, 09-08, 09-09, 09-11, 09-12]
key-files:
  created:
    - apps/backend/src/graphql/schema/commercial-deals.graphql
    - apps/backend/src/commercial/commercial-deals.service.ts
    - apps/backend/src/commercial/commercial-interactions.service.ts
    - apps/backend/src/commercial/commercial-deals.resolver.ts
    - apps/backend/test/integration/phase9-deals.e2e.spec.ts
    - apps/backend/test/integration/phase9-lose-deal.e2e.spec.ts
    - apps/backend/test/integration/phase9-interactions.e2e.spec.ts
  modified:
    - apps/backend/src/commercial/commercial.module.ts
decisions:
  - "Dinheiro em centavos inteiros (aceita 50, 50.5, 50,25); pacote fotografado em packageName/packagePrice; desconto sem pacote ou maior que o preço dá DISCOUNT_INVALID."
  - "Negócio fechado não é editado nem movido (DEAL_CLOSED); reabrir só vale para perdido (ganho dá DEAL_CLOSED, aberto dá DEAL_NOT_LOST)."
  - "Listagem sem status devolve abertos + ganhos/perdidos com closed_at nos últimos closedSinceDays (padrão 30); ordem por stageEnteredAt desc, limite padrão 200 (máx. 500)."
  - "CommercialStage.openDeals dentro de deal.stage conta os negócios abertos visíveis ao viewer."
metrics:
  tasks: 2
  completed: 2026-11-18
---

# Phase 9 Plan 05: Negócios, interações e perdido Summary

Ciclo do negócio na API (menos o ganho, do 09-06): vários negócios por lead com pacote fotografado e desconto, mover/atribuir/perder/reabrir/excluir com regras de papel, campo `overdue` pelo SLA da etapa, e interações que atualizam o último contato e criam o lembrete de "próximo contato" na mesma transação.

## Tarefas

1. **Negócios e perdido** (`833c00f` teste, `ca186f0` implementação): SDL, `CommercialDealsService`, resolver com `lead.deals`. Atendente cria sempre como responsável; gestão atribui a ADMIN/MANAGER/ATTENDANT ativos ou deixa sem (ASSIGNEE_INVALID caso contrário). Perdido valida motivo da lista fixa (texto obrigatório em `other`, máx. 500) e move para a etapa Perdido; reabrir é só gestão (D-19) e limpa motivo e closedAt.
2. **Interações** (`1c1477a` teste, `ca186f0` implementação): `lastInteractionAt` por `GREATEST` (data antiga não regride), sem `dealId` atualiza os negócios abertos visíveis do lead, `nextContactAt` futuro cria `commercial_reminders` (título padrão "Retomar contato com {lead}"), passado dá NEXT_CONTACT_PAST sem gravar nada.

## Verificação

`phase9-deals` (12), `phase9-lose-deal` (5), `phase9-interactions` (8) verdes; typecheck e lint do backend verdes.

## Deviations from Plan

Nenhuma de escopo. Códigos de erro adicionais, não listados no plano: `DEAL_NOT_LOST`, `SOURCE_INVALID`, `BENEFICIARY_TOO_LONG`, `LOCATION_TOO_LONG`, `TITLE_TOO_LONG`, `DATE_INVALID`. O commit de implementação (`ca186f0`) reúne negócios e interações porque `commercial.module.ts` registra os dois serviços e o resolver usa ambos.

## Notas para os próximos planos

- `CommercialDealsService` e `CommercialInteractionsService` são exportados pelo `CommercialCoreModule`.
- Colunas de ganho (`wonContractId`, `wonClientId`) não são escritas aqui; o 09-06 fecha o ganho e deve usar a etapa `kind = 'won'`.
- O lembrete criado por interação não tem descrição; o 09-08 cuida de listar/concluir.

## Known Stubs

Nenhum.

## Self-Check: PASSED

Arquivos e commits (833c00f, 1c1477a, ca186f0) conferidos.
