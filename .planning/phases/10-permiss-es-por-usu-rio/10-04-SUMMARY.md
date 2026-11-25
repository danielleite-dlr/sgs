---
phase: 10-permiss-es-por-usu-rio
plan: 04
subsystem: authz
tags: [permissoes, resolvers, catalogo, financeiro, custos]
requires: [10-01, 10-02, 10-03]
provides:
  - "@RequireAccess em todas as operações de Financeiro, Comandas, Clientes, Agenda e Catálogo"
  - máscara de custo dos pacotes pelo acesso efetivo (hasCostVisibility)
affects: [10-10]
key-files:
  modified:
    - apps/backend/src/financial/financial.resolver.ts
    - apps/backend/src/financial/fixed-expense.resolver.ts
    - apps/backend/src/comandas/comandas.resolver.ts
    - apps/backend/src/clients/clients.resolver.ts
    - apps/backend/src/appointments/appointments.resolver.ts
    - apps/backend/src/catalog/categories/categories.resolver.ts
    - apps/backend/src/catalog/services/services.resolver.ts
    - apps/backend/src/catalog/products/products.resolver.ts
    - apps/backend/src/catalog/packages/packages.resolver.ts
    - apps/backend/src/catalog/packages/package-timeline.resolver.ts
    - apps/backend/src/catalog/commissions/commissions.resolver.ts
    - apps/backend/src/catalog/catalog-costs.spec.ts
  created:
    - apps/backend/test/integration/phase10-ops-access.e2e.spec.ts
decisions:
  - Operações de agenda aceitam só 'agenda' (consumidores fora da Agenda: apenas o painel, escondido sem agenda no 10-11); createVisit também só 'agenda' (o frontend só a chama da agenda)
  - canSeeCatalogCosts permanece em catalog-costs.ts (10-05 ainda usa; 10-10 remove)
metrics:
  completed: 2026-11-25
requirements: [PERM-04, PERM-05, PERM-07]
---

# Phase 10 Plan 04: acesso por item em financeiro, comandas, clientes, agenda e catálogo Summary

As 11 áreas de resolvers passaram a declarar `@RequireAccess` em cada `@Query`/`@Mutation` (contagem anotações = operações em todos os arquivos), e os 7 campos de custo do pacote agora decidem pelo acesso efetivo: quem ganhou Financeiro (fin-controle) vê custo, lucro e diária da assistente; sem o ganho, recebe null.

## Tabela operação -> itens

| Operação | Itens |
|---|---|
| financialSummary, cashMovements | fin-controle |
| commissionRecords, commissionTotals | fin-comissoes (recorte da Profissional por papel mantido) |
| clientCreditBalances, clientCreditMovements, adjustClientCredit | fin-credito |
| fixedExpenses | fin-despesas-fixas, fin-previsao |
| create/update/deleteFixedExpense | fin-despesas-fixas |
| comanda, comandas, openWalkInComanda, addComandaItem, removeComandaItem, linkComandaItemToContract, addComandaPackage, addComandaPayment, removeComandaPayment, closeComanda, reopenComanda | fin-comandas |
| clients, client, clientsByField, clientOverview, clientHistory, createClient | CLIENTES_REF |
| updateClient, softDeleteClient, restoreClient | clientes-todos |
| appointments, timeBlocks, createAppointment, createVisit, moveAppointment, updateAppointmentStatus, cancelAppointment, createTimeBlock, deleteTimeBlock | agenda |
| categories, category | CATALOGO_REF |
| createCategory, updateCategory, reorderCategory, softDeleteCategory | categorias |
| services, service | CATALOGO_REF |
| create/update/softDeleteService | servicos-todos |
| products, product | CATALOGO_REF |
| lowStockCount, productStockMovements, create/update/softDeleteProduct, adjustStock | produtos-todos |
| packages, package, bridalAssistantSettings | CATALOGO_REF |
| create/update/softDeletePackage, updateBridalAssistantSettings | pacotes-todos |
| packageTimeline | CATALOGO_REF |
| setPackageTimeline | pacotes-todos |
| commissionRules, commissionRule | CATALOGO_REF |
| create/update/softDeleteCommissionRule | fin-regras-comissao |

## Máscara de custo

`PackagesResolver` e `PackageServiceItemResolver` injetam `AccessService` e usam `@Context()` com `forContext` + `hasCostVisibility` (field resolvers não passam pelo guard, mas o guard da Query pai já preencheu o tenant e memoizou o acesso). `catalog-costs.spec.ts` foi adaptado para o AccessService simulado.

## Testes

- `phase10-ops-access`: 8 casos verdes (D-06, Pitfall 8, clientes, custos PERM-07, comissões, categorias, produtos). Comissões: fluxo real de comanda fechada por proA e proB (helpers/phase3-comanda-flow) com regra de 40% no serviço.
- Unitários `catalog`: 55 verdes. tsc e eslint dos arquivos tocados limpos.
- Regressão de integração (phase3, phase2, phase5, phase10-access-guard, quick-261124): 27 suítes, todas verdes após o ajuste abaixo.

## Deviations from Plan

- [Rule 3] `catalog-costs.spec.ts` instanciava os resolvers sem AccessService; atualizado para o novo construtor e para métodos assíncronos.
- [Rule 1] `phase10-access-guard.e2e.spec.ts` (10-03) assumia financialSummary sem @RequireAccess; agora o item fin-controle o fecha (mensagem 'área desativada'). Teste atualizado para a nova semântica.
- Worktree sem node_modules/.env: instalado e copiado (não versionados).

## Commits

- d1b2aca feat(10-04): acesso por item em financeiro, comandas, clientes e agenda
- 617bb46 feat(10-04): acesso por item no catálogo e custos para quem ganhou financeiro

## Known Stubs

Nenhum.

## Self-Check: PASSED
