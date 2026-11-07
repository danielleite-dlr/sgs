---
phase: quick-261107-in8
plan: 01
status: complete
completed: 2026-11-07
requirements: [UX-20]
---

# Dashboard operacional no Início — resumo

O Início ganhou a faixa de KPIs do dia (atendimentos, faturado, noivas, ticket médio), os blocos
Próximos atendimentos, Comandas em aberto e Contratos de noivas próximos, com a Previsão de caixa
abaixo. Valores somem sem `financial.read`; KPI de noivas e bloco de contratos somem sem
`contract.read`. Cada bloco tem carregando/vazio/erro próprios. ATTENDANT/PROFESSIONAL seguem
para /agenda (D-11).

## Commits
- 4fcafcf — lib de derivação e query enxuta de contratos
- b56cfb4 — blocos do painel no Início
- E2E `painel-inicio.spec.ts` e evidências (computador e celular) no commit de testes

## Verificação
- vitest do frontend verde (lib + componentes + home-route)
- Suíte E2E completa verde (41/41), incluindo `painel-inicio.spec.ts`
- Evidências: `evidencias/dashboard-computador.png`, `evidencias/dashboard-celular.png`
