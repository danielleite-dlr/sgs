# Quick Task 261105-d6k: prévia do contrato ao vivo no formulário - Context

**Gathered:** 2026-11-05
**Status:** Ready for planning

<domain>
## Task Boundary

Pedido da usuária: "falta, conforme o preenchimento, a usuária ter a visualização do contrato preenchido".

No formulário de contrato (ContractFormDialog — tanto Contratos › Novo contrato, do quick 261105-c26, quanto a edição de rascunho e o caminho `?grupo=<id>`), mostrar uma prévia do contrato montado com os dados preenchidos até o momento, atualizada enquanto ela preenche — antes de salvar.

</domain>

<decisions>
## Implementation Decisions

### Formato da prévia (REVISADO pela usuária: "seguir conforme a referência passada")
- A prévia deve seguir o modelo de referência do Studio JS (`.planning/phases/04.1-layout-e-regras-do-contrato-modelo-studio-js/04.1-REFERENCE-modelo-studio-js.md`): folha A4 com o papel timbrado da org em todas as páginas (opacidade 0,8), margens 40/30/20 mm, Helvetica 9,5 pt, tabelas Contratante/Orçamento/Forma de pagamento na página 1, cláusulas II–VIII, local/data e assinaturas na página 2.
- NÃO usar o visual da página pública (ContractDocument) como prévia. A forma de garantir fidelidade é mostrar o PRÓPRIO PDF gerado pelo mesmo renderizador do "Baixar PDF" (fase 04.1-06, pdf structured layout), a partir do snapshot de prévia.
- Em telas largas (lg+): formulário à esquerda e o PDF da prévia à direita (visualizador embutido — iframe/object com blob URL, ou pdf.js se o iframe não for confiável), diálogo mais largo. Em telas estreitas/celular: botão "Ver prévia" que abre o PDF (nova aba/tela cheia), porque iframe de PDF no celular é instável.
- Atualização automática com debounce (~1 s) após mudanças + botão "Atualizar prévia"; indicador de "gerando prévia"; manter o último PDF visível enquanto gera o próximo. Campos vazios saem como lacuna no PDF (como no gerador atual), sem bloquear a prévia. Marca "PRÉVIA — não é o contrato final" discreta no PDF de prévia (ex.: no lugar do código) sem invadir cabeçalho/filete/rodapé do papel timbrado.

### Backend
- Nova query GraphQL somente leitura (ex.: `contractPreview(input: ContractPreviewInput!): ContractPreviewPayload`), permissão `contract.read` ou `contract.write` (o que o form já exige), que monta o `ContractSnapshot` a partir do input SEM gravar nada.
- Aceita as mesmas formas do formulário: `newGroup` (fluxo novo), `groupId` (grupo existente) e `contractId` (edição de rascunho — dados do input sobrepõem o contrato).
- Abordagem recomendada: reaproveitar a validação/cálculo existentes (ContractsService.create/update + `buildLiveSnapshotTx` em `contracts/contract-render.ts`) dentro de `runWithTenant` e desfazer a transação ao final (rollback via erro sentinela), para não duplicar regras de itens, pacote, desconto, sinal/parcelas e textos. Garantir que nada vaze: sequência do código do contrato (ContractSequence é tabela, volta no rollback), cliente nova do `newGroup`, auditoria, outbox/eventos, alertas e e-mails não podem ser disparados — conferir efeitos colaterais fora da transação e bloqueá-los no modo prévia. Se o rollback se mostrar inviável, extrair um builder puro compartilhado.
- O código do contrato na prévia pode ser um marcador ("prévia") em vez de consumir número.

### Claude's Discretion
- Transporte do PDF de prévia: query GraphQL devolvendo base64, ou rota REST POST autenticada (com RBAC/tenant iguais ao "Baixar PDF") devolvendo application/pdf — escolher a mais simples e segura.
- Detalhes visuais (largura do diálogo, rótulo do indicador).

</decisions>

<specifics>
## Fatos do código

- `contract-render.ts` `buildLiveSnapshotTx(tx, orgId, contractId)` monta o snapshot formato 2 a partir do contrato gravado (lê grupo, itens, parcelas, settings, textos com variáveis).
- `ContractsService.create` (contracts.service.ts) agora aceita `groupId` ou `newGroup` (quick 261105-c26, via `createBridalGroupTx` em bridal.service.ts); itens sem `groupMemberId` vão para a noiva.
- Frontend: `ContractFormDialog.tsx` (~710 linhas, `DialogContent max-w-3xl`), `NewContractEventFields.tsx`, `lib/new-contract.ts`; tipo `ContractSnapshot` em `features/bridal/api/public-contract.api.ts`; PDF público em `contracts/acceptance/public-contract.controller.ts`.
- Gate do projeto: lint + tsc + jest unit + integração (Postgres local sgs_dev 5433/5434; `.env` tem `&` sem aspas em DATABASE_URL — carregar linha a linha; usar `npm test` no backend, não `npx jest`) + vitest + E2E Playwright (`corepack pnpm --filter @sgs/e2e test:e2e`). 3 testes de integração falham localmente por Redis NOAUTH (phase4-alerts-boot x2, phase2-modules-boot DateTime) — pré-existente, ignorar. Branch `master`.

</specifics>

<canonical_refs>
## Canonical References

- .planning/quick/261105-c26-contrato-comeca-pela-noiva-e-cria-o-grup/261105-c26-SUMMARY.md
- .planning/phases/04.1-layout-e-regras-do-contrato-modelo-studio-js/04.1-15-SUMMARY.md (página pública / ContractDocument)

</canonical_refs>
