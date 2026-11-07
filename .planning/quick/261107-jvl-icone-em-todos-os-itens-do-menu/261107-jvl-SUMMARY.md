---
phase: quick-261107-jvl
plan: 01
status: complete
completed: 2026-11-07
---

# Ícone em todos os itens do menu — resumo

- 39 folhas ganharam ícone (ex.: Minha agenda CalendarCheck, Aniversariantes Cake, rankings Trophy,
  "Todos os…" List, Previsão de caixa TrendingUp, cada item do Financeiro com ícone próprio).
- `MenuItem.icon` agora é obrigatório.
- Grupos do topo do menu lateral mostram o ícone que já existia na configuração.
- Ativo de subitem decidido pelo nível (`level >= 1`) no SidebarNav e no AppDrawer; o visual
  D-26 não muda.
- Comissões calculadas: Percent (antes repetia BadgeDollarSign de Pagamento de Profissionais).

## Verificação
- lint, tsc e vitest do frontend (682 testes) verdes; novo teste confere ícone em cada item.
- Suíte E2E completa verde (41/41).
- Evidências: `evidencias/menu-financeiro.png`, `evidencias/menu-estabelecimento.png`.
