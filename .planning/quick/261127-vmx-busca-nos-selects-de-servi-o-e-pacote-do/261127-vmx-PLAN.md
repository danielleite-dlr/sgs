---
quick_id: 261127-vmx
type: quick
---

# Busca nos selects de Serviço e Pacote do agendamento (ajuste da fase 12)

Pedidos da usuária em 27/11:
1. No modal "Cadastrar agendamento", ao abrir o select de Serviço ou de Pacote da linha, ter campo de busca para achar o serviço/pacote.
2. No menu da agenda, o nome do estabelecimento ganha ícone e fica em caixa alta.

## Tarefas
1. `components/ui/searchable-select.tsx`: botão com o visual do select nativo, Popover + cmdk com busca; filtro em `lib/search-text.ts` (sem acento, sem maiúscula, todas as palavras em qualquer ordem). testIds: botão `${testId}` com `data-value`, busca `${testId}-search`, opção `${testId}-option-${value}`.
2. `VisitFormDialog.tsx`: `visit-line-N-service` e `visit-line-N-package` passam a usar o SearchableSelect (variante de preço continua select nativo).
3. `SidebarNav.tsx`: `sidebar-org` com ícone `Store` e `uppercase` (CSS, o texto continua como cadastrado).
4. Testes: unitário do componente; ajustes em visit-form-package, visit-form-prefill, novo-agendamento-gestor-beauty, casco-gestor-beauty; E2E com `pickSearchable` em support/agenda-ui.ts.
