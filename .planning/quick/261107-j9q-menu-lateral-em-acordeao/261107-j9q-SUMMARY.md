---
phase: quick-261107-j9q
plan: 01
status: complete
completed: 2026-11-07
---

# Menu lateral em acordeão — resumo

Ao abrir um menu com submenus, o irmão que estava aberto fecha — no menu lateral do computador
(`SidebarNav`) e na gaveta do celular (`AppDrawer`), em todos os níveis.

## O que mudou
- `use-menu-accordion.ts`: `useMenuAccordion(items, fallbackId?)` guarda o único menu aberto de
  cada lista de irmãos; `temRotaAtiva` saiu do SidebarNav para cá; `contemAvisoEstoque` acha o
  aviso de estoque baixo num descendente.
- Estado de aberto/fechado subiu do item para a lista (`SidebarList` / `DrawerList`).
- Abertura inicial: só o ramo da rota atual. No computador, fora de qualquer ramo (Início), todos
  os grupos nascem fechados (antes os de nível 0 nasciam todos abertos). Na gaveta continua o
  fallback "Meu Estabelecimento".
- Rota que muda para outro ramo (link dentro da página) abre esse ramo e fecha o anterior.
- Menu fechado mostra o aviso de estoque baixo de um descendente (Produtos), para o alerta não
  sumir quando "Meu Estabelecimento" está recolhido.

## Testes
- Novo `menu-acordeao.test.tsx` (7 casos: irmãos de nível 0 e de submenu, fechar o aberto, ramo
  da rota, troca de rota, aviso de estoque, gaveta).
- `casco-gestor-beauty.test.tsx`: no Início "Agenda" agora nasce fechado.
- Helper E2E `navigateViaMenu` já abria o grupo só quando fechado; só o comentário mudou.
