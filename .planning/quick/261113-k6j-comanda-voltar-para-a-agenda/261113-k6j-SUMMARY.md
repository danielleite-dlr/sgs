# Quick 261113-k6j: Comanda - Voltar para a agenda Summary

Botao "Voltar para a agenda" na comanda, que volta ao mesmo dia e visao (dia/semana) da agenda, via query string (`?agenda=&visao=` na comanda, `?data=&visao=` na agenda).

## Commits
- 2205cd8 feat(comanda): helper de links agenda <-> comanda (agenda-link.ts + 12 testes)
- 370deb7 feat(comanda): botao Voltar para a agenda (dialog, SchedulePage, ComandaPage + testes)
- E2E commit: test(e2e) fluxo agenda -> comanda -> voltar

## Resultados
- Gate frontend: eslint 0 warnings, tsc ok, vitest 105 arquivos / 770 testes passando.
- E2E fluxo-agendamento-comanda-pagamento: 2 passed (inclui o setup).

## Deviations from Plan
- Teste existente do dialog que esperava href `/comanda/cm1` foi atualizado para a nova query (consequencia direta da mudanca).
- O ciclo RED do Task 1 nao foi executado separadamente (teste e helper escritos juntos; testes passam).
- Sem uso de `hidden sm:inline`: o container do cta do PageHeader ja tem flex-wrap, entao o texto fica visivel.
- Card do agendamento concluido apareceu na agenda; o assert planejado foi mantido.

## Self-Check: PASSED
