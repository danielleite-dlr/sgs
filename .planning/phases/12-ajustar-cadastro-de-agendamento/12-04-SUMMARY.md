---
phase: 12-ajustar-cadastro-de-agendamento
plan: 04
subsystem: frontend-operations
tags: [agenda, date-field, prefill, e2e, prints]
requires: ["12-01", "12-02", "12-03"]
provides:
  - "Calendário (DateField) no campo Data do modal de agendamento"
  - "Prefill do grupo da noiva com horas em sequência, sem opção Pacote"
affects: []
tech-stack:
  added: []
  patterns: ["ref prefillSequencePending: sequência aplicada uma vez por abertura, quando o catálogo chega"]
key-files:
  created: []
  modified:
    - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
    - apps/frontend/src/features/operations/__tests__/novo-agendamento-gestor-beauty.test.tsx
    - apps/frontend/src/features/operations/__tests__/visit-form-prefill.test.tsx
    - .planning/phases/12-ajustar-cadastro-de-agendamento/12-VALIDATION.md
key-decisions:
  - "A sequência do prefill roda no efeito do catálogo (precisa das durações) e só uma vez por abertura, então editar a hora da linha 0 depois não cascateia (D-07)"
requirements-completed: [D-08, D-09, D-11, D-01, D-06]
duration: 40min
completed: 2026-11-27
---

# Fase 12 Plano 04: Calendário no modal, prefill em sequência e validação Summary

`DateField` ligado ao campo Data do modal (ícone de calendário ao lado, mesma grade `visit-when`), prefill do grupo da noiva com horas em sequência (10:00, 11:15...) sem opção Pacote, e a fase validada por gate, 7 specs E2E e prints no celular e no computador.

## Tarefas

1. **DateField + prefill em sequência** — commit `1a6c6c6`. `<DateField id="visit-date" pickerTestId="visit-date-picker">`; `prefillSequencePending` (useRef) marcado na abertura com prefill e consumido no efeito do catálogo, que preenche as durações e chama `sequenceTimes`. Testes novos: ícone dentro de `visit-when` com 44 px, abrir calendário em "Novembro de 2026" e escolher o dia 20 preenche `20/11/2026`; prefill make 75 + penteado 60 às 10:00 dá 10:00 e 11:15, mudar a linha 0 não mexe na 1; sem `visit-line-0-kind-package`; sem hora inicial as horas ficam vazias. `allowPackage={!prefill}` do 12-03 já cobria D-11.
2. **Gate, E2E e prints** — sem commit (spec temporário apagado).

## Verificação

- Frontend: `vitest run` 63 arquivos / 422 testes passam; `tsc --noEmit` e `eslint src --max-warnings 0` sem erros.
- E2E (local, nunca staging): `fluxo-agendamento-comanda-pagamento`, `ux-agenda-celular`, `prioridade-profissionais`, `cronograma-noiva`, `agenda-concorrencia`, `assistente-papel`, `ux-contraste`: 20 testes passam (incluindo o seed).
- `git status` do backend sem mudanças (D-03).
- 12-VALIDATION.md: `nyquist_compliant: true`, `wave_0_complete: true` (visit-form-package, date-field e casos de visit-form.test.ts existem e passam).

## Prints (spec temporário `zz-tmp-12-prints.spec.ts` apagado, não commitado)

Celular 390x844 e computador 1366x900, pacote "Make e Penteado" criado pela API (2 serviços de 90 min):

- /tmp/claude-0/-root/82c9466d-782d-4c52-a1e5-26a04e53158d/scratchpad/prints-12/12-celular-1-modal.png
- /tmp/claude-0/-root/82c9466d-782d-4c52-a1e5-26a04e53158d/scratchpad/prints-12/12-celular-2-calendario.png
- /tmp/claude-0/-root/82c9466d-782d-4c52-a1e5-26a04e53158d/scratchpad/prints-12/12-celular-3-pacote.png
- /tmp/claude-0/-root/82c9466d-782d-4c52-a1e5-26a04e53158d/scratchpad/prints-12/12-computador-1-modal.png
- /tmp/claude-0/-root/82c9466d-782d-4c52-a1e5-26a04e53158d/scratchpad/prints-12/12-computador-2-calendario.png
- /tmp/claude-0/-root/82c9466d-782d-4c52-a1e5-26a04e53158d/scratchpad/prints-12/12-computador-3-pacote.png

Medições: painel do calendário no celular x=45, largura 320 (cabe em 390); no computador x=303. Horas das duas linhas do pacote com início 10:00: **10:00 e 11:30** nos dois tamanhos (diferentes, D-12 ok; duração 90 min).

Conferência visual: seletor Serviço | Pacote cabe em 390 px sem corte; ícone do calendário ao lado do campo com alvo de 44 px; calendário roxo, domingo primeiro, dia de hoje destacado, inteiro dentro da tela; selo "do pacote ..." legível; "Remover pacote" visível; serviço da linha do pacote travado (cinza). Nenhum ajuste de classe foi necessário.

Observações (sem mudança, fora do escopo): no print do computador (3-pacote) o rótulo da profissional sugerida aparece roxo sobre roxo (contraste baixo) enquanto no celular aparece branco; provavelmente captura no meio da transição de cor do botão selecionado, mas vale conferir no staging. O calendário aberto no celular sobrepõe o botão "Adicionar serviço" (é um popover, esperado).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] Ambiente do worktree para o E2E**
- **Found during:** Task 2
- **Issue:** o backend do E2E não subia: Prisma Client não gerado no worktree e sem `.env`.
- **Fix:** `prisma generate` em apps/backend e cópia de `/root/sgs/.env` para o worktree (ambos ignorados pelo git, nada commitado).

## Known Stubs

Nenhum.

## Self-Check: PASSED
