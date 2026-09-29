---
phase: quick-260929-dvr
verified: 2026-09-29T00:00:00Z
status: human_needed
score: 9/9 must-haves verified (automatizado); UAT manual pendente
gaps: []
human_verification:
  - test: "Cadastrar profissional na UI (ADMIN) e copiar a senha"
    expected: "Senha pre-gerada, exibida uma unica vez apos salvar, botao Copiar funciona"
    why_human: "Clipboard, layout e fluxo visual"
  - test: "Login do novo usuario -> /trocar-senha -> /dashboard"
    expected: "Redirecionamento correto no navegador (backend provado por integracao)"
    why_human: "Fluxo de navegacao real"
  - test: "Agenda: escolher servico e ver o seletor de profissional filtrado; trocar servico limpa profissional invalido"
    expected: "Filtro e mensagem de vazio corretos"
    why_human: "Comportamento de UI com dados reais"
  - test: "Editar membro legado (sem telefone/Pix) e salvar"
    expected: "Salva sem bloqueio"
    why_human: "UX"
  - test: "Aplicar a migration no staging pelo fluxo normal de deploy"
    expected: "3 colunas nullable, 1 tabela, 1 funcao, sem perda de dados"
    why_human: "Fora do escopo (staging nao tocado)"
---

# Quick 260929-dvr: Verificacao

Status: human_needed (tudo automatizado passou; falta UAT manual).

## Gate na master mesclada (banco local sgs_dev 5433/5434; staging nao tocado)

| Gate | Resultado |
| ---- | --------- |
| prisma migrate deploy (DIRECT_URL local) | Nenhuma migration pendente (10 encontradas, ja aplicadas) |
| backend eslint (max-warnings 0) | OK |
| backend tsc --noEmit | OK |
| backend jest unit | 5 suites, 44/44 |
| backend jest integracao --runInBand | 14 suites, 146/146 |
| frontend eslint | OK |
| frontend tsc | OK |
| frontend vitest | 18 arquivos, 163/163 |
| GraphQL: 60 documentos gql do frontend vs SDL mesclado (escalares JSON, UUID, DateTime, Email) | 60 validos, 0 invalidos |

Observacao de ambiente: pnpm nao esta no PATH; usado node 22.12 + `COREPACK_INTEGRITY_KEYS=0 corepack pnpm`.

## Decisoes do CONTEXT

Todas verificadas no codigo. Os testes de integracao cobrem os comportamentos, por exemplo login com mustChangePassword=true e changePassword em `members-create.e2e.spec.ts:242-263`.

- Cadastro direto: `createMember` em `members.service.ts` (validacoes de telefone/Pix em 377/381, `FORBIDDEN_ROLE` de MANAGER cadastrando ADMIN em 383-389, `CATEGORY_REQUIRED` em 398, `WEAK_PASSWORD` em 415, hash em 420, user novo com `mustChangePassword: true` e `emailVerifiedAt` em 468-469, `existingAccount` em 505, `MEMBER_ALREADY_EXISTS` em 452/515). Senha nao volta no payload.
- Conta existente: senha e flag intocadas, comprovado em `members-create.e2e.spec.ts:326`.
- Reset de senha: `members.service.ts:527-564` (`CANNOT_RESET_SELF`, `MEMBER_IN_OTHER_ORGANIZATION` via `member_user_org_count`, hash, mustChangePassword true, revogacao de refresh tokens). Resolver com `MEMBER_EDIT_ROLE`, e `createMember` com `MEMBER_INVITE` (`members.resolver.ts:56-70`).
- PROFESSIONAL implica isProfessional: backend `members.service.ts:391-392` (create) e `~309-315` (update); UI esconde o checkbox em `CreateMemberDialog.tsx:375` e `MemberEditDialog.tsx:268`.
- Dados pessoais no member: migration `20260929120000_member_contact_and_categories` (aditiva, sem DROP/UPDATE). Tem colunas nullable, `member_categories` com FORCE RLS, FKs CASCADE, grant guardado e a funcao SECURITY DEFINER. Redacao LGPD em `redactPersonal` (`members.service.ts:90`), aplicada em members/allMembers/professionalsForService (`members.resolver.ts:33,40,53`).
- Categorias: hierarquia e fallback sem vinculo em `member-categories.ts` (com visited set e limite de profundidade; vinculo com categoria apagada e ignorado). Update substitui o conjunto e apaga os vinculos se nao for profissional (`members.service.ts:~328-345`).
- Agenda backend: `appointments.service.ts:141-152` recusa com `PROFESSIONAL_DOES_NOT_SERVE_CATEGORY` antes do conflito de horario. Query `professionalsForService` no SDL (`identity.graphql:5`).
- Agenda frontend: `SchedulePage.tsx:861-881,1024` (query com skip, filtro, limpeza da selecao, mensagem de vazio).
- Lista/UI: `ProfissionaisPage.tsx:23-24,51-52,246-253` (CreateMemberDialog e ResetMemberPasswordDialog com gating por canInvite/canManage). Nao ha PendingInvitations nem senioridade na pagina.
- Convite preservado no codigo: rota `/convite/:token` em `router.tsx:182`, InvitationPage, e `inviteMember` no SDL.

## Gaps

Nenhum gap encontrado.

## Anti-patterns

Nenhum blocker.
