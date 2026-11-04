---
phase: 04-bridal-contracts
plan: 02
subsystem: contracts-domain
tags: [tdd, pure-functions, contracts, money, cancellation, template]
requires: []
provides:
  - computeDepositCents, computeContractTotals, balanceDueDate, daysBetween, computeContractStatus
  - CancellationPolicySchema, buildPolicySnapshot, computeCancellationSettlement
  - renderContract, validateTemplate, DEFAULT_BRIDAL_TEMPLATE, sha256Hex, formatBRL, maskCpf, formatDateBR
  - newAccessToken, hashToken, ACCESS_TOKEN_TTL_DAYS
affects: [04-06, 04-09, 04-10, 04-11]
tech-stack:
  added: []
  patterns: [funções puras, testes de tabela com it.each, datas YYYY-MM-DD em UTC]
key-files:
  created:
    - apps/backend/src/contracts/domain/contract-math.ts
    - apps/backend/src/contracts/domain/cancellation-policy.ts
    - apps/backend/src/contracts/domain/contract-template.ts
    - apps/backend/src/contracts/domain/contract-token.ts
    - apps/backend/src/contracts/domain/contract-math.spec.ts
    - apps/backend/src/contracts/domain/cancellation-policy.spec.ts
    - apps/backend/src/contracts/domain/contract-template.spec.ts
    - apps/backend/src/contracts/domain/contract-token.spec.ts
key-decisions:
  - "Render do modelo em passada única: valores de variáveis não são reinterpretados (sem injeção de {{...}})"
  - "maskCpf devolve string vazia para CPF com tamanho inválido"
requirements-completed: [CONT-01, CONT-02, CONT-03]
duration: ~20min
completed: 2026-11-03
---

# Phase 4 Plan 02: Domínio puro do contrato de noiva Summary

Quatro módulos puros (dinheiro/prazo/status derivado, política de cancelamento sem faixas, modelo de texto com hash sha256 e token de acesso de 256 bits) com 54 testes e 100% de cobertura de linhas.

## Commits
- f084388 test: contract math e política (RED)
- 82e1b1a feat: contract math e política (GREEN)
- 0d23b65 test: modelo e token (RED)
- 07b77de feat: modelo e token (GREEN)

## Deviations from Plan
None - plan executed exactly as written. Sem refactor necessário.

Observação de ambiente: o worktree não tinha node_modules; foram criados symlinks (não versionados, não commitados) para os node_modules do repositório principal. Gate rodado diretamente com jest/eslint/tsc do pacote (lint, tsc e 54 testes de contracts/domain verdes).

## Known Stubs
None.

## Self-Check: PASSED
