---
phase: 10-permiss-es-por-usu-rio
plan: 01
subsystem: authz
tags: [permissoes, catalogo, tdd]
requires: []
provides:
  - ACCESS_ITEMS, ACCESS_GATES, PLACEHOLDER_MENU_IDS (access-catalog.ts)
  - resolveAccess, checkAccess, expandGates, isGranted, hasCostVisibility (access-resolve.ts)
affects: [10-02 em diante]
tech-stack:
  patterns: [domínio puro sem I/O, spec de paridade lendo menu-config.ts como texto]
key-files:
  created:
    - apps/backend/src/authz/access/access-catalog.ts
    - apps/backend/src/authz/access/access-resolve.ts
    - apps/backend/src/authz/access/access-catalog.spec.ts
    - apps/backend/src/authz/access/access-resolve.spec.ts
decisions:
  - Lista de placeholders do plano bateu exatamente com o menu-config.ts; nenhum ajuste foi necessário
metrics:
  completed: 2026-11-25
requirements: [PERM-01, PERM-02]
---

# Phase 10 Plan 01: catálogo de itens de acesso e resolveAccess Summary

Domínio puro com 23 itens de acesso (um por submenu ativo), porteiros nomeados e `resolveAccess`/`checkAccess` que decidem padrão do papel, ganho, negação, Admin intocável e Perfis não concedível.

## Matriz padrão (papel x item)

| Item | ADMIN | MANAGER | ATTENDANT | PROFESSIONAL |
|---|---|---|---|---|
| agenda | sim | sim | sim | sim |
| clientes-todos | sim | sim | sim | sim |
| profissionais-todos | sim | sim | sim | sim |
| profissionais-perfis | sim | sim | não | não |
| servicos-todos | sim | sim | sim | sim |
| produtos-todos | sim | sim | sim | sim |
| pacotes-todos | sim | sim | sim | sim |
| categorias | sim | sim | sim | sim |
| fin-controle | sim | sim | não | não |
| fin-previsao | sim | sim | não | não |
| fin-despesas-fixas | sim | sim | não | não |
| fin-comissoes | sim | sim | não | sim |
| fin-credito | sim | sim | sim | não |
| fin-comandas | sim | sim | sim | sim |
| fin-regras-comissao | sim | sim | não | não |
| noivas | sim | sim | sim | não |
| contratos | sim | sim | sim | não |
| comercial-painel | sim | sim | sim | não |
| comercial-leads | sim | sim | sim | não |
| comercial-pipeline | sim | sim | sim | não |
| comercial-lembretes | sim | sim | sim | não |
| comercial-relatorios | sim | sim | não | não |
| comercial-config | sim | sim | não | não |

Totais: 23 / 23 / 15 / 9. A constante `EXPECTED_DEFAULTS` em `access-resolve.spec.ts` fixa isso em teste.

## Deviations from Plan

- Prettier do backend não tem config no repositório; rodado com `--single-quote` para seguir o estilo existente. Nenhum desvio de comportamento.
- node_modules do worktree foram ligados por symlink (não versionados, não commitados).

## Verificação

jest `src/authz` (122 testes), typecheck e lint do backend verdes. Frontend e integração não foram tocados.

## Commits

- ed5cbd6 test(10-01): specs do catálogo e da resolução de acesso
- d3d3e6b feat(10-01): catálogo de itens de acesso e resolveAccess

## Self-Check: PASSED
