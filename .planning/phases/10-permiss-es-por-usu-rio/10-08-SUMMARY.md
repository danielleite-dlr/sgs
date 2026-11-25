---
phase: 10-permiss-es-por-usu-rio
plan: 08
subsystem: notificacoes
tags: [permissoes, push, alertas, sino]
requires: [10-03]
provides:
  - hiddenNotificationKinds (tipos do sino escondidos pelo acesso)
  - push e alertas de contrato filtrados por membersWithItemTx
affects: [10-10]
key-files:
  created:
    - apps/backend/src/catalog/notifications/notification-visibility.ts
    - apps/backend/src/catalog/notifications/notification-visibility.spec.ts
    - apps/backend/test/integration/phase10-notifications.e2e.spec.ts
  modified:
    - apps/backend/src/push/push.service.ts
    - apps/backend/src/push/push-commercial.spec.ts
    - apps/backend/src/push/push.processor.spec.ts
    - apps/backend/src/push/push.service.webpush.spec.ts
    - apps/backend/src/contracts/alerts/contract-alerts.service.ts
    - apps/backend/src/catalog/notifications/notifications.service.ts
    - apps/backend/src/catalog/notifications/notifications.resolver.ts
decisions:
  - Push usa membersWithItemTx na transação do próprio job; construtor do PushService não mudou
  - Lembrete do Comercial passa a depender só de comercial-lembretes (dono Profissional que ganhou o item recebe)
  - Alertas de contrato continuam limitados a ADMIN/MANAGER; quem GANHOU Contratos não entra (limite v1 registrado)
  - Sino sem @RequireAccess (sempre ligado); resolver filtra por excludeKinds
metrics:
  completed: 2026-11-25
requirements: [PERM-12]
---

# Phase 10 Plan 08: Avisos respeitam o item desligado Summary

Push do Comercial e da agenda, alertas de contrato e o sino (lista, contador e "marcar todas") passam a seguir o acesso efetivo de cada pessoa.

## O que mudou

- `push.service.ts`: agenda filtra gerentes e profissionais por `agenda`; lembrete filtra candidatos por `comercial-lembretes`. Removida a constante `COMMERCIAL_ROLES`.
- `contract-alerts.service.ts`: destinatários ADMIN/MANAGER com `contratos` ligado (notificação e e-mail).
- `notification-visibility.ts`: `stock_low` some sem `produtos-todos`; todos os `ALERT_KINDS` somem sem `contratos`.
- `NotificationsService.list/unreadCount/markAllRead` ganharam `excludeKinds`; o resolver passa `hiddenNotificationKinds`. `markRead` (id explícito) não mudou.

## Limite registrado (v1)

Alerta de contrato não vai para quem GANHOU Contratos: os destinatários continuam saindo dos papéis-base ADMIN/MANAGER, menos quem tem o item desligado.

## Tasks e commits

1. Push e alertas pelo acesso efetivo: 1c84e53
2. Sino filtrado e suíte phase10-notifications: 5973ae3

## Verificação

- Unit: `src/push`, `src/contracts`, `src/catalog/notifications` verdes (specs de push passaram a mockar `membersWithItemTx`).
- Integração: phase10-notifications e phase4-contract-alerts verdes (14 testes). `phase4-alerts-boot` não rodou.
- tsc e lint do backend limpos.

## Deviations from Plan

Os specs `push.processor.spec.ts` e `push.service.webpush.spec.ts` (fora da lista de arquivos do plano) precisaram do mock de `membersWithItemTx`, porque o tx falso não devolve papel/permissões. [Rule 3 - bloqueio]

## Known Stubs

Nenhum.

## Self-Check: PASSED
