---
phase: quick-261104-hyq
plan: 01
subsystem: bridal
tags: [noivas, pacotes, contratos, prisma, graphql, react]
requires: [catalog packages, bridal groups, contracts]
provides: [bridal_groups.package_id, BridalGroup.packageId/packageName, BridalGroupFieldsInput.packageId]
affects: [BridalGroupFormDialog, BridalGroupDetailPage, ContractFormDialog]
tech-stack:
  added: []
  patterns: ["packageId tratado à parte de validateGroupFields: omitido = mantém, null = limpa"]
key-files:
  created:
    - apps/backend/prisma/migrations/20261104020000_bridal_group_package/migration.sql
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/graphql/schema/bridal.graphql
    - apps/backend/src/bridal/bridal-serialize.ts
    - apps/backend/src/bridal/bridal.service.ts
    - apps/backend/test/integration/phase4-bridal-group.e2e.spec.ts
    - apps/frontend/src/features/bridal/api/bridal.api.ts
    - apps/frontend/src/features/bridal/api/contracts.api.ts
    - apps/frontend/src/features/bridal/components/BridalGroupFormDialog.tsx
    - apps/frontend/src/features/bridal/components/ContractFormDialog.tsx
    - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx
    - apps/frontend/src/features/bridal/__tests__/bridal-fixtures.ts
    - apps/frontend/src/features/bridal/__tests__/bridal-groups-page.test.tsx
    - apps/frontend/src/features/bridal/__tests__/bridal-group-detail.test.tsx
    - apps/frontend/src/features/bridal/__tests__/contracts-page.test.tsx
decisions:
  - "FK nomeada fk_bridal_groups_package (convenção fk_* do projeto, não o default do Prisma — o schema já diverge do diff do Prisma em todos os FKs)"
  - "Pacote soft-deleted continua exibindo o nome no grupo (histórico); no formulário aparece como opção extra para não perder o valor"
  - "Serviços do pacote só são aplicados à noiva quando o pacote resultante é novo/diferente; nunca remove serviços"
metrics:
  duration: ~75min
  completed: 2026-11-04
  tasks: 2
---

# Quick 261104-hyq: Pacote contratado no grupo de noivas Summary

Agora a dona do salão escolhe o "Pacote contratado" (os 3 pacotes de noiva do catálogo, ou "Sem pacote") direto no grupo de noivas. Isso grava `bridal_groups.package_id`, adiciona os serviços do pacote à noiva como planejados (event) sem duplicar nem remover os que já estavam lá, mostra o nome do pacote no detalhe do grupo e faz o contrato novo aberto a partir do grupo já vir com esse pacote selecionado.

## Tasks

| Task | Nome | Commit |
| ---- | ---- | ------ |
| 1 | Backend: package_id no grupo, validação (PACKAGE_NOT_FOUND) e preenchimento dos serviços da noiva | 7225230 |
| 2 | Frontend: select "Pacote contratado", nome no detalhe, pré-seleção no contrato | 9c9d3ac |

## O que foi feito

- **Migração** `20261104020000_bridal_group_package`: `package_id uuid NULL`, FK `fk_bridal_groups_package` → `packages(id) ON DELETE SET NULL`, índice `ix_bg_package`. A RLS existente de `bridal_groups` cobre a coluna.
- **Backend**: `validatePackage` (mesma org, `deletedAt: null`, senão `PACKAGE_NOT_FOUND` / campo `packageId`); `applyPackageToBrideTx` (adiciona só os serviceIds que a noiva ainda não tem como 'event', com sortOrder depois do maior atual, `skipDuplicates`). Create valida antes de inserir; update respeita omitido/null/string e só aplica serviços quando o pacote muda. SDL: `BridalGroup.packageId/packageName` e `BridalGroupFieldsInput.packageId`.
- **Frontend**: `#bg-package` no formulário reaproveitando a `ContractPackagesQuery`, com o texto de ajuda "Os serviços do pacote entram nos serviços da noiva." O detalhe mostra "Pacote contratado" (ou "—"). No `ContractFormDialog`, o estado inicial usa `group.packageId` quando o pacote ainda está na lista; na edição continua valendo o pacote do contrato.

## Testes adicionados

- Integração (4 casos): criar com pacote sem duplicar; definir no update preservando o trial; rejeitar pacote inexistente, excluído e de outra org; null limpa e omitido mantém.
- Vitest (3 casos): opções do select + `group.packageId` enviado; nome/“—” no detalhe; pré-seleção do pacote no contrato (e '' quando o pacote foi excluído).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste racy em bridal-group-detail.test.tsx**
- **Found during:** gate da Task 2 (vitest completo)
- **Issue:** "mostra a mensagem clara quando o backend recusa a cobertura" usava `findByTestId('members-errors')`, que encontra na hora o contêiner aria-live vazio e verifica o texto uma vez só. Passou ou falhou conforme o timing.
- **Fix:** troquei por `waitFor(() => expect(getByTestId(...)).toHaveTextContent(...))`. Passou em 3 execuções seguidas e no vitest completo.
- **Commit:** 9c9d3ac

**2. [Rule 3 - Blocking] Nome da FK**
- O plano sugeria `bridal_groups_package_id_fkey` para evitar drift. Mas o `prisma migrate diff` mostra que o schema já diverge em todos os FKs (o projeto usa nomes `fk_*` à mão). Segui a convenção do projeto: `fk_bridal_groups_package`.

**3. Ordem TDD no frontend:** os testes da Task 2 foram escritos logo depois da implementação, e não antes. O backend seguiu RED (falha de compilação no spec) → GREEN.

### Notas de ambiente
- O plano não estava no worktree; foi copiado do checkout principal.
- O worktree não tem `.env`. Por isso o E2E rodou com o `/root/sgs/.env` exportado linha a linha (o `process.env` tem precedência no loader do E2E).
- A migração foi aplicada no banco local compartilhado (coluna nullable, compatível com o checkout principal).

## Gate (antes do commit da Task 2; o da Task 1 deu os mesmos números de backend)

- Lint backend e frontend: ok
- Typecheck backend e `tsc -b` frontend: ok
- Jest unit backend: 25 suites, 227/227
- Vitest frontend: 54 arquivos, 359/359 (antes: 356)
- Integração backend: 49 suites, 483/485. Só falha `phase4-alerts-boot` (2 testes, Redis NOAUTH local; permitido). A `phase4-bridal-group` passa 12/12.
- E2E Playwright: 19/19

## Known Stubs

Nenhum.

## Self-Check: PASSED
- FOUND: apps/backend/prisma/migrations/20261104020000_bridal_group_package/migration.sql
- FOUND: commits 7225230, 9c9d3ac
