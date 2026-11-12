---
quick_id: 261112-cko
status: complete
commit: a698fe7
date: 2026-11-12
---

# 261112-cko — Agenda: noivas, profissionais na largura toda, rolagem e menu recolhível

## O que mudou
- **Backend:** `Appointment` ganhou `bridalGroupId`, `bridalGroupName`, `bridalEventKind` e `bridalRole`
  (papel da cliente no grupo: `bride`/`companion`). O include traz `bridalGroup { id name eventKind members }`.
- **Filtro por noiva:** quando o período tem atendimento ligado a grupo, aparece a faixa "Noivas do dia"
  (ou "da semana") com "Todas" e um botão por grupo, mostrando quantas clientes (noiva + acompanhantes).
  Selecionado, mostra só os atendimentos do grupo e só as colunas das profissionais envolvidas. Ao trocar
  de dia o filtro se desfaz sozinho.
- **Ordem das profissionais:** quem tem atendimento no período vem primeiro (botões e colunas), mantendo a
  ordem original dentro de cada bloco; o botão mostra a quantidade.
- **Menu da agenda recolhido:** todas as profissionais em linha própria, largura toda, com quebra de linha
  (sem "+N"). O » de reabrir perdeu a margem negativa quando recolhido.
- **Rolagem:** o `overflow-hidden` do contêiner da grade cortava as colunas que não cabiam e quebrava o
  `sticky`. Agora é `overflow-clip` + `minWidth` (64 + n × largura mínima da coluna); cabeçalho
  (z-40) e coluna de horas (sticky left) ficam fixos; `.scrollbar-visible` força a barra clássica.
- **Menu principal:** "Recolher menu" no rodapé; recolhido vira faixa de 64 px com ícones e tooltip, e os grupos
  abrem num Popover ao lado com a mesma árvore. Estado em `localStorage` (`sgs.sidebarCollapsed`).

## Desvio encontrado na verificação visual
O `TooltipTrigger asChild` (Slot do Radix) concatena `className` como texto, e o `NavLink` usava
uma função: os links diretos ficavam sem tamanho e sem destaque. No menu recolhido usamos `Link` com o
ativo calculado pelo `pathname`.

## Testes
- jest unit backend 384 ✓ (novo: serializeAppointment com grupo); integração 609 ✓
- vitest 742 ✓ (novos: schedule-professionals, agenda-noivas-largura, SidebarNav recolhido)
- E2E: agenda-* e ux-agenda-celular ✓; novo `agenda-rolagem-menu.spec.ts` (rolagem nas duas direções,
  cabeçalho fixo, menu recolhido persiste após reload). A espessura da barra não é medida porque o Chromium
  headless roda com --hide-scrollbars.
