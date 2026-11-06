---
phase: 05-uso-no-dia-a-dia
plan: 10
subsystem: frontend-ux
tags: [ux, agenda, celular, alvos-de-toque, formulario]
requires: [05-07, 05-08, 05-09]
provides: [UX-02, UX-03 corrigidos e verificados no staging]
key-files:
  created:
    - apps/frontend/src/features/operations/lib/professional-label.ts
    - apps/frontend/src/features/operations/__tests__/professional-label.test.ts
    - apps/frontend/src/features/operations/__tests__/visit-form-scroll.test.tsx
    - apps/e2e/tests/ux-agenda-celular.spec.ts
    - apps/e2e/audit/ux-agenda-celular-staging.audit.ts
    - .planning/phases/05-uso-no-dia-a-dia/deferred-items.md
  modified:
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx
    - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
decisions:
  - "Avatares da barra da Agenda: no celular viram botões de 44 px com avatar + nome curto ('Maria A.'); no computador continuam sobrepostos como antes"
  - "Rótulo acessível dos avatares da barra é 'Agenda de {nome}' com aria-pressed, para não duplicar o '{nome} — visível' do painel de filtros (usado pelo E2E de equipe)"
  - "Margem interna herdada do diálogo (p-lg que o cn() não funde com p-0) removida só no celular do formulário de agendamento; a causa raiz no cn() ficou em deferred-items para aprovação"
metrics:
  tasks: 3
  completed: 2026-11-06
---

# Phase 5 Plan 10: Agenda no celular, lote 2 (UX-02, UX-03) Summary

Na Agenda do celular o botão de filtros agora diz "Filtros", os botões de profissional, "Todos", setas de data e mostrar/ocultar têm 44 px, e os avatares da barra mostram o nome curto ("Jessica S.") em vez de iniciais sobrepostas e cortadas. O formulário "Cadastrar agendamento" ocupa a tela inteira no celular e avisa "Role para ver mais campos" até chegar ao fim. No computador nada mudou. Está no staging com CI verde.

## Commits

- acdc9e4: fix(05-10) correção do lote (UX-02, UX-03)
- b63fd82: docs(05-10) hashes na auditoria
- commit final de docs: SUMMARY, verificação no staging na auditoria, auditoria somente leitura, STATE e ROADMAP

## Testes de regressão (falhavam antes, passam depois)

- `professional-label.test.ts`: "Maria Aparecida Silva" vira "Maria A.", "Ana" fica "Ana", vazio vira "?", "JOANA PAULA" vira "Joana P.", acentos preservados
- `visit-form-scroll.test.tsx`: diálogo com `h-[100dvh] sm:h-auto sm:max-h-[90vh]`; aviso dentro do corpo rolável; o aviso some quando o corpo chega ao fim
- `ux-agenda-celular.spec.ts` (Playwright, 412x915): "Filtros" com texto e 44 px; cada avatar da barra com 44 px e nome curto visível; "Todos" e cada profissional do painel com 44 px; corpo do formulário com pelo menos 60% da altura e a largura toda da tela; "Salvar" à vista; aviso visível e depois escondido no fim; Hora, Duração e "Adicionar serviço" visíveis após rolar

## Gate

- typecheck e lint (-r): limpos
- Frontend: 69 arquivos, 471 testes. Backend unit: 367 de 367
- Backend integração: 599 de 601; as 2 falhas são só `phase4-alerts-boot.e2e.spec.ts` (Redis local NOAUTH, conhecida e aceita; CI cobre)
- E2E completo: 32 de 32 (rodado sozinho)
- CI na master: verde (run 42195530623 em b63fd82). Deploy do staging concluído (`./scripts/deploy-staging.sh`, sem migration)

## Verificação no staging (somente leitura, usuário de auditoria, celular Pixel 7)

`audit/ux-agenda-celular-staging.audit.ts` com o guard de mutação (nada bloqueado; o diálogo foi fechado com "Cancelar"): "Filtros" com texto e 44 px; avatar da barra com 44 px e nome curto ("Jessica S."); "Todos" e o profissional do painel com 44 px; corpo do formulário com 677 px de 839 px e 412 px de largura; aviso visível e escondido no fim; Hora, Duração e "Adicionar serviço" à vista depois de rolar. O usuário de auditoria só enxerga a própria agenda, então a barra mostrou 1 avatar; o caso com vários profissionais foi coberto no E2E local. Capturas em `05-audit-evidence/mobile/05-10-*.png` (fora do git, como as demais evidências).

## Deviations from Plan

- [Rule 1 - Bug] O formulário "em tela cheia" ainda tinha 24 px de margem interna no celular: o `cn()` não reconhece os espaçamentos do tema, mantém `p-lg` (base do `DialogContent`) junto com `p-0` e o `p-lg` vence. Corrigido só no celular com `max-sm:p-0 max-sm:border-0`, mais uma checagem de largura no E2E. A correção de causa no `cn()` mudaria todos os diálogos no computador; ficou registrada em `deferred-items.md` para aprovação.
- [Rule 1 - Bug] O aria-label original dos avatares ("{nome} — visível") duplicaria o do painel de filtros e quebraria o `equipe-cadastro-e-convite.spec.ts` (modo estrito). Os avatares da barra usam "Agenda de {nome}" com `aria-pressed`.
- Dentro do UX-02 ("cerca de 20 alvos menores que 44 px"), também subi para 44 px no celular as setas de dia/semana e o botão de mostrar/ocultar profissionais, que estavam com 32 px.
- O aviso de rolagem também é remedido quando o conteúdo muda (adicionar serviço, pacote, cadastro rápido de cliente, erro), não só no `onScroll`; fica `aria-hidden` e `pointer-events-none` para não atrapalhar o toque em "Adicionar serviço".
- Adicionei a auditoria de staging `ux-agenda-celular-staging.audit.ts` (não prevista), no mesmo padrão do 05-09.

## Known Stubs

Nenhum.

## Self-Check: PASSED
