# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 01-foundation
**Areas discussed:** Versões do stack, Monorepo tooling, Fluxo de signup + org, Escopo do RBAC

---

## Versões do Stack

| Option | Description | Selected |
|--------|-------------|----------|
| Node 22 LTS | Active LTS até 2027 | ✓ |
| Node 20 LTS | Versão dos PRDs, Maintenance em abr/2026 | |

**User's choice:** Node 22 LTS

| Option | Description | Selected |
|--------|-------------|----------|
| Prisma 6 + React 19 | Releases estáveis nov-dez/2024, zero custo no greenfield | ✓ |
| Prisma 5 + React 18 | Versões dos PRDs, criam upgrade debt no Ano 1 | |

**User's choice:** Prisma 6 + React 19

| Option | Description | Selected |
|--------|-------------|----------|
| Valkey 8 | Fork Linux Foundation, licença MIT, compatível binário com Redis 7.2 | ✓ |
| Redis 7.2.x | Última versão MIT, funciona mas licença restritiva para SaaS | |

**User's choice:** Valkey 8

**Notes:** Usuário optou por atualizar todas as versões flagadas pela pesquisa. Sem objeções ao upgrade.

---

## Monorepo Tooling

| Option | Description | Selected |
|--------|-------------|----------|
| pnpm workspaces | Simples, sem overhead, suficiente para 2 apps | ✓ |
| Turborepo + pnpm | Caching de build, útil se CI ficar lento | |
| Nx | Poderoso mas pesado para 2 apps | |

**User's choice:** pnpm workspaces

| Option | Description | Selected |
|--------|-------------|----------|
| apps/backend + apps/frontend | Convenção padrão, intuitivo | ✓ |
| backend/ + frontend/ na raiz | Mais simples, sem pasta apps/ | |
| packages/ com libs compartilhadas | Inclui shared types/validators | |

**User's choice:** apps/backend + apps/frontend

**Notes:** Preferência pelo caminho mais simples. Turborepo pode ser adicionado depois se necessário.

---

## Fluxo de Signup + Organização

| Option | Description | Selected |
|--------|-------------|----------|
| Tudo em um fluxo | Signup cria conta + org em sequência única | ✓ |
| Conta primeiro, org depois | Cria conta, faz login, cria org separadamente | |

**User's choice:** Fluxo unificado

| Option | Description | Selected |
|--------|-------------|----------|
| Mínimo: nome + email + senha + nome do salão | Rápido, restante configurado depois | ✓ |
| Completo: inclui telefone, CNPJ, cidade | Mais dados mas atrita o cadastro | |

**User's choice:** Dados mínimos

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, verificar email antes | Boa prática, evita contas falsas, via Resend | ✓ |
| Não, deixar entrar já | Menos atrito, verifica depois | |

**User's choice:** Verificação de email obrigatória

---

## Escopo do RBAC na Fase 1

| Option | Description | Selected |
|--------|-------------|----------|
| Layer de autorização sem UI admin | Backend aplica roles, frontend esconde por role, sem tela de gerenciamento | ✓ |
| RBAC completo com UI de membros | Inclui tela para convidar e mudar roles | |

**User's choice:** Layer de autorização sem UI admin

| Option | Description | Selected |
|--------|-------------|----------|
| Fase 1 junto com RBAC | Proprietário precisa convidar desde o começo | ✓ |
| Fase 2 (Core Domain) | Junto com catálogo | |

**User's choice:** Convite de membros na Fase 1

---

## Claude's Discretion

- Estrutura interna dos módulos NestJS
- Estratégia de migration Prisma em dev
- Implementação do PgBouncer no Docker Compose
- Biblioteca de RBAC (CASL vs custom)
- Setup do GraphQL codegen

## Deferred Ideas

- UI de gerenciamento de roles/permissões — futuro
- TOTP (2FA) — v2
- Múltiplas orgs por usuário — v2
