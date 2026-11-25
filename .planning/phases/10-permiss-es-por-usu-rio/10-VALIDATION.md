---
phase: 10
slug: permiss-es-por-usu-rio
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-24
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> IDs de requisito seguem `REQUIREMENTS.md` (PERM-01..PERM-16). A tabela da pesquisa usava outra numeração a partir do PERM-09; esta é a valida.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29 + ts-jest (backend unit e integração), vitest 2.1 (frontend), Playwright (`@sgs/e2e`) |
| **Config file** | `apps/backend/jest.config.ts`, `apps/backend/jest-integration.config.ts`, `apps/frontend/vitest.config.ts`, `apps/e2e/playwright.config.ts` |
| **Quick run command** | `corepack pnpm --filter @sgs/backend exec jest --config jest.config.ts src/authz/access` / `corepack pnpm --filter @sgs/frontend exec vitest run src/features/access` |
| **Full suite command** | lint + tsc + `corepack pnpm --filter @sgs/backend test` + `corepack pnpm --filter @sgs/backend test:integration` + `corepack pnpm --filter @sgs/frontend test` + `corepack pnpm --filter @sgs/e2e test:e2e` |
| **Estimated runtime** | unit < 30 s por módulo; suíte completa ~15–25 min |

---

## Sampling Rate

- **After every task commit:** jest/vitest do módulo tocado
- **After every plan wave:** backend unit + frontend unit + integração dos specs `phase10-*`
- **Before `/gsd:verify-work`:** suíte completa verde + E2E `permissoes-*` e E2E de menu por papel atualizados
- **Max feedback latency:** 30 seconds (unit)

---

## Per-Task Verification Map

| Requirement | Comportamento | Test Type | Automated Command | File Exists | Status |
|-------------|---------------|-----------|-------------------|-------------|--------|
| PERM-01 | catálogo cobre todo item ativo do menu, ids únicos, placeholders fora, `home`/perfil sempre ligados | unit (backend) + paridade com `menu-config.ts` | `jest --config jest.config.ts src/authz/access/access-catalog.spec.ts` | ❌ W0 | ⬜ pending |
| PERM-02 | `resolveAccess`: matriz padrão 4 papéis × itens (D-14, D-16), grant ⇒ permissões de Gerente do item, deny | unit puro | `jest … access-resolve.spec.ts` | ❌ W0 | ⬜ pending |
| PERM-03 | tabela `member_access_overrides`, RLS forçada, isolamento entre salões, cascade ao excluir membro | integração | `jest --config jest-integration.config.ts --runInBand phase10-rls-access` | ❌ W0 | ⬜ pending |
| PERM-04 | API recusa com `ACCESS_DENIED` item desligado e aceita item ganho na próxima chamada com o mesmo JWT | integração | `… phase10-access-guard` | ❌ W0 | ⬜ pending |
| PERM-05 | inventário: todo `@RequirePermission` tem `@RequireAccess` ou está em `ACCESS_EXEMPT` | unit (reflexão) | `jest … access-inventory.spec.ts` | ❌ W0 | ⬜ pending |
| PERM-06 | Comercial ganho: atendente com Relatórios vê tudo sem `manage` em Leads/Pipeline; profissional com Comercial vê como gerente | integração | `… phase10-commercial-scope` | ❌ W0 | ⬜ pending |
| PERM-07 | custo/diária visíveis a quem ganhou Financeiro; recortes "só os meus" do papel continuam | integração | `… phase10-cost-masks` | ❌ W0 | ⬜ pending |
| PERM-08 | Admin intocável; Gerente só Atendente/Profissional, nunca a si; só concede o que tem (D-15); Att/Prof recusados | integração | `… phase10-access-admin` | ❌ W0 | ⬜ pending |
| PERM-09 | `profissionais-perfis` não ligável para Atendente/Profissional | integração | `… phase10-access-admin` | ❌ W0 | ⬜ pending |
| PERM-10 | auditoria `member.access.update`/`reset` com `changes` | integração | `… phase10-access-admin` | ❌ W0 | ⬜ pending |
| PERM-11 | troca de papel apaga ajustes + auditoria; membro desativado recusado | integração | `… phase10-role-change` | ❌ W0 | ⬜ pending |
| PERM-12 | push de lembrete/agenda, alertas de contrato, estoque baixo e sino respeitam item negado | integração + unit | `… phase10-push-access`, `… phase10-notifications` (+ `push-commercial.spec.ts`, `push-bridal.spec.ts`) | ❌ W0 | ⬜ pending |
| PERM-13 | `useMenu` filtra por item efetivo; grupo vazio some; busca global e BottomNav; cartões do painel | unit (vitest) | `vitest run src/components/layout/__tests__` | atualizar existentes | ⬜ pending |
| PERM-14 | `AccessRoute`: bloqueia item desligado (inclui detalhe), redireciona sem laço e sem logout | unit (vitest) | `vitest run src/features/access` | ❌ W0 | ⬜ pending |
| PERM-15 | `myAccess` com poll 60 s, refetch ao trocar de rota/voltar do segundo plano/`ACCESS_DENIED`; `error-link` não desloga em `ACCESS_DENIED` | unit (vitest) + E2E | `vitest run src/infrastructure/apollo src/features/access`; `test:e2e tests/permissoes-menu-ao-vivo` | ❌ W0 | ⬜ pending |
| PERM-16 | tela Perfis de acesso: lista, padrão vs ajustado, toggle item/grupo, voltar ao padrão, atalho "Acessos", a11y do switch | unit + E2E | `vitest run src/features/access`; `test:e2e tests/permissoes-` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/src/authz/access/*.spec.ts` (catálogo, resolve, inventário)
- [ ] `apps/backend/test/integration/helpers/phase10-fixtures.ts` (reusa `createPhase9World`; grava override e loga como cada papel) e `phase10-cleanup.ts` (apaga `member_access_overrides` antes dos membros)
- [ ] `apps/frontend/src/features/access/__tests__/`
- [ ] `apps/e2e/tests/permissoes-*.spec.ts` + `apps/e2e/support/phase10.ts` (`setMemberAccessViaApi`)
- [ ] Atualizar testes existentes que fixam o menu por papel (Pitfall 12 da pesquisa)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Matriz padrão por papel aprovada pela usuária | PERM-02 (D-14) | decisão de produto | mostrar a tabela papel × item no staging e registrar o ok |
| App instalado no iPhone e Android Gestor Beauty atualizam o menu ao voltar do segundo plano | PERM-15 | depende de aparelho | desligar um item da pessoa no computador, voltar ao app no celular, conferir que o item some em até 1 min |
| Aparência da tela Perfis de acesso (celular e computador) | PERM-16 | visual | abrir Profissionais › Perfis de acesso e o atalho "Acessos" no staging |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
