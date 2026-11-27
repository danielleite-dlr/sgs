---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 18
subsystem: identity
tags: [assistant-role, members, auth, access-profiles, G-01]
requires: []
provides:
  - "Papel de sistema ASSISTANT (sem permissões, sem login)"
  - "assistant-role.ts: ASSISTANT_ROLE_NAME, NOT_ASSISTANT_ROLE_WHERE, isAssistantRole, onlyAssistantMemberships, fictitiousAssistantEmail, assistantNotSchedulableMessage, ASSISTANT_NOT_SCHEDULABLE_CODE, ASSISTANT_NO_LOGIN_MESSAGE"
affects: [11-19, 11-20, 11-21, 11-22]
tech-stack:
  added: []
  patterns: ["papel de sistema como linha em roles; invariantes forçadas pelo servidor"]
key-files:
  created:
    - apps/backend/prisma/migrations/20261126200000_phase11_assistant_role/migration.sql
    - apps/backend/src/identity/assistant-role.ts
    - apps/backend/src/identity/assistant-role.spec.ts
    - apps/backend/test/integration/phase11-assistant-role.e2e.spec.ts
  modified:
    - apps/backend/src/authz/permissions.catalog.ts
    - apps/backend/src/identity/dto/member.input.ts
    - apps/backend/src/graphql/schema/identity.graphql
    - apps/backend/src/identity/members.service.ts
    - apps/backend/src/auth/auth.service.ts
    - apps/backend/src/authz/access/access-admin-rules.ts
    - apps/backend/src/authz/access/access-admin-rules.spec.ts
key-decisions:
  - "Papel = linha de sistema em roles (sem enum nem coluna nova); ASSISTANT: [] em ROLE_PERMISSIONS"
  - "O papel implica isProfessional=true e isBridalAssistant=true e zera isFixed, servesBridal, senioridade e categorias"
  - "Exclusão do agendamento será pelo papel (11-19), nunca por categoria vazia"
  - "Troca para ASSISTANT com atendimento futuro (BLOCKING_STATUSES, startsAt >= agora) recusada"
requirements-completed: [PRIO-01, PRIO-02]
duration: ~50min
completed: 2026-11-26
---

# Phase 11 Plan 18: Papel Assistente (backend) Summary

Papel de sistema ASSISTANT cadastrável só com nome, telefone e Pix (e-mail `@sem-login.invalid` e senha aleatória gerados pelo servidor), sempre assistente de noiva, sem login e sem acessos ajustáveis.

## Tasks
1. Migração do papel, helper puro, catálogo, DTO e SDL — 8aeae05
2. Cadastro/edição, bloqueio de login/refresh/reset e trava em Perfis de acesso — 4e4800d
3. Integração (8 casos) — 4973da7

## Verificação
- Unit identity/authz/auth: 180 testes verdes; tsc e eslint limpos.
- Integração: phase11-assistant-role (8) + phase11-members-flags, phase91-members-assistant, members-create, phase10-access-admin, members-lifecycle, phase3/phase4-schema-smoke: 88 verdes.
- Migração aplicada no sgs_dev.

## Deviations from Plan
- [Rule 3] `prettier --write` com `--single-quote` (o padrão do prettier reescrevia aspas de arquivos inteiros).
- Nos testes de integração, membros criados usam o prefixo `zz11ast` (o mundo da fase 91 já usa `p11ast` nos nomes e a limpeza apagaria os membros dele).
- Rodar o jest de integração exige `--forceExit` neste ambiente (sem ele o processo não termina após os testes).
- `members.service.ts` › `resetPassword` é o nome real da operação de reset (plano citava `resetMemberPassword`).

## Known Stubs
Nenhum.

## Next
11-19 (exclusão do agendamento/sugestão usando `isAssistantRole`/`NOT_ASSISTANT_ROLE_WHERE`), 11-20, 11-21/22 (telas, incluindo tipos GraphQL com `email`/`temporaryPassword` agora anuláveis em CreateMemberInput).

## Self-Check: PASSED
