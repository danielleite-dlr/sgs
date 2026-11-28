---
phase: 12-ajustar-cadastro-de-agendamento
plan: 01
subsystem: frontend-operations
tags: [agenda, pacote, helpers-puros, tdd]
requires: []
provides:
  - "expandPackageAt, removePackageLines, packageStartTime, sequenceTimes (visit-form.ts)"
  - "PACKAGE_FALLBACK_TIME e PACKAGE_FALLBACK_MINUTES"
affects: [12-03, 12-04]
tech-stack:
  added: []
  patterns: ["helpers puros genéricos sobre linhas, sem tocar o modal"]
key-files:
  created: []
  modified:
    - apps/frontend/src/features/operations/lib/visit-form.ts
    - apps/frontend/src/features/operations/__tests__/visit-form.test.ts
key-decisions:
  - "Duração padrão 0/negativa/NaN vira 60 min (safeMinutes) em expandPackageLines e sequenceTimes"
  - "Helpers genéricos (L) para o modal poder usar o próprio LineState"
requirements-completed: [D-02, D-04, D-06, D-07, D-11, D-12]
duration: 20min
completed: 2026-11-27
---

# Fase 12 Plano 01: Helpers puros do pacote na linha Summary

Quatro helpers puros (expandir no lugar, remover só o pacote, hora de início, sequência do prefill) e guarda de duração em `expandPackageLines`, com 11 casos novos de teste, incluindo "Make & Penteado".

## D-12 — reprodução

**Parte A (dados do staging, SELECT em BEGIN/ROLLBACK, org Studio JS):** o pacote se chama "Make & Penteado (madrinhas)", sem `deleted_at`, com 2 serviços: Maquiagem madrinha (60 min, quantity 1, ordem 0) e Penteado madrinha (60 min, quantity 1, ordem 1). Nenhuma duração 0/NULL, nenhum serviço repetido, `quantity` 1. Os dados não explicam horário repetido: pela função, o resultado correto é 10:00 e 11:00.

**Parte B (UI atual no staging): não executada.** O `.env.audit` existe, mas não tem `AUDIT_EMAIL`/`AUDIT_PASSWORD` (o usuário de auditoria foi desativado e a senha apagada no 05-20). `loadAuditEnv` falhou antes de abrir o navegador. Não criei usuário nem mexi no staging. Horas dos cenários 1 e 2 portanto não foram medidas na UI.

**Conclusão:** não reproduzido. Os dados do pacote estão corretos e `expandPackageLines` sequencia (teste de regressão "Make & Penteado" com 10:00 e 11:00). Isso confirma a hipótese do RESEARCH: o "mesmo horário" vem de fluxo fora da escolha do pacote (prefill do grupo da noiva repetindo a hora, linha "Adicionar serviço" com hora vazia, ou edição manual sem cascata). O prefill é tratado em D-11 (`sequenceTimes`) e a guarda de duração fecha o caso de duração 0/ausente. Se o usuário puder dizer em qual fluxo viu, melhor; ou rodar a Parte B com credencial de auditoria nova.

## Tarefas

1. **Reproduzir no staging (D-12):** Parte A feita; Parte B bloqueada por credencial. Spec temporário criado e apagado, nada commitado. Sem commit.
2. **Helpers (TDD):** RED `f3b23db`, GREEN `bca5ffa`.

## Deviations from Plan

None no código. Bloqueio de credencial (Parte B) documentado acima. Ajustei a linha de `packageStartTime` e o comentário de `PACKAGE_FALLBACK_MINUTES` para caber em 100 colunas.

## Verificação

- vitest `visit-form.test.ts`: 23 passam (inclui o caso antigo).
- `tsc --noEmit` e eslint (`--max-warnings 0`) sem erro. `VisitFormDialog.tsx` intocado.

## Known Stubs

Nenhum.

## Self-Check: PASSED

Arquivos e commits `f3b23db`, `bca5ffa` conferidos.
