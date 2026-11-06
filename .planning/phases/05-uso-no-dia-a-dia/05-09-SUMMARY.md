---
phase: 05-uso-no-dia-a-dia
plan: 09
subsystem: frontend-ux
tags: [ux, agenda, tailwind-merge, contraste]
requires: [05-07, 05-08]
provides: [UX-01, UX-04, UX-05 corrigidos e verificados no staging]
key-files:
  created:
    - apps/frontend/src/components/ui/__tests__/contraste-primario.test.tsx
    - apps/frontend/src/features/operations/__tests__/ux-agenda-lote1.test.tsx
    - apps/e2e/tests/ux-contraste.spec.ts
    - apps/e2e/audit/ux-contraste-staging.audit.ts
  modified:
    - apps/frontend/src/lib/cn.ts
    - apps/frontend/src/components/ui/button-variants.ts
    - apps/frontend/src/components/ui/dialog.tsx
    - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx
decisions:
  - "UX-01 corrigido na causa: cn() agora registra text-label/body/heading/display como tamanho de fonte no tailwind-merge; as cores do tema não mudaram"
  - "Selo 'Pgto Indica' removido: era marcação estática sem dado associado"
metrics:
  tasks: 3
  completed: 2026-11-06
---

# Phase 5 Plan 09: Agenda, lote 1 (UX-01, UX-04, UX-05) Summary

Letra branca sobre o roxo em "Dia", "Semana" e "Salvar", um único botão de fechar no diálogo de agendamento, mês escrito "Novembro de 2026" e selo "Pgto Indica" removido. Tudo no ar no staging com CI verde.

## Causa raiz do UX-01

`tailwind-merge` (em `lib/cn.ts`) tratava o tamanho customizado `text-label` como cor de texto. No `size="sm"` do botão, `text-label` vem depois da variante `default` e descartava `text-primary-foreground`, então o botão herdava o grafite do `body`. Atingia todo botão `sm` primário do app (Dia/Semana, Salvar, filtros de período). As cores do tema estavam corretas. Correção: `extendTailwindMerge` com o grupo `font-size`, mais `text-white` explícito na variante default.

## Commits

- 3de395d: fix(05-09) correção do lote (UX-01, UX-04, UX-05)
- 7d47989: docs(05-09) hashes na auditoria (push junto com 8a7ace9, 8ccfb72 e e4c65f4 do orquestrador)
- commit de docs final: SUMMARY, STATE, ROADMAP, verificação no staging e auditoria somente leitura

## Testes de regressão (falhavam antes, passam depois)

- `contraste-primario.test.tsx`: botão `sm` e `cn` mantêm a cor do texto
- `ux-agenda-lote1.test.tsx`: um só "Fechar", "Novembro de 2026", sem "Pgto"
- `ux-contraste.spec.ts` (Playwright): "Dia" e "Salvar" com rgb(255,255,255) sobre rgb(87,0,128)

## Gate

- typecheck e lint (-r): limpos
- Backend unit: 363 de 363. Frontend: 67 arquivos, 459 testes
- Backend integração: 595 de 597; as 2 falhas são só `phase4-alerts-boot.e2e.spec.ts` (Redis local com NOAUTH, ambiental e pré-existente, aceita pelo orquestrador; CI cobre)
- E2E completo: 30 de 30 (rodado pelo orquestrador sozinho; minha rodada anterior teve 2 falhas por colisão de traces com outra execução simultânea)
- CI na master: verde (run 42163691931 em 7d47989). Deploy do staging concluído.

## Verificação no staging (somente leitura, usuário de auditoria)

`audit/ux-contraste-staging.audit.ts` com o guard de mutação (nada bloqueado): em /agenda, /financeiro, /financeiro/previsao e /comandas todo botão/aba com fundo roxo tem letra branca (4, 4, 3 e 1 elementos); "Dia" branco, sem "Pgto", diálogo de agendamento com "Salvar" branco e um único "Fechar".

## Deviations from Plan

- [Rule 3] `InlineCalendar` passou a ser exportado para ser testável.
- Texto sr-only do X do `dialog.tsx` traduzido de "Close" para "Fechar" (previsto no plano).
- Adicionei a auditoria de staging `ux-contraste-staging.audit.ts` (não prevista) para cumprir a conferência de contraste pedida.

## Known Stubs

Nenhum.

## Self-Check: PASSED
