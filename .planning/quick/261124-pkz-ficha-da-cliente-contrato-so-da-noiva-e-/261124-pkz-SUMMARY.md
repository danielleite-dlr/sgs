---
phase: quick-261124-pkz
plan: 01
subsystem: clientes
tags: [clientes, contratos, historico, comandas, graphql]
key-files:
  modified:
    - apps/backend/src/clients/client-overview.ts
    - apps/backend/src/graphql/schema/clients.graphql
    - apps/backend/test/integration/quick-client-overview.e2e.spec.ts
    - apps/frontend/src/features/clients/api/clients.api.ts
    - apps/frontend/src/features/clients/components/ClientHistoryTab.tsx
    - apps/frontend/src/pages/ClienteDetailPage.tsx
    - apps/frontend/src/features/clients/__tests__/client-situation.test.tsx
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
metrics:
  completed: 2026-11-24
---

# Quick 261124-pkz: ficha da cliente (contrato só da noiva e histórico com abertas)

Acompanhante deixa de ver o contrato da noiva e a aba Histórico passa a mostrar comandas abertas e atendimentos passados em aberto.

## O que mudou

- **Contrato por papel:** `loadClientOverview` só inclui contratos do grupo para quem é noiva (`members.role = 'bride'`) ou responsável do grupo. Quem é `brideClientId` ou `contractorClientId` continua vendo o contrato, qualquer que seja o papel.
- **`openComandas` no overview:** novo tipo GraphQL `ClientOverviewOpenComanda` (código, total, serviços, profissionais, primeiro atendimento). Só comandas `open`.
- **Histórico:** inclui comandas abertas (descrição "(aberta)", data do primeiro atendimento ou `openedAt`) e atendimentos passados scheduled/confirmed/in_progress ("Atendimento em aberto"). Canceladas nunca entram. Filtro de período usa `closedAt` nas fechadas e `openedAt` nas abertas.
- **Frontend:** bloco "Comandas abertas" no topo da aba Histórico (selo "Aberta", link para `/comanda/:id` só se a rota estiver habilitada). O estado vazio só aparece sem itens e sem abertas. O trigger mostra "Histórico (N aberta[s])". A aba Dados continua padrão. A página reusa a query do overview, com cache compartilhado com `ClientSituation`.

## Commits

- a3efe04 fix(clientes): contrato só para a noiva/responsável; overview e histórico com comandas abertas
- a96ea04 feat(clientes): bloco Comandas abertas na aba Histórico e contador no trigger

## Gate

- Backend: lint e tsc limpos; jest unit 662/662; integração 862/863 na primeira rodada. A falha foi `phase3-scheduling-concurrency` (limite de 4500 ms estourado com a máquina carregada). Rodado sozinho passou 5/5. No CI a integração passou.
- Frontend: lint e tsc limpos; vitest 156 arquivos, 1086 testes.
- E2E Playwright: nenhum spec depende do texto do trigger do Histórico nem do contrato na ficha de acompanhante, então não rodei.
- CI (run 45495904218): sucesso em todos os jobs (e2e, lint, typecheck, boot-time, integration, frontend-unit, frontend-codegen).
- Deploy: `scripts/deploy-staging.sh` terminou com exit 0 e os serviços subiram.

## Testes

- Invertido, como autorizado: "acompanhante enxerga o contrato do grupo" agora é "NÃO recebe o contrato do grupo".
- Novos: acompanhante contratante recebe o contrato; responsável da debutante (membro acompanhante) recebe o contrato; comanda aberta e atendimento em aberto no overview e no histórico, com a cancelada fora.
- Vitest: bloco de comandas abertas, linha "(aberta)" na lista, bloco ausente sem abertas.

## Desvios

- **[Rule 3]** Adicionei `beforeEach(() => { seq = 0 })` no spec de integração. `mkAppt` espaça os horários por `seq`, e com mais testes o contador crescia e quebrava a ordenação do teste antigo de histórico. Nenhum assert foi afrouxado.
- Rodei prettier com `--single-quote --print-width 100` nos dois arquivos de backend. Isso reformatou algumas linhas vizinhas em `client-overview.ts` (assinatura de `loadClientOverview` etc.), sem mudança de comportamento.
- Não testei o caso `isPathEnabled` falso (card sem link): o mock do módulo é fixo no arquivo e o plano permitia pular.

## Pendência de verificação

Não conferi a ficha da Edna no staging pela UI (org "Studio JS"); a verificação foi por testes de integração, vitest e CI.
