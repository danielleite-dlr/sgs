---
phase: 10-permiss-es-por-usu-rio
plan: 10
subsystem: backend-commercial-authz
tags: [permissoes, comercial, scopeAll, inventario, reflexao]
requires: [10-04, 10-05, 10-06, 10-07, 10-08]
provides:
  - "eligibleAssigneeIds(tx, orgId): responsáveis elegíveis do Comercial = membros ativos com comercial-leads ou comercial-pipeline ligado"
  - "access-inventory.spec.ts: trava o build se operação com @RequirePermission ficar sem @RequireAccess e fora de ACCESS_EXEMPT"
affects: [10-11, 10-12]
key-files:
  created:
    - apps/backend/src/commercial/commercial-assignees.ts
    - apps/backend/test/integration/phase10-commercial-scope.e2e.spec.ts
    - apps/backend/src/authz/access/access-inventory.spec.ts
  modified:
    - apps/backend/src/commercial/commercial-access.ts
    - apps/backend/src/commercial/commercial-access.spec.ts
    - apps/backend/src/commercial/commercial-deals.service.ts
    - apps/backend/src/commercial/commercial-leads.service.ts
    - apps/backend/src/commercial/commercial-import.service.ts
    - apps/backend/src/commercial/commercial-form-settings.service.ts
    - apps/backend/src/commercial/commercial-reminders.service.ts
    - apps/backend/src/catalog/catalog-costs.ts
    - apps/backend/src/catalog/catalog-costs.spec.ts
decisions:
  - "Elegibilidade usa items.get(id).enabled (efetivo), não isGranted (que significa só 'ajuste GRANTED')"
  - "Fila 'sem responsável' em commercial-leads.service segue por creator.role.name != ATTENDANT (limite registrado)"
metrics:
  tasks: 2
  commits: [086b70f, 79ce2cf]
completed: 2026-11-25
---

# Phase 10 Plan 10: Comercial pelo acesso efetivo e inventário da API Summary

Serviços do Comercial deixam de comparar papel: gestão = `viewer.scopeAll`, responsável elegível = membro ativo com Leads ou Pipeline ligado; um spec por reflexão garante que toda operação protegida leva item de acesso.

## O que foi feito

- `commercial-assignees.ts` (`eligibleAssigneeIds`) via `loadAccessManyTx`, usado por `assertAssignee`, `assignees()`, importação e responsável padrão do formulário.
- `isManagerRole(viewer.roleName)` e `roleName === 'ATTENDANT'` nos serviços viraram `viewer.scopeAll` (quem não é gestão é sempre a responsável ao criar negócio).
- Removidos `COMMERCIAL_ROLES` e `canUseCommercial` (sem uso fora do spec) e `canSeeCatalogCosts` (sem uso desde 10-04/10-05).
- `phase10-commercial-scope`: atendente com Relatórios vê todos no relatório, só os dela em Leads/Pipeline e recebe ACCESS_DENIED em reopen/delete/assign; profissional com Leads+Pipeline lista tudo, é responsável elegível e marca ganho; gerente sem Leads/Pipeline sai da lista de responsáveis e recebe ACCESS_DENIED em Leads.
- `access-inventory.spec.ts`: percorre `src/**/*.resolver.ts`, lê metadados `graphql:resolver_type/name` e `requiredPermissions/requiredAccess`; checa também ids/porteiros existentes no catálogo e que `ACCESS_EXEMPT` não apodrece. Sanidade: removendo `@RequireAccess('fin-previsao')` de `cashForecast` o spec falhou citando `financial/forecast.resolver.ts#cashForecast`; restaurado.

## Limite registrado

A fila "sem responsável" (`commercial-leads.service.ts`, filtro por `creator.role.name != ATTENDANT`) continua por papel do criador do lead: não é decisão de acesso do visualizador, e mudá-la exigiria saber o acesso efetivo de quem criou cada lead.

## Deviations from Plan

**1. [Rule 3 - Bloqueio] commercial-access.spec.ts e catalog-costs.spec.ts editados** — testavam as funções removidas (`canUseCommercial`, `canSeeCatalogCosts`); blocos removidos.

**2. [Rule 1 - Bug] isGranted vs enabled** — primeira versão do helper usava `isGranted` (só ajustes GRANTED), o que deixava a lista vazia para papéis com acesso padrão; trocado por `items.get(id)?.enabled`. Pego pela suíte nova antes do commit.

## Verificação

- Integração: `phase10-commercial-scope` + `phase9*` (18 suítes, 154 testes) verdes.
- Unit backend: 71 suítes, 827 testes verdes; inventário verde; `tsc` e `eslint` limpos.

## Known Stubs

Nenhum.

## Self-Check: PASSED
