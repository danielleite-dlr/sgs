---
quick: 261118-gpm
title: Gerente edita, desativa e exclui profissionais (igual ao Admin)
date: 2026-11-18
autonomous: true
---

# Quick 261118-gpm — Gerente gerencia a equipe como o Admin

## Problema
Usuária (18/11): "se tenho um profissional cadastrado, eu não consigo editá-lo, excluir, só consigo incluir novo".
Ela entra como **Gerente** (MANAGER). Hoje: `apps/frontend/src/features/identity/team-permissions.ts` tem
`MANAGE_ROLES = ['ADMIN']` (menu "⋯" de `pages/ProfissionaisPage.tsx` só para Admin) e no backend
`apps/backend/src/authz/permissions.catalog.ts` só o ADMIN tem `member.remove` e `member.editRole`;
`deleteMemberPermanently` (`apps/backend/src/identity/members.resolver.ts`) é só ADMIN (quick 261112-gei).

## Decisão da usuária
"Gerente: liberar tudo" — o Gerente fica **igual ao Admin** na tela Profissionais: editar (inclusive outros admins),
trocar papel (inclusive para Admin), redefinir senha, desativar/reativar e excluir definitivamente.

## Tarefas
### T1 — Backend
- `permissions.catalog.ts`: MANAGER ganha `member.remove` e `member.editRole`.
- `members.service.ts`: remover o bloqueio `callerRoleName === 'MANAGER' && input.roleName === ADMIN_ROLE_NAME`
  (linha ~418) e qualquer outra checagem que trate MANAGER diferente de ADMIN em editar/desativar/reativar/
  redefinir senha/excluir. **Manter** as proteções que não são de papel: `LAST_ADMIN` (não desativar/rebaixar/excluir
  o último admin ativo), não excluir a si mesmo, dono da organização, bloqueios de exclusão com atendimento
  futuro/comanda aberta.
- `deleteMemberPermanently`: ADMIN e MANAGER. Conferir a função SQL `purge_member` (SECURITY DEFINER) e qualquer
  checagem de papel dentro dela; se ela exige ADMIN, criar migração nova liberando MANAGER.
- Atualizar/estender testes existentes (unit de permissions.catalog e integração de membros / hard delete):
  MANAGER edita, troca papel para ADMIN, desativa, reativa, redefine senha e exclui; ATTENDANT e PROFESSIONAL
  continuam FORBIDDEN; LAST_ADMIN continua valendo.

### T2 — Frontend
- `team-permissions.ts`: `MANAGE_ROLES = ['ADMIN', 'MANAGER']`; atualizar comentário.
- Conferir `ProfissionaisPage.tsx`, o diálogo de edição (seleção de papel) e o de redefinir senha: nada filtrando
  opções para MANAGER (ex.: esconder "Admin" no select de papel quando caller é MANAGER) — remover esse filtro.
- Testes vitest: Gerente vê o menu "⋯" com Editar, Redefinir senha, Desativar e Excluir definitivamente; Atendente não.
- Conferir também no celular: a coluna de ações fica na última coluna da tabela larga; garantir que o botão "⋯"
  seja alcançável em 390 px (rolagem horizontal visível ou coluna de ações fixa à direita). Se não for, ajustar.

## Regras
- Gate antes de commitar: lint + tsc + jest unit + integração (sgs_dev) + vitest; E2E de equipe/profissionais se existir.
- Frontend formatado à mão; nada de `prettier --write` em arquivo existente.
- Não mexer em arquivos do Comercial (fase 9 em paralelo) nem em clientes/comanda/agenda (quick 261118-c360 em paralelo).
