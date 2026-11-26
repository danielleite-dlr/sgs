---
phase: 10
slug: permiss-es-por-usu-rio
status: verified
nyquist_compliant: true
wave_0_complete: true
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
| PERM-01 | catálogo cobre todo item ativo do menu, ids únicos, placeholders fora, `home`/perfil sempre ligados | unit (backend) + paridade com `menu-config.ts` | `jest --config jest.config.ts src/authz/access/access-catalog.spec.ts` | ✅ | ✅ green |
| PERM-02 | `resolveAccess`: matriz padrão 4 papéis × itens (D-14, D-16), grant ⇒ permissões de Gerente do item, deny | unit puro | `jest … src/authz/access/access-resolve.spec.ts` | ✅ | ✅ green |
| PERM-03 | tabela `member_access_overrides`, RLS forçada, isolamento entre salões, cascade ao excluir membro | integração | `jest --config jest-integration.config.ts --runInBand phase10-rls-access` | ✅ | ✅ green |
| PERM-04 | API recusa com `ACCESS_DENIED` item desligado e aceita item ganho na próxima chamada com o mesmo JWT | integração | `… phase10-access-guard` (+ `src/authz/access/access.service.spec.ts`) | ✅ | ✅ green |
| PERM-05 | inventário: todo `@RequirePermission` tem `@RequireAccess` ou está em `ACCESS_EXEMPT` | unit (reflexão) | `jest … src/authz/access/access-inventory.spec.ts` | ✅ | ✅ green |
| PERM-06 | Comercial ganho: atendente com Relatórios vê tudo sem `manage` em Leads/Pipeline; profissional com Comercial vê como gerente | integração | `… phase10-commercial-scope` | ✅ | ✅ green |
| PERM-07 | custo/diária visíveis a quem ganhou Financeiro; recortes "só os meus" do papel continuam | integração | `… phase10-ops-access`, `… phase10-bridal-access` | ✅ | ✅ green |
| PERM-08 | Admin intocável; Gerente só Atendente/Profissional, nunca a si; só concede o que tem (D-15); Att/Prof recusados | integração | `… phase10-access-admin` (+ `src/authz/access/access-admin-rules.spec.ts`) | ✅ | ✅ green |
| PERM-09 | `profissionais-perfis` não ligável para Atendente/Profissional | integração | `… phase10-access-admin` | ✅ | ✅ green |
| PERM-10 | auditoria `member.access.update`/`reset` com `changes` | integração | `… phase10-access-admin` | ✅ | ✅ green |
| PERM-11 | troca de papel apaga ajustes + auditoria; membro desativado recusado | integração | `… phase10-role-change` | ✅ | ✅ green |
| PERM-12 | push de lembrete/agenda, alertas de contrato, estoque baixo e sino respeitam item negado | integração + unit | `… phase10-notifications` (cobre push) + `src/push/push-commercial.spec.ts`, `src/push/push-bridal.spec.ts` | ✅ | ✅ green |
| PERM-13 | `useMenu` filtra por item efetivo; grupo vazio some; busca global e BottomNav; cartões do painel | unit (vitest) | `vitest run src/components/layout/__tests__` (`menu-por-papel`, `bottom-nav-acesso`, `casco-gestor-beauty`) + `src/features/operations/__tests__/painel-por-acesso.test.tsx` | ✅ | ✅ green |
| PERM-14 | `AccessRoute`: bloqueia item desligado (inclui detalhe), redireciona sem laço e sem logout | unit (vitest) | `vitest run src/features/access` (`access-route.test.tsx`) + `src/features/commercial/__tests__/commercial-route.test.tsx` | ✅ | ✅ green |
| PERM-15 | `myAccess` com poll 60 s, refetch ao trocar de rota/voltar do segundo plano/`ACCESS_DENIED`; `error-link` não desloga em `ACCESS_DENIED` | unit (vitest) + E2E | `vitest run src/infrastructure/apollo src/features/access` (`error-link`, `use-my-access`); `test:e2e tests/permissoes-menu-ao-vivo` | ✅ | ✅ green |
| PERM-16 | tela Perfis de acesso: lista, padrão vs ajustado, toggle item/grupo, voltar ao padrão, atalho "Acessos", a11y do switch | unit + E2E | `vitest run src/features/access` (`perfis-acesso-page`, `member-access-panel`); `test:e2e tests/permissoes-perfis`, `tests/permissoes-area-ganha` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `apps/backend/src/authz/access/*.spec.ts` (catálogo, resolve, inventário)
- [x] `apps/backend/test/integration/helpers/phase10-fixtures.ts` (reusa `createPhase9World`; grava override, loga como cada papel e faz a limpeza de `member_access_overrides` antes dos membros — o `phase10-cleanup.ts` separado não foi necessário)
- [x] `apps/frontend/src/features/access/__tests__/`
- [x] `apps/e2e/tests/permissoes-*.spec.ts` + `apps/e2e/support/phase10.ts` (`setMemberAccessViaApi`)
- [x] Atualizar testes existentes que fixam o menu por papel (Pitfall 12 da pesquisa)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Resultado |
|----------|-------------|------------|-------------------|-----------|
| Matriz padrão por papel aprovada pela usuária | PERM-02 (D-14) | decisão de produto | mostrar a tabela papel × item no staging e registrar o ok | ✅ Matriz padrão: aprovada pela usuária em 26/11/2026 (com a lista completa do que muda) |
| App instalado no iPhone e Android Gestor Beauty atualizam o menu ao voltar do segundo plano | PERM-15 | depende de aparelho | desligar um item da pessoa no computador, voltar ao app no celular, conferir que o item some em até 1 min | ✅ aprovado pela usuária em 26/11/2026 |
| Aparência da tela Perfis de acesso (celular e computador) | PERM-16 | visual | abrir Profissionais › Perfis de acesso e o atalho "Acessos" no staging | ✅ aprovado pela usuária em 26/11/2026 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automatizado verde em 25/11/2026 (gate: unit 827, integração 960, vitest 165 arquivos, shared, E2E 76/76; codegen contra o schema ok). Verificações manuais no 10-16.

---

## Roteiro da verificação humana (10-16)

Matriz padrão aprovada em 26/11/2026 (`EXPECTED_DEFAULTS` de `access-resolve.spec.ts`; Admin e Gerente: todos os 23 itens).

| Item | Administrador | Gerente | Atendente | Profissional |
|------|:-:|:-:|:-:|:-:|
| Agenda | ✅ | ✅ | ✅ | ✅ |
| Todos os clientes | ✅ | ✅ | ✅ | ✅ |
| Todos os profissionais | ✅ | ✅ | ✅ | ✅ |
| Perfis de acesso | ✅ | ✅ | — | — |
| Todos os serviços | ✅ | ✅ | ✅ | ✅ |
| Todos os produtos | ✅ | ✅ | ✅ | ✅ |
| Pacotes cadastrados | ✅ | ✅ | ✅ | ✅ |
| Categorias | ✅ | ✅ | ✅ | ✅ |
| Controle de entrada e saída | ✅ | ✅ | — | — |
| Previsão de caixa | ✅ | ✅ | — | — |
| Despesas fixas | ✅ | ✅ | — | — |
| Comissões calculadas | ✅ | ✅ | — | ✅ |
| Crédito de cliente | ✅ | ✅ | ✅ | — |
| Comandas | ✅ | ✅ | ✅ | ✅ |
| Regras de comissão | ✅ | ✅ | — | — |
| Grupos de Noivas | ✅ | ✅ | ✅ | — |
| Contratos | ✅ | ✅ | ✅ | — |
| Painel comercial | ✅ | ✅ | ✅ | — |
| Leads | ✅ | ✅ | ✅ | — |
| Pipeline | ✅ | ✅ | ✅ | — |
| Lembretes | ✅ | ✅ | ✅ | — |
| Relatórios (Comercial) | ✅ | ✅ | — | — |
| Etapas e formulário | ✅ | ✅ | — | — |

O que muda para quem usa hoje: a Profissional deixa de ver Crédito de cliente, Noivas, Contratos e o Comercial (fica com Comissões e Comandas no Financeiro); a Atendente deixa de ver Controle financeiro, Previsão de caixa, Despesas fixas, Comissões, Regras de comissão e Relatórios/Etapas do Comercial. Cada pessoa pode ganhar o item de volta em Perfis de acesso.
