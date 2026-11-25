---
phase: 10-permiss-es-por-usu-rio
plan: 03
subsystem: authz
tags: [permissoes, guard, graphql, access]
requires: [10-01, 10-02]
provides:
  - AccessService (load, loadTx, forContext, membersWithItem), membersWithItemTx, loadAccessManyTx
  - "@RequireAccess e AccessDeniedError (code ACCESS_DENIED)"
  - PermissionGuard em duas camadas, resolveTenantFromGqlContext
  - Query.myAccess (access.graphql)
affects: [10-04, 10-05, 10-06, 10-07, 10-08, 10-09]
key-files:
  created:
    - apps/backend/src/authz/access/access.errors.ts
    - apps/backend/src/authz/access/access.service.ts
    - apps/backend/src/authz/access/access.service.spec.ts
    - apps/backend/src/authz/access/access.resolver.ts
    - apps/backend/src/authz/decorators/require-access.decorator.ts
    - apps/backend/src/graphql/schema/access.graphql
    - apps/backend/test/integration/phase10-access-guard.e2e.spec.ts
  modified:
    - apps/backend/src/authz/guards/permission.guard.ts
    - apps/backend/src/authz/authz.module.ts
    - apps/backend/src/financial/forecast.resolver.ts
    - apps/backend/test/integration/members-lifecycle.e2e.spec.ts
decisions:
  - Recusa por área/permissão/papel sai com ACCESS_DENIED (não desloga); membro inativo continua FORBIDDEN
  - Sem @RequireAccess a operação só checa permissão, agora com o papel e as permissões lidos do banco
metrics:
  completed: 2026-11-25
requirements: [PERM-04]
---

# Phase 10 Plan 03: AccessService, guard e myAccess Summary

A API passou a decidir pelo acesso efetivo lido do banco a cada requisição: negar ou ganhar `fin-previsao` vale na chamada seguinte com o mesmo token, sem relogar e sem derrubar a sessão.

## Assinaturas finais (para 10-04..10-09)

```ts
// authz/guards/permission.guard.ts
export interface GuardGqlContext extends AccessGqlContext {
  req?: { user?: JwtAccessPayload; headers?: Record<string, string> };
}
export function resolveTenantFromGqlContext(gqlCtx: GuardGqlContext): TenantContext | undefined; // grava gqlCtx.tenant

// authz/access/access.service.ts
export interface LoadedAccess extends ResolvedAccess { memberId: string; organizationId: string }
export interface AccessGqlContext { tenant?; access?: LoadedAccess | null; accessPromise?: Promise<LoadedAccess | null> }
class AccessService {
  load(orgId, memberId): Promise<LoadedAccess | null>;
  loadTx(tx, orgId, memberId): Promise<LoadedAccess | null>;
  forContext(gqlCtx: AccessGqlContext): Promise<LoadedAccess | null>; // memoiza em gqlCtx.accessPromise; exige gqlCtx.tenant
  membersWithItem(tx, memberIds, itemId): Promise<Set<string>>;
}
export function membersWithItemTx(tx, memberIds, itemId): Promise<Set<string>>;
export function loadAccessManyTx(tx, memberIds): Promise<Map<string, ResolvedAccess>>;

// authz/decorators/require-access.decorator.ts
RequireAccess(...itemIdsOuPorteiros)  // OU entre eles; REQUIRED_ACCESS_KEY
// authz/access/access.errors.ts
AccessDeniedError(message, { reason?, items?, missing? })  // extensions.code = 'ACCESS_DENIED'
```

Guard: sem nenhum dos três decorators devolve true; com algum, resolve tenant, carrega acesso (null → `FORBIDDEN: membro inativo ou inexistente`, code FORBIDDEN), sobrescreve `gqlCtx.tenant.roleName` com o papel do banco, aplica `@RequireRole` e `checkAccess`. Resolvers sem decorator (como `myAccess`) devem chamar `resolveTenantFromGqlContext` antes de `forContext`.

`myAccess`: itens na ordem de `ACCESS_ITEMS`, `adjustable: false`, `lockReason: null`, permissões ordenadas; `canManageAccess` = item `profissionais-perfis` ligado.

## Tasks e commits

1. AccessService, AccessDeniedError, @RequireAccess: 03418f8
2. Guard em duas camadas, piloto cashForecast, suíte phase10-access-guard: 799b6c1
3. Query myAccess: baee389

## Verificação

- Unit do backend: 68 suítes, 806 testes verdes. Typecheck e lint do backend limpos.
- Integração: phase10-access-guard (9 testes), members-lifecycle e, como regressão do guard, phase3/4/5/42-rls-rbac, phase9-leads, phase9-deals, phase3-time-blocks, phase42-companion-guard e phase91-members-assistant (208 testes) verdes.

## Deviations from Plan

- [Regra do ambiente] O plano pedia a integração INTEIRA; as regras do projeto proíbem rodar a suíte completa no Postgres compartilhado. Rodei só as suítes tocadas e as de RBAC/FORBIDDEN listadas acima. Convém rodar a suíte completa no CI.
- members-lifecycle: três asserções de recusa por permissão (linhas 337, 363, 375) passaram a aceitar `/FORBIDDEN|ACCESS_DENIED/`, já que o code agora é ACCESS_DENIED.
- Para jobs sem decorators, a mensagem de membro inativo é `FORBIDDEN: membro inativo ou inexistente` (o teste confere o prefixo `FORBIDDEN: membro inativo`).
- Setup do worktree: `pnpm install` e cópia do .env (não versionado).

## Known Stubs

Nenhum.

## Self-Check: PASSED
