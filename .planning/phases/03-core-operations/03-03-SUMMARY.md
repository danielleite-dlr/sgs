---
phase: 03-core-operations
plan: 03
subsystem: backend-scheduling
tags: [advisory-lock, pgbouncer, scheduling, time-blocks, graphql, concurrency]
requires: [03-01]
provides:
  - database/advisory-lock.ts (locks de transação, detecção de 55P03/23P01)
  - appointments/appointment-status.ts, scheduling-guard.ts
  - mutations moveAppointment, updateAppointmentStatus, cancelAppointment, createTimeBlock, deleteTimeBlock; query timeBlocks
  - runWithTenant com opções de transação (timeout/maxWait)
affects: [03-04, 03-06, 03-07, 03-08, 03-10]
tech-stack:
  added: []
  patterns: ["SchedulingError lançado dentro da transação (ROLLBACK) e traduzido para payload fora via mapSchedulingError"]
key-files:
  created:
    - apps/backend/src/database/advisory-lock.ts
    - apps/backend/src/database/advisory-lock.spec.ts
    - apps/backend/src/appointments/appointment-status.ts
    - apps/backend/src/appointments/appointment-status.spec.ts
    - apps/backend/src/appointments/scheduling-guard.ts
    - apps/backend/src/appointments/scheduling-guard.spec.ts
    - apps/backend/src/appointments/time-blocks.service.ts
    - apps/backend/test/integration/phase3-scheduling-concurrency.e2e.spec.ts
    - apps/backend/test/integration/phase3-appointments-move.e2e.spec.ts
    - apps/backend/test/integration/phase3-appointments-lifecycle.e2e.spec.ts
    - apps/backend/test/integration/phase3-time-blocks.e2e.spec.ts
  modified:
    - apps/backend/src/database/tenant-context.service.ts
    - apps/backend/src/appointments/appointments.service.ts
    - apps/backend/src/appointments/appointments.resolver.ts
    - apps/backend/src/appointments/appointments.resolver.spec.ts
    - apps/backend/src/appointments/appointments.module.ts
    - apps/backend/src/graphql/schema/appointments.graphql
key-decisions:
  - "Erro do ORM em exclusion constraint chega como PrismaClientUnknownRequestError (sem code/meta); isPgError olha a mensagem nesse caso"
  - "Cancelar agendamento em comanda aberta remove os itens do agendamento e cancela a comanda se nada sobrar; sinal não é tocado"
requirements-completed: []  # SCHED-01/02/03 dependem das telas (03-08/03-10); backend entregue, requisitos seguem Pending
duration: ~50min
completed: 2026-11-02
---

# Phase 3 Plan 03: Agenda concorrente no backend Summary

Agenda serializada por profissional com advisory lock de transação (org compartilhado + profissional, ordem lexicográfica), conflito checado contra agendamentos ativos e bloqueios, mover/status/cancelar com motivo obrigatório e CRUD dos 4 tipos de bloqueio; erro claro SLOT_TAKEN para o segundo tentante.

## Tasks

1. Primitivas de lock, regras de status e guard de conflito - `569f361`
2. create com lock, moveAppointment, updateAppointmentStatus, cancelAppointment - `8cbf480`
3. TimeBlocksService, query/mutations de bloqueio - `c47f5ff`

## Formato observado dos erros Prisma (Open Question #2)

- **55P03 (lock_timeout) em `$executeRaw`/`$queryRaw`**: `PrismaClientKnownRequestError`, `code: "P2010"`, `meta: { code: "55P03", message: "ERROR: canceling statement due to lock timeout" }`.
- **23P01 (exclusion constraint) em `tx.appointment.create()` (ORM)**: `PrismaClientUnknownRequestError`, SEM `code` e SEM `meta`; o SQLSTATE só aparece na mensagem (`PostgresError { code: "23P01", message: "conflicting key value violates exclusion constraint \"ex_appointments_professional_interval\"" ...}`). Por isso `isPgError` aceita `PrismaClientUnknownRequestError` e procura o SQLSTATE na mensagem. `P2004` não foi observado, mas segue aceito por segurança.
- Ambos mapeiam para `SLOT_TAKEN` em `mapSchedulingError`.

## Testes

- Unit backend: 77 (11 suites; +14 nesta plan)
- Integração backend: 191 (20 suites; +37: concorrência 5, mover/criar 12, ciclo de vida 10, bloqueios 10)
- Frontend vitest: 238 (inalterado). lint e typecheck verdes.
- Provas de concorrência: 2 creates sobrepostos com início diferente (1 vence), 10 paralelos (1 sucesso, 9 SLOT_TAKEN, 1 linha), lock_timeout (SLOT_TAKEN em < 4,5 s com lock segurado por 4 s), createTimeBlock x createAppointment (exatamente um vence), insert direto bypassando o guard (constraint barra).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 23P01 do ORM não é PrismaClientKnownRequestError**
- Achado no spike: o helper do plano (só `PrismaClientKnownRequestError`) não reconheceria a violação de exclusion constraint via ORM. `isPgError` passou a tratar também `PrismaClientUnknownRequestError` (pela mensagem). Spec unitário acrescentado.

**2. [Rule 3 - Blocking] appointments.resolver.spec.ts**
- O construtor do resolver ganhou `TimeBlocksService`; o spec existente foi ajustado e ganhou um caso de `listTimeBlocks`.

**3. Critério de aceite de SDL em linha única**
- O acceptance pedia `timeBlocks(startsAt: DateTime!, endsAt: DateTime!, professionalId: UUID): [TimeBlock!]!` numa linha; o arquivo segue o estilo multilinha já existente (mesma assinatura, formatada por argumento).

**4. Escopo menor**
- `scheduling-guard.spec.ts` extra (3 casos) para o mapeamento. `move` ignora `memberId` por ora (reservado para auditoria).

## Known Stubs

None.

## Requisitos

SCHED-01/02/03 permanecem **Pending** no REQUIREMENTS.md: o backend está entregue, mas as telas (agenda, drag-and-drop, bloqueios) só chegam em 03-08/03-10.

## Notas para os próximos planos

- Padrão obrigatório para serviços que escrevem agenda: `runWithTenant(org, fn, SCHEDULE_TX_OPTIONS)`, `acquireScheduleLocks(tx, org, [ids])` ANTES de ler conflitos, `assertSlotFree(...)`, lançar `SchedulingError` dentro da transação e `.catch(mapSchedulingError)` fora (ver `fail` em appointments.service.ts, não exportado; replicar ou exportar se precisar).
- 03-06 (comanda junto com agendamento): `create` NÃO cria comanda; reutilizar `acquireScheduleLocks`/`assertSlotFree` de `scheduling-guard.ts`. `PROFESSIONAL_UNAVAILABLE` não existe mais (agora `SLOT_TAKEN`; `TIME_BLOCKED` para bloqueio). `serializeAppointment` (exportado de appointments.service.ts) garante `depositAmount` com 2 casas.
- `cancel` já trata comanda: status `closed` -> `COMANDA_CLOSED`; aberta com pagamentos e sem outro agendamento ativo -> `COMANDA_HAS_PAYMENTS`; senão apaga itens do agendamento, recalcula `comandas.total` por SQL inline e cancela a comanda se não sobrar item nem agendamento ativo. Comanda usa status `open|closed|cancelled`. O 03-04 pode ter helper de recálculo equivalente; o SQL aqui é inline.
- `move` repassa `comanda_items.professional_id` (comanda aberta) quando o profissional muda (D-13).
- `updateAppointmentStatus` só aceita `confirmed`/`in_progress`; `completed` é do fechamento da comanda (03-07), e reabertura precisa voltar `completed -> in_progress` por conta própria.
- Cancelamento/no_show: `no_show` é `status='no_show'` com `cancel_reason_tag='no_show'`. Tags válidas: `cliente_desmarcou`, `profissional_doente`, `no_show`. Motivo mínimo de 3 caracteres após trim, para todos os papéis. Crédito do sinal (D-15) NÃO é gerado aqui: o sinal já é crédito desde o recebimento (03-06).
- Permissões: tudo usa `appointment.write` (move/cancel/status/bloqueios) e `appointment.read` (timeBlocks); PROFESSIONAL só tem read e vê próprios bloqueios + feriados.
- Em suítes novas que criem `time_blocks`, `deletePhase3Rows` já os limpa; ao limpar entre testes apague `time_blocks` antes de `appointments` não é necessário, mas comandas/itens devem sair antes (FK de `appointments.comanda_id` tem SET NULL).
- Erro do Prisma por ORM vs raw: ver seção acima. Codegen do frontend roda contra o backend vivo e `src/gql` não é versionado, então não há saída gerada para commitar.

## Self-Check: PASSED
