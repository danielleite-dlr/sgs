---
phase: quick-261107-jvl
plan: 01
type: execute
autonomous: true
files_modified:
  - apps/frontend/src/components/layout/menu-config.ts
  - apps/frontend/src/components/layout/SidebarNav.tsx
  - apps/frontend/src/components/layout/AppDrawer.tsx
  - apps/frontend/src/components/layout/__tests__/menu-acordeao.test.tsx
  - apps/frontend/src/components/layout/__tests__/casco-gestor-beauty.test.tsx
must_haves:
  truths:
    - "Todo item do menu (grupos do topo, submenus e folhas) mostra um ícone, no computador e na gaveta"
    - "`icon` é obrigatório em MenuItem — item novo sem ícone não compila"
    - "Ativo continua D-26: Início lilás claro; folha dentro de grupo roxo com texto branco"
---

# Ícone em todos os itens do menu
1. menu-config: ícone lucide para cada folha sem ícone; `icon` obrigatório; Comissões calculadas
   troca o ícone repetido de Pagamento de Profissionais por Percent.
2. SidebarNav: grupo do topo mostra o ícone (h-4) antes do rótulo. Subitem passa a ser decidido
   pelo nível (folha dentro de grupo), não pela falta de ícone; o mesmo na gaveta.
3. Teste que abre cada ramo e confere um svg em cada link/botão do menu.
