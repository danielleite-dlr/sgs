---
phase: 04-bridal-contracts
plan: 06
subsystem: backend-contracts
tags: [graphql, contracts, nestjs, prisma, rls]
requires: [04-01, 04-02]
provides:
  - contracts.graphql (Contract, ContractSettings, createContract/updateContract/generateContractLink)
  - ContractsService, ContractSettingsService (loadEffectiveSettings)
  - lockContract, loadContractView(s), renderContractVersionTx, nextContractCode
  - depositKind/depositValue em Package
affects: [04-09, 04-10, 04-11, 04-14]
tech-stack:
  added: []
  patterns: [UPSERT atômico de sequência, FOR UPDATE por contrato, status derivado na leitura, token só como hash sha256]
key-files:
  created:
    - apps/backend/src/graphql/schema/contracts.graphql
    - apps/backend/src/contracts/contracts.service.ts
    - apps/backend/src/contracts/contracts.resolver.ts
    - apps/backend/src/contracts/contract-settings.service.ts
    - apps/backend/src/contracts/contract-code.ts
    - apps/backend/src/contracts/contract-lock.ts
    - apps/backend/src/contracts/contract-render.ts
    - apps/backend/src/contracts/contract-serialize.ts
    - apps/backend/src/contracts/contract-errors.ts
    - apps/backend/test/integration/phase4-contracts-core.e2e.spec.ts
    - apps/backend/test/integration/phase4-contract-settings.e2e.spec.ts
  modified:
    - apps/backend/src/contracts/contracts.module.ts
    - apps/backend/src/catalog/packages/packages.service.ts
    - apps/backend/src/catalog/packages/dto/package.input.ts
    - apps/backend/src/graphql/schema/catalog.graphql
key-decisions:
  - "Prazo do restante é sempre recalculado do event_date atual do grupo ao editar o contrato (o 04-05 não propaga mudança de data ao contrato)"
  - "Pré-checagem de contrato vivo no grupo (GROUP_HAS_CONTRACT) além do índice único parcial como rede de segurança para corrida"
  - "Itens do pacote são gravados um por unidade (quantity 1) com rateio por prorateUnits"
  - "Horários da janela do dia lidos via to_char(HH24:MI) em SQL cru (coluna TIME)"
requirements-completed: []
duration: ~60min
completed: 2026-11-04
---

# Phase 4 Plan 06: Núcleo do contrato da noiva Summary

Contrato de noiva criável e editável com itens por pessoa coberta, desconto, entrada (R$ ou % do pacote), prazo do restante = evento - N dias, snapshot da política, versões de texto com sha256, código CT-AAAA-NNN sem buracos, link de aceite de 30 dias (só o hash no banco) e status derivado (pago, saldo, vence em 3 dias, vencido) calculado na leitura.

## Commits
- af3b498 entrada no pacote e configurações do contrato da org
- 8325f43 criar/editar contrato, código CT, versões com hash e link de aceite
- d184c74 SDL do contrato, resolver e suíte de integração do núcleo

## Verificação
Lint e typecheck limpos; 188 testes unitários; integração `phase4` + `catalog-packages`: 6 suítes, 36 testes verdes (core com 10 casos, incluindo 10 criações concorrentes).

## Deviations from Plan
Nenhuma de regra. Observações:
- `contract-serialize.ts` foi commitado junto com a Task 2 porque o serviço depende dele para compilar; SDL, resolver e spec ficaram na Task 3.
- Resolver e módulo receberam as configurações já na Task 1 (necessário para testá-las por GraphQL).
- Pendência para outros planos: `updateBridalGroup` (04-05) não atualiza o contrato ao mudar `eventDate`; o prazo só é recalculado quando o contrato é editado (`updateContract`). Quem alterar a data do evento deve acionar a recalculação (04-08/04-14).
- Serviço não tem flag "ativo"; usa-se `deletedAt IS NULL`.

## Known Stubs
Nenhum.

## Self-Check: PASSED
