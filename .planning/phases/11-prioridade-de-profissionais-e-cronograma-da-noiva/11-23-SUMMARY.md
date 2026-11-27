---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 23
subsystem: e2e
tags: [playwright, assistente, G-01, debutante]
requires: [11-17, 11-19, 11-20, 11-22]
provides: ["E2E do papel Assistente (cadastro, exclusão do Novo agendamento, debutante no estúdio)"]
affects: []
tech-stack:
  added: []
  patterns: ["helpers de API em support/phase11.ts"]
key-files:
  created:
    - apps/e2e/tests/assistente-papel.spec.ts
  modified:
    - apps/e2e/support/phase11.ts
decisions:
  - "Assistente fixa do spec criada por API no beforeAll; o teste 1 cadastra outra pela UI só para conferir o cadastro"
metrics:
  completed: 2026-11-26
requirements: [PRIO-02, PRIO-11, PRIO-15]
---

# Phase 11 Plan 23: E2E do papel Assistente Summary

Spec Playwright de 3 testes cobrindo o cadastro da Assistente sem e-mail/senha, a ausência dela no Novo agendamento (com coluna na Agenda) e o vínculo a grupo de debutante no estúdio com bloqueio "Acompanhando debutante".

## Tasks
1. Helpers `createAssistantMember` e `createStudioDebutanteGroup` em `support/phase11.ts` (4cf5ae7).
2. Spec `assistente-papel.spec.ts` (4fd3eb8). Passam: assistente-papel (3), assistente-noiva (5), prioridade-profissionais (6).

## Deviations from Plan
- [Rule 3 - Blocking] O worktree não tinha `.env`; copiado de /root/sgs/.env (gitignored) para rodar o webServer do E2E.
- Ajustes de seletor no spec: o tipo de Pix é "Celular" (não "Telefone"); o campo e-mail é checado por `textbox` porque o rádio Pix "E-mail" casava com o label; o seletor de profissional é um radiogroup (testid `visit-line-0-professional-<id>`) ou select, e o spec trata os dois.

## Known Stubs
None.

## Self-Check: PASSED
