---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 04
subsystem: backend/commercial
tags: [nestjs, graphql, etapas, leads, duplicidade, rbac]
requires: [09-01, 09-02]
provides:
  - CommercialModule (CommercialCoreModule + 4 submódulos vazios para 09-06, 09-08, 09-09, 09-10)
  - CommercialError / mapCommercialError
  - commercial.graphql (etapas, leads, duplicidade, responsáveis)
  - ensureDefaultStagesTx, DEFAULT_STAGES, CommercialStagesService
  - findDuplicatesTx, CommercialLeadsService
affects: [09-05, 09-06, 09-07, 09-08, 09-09, 09-10]
key-files:
  created:
    - apps/backend/src/commercial/commercial.module.ts
    - apps/backend/src/commercial/commercial-errors.ts
    - apps/backend/src/commercial/commercial-win.module.ts
    - apps/backend/src/commercial/commercial-reminders.module.ts
    - apps/backend/src/commercial/commercial-reports.module.ts
    - apps/backend/src/commercial/commercial-intake.module.ts
    - apps/backend/src/commercial/commercial-stages.service.ts
    - apps/backend/src/commercial/commercial-leads.service.ts
    - apps/backend/src/commercial/commercial.resolver.ts
    - apps/backend/src/graphql/schema/commercial.graphql
    - apps/backend/test/integration/phase9-stages.e2e.spec.ts
    - apps/backend/test/integration/phase9-leads.e2e.spec.ts
  modified:
    - apps/backend/src/app.module.ts
decisions:
  - "Ganho/Perdido ficam em position 100/101 e as abertas em 0..n-1; reorder reescreve nessa convenção."
  - "A atendente só é avisada, na checagem de duplicidade, de leads que ela enxerga; clientes do SGS aparecem para todos os papéis do Comercial."
  - "Origem fora de COMMERCIAL_SOURCES devolve o código novo SOURCE_INVALID."
  - "visibilityWhere continua Record<string, unknown>; os serviços fazem cast para Prisma.*WhereInput."
metrics:
  tasks: 3
  completed: 2026-11-18
---

# Phase 9 Plan 04: Backend núcleo, etapas e leads Summary

Núcleo do Comercial na API: etapas configuráveis por salão (com as 6 padrão criadas no primeiro acesso), leads com aviso de cliente/lead existente por DDD + 8 últimos dígitos ou e-mail, vínculo à cliente do SGS e visibilidade por papel desde o primeiro serviço.

## Tarefas

1. **Módulo, erros e SDL** (`42f32eb`): `CommercialModule` registrado depois de `PushModule`; `CommercialCoreModule` (declarado em `commercial.module.ts`) mais os 4 submódulos vazios importados; `commercial.graphql` completo. `phase9-rls-rbac` continua verde com o AppModule subindo.
2. **Etapas** (`c412f29` teste, `606927c` implementação): `ensureDefaultStagesTx` com `pg_advisory_xact_lock` (sem duplicar em chamadas paralelas), CRUD, `reorder` (STAGE_ORDER se faltar etapa, repetir ou Ganho/Perdido antes de aberta), `remove` (STAGE_SYSTEM, STAGE_LAST_OPEN, STAGE_NOT_EMPTY, ou move os negócios com `stage_entered_at = now()`), `openDeals` respeitando a visibilidade.
3. **Leads** (`48e6703` teste, `a45e296` implementação): `findDuplicatesTx` (SQL com `regexp_replace`, tira 55 inicial, mesma chave de `phoneKey`, `LIMIT 10`), criação com validação de contato/telefone/e-mail e `phone_digits`, update, `link` (cliente de outra org ou excluída dá NOT_FOUND), `softDelete` (lead e negócios), `purge` (cascata), `list` com `unassigned`/`assigneeMemberId` só para gestão, `assignees` (ADMIN/MANAGER/ATTENDANT ativos).

## Verificação

`phase9-stages` (7), `phase9-leads` (8), `phase9-rls-rbac` (16) verdes; unit `src/commercial` (37) verde; typecheck e lint do backend verdes. PROFESSIONAL recebe FORBIDDEN pelo guard de permissões (sem `commercial.*`), ATTENDANT recebe FORBIDDEN em manage.

## Deviations from Plan

Nenhuma de escopo. Pequenos detalhes: código de erro adicional `SOURCE_INVALID` (origem fora da lista, não listado nos códigos do plano); `Prettier` rodado via `apps/backend/node_modules/.bin/prettier` nos arquivos novos.

## Notas para os próximos planos

- Submódulos vazios importam apenas `DatabaseModule` e `AuthzModule`; para usar `CommercialLeadsService`/`CommercialStagesService` basta importar `CommercialCoreModule` de `./commercial.module` (exportados).
- `findDuplicatesTx(tx, { phone, email, excludeLeadId })` não aplica visibilidade; quem chama decide.
- `CommercialResolver` está só com etapas e leads; os próximos planos devem criar resolvers próprios nos seus submódulos.

## Known Stubs

Nenhum.

## Self-Check: PASSED

Arquivos e commits (42f32eb, c412f29, 606927c, 48e6703, a45e296) conferidos.
