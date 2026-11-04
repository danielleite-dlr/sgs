---
phase: 04-bridal-contracts
plan: 10
subsystem: backend-contract-alerts
tags: [bullmq, notifications, email, timezone, contracts]
requires: [04-01, 04-02, 04-04, 04-06]
provides:
  - buildAlertCandidates / ALERT_KINDS (função pura)
  - ContractAlertsService (runForOrg, tick)
  - ContractAlertsScheduler + ContractAlertsProcessor (primeiro job BullMQ do projeto)
  - mutation runContractAlertsNow
  - EmailService.sendContractDigest
affects: [04-14, 04-15]
tech-stack:
  added: []
  patterns: [upsertJobScheduler idempotente, INSERT ON CONFLICT DO NOTHING como trava diária por org, dedupe por payload.dedupeKey, auto-resolução por readAt]
key-files:
  created:
    - apps/backend/src/contracts/alerts/alert-candidates.ts
    - apps/backend/src/contracts/alerts/alert-candidates.spec.ts
    - apps/backend/src/contracts/alerts/contract-alerts.service.ts
    - apps/backend/src/contracts/alerts/contract-alerts.scheduler.ts
    - apps/backend/src/contracts/alerts/contract-alerts.processor.ts
    - apps/backend/src/contracts/alerts/contract-alerts.resolver.ts
    - apps/backend/src/graphql/schema/contract-alerts.graphql
    - apps/backend/test/integration/phase4-contract-alerts.e2e.spec.ts
    - apps/backend/test/integration/phase4-alerts-boot.e2e.spec.ts
  modified:
    - apps/backend/src/contracts/alerts/contract-alerts.module.ts
    - apps/backend/src/email/email.service.ts
key-decisions:
  - "Scheduler/processor entram nos providers só quando process.env.CONTRACT_ALERTS_SCHEDULER !== 'false' (lido na carga do módulo); o teste de boot importa o AppModule dinamicamente depois de setar 'true'"
  - "E-mail de resumo só na execução diária; a checagem manual (runContractAlertsNow, force) não reenvia e-mail nem grava contract_alert_runs"
  - "contract_deposit_unpaid só para contratos ativos (aceitos); aguardando aceite gera apenas contract_not_accepted"
  - "Dedupe por (membro + dedupeKey) considerando notificações lidas e não lidas; auto-resolução marca lida toda notificação aberta de alerta cujo dedupeKey saiu dos candidatos"
  - "Chave do alerta de acompanhante = memberId:eventDate (um por acompanhante); due_soon/overdue usam a data do prazo como estado"
requirements-completed: []
duration: ~60min
completed: 2026-11-04
---

# Phase 4 Plan 10: Alertas automáticos de contrato Summary

Job BullMQ horário (scheduler idempotente `contract-alerts-tick`, `0 * * * *`) que, a partir das 8h locais de cada org, gera uma vez por data local alertas de restante vencendo/vencido, entrada não paga, contrato não aceito e sinal de acompanhante avulsa pendente, com notificações deduplicadas só para ADMIN/MANAGER ativos, auto-resolução e e-mail diário de resumo.

## Commits
- f86c34b candidatos de alerta (função pura) e e-mail de resumo
- 2da9e58 serviço, scheduler, processor, resolver e SDL
- 8ffeb72 suítes de integração (alertas e boot do scheduler)

## Verificação
Lint e typecheck limpos; 198 testes unitários (7 novos); integração `phase4`: 10 suítes, 54 testes verdes (alertas com 7 casos, boot com 2). Cobrem: papel (atendente/profissional sem alerta), reexecução no mesmo dia (`ran false`), dedupe, mudança de estado com auto-resolução, quitação, fuso (02:30Z de 10/12 = 09/12 em SP, `run_date` 2026-12-09), e-mail por destinatário, elegibilidade por hora no `tick`, permissão de `runContractAlertsNow`.

## Deviations from Plan
Nenhuma de regra. Observações:
- No teste de `tick`, `runForOrg` é espionado/mockado: o tick varre todas as orgs do banco compartilhado e rodaria alertas em orgs de outras suítes/agentes.
- Valkey local (`sgs_valkey` na 6379) exige senha nesta máquina e o `QueueModule` não usa credenciais da URL (comportamento pré-existente). O teste de boot foi executado contra um Valkey descartável na 6391 (`REDIS_URL=redis://localhost:6391`, container removido ao final). No CI (Valkey sem senha) roda sem ajuste.
- `payload.dedupeKey` fica no payload da notificação; `runContractAlertsNow` não envia e-mail (ver decisões).

## Known Stubs
Nenhum.

## Self-Check: PASSED
