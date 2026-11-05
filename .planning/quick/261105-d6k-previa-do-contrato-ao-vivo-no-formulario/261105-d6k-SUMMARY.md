---
phase: quick-261105-d6k
plan: 01
subsystem: bridal-contracts
tags: [contratos, pdf, previa, graphql, transacao, frontend, e2e]
requires: [quick-261105-c26, 04.1-06]
provides:
  - "Query contractPreviewPdf (contract.write): PDF do contrato montado com os dados do formulário, sem gravar nada"
  - "Painel de prévia em PDF no ContractFormDialog (lg+) e botão Ver prévia no celular"
affects: [contracts, bridal]
key-files:
  created:
    - apps/backend/src/contracts/acceptance/contract-preview.resolver.ts
    - apps/backend/test/integration/phase41-contract-preview.e2e.spec.ts
    - apps/frontend/src/features/bridal/components/ContractPreviewPanel.tsx
    - apps/frontend/src/features/bridal/lib/contract-preview.ts
    - apps/frontend/src/features/bridal/lib/use-contract-preview.ts
    - apps/frontend/src/lib/use-media-query.ts
    - apps/frontend/src/features/bridal/__tests__/contract-preview.test.tsx
    - apps/e2e/tests/contrato-previa.spec.ts
  modified:
    - apps/backend/src/contracts/contracts.service.ts
    - apps/backend/src/contracts/acceptance/contract-acceptance.module.ts
    - apps/backend/src/graphql/schema/contract-documents.graphql
    - apps/frontend/src/features/bridal/api/contracts.api.ts
    - apps/frontend/src/features/bridal/components/ContractFormDialog.tsx
    - apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx
decisions:
  - "Prévia = create/update reais (createTx/updateTx) dentro de runWithTenant, desfeitos por erro sentinela (PreviewRollback); não há builder puro duplicando as regras"
  - "Transporte: query GraphQL com o PDF em base64 (mesmo padrão e RBAC/tenant do contractPdf), sem rota REST nova"
  - "Marca de prévia pelo notice já existente do layout ('PRÉVIA — não é o contrato final'), sem mexer no renderizador"
  - "No modo prévia: código descartável PRV-<hex> (não toca contract_sequences), itens podem faltar e não há auditoria"
  - "Prévia sem parcela de R$ 0,00: com o sinal ainda vazio o input da prévia não leva installments (o backend usa o sinal sugerido ou nenhum)"
metrics:
  completed: 2026-11-05
---

# Quick 261105-d6k: prévia do contrato ao vivo no formulário

Enquanto preenche Contratos > Novo contrato (ou edita um rascunho, ou cria pelo grupo), a usuária vê o PDF do contrato no modelo Studio JS: A4, papel timbrado em todas as páginas, tabelas e cláusulas. Ele sai do mesmo renderizador do "Baixar PDF" e traz o quadro "PRÉVIA — não é o contrato final" depois das assinaturas. Em telas largas o PDF fica ao lado do formulário e se atualiza cerca de 1 s depois da última mudança, ou pelo botão "Atualizar prévia". No celular, o botão "Ver prévia" gera o PDF e o abre numa nova aba. Nada é gravado.

## O que foi feito

1. **Backend (commit 3258408)**
   - `ContractsService`: o corpo de `create`/`update` foi extraído para `createTx`/`updateTx`, sem mudar o comportamento (`create`/`update` só envolvem com `runWithTenant` + `loadContractView`).
   - `preview(orgId, memberId, input)`: exige exatamente um entre `contractId`, `groupId` e `newGroup` (senão `GROUP_REQUIRED`). Roda `createTx`/`updateTx` em modo `'preview'`, monta o snapshot com `buildLiveSnapshotTx`, carrega o timbrado e o nome da org e lança `PreviewRollback`. O Prisma desfaz a transação e o resultado sai no erro. `ContractError`/`BridalError` viram `{ errors }`.
   - Modo prévia: código `PRV-<12 hex>` no lugar de `nextContractCode`; `ITEMS_REQUIRED` não é lançado (orçamento zerado); `recordAudit` é pulado; o snapshot devolvido tem `code: 'PRÉVIA'`.
   - SDL `ContractPreviewInput` / `ContractPreviewPdf` / `contractPreviewPdf` e `ContractPreviewResolver` (`CONTRACT_WRITE`): `ContractPdfService.render` com `notice` de prévia, `acceptance: null` e nome `PREVIA - <NOIVA_NOME_DATA_PACOTE>.pdf`. `ContractAcceptanceModule` importa `ContractsModule` (sem ciclo).
   - Integração `phase41-contract-preview.e2e.spec.ts` com 7 testes: PDF válido (`%PDF-`); zero vazamento em 3 prévias (newGroup, groupId e contractId com token vivo), comparando contracts, contract_items, parcelas, contract_versions, bridal_groups, membros, serviços dos membros, clients, audit_log, tokens não revogados e `contract_sequences`, tudo igual, e o `createContract` real seguinte recebe `CT-<ano>-001`; conteúdo do snapshot (PRÉVIA, serviço, total com desconto, à vista; `items: []` sem erro); `contractId` sobrepõe o rascunho e o banco fica com o desconto antigo e a mesma `currentVersion`; erros no payload (parcelas com o mesmo código do `createContract`, `GROUP_HAS_CONTRACT`, `GROUP_REQUIRED` com 0 ou 2 alvos); timbrado no PDF; RBAC (atendente: FORBIDDEN) e RLS (outra org: `GROUP_NOT_FOUND`).
2. **Frontend (commit 567e9ef; correção be7c1c4)**
   - `lib/contract-preview.ts`: `base64ToBlob` (movido do `ContractDetailPage`), `buildContractSaveInput` (fonte única do input; o `submit()` passou a usá-la) e `buildContractPreviewInput`.
   - `lib/use-contract-preview.ts`: debounce de 1 s, `fetchPolicy: 'no-cache'`, contador para aplicar só a resposta mais recente, revoga o blob anterior e o atual ao desmontar; não registra nada do input/PDF.
   - `ContractPreviewPanel` (iframe `contract-preview-frame`, "Gerando prévia…" com `aria-live`, "Atualizar prévia", mensagem de erro sem apagar o último PDF, estado vazio "Informe a cliente e a data do evento para gerar a prévia.") e `ContractPreviewButton` (celular: abre a aba no clique e depois aponta para o blob; sem janela, baixa).
   - `ContractFormDialog`: `lg:max-w-[1400px]`; em lg+ o grid tem o formulário (rolagem própria, 75vh) e o painel (75vh); fora disso, "Ver prévia" no rodapé. `useMediaQuery` novo em `src/lib`.
   - Vitest `contract-preview.test.tsx` com 6 testes.
3. **E2E (commit a20e500)**: `contrato-previa.spec.ts`. Em desktop: PDF em blob com `%PDF-` e mais de 10 kB (timbrado), troca ao mudar o desconto e no "Atualizar prévia", e cancelar não deixa contrato, grupo nem cliente com o nome da noiva. No celular: sem iframe, e "Ver prévia" abre uma aba nova que vai para o blob (ou baixa o PDF, quando o navegador não tem visualizador), também sem gravar nada.

## Efeitos colaterais auditados (por que o rollback é seguro)

Tudo o que `create`/`update` gravam usa o `tx` do `runWithTenant`: grupo, membros, cliente nova e responsável (`createBridalGroupTx`), itens, parcelas, `contract_versions`, `audit_log` (pulado na prévia), `bridal_member_services`, `syncGroupPackageTx`, `syncContractCoverageTx` e a revogação de tokens no update. Nenhum deles envia e-mail, usa fila BullMQ ou emite eventos. Os alertas rodam por scheduler lendo o banco, então nunca veem um contrato que não foi confirmado. O teste de zero vazamento confirma isso pelas contagens.

## Medições (integração local, PDF de prévia)

- Sem papel timbrado: cerca de 9,8 kB. Com o timbrado do Studio JS (PNG 795×1122): cerca de 69 kB (base64 cerca de 92 kB no payload).
- Tempo de resposta da query com timbrado: cerca de 340 ms (transação + render). Sem timbrado: 300 a 360 ms.

## Riscos aceitos

- A prévia com `groupId` insere uma linha em `contracts` e toca o índice parcial `uq_contracts_group_live`. Uma criação real do MESMO grupo ao mesmo tempo espera a prévia terminar (cerca de 100 a 350 ms).
- A prévia de edição (`contractId`) pega `FOR UPDATE` no contrato pelo mesmo tempo.
- Cada mudança gera uma query (debounce de 1 s) com cerca de 90 kB de resposta quando há timbrado. É aceitável para uma única usuária editando; não há cache.

## Gates

Rodados antes de cada commit; a última rodada completa foi antes de be7c1c4/a20e500:

- Backend: lint ok, typecheck ok, jest unit 336/336 (31 suítes), integração 571/573 (53 suítes). As 2 falhas são as pré-existentes de `phase4-alerts-boot` (Redis NOAUTH). `phase2-modules-boot` passou nesta máquina. O spec novo tem 7/7.
- Frontend: lint ok, `tsc -b` ok, vitest 419/419 (60 arquivos; 6 novos em `contract-preview.test.tsx`).
- E2E: `tsc --noEmit` ok; Playwright completo 27/27 (seed + 26), incluindo os 2 novos de `contrato-previa.spec.ts` e os specs de contrato antigos (`contrato-pela-noiva`, `noivas-contrato`, `debutante-contrato`).
- `acceptance/pdf/contract-layout.ts` não foi tocado; no fluxo de gravação, a única mudança é a extração createTx/updateTx mais os 3 desvios explícitos do modo prévia.

## Desvios do plano

- **[Rule 1] Prévia falhava com o sinal vazio (be7c1c4).** No modo padrão "Sinal" sem valor digitado, o input do formulário leva uma parcela de R$ 0,00 e o backend responde `INSTALLMENT_INVALID`. A prévia não saía até a usuária preencher o sinal, o que contraria "campos vazios saem como lacuna, sem bloquear a prévia". `buildContractPreviewInput` omite `installments` quando nenhuma parcela tem valor (o Salvar segue igual). Coberto no vitest e no E2E (o E2E não preenche o sinal).
- **[Rule 3] E2E sem pacote.** Com pacote, o novo contrato esconde "adicionar item" (os itens da noiva vêm do pacote). O spec então adiciona um item avulso e não escolhe pacote.
- **[Rule 3] "Ver prévia" no Chromium headless.** Sem visualizador de PDF, a aba nova baixa o blob em vez de exibir (a URL fica `about:blank`). O E2E aceita as duas saídas, aba no `blob:` ou download do `blob:`, e confere que o arquivo baixado começa com `%PDF-`. Muitos Android se comportam do mesmo jeito, e o resultado (o PDF aberto ou baixado) atende o pedido.
- **API dos componentes:** o plano pedia um `ContractPreviewPanel` recebendo `input | null`. Ficou `useContractPreview` no `ContractForm` (em `lib/use-contract-preview.ts`, por causa da regra `react-refresh/only-export-components`), compartilhado por `ContractPreviewPanel` (lg+) e `ContractPreviewButton` (celular). O comportamento é o mesmo do plano.
- **Formatação:** os arquivos tocados não seguem o prettier padrão (o repo não tem config). Os arquivos novos usam aspas simples e largura 100, como os vizinhos. No `ContractFormDialog` a coluna do formulário foi para uma constante (`formColumn`), para não reindentar o JSX inteiro.
- **TDD:** o spec de integração e o vitest foram escritos antes da implementação correspondente, mas rodaram pela primeira vez já com o código pronto (não houve uma execução RED isolada).

## Pendências

- Nenhuma do plano. Ficam como sugestões: se a prévia ficar pesada em produção (cerca de 90 kB por atualização com timbrado), dá para cachear o PDF pelo hash do input ou subir o debounce. A verificação visual no navegador real (iframe do PDF ao lado do formulário) foi feita só por E2E/headless.

## Self-Check: PASSED

Arquivos criados presentes; commits 3258408, 567e9ef, be7c1c4 e a20e500 no histórico; `contract-layout.ts` intacto.
