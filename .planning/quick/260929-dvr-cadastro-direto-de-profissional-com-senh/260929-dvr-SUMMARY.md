---
phase: quick-260929-dvr
plan: 01
subsystem: identity / equipe / agenda
tags: [members, temporary-password, member-categories, rls, graphql, agenda-filter]
requires: [260929-dek]
provides:
  - createMember / resetMemberPassword / professionalsForService (GraphQL)
  - tabela member_categories (FORCE RLS) e colunas phone/pix_key/birth_date em members
  - regra memberServesCategory (backend) e filtro do seletor de profissional na agenda
affects: [/profissionais, agenda (AppointmentModal), createAppointment]
tech-stack:
  added: []
  patterns: [erro-como-dado, SECURITY DEFINER estreita, redacao LGPD por papel]
key-files:
  created:
    - apps/backend/prisma/migrations/20260929120000_member_contact_and_categories/migration.sql
    - apps/backend/src/auth/temporary-password.ts
    - apps/backend/src/identity/member-contact.ts
    - apps/backend/src/identity/member-categories.ts
    - apps/backend/test/integration/members-create.e2e.spec.ts
    - apps/backend/test/integration/professional-categories.e2e.spec.ts
    - apps/frontend/src/features/identity/components/CreateMemberDialog.tsx
    - apps/frontend/src/features/identity/components/ResetMemberPasswordDialog.tsx
    - apps/frontend/src/features/identity/components/MemberCategoriesField.tsx
    - apps/frontend/src/features/identity/components/TemporaryPasswordBox.tsx
    - apps/frontend/src/features/operations/professional-filter.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/identity/members.service.ts
    - apps/backend/src/identity/members.resolver.ts
    - apps/backend/src/appointments/appointments.service.ts
    - apps/backend/src/graphql/schema/identity.graphql
    - apps/frontend/src/pages/ProfissionaisPage.tsx
    - apps/frontend/src/features/identity/components/MemberEditDialog.tsx
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx
decisions:
  - "Senha provisoria nunca volta no payload de createMember; o frontend exibe a que ele mesmo enviou, uma unica vez"
  - "E-mail com conta existente cria so o member (senha e mustChangePassword intocados) e devolve warning"
  - "Reset de senha so para user que pertence a uma unica organizacao (funcao SECURITY DEFINER member_user_org_count)"
  - "Vinculo com categoria apagada (soft delete) nao conta; sem vinculos validos o profissional atende tudo"
  - "Edicao: phone/Pix so sao obrigatorios se o membro ja os tinha ou se o usuario digitou algo (legados com null continuam editaveis)"
metrics:
  tasks: 3
  completed: 2026-09-29
---

# Quick 260929-dvr: Cadastro direto de profissional com senha provisoria, categorias e filtro na agenda

Substitui o convite por e-mail (sem servico de e-mail) por cadastro direto com senha provisoria gerada no navegador, vincula profissionais as categorias que atendem e filtra o seletor de profissional da agenda pela categoria do servico, com validacao tambem no backend.

## Commits

| Task | Commit | Descricao |
| ---- | ------ | --------- |
| 1 | 17fc74e | Backend: migration aditiva, createMember, resetMemberPassword, updateMember estendido, redacao LGPD |
| 2 | 5ca9485 | Frontend: CreateMemberDialog, ResetMemberPasswordDialog, edicao estendida, lista com telefone e categorias |
| 3 | 1da3b73 | Agenda: professionalsForService, PROFESSIONAL_DOES_NOT_SERVE_CATEGORY, filtro do seletor |

Branch do worktree: `worktree-agent-a7b9b58423bdf09c9`.

## Gate por commit (todos verdes antes de cada commit)

- Task 1: backend lint/typecheck OK, unit 37/37, integracao 141/141 (13 suites); frontend lint/typecheck OK, vitest 120/120.
- Task 2: backend igual (sem mudanca); frontend lint/typecheck OK, vitest 156/156 (17 arquivos).
- Task 3: backend lint/typecheck OK, unit 44/44 (5 suites), integracao 145/145 (14 suites); frontend lint/typecheck OK, vitest 163/163 (18 arquivos).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MembersService ganhou dependencias no construtor**
- **Found during:** Task 1
- **Issue:** `create`/`resetPassword` precisam de PrismaService (lookup de user antes do hash) e PasswordService; a suite `members.e2e.spec.ts` instancia `new MembersService(tenantCtx)` direto (o typecheck nao cobre `test/`).
- **Fix:** atualizei os dois `new MembersService(...)` do teste para passar PrismaService e PasswordService.
- **Files modified:** apps/backend/test/integration/members.e2e.spec.ts
- **Commit:** 17fc74e

**2. [Rule 2 - Missing critical] Vinculo com categoria soft-deletada**
- **Found during:** Task 3
- **Issue:** um profissional vinculado apenas a categoria apagada deixaria de atender qualquer servico.
- **Fix:** vinculos com categoria `deletedAt != null` sao ignorados em `professionalServesCategory` e em `listProfessionalsForService` (sem vinculos validos = atende tudo). A hierarquia de pais continua incluindo categorias apagadas.
- **Commit:** 1da3b73

**3. [Extra file] TemporaryPasswordBox.tsx**
- Componente compartilhado (exibir senha + copiar + aviso de exibicao unica) usado pelo cadastro e pelo reset; nao estava na lista de arquivos do plano.

### Notas do plan-checker aplicadas

- MemberEditDialog: phone/Pix nao bloqueiam a edicao de membros legados com null (obrigatorios so se o valor original era nao-nulo; se digitado, precisa ser valido). Coberto por teste.
- MEMBER_ALREADY_EXISTS menciona que a pessoa pode estar inativa ou removida neste salao.
- Task 1 ficou em um unico commit (contexto suficiente), com o gate completo verde.

### Escolhas de implementacao

- `createMember` valida senha (8 a 128, WEAK_PASSWORD) somente quando o user e novo; para conta existente a senha enviada e ignorada.
- `birthDate` trafega como DateTime ISO (`YYYY-MM-DDT00:00:00.000Z`) por causa do escalar DateTime existente; o front usa `slice(0,10)`.
- `InviteMemberDialog`, InviteMemberMutation, PendingInvitationsQuery e backend de convite permanecem no codigo (so saem da UI), conforme CONTEXT.

## Known Stubs

Nenhum.

## Verificacao manual sugerida (staging/dev, nao feita aqui)

1. /profissionais como ADMIN: Cadastrar profissional (papel Profissional, categorias, Gerar senha) -> senha exibida uma vez com Copiar.
2. Login com a senha provisoria -> cai em /trocar-senha -> apos trocar, /dashboard do salao.
3. Cadastrar com e-mail que ja tem conta em outro salao -> aviso, sem senha.
4. Menu de acoes (ADMIN) -> Gerar nova senha provisoria (recusado se a pessoa for de outro salao).
5. MANAGER: ve Cadastrar, nao ve ADMIN nas opcoes, nao ve o menu de acoes.
6. Agenda: escolher servico e conferir que o seletor lista so quem atende a categoria; trocar de servico limpa profissional que nao atende.
7. Editar um membro antigo (sem telefone/Pix) e salvar sem preencher.
8. Migration aplicada localmente (sgs_dev); aplicar no staging com o fluxo normal de deploy (aditiva: 3 colunas nullable, 1 tabela, 1 funcao).

## Self-Check: PASSED

- Arquivos criados verificados no disco e commits 17fc74e, 5ca9485, 1da3b73 presentes no historico do worktree.
