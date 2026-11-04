---
phase: 04-bridal-contracts
plan: 04
subsystem: notifications, frontend-foundation
tags: [graphql, notifications, react, apollo, routing, permissions]
requires: []
provides:
  - "Query unreadNotificationCount e Mutation markAllNotificationsRead"
  - "NotificationsBell (sino do cabeçalho) com flag notificacoes ligada"
  - "bridal-permissions (useBridalPermission, BRIDAL_ROLE_PERMISSIONS)"
  - "Rotas /noivas, /noivas/:id, /contratos, /contratos/:id e pública /aceite/:orgId/:token"
affects: [04-09, 04-10, 04-13, 04-14, 04-15]
tech-stack:
  added: []
  patterns:
    - "Gate de UI por roleName espelhando o backend"
    - "Tempo relativo via Intl.RelativeTimeFormat"
key-files:
  created:
    - apps/backend/test/integration/phase4-notifications-panel.e2e.spec.ts
    - apps/frontend/src/features/notifications/api/notifications.api.ts
    - apps/frontend/src/features/notifications/lib/notification-labels.ts
    - apps/frontend/src/features/notifications/components/NotificationsBell.tsx
    - apps/frontend/src/features/notifications/__tests__/notifications-bell.test.tsx
    - apps/frontend/src/features/bridal/bridal-permissions.ts
    - apps/frontend/src/features/bridal/__tests__/bridal-permissions.test.ts
    - apps/frontend/src/features/bridal/pages/BridalGroupsPage.tsx
    - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx
    - apps/frontend/src/features/bridal/pages/ContractsPage.tsx
    - apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx
    - apps/frontend/src/features/bridal/public/ContractAcceptPage.tsx
  modified:
    - apps/backend/src/graphql/schema/products.graphql
    - apps/backend/src/catalog/notifications/notifications.resolver.ts
    - apps/backend/src/catalog/notifications/notifications.service.ts
    - apps/backend/test/integration/catalog-notifications.e2e.spec.ts
    - apps/frontend/src/components/layout/TopHeader.tsx
    - apps/frontend/src/config/features.ts
    - apps/frontend/src/router.tsx
    - .planning/ROADMAP-MOCKS.md
  removed:
    - apps/frontend/src/features/bridal/pages/*Placeholder.tsx (3)
    - apps/frontend/src/features/bridal/mocks/bridal.mock.ts
key-decisions:
  - "markRead agora exige memberId e só marca notificações visíveis ao membro (NotFound caso contrário)"
  - "Tempo relativo com Intl.RelativeTimeFormat porque date-fns não é dependência do frontend"
requirements-completed: [CONT-02, CLI-03]
duration: ~60min
completed: 2026-11-03
---

# Phase 4 Plan 04: Sino de notificações e fundação de frontend Summary

Sino de notificações funcional (contador com poll de 60 s, lista, marcar lida/todas, inclui estoque baixo) mais permissões de noivas e rotas-casca, incluindo a rota pública de aceite de contrato.

## Tasks

| Task | Commit | Resultado |
| ---- | ------ | --------- |
| 1. Backend: contador e marcar todas | e5140a3 | SDL + service + resolver; spec `phase4-notifications-panel` e `catalog-notifications` verdes |
| 2. Sino e flag notificacoes | 42ed9bf | NotificationsBell, API, labels, 5 testes vitest; `notificacoes: true` |
| 3. Permissões, cascas e rotas | 5c6561c | bridal-permissions (+teste), 5 páginas-casca, router, placeholders e mock removidos |

## Deviations from Plan

**1. [Rule 3 - Blocking] date-fns ausente**
- `formatDistanceToNow` do date-fns não está nas dependências do frontend; usado `Intl.RelativeTimeFormat('pt-BR')` em `formatRelativeTime`.

**2. [Rule 3 - Blocking] @testing-library/user-event ausente**
- Testes do sino usam `fireEvent`.

**3. [Rule 3 - Blocking] Codegen não executável**
- `codegen` exige backend rodando em localhost:3000 e `src/gql` não existe/não é usado (as APIs usam `gql` de `@apollo/client` com tipos manuais). Etapa de codegen pulada, sem arquivos gerados.

**4. [Rule 1 - Bug] Chamadas existentes de `markRead`**
- A mudança de assinatura (`orgId, memberId, id`) exigiu atualizar `catalog-notifications.e2e.spec.ts` (3 chamadas).

Nota de comportamento: notificações org-wide (`memberId NULL`, ex.: estoque baixo) são uma linha única, então "marcar todas" por um membro as marca como lidas para toda a organização (comportamento já existente de `markRead`).

Sem GATED_PATHS novo: `/noivas` e `/contratos` cobrem subcaminhos por prefixo; flags `noivas`/`contratos` seguem `false` (ligam em 04-15).

## Known Stubs

As cinco páginas-casca (`BridalGroupsPage`, `BridalGroupDetailPage`, `ContractsPage`, `ContractDetailPage`, `ContractAcceptPage`) exibem só título e Skeleton por design; preenchidas por 04-13, 04-14 e 04-09. Ficam atrás das flags desligadas (a de aceite é pública).

## Verificação

Backend: lint, tsc, jest unit (107) e integração das duas suítes de notificações verdes. Frontend: lint, tsc e vitest (44 arquivos, 305 testes na rodada completa, mais os novos de permissões) verdes.

## Self-Check: PASSED
