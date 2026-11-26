---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 12
subsystem: frontend-bridal
tags: [frontend, cronograma, noiva, debutante, make-off]
requires: [11-04, 11-06, 11-08]
provides:
  - Cronograma da noiva/debutante com seletores filtrados, sugestão e saída das acompanhantes
affects: [apps/frontend/src/features/bridal]
key-files:
  modified:
    - apps/frontend/src/features/bridal/api/timeline.api.ts
    - apps/frontend/src/features/bridal/api/bridal.api.ts
    - apps/frontend/src/features/bridal/lib/timeline-labels.ts
    - apps/frontend/src/features/bridal/components/BridalTimelineTab.tsx
    - apps/frontend/src/features/bridal/components/TimelineSimulationCard.tsx
    - apps/frontend/src/features/bridal/components/BridalGroupFormDialog.tsx
    - apps/frontend/src/features/bridal/__tests__/timeline-tab.test.tsx
    - apps/frontend/src/features/bridal/__tests__/bridal-group-form.test.tsx
    - apps/frontend/src/features/bridal/__tests__/bridal-fixtures.ts
    - apps/frontend/src/features/bridal/__tests__/bridal-groups-page.test.tsx
decisions:
  - Valor inicial de "Acompanhantes prontas até" vem do cronograma oficial, senão do grupo
  - Select reflete a sugestão da simulação só quando vazio (escolha manual prevalece)
metrics:
  tasks: 2
  completed: 2026-11-26
---

# Phase 11 Plan 12: Cronograma da noiva no frontend Summary

Aba Cronograma com seletores de make/penteado filtrados por `bridal: true` (fixas primeiro), aviso vazio com link para /profissionais, selos "Sugerida"/"Não fixa", campo "Acompanhantes prontas até" (aba e formulário do grupo) e rótulos com make-off.

## Tarefas

1. Documentos gql, rótulos e campo no formulário do grupo (commit 626ba19)
2. Aba Cronograma e cartão da simulação (commit 66d9a2e)

## Detalhes

- Seletores: `ProfessionalsForServiceQuery` com `{ serviceId, bridal: true }`; sufixo " (não fixa)"; rótulos "Make/Penteado da noiva|debutante".
- Ao gerar simulação, make/penteado vazios recebem a profissional sugerida.
- `companionsReadyTime` enviado no preview e na confirmação ('' = igual ao make-off).
- Cartão: selos com texto, link /profissionais no aviso `NO_BRIDAL_PROFESSIONAL`, "(make-off)" na linha do registro.

## Deviations from Plan

- Fixtures (`bridal-fixtures.ts`, `bridal-groups-page.test.tsx`) e teste de rótulo antigo ajustados para os novos campos (Rule 3, necessário para typecheck/testes).
- `codegen` não executado (exige backend rodando; consultas são manuais, tsc cobre os tipos).
- O passo 6 (layout 375 px) fica para o teste visual do 11-16; grade já é `sm:grid-cols-2` (uma coluna no celular).

## Verificação

vitest `src/features/bridal`: 22 arquivos, 169 testes verdes; `tsc --noEmit` e eslint limpos.

## Known Stubs

Nenhum.

## Self-Check: PASSED
