---
phase: quick/260922-0kn
plan: 01
subsystem: ui
tags: [react, react-hook-form, apollo-client, catalog, commissions, currency-mask]

# Dependency graph
requires:
  - phase: 02-core-domain
    provides: CommissionRuleForm, comissoes.api.ts (CommissionRulesQuery), currency-mask utils
provides:
  - "ServicoForm exibe a comissao de escopo `service` (tipo + valor) do servico sendo editado"
  - "Fallback de heranca de comissao (categoria -> padrao da organizacao) quando o servico nao tem regra propria"
  - "CommissionRuleForm exibe o valor mascarado em pt-BR ao editar uma regra existente"
affects: [catalog, commissions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Estado unico commissionDialog: { scope: 'service' | 'member_service'; rule?: CommissionRuleData } | null substitui pares de useState (open + editing) para dialogos reutilizaveis"
    - "formatCurrencyDisplay aplicado a qualquer valor DECIMAL(12,4) do backend antes de injetar em input mascarado, para fixed e percentage"

key-files:
  created: []
  modified:
    - apps/frontend/src/features/catalog/components/ServicoForm.tsx
    - apps/frontend/src/features/catalog/components/CommissionRuleForm.tsx
    - apps/frontend/src/features/catalog/__tests__/servico-form.test.tsx

key-decisions:
  - "Aplicado patch de referencia ja validado via git apply em vez de reimplementar do zero — reduz risco de divergencia"
  - "formatCurrencyDisplay reaproveitado para percentage (nao so fixed) porque ambos usam virgula como separador decimal"
  - "Testes do dialogo de comissao (abrir CommissionRuleForm a partir do ServicoForm) nao foram cobertos — exigiriam mocks adicionais de MembersQuery/ProductsQuery/etc sem ganho para este escopo"

patterns-established:
  - "Pattern: dialogos de edicao reutilizaveis usam um unico estado discriminado (scope + rule opcional) em vez de pares open/editing"

requirements-completed: [QUICK-0kn-01, QUICK-0kn-02, QUICK-0kn-03]

# Metrics
duration: 5min
completed: 2026-09-22
---

# Quick Task 260922-0kn: Exibir comissão cadastrada do serviço Summary

**ServicoForm agora mostra a comissão de escopo `service` (tipo + valor formatado em pt-BR) com fallback de herança categoria→padrão da organização, e CommissionRuleForm exibe o valor mascarado (não cru) ao editar qualquer regra existente.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-09-22T03:28:44Z
- **Completed:** 2026-09-22T03:33:01Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Bloco "Comissão do serviço" (escopo `service`) adicionado ao `ServicoForm`, acima do bloco existente "Comissões por profissional" (escopo `member_service`), com Tipo/Valor, ações Definir/Editar/Remover, e fallback de herança (categoria → padrão da organização) ou "Nenhuma comissão cadastrada para este serviço."
- Estado do diálogo de comissão unificado num único `commissionDialog` que serve os dois escopos (service e member_service), reutilizando o `CommissionRuleForm` existente com `lockScope`.
- Corrigido `CommissionRuleForm`: o campo Valor agora exibe `formatCurrencyDisplay(initialRule.value)` ao editar, evitando mostrar o decimal cru do backend (`"120.0000"`) num input mascarado em pt-BR.
- Dois novos testes cobrindo o bloco "Comissão do serviço" (com regra própria e fallback sem regra).

## Task Commits

Each task was committed atomically:

1. **Task 1: Aplicar o patch de referência do ServicoForm e revisar** - `02d762b` (feat)
2. **Task 2: Corrigir máscara do campo Valor na edição de regra de comissão** - `fdf9f3e` (fix)
3. **Task 3: Cobrir o novo bloco em servico-form.test.tsx e rodar a verificação completa** - `a0b082b` (test)

_Note: Tasks 2 and 3 were flagged `tdd="true"` in the plan, but both were single-commit fixes/additions to existing files (not new RED→GREEN cycles), so one commit per task was sufficient and matches the plan's own verification structure._

## Files Created/Modified
- `apps/frontend/src/features/catalog/components/ServicoForm.tsx` - Bloco "Comissão do serviço" + bloco "Comissões por profissional" ligados a um diálogo único `commissionDialog`; helpers `commissionKindLabel`/`formatCommission`; `inheritedCommission` via `form.watch('categoryId')`
- `apps/frontend/src/features/catalog/components/CommissionRuleForm.tsx` - `defaultValues.value` usa `formatCurrencyDisplay(initialRule.value)` na edição
- `apps/frontend/src/features/catalog/__tests__/servico-form.test.tsx` - `describe('ServicoForm — comissão do serviço', ...)` com 2 testes novos (com regra / fallback sem regra)

## Decisions Made
- Patch de referência (`/tmp/.../scratchpad/servicoform-comissao.patch`) aplicado via `git apply` em vez de reimplementação manual — já validado com `git apply --check` e revisado contra o checklist de 8 pontos do plano (todos confirmados presentes).
- `formatCurrencyDisplay` é suficiente para `kind: 'percentage'` também, pois ambos os tipos (fixed/percentage) usam vírgula como separador decimal no display mascarado — não foi necessário um helper específico de percentual.
- Testes que abririam o diálogo `CommissionRuleForm` a partir do `ServicoForm` (fluxo completo definir/editar/remover) não foram adicionados, conforme instrução explícita do plano — exigiriam mocks adicionais (`MembersQuery`, `ProductsQuery`, `CategoriesQuery` dentro do diálogo) sem ganho de cobertura para o escopo desta tarefa.

## Deviations from Plan

None - plan executado exatamente como escrito. O patch de referência aplicou limpo (`git apply --check` e `git apply` sem conflitos) e todos os 8 pontos do checklist de revisão foram confirmados presentes no arquivo resultante sem necessidade de ajustes manuais.

Uma nota de ambiente (não uma mudança de código): `pnpm` não estava no `PATH` do ambiente de execução; foi localizado o shim do corepack em `/usr/lib/node_modules/corepack/shims/pnpm` (versão 9.15.4, compatível com `packageManager: "pnpm@9.15.4"` do `package.json`) e usado para todos os comandos `pnpm typecheck`/`pnpm lint`/`pnpm test`. Isso não é uma mudança de código, apenas um detalhe de como a verificação foi executada neste ambiente.

## Issues Encountered
- `node_modules` não existia no worktree (`/root/sgs/.claude/worktrees/agent-a690e0b95896b8609`) — resolvido com `pnpm install --frozen-lockfile` (9.4s, lockfile já resolvido, nenhuma mudança em `pnpm-lock.yaml`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `pnpm typecheck`, `pnpm lint --max-warnings 0` e `pnpm test` (13 arquivos, 77 testes) passam limpos em `apps/frontend`.
- Exatamente 3 arquivos alterados; nenhuma mudança de schema GraphQL, API ou backend — confirmado via `git diff --stat HEAD~3`.
- Verificação manual opcional (abrir Catálogo → Serviços → editar serviço com comissão de escopo `service`) não foi executada nesta sessão (ambiente sem servidor rodando); comportamento validado via testes automatizados e revisão de código.

---
*Phase: quick/260922-0kn*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: apps/frontend/src/features/catalog/components/ServicoForm.tsx
- FOUND: apps/frontend/src/features/catalog/components/CommissionRuleForm.tsx
- FOUND: apps/frontend/src/features/catalog/__tests__/servico-form.test.tsx
- FOUND: .planning/quick/260922-0kn-exibir-a-comissao-cadastrada-do-servico-/260922-0kn-SUMMARY.md
- FOUND commit: 02d762b (Task 1)
- FOUND commit: fdf9f3e (Task 2)
- FOUND commit: a0b082b (Task 3)
