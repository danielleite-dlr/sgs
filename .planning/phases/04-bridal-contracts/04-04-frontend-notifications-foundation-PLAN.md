---
phase: 04-bridal-contracts
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/backend/src/graphql/schema/products.graphql
  - apps/backend/src/catalog/notifications/notifications.resolver.ts
  - apps/backend/src/catalog/notifications/notifications.service.ts
  - apps/backend/test/integration/phase4-notifications-panel.e2e.spec.ts
  - apps/frontend/src/features/notifications/api/notifications.api.ts
  - apps/frontend/src/features/notifications/lib/notification-labels.ts
  - apps/frontend/src/features/notifications/components/NotificationsBell.tsx
  - apps/frontend/src/features/notifications/__tests__/notifications-bell.test.tsx
  - apps/frontend/src/components/layout/TopHeader.tsx
  - apps/frontend/src/config/features.ts
  - apps/frontend/src/features/bridal/bridal-permissions.ts
  - apps/frontend/src/features/bridal/__tests__/bridal-permissions.test.ts
  - apps/frontend/src/features/bridal/pages/BridalGroupsPage.tsx
  - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx
  - apps/frontend/src/features/bridal/pages/ContractsPage.tsx
  - apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx
  - apps/frontend/src/features/bridal/public/ContractAcceptPage.tsx
  - apps/frontend/src/features/bridal/pages/BridalGroupsPlaceholder.tsx
  - apps/frontend/src/features/bridal/pages/ContractsPlaceholder.tsx
  - apps/frontend/src/features/bridal/pages/ContractDetailPlaceholder.tsx
  - apps/frontend/src/features/bridal/mocks/bridal.mock.ts
  - apps/frontend/src/router.tsx
autonomous: true
requirements: [CONT-02, CLI-03]

must_haves:
  truths:
    - "O sino no topo mostra o número de notificações não lidas do membro logado e a lista ao abrir"
    - "Clicar numa notificação marca como lida e navega para o destino (contrato ou produtos)"
    - "'Marcar todas como lidas' zera o contador"
    - "O alerta de estoque baixo já existente aparece no sino"
    - "As rotas /noivas, /noivas/:id, /contratos, /contratos/:id e a rota pública /aceite/:orgId/:token existem (as autenticadas continuam atrás das flags noivas/contratos)"
  artifacts:
    - path: "apps/frontend/src/features/notifications/components/NotificationsBell.tsx"
      provides: "Painel mínimo do sino (D-24)"
    - path: "apps/frontend/src/features/bridal/bridal-permissions.ts"
      exports: ["useBridalPermission", "BRIDAL_ROLE_PERMISSIONS"]
  key_links:
    - from: "NotificationsBell.tsx"
      to: "Query unreadNotificationCount / notifications / Mutation markNotificationRead / markAllNotificationsRead"
      via: "Apollo useQuery com pollInterval 60000"
      pattern: "unreadNotificationCount"
    - from: "router.tsx"
      to: "ContractAcceptPage"
      via: "rota pública fora do ProtectedRoute"
      pattern: "/aceite/:orgId/:token"
---

<objective>
Entregar o painel mínimo de notificações (D-24) — contador, lista, marcar como lida/todas — ligando a flag `notificacoes`, e preparar a fundação de frontend da fase: gates de permissão de noivas/contratos e páginas-casca roteadas (substituindo os placeholders com mock), incluindo a rota pública de aceite. As páginas-casca serão preenchidas por 04-09 (aceite), 04-13 (grupos) e 04-14 (contratos), que assim não tocam em `router.tsx`.

Purpose: os alertas de D-20/D-21 só são visíveis com o sino (RESEARCH Open Question 3, resolvida em D-24). Pré-rotear evita conflito de `router.tsx` entre planos paralelos.
Output: 2 campos GraphQL novos no backend, componente do sino, permissões de noivas, 5 páginas-casca, rotas.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@apps/backend/src/graphql/schema/products.graphql
@apps/backend/src/catalog/notifications/notifications.service.ts
@apps/frontend/src/components/layout/TopHeader.tsx
@apps/frontend/src/config/features.ts
@apps/frontend/src/router.tsx
@apps/frontend/src/features/operations/operations-permissions.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
```
Branch `master`; sempre `corepack pnpm`. Gate antes de cada commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/frontend test` (+ `test:integration -- phase4-notifications-panel` na Task 1). Depois de mexer em SDL: `corepack pnpm --filter @sgs/frontend codegen`.

Artefato gerado: se o merge com um plano paralelo conflitar em `apps/frontend/src/gql/`, não resolver à mão — regenerar com `corepack pnpm --filter @sgs/frontend codegen` e commitar o resultado.

<interfaces>
SDL atual (products.graphql):
```graphql
extend type Query { notifications(unreadOnly: Boolean): [Notification!]! }
extend type Mutation { markNotificationRead(input: MarkReadInput!): Notification! }
type Notification { id: UUID! kind: String! payload: JSON! readAt: DateTime createdAt: DateTime! }
```
NotificationsService: `list(orgId, memberId, unreadOnly=true)`, `markRead(orgId, id)`, `unreadCount(orgId, memberId)` (visíveis = `memberId = eu OR memberId IS NULL`).
Kinds que o plano 04-10 vai criar (payload sempre tem `title: string`, `message: string`): `contract_balance_due_soon`, `contract_balance_overdue`, `contract_deposit_unpaid`, `contract_not_accepted` (payload `contractId`, `code`) e `bridal_companion_deposit_pending` (payload `groupId`). Existente: `stock_low` (payload `productId`, ver `catalog/products/stock.ts`).
Gate de UI por `roleName` (padrão de operations-permissions.ts — `permissions` do store nunca é populado).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend — contador e marcar todas como lidas</name>
  <files>apps/backend/src/graphql/schema/products.graphql, apps/backend/src/catalog/notifications/notifications.resolver.ts, apps/backend/src/catalog/notifications/notifications.service.ts, apps/backend/test/integration/phase4-notifications-panel.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/catalog/notifications/notifications.resolver.ts
    - apps/backend/src/catalog/notifications/notifications.service.ts
    - apps/backend/test/integration/catalog-notifications.e2e.spec.ts (padrão de teste)
  </read_first>
  <action>
1. SDL: em `extend type Query` adicionar `unreadNotificationCount: Int!`; em `extend type Mutation` adicionar `markAllNotificationsRead: Int!` (retorna quantas marcou).
2. Service: `markAllRead(orgId, memberId): Promise<number>` → `updateMany({ where: { readAt: null, OR: [{ memberId }, { memberId: null }] }, data: { readAt: new Date() } })` retornando `count`. Corrigir `markRead(orgId, memberId, id)` para só marcar notificação visível ao membro (`updateMany` com `id` + `OR` acima; se `count === 0` lançar `NotFoundException`), e o resolver passa `tenant.memberId`.
3. Resolver: `@Query('unreadNotificationCount')` e `@Mutation('markAllNotificationsRead')` com `@RequirePermission(PERMISSIONS.NOTIFICATION_READ)`.
4. Spec `phase4-notifications-panel.e2e.spec.ts` (usar `createPhase3World`): inserir via adminPrisma 2 notificações para `members.admin`, 1 com `member_id NULL` e 1 para `members.manager`; admin vê `unreadNotificationCount = 3`; manager tenta `markNotificationRead` da notificação do admin → erro; admin `markAllNotificationsRead` → 3 e depois contador 0; a do manager continua não lida.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase4-notifications-panel catalog-notifications</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "unreadNotificationCount: Int!" apps/backend/src/graphql/schema/products.graphql` e `grep -n "markAllNotificationsRead: Int!"` encontram
    - Suítes `phase4-notifications-panel` e `catalog-notifications` verdes
  </acceptance_criteria>
  <done>Backend expõe contador e "marcar todas", e marcar como lida respeita o destinatário.</done>
</task>

<task type="auto">
  <name>Task 2: Sino de notificações (D-24) e flag notificacoes</name>
  <files>apps/frontend/src/features/notifications/api/notifications.api.ts, apps/frontend/src/features/notifications/lib/notification-labels.ts, apps/frontend/src/features/notifications/components/NotificationsBell.tsx, apps/frontend/src/features/notifications/__tests__/notifications-bell.test.tsx, apps/frontend/src/components/layout/TopHeader.tsx, apps/frontend/src/config/features.ts</files>
  <read_first>
    - apps/frontend/src/components/layout/TopHeader.tsx (bloco `FEATURES.notificacoes`)
    - apps/frontend/src/features/operations/api/comandas.api.ts (padrão gql + hooks)
    - apps/frontend/src/components/ui/popover.tsx e apps/frontend/src/components/ui/badge.tsx
    - apps/frontend/src/features/operations/__tests__/comanda-page.test.tsx (MockedProvider)
    - apps/backend/src/catalog/products/stock.ts (payload de stock_low)
  </read_first>
  <action>
1. `notifications.api.ts`: documentos `UnreadNotificationCountQuery`, `NotificationsQuery($unreadOnly: Boolean)` (id kind payload readAt createdAt), `MarkNotificationReadMutation`, `MarkAllNotificationsReadMutation`; hooks finos.
2. `notification-labels.ts`: `describeNotification(n): { title: string; message: string; href: string | null }` — kinds `contract_*`/`bridal_*`: usar `payload.title`/`payload.message`; href `/contratos/${payload.contractId}` ou `/noivas/${payload.groupId}`; `stock_low`: título "Estoque baixo", mensagem com `payload.productName ?? 'Produto'` (conferir chaves reais em stock.ts), href `/catalogo/produtos`; desconhecido: título = kind, href null.
3. `NotificationsBell.tsx`: botão com `aria-label="Notificações"` e badge com contador (`unreadNotificationCount`, `pollInterval: 60000`; esconder badge quando 0; mostrar "9+" acima de 9); `Popover` com lista (`notifications(unreadOnly: true)`, carregada ao abrir), item = título + mensagem + data relativa (`date-fns` `formatDistanceToNow` com `ptBR`), clique → `markNotificationRead` + `navigate(href)`; botão "Marcar todas como lidas" → `markAllNotificationsRead`; após mutations `refetchQueries: ['UnreadNotificationCount','Notifications']`; estado vazio "Nenhuma notificação nova". Teclado/ARIA: lista com `role="list"`, itens como `button`.
4. `TopHeader.tsx`: trocar o botão decorativo dentro de `FEATURES.notificacoes && (...)` por `<NotificationsBell />`.
5. `features.ts`: `notificacoes: true` com comentário "Painel mínimo do sino (04-04): contador, lista, marcar lida".
6. Teste vitest `notifications-bell.test.tsx` com MockedProvider: contador 3 renderiza badge "3"; abrir lista mostra título de `contract_balance_overdue`; clicar marca como lida (mock da mutation chamado com o id); contador 0 não mostra badge; "Marcar todas" chama a mutation.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend codegen && corepack pnpm --filter @sgs/frontend test -- notifications-bell && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "notificacoes: true" apps/frontend/src/config/features.ts` encontra
    - `grep -n "NotificationsBell" apps/frontend/src/components/layout/TopHeader.tsx` encontra
    - `grep -n "pollInterval: 60000\|pollInterval: 60_000" apps/frontend/src/features/notifications/components/NotificationsBell.tsx` encontra
    - Teste vitest verde
  </acceptance_criteria>
  <done>Sino funcional e ligado, exibindo também o alerta de estoque baixo.</done>
</task>

<task type="auto">
  <name>Task 3: Permissões de noivas, páginas-casca e rotas (incl. pública)</name>
  <files>apps/frontend/src/features/bridal/bridal-permissions.ts, apps/frontend/src/features/bridal/__tests__/bridal-permissions.test.ts, apps/frontend/src/features/bridal/pages/BridalGroupsPage.tsx, apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx, apps/frontend/src/features/bridal/pages/ContractsPage.tsx, apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx, apps/frontend/src/features/bridal/public/ContractAcceptPage.tsx, apps/frontend/src/features/bridal/pages/BridalGroupsPlaceholder.tsx, apps/frontend/src/features/bridal/pages/ContractsPlaceholder.tsx, apps/frontend/src/features/bridal/pages/ContractDetailPlaceholder.tsx, apps/frontend/src/features/bridal/mocks/bridal.mock.ts, apps/frontend/src/router.tsx</files>
  <read_first>
    - apps/frontend/src/router.tsx (PROTECTED_ROUTES, rota pública `/convite/:token`)
    - apps/frontend/src/config/features.ts (GATED_PATHS — confirmar que `/noivas` e `/contratos` cobrem os subcaminhos por prefixo)
    - apps/frontend/src/features/operations/operations-permissions.ts e seu teste
    - apps/frontend/src/features/bridal/pages/*Placeholder.tsx
  </read_first>
  <action>
1. `bridal-permissions.ts`: `BRIDAL_ROLE_PERMISSIONS: Record<string, readonly string[]>` espelhando a matriz do backend (04-01): ADMIN = `bridal.read, bridal.write, bridal.aiSuggest, contract.read, contract.write, contract.payment, contract.cancel, contract.settings`; MANAGER = o mesmo sem `contract.settings`; ATTENDANT = `bridal.read, bridal.write, contract.read, contract.payment`; PROFESSIONAL = []. `useBridalPermission(p: string): boolean` com a mesma lógica de `operations-permissions.ts` (store `permissions` se preenchido, senão `roleName`). Teste com a matriz completa.
2. Páginas-casca (cada uma exporta componente nomeado, usa `PageHeader` com o título e um `Skeleton`; serão substituídas): `BridalGroupsPage` ("Grupos de noivas"), `BridalGroupDetailPage` ("Grupo de noivas", lê `:id`), `ContractsPage` ("Contratos"), `ContractDetailPage` ("Contrato", lê `:id`), `public/ContractAcceptPage` (layout simples sem AppShell, título "Contrato", lê `:orgId` e `:token`, e insere `<meta name="robots" content="noindex">` via `useEffect` no `document.head`).
3. `router.tsx`: `/noivas` → `BridalGroupsPage`, novo `/noivas/:id` → `BridalGroupDetailPage`, `/contratos` → `ContractsPage`, `/contratos/:id` → `ContractDetailPage`; rota pública top-level `{ path: '/aceite/:orgId/:token', element: <ContractAcceptPage /> }` ao lado de `/convite/:token` (fora do ProtectedRoute/AppShell). Atualizar o comentário de rotas do topo. As flags `noivas`/`contratos` continuam `false` (serão ligadas no 04-15). Se `GATED_PATHS` não cobrir `/noivas/:id` por prefixo, adicionar a entrada.
4. Remover `BridalGroupsPlaceholder.tsx`, `ContractsPlaceholder.tsx`, `ContractDetailPlaceholder.tsx` e `mocks/bridal.mock.ts` (confirmar com `grep -rn "bridal.mock\|Placeholder" apps/frontend/src/features/bridal apps/frontend/src/router.tsx` que nada mais importa; atualizar `.planning/ROADMAP-MOCKS.md` se mencionar o mock M9 — marcar "removido em 04-04").
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- bridal-permissions && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "/aceite/:orgId/:token" apps/frontend/src/router.tsx` encontra
    - `grep -n "/noivas/:id" apps/frontend/src/router.tsx` encontra
    - `test ! -e apps/frontend/src/features/bridal/mocks/bridal.mock.ts`
    - `grep -n "contract.settings" apps/frontend/src/features/bridal/bridal-permissions.ts` encontra; teste verde
    - `grep -n "noivas: false\|contratos: false" apps/frontend/src/config/features.ts` ainda encontra as duas
  </acceptance_criteria>
  <done>Gates e rotas prontos; páginas-casca no lugar dos placeholders com mock.</done>
</task>

</tasks>

<verification>Frontend: `corepack pnpm --filter @sgs/frontend test` verde; backend: `test:integration -- phase4-notifications-panel` verde.</verification>

<success_criteria>Sino visível e funcional (D-24); fundação de rotas/permissões da fase pronta para os planos de tela.</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-04-SUMMARY.md`
</output>
