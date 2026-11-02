---
phase: 03-core-operations
plan: 11
subsystem: frontend-comanda
tags: [apollo, pos, comanda, pagamento-dividido, comissoes, d-24, a11y]
requires: [03-02, 03-04, 03-07, 03-09, 03-10]
provides:
  - "comandas.api.ts: fragmento ComandaFields, ComandaQuery, ComandasQuery e 8 mutações"
  - "PaymentPanel: pagamento dividido com Total/Pago/Falta/Troco em tempo real e atalho do crédito do cliente"
  - "ComandaPage real (itens, pacote, fechar, comissões geradas com aviso D-24, reabrir com motivo)"
  - "ComandaListPage (/comanda) com período Hoje + status e WalkInDialog (D-06)"
  - "Flag comanda: true; mock removido; menu aponta para /comanda"
affects: [03-12]
tech-stack:
  added: []
  patterns:
    - "Diálogos com estado interno em subcomponente de formulário (Dialog desmonta o conteúdo ao fechar, estado zera sem useEffect)"
    - "Preview do PaymentPanel só inclui a linha digitada quando a pessoa editou (flag dirty); senão mostra o estado persistido"
    - "Mutações devolvem o fragmento ComandaFields completo: o cache do Apollo normaliza por id e a tela atualiza sem refetch"
key-files:
  created:
    - apps/frontend/src/features/operations/api/comandas.api.ts
    - apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx
    - apps/frontend/src/features/operations/components/comanda/AddItemDialog.tsx
    - apps/frontend/src/features/operations/components/comanda/ReopenComandaDialog.tsx
    - apps/frontend/src/features/operations/components/comanda/WalkInDialog.tsx
    - apps/frontend/src/features/operations/pages/ComandaListPage.tsx
    - apps/frontend/src/features/operations/__tests__/comanda-fixtures.ts
    - apps/frontend/src/features/operations/__tests__/payment-panel.test.tsx
    - apps/frontend/src/features/operations/__tests__/comanda-page.test.tsx
    - apps/frontend/src/features/operations/__tests__/walk-in-dialog.test.tsx
  modified:
    - apps/frontend/src/features/operations/pages/ComandaPage.tsx
    - apps/frontend/src/config/features.ts
    - apps/frontend/src/router.tsx
    - apps/frontend/src/components/layout/menu-config.ts
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
    - apps/frontend/src/__tests__/router.test.tsx
    - apps/frontend/src/config/__tests__/features.test.ts
  removed:
    - apps/frontend/src/features/operations/mocks/comanda.mock.ts
key-decisions:
  - "Walk-in com cliente novo envia o telefone mascarado como o ClientForm da Fase 2 (o backend só limita a 30 caracteres)"
  - "Forma 'Crédito do cliente' só aparece no seletor se o cliente tem saldo (ou já há linha de crédito)"
  - "Seções de comissão mostram apenas accruals do ciclo atual; estornos aparecem só no histórico do backend"
requirements-completed: [POS-01, POS-02, POS-03, FIN-02]
duration: ~110min
completed: 2026-11-02
---

# Phase 3 Plan 11: Frontend da Comanda Summary

POS real no frontend: lista de comandas com walk-in, tela da comanda com itens (serviço, produto, pacote), pagamento dividido com falta/troco e sugestão do crédito/sinal, fechamento com comissões exibidas (aviso D-24) e reabertura com motivo; flag `comanda` ligada e mock removido no mesmo commit.

## Tarefas e commits

1. comandas.api.ts + PaymentPanel (6 testes) - `2caac88`
2. ComandaPage real + AddItemDialog + ReopenComandaDialog + chaves i18n (4 testes) - `179894f`
3. ComandaListPage + WalkInDialog + rota/menu/flag + remoção do mock (3 testes) - `5dd0312`

## Testes

- Frontend vitest: 292 (41 arquivos); eram 280 antes do plano (+6 payment-panel, +4 comanda-page, +3 walk-in; os testes de router/features foram ajustados, não somados)
- Backend não foi alterado; unit e integração rodaram no gate de cada commit e ficaram verdes
- lint, typecheck e `build` do frontend verdes; Playwright E2E existente: 8 passed
- Gate completo (lint, typecheck, backend unit, integração, vitest) rodado antes de cada um dos 3 commits

## Deviations from Plan

- **[Rule 3] Fixture compartilhada:** `makeComanda` ficou em `__tests__/comanda-fixtures.ts` (não é arquivo `.test`), reaproveitada por payment-panel, comanda-page e walk-in.
- **[Rule 3] Sem `@testing-library/user-event`:** testes usam `fireEvent` (igual 03-09).
- **[Rule 3] Lint:** `useCredit` foi renomeado `applyCredit` (a regra de hooks tratava o nome como hook).
- **[Rule 3] router.test.tsx e features.test.ts** atualizados: `/comanda/abc` saiu da lista de rotas mockadas; `/comanda` e `/comanda/:id` entram nas liberadas.
- **Escolha de UI:** busca de cliente do walk-in é texto + botões (padrão do 03-09); selects são `<select>` nativos (padrão do VisitFormDialog).
- **Seletor `comanda-code`** está no card Cliente (o `PageHeader` não aceita testid no título, que também mostra o código).
- Verificação manual no navegador não foi feita neste executor; fica para o E2E do 03-12.

## Requisitos

- **POS-01, POS-03** concluídos ponta a ponta (abrir walk-in, lançar itens, dividir pagamento, fechar).
- **POS-02** concluído com a redução de escopo já aceita (Pix por registro manual, sem voucher); crédito do cliente incluído e sugerido na tela.
- **FIN-02** concluído: fechar na UI dispara o cálculo síncrono no backend (03-07) e a tela mostra as comissões geradas e o aviso D-24; a leitura em relatório veio no 03-09.

## Known Stubs

None.

## Notas para os próximos planos

- **Contrato de seletores (03-12, não renomear):**
  - PaymentPanel: `payment-panel`, `payment-total`, `payment-paid`, `payment-remaining`, `payment-change` (texto "R$ 0,00"), `payment-method-select` (select nativo; valores `cash|pix|credit_card|debit_card|transfer|client_credit`), `payment-amount` (máscara em centavos: digitar `5000` vira `50,00`; vem pré-preenchido com a falta), `payment-add`, `payment-use-credit`, `payment-row-${paymentId}`, `payment-error`, `comanda-close`.
  - ComandaPage: `comanda-code`, `comanda-status` ("Aberta"/"Fechada"), `comanda-add-service`, `comanda-add-product`, `comanda-add-package`, `comanda-item-${itemId}`, `comanda-commissions`, `comanda-commission-warning`, `comanda-reopen`, `comanda-client-credit`. Botão de remover item: `aria-label="Remover <nome do item>"`.
  - AddItemDialog: `add-item-service`, `add-item-variant` (só se o serviço tem variantes), `add-item-product`, `add-item-professional` (profissional no serviço, vendedor no produto), `add-item-quantity`, `add-item-submit`, `add-item-error`, `add-item-stock-warning`; pacote: `add-item-package` e `add-item-package-pro-${serviceId}`.
  - ReopenComandaDialog: `reopen-reason`, `reopen-submit`, `reopen-error`.
  - Lista/WalkIn: `comanda-new`, `comanda-list`, `comanda-row-${id}`, `comanda-list-empty`, `comanda-status-filter-{all|open|closed|cancelled}`; `walkin-mode-existing`, `walkin-mode-new`, `walkin-client-search`, `walkin-client-option-${id}`, `walkin-name`, `walkin-phone`, `walkin-submit`, `walkin-error`.
- Escolher um serviço/produto/profissional/pacote no E2E é `selectOption` pelo texto ou valor do `<select>` nativo. Opções de serviço têm texto "Nome — R$ 80,00".
- Fechar a comanda mostra o toast "Comanda C-AAAA-NNN fechada." e a seção "Comissões geradas" aparece na mesma tela (sem navegação). Reabrir faz a seção sumir e o painel voltar a editar.
- A seção de comissões só aparece com `status === 'closed'`; o botão "Reabrir comanda" fica no cabeçalho (`PageHeader.cta`) só para `comanda.reopen`.
- Com a flag ligada, `appointment-open-comanda` (03-10) e o link do número da comanda na tela de comissões (03-09) passam a funcionar sem outras mudanças.
- PROFESSIONAL não tem `comanda.write` no catálogo atual: vê a lista e a comanda (só as dele) sem botões de edição/pagamento.
- `PageHeader` gera aviso de `<li>` aninhado nos testes (pré-existente, só warning de console).

## Self-Check: PASSED
