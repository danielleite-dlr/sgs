---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 16
subsystem: infra
tags: [gate, deploy, staging, ci, e2e]
requires:
  - phase: 09-15
    provides: flag do Comercial ligada e E2E do Comercial
provides:
  - gate completo verde no commit publicado
  - Comercial publicado no staging, conferido
  - 09-VALIDATION.md com nyquist_compliant true
affects: [09-17]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - .planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md
    - apps/e2e/tests/fluxo-agendamento-comanda-pagamento.spec.ts
    - apps/e2e/tests/contrato-previa.spec.ts
key-decisions:
  - "E2E frágeis corrigidos no teste (test.slow e conferência por nome), sem tocar no código do app"
requirements-completed: [COM-01, COM-02, COM-03, COM-04, COM-05, COM-06, COM-07, COM-08, COM-09, COM-10, COM-11, COM-12]
duration: ~2h
completed: 2026-11-18
---

# Phase 9 Plan 16: Gate, deploy no staging e CI Summary

Gate completo verde, Comercial publicado no staging com backup, conferências nos valores esperados e CI verde no commit publicado.

## Gate (árvore limpa, Postgres local sgs_dev)

| Etapa | Resultado |
|-------|-----------|
| install --frozen-lockfile, typecheck (5 pacotes), lint | ok |
| jest unitário backend | 62 suítes, 646 testes |
| integração backend | 82 suítes, 844 testes (sem exceção phase4-alerts-boot) |
| vitest frontend | 152 arquivos, 1065 testes |
| shared | 2 arquivos, 26 testes |
| E2E Playwright | 64/64 (10,9 min), na terceira execução, após os dois ajustes abaixo |

Verificações estáticas: sem import de `tailwind.config` em `apps/frontend/src` (os 7 resultados do grep são comentários e `readFileSync` de testes antigos que leem o arquivo como texto); sem `@dnd-kit/sortable`, `xlsx`, `jspdf`; `exceljs` 4.4.0 presente; 1 `ThrottlerModule.forRoot`; `WIN_DEAL_ROLES` só em `commercial-access.ts` e `commercial-permissions.ts`; 6 `FORCE ROW LEVEL SECURITY` na migration.

## Deploy e conferências no staging

- Backup: `/root/sgs-backups/stg-pre-comercial-20261118-1741.sql.gz`, 278.261 bytes, `gzip -t` ok, feito antes do push e do deploy.
- Push `d30bfc0..959b5e4` em master; `./scripts/deploy-staging.sh` terminou com "Deploy concluído".
- Tabelas `commercial_*` com FORCE RLS: 6
- Etapas padrão: org "Studio JS" = 6 (a consulta do plano com `ilike '%Studio JS%'` devolve 12, porque casa também "Studio JS Beauty", que tem 6; a org "Teste" também tem 6)
- Permissões `commercial.%` em role_permissions: 8
- Logs do backend: "commercial-reminders-tick registrado" 1, "Web Push habilitado" 1, "Push FCM habilitado" 1
- `/contato/x/y`: `content-security-policy: frame-ancestors *`, 0 cabeçalhos x-frame-options; `/agenda`: `x-frame-options: SAMEORIGIN`
- `/public/leads/<uuid zero>/x`: 404; `check-pwa-headers.sh`: OK; `/login`: 200
- CI: run 44393646698 (workflow CI, commit 959b5e4), conclusion success confirmado com gh run watch e gh run view.

## Deviations from Plan

**1. [Rule 3 - Bloqueio] E2E `fluxo-agendamento-comanda-pagamento` estourou 30 s na suíte completa**
- Sozinho o teste leva ~25 s (3 execuções passaram); sob a suíte completa passou do limite. Fluxo antigo, sem relação com o Comercial.
- Fix: `test.slow()` no teste. Commit 8e12204.

**2. [Rule 1 - Bug de teste] E2E `contrato-previa` falhou com `clients.totalCount` 1 em vez de 0**
- Causa: `clients(search)` também busca `cpf contains normalizeCpf(search)`; os dígitos do sufixo `Date.now().toString(36)` (ou string vazia) casam o CPF de clientes de outros testes. Passava ou falhava conforme o sufixo.
- Fix: conferir pelo `fullName` das linhas retornadas em vez do total. Commit 8e12204.

**3. Migration já aplicada antes do deploy**
- A migration `20261122000000_phase9_commercial` estava aplicada no staging desde 16:51 UTC (13:51 local) de um deploy anterior; o deploy desta execução reportou "No pending migrations". O backup desta execução é, portanto, pós-migration; o backup pré-migration é `stg-pre-fase9-comercial-ficha-cliente-20261118-1345.sql.gz`.

**Total:** 2 correções em testes E2E, 1 observação sobre o backup. Nenhuma mudança em código do app.

## Known Stubs

Nenhum.

## Pendências para o 09-17

Linhas manuais da validação (push no iPhone, arrastar no celular, iframe no site do salão).

## Self-Check: PASSED

Backup, commits 8e12204 e 959b5e4, push e CI success verificados.
