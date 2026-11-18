# Quick 261118-gpm — Gerente edita, desativa e exclui profissionais (resumo)

**Data:** 2026-11-18

## Problema
A usuária entra como Gerente e, na tela Profissionais, só conseguia incluir: o menu "⋯" (editar, redefinir senha,
desativar, excluir) era exclusivo do Admin, no frontend e no backend. Decisão dela: Gerente igual ao Admin.

## O que mudou
- **Backend** `permissions.catalog.ts`: MANAGER ganha `member.remove` e `member.editRole`. Como as permissões dos
  papéis de sistema vivem no banco, nova migração `20261123000000_manager_manages_team` insere as duas em
  `role_permissions` (aplicada no sgs_dev).
- **Backend** `members.service.ts`: removido o bloqueio "Gerentes não podem cadastrar administradores" (único
  tratamento diferenciado de MANAGER). Mantidos LAST_ADMIN, não excluir a si mesmo, dono da organização e bloqueios
  por atendimento futuro/comanda aberta. `purge_member` não checa papel, então não precisou mudar.
- **Frontend** `team-permissions.ts`: `MANAGE_ROLES = ['ADMIN', 'MANAGER']`. `CreateMemberDialog` não filtra mais
  "Admin" para Gerente. Coluna de ações de Profissionais fixa à direita (`sticky right-0`), alcançável em 390 px.

## Testes
- Unit: novo `team-permissions.spec.ts` (ADMIN/MANAGER têm as permissões; ATTENDANT/PROFESSIONAL não).
- Integração: Gerente cria Admin, edita e troca papel para Admin, redefine senha, desativa, reativa; Profissional
  continua FORBIDDEN; Gerente exclui definitivamente e Atendente não; LAST_ADMIN segue valendo
  (members-create, members-lifecycle, hard-delete-member-bridal).
- Vitest: Gerente vê Editar, Gerar nova senha, Desativar e Excluir definitivamente; Atendente/Profissional não;
  Gerente vê "Admin" no cadastro. Lint e tsc de backend e frontend ok.

## Observações
- A migração precisa rodar no deploy (`prisma migrate deploy`), senão o Gerente continua sem as permissões no banco.
- Verificação visual em 390 px não feita no navegador; a coluna fixa segue o `className` suportado pelo DataTable.
