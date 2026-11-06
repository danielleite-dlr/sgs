---
phase: 05-uso-no-dia-a-dia
plan: 08
subsystem: planning
tags: [usabilidade, auditoria, lotes, planejamento]
requires:
  - phase: 05-uso-no-dia-a-dia
    provides: "05-AUDITORIA.md (05-01)"
provides:
  - "Auditoria aprovada pela usuária em 2026-11-06"
  - "Planos de lote 05-09..05-16 (8 lotes, 19 itens UX)"
  - "05-20 encadeado após o último lote"
affects: [05-20]
tech-stack:
  added: []
  patterns: ["lote por tela, máximo 2 correções + tarefa de gate/deploy"]
key-files:
  created:
    - .planning/phases/05-uso-no-dia-a-dia/05-09-ux-lote-agenda-1-PLAN.md
    - .planning/phases/05-uso-no-dia-a-dia/05-10-ux-lote-agenda-2-PLAN.md
    - .planning/phases/05-uso-no-dia-a-dia/05-11-ux-lote-comanda-1-PLAN.md
    - .planning/phases/05-uso-no-dia-a-dia/05-12-ux-lote-comanda-2-PLAN.md
    - .planning/phases/05-uso-no-dia-a-dia/05-13-ux-lote-noivas-1-PLAN.md
    - .planning/phases/05-uso-no-dia-a-dia/05-14-ux-lote-noivas-2-PLAN.md
    - .planning/phases/05-uso-no-dia-a-dia/05-15-ux-lote-clientes-PLAN.md
    - .planning/phases/05-uso-no-dia-a-dia/05-16-ux-lote-financeiro-PLAN.md
  modified:
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
    - .planning/phases/05-uso-no-dia-a-dia/05-20-fechamento-PLAN.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
key-decisions:
  - "UX-16 aprovado só para padronizar a caixa dos nomes na exibição; aviso de duplicidade vai ao backlog"
  - "UX-20 fica para depois (backlog 999.6); a previsão de 30 dias já entra no painel pelos planos 05-06/05-06b"
patterns-established:
  - "Utilitários compartilhados criados no primeiro lote que precisa: formatPhoneBr e toDisplayName (05-11), reaproveitados em 05-13, 05-15 e 05-16"
requirements-completed: []
duration: 25min
completed: 2026-11-06
---

# Phase 5 Plan 08: Gerar lotes de correção Summary

**Auditoria aprovada pela usuária (19 itens corrigir, 1 depois) transformada em 8 planos de lote por tela, na ordem Agenda, Comanda, Noivas, Clientes e Financeiro, com 05-20 encadeado após o último.**

## Aprovação (checkpoint resolvido pelo orquestrador)

Resposta da usuária em 2026-11-06: "aprovo tudo, UX-20 depois, UX-16 só padronizar nomes". Registrada em `05-AUDITORIA.md` (status `aprovada`, seção "Registro de aprovação") e em STATE.md. "Remarcar no celular" ficou como conferência manual pendente da usuária, sem item de correção.

## Lotes gerados

| Plano | Tela | IDs | Onda | Depende de |
|-------|------|-----|------|------------|
| 05-09 | Agenda 1 | UX-01, UX-04, UX-05 | 5 | 05-07, 05-08 |
| 05-10 | Agenda 2 (celular) | UX-02, UX-03 | 6 | + 05-09 |
| 05-11 | Comanda e caixa 1 | UX-06, UX-07, UX-08 | 7 | + 05-10 |
| 05-12 | Comanda 2 e menu | UX-09, UX-10 | 8 | + 05-11 |
| 05-13 | Noivas e contratos 1 | UX-11, UX-14 | 9 | + 05-12 |
| 05-14 | Noivas e contratos 2 | UX-12, UX-13 | 10 | + 05-13 |
| 05-15 | Clientes | UX-15, UX-16 (só nomes) | 11 | + 05-14 |
| 05-16 | Financeiro | UX-17, UX-18, UX-19 | 12 | + 05-15 |
| 05-20 | Fechamento | — | 13 | 05-07, 05-08, 05-16 |

Cada lote tem 3 tarefas (2 correções com teste de regressão vitest/Playwright e 1 de gate, commit, push, deploy no staging e CI). Todos validados com `frontmatter validate` e `verify plan-structure` (valid: true). Cada ID UX-01..UX-19 aparece em exatamente um lote. Os lotes tocam em `router`/menu/Painel/Financeiro só depois de 05-07, por `depends_on`.

Se a execução em curso não pegou os lotes novos, rodar `/gsd:execute-phase 5` de novo: ela pula os planos com SUMMARY e executa os lotes e o 05-20.

## Backlog (999.6 no ROADMAP)

UX-20 (painel com resumo do dia), aviso de cliente duplicado (parte não aprovada do UX-16) e remarcar pelo menu do cartão.

## Deviations from Plan

None - plano executado como escrito. Observações:
- A causa do UX-01 (texto escuro sobre roxo) não foi diagnosticada nesta fase de planejamento; o lote 05-09 traz as hipóteses (twMerge com `text-label`, CSS gerado, classes de aba) e o teste Playwright de cor calculada.
- Os textos de apoio do UX-18 são rascunho a conferir contra o resolver do backend no lote 05-16.
- O trailer de co-autoria dos commits dos lotes é o que o ambiente indicar na hora da execução (o plano original citava Opus 5.5).
- Commits feitos com `--no-verify` por ser execução paralela.

## Commits

- 7004875: docs(05-08): auditoria aprovada pela usuária
- 0f65545: docs(05-08): lotes de correção de usabilidade a partir da auditoria aprovada

## Known Stubs

Nenhum (só arquivos de planejamento).

## Self-Check: PASSED
