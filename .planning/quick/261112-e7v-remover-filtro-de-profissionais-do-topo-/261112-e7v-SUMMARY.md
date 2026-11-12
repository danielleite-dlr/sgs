---
quick_id: 261112-e7v
status: complete
commit: 90ecb59
date: 2026-11-12
---

# 261112-e7v — Agenda: filtro de profissionais saiu do topo

## O que mudou
- A barra do topo da agenda não mostra mais o botão olho nem os chips de profissionais ("Agenda de …",
  "+N"). Com o menu da agenda recolhido também não aparece mais a linha de profissionais na largura toda.
- O filtro continua no menu lateral da agenda ("Nome do profissional" e "Seleção de Profissionais") e,
  no celular, em "Filtros". As colunas seguem ordenadas por quem tem atendimento no período.

## Testes
- Unitários ajustados: `agenda-noivas-largura` (sem `prof-avatars` com o menu aberto ou recolhido),
  `agenda-gestor-beauty` (barra sem botões de profissionais) e `schedule-permissions` (papel checado pelo
  filtro lateral `Nome — visível`, já que antes usava o `title` dos chips).
- E2E `ux-agenda-celular` e auditoria do staging: `prof-avatars` com contagem 0.

## Gate
lint 0 · tsc 0 · vitest 742 testes (operações 291/291 depois do ajuste de permissões) · E2E da agenda 5/5.
