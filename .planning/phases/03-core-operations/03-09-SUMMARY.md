---
phase: 03-core-operations
plan: 09
subsystem: frontend-financeiro
tags: [financeiro, recharts, comissoes, credito-cliente, period-filter, feature-flags]
requires: [03-02, 03-05]
provides:
  - "features/operations/api/financial.api.ts (queries/mutation e interfaces manuais do financeiro e do crédito)"
  - "PeriodFilter + lib/period-value.ts (PeriodValue, defaultPeriod)"
  - "FinanceiroPage real (Faturado x Recebido, gráfico, recebido por método, lançamentos)"
  - "ComissoesCalculadasPage real (totais por profissional, registros, aviso D-24)"
  - "CreditoClientePage real (saldos, histórico, ajuste manual)"
  - "Flags financeiro, financeiroComissoes e financeiroCreditoCliente = true"
affects: [03-11, 03-12]
tech-stack:
  added: []
  patterns: ["PeriodFilter controlado com to exclusivo", "totais sempre do backend, sem somar no cliente"]
key-files:
  created:
    - apps/frontend/src/features/operations/api/financial.api.ts
    - apps/frontend/src/features/operations/components/PeriodFilter.tsx
    - apps/frontend/src/features/operations/lib/period-value.ts
    - apps/frontend/src/features/operations/pages/CreditoClientePage.tsx
    - apps/frontend/src/features/operations/__tests__/period-filter.test.tsx
    - apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx
    - apps/frontend/src/features/operations/__tests__/comissoes-page.test.tsx
    - apps/frontend/src/features/operations/__tests__/credito-cliente-page.test.tsx
  modified:
    - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
    - apps/frontend/src/features/operations/pages/ComissoesCalculadasPage.tsx
    - apps/frontend/src/features/operations/pages/FinancialSubPages.tsx
    - apps/frontend/src/config/features.ts
    - apps/frontend/src/router.tsx
    - apps/frontend/src/components/layout/menu-config.ts
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  deleted:
    - apps/frontend/src/features/operations/mocks/financeiro.mock.ts
key-decisions:
  - "defaultPeriod/PeriodValue ficam em lib/period-value.ts (regra react-refresh/only-export-components do lint impede exportar função junto do componente)"
  - "Texto 'Sem regra: N' montado por concatenação, sem interpolação do i18next (os testes rodam sem instância i18n)"
requirements-completed: [FIN-01]
duration: ~45min
completed: 2026-11-02
---

# Phase 3 Plan 09: Frontend do financeiro Summary

Dashboard `/financeiro` com Faturado x Recebido (D-22) por dia/semana/mês e por método, comissões calculadas por profissional com aviso de itens sem regra (D-24) e crédito de cliente com ajuste manual, todos lendo dado real, com as flags ligadas nos mesmos commits.

## Tasks

1. financial.api.ts, PeriodFilter e FinanceiroPage real (flag `financeiro`) - `4b8f528`
2. ComissoesCalculadasPage real, mock removido, item de menu (flag `financeiroComissoes`) - `4cd2b29`
3. CreditoClientePage real com flag própria `financeiroCreditoCliente` - `7bde729`

## Testes

- Frontend vitest: 262 (34 arquivos; +11 novos: period-filter 4, financeiro-page 2, comissoes-page 2, credito-cliente 3)
- Backend unit: 107; integração: 266 (inalterados, verdes)
- lint e typecheck verdes; Playwright E2E existente: 8 passed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] Testes existentes assumiam /financeiro e /financeiro/comissoes desligados**
- `router.test.tsx` e `features.test.ts` listavam essas rotas como mockadas; atualizados (agora `/financeiro/caixa` representa o mock e as rotas reais entram na lista de liberadas).

**2. [Rule 3 - Bloqueio] `@testing-library/user-event` não está instalado**
- Testes usam `fireEvent`.

**3. [Rule 3 - Lint] `defaultPeriod` exportado junto do componente**
- Movido para `lib/period-value.ts` (o plano previa em PeriodFilter.tsx). PeriodFilter só exporta o componente.

**4. Escolha de UI no crédito**
- A busca de cliente do diálogo é um campo de texto + lista de botões (não um Select), por acessibilidade e testabilidade; o filtro decorativo de datas foi trocado por filtro por nome do cliente (client-side).

## Known Stubs

None. As 9 sub-páginas restantes de `FinancialSubPages.tsx` seguem mockadas e atrás de `financeiroRelatorios: false` (fora do escopo).

## Requisitos

- **FIN-01 fechado** (dashboard com receita por dia/semana/mês e breakdown por método, ponta a ponta).
- **FIN-02 segue Pending**: a leitura de comissões está pronta, mas o cálculo ao fechar comanda só é acionável pela UI com a tela de comanda (03-11).
- **POS-02 segue Pending**: pagamento multi-método e uso de crédito na comanda dependem da UI do PDV (03-11); aqui só o ajuste manual do crédito.

## Notas para os próximos planos

- **Contrato de seletores (03-12):** chips `period-preset-{today|yesterday|thisWeek|thisMonth|lastMonth|custom}`, campos `period-custom-from`/`period-custom-to`, botão `period-custom-apply`; `granularity-{day|week|month}`; KPIs `kpi-billed`, `kpi-received`, `kpi-closed-comandas`, `kpi-average-ticket`, `kpi-commissions` (texto "R$ 285,00"; comandas fechadas é número puro); tabela `received-by-method` com linhas `received-method-{method}`; `financial-chart`; `cash-movements`. Comissões: `commission-member-select`, `commission-no-rule-banner`, `commission-totals`, `commission-total-{memberId}`, `commission-records`, `commission-record-{id}`. Crédito: `credit-balances`, `credit-row-{clientId}`, `credit-history`, `credit-selected-client`; diálogo com labels "Cliente", "Adicionar"/"Remover", "Valor (R$)", "Motivo", botão "Salvar".
- O gráfico usa `ResponsiveContainer` (altura 280); em jsdom ele não renderiza barras (largura 0), então testes unitários não conferem o SVG. O E2E real renderiza normalmente.
- `PeriodFilter` é controlado: `value {preset, from, to}` com `to` exclusivo; reutilizável em outros relatórios via `defaultPeriod()` de `lib/period-value`.
- O link de número da comanda na tabela de comissões só aparece com `isPathEnabled('/comanda')`; ligue a flag `comanda` no 03-11 e o link passa a funcionar sem mexer aqui.
- Para PROFESSIONAL o seletor de profissional não aparece e os registros carregam direto (o backend força o filtro).
- Quem tem `credit.read` mas não `credit.adjust` (ATTENDANT) vê saldos e histórico sem o botão "Incluir Crédito". O ajuste manual não gera movimento de caixa (decisão do 03-05).
- Item de menu "Comissões calculadas" adicionado ao grupo Financeiro (`fin-comissoes`).
- O texto `Sem regra: N` é montado sem interpolação do i18next (testes não inicializam i18n); siga o mesmo padrão em testes novos ou inicialize o i18n no teste.

## Self-Check: PASSED
