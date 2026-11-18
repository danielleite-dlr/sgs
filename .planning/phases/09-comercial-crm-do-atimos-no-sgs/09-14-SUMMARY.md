---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 14
subsystem: frontend
tags: [importacao, formulario-publico, lgpd, nginx, iframe]
requires: [09-03, 09-10]
provides:
  - LeadImportDialog com prévia (coluna Responsável, avisos D-22)
  - FormSettingsTab (aba Formulário do site)
  - PublicLeadFormPage (/contato/:orgId/:token) embutível em iframe
  - nginx /contato/ com frame-ancestors *
affects: [09-15, 09-16]
key-files:
  created:
    - apps/frontend/src/features/commercial/api/intake.api.ts
    - apps/frontend/src/features/commercial/api/public-lead.api.ts
    - apps/frontend/src/features/commercial/__tests__/lead-import-dialog.test.tsx
    - apps/frontend/src/features/commercial/__tests__/form-settings-tab.test.tsx
    - apps/frontend/src/features/commercial/__tests__/public-lead-form.test.tsx
  modified:
    - apps/frontend/src/features/commercial/components/LeadImportDialog.tsx
    - apps/frontend/src/features/commercial/components/FormSettingsTab.tsx
    - apps/frontend/src/features/commercial/public/PublicLeadFormPage.tsx
    - apps/frontend/nginx.conf
key-decisions:
  - "Importação sem seletor de responsável: a prévia mostra o membro resolvido pela coluna Responsável e o aviso 'responsável não encontrado: X' (D-22)"
  - "Switch e select do responsável padrão feitos com elementos nativos (role=switch / select), pois não há componente Switch no ui/"
  - "?embed=1 esconde o cabeçalho do salão na página pública"
requirements-completed: [COM-02, COM-03]
completed: 2026-11-18
---

# Phase 9 Plan 14: Formulário e importação (frontend) Summary

Diálogo de importação de planilha com prévia (válidas, inválidas, duplicadas, Responsável), aba de configuração do formulário do site, página pública /contato com consentimento LGPD e honeypot, e nginx liberando iframe só em `/contato/`.

## Tarefas

1. Importação de leads por planilha (cdc605b)
2. Formulário do site, página pública e nginx (9454b9c)

## Verificação

- vitest `src/features/commercial`: 5 arquivos, 19 testes verdes; typecheck e lint verdes.
- Container descartável (`sgs-fe-contato-check`, porta 8098, removido ao final):
  - `/contato/x/y`: `Content-Security-Policy: frame-ancestors *`, sem `X-Frame-Options`, `Cache-Control: no-cache`.
  - `/agenda`: `X-Frame-Options: SAMEORIGIN`.
  - `scripts/check-pwa-headers.sh http://127.0.0.1:8098`: verde.
  - `X-Frame-Options "SAMEORIGIN"` continua 6 vezes no nginx.conf; 0 no bloco `/contato/`.

## Deviations from Plan

None - plano executado como escrito. (O `verify` usa `cd /root/sgs`; rodado no worktree. O build do container usou `--target production` com contexto `apps/frontend`, como no compose.)

## Known Stubs

Nenhum.

## Self-Check: PASSED
