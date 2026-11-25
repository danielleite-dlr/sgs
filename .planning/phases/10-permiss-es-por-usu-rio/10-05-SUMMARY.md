---
phase: 10-permiss-es-por-usu-rio
plan: 05
subsystem: authz
tags: [permissoes, noivas, contratos, access]
requires: [10-03]
provides:
  - "@RequireAccess em 9 resolvers de Noivas e Contratos"
  - canOverrideTimeline por permissões efetivas
  - assistantDailyRate mascarada por hasCostVisibility
key-files:
  modified:
    - apps/backend/src/bridal/bridal.resolver.ts
    - apps/backend/src/bridal/ai/ai-schedule.resolver.ts
    - apps/backend/src/bridal/timeline/timeline.resolver.ts
    - apps/backend/src/bridal/timeline/timeline-guard.ts
    - apps/backend/src/bridal/timeline/timeline-guard.spec.ts
    - apps/backend/src/contracts/contracts.resolver.ts
    - apps/backend/src/contracts/payments/contract-payments.resolver.ts
    - apps/backend/src/contracts/acceptance/contract-documents.resolver.ts
    - apps/backend/src/contracts/acceptance/contract-preview.resolver.ts
    - apps/backend/src/contracts/contract-letterhead.resolver.ts
    - apps/backend/src/contracts/alerts/contract-alerts.resolver.ts
  created:
    - apps/backend/test/integration/phase10-bridal-access.e2e.spec.ts
decisions:
  - "Noivas e Contratos: porteiro OU (NOIVAS_CONTRATOS) nas operações compartilhadas; contractSettings (leitura) também OU, pois o formulário de contrato lido a partir de Noivas usa o sinal padrão"
  - "Configurações, timbrado e alertas do contrato só com 'contratos'"
metrics:
  completed: 2026-11-25
requirements: [PERM-04, PERM-05, PERM-07]
---

# Phase 10 Plan 05: Noivas e Contratos por item de acesso Summary

Todas as operações de Noivas e Contratos declaram `@RequireAccess`; a diária da assistente e o "forçar cronograma" passaram a seguir o acesso efetivo (papel + ajustes).

## Limite registrado: Noivas e Contratos (OU mútuo)

Noivas e Contratos se abrem um pelo outro (ContractLinkCard). Por isso o porteiro `NOIVAS_CONTRATOS` é OU: desligar só um dos dois esconde menu e rota, mas a API continua servindo as operações compartilhadas pelo outro item. Só quem perde as duas áreas fica sem acesso pela API. Operações exclusivas de Contratos (`updateContractSettings`, `uploadContractLetterhead`, `removeContractLetterhead`, `runContractAlertsNow`) exigem `contratos`.

## Tasks

1. Anotação dos 9 resolvers e máscara da diária: cb182fd
2. Cronograma por permissão efetiva e suíte phase10-bridal-access: 580a5e1

## Verificação

- typecheck e lint do backend limpos; jest `src/bridal/timeline` (24 testes) verde.
- Integração `phase10-bridal-access`: 4 testes verdes.
- Regressão (22 suítes, 338 testes verdes): phase4 (bridal, rls, contract*, ai-schedule, comanda, schedule, travel), phase41, phase42 (companion, timeline, rls), phase91 (bridal, members).

## Deviations from Plan

- Regressão limitada às suítes de phase4/41/42/91 relacionadas a noivas e contratos (regra do projeto: Postgres compartilhado, sem a suíte completa).
- `canSeeCatalogCosts` mantida no catálogo (o 10-10 remove); só deixou de ser usada em bridal.resolver.
- Teste da diária usa a profissional proA como assistente (SQL direto), sem criar mundo da fase 9.1.

## Known Stubs

Nenhum.

## Self-Check: PASSED
