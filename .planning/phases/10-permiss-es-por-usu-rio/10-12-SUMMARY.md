---
phase: 10-permiss-es-por-usu-rio
plan: 12
subsystem: frontend-access
tags: [permissoes, frontend, rotas, comercial]
requires: [10-09]
provides:
  - "AccessRoute (guarda de rota por item, OU)"
  - "homePathFor(roleName, hasAgenda)"
  - "router.tsx: campo access em cada rota protegida"
  - "useCommercialAccess por item comercial-*"
affects: [10-13, 10-14, 10-15, 10-16]
key-files:
  created:
    - apps/frontend/src/features/access/AccessRoute.tsx
    - apps/frontend/src/features/access/__tests__/access-route.test.tsx
  modified:
    - apps/frontend/src/router.tsx
    - apps/frontend/src/pages/HomeRoute.tsx
    - apps/frontend/src/config/features.ts
    - apps/frontend/src/features/commercial/commercial-permissions.ts
    - apps/frontend/src/features/commercial/__tests__/commercial-permissions.test.ts
    - apps/frontend/src/features/commercial/__tests__/commercial-route.test.tsx
    - apps/frontend/src/features/bridal/components/ContractLinkCard.tsx
  deleted:
    - apps/frontend/src/features/commercial/components/CommercialRoute.tsx
decisions:
  - "AccessRoute só nega com accessFresh; com acesso apenas persistido mostra esqueleto (access-route-loading)"
  - "Sem Agenda, não-gestor cai em /dashboard, que renderiza para qualquer papel (sem laço)"
  - "commercial-route.test.tsx reescrito sobre AccessRoute (mantido o teste de CommercialSettingsPage)"
  - "COMMERCIAL_ROLES e COMMERCIAL_ROLE_PERMISSIONS mantidos: menu-config.ts e testes ainda os usam"
metrics:
  tasks: 3
  completed: 2026-11-25
---

# Phase 10 Plan 12: Rotas pelo acesso efetivo Summary

Toda rota de item no `router.tsx` declara `access: [...]` (29 entradas, inclusive detalhes e `/comercial/leads/:id` com OU de leads/pipeline) e é envolvida por `AccessRoute`. Item desligado leva à tela inicial (`homePathFor`) sem laço e sem logout; antes da leitura de `myAccess` nesta sessão aparece esqueleto.

## Tarefas

1. AccessRoute, `homePathFor` e HomeRoute (commit 6401077).
2. Router com `access` por rota; `CommercialRoute` removido (commit abaixo, "rotas declaram o item de acesso").
3. `useCommercialAccess` por item e link de Contratos condicionado (commit 7f7c9d7).

## Deviations from Plan

**1. Link de contrato.** O único link para `/contratos` dentro de `ContractLinkCard` é a ação "Abrir configurações" (`MissingAction`, caso `settings`); ele agora só aparece com `useHasAccess('contratos')`. Os links "Ver contrato"/"Criar contrato" em `BridalGroupDetailPage.tsx` não estão nos arquivos deste plano e ficaram como estavam (candidatos para o 10-11/10-13 se necessário).

**2. Reescrita das linhas de `PROTECTED_ROUTES`.** As entradas com `access` perderam o alinhamento por espaços; o diff dessas linhas é maior que o mínimo, sem outra mudança de comportamento.

## Verificação

- Depois do merge do 10-11 e 10-12 no master: typecheck e lint do frontend limpos; vitest 163 arquivos / 1146 testes verdes.
- Três testes antigos do painel (`forecast-card`, `inicio-operacional`) ainda montavam o cenário só pelo papel; com o 10-11 os cartões seguem o item de acesso (sem acesso carregado nada é escondido), então passaram a desligar o item em `access` via `access-fixture.ts`.

## Known Stubs

Nenhum.

## Self-Check: PASSED
