---
phase: quick-261104-ix0
plan: 01
subsystem: bridal
tags: [noivas, pacotes, contratos, prisma, migração, react]
requires: [quick-261104-hyq (bridal_groups.package_id + applyPackageToBrideTx)]
provides: [applyPackageToBrideTx compartilhado, syncGroupPackageTx no ContractsService, backfill 20261104030000]
affects: [ContractsService.create/update, BridalService, ContractFormDialog]
tech-stack:
  added: []
  patterns: ["contrato propaga o pacote ao grupo só quando há pacote novo ou o grupo está sem pacote"]
key-files:
  created:
    - apps/backend/src/bridal/bridal-package.ts
    - apps/backend/prisma/migrations/20261104030000_bridal_group_package_backfill/migration.sql
  modified:
    - apps/backend/src/bridal/bridal.service.ts
    - apps/backend/src/contracts/contracts.service.ts
    - apps/backend/test/integration/phase4-contracts-core.e2e.spec.ts
    - apps/frontend/src/features/bridal/components/ContractFormDialog.tsx
decisions:
  - "Update do contrato só grava o pacote no grupo quando o pacote final não é nulo E (mudou em relação ao anterior OU o grupo está sem pacote); editar desconto/outros campos não sobrescreve o pacote escolhido no grupo (emenda do orquestrador)"
  - "Limpar o pacote no contrato não limpa o grupo nem remove serviços da noiva"
  - "Backfill ignora contratos cancelados e pacotes excluídos; usa o contrato vivo mais recente do grupo"
metrics:
  duration: ~55min
  completed: 2026-11-04
---

# Quick 261104-ix0: Pacote do contrato vale para o grupo — Summary

O pacote escolhido no diálogo do contrato agora grava `bridal_groups.package_id` e adiciona os serviços do pacote à noiva (purpose 'event', sem remover nada). Uma migração só de dados corrige os grupos que já existem (caso ALINE SANTOS / CT-2026-001), e o diálogo do contrato refaz `BridalGroupQuery` depois de salvar.

## Tasks

| Task | Descrição | Commit |
|------|-----------|--------|
| 1 | `applyPackageToBrideTx` movido para `bridal/bridal-package.ts`; `syncGroupPackageTx` no ContractsService (create/update, antes de `syncContractCoverageTx`); 3 testes de integração (criar, trocar + limpar, editar só desconto) | 4ca1ddd |
| 2 | Migração `20261104030000_bridal_group_package_backfill` + refetch de `BridalGroupQuery` no ContractFormDialog | ee28378 |

## Regra do syncGroupPackageTx

- create: se o contrato tem pacote, grava no grupo e aplica os serviços na noiva.
- update: só quando o `packageId` final não é nulo e (é diferente do `packageId` anterior do contrato **ou** o grupo está com `package_id` NULL).
- pacote nulo: nada acontece (o grupo e os serviços ficam como estão).

## Verificação

- TDD: os 3 testes novos falharam com o helper desativado (RED) e passaram com ele (GREEN).
- Backfill testado num spec temporário (não commitado) com as fixtures da Fase 4, rodando o SQL do arquivo duas vezes:
  - grupo sem pacote + contrato `active` com pacote, noiva já com o serviço B → grupo recebe o pacote, a noiva ganha o serviço A com `sort_order` 6 (depois do 5), sem duplicar o B; a acompanhante fica sem nada;
  - contrato `cancelled` → grupo continua sem pacote;
  - grupo que já tinha outro pacote → não é sobrescrito;
  - a segunda execução não muda nada (idempotente).
- `prisma migrate deploy` aplicou a migração no banco local; depois dela a consulta de candidatos retorna 0.
- `uq_bms_member_service_purpose` confirmada como CONSTRAINT (então `ON CONFLICT ON CONSTRAINT` é válido).

### Gate (antes de cada commit)

- backend lint + typecheck: limpos
- frontend lint + `tsc -b`: limpos
- backend jest unitário: 227/227 (25 suites)
- frontend vitest: 359/359 (54 arquivos)
- backend integração: 486/488 (48/49 suites) — só `phase4-alerts-boot` falhou (2 testes, Redis NOAUTH, do ambiente)
- E2E Playwright: 19/19

## Deviations from Plan

- **[Emenda do orquestrador]** No update o pacote só é propagado quando muda ou quando o grupo está sem pacote (o plano propagava sempre). Coberto pelo teste "editar só o desconto não sobrescreve o pacote escolhido no grupo", que também confere que reenviar o mesmo pacote não sobrescreve e que um grupo sem pacote volta a receber o do contrato.
- **[Rule 2]** O backfill faz JOIN em `packages` com `deleted_at IS NULL`, para não ligar um grupo a um pacote excluído (o serviço também rejeita pacotes excluídos).
- O teste de troca usa um pacote extra só com o serviço B → `w.bridalPackageId` (A+B), em vez de criar um 3º serviço; os pacotes extras são apagados pelo cleanup da Fase 3 em nível de organização.
- O ContractFormDialog não tem teste vitest direto, então não foi preciso adicionar mock de `BridalGroupQuery`.

## Observações

- `prisma migrate diff` (banco → schema) já mostra diferenças antes desta quick (nomes de FK do SQL cru vs schema Prisma). Não tem relação com esta migração, que só mexe em dados.
- O caso ALINE SANTOS / CT-2026-001 no staging só é corrigido quando a migração rodar lá (deploy fora deste quick).

## Known Stubs

Nenhum.

## Self-Check: PASSED
