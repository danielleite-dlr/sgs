---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 09
subsystem: frontend/operations
tags: [agendamento, sugestao-profissional, apollo, vitest]
requires: ["11-03", "11-06"]
provides:
  - SuggestProfessionalsQuery (frontend)
  - lineInterval (data BR + hora + duração → ISO)
  - pré-seleção da profissional sugerida no VisitFormDialog
affects: [VisitFormDialog]
key-files:
  created:
    - apps/frontend/src/features/operations/api/professional-suggestion.api.ts
    - apps/frontend/src/features/operations/__tests__/visit-line-interval.test.ts
  modified:
    - apps/frontend/src/features/operations/lib/visit-form.ts
    - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
    - apps/frontend/src/features/operations/__tests__/novo-agendamento-gestor-beauty.test.tsx
decisions:
  - "professionalTouched na LineState: coluna clicada, cópia da linha anterior e clique contam como escolha; a sugestão só texto"
  - "Intervalo com debounce de 300 ms antes de consultar suggestProfessionals (network-only)"
metrics:
  tasks: 2
  completed: 2026-11-26
---

# Phase 11 Plan 09: Pré-seleção da profissional no agendamento comum Summary

O agendamento comum pré-seleciona a profissional sugerida pelo servidor (fixa livre mais justa) enquanto a pessoa não escolher, e apenas sugere em texto quando já há escolha.

## O que foi feito

- `SuggestProfessionalsQuery` e tipos; `lineInterval` extraído de `buildCreateVisitInput` (comportamento mantido).
- `LineRow`: consulta com debounce de 300 ms, `useEffect` de pré-seleção (aplica variante por senioridade sem marcar `professionalTouched`), texto `visit-line-N-suggestion` ("Sugestão do sistema: X (fixa livre)", "Sugestão: X (não fixa livre)"), opções com `sortFixedFirst`.
- `suggestEnabled={!prefill}`: sem consulta vindo do grupo da noiva.
- Testes: `it(` em novo-agendamento-gestor-beauty.test.tsx de 13 para 19 (+6); 2 novos em visit-line-interval.test.ts.

## Verificação

vitest de `src/features/operations` (57 arquivos, 377 testes) verde; `tsc --noEmit` e eslint de operations limpos. O `codegen` do `<verify>` não foi rodado (exige backend no ar; a query é escrita à mão e o tsc cobre os tipos).

## Deviations from Plan

None - plano executado como escrito (exceto codegen não executado, ver acima).

## Commits

- Task 1: 6ece99e
- Task 2: cf63868

## Self-Check: PASSED
