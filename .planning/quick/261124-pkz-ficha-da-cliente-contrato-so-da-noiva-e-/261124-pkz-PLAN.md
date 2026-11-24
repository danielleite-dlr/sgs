---
phase: quick-261124-pkz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/backend/src/clients/client-overview.ts
  - apps/backend/src/graphql/schema/clients.graphql
  - apps/backend/test/integration/quick-client-overview.e2e.spec.ts
  - apps/frontend/src/features/clients/api/clients.api.ts
  - apps/frontend/src/features/clients/components/ClientHistoryTab.tsx
  - apps/frontend/src/pages/ClienteDetailPage.tsx
  - apps/frontend/src/features/clients/__tests__/client-situation.test.tsx
  - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
autonomous: true
requirements: [QUICK-261124-pkz]

must_haves:
  truths:
    - "Acompanhante (madrinha) de um grupo de noiva NÃO vê o card do contrato da noiva na ficha"
    - "Noiva/debutante e a responsável da debutante continuam vendo o contrato do grupo"
    - "Quem é brideClientId ou contractorClientId de um contrato vê esse contrato, qualquer que seja o papel no grupo"
    - "Aba Histórico mostra no topo um bloco 'Comandas abertas' com código, serviços, profissionais, total, data e selo 'Aberta'"
    - "A lista do histórico inclui comandas abertas e atendimentos passados ainda não concluídos — cliente com atendimento in_progress e comanda aberta não vê mais 'Sem histórico ainda'"
    - "Comandas canceladas não aparecem nas abertas nem como abertas na lista"
    - "Aba Dados continua sendo a padrão; o trigger do Histórico mostra 'Histórico (N aberta[s])' quando há comanda aberta"
  artifacts:
    - path: "apps/backend/src/clients/client-overview.ts"
      provides: "filtro de contrato por papel + openComandas no overview + abertos no history"
      contains: "openComandas"
    - path: "apps/backend/src/graphql/schema/clients.graphql"
      provides: "type ClientOverviewOpenComanda e campo openComandas"
      contains: "ClientOverviewOpenComanda"
    - path: "apps/frontend/src/features/clients/components/ClientHistoryTab.tsx"
      provides: "bloco Comandas abertas"
      contains: "client-open-comanda"
  key_links:
    - from: "apps/frontend/src/pages/ClienteDetailPage.tsx"
      to: "ClientOverviewQuery"
      via: "useQuery (cache compartilhado com ClientSituation) → openComandas prop + contador"
      pattern: "openComandas"
    - from: "apps/frontend/src/features/clients/components/ClientHistoryTab.tsx"
      to: "/comanda/:id"
      via: "Link condicionado a isPathEnabled('/comanda')"
      pattern: "isPathEnabled\\('/comanda'\\)"
---

<objective>
Corrigir a ficha da cliente (relato no staging com Edna Maria Assis de Jesus, acompanhante do grupo
"Noiva Evillyn Assis"):
1. Card de contrato só para quem é parte do contrato (noiva/debutante, responsável da debutante,
   ou quem está no contrato como noiva/contratante). Acompanhante não vê o contrato do grupo.
2. Aba Histórico deixa de ficar vazia: bloco "Comandas abertas" no topo + lista com comandas
   abertas e atendimentos passados ainda não concluídos.

Output: backend (overview/history + SDL), frontend (aba Histórico + contador), testes de
integração e vitest, gate completo, commit, push master, deploy staging, CI verde.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@apps/backend/src/clients/client-overview.ts
@apps/backend/src/graphql/schema/clients.graphql
@apps/backend/test/integration/quick-client-overview.e2e.spec.ts
@apps/frontend/src/features/clients/components/ClientHistoryTab.tsx
@apps/frontend/src/features/clients/api/clients.api.ts
@apps/frontend/src/pages/ClienteDetailPage.tsx
@apps/frontend/src/features/clients/__tests__/client-situation.test.tsx

<interfaces>
Do client-overview.ts (estado atual):
- `const OPEN_STATUSES = ['scheduled', 'confirmed', 'in_progress'];`
- `groups = tx.bridalGroup.findMany({ where: { OR: [{ members: { some: { clientId } } },
  { responsibleClientId: clientId }] }, include: { members: { where: { clientId }, select: { role: true } } } })`
- `roleInGroup(memberRole, eventKind, isResponsible)` → 'bride'|'debutante'|'companion'|'responsible'
  (ATENÇÃO: retorna 'companion' se memberRole === 'companion' mesmo sendo responsável).
- BUG: `loadContractViews(tx, orgId, { OR: [{ brideClientId }, { contractorClientId },
  { bridalGroupId: { in: groupIds } }] })` — o 3º ramo traz o contrato do grupo para acompanhante.
- `loadClientHistory`: appointments só `status in [completed, no_show, cancelled]`; comandas só
  `status: 'closed'`. Linha: `ClientHistoryRow { id, occurredAt, kind, description, amount,
  professionalName, entityType, entityId }`. `APPT_LABEL` mapeia status → rótulo.

Prisma Comanda: `status` ∈ 'open' | 'closed' | 'cancelled'; `openedAt`, `closedAt`, `total`
(Decimal, mantido pelos itens — comanda-serialize usa `row.total`), relações `items`
(nameSnapshot, professional.displayName, total) e `appointments` (startsAt).

Frontend: `ClientOverviewQuery` / `ClientOverviewData` em clients.api.ts (interfaces escritas à
mão, sem codegen). `ClientSituation` faz `useQuery(ClientOverviewQuery, { variables: { clientId },
fetchPolicy: 'cache-and-network' })`. `historyHref(item)` em lib/client-links.ts já trata
entityType 'comanda' com `isPathEnabled('/comanda')`. Badge: `@/components/ui/badge` com variants
default|secondary|accent|warning|info|success|neutral…; Card/CardContent em `@/components/ui/card`.
Teste vitest existente mocka `@/config/features` (`isPathEnabled: () => true`) e renderiza
`<ClientHistoryTab clientId="c1" />` com MockedProvider de `ClientHistoryQuery`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tarefa 1: Backend — contrato por papel, openComandas no overview e abertos no histórico</name>
  <files>apps/backend/src/clients/client-overview.ts, apps/backend/src/graphql/schema/clients.graphql, apps/backend/test/integration/quick-client-overview.e2e.spec.ts</files>
  <behavior>
    - Acompanhante: `contracts` vazio (inverter o teste atual "acompanhante ... enxerga o contrato
      do grupo" → "acompanhante NÃO recebe o contrato do grupo"; grupo continua com role 'companion').
    - Noiva: continua recebendo o contrato (teste existente segue passando).
    - Acompanhante que também é `contractorClientId` de um contrato recebe esse contrato (novo
      caso: criar o contrato com contractorClientId = companionClientIds[0] via insertContractRow
      se o helper aceitar; senão `adminPrisma.contract.update`).
    - Debutante: responsável (bridalGroup.responsibleClientId) recebe o contrato do grupo (se o
      fixture suportar `eventKind: 'debutante', responsibleClientId`; senão pular este caso e
      registrar no SUMMARY).
    - History: cliente com comanda `open` (item 'Escova', total 80.00, ligada a um atendimento
      `in_progress` de ontem) → aparece linha kind 'comanda', descrição contendo `(aberta)`,
      entityType 'comanda', amount '80.00', occurredAt = startsAt do atendimento; e linha kind
      'appointment' com 'Atendimento em aberto'. Comanda `cancelled` não aparece.
    - Overview `openComandas` traz a comanda aberta (code, total '80.00', serviceNames ['Escova'],
      professionalNames, firstAppointmentAt) e não traz a cancelada nem a fechada.
    - Teste de histórico existente (ordem ['contract_payment','comanda','appointment'] da noiva)
      continua passando — o teste da noiva só tem atendimento futuro, que não entra.
  </behavior>
  <action>
    Em client-overview.ts:
    (a) Contratos: calcular `contractGroupIds = groups.filter((g) => g.members[0]?.role === 'bride'
    || g.responsibleClientId === clientId).map((g) => g.id)` e usar no 3º ramo do OR no lugar de
    `groupIds` (`...(contractGroupIds.length ? [{ bridalGroupId: { in: contractGroupIds } }] : [])`).
    Acompanhante só vê contrato onde é brideClientId/contractorClientId. Comentário curto
    explicando o motivo (relato da Edna, acompanhante via o contrato da noiva).
    (b) Overview ganha `openComandas`: `tx.comanda.findMany({ where: { clientId, status: 'open' },
    include: { items: { select: { nameSnapshot, professional: { select: { displayName } } },
    orderBy: { createdAt: 'asc' } }, appointments: { select: { startsAt }, orderBy: { startsAt:
    'asc' }, take: 1 } }, orderBy: { openedAt: 'desc' } })`. Mapear para `{ id, code, openedAt,
    firstAppointmentAt: appointments[0]?.startsAt ?? null, total: fromCents(toCents(c.total)),
    serviceNames: [...new Set(nameSnapshot)], professionalNames: [...new Set(displayName)] }`.
    Rodar no Promise.all existente. Extrair um helper local `uniq` / `comandaNames(c)` para reusar
    no histórico (evitar duplicar o `new Set` três vezes).
    (c) History — DECISÃO (documentar no docstring): atendimentos passados não concluídos entram.
    Trocar o where de appointments por `OR: [{ status: { in: ['completed','no_show','cancelled'] } },
    { status: { in: OPEN_STATUSES }, startsAt: { lt: now } }]`, mantendo `startsAt: range()` e
    professionalId como AND (usar `AND: [...]` se precisar combinar range com o `lt`). Adicionar
    em APPT_LABEL: scheduled/confirmed/in_progress → 'Atendimento em aberto'.
    Comandas: `status: { in: ['closed', 'open'] }`; filtro de período: closed por closedAt, open
    por openedAt — usar `OR: [{ status: 'closed', closedAt: range() ?? { not: null } },
    { status: 'open', openedAt: range() }]`; include também `appointments` (startsAt asc, take 1).
    Linha da aberta: occurredAt = appointments[0]?.startsAt ?? openedAt; description
    `Comanda ${code} (aberta)${names ? ` — ${names}` : ''}`; amount = total. Fechada fica igual.
    Kind 'product' continua só com comandas fechadas (venda efetivada). Cancelada nunca entra.
    Atualizar docstring "Histórico passado da cliente" para refletir o novo escopo.
    Em clients.graphql: `type ClientOverviewOpenComanda { id: UUID! code: String! openedAt:
    DateTime! firstAppointmentAt: DateTime total: String! serviceNames: [String!]!
    professionalNames: [String!]! }` e `openComandas: [ClientOverviewOpenComanda!]!` em
    ClientOverview; atualizar a docstring do ClientHistoryItem se citar só "fechadas".
    Também atualizar o comentário em apps/backend/src/clients/clients.service.ts linha ~38
    ("comandas fechadas") se ficar falso — mudança só de comentário.
    No spec: acrescentar `openComandas { id code total serviceNames professionalNames
    firstAppointmentAt }` na query OVERVIEW; criar comandas via adminPrisma como no teste de
    histórico existente (status 'open' sem closedAt; outra 'cancelled' com cancelledAt) e ligar o
    atendimento com `comandaId`. Estilo do arquivo: aspas simples, ~100 colunas, sem prettier.
  </action>
  <verify>
    <automated>cd /root/sgs/apps/backend && corepack pnpm exec tsc --noEmit && corepack pnpm lint && corepack pnpm test:integration -- quick-client-overview</automated>
  </verify>
  <done>Acompanhante sem contrato do grupo, noiva/responsável com contrato, overview com
  openComandas, history com comanda aberta e atendimento em aberto; specs passam (carregar o .env
  linha a linha — DATABASE_URL tem `&` sem aspas; Postgres de dev 5433/5434).</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2: Frontend — bloco "Comandas abertas", lista e contador no trigger</name>
  <files>apps/frontend/src/features/clients/api/clients.api.ts, apps/frontend/src/features/clients/components/ClientHistoryTab.tsx, apps/frontend/src/pages/ClienteDetailPage.tsx, apps/frontend/src/features/clients/__tests__/client-situation.test.tsx, apps/frontend/src/infrastructure/i18n/locales/pt-BR.json</files>
  <behavior>
    - `<ClientHistoryTab clientId openComandas=[1 comanda] />` renderiza `data-testid=
      "client-open-comandas"` com título "Comandas abertas", 1 `client-open-comanda` com código,
      "Escova", profissional, "R$ 80,00", selo "Aberta" e link `/comanda/cm9`.
    - Com `openComandas=[]` (ou omitido) o bloco não aparece; o estado vazio "Sem histórico ainda"
      só aparece quando não há itens NA LISTA E não há comandas abertas.
    - Linha da lista com kind 'comanda' e descrição "(aberta)" renderiza normalmente (link /comanda).
    - Mock de isPathEnabled → false: o card aparece sem link.
  </behavior>
  <action>
    clients.api.ts: adicionar `openComandas { id code openedAt firstAppointmentAt total
    serviceNames professionalNames }` em ClientOverviewQuery e o tipo exportado
    `ClientOpenComandaData` + `openComandas: ClientOpenComandaData[]` em ClientOverviewData.
    Atualizar o fixture `empty` do client-situation.test.tsx (e qualquer outro objeto
    ClientOverviewData tipado em testes — `grep -rn "ClientOverviewData" apps/frontend/src`) com
    `openComandas: []` para o tsc passar. ClientSituation NÃO muda (contratos já vêm filtrados do
    backend).
    ClientHistoryTab: nova prop opcional `openComandas?: ClientOpenComandaData[]`. Acima dos
    filtros, quando houver itens, `<section data-testid="client-open-comandas">` com título
    "Comandas abertas" (i18n `clients.history.open.heading`) e um Card por comanda
    (`data-testid="client-open-comanda"`): linha 1 código + `<Badge variant="warning">Aberta</Badge>`;
    linha 2 serviços (join ', '); linha 3 profissionais; data = firstAppointmentAt ?? openedAt em
    `toLocaleDateString('pt-BR')` + hora; total à direita `R$ {formatCurrencyDisplay(total)}`.
    Card inteiro vira `<Link to={`/comanda/${id}`} state={FROM_STATE}>` só se
    `isPathEnabled('/comanda')` (importar de '@/config/features', mesmo padrão de client-links.ts);
    senão div. Ajustar o estado vazio para `items.length === 0 && !openCount`. Atualizar a docstring
    do componente (agora inclui abertas). Seguir classes existentes (space-y-lg, text-[12px],
    tabular-nums, border-neutral-200); não rodar prettier em arquivo existente.
    ClienteDetailPage: `useQuery<ClientOverviewResult>(ClientOverviewQuery, { variables:
    { clientId: id }, skip: !id })` (mesmas variáveis da ClientSituation → cache compartilhado,
    sem request extra); `const open = overview?.clientOverview.openComandas ?? []`. Manter
    `defaultValue="data"` (NÃO abrir Histórico por padrão). Trigger: `t('clients.tabs.history')` +
    ` (${open.length} ${open.length === 1 ? 'aberta' : 'abertas'})` quando open.length > 0.
    Passar `openComandas={open}` ao ClientHistoryTab. Os hooks precisam ficar antes dos early
    returns da página (regra de hooks).
    pt-BR.json: `clients.history.open.heading: "Comandas abertas"`, `clients.history.open.badge:
    "Aberta"`.
    Vitest: no describe do ClientHistoryTab em client-situation.test.tsx, estender `renderTab`
    para aceitar `openComandas` e adicionar os casos do <behavior>; para o caso isPathEnabled false
    usar `vi.mocked`/`vi.doMock` só se simples — senão manter apenas os casos com link e registrar.
  </action>
  <verify>
    <automated>cd /root/sgs/apps/frontend && corepack pnpm exec tsc --noEmit && corepack pnpm lint && corepack pnpm exec vitest run src/features/clients</automated>
  </verify>
  <done>Aba Histórico da cliente com comanda aberta mostra o bloco no topo e a lista não vazia;
  trigger "Histórico (1 aberta)"; aba Dados continua padrão; vitest/tsc/lint verdes.</done>
</task>

<task type="auto">
  <name>Tarefa 3: Gate completo, commit, push master, deploy staging e CI</name>
  <files>(nenhum arquivo novo — só git/deploy)</files>
  <action>
    Gate (tudo deve passar antes do commit): backend `lint`, `tsc --noEmit`, `test` (jest unit),
    `test:integration` completo (--runInBand; se travar no boot, `docker exec sgs_valkey
    valkey-cli ping`); frontend `lint`, `tsc --noEmit`, `vitest run` completo. Rodar também o
    E2E Playwright de clientes se existir spec cobrindo a ficha (`grep -rl "ficha\|clientes/" apps/e2e`)
    — `corepack pnpm --filter @sgs/e2e test:e2e <spec>`; se algum E2E checar "Histórico" pelo
    texto exato do trigger, ajustar.
    Commit só dos arquivos deste plano (há `.planning/phases/09.1-assistente-de-noiva/.gitkeep`
    não rastreado de outra sessão — não incluir): mensagem
    `fix(clientes): contrato só para a noiva/responsável e histórico com comandas abertas` +
    linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push em `master`.
    Deploy: antes, `git status --short` — se houver mudança não commitada alheia em `apps/` ou
    `infra/`, deployar de `git worktree add` limpo do HEAD (ver memória sgs-deploy-worktree-limpo)
    e depois religar `postgres pgbouncer backend frontend` com `--no-build` a partir de /root/sgs;
    senão `scripts/deploy-staging.sh` direto. Sem migration → sem backup obrigatório. Depois
    `gh run watch` do run do push até concluir e só reportar verde confirmado.
  </action>
  <verify>
    <automated>cd /root/sgs && git log -1 --oneline && gh run list --branch master --limit 1</automated>
  </verify>
  <done>Commit no master, staging atualizado, CI verde confirmado; no staging a ficha da Edna
  (org "Studio JS") mostra o grupo, não mostra o contrato da Evillyn e o Histórico lista a comanda
  aberta.</done>
</task>

</tasks>

<verification>
- Overview: acompanhante → contracts []; noiva → contrato; contratante acompanhante → contrato.
- History: comanda aberta + atendimento em aberto aparecem; cancelada não.
- UI: bloco "Comandas abertas" com selo e link; contador no trigger; aba Dados padrão.
</verification>

<success_criteria>
Gate completo verde, commit no master, deploy no staging e CI verde; relato da Edna resolvido
(itens 2 e 4) sem regressão nos itens 1 e 3.
</success_criteria>

<output>
Criar `.planning/quick/261124-pkz-ficha-da-cliente-contrato-so-da-noiva-e-/261124-pkz-SUMMARY.md`
</output>
