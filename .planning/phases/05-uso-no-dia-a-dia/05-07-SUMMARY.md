---
phase: 05-uso-no-dia-a-dia
plan: 07
subsystem: e2e-deploy
tags: [playwright, deploy, staging, previsao]
requires: [05-04, 05-06, 05-06b]
provides: [E2E financeiro-previsao, auditoria somente leitura da previsão, previsão no ar no staging]
key-files:
  created:
    - apps/e2e/tests/financeiro-previsao.spec.ts
    - apps/e2e/audit/previsao-staging.audit.ts
decisions:
  - "Auditoria no celular abre /financeiro/despesas-fixas direto, pois o menu lateral vira gaveta e o rail do navigateViaMenu não existe lá"
metrics:
  tasks: 2
  completed: 2026-11-06
---

# Phase 5 Plan 07: E2E, deploy e previsão no staging Summary

A previsão de 30 dias (FIN-03) está no ar no staging (https://sgs.jessicaseixasmakeup.com.br), com a migration de despesas fixas aplicada, E2E ponta a ponta verde e CI verde.

## Commits

- 7e1cc88: E2E financeiro-previsao e auditoria do staging
- fa976da: auditoria abre a rota direto no celular

## Gate local

- typecheck e lint (-r): limpos
- Jest unit backend: 32 suítes, 363 testes
- Vitest frontend: 65 arquivos, 447 testes
- Integração backend: 55 de 56 suítes (595 de 597 testes). A única falha é `phase4-alerts-boot.e2e.spec.ts`, por timeout de 30 s no beforeAll com `NOAUTH Authentication required` (Redis local exige senha e o `.env` não tem; problema do ambiente, anterior à fase 5). Não alterei .env nem Redis. O CI, com Redis próprio, passou.
- E2E Playwright completo: 29 de 29 (inclui smoke.spec.ts atualizado e financeiro-previsao).

## Deploy

- Backup pré-deploy: /root/sgs-backups/stg-pre-phase5-forecast-20261106-0038.sql.gz (117 KB)
- `./scripts/deploy-staging.sh`: "Deploy concluído"
- Migration `20261106000000_phase5_fixed_expenses` com finished_at preenchido no staging
- CI: run 42157808394 (7e1cc88) success; run 42158388927 (fa976da) success
- Checagem somente leitura (usuário de auditoria, guarda de mutations): previsao-staging.audit.ts verde em desktop e mobile, sem texto de erro e sem mutations bloqueadas. Evidências em .planning/phases/05-uso-no-dia-a-dia/05-audit-evidence/{desktop,mobile}/90-previsao-*.png.

## Deviations from Plan

**1. [Rule 1 - Bug] Auditoria falhou no mobile**
- **Found during:** Task 2, passo 7
- **Issue:** `navigateViaMenu` espera o rail "Expandir/Recolher menu", ausente no celular.
- **Fix:** no projeto mobile a auditoria navega por `page.goto('/financeiro/despesas-fixas')` (com novo login se preciso).
- **Commit:** fa976da (o código já implantado não mudou; só o teste de auditoria)

## Known Stubs

Nenhum.

## Notes

FIN-03 não foi marcado como concluído no REQUIREMENTS.md; a fase fecha no 05-20.

## Self-Check: PASSED
