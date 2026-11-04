---
phase: 04-bridal-contracts
plan: 12
subsystem: bridal-ai
tags: [ai, claude, anthropic, agenda, noivas, lgpd, cache, fallback]
requires: [04-03, 04-05, 04-06, 04-08]
provides:
  - suggestBridalSchedule / confirmBridalSchedule (ai-schedule.graphql)
  - AiScheduleService, AiScheduleContextBuilder, ANTHROPIC_CLIENT / AnthropicLike / anthropicClientProvider
  - FakeAnthropic (test helper) e override opcional de ANTHROPIC_CLIENT nos fixtures phase3/phase4
affects: [04-13, 04-15]
tech-stack:
  added: []
  patterns: [client injetável opcional (null sem chave), saída estruturada Zod v4 via messages.parse, API fora da transação]
key-files:
  created:
    - apps/backend/src/bridal/ai/anthropic-client.ts
    - apps/backend/src/bridal/ai/ai-schedule.prompt.ts
    - apps/backend/src/bridal/ai/ai-schedule.prompt.spec.ts
    - apps/backend/src/bridal/ai/ai-schedule-context.ts
    - apps/backend/src/bridal/ai/ai-schedule.service.ts
    - apps/backend/src/bridal/ai/ai-schedule.service.spec.ts
    - apps/backend/src/bridal/ai/ai-schedule.resolver.ts
    - apps/backend/src/graphql/schema/ai-schedule.graphql
    - apps/backend/test/integration/helpers/fake-anthropic.ts
    - apps/backend/test/integration/phase4-ai-schedule.e2e.spec.ts
  modified:
    - apps/backend/src/bridal/ai/ai-schedule.module.ts
    - apps/backend/src/bridal/ai/ai-schedule.schema.ts
    - apps/backend/test/integration/helpers/phase3-fixtures.ts
    - apps/backend/test/integration/helpers/phase4-fixtures.ts
key-decisions:
  - "Só sugestões source 'claude' entram no cache de 24h; heurística é barata e não deve travar retentativa após API_ERROR"
  - "Sugestão é gravada só depois da chamada (tx curta antes e depois); sem conexão presa durante a API"
  - "Cota diária conta linhas 'claude' gravadas (falhas de API não consomem cota)"
  - "confirm valida numa tx e depois delega a BridalService.schedule (que já faz lock, createBridalScheduleTx e syncContractCoverageTx)"
  - "Fixtures sempre sobrescrevem ANTHROPIC_CLIENT (null por padrão), garantindo que nenhuma suíte chame a rede"
requirements-completed: []
completed: 2026-11-04
---

# Phase 4 Plan 12: Sugestão de agenda por IA Summary

"Sugerir agenda IA" monta contexto sem PII (pessoas p1..pN, profissionais prof_N), consulta a Claude API com saída estruturada Zod, valida com o validador do 04-03 (1 retry com violações) e cai na heurística com motivo (`NO_API_KEY`, `LIMIT_REACHED`, `API_ERROR`, `INVALID_OUTPUT`); cache de 24h por hash canônico e confirmação revalidada no servidor.

## O que foi feito
- **Task 1** (`6de8142`): client injetável (null sem chave), prompt PT-BR, `canonicalHash` estável, `AiScheduleContextBuilder` (grupo ativo, `ALREADY_SCHEDULED`, `NO_PLANNED_SERVICES`, `CONTEXT_TOO_LARGE`, elegibilidade por categoria, busy de agendamentos + bloqueios inclusive os da org toda, janela do dia no fuso da org, deslocamento só se externo).
- **Task 2** (`e63b42f`): `AiScheduleService.suggest/confirm`, SDL, resolver (`BRIDAL_AI_SUGGEST`; confirmar com `BRIDAL_WRITE`+`APPOINTMENT_WRITE`), módulo. Spec unitário dos 6 comportamentos.
- **Task 3** (`d672af7`): `FakeAnthropic` e suíte `phase4-ai-schedule` (9 casos): sem chave, Claude fake com tokens gravados e prompt sem nomes, cache e invalidação por mudança de ocupação, INVALID_OUTPUT (2 chamadas), API_ERROR, LIMIT_REACHED, nada criado ao sugerir, confirmação (INVALID_PROPOSAL e sucesso com 6 agendamentos/5 comandas), RBAC e isolamento entre orgs.

## Verificação
Lint, typecheck, 209 testes unitários e integração `phase4-ai-schedule` + `phase4-bridal-schedule` + `phase3-visit` (27 testes) verdes. Nenhum teste usa rede.

## Deviations from Plan

**1. [Rule 3] `zodOutputFormat` exige zod v4** - `ai-schedule.schema.ts` passou a importar de `zod/v4` (forma do schema inalterada; specs do 04-03 seguem verdes).
**2. [Rule 1 - plano] AppConfigService expõe getters**, não métodos (`anthropicApiKey`, `anthropicModel`, `aiScheduleDailyLimit`); usados como propriedades.
**3. [Rule 3] Fixtures phase3/phase4 ganharam parâmetro opcional `{ anthropicClient }`** para aplicar `overrideProvider(ANTHROPIC_CLIENT)` sem duplicar o setup do mundo.
**4. Grupo do E2E gera 6 agendamentos** (noiva 2 + 4 acompanhantes x 1), não 7 como no texto do plano; 5 comandas.
**5. Cache só para fonte claude** (ver decisões); o plano não diferenciava.

## Pontos para planos seguintes
- 04-13 (frontend): `suggestBridalSchedule` devolve itens com `personLabel` (nome da cliente, só para a UI) e `professionalName`; enviar os itens (editados) a `confirmBridalSchedule`. Para confirmar, a proposta precisa conter todos os serviços planejados de todas as pessoas (validador exige `MISSING_SERVICE`).
- Modelo padrão: `ANTHROPIC_MODEL` (`claude-sonnet-5-5`). Verificação manual no staging com chave real continua pendente (VALIDATION).

## Known Stubs
Nenhum.

## Self-Check: PASSED
Arquivos criados existem; commits 6de8142, e63b42f, d672af7 verificados.
