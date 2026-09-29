---
phase: quick
plan: 260928-vk2
subsystem: infra
tags: [github-actions, pnpm, jq, docker-compose, ci]

requires: []
provides:
  - "CI workflow com setup do pnpm sem conflito de versão (ERR_PNPM_BAD_PM_VERSION resolvido)"
  - "Health checks do CI compatíveis com JSON Lines e array JSON do docker compose ps"
affects: [ci, deploy-readiness]

tech-stack:
  added: []
  patterns:
    - "jq -s 'flatten | ...' (slurp + flatten) para tolerar tanto JSON Lines quanto array JSON de docker compose ps --format json"
    - "packageManager no package.json como fonte única da versão do pnpm — pnpm/action-setup@v4 sem chave with.version"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "jq -s 'flatten | ...' escolhido sobre alternativa jq -r '...| .Name' | wc -l por funcionar sem branch em ambos os formatos de saída do Compose"
  - "ps_json capturado uma única vez no job boot-time para os 3 contadores lerem o mesmo snapshot, evitando divergência entre chamadas"

patterns-established:
  - "Health-check parsing em CI deve assumir JSON Lines (slurp+flatten), não array de topo, para docker compose ps --format json"

requirements-completed: [CI-BUG-01, CI-BUG-02]

duration: ~20min
completed: 2026-09-28
---

# Quick Task 260928-vk2: Corrigir setup do pnpm e health check do CI Summary

**Removido o pin de versão conflitante do pnpm/action-setup@v4 (4 ocorrências) e corrigidas 4 expressões jq de health check para usar slurp+flatten, compatível com a saída JSON Lines do Docker Compose v2**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-28
- **Tasks:** 3 (2 com commit de código + 1 de validação pura)
- **Files modified:** 1 (`.github/workflows/ci.yml`)

## Accomplishments

- `pnpm/action-setup@v4` não recebe mais `with.version: 9` nas 4 ocorrências (jobs `typecheck`, `lint`, `integration`, `frontend-codegen`) — `packageManager: pnpm@9.15.4` do `package.json` passa a ser a única fonte de versão, eliminando `ERR_PNPM_BAD_PM_VERSION`.
- As 4 expressões jq de health check (3 no job `boot-time`, 1 no job `integration`) trocadas de indexação de array de topo para `jq -s 'flatten | ...'`, eliminando `jq: error ... Cannot index string with string "Health"` (exit 5) quando o Compose emite JSON Lines.
- YAML validado com PyYAML: mesmos 5 jobs (`typecheck`, `lint`, `integration`, `boot-time`, `frontend-codegen`), na mesma ordem.
- Expressões jq validadas localmente contra duas fixtures (JSON Lines e array JSON) — resultados idênticos em ambos os formatos.

## Task Commits

1. **Task 1: Remover o pin de versão do pnpm das 4 ocorrências de action-setup** - `70d3f9d` (fix)
2. **Task 2: Corrigir as expressões jq dos health checks para JSON Lines** - `31d6bdf` (fix)
3. **Task 3: Validar YAML e testar as expressões jq contra fixtures locais** - sem commit de código (task de verificação pura; nenhum arquivo do repo foi alterado, conforme especificado no plano)

**Plan metadata:** (este commit de SUMMARY)

## Files Created/Modified

- `.github/workflows/ci.yml` - Removidos os blocos `with: version: 9` das 4 ocorrências de `pnpm/action-setup@v4`; trocadas as 4 expressões jq de health check (`boot-time` x3, `integration` x1) por `jq -s`/`jq -rs 'flatten | ...'`

## Verificações Executadas (resultado)

**3a — YAML válido, jobs preservados:**
```
YAML OK - 5 jobs, 4 action-setup sem with
```

**Greps de confirmação:**
- `grep -c 'version: 9' .github/workflows/ci.yml` → `0`
- `grep -c 'pnpm/action-setup@v4' .github/workflows/ci.yml` → `4`
- `grep -c 'jq -s' .github/workflows/ci.yml` → `3`
- `grep -c 'jq -rs' .github/workflows/ci.yml` → `1`
- Padrões antigos (`jq '[.[]`, `jq -r '[.[]`, `jq '. | length'`) → `0` ocorrências
- `grep '"packageManager": "pnpm@9.15.4"' package.json` → presente, inalterado

**3b — fixtures jq (JSON Lines `jsonl.txt` e array `arr.json`, criadas em scratchpad, não commitadas):**

| Expressão | jsonl.txt | arr.json | Esperado |
|---|---|---|---|
| `jq -s 'flatten \| length'` (total) | 2 | 2 | 2 |
| `jq -s 'flatten \| map(select(.Health == "healthy")) \| length'` (healthy) | 1 | 1 | 1 |
| `jq -s 'flatten \| map(select(.State == "running")) \| length'` (running) | 2 | 2 | 2 |
| `jq -rs 'flatten \| map(select(.Service != ...)) \| map(.Health) \| unique \| join(",")'` (join) | healthy,starting | healthy,starting | healthy,starting |

Confirmado também que a expressão **antiga** (`jq '[.[] \| select(.Health == "healthy")] \| length'`) reproduz exatamente o erro relatado ao rodar contra `jsonl.txt`:
```
jq: error (at <stdin>:1): Cannot index string with string "Health"
jq: error (at <stdin>:2): Cannot index string with string "Health"
exit: 5
```

**3c — diff enxuto:** `git diff --name-only -- . ':!.github/workflows/ci.yml' ':!.planning'` → vazio. Apenas `.github/workflows/ci.yml` foi alterado no repositório (fora de `.planning/`), conforme diff cumulativo dos commits `70d3f9d` + `31d6bdf`, byte-a-byte igual ao especificado no plano.

## Decisions Made

- Seguido exatamente o `<jq_decision>` do plano: `jq -s 'flatten | ...'` (slurp + flatten) em vez de `jq -r '...| .Name' | wc -l`, por funcionar sem branch em ambos os formatos de saída do Compose.
- No job `boot-time`, capturada a saída de `docker compose ps --format json` uma única vez em `ps_json` antes dos 3 `jq`, para os contadores `total`/`healthy`/`started` lerem o mesmo snapshot (conforme especificado no plano, task 2a).

## Deviations from Plan

None - plano executado exatamente como escrito, incluindo o item 2b (correção da expressão jq do job `integration`), aprovado explicitamente pelo usuário para inclusão no escopo.

## Issues Encountered

Nenhum. O ambiente de execução (worktree isolado) não continha o arquivo de plano nem o diretório `.planning/quick/260928-vk2-.../`, pois haviam sido criados apenas no checkout principal e ainda não commitados; o plano foi copiado para dentro do worktree antes da execução para permitir que todas as operações (incluindo commits) ocorressem exclusivamente dentro do worktree isolado, sem tocar `/root/sgs` diretamente.

## Achados (para task separada — NÃO corrigidos aqui)

Conforme o escopo definido em `<expectativa_de_resultado>` do plano, esta task **não** executou os jobs de CI de ponta a ponta (isso requer o runner do GitHub Actions com Docker, Postgres, PgBouncer etc.). Uma tentativa local de rodar `pnpm -r typecheck` / `pnpm -r lint` para antecipar achados foi abandonada porque o sandbox de execução não tem `pnpm` instalado nem `node_modules` presentes (`pnpm: command not found`, `node_modules` ausente) — instalar dependências estaria fora do escopo estrito deste quick task (não alterar `package.json`/dependências) e não foi tentado.

**Recomendação:** após o merge desta correção, observar o próximo run do CI (verificação pós-push #7 do plano) e, se os jobs `typecheck`, `lint` ou `integration` falharem *depois* do passo de setup/health-check, abrir uma task separada listando job, passo e mensagem de erro resumida. Nenhuma falha real de código foi identificada nesta execução porque não foi possível rodar os jobs de fato neste ambiente.

## User Setup Required

None - nenhuma configuração externa necessária. Mudança restrita a `.github/workflows/ci.yml`.

## Next Phase Readiness

- CI pronto para ser validado no próximo push/PR: setup do pnpm deve completar sem `ERR_PNPM_BAD_PM_VERSION` e os health checks não devem mais emitir `Cannot index string`.
- Acompanhar o primeiro run real pós-merge para confirmar que os jobs avançam até os passos de trabalho (`pnpm -r typecheck`, `pnpm -r lint`, `pnpm test:integration`) e capturar quaisquer falhas reais de código como achados de task separada.

---
*Quick task: 260928-vk2*
*Completed: 2026-09-28*

## Self-Check: PASSED

- FOUND: .github/workflows/ci.yml
- FOUND: .planning/quick/260928-vk2-corrigir-setup-do-pnpm-e-health-check-do/260928-vk2-SUMMARY.md
- FOUND commit: 70d3f9d (Task 1)
- FOUND commit: 31d6bdf (Task 2)
