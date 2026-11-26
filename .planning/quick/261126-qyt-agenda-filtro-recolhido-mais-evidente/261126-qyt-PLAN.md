---
quick_id: 261126-qyt
type: quick
files_modified:
  - apps/frontend/src/features/operations/pages/SchedulePage.tsx
  - apps/frontend/src/features/operations/__tests__/agenda-gestor-beauty.test.tsx
---

# Quick 261126-qyt: Filtro recolhido da agenda mais evidente

Pedido (26/11): com o menu de filtros recolhido por padrão (quick 261126-f22), o botão que o
mostra — uma setinha cinza de 24×32 px ao lado da grade — passa despercebido.

## Tarefa 1 — faixa "Filtros" quando recolhido
- Recolhido (desktop, `lg`): faixa vertical encostada na grade, altura de conteúdo, com ícone
  `SlidersHorizontal`, o texto "Filtros" em pé e tom primário (`bg-primary-50`, texto `primary`,
  borda `primary-200`; hover `primary-100`).
- Contador de filtros ativos em selo roxo: profissionais ocultos, status desmarcados, fechamento
  diferente de "todos" e folga oculta (cada um conta 1). Some quando não há filtro.
- `aria-label` continua "Mostrar filtros" / "Ocultar filtros"; com filtro ativo o título diz quantos.
- Aberto: mantém a seta atual.
- O botão "Filtros" do mobile ganha o mesmo selo.
- verify: teste em `agenda-gestor-beauty.test.tsx` (texto "Filtros" visível recolhido; selo aparece
  ao desmarcar um status) + gate do front (typecheck, lint, vitest).
