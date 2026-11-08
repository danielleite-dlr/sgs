---
phase: quick-261108-n2o
plan: 01
status: complete
completed: 2026-11-08
requirements: [QUICK-261108-n2o]
subsystem: contratos / noivas / comandas / catálogo
tags: [pacote, contrato, cobertura, comanda, pdf, noivas]
key-files:
  created:
    - apps/backend/prisma/migrations/20261108000000_package_trial_included/migration.sql
    - apps/backend/src/bridal/bridal-coverage.spec.ts
    - apps/backend/src/contracts/acceptance/pdf/contract-layout.spec.ts
    - apps/frontend/src/features/catalog/__tests__/pacote-includes-trial.test.tsx
    - apps/e2e/tests/pacote-teste-incluso.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/contracts/contracts.service.ts
    - apps/backend/src/bridal/bridal-coverage.ts
    - apps/backend/src/bridal/bridal-package.ts
    - apps/backend/src/comandas/comanda-serialize.ts
    - apps/backend/src/contracts/domain/contract-snapshot.ts
    - apps/backend/src/contracts/acceptance/pdf/contract-layout.ts
    - apps/frontend/src/features/catalog/components/PackageServicesPicker.tsx
    - apps/frontend/src/features/operations/pages/ComandaPage.tsx
decisions:
  - "Marca por serviço do pacote (package_services.includes_trial) e marca no item do contrato (contract_items.settled_at_event): o contrato não depende de o pacote mudar depois e o teste avulso continua cobrado no dia"
  - "Cobertura por um helper puro (agreedUnitCents): teste incluso = 0, evento = evento + teste incluso; usado por coveragePriceMapTx e syncContractCoverageTx"
  - "Snapshot só ganha budget.package.includedTrials quando não vazio: snapshots e hashes já gravados não mudam"
  - "Previsão de caixa sem mudança de código: agendamento ligado a contrato não gera entrada; travado por teste de integração"
metrics:
  tasks: 3
  commits: 2
---

# Quick 261108-n2o: teste da noiva incluso no pacote (resumo)

Nos pacotes marcados, o serviço com "Inclui teste" vira dois itens da noiva no contrato novo:
evento (`Maquiagem noiva (pacote X)`) e teste (`… — teste incluso, pago no evento`), com metade
do valor rateado em cada um e o centavo ímpar no evento. Total, sinal e parcelas não mudam.
A comanda do teste coberta sai a R$ 0,00 com o aviso "Teste incluso no pacote — pago no evento",
e a do evento cobra as duas metades (a soma das comandas cobertas bate com o contrato).
O PDF e o texto do contrato mostram `Inclui: Maquiagem noiva (teste — incluso, pago no evento)`.

## Commits
- `4783a6a` feat(quick-261108-n2o): teste da noiva incluso no pacote (contrato, cobertura, PDF)
  (Tasks 1 e 2: migration + backfill, regra no contrato, linha `trial` da noiva, cobertura,
  `includedInEvent` na comanda, snapshot/PDF, testes unit e de integração)
- `d53a1fe` feat(quick-261108-n2o): opção "Inclui teste" no pacote e aviso na comanda
  (Task 3: checkbox por serviço no formulário do pacote, badge na comanda, vitest e E2E)

## O que mudou
- **Banco** (`20261108000000_package_trial_included`): `package_services.includes_trial` e
  `contract_items.settled_at_event` (boolean, default false). O backfill liga a marca em
  "Maquiagem noiva" e "Penteado noiva" de Essence, Experience e Glam da org Studio JS
  (`01a0b681-…`). Em dev e CI a org não existe e o UPDATE não altera nada. Nenhum contrato é
  reescrito.
- **Catálogo**: `PackageServiceItem.includesTrial: Boolean!` e `PackageServiceInput.includesTrial`
  (omitido = false). O update recria as linhas com o valor enviado.
- **Contrato** (`buildItems`): no ramo do pacote cada unidade com `includesTrial` gera o par
  evento + teste. No ramo explícito (update pelo formulário), `settledAtEvent` só se mantém se o
  item casado já era incluso e continua ligado ao pacote (`packageItem: false` vira teste
  avulso). `ContractItem.settledAtEvent: Boolean!` no GraphQL.
- **Noiva do grupo** (`applyPackageToBrideTx`): também ganha a linha `trial` dos serviços com
  teste incluso, para o teste aparecer no agendamento. Não duplica e não remove nada.
- **Cobertura** (`agreedUnitCents`): teste incluso = 0; evento = 1º item de evento + 1º teste
  incluso do mesmo (pessoa, serviço). Com quantidade > 1 do mesmo serviço, a pareação usa o
  primeiro item de cada finalidade, como o `.find` que já existia (fica documentado no código).
- **Comanda**: `ComandaItem.includedInEvent` = item com contrato, agendamento `trial` e total 0
  (heurística só de exibição; fechamento e `covered` não mudam).
- **Snapshot/PDF**: `SnapshotItemInput.settledAtEvent` e `budget.package.includedTrials` (só
  quando não vazio). Linha "Inclui: …" no texto e no subtexto do pacote no PDF, juntando com " · "
  porque o subText do pdf-table não quebra linha.
- **Previsão de caixa**: nenhuma mudança de código. O teste `7b` confirma que nada entra na data
  do teste e que as receitas são iguais às de um contrato equivalente sem teste.

## Gate (antes de cada commit; Postgres local sgs_dev 5433, .env carregado linha a linha)
Commit 1 (`4783a6a`, rodado com as mudanças de frontend/E2E guardadas em stash):
- backend: lint ok, tsc ok, jest unit 382/382 (34 suítes), integração 607/609 (55/56 suítes)
- frontend: lint ok, tsc ok, vitest 690/690 (97 arquivos)
- E2E: 41/41 passaram

Commit 2 (`d53a1fe`):
- backend: lint ok, tsc ok, jest unit 382/382 (34 suítes), integração 607/609 (55/56 suítes)
- frontend: lint ok, tsc ok, vitest 693/693 (98 arquivos)
- E2E: 42/42 passaram (inclui o novo `pacote-teste-incluso.spec.ts`)

As 2 falhas de integração são sempre as mesmas, em `phase4-alerts-boot` ("Exceeded timeout" no
hook). A causa é o Valkey local: `sgs_valkey` responde `NOAUTH Authentication required` até para
`valkey-cli ping` dentro do container, e o `REDIS_URL=redis://localhost:6379` do .env não tem
senha. É do ambiente, não desta mudança, e já aparece nos resumos de 261104-hyq, 261104-ix0,
261104-ky7, 261105-c26 e 261106-cst. As suítes desta tarefa passaram (catalog-packages,
phase4-contracts-core, phase4-bridal-group, phase4-comanda-contract, phase5-forecast,
phase41-contract-preview, phase41-contract-version).

`prisma migrate diff --exit-code` sai com 2, mas só por drift antigo de nomes de
constraints/índices (FKs, PKs, `uq_*` renomeados). Nada sobre `includes_trial` ou
`settled_at_event`, ou seja, as colunas novas não criaram drift.

## Desvios do plano
1. **[Escopo do orquestrador] Push, backup, deploy-staging e conferência do staging (Task 3,
   passos 8 e 9) não foram feitos aqui**, por instrução do orquestrador. Ficam com ele: `git push`,
   backup do banco do staging em /root/sgs-backups/ (tem migration), `./scripts/deploy-staging.sh`,
   CI e a consulta somente leitura do passo 9 (esperado: 6 linhas `includes_trial = true` e
   0 `contract_items` com `settled_at_event`).
2. **STATE.md e ROADMAP.md não foram mexidos**: o orquestrador atualiza o STATE.
3. **[Regra 2] Descrição do teste incluso mantida no update**: no update pelo formulário a
   descrição dos itens vira o nome do serviço (comportamento antigo). Para o teste incluso não
   ficar igual ao evento na tela, ele passa a usar `<serviço> — teste incluso, pago no evento`.
4. **Zod `includesTrial: z.boolean()` em vez de `.default(false)`**: evita diferença entre os
   tipos de entrada e saída no `useForm`. O padrão false é aplicado no `initial` e no picker.
5. **E2E em spec novo** (`pacote-teste-incluso.spec.ts`), opção prevista no plano. Para ir a
   Contratos o teste usa `page.goto('/contratos')`: na primeira versão, `navigateViaMenu('Eventos',
   'Contratos')` logo depois de fechar o diálogo do pacote com Escape não achou o link em 15 s.
   A causa não foi investigada; o restante do teste não depende do menu.
6. **Teste extra**: `contract-layout.spec.ts`, com o subtexto do pacote e a renderização do PDF
   com o teste incluso. Para isso `packageSubText` passou a ser exportado.
7. **TDD**: os testes foram escritos junto com o código, não estritamente antes (sem rodada RED
   separada). Os casos do `<behavior>` estão todos cobertos.

## Observação para a usuária
CT-2026-001 (ativo, Experience) e os 4 rascunhos Glam continuam sem o teste separado: contratos
existentes não são reescritos. Para aplicar a regra num rascunho, é preciso recriá-lo. Editar o
contrato não cria o teste.

## Self-Check: PASSED
- Arquivos criados conferidos no disco (migration, specs, E2E, este resumo)
- Commits `4783a6a` e `d53a1fe` presentes no master local
