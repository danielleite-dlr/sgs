---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 14
subsystem: e2e
tags: [e2e, playwright, prioridade-profissionais, cronograma-noiva]
requires: [11-09, 11-10, 11-12, 11-13]
provides:
  - "support/phase11.ts: markPriorityFlags"
  - "E2E prioridade-profissionais (6 testes, incluindo celular)"
key-files:
  created:
    - apps/e2e/support/phase11.ts
    - apps/e2e/tests/prioridade-profissionais.spec.ts
  modified:
    - apps/e2e/tests/seed.setup.ts
    - apps/e2e/support/phase3.ts
    - apps/e2e/tests/cronograma-noiva.spec.ts
requirements-completed: [PRIO-02, PRIO-08, PRIO-11, PRIO-12, PRIO-15]
metrics:
  completed: 2026-11-26
---

# Fase 11 Plano 14: E2E da prioridade de profissionais e do cronograma

Fluxo da fase coberto no navegador (noiva e debutante) e specs antigos ajustados às regras novas.

## O que foi feito

- `support/phase11.ts`: `markPriorityFlags` (isFixed/servesBridal via `updateMember`).
- Seed e profissional extra de `phase3.ts` passam a nascer com `servesBridal` (dado de teste, fase 11 D-02).
- `cronograma-noiva`: a simulação agora vem preenchida e com selos "Sugerida" (04.2 D-03 revogada por 11 D-06); a troca manual continua testada.
- `prioridade-profissionais.spec.ts`: (1) dona marca a fixa pela tela Profissionais; (2) simulação da noiva já com a fixa, "Acompanhantes prontas até" 15:00, confirmação; (3) atendente agenda acompanhante terminando depois: recusa com "pronta até 15h (saída das acompanhantes)" e sem botão de forçar; (4) novo agendamento comum com a fixa pré-selecionada e texto "Sugestão do sistema"; (5) debutante também sugerida; (6) celular 390x844: selos e simulação sem rolagem lateral. `afterAll` desmarca a fixa.

## Resultados reais (stack local: sgs_dev, backend :3100, frontend :5180)

- `corepack pnpm --filter @sgs/e2e test:e2e tests/cronograma-noiva.spec.ts`: 5 passed.
- `... tests/debutante-contrato.spec.ts tests/assistente-noiva.spec.ts tests/noivas-contrato.spec.ts`: 15 passed.
- `... tests/prioridade-profissionais.spec.ts`: 7 passed (seed + 6); a primeira rodada falhou por formato da hora.
- Suíte E2E inteira: 82 passed, 0 failed (13,9 min). `tsc --noEmit` do pacote e2e limpo.

## Deviations from Plan

1. [Rule 1] A mensagem real usa "15h", não "15:00"; o assert foi ajustado.
2. Nenhum outro spec quebrou: debutante-contrato/assistente/noivas-contrato passaram sem alteração.
3. [Ambiente] Worktree precisou de `.env`, symlinks de node_modules (não commitados); migrations já aplicadas.
4. Não há projeto mobile no Playwright; o celular é um describe com viewport 390x844 (padrão dos specs ux-*-celular).

## Known Stubs

Nenhum.
