---
phase: 10-permiss-es-por-usu-rio
plan: 07
subsystem: authz
tags: [permissoes, graphql, auditoria, access-admin]
requires: [10-03]
provides:
  - access-admin-rules (targetLock, itemAdjustability)
  - AccessAdminService (memberAccess, overview, set, reset)
  - GraphQL memberAccess, memberAccessOverview, setMemberAccess, resetMemberAccess
  - Troca de papel zera ajustes (PERM-11) e equipe anotada com @RequireAccess
affects: [10-10, 10-13]
key-files:
  created:
    - apps/backend/src/authz/access/access-admin-rules.ts
    - apps/backend/src/authz/access/access-admin-rules.spec.ts
    - apps/backend/src/authz/access/access-admin.service.ts
    - apps/backend/test/integration/phase10-access-admin.e2e.spec.ts
    - apps/backend/test/integration/phase10-role-change.e2e.spec.ts
  modified:
    - apps/backend/src/authz/access/access.resolver.ts
    - apps/backend/src/authz/authz.module.ts
    - apps/backend/src/graphql/schema/access.graphql
    - apps/backend/src/identity/members.service.ts
    - apps/backend/src/identity/members.resolver.ts
    - apps/backend/src/identity/invitation.resolver.ts
decisions:
  - Mudança sem efeito (já no estado pedido) é ignorada: não grava nem audita
  - resetMemberAccess sem ajustes existentes não gera auditoria
  - Mesmo item repetido no lote vale o último valor
metrics:
  completed: 2026-11-25
requirements: [PERM-03, PERM-05, PERM-08, PERM-09, PERM-10, PERM-11]
---

# Phase 10 Plan 07: Administração de acessos Summary

Admin e Gerente ajustam acessos por pessoa pela API, respeitando quem ajusta quem (D-08), itens não concedíveis (D-09) e o teto do próprio ator (D-15); só diferenças do padrão ficam gravadas e tudo deixa rastro em `audit_log`.

## Contrato GraphQL final (para o 10-13)

```graphql
type MemberAccess { memberId: UUID! displayName: String! roleName: String! editable: Boolean! lockReason: String items: [AccessItem!]! adjustedCount: Int! }
type MemberAccessSummary { memberId: UUID! adjustedCount: Int! }
input AccessChangeInput { itemId: String! enabled: Boolean! }
input SetMemberAccessInput { memberId: UUID! changes: [AccessChangeInput!]! }
type SetMemberAccessPayload { access: MemberAccess errors: [UserError!]! }
Query.memberAccess(memberId: UUID!): MemberAccess!
Query.memberAccessOverview: [MemberAccessSummary!]!
Mutation.setMemberAccess(input): SetMemberAccessPayload!
Mutation.resetMemberAccess(memberId: UUID!): SetMemberAccessPayload!
```

As 4 operações exigem `member.editRole` + `@RequireAccess('profissionais-perfis')`; Atendente/Profissional recebem `ACCESS_DENIED`. `memberAccess` de pessoa inexistente lança NotFound; nas mutations vira `MEMBER_NOT_FOUND` em `errors`.

## Códigos de erro (em `errors[].code`)

MEMBER_NOT_FOUND, ACCESS_TARGET_ADMIN, ACCESS_TARGET_FORBIDDEN, ACCESS_TARGET_SELF, ACCESS_ITEM_UNKNOWN, ACCESS_ITEM_NOT_GRANTABLE, ACCESS_GRANT_EXCEEDS_ACTOR. Qualquer erro recusa o lote inteiro.

## Auditoria

- `member.access.update`: metadata `{ actorRole, targetRole, changes: [{ itemId, from, to }] }`.
- `member.access.reset`: metadata `{ reason: 'manual' | 'role_change', removed: [{ itemId, enabled }] }`; em `role_change` também `fromRole`/`toRole`. entity_id = pessoa alvo.

## Equipe (PERM-05)

`createMember`, `resetMemberPassword`, `updateMember`, `deactivateMember`, `deleteMemberPermanently`, `reactivateMember`, `inviteMember`, `revokeInvitation` exigem `profissionais-todos`. `members`, `allMembers`, `professionalsForService`, `pendingInvitations` ficam sem `@RequireAccess` com o comentário `ACCESS_EXEMPT` (para o 10-10). `acceptInvitation` é `@Public`, sem mudança.

## Tasks e commits

1. Regras puras: f0a6fbd
2. Serviço e GraphQL de administração: 95694c7
3. Troca de papel e equipe: b720826

## Verificação

Unit backend 69 suítes / 818 testes verdes; lint e tsc limpos; integração phase10-access-admin (11), phase10-role-change (5) e members-lifecycle verdes. Não rodei a suíte de integração inteira (banco compartilhado).

## Deviations from Plan

- `invitation` não tem spec de integração próprio no padrão buscado; o filtro rodou só members-lifecycle e as suítes da fase.
- Setup do worktree: `pnpm install` e cópia do .env (não versionado).
- Corrigido no meu teste: ordem de chaves do jsonb e `temporaryPassword` obrigatório em createMember.

## Known Stubs

Nenhum.

## Self-Check: PASSED
