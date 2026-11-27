---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 21
subsystem: frontend-identity
tags: [assistant-role, members, G-01, vitest]
requires: ["11-18"]
provides:
  - "Papel Assistente no cadastro/edição da equipe, sem login"
  - "features/identity/assistant-role.ts (ASSISTANT_ROLE, isAssistantRole)"
affects: [11-22]
tech-stack:
  added: []
  patterns: ["papel sem login esconde campos de acesso no formulário e envia email/senha nulos"]
key-files:
  created:
    - apps/frontend/src/features/identity/assistant-role.ts
  modified:
    - apps/frontend/src/features/catalog/api/members.api.ts
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
    - apps/frontend/src/features/identity/components/CreateMemberDialog.tsx
    - apps/frontend/src/features/identity/components/MemberEditDialog.tsx
    - apps/frontend/src/features/identity/components/InviteMemberDialog.tsx
    - apps/frontend/src/pages/ProfissionaisPage.tsx
    - apps/frontend/src/features/access/pages/PerfisAcessoPage.tsx
    - apps/frontend/src/features/identity/__tests__/member-dialogs.test.tsx
    - apps/frontend/src/pages/__tests__/profissionais-page.test.tsx
    - apps/frontend/src/features/access/__tests__/perfis-acesso-page.test.tsx
key-decisions:
  - "ROLE_OPTIONS ganha ASSISTANT; convite usa INVITE_ROLE_OPTIONS (sem Assistente)"
  - "Assistente envia email/temporaryPassword null e flags forçadas (isProfessional/isBridalAssistant true, resto false)"
requirements-completed: [PRIO-02]
duration: ~40min
completed: 2026-11-26
---

# Phase 11 Plan 21: Papel Assistente no frontend da equipe Summary

Cadastro e edição de membros com o papel "Assistente" (sem e-mail, senha nem marcações de profissional), tela Profissionais sem "Redefinir senha" para ela, convite e Perfis de acesso sem Assistentes.

## Tasks
1. Helper, opções de papel e textos pt-BR - a2b6653
2. Diálogos de cadastrar e editar com o papel Assistente - 369afa1
3. Tela Profissionais e Perfis de acesso - 663d1a6

## Verificação
- vitest identity/catalog/access/profissionais: verdes (member-dialogs 47 testes, 9 novos); tsc e eslint limpos.
- graphql-codegen com schema do backend (`apps/backend/src/graphql/schema/**/*.graphql`, saída em diretório temporário fora do repo): sucesso, documentos conferem com o SDL.

## Deviations from Plan
- [Rule 1 - Bug] `roleName` do schema do CreateMemberDialog virou `z.string().optional().refine(...)` em vez de `z.enum`: com enum inválido (papel não escolhido) o zod não roda o `superRefine`, e os erros de e-mail/senha obrigatórios deixavam de aparecer (quebrava o teste "requires the mandatory fields"). A mensagem "Selecione um papel." foi mantida.
- Os blocos de e-mail/senha/senioridade foram envolvidos em `{!assistant && (...)}`.

## Known Stubs
Nenhum.

## Self-Check: PASSED
