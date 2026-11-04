---
phase: quick-261104-ky7
plan: 01
subsystem: catalog/contracts/comandas + bridal public
tags: [pacotes, rateio, comissão, contratos, comandas, acessibilidade, react]
requires: [catalog-costs.professionalCostCents, common/money.splitProportional]
provides: [packageUnitWeights, prorateServiceUnits, loadCostContext exportado, dica accept-missing-hint]
affects: [ContractsService.buildItems (pacote), buildPackageItems da comanda, PackagesService, ContractAcceptPage]
tech-stack:
  added: []
  patterns: ["rateio do pacote: preço cheio > repasse > divisão igual"]
key-files:
  created: []
  modified:
    - apps/backend/src/catalog/catalog-costs.ts
    - apps/backend/src/catalog/packages/packages.service.ts
    - apps/backend/src/comandas/comanda-items.ts
    - apps/backend/src/comandas/comanda-items.spec.ts
    - apps/backend/src/contracts/contracts.service.ts
    - apps/backend/test/integration/phase4-contracts-core.e2e.spec.ts
    - apps/frontend/src/features/bridal/public/ContractAcceptPage.tsx
    - apps/frontend/src/features/bridal/__tests__/contract-accept-page.test.tsx
decisions:
  - "Peso do rateio: soma dos preços base > 0 usa o preço base (caso misto igual a hoje); soma 0 usa o repasse de professionalCostCents (sem profissional, regras member_service não entram); repasse todo 0 divide igual"
  - "Contrato e comanda usam o mesmo helper (prorateServiceUnits); loadCostContext só é consultado quando todos os preços base são 0"
  - "Comissão no fechamento da comanda continua sobre o preço cheio (D-23); listUnitPrice continua sendo o preço cheio"
  - "Dica do aceite sem aria-live/role=alert (evita anúncio a cada tecla); só a descrição acessível do botão"
metrics:
  duration: ~70min
  completed: 2026-11-04
---

# Quick 261104-ky7: Rateio do pacote pelo repasse e dica no aceite — Summary

Pacotes cujos serviços não têm preço avulso (base_price 0, caso dos pacotes de noiva do Studio JS) agora têm o preço rateado pelo repasse de cada serviço; sem repasse, o preço é dividido igualmente (centavos inteiros, resto na última linha). A página pública de aceite passa a explicar o que falta para habilitar "Aceito".

## Tasks

| Task | Descrição | Commit |
|------|-----------|--------|
| 1 | `loadCostContext` movido para `catalog-costs.ts`; `packageUnitWeights` (puro) + `prorateServiceUnits` (com tx) em `comanda-items.ts`, usados em `buildPackageItems` e nos itens da noiva do contrato; 7 testes unitários; 2 testes de integração (repasse 120/80 em pacote de R$ 2.800 → 1680/1120; sem repasse em R$ 100 com 3 unidades → 33.33/33.33/33.34) | 2958505 |
| 2 | `ContractAcceptPage`: "Para aceitar, falta: nome completo, CPF válido e marcar “Li e aceito”." abaixo do botão, ligado por `aria-describedby="accept-missing-hint"`, some quando válido ou enviando; teste vitest dos três estados | dd2739d |

## Gate

- Backend: lint ok, typecheck ok, jest unitário 25 suítes / 234 testes.
- Frontend: lint ok, `tsc -b` ok, vitest 54 arquivos / 360 testes.
- Integração (com /root/sgs/.env e `prisma migrate deploy`): 48/49 suítes, 488/490 testes; as 2 falhas são de phase4-alerts-boot (Redis NOAUTH, só do ambiente, exceção permitida).
- E2E Playwright: 19/19.

## Observações

- Sem migração e sem backfill: contratos e comandas já gravados não mudam. O CT-2026-001 do staging só é recalculado quando a usuária editar o contrato (o update recalcula os itens do pacote).
- Para o rateio pelo repasse, as regras de comissão dos serviços de noiva precisam estar cadastradas (por serviço, categoria ou padrão fixo). Sem regra, ou só com regra percentual (que dá 0 sobre preço 0), a divisão sai igual.
- Os testes de integração novos apagam no afterEach as regras, pacotes e serviços que criaram (o afterEach do arquivo só limpa linhas da Fase 4).

## Deviations from Plan

Nenhuma. O plano foi executado como escrito.

## Known Stubs

Nenhum.

## Self-Check: PASSED
