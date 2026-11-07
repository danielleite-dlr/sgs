---
phase: quick-261107-k9c
plan: 01
status: complete
completed: 2026-11-07
---

# Agenda como item direto no menu — resumo

- `menu-config.ts`: Agenda virou link direto para /agenda (ícone CalendarDays), sem submenu.
  "Consultar agendamentos" saiu do menu (estava desligado pela flag `agendaRelatorio`, sem tela);
  a flag continua em `config/features.ts`.
- Testes do acordeão e do casco usam outros grupos; novo teste da Agenda como link ativo.
- E2E navegam por `navigateViaMenu(page, 'Agenda')`.

## Verificação
- lint, tsc e vitest do frontend (683) verdes; suíte E2E completa verde.
