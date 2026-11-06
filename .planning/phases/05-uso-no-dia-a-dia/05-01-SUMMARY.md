---
phase: 05-uso-no-dia-a-dia
plan: 01
subsystem: e2e-auditoria
tags: [ux, auditoria, playwright, staging]
requires: []
provides:
  - "05-AUDITORIA.md (20 itens UX-01..UX-20, aguardando aprovação)"
  - "Usuário ADMIN de auditoria no staging (Studio JS)"
  - "Harness apps/e2e/audit + playwright.audit.config.ts"
affects: [05-08, 05-20]
tech-stack:
  added: []
  patterns: ["guarda somente leitura de mutations GraphQL no navegador", "AUDIT_TARGET=staging|local"]
key-files:
  created:
    - apps/e2e/playwright.audit.config.ts
    - apps/e2e/audit/audit-helpers.ts
    - apps/e2e/audit/telas.audit.ts
    - apps/e2e/audit/fluxos-escrita.audit.ts
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
    - .planning/phases/05-uso-no-dia-a-dia/.05-01-start-sha
  modified:
    - .gitignore
decisions:
  - "Credencial de auditoria só em /root/sgs/.env.audit (600, gitignorado); evidências em /root/sgs/.planning/phases/05-uso-no-dia-a-dia/05-audit-evidence/ (gitignorado)"
  - "Nenhum item classificado como Bloqueia: todas as tarefas medidas concluíram"
metrics:
  duration: "~75 min"
  completed: 2026-11-05
---

# Phase 5 Plan 01: Auditoria de usabilidade Summary

Auditoria das telas principais (desktop 1366x768 e Pixel 7) com staging somente leitura via guarda de mutations e fluxos com escrita no ambiente local semeado, resultando em 20 itens priorizados em `05-AUDITORIA.md` (status aguardando-aprovacao, coluna Aprovado? vazia).

## O que foi feito

- **Task 1** (commit 0e122a9): usuário `auditoria.ux@sgs.invalid` (ADMIN, ativo) criado na org Studio JS do staging por hash argon2id gerado no container do backend e transação SQL; login real confirmado. Credencial em `/root/sgs/.env.audit` (permissão 600; a senha não aparece em nenhum documento). `.gitignore`, config e helpers (`installReadOnlyGuard`, `loadAuditEnv`, `collectScreenMetrics`, `UNACCENTED_WORDS`).
- **Task 2** (commit 717c0db): specs `telas.audit.ts` (16 telas x 2 dispositivos no staging, 32 testes passaram, nenhuma mutation bloqueada, ou seja, a UI não disparou escrita) e `fluxos-escrita.audit.ts` (local). Screenshots avaliadas visualmente; `05-AUDITORIA.md` escrito.

## Resultados principais

Sem overflow horizontal, sem texto visível sem acento. Achados: contraste de botões/abas selecionados (UX-01), "Fechar comanda" com aparência desativada (UX-06), `**` no texto do contrato (UX-11), tabelas ruins no celular, `contract_in` no Financeiro, painel sem conteúdo.

## Deviations from Plan

**1. [Rule 3 - Bloqueio] Ambiente do worktree** — o worktree não tinha `.env` nem Prisma client; copiei `/root/sgs/.env` (gitignorado) e rodei `prisma generate` para subir o backend do E2E local.

**2. [Rule 1 - Bug] loadAuditEnv lia o seed ao carregar o módulo** no modo local (antes do projeto `setup`); passou a leitura preguiçosa por getters.

**3. Resolução da credencial** — `loadAuditEnv` procura `.env.audit` na raiz do repo e, se ausente (worktree), em `/root/sgs/.env.audit`; `AUDIT_EVIDENCE_DIR` permite gravar evidências no checkout principal.

**4. Limitação** — no celular só "marcar horário" foi cronometrado: `openAgendaAt` usa o menu do computador, que não existe no celular, e o modo serial abortou os demais; registrado em `05-AUDITORIA.md` como a verificar.

Nenhum arquivo de `apps/frontend` ou `apps/backend` foi alterado (D-01).

## Known Stubs

Nenhum.

## Notas para planos seguintes

- Usuário de auditoria do staging deve ser desativado no plano 05-20 (`members.status='inactive'` para `auditoria.ux@sgs.invalid`).
- A aprovação da lista é o primeiro passo do plano 05-08.
- O E2E local usou o Postgres/Valkey locais compartilhados (portas 3100/5180); o seed gerou dados E2E nesse banco local.

## Self-Check: PASSED

Arquivos e commits 0e122a9 e 717c0db conferidos.
