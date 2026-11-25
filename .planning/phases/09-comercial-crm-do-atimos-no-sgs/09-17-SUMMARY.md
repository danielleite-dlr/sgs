---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 17
subsystem: verificacao
tags: [uat, staging, push, kanban, iframe]
requires:
  - phase: 09-16
    provides: Comercial publicado no staging com CI verde
provides:
  - itens manuais do 09-VALIDATION.md aprovados pela usuária
affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - .planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md
key-decisions:
  - "Lembrete de teste criado pela própria usuária no app (em vez de pré-criado com horário fixo), para o horário bater com o teste"
requirements-completed: [COM-03, COM-06, COM-08, COM-11]
duration: ~20min
completed: 2026-11-24
---

# Phase 9 Plan 17: Verificação humana Summary

**Push de lembrete, kanban por toque, formulário em iframe e ganho com sinal Pix aprovados pela usuária no staging.**

## Preparação (automatizada)

- Staging recriado em 2026-11-24 19:35 (-03), depois do commit 959b5e4 do 09-16 (inclui o quick 261124-qhs).
- Lead "Teste Comercial 24/11" + negócio noiva na etapa Novo, responsável Daniel Leite (MANAGER), org Studio JS.
- `/contato/<org>/<token>?embed=1` responde 200 com `frame-ancestors *`; página de teste com o iframe gerada no scratchpad.
- Formulário do site estava inativo (`is_active=false`); a usuária ativou na aba "Formulário do site" antes do teste 3.

## Resultado

| Item | Requisito | Resultado |
|------|-----------|-----------|
| Push do lembrete no iPhone e Android, toque abre /comercial/lembretes destacado | COM-11 | aprovado |
| Kanban no celular: rolagem lateral, arrastar por toque, "Mover para…" | COM-06 | aprovado |
| Formulário embutido em outra origem gera lead | COM-03 | aprovado |
| Ganho com sinal Pix abre contrato rascunho e lança no caixa | COM-08 | aprovado |

## Deviations from Plan

None - plan executed exactly as written (exceto o lembrete, criado pela usuária no app).

## Known Stubs

Nenhum. Os leads "Teste Comercial 19/11 01:32" e "Teste Comercial 24/11" ficam no staging e podem ser apagados.

## Self-Check: PASSED
