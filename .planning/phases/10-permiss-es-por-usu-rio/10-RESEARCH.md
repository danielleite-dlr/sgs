# Phase 10: Permissões por usuário - Research

**Pesquisado em:** 2026-11-24
**Domínio:** RBAC com ajuste por pessoa (NestJS + GraphQL schema-first + Prisma/RLS no backend; React + Apollo + Zustand no frontend; PWA iPhone e casca Capacitor Android)
**Confiança geral:** HIGH para tudo que foi lido no código (arquivo:linha citados); MEDIUM para o comportamento de retomada do app em segundo plano (iOS PWA e WebView Android) e para o código de erro do Apollo (marcados abaixo)

<user_constraints>
## User Constraints (de 10-CONTEXT.md, copiado literalmente)

### Decisões travadas
- **D-01:** Granularidade por item do menu/área, não por ação dentro da tela.
- **D-02:** Desligado ⇒ some do menu, a rota bloqueia e a API recusa (não basta esconder no frontend).
- **D-03:** Gerente gerencia a equipe igual ao Admin (quick 261118-gpm) — vale para o resto do cadastro; para permissões, ver D-08.
- **D-04:** O ajuste por pessoa **tira e dá**. O papel define só o ponto de partida; qualquer item pode ser ligado ou desligado para a pessoa (ex.: gerente sem Financeiro; atendente de confiança com Financeiro).
- **D-05:** Quem **ganha** um item que o papel não tinha vê e mexe nele **igual ao Gerente** (sem o recorte "só o meu" do papel original). Ex.: atendente com Financeiro vê o caixa todo; atendente com Relatórios do Comercial vê os relatórios de todos.
- **D-06:** Cada **submenu** liga/desliga sozinho (ex.: Previsão de caixa sem o resto do Financeiro; Leads sem Relatórios do Comercial). Na tela, a área (grupo do menu) tem um controle que liga/desliga todos os itens dela de uma vez.
- **D-07:** Itens que ainda são placeholder (feature flag desligada) não aparecem na tela de acessos.
- **D-08:** **Admin sempre vê tudo**; ninguém tira nada do Admin. O Admin ajusta qualquer pessoa. O **Gerente ajusta só Atendente e Profissional** — não mexe em outro Gerente, no Admin nem em si mesmo. Atendente e Profissional não mexem em acessos.
- **D-09:** "Perfis de acesso" (a própria tela de ajuste) fica sempre com Admin/Gerente e não pode ser dada a Atendente/Profissional — senão a regra D-08 seria contornada.
- **D-10:** Tela **Profissionais › Perfis de acesso** (hoje placeholder em `menu-config.ts`, rota `/profissionais/perfis`): lista das pessoas ativas e, para cada uma, as áreas e itens com liga/desliga, mostrando o que é padrão do papel e o que foi ajustado.
- **D-11:** Atalho **"Acessos"** no editar profissional que abre o mesmo ajuste para aquela pessoa.
- **D-12:** Só por pessoa — não há edição do padrão do papel para o salão todo (fica para depois, ver Deferred).
- **D-13:** Vale **na hora**: a API já recusa na próxima ação; o menu da pessoa se atualiza sozinho em até ~1 minuto ou ao trocar de tela, sem sair e entrar (inclui o app instalado no iPhone e o Android).

### Critério do Claude (Claude's Discretion)
- Modelo de dados dos ajustes (overrides por membro: concedido/negado por item) e como o catálogo de itens do menu se liga às permissões do backend (um item pode exigir várias permissões; um resolver pode servir a vários itens).
- Itens sempre ligados que não entram no ajuste (ex.: Início, o próprio perfil/troca de senha, notificações).
- Dependências entre itens (ex.: Comandas usa Clientes no cadastro rápido; Contratos abre a partir de Noivas) — escolher o comportamento mais simples que não quebre a tela, e registrar.
- Botão "voltar ao padrão do papel" por pessoa; destaque visual do que difere do padrão.
- Auditoria de quem mudou o quê (reaproveitar o audit log existente).
- O que acontece com ajustes quando a pessoa muda de papel (sugestão: zerar os ajustes e voltar ao padrão do novo papel, avisando na tela).
- Como o push/aviso respeita o item desligado (ex.: lembrete do Comercial não vai para quem perdeu o Comercial).

### Ideias adiadas (FORA DO ESCOPO)
- Mudar o padrão de um papel para o salão todo (ex.: todo Atendente deixa de ver Clientes em débito) — fase futura.
- Permissão por ação dentro da tela (ver vs. editar) — fora de D-01.
- Fase 11 (já no roadmap): profissional "atende noiva"/"fixa" e cronograma do grupo.
</user_constraints>

## Project Constraints (de CLAUDE.md)

- Stack fixa: NestJS 10 + GraphQL (Apollo, schema-first SDL) + Prisma 5 + PostgreSQL 16 + Redis/Valkey; frontend React 18 + Vite + Apollo Client 3 + Zustand + Tailwind + shadcn/ui. Não trocar nada.
- **Multi-tenancy por RLS no PostgreSQL é inegociável** (toda tabela nova com `ENABLE` + `FORCE ROW LEVEL SECURITY` e policy `tenant_isolation`).
- LGPD, WCAG 2.1 AA e OWASP obrigatórios (a tela de acessos precisa de toggles acessíveis: `role="switch"`, `aria-checked`, rótulo, foco visível, alvo >= 44 px).
- Testes: cobertura unitária no domínio, E2E para fluxos críticos, bloqueio de PR em falha.
- Fluxo GSD obrigatório: edição de arquivos só via `/gsd:*` (o orquestrador cuida).
- Do MEMORY do usuário: toda conversa em PT-BR; gate completo antes de commit; deploy staging buildado de worktree limpo se houver trabalho alheio não commitado.

<phase_requirements>
## Phase Requirements

Sem IDs no ROADMAP ("Requirements: TBD"). Proposta em "## Proposed Requirements" abaixo (PERM-01..PERM-16); o orquestrador deve copiar para REQUIREMENTS.md e para a tabela de rastreio ("Phase 10").
</phase_requirements>

## Summary

Hoje o backend decide acesso em **uma** camada: `PermissionGuard` (`apps/backend/src/authz/guards/permission.guard.ts:93-106`) lê `role_permissions` do papel que vem do **JWT** (`tenant.roleName`, token de 15 min, `auth/token.service.ts:14`) e compara com `@RequirePermission(...)` (semântica E: todas as permissões listadas). `@RequireRole` existe mas **não é usado em nenhum resolver** (só no guard). Em cima disso há ~10 serviços que ramificam por `roleName` (recorte "só o meu" do Comercial, máscara de comissão da profissional, máscara de custo, diária da assistente, destinatários de push/alerta). O frontend decide por `roleName` do store (gravado só no login, nunca atualizado, `useAuth.ts:19`) e por um espelho estático de `ROLE_PERMISSIONS` (`operations-permissions.ts`, `bridal-permissions.ts`, `commercial-permissions.ts`); o campo `permissions` do store nunca é populado. O **menu não é filtrado por papel** (só o grupo Comercial tem `roles`): a profissional hoje vê Financeiro/Noivas no menu e, ao abrir, a API devolve `FORBIDDEN`.

**Achado crítico (armadilha):** `error-link.ts:34` trata **qualquer** `FORBIDDEN` como sessão adulterada e chama `goToLogin()` (apaga a sessão). Com o ajuste por pessoa, "item desligado" vai ser um caso normal e frequente; se a API recusar com `ForbiddenException` (code `FORBIDDEN`), o app **desloga a pessoa**. A recusa por acesso precisa de um code próprio (`ACCESS_DENIED`) e o error-link precisa tratá-lo sem logout (refetch de acessos + redirecionar). Isso vale também para a recusa por permissão faltante.

**Achado crítico 2:** o papel do JWT fica velho por até 15 min, e o frontend nunca o atualiza. Como D-13 exige efeito "na hora" e a mudança de papel zera os ajustes, o backend precisa resolver papel + ajustes **do banco por requisição** (a partir do `memberId` do token), não do JWT.

**Primary recommendation:** modelo de duas camadas, com função de domínio pura (TDD): (A) **catálogo de itens** (24 itens reais; id = id do menu) com `requires` (define o padrão do papel: item ligado se o papel tem todas as permissões de `requires`) e `managerPermissions` (o que quem *ganha* o item passa a poder, igual ao Gerente); (B) tabela `member_access_overrides` (apenas diferenças em relação ao padrão, RLS forçada). Toda operação GraphQL com `@RequirePermission` ganha `@RequireAccess(...itens)` (semântica OU entre itens; as permissões exigidas são checadas **por item**, o que impede que "ganhar Relatórios" vire "Gerente em todo o Comercial"). O frontend recebe tudo numa query `myAccess` (poll 60 s + refetch ao voltar do segundo plano + a cada troca de rota + ao receber `ACCESS_DENIED`), e `useMenu`/rotas/`useHasPermission`/escopos passam a ler dela. Um spec de inventário por reflexão falha o build se algum resolver ficar sem `@RequireAccess`.

## Standard Stack

Sem biblioteca nova. Tudo é feito com o que já está no repositório.

| Peça | Já existe | Uso na fase |
|------|-----------|-------------|
| NestJS `Reflector` + `SetMetadata` | `authz/decorators/require-permission.decorator.ts` | novo `@RequireAccess` no mesmo padrão |
| `TenantContextService.runWithTenant` | `database/tenant-context.service.ts` | ler `members` + `member_access_overrides` sob RLS no guard |
| `recordAudit(tx, …)` | `common/audit-log.ts` | `member.access.update` / `member.access.reset` |
| Apollo `useQuery` + `pollInterval` | `notifications.api.ts:55` (60 s) | `useMyAccess()` |
| Zustand + `persist` | `auth.store.ts` | guardar último `myAccess` conhecido |
| jest `--config jest.config.ts` / `jest-integration.config.ts --runInBand` / vitest / Playwright `@sgs/e2e` | ver Validation Architecture | testes |
| `<button role="switch">` próprio | não há `ui/switch.tsx` nem `@radix-ui/react-switch` (package.json) | toggle da tela; **não adicionar dependência** (ou, se o design quiser, adicionar `@radix-ui/react-switch` como decisão explícita do plano) |

**Verificação de versão:** não se aplica (nenhum pacote novo). `packages/shared` **não** é consumido pelo backend (comentário em `push/push-messages.ts:22`: "o backend não depende de @sgs/shared por causa do Docker"), então o catálogo vive no backend e o frontend o recebe por GraphQL.

### Alternativas consideradas
| Em vez de | Alternativa | Tradeoff |
|-----------|-------------|----------|
| Camada de itens + permissões por item | Só somar permissões ao papel (override = permissões) | Quebra D-06: conceder "Relatórios do Comercial" exige `commercial.manage`, que também libera excluir/trocar responsável/etapas. Exigiria dividir permissões por migração e ainda não resolveria recortes por papel |
| Resolver acesso do banco por requisição | Guardar overrides no JWT | JWT dura 15 min; D-13 pede "na próxima ação". Rejeitado |
| Cache entre requisições (Redis/memória) | Sem cache, memoizar por requisição | Não foi verificado se há 1 só réplica do backend; sem cache é correto em qualquer topologia. Custo: 1 transação curta por requisição que tem decorator (hoje já há 1 consulta de `role`) |

## Architecture Patterns

### Estrutura recomendada
```
apps/backend/src/authz/
├── access/
│   ├── access-catalog.ts        # ACCESS_ITEMS, ACCESS_GATES, tipos (puro)
│   ├── access-resolve.ts        # resolveAccess(role, rolePerms, overrides) (puro, TDD)
│   ├── access.service.ts        # carrega do banco (runWithTenant), memoiza por requisição, helpers p/ push/jobs
│   ├── access.resolver.ts       # myAccess, memberAccess, setMemberAccess, resetMemberAccess
│   ├── access.errors.ts         # AccessDeniedError (GraphQLError code ACCESS_DENIED)
│   └── access-catalog.spec.ts / access-resolve.spec.ts / access-inventory.spec.ts
├── decorators/require-access.decorator.ts
└── guards/permission.guard.ts   # estendido (não criar 2º APP_GUARD)
apps/backend/src/graphql/schema/access.graphql
apps/backend/prisma/migrations/2026112X…_member_access_overrides/migration.sql
apps/frontend/src/features/access/
├── access.api.ts                # MyAccessQuery, MemberAccessQuery, SetMemberAccessMutation
├── use-my-access.ts             # poll + visibilitychange + appStateChange + troca de rota
├── access-store (no auth.store) # último myAccess persistido + flag fresh
├── AccessRoute.tsx              # guarda de rota por item (OU)
├── PerfisAcessoPage.tsx         # /profissionais/perfis
└── MemberAccessPanel.tsx        # reutilizado pelo atalho "Acessos" no MemberEditDialog
```

### Pattern 1: catálogo de itens + padrão derivado das permissões
**O quê:** cada item do menu (id = id de `menu-config.ts`) declara `requires: Permission[]` e `managerPermissions: Permission[]`. Padrão do papel: `default(role, item) = requires ⊆ permissões do papel` (lidas de `role_permissions`, a mesma fonte do guard, não da constante). Isso elimina uma segunda tabela de "padrão por papel" e mantém a verdade única.
**Exceções declaradas no catálogo:** `home` sempre ligado e fora do ajuste; `profissionais-perfis` com `grantable: false` (D-09: nunca ligável para Atendente/Profissional; Admin/Gerente têm por padrão via `member.editRole`).
**Efeito de produto a confirmar:** o padrão passa a ser derivado das permissões, então a Profissional deixa de ver Financeiro, Noivas, Contratos, Comercial e Regras de comissão no menu (hoje vê e toma `FORBIDDEN`). Ver Open Question 1.

### Pattern 2: guard em duas camadas, permissões por item
```typescript
// authz/access/access-resolve.ts (puro)
export interface ResolvedItem {
  id: string;
  enabled: boolean;       // efetivo
  defaultEnabled: boolean;
  source: 'DEFAULT' | 'GRANTED' | 'DENIED';
  permissions: ReadonlySet<Permission>; // o que a pessoa pode FAZER nesse item
}
// Item ligado por padrão  -> permissions = permissões do papel
// Item GANHO (D-05)       -> permissions = permissões do papel ∪ item.managerPermissions
// Item negado / ADMIN     -> ADMIN: sempre ligado, permissões do ADMIN; override de ADMIN é ignorado (D-08)
export function resolveAccess(a: {
  roleName: string;
  rolePermissions: ReadonlySet<Permission>;
  overrides: ReadonlyArray<{ itemId: string; enabled: boolean }>;
}): ResolvedAccess;

// PermissionGuard (trecho conceitual)
const gate = reflector.getAllAndOverride<string[]>(REQUIRED_ACCESS_KEY, [handler, class]) ?? [];
// passa se existe item i em gate ∩ enabled tal que required ⊆ i.permissions
// Deny → throw new AccessDeniedError('FORBIDDEN: área desativada para este usuário')
```
Por que por item: `commercial.manage` guarda tanto Relatórios/Etapas (`commercial-reports.resolver.ts:34,43`; `commercial.resolver.ts:35-60`) quanto excluir/reabrir/trocar responsável (`commercial-deals.resolver.ts:75,96,106,134`). Atendente que ganha `comercial-relatorios` recebe `commercial.manage` **só dentro daquele item**; nas operações do Pipeline/Leads (gate = itens que ela já tem por padrão) a permissão continua a do papel e o `manage` não vale.

### Pattern 3: porteiros (gates) nomeados para dados de referência
Dependências entre itens (decisão "mais simples que não quebre a tela"): **consulta de referência = OU entre o item dono e todos os itens cujas telas a consomem; escrita = só o item dono** (exceção: criação rápida de cliente).

| Gate | Operações | Itens aceitos (OU) |
|------|-----------|--------------------|
| `CLIENTES_REF` | `clients`, `client`, `clientsByField`, `clientOverview`, `clientHistory`, `createClient` | clientes-todos, agenda, fin-comandas, fin-credito, noivas, contratos, comercial-leads, comercial-pipeline |
| `CLIENTES_ESCRITA` | `updateClient`, `softDeleteClient`, `restoreClient` | clientes-todos |
| `CATALOGO_REF` | `services`, `service`, `packages`, `package`, `products`, `product`, `categories`, `category`, `professionalsForService`, `commissionRules` (leitura), `bridalAssistantSettings` | item dono + agenda, fin-comandas, noivas, contratos, comercial-pipeline |
| `MEMBROS_REF` | `members`, `allMembers`, `pendingInvitations` (leitura) | **sem gate de item** (dado de referência de toda tela; já redigido por `redactPersonal`, `members.service.ts:139`) |
| `NOTIF` | `notifications`, `unreadNotificationCount`, `markNotificationRead`, `markAllNotificationsRead`, `registerDeviceToken`, `unregisterDeviceToken`, `pushConfig` | **sem gate de item** (sempre ligado); o *conteúdo* é filtrado (ver Push) |
| `NOIVAS`/`CONTRATOS` | `bridal*`, `scheduleBridalEvent`, `confirmBridal*`, `suggestBridalSchedule`, `contract*`, `recordContractPayment` etc. | OU mútuo: noivas ↔ contratos (Contratos abre a partir de Noivas, `ContractLinkCard`) |

Escritas de catálogo (`createService`, `updatePackage`, `adjustStock`, …) = só o item dono (`servicos-todos`, `pacotes-todos`, `produtos-todos`, `categorias`).

### Pattern 4: efetivo no frontend a partir de uma única query
```graphql
extend type Query {
  myAccess: MyAccess!                       # sem @RequirePermission: qualquer membro autenticado
  memberAccess(memberId: UUID!): MemberAccess!   # @RequirePermission(member.editRole) + regra D-08
}
extend type Mutation {
  setMemberAccess(input: SetMemberAccessInput!): SetMemberAccessPayload!   # {memberId, changes:[{itemId, enabled}]}
  resetMemberAccess(memberId: UUID!): SetMemberAccessPayload!               # "voltar ao padrão"
}
type MyAccess {
  roleName: String!          # do BANCO (corrige o roleName velho do store)
  items: [MyAccessItem!]!    # id, enabled, gained (GRANTED), permissions: [String!]!
  permissions: [String!]!    # união (para useHasPermission genérico)
  canManageAccess: Boolean!
}
```
Erros de domínio seguem o padrão do repo (`errors: [UserError!]!` no payload).

### Anti-padrões a evitar
- **Segundo `APP_GUARD`:** estender o `PermissionGuard` existente (ordem de registro importa: `authz.module.ts:13-23`).
- **Comparar `roleName` em serviço:** o Comercial já centralizou em `commercial-access.ts` ("único ponto de decisão"); replicar o padrão: trocar `roleName` por `scopeAll`/`access` calculado pelo `AccessService`, nunca por checagem local.
- **Ler papel do JWT para escopo:** usar o do banco (`access.roleName`).
- **Gravar override igual ao padrão:** só diferenças; religar o que já é padrão apaga a linha.
- **Recusar com `ForbiddenException`** (code `FORBIDDEN` → logout no `error-link`).

## Don't Hand-Roll

| Problema | Não construir | Usar | Por quê |
|----------|---------------|------|---------|
| Auditoria | tabela própria de histórico | `recordAudit` (`common/audit-log.ts`) dentro da mesma transação | já é append-only e faz rollback junto; padrão `bridal.assistant.rate.update` (`packages.service.ts:460`) |
| Isolamento por salão | filtro manual por `organization_id` | RLS forçada + `runWithTenant` | regra do projeto |
| Atualização periódica | WebSocket/subscription | `pollInterval: 60000` + refetch em eventos | precedente do sino (`notifications.api.ts:55`); subscriptions não existem no frontend |
| Toggle acessível | lib nova | `<button role="switch" aria-checked>` | 1 componente; sem dependência |
| Catálogo duplicado no frontend | cópia manual de padrões por papel | `myAccess`/`memberAccess` entregam `defaultEnabled`/`enabled` | evita o espelho estático que já divergiu (3 arquivos `*-permissions.ts`) |

## Inventário completo (pedido 1)

Legenda de flag: **ATIVO** = destino existe e a flag liga; **PH** = placeholder (flag desligada, `features.ts`), fora da tela de acessos (D-07). Fonte do menu: `menu-config.ts`; rotas: `router.tsx:109-152`; flags: `features.ts:16-59, 81-111`.

### Itens ATIVOS (candidatos ao catálogo; 24 + Início)

| id (menu-config) | Rota(s) | `requires` (padrão) | Operações de API que servem o item | Compartilhado / sem gate hoje |
|---|---|---|---|---|
| `home` (Início, :79) | `/dashboard` (`HomeRoute`) | — sempre ligado | cartões: `financialSummary`, `cashForecast`, `appointments`, `comandas`, `contracts` | Cartões do painel precisam esconder-se por item (ver Frontend) |
| `agenda` (:88) | `/agenda` | appointment.read | `appointments`, `timeBlocks`, `create/move/cancelAppointment`, `updateAppointmentStatus`, `createVisit`, `create/deleteTimeBlock` (`appointments.resolver.ts:38-132`) | Profissional forçada a "só os dela" por `roleName` (`:24-27`) |
| `clientes-todos` (:105) | `/clientes`, `/clientes/novo`, `/clientes/:id`, `/clientes/:id/editar` | client.read | `clients.resolver.ts:18-101` (9 ops) | Consumido por agenda, comandas, noivas, contratos, comercial (gate `CLIENTES_REF`) |
| `profissionais-todos` (:133) | `/profissionais` | member.read | leitura: `members`, `allMembers`, `professionalsForService`, `pendingInvitations`; escrita: `inviteMember`, `revokeInvitation`, `createMember`, `updateMember`, `resetMemberPassword`, `deactivate/reactivate/deleteMemberPermanently` (`members.resolver.ts`, `invitation.resolver.ts`) | Leitura é referência de todas as telas e já vem redigida; **padrão ligado para todos os papéis**; escrita fica por papel (`member.*`), não "ganhável" (ver Open Q 3) |
| `profissionais-perfis` (:140) | `/profissionais/perfis` — **hoje PH** (`GATED_PATHS` linha 88 → flag `configuracoes=false`) | member.editRole; `grantable:false` | **novas** `memberAccess`, `setMemberAccess`, `resetMemberAccess` | Precisa trocar a flag da rota para uma nova (`perfisAcesso: true`) |
| `servicos-todos` (:163) | `/catalogo/servicos` | service.read | `services.resolver.ts:23-56` | referência (agenda/comanda/noivas) |
| `produtos-todos` (:188) | `/catalogo/produtos` (badge `lowStock`) | product.read | `products.resolver.ts:16-73` incl. `lowStockCount` | `lowStockCount` alimenta o badge do menu no `AppShell`; notificação `stock_low` |
| `pacotes-todos` (:206) | `/catalogo/pacotes` | package.read | `packages.resolver.ts`, `package-timeline.resolver.ts`, `bridalAssistantSettings` | campos de custo mascarados por `canSeeCatalogCosts(roleName)` (`packages.resolver.ts:88-131`) |
| `categorias` (:216) | `/catalogo/categorias` | category.read | `categories.resolver.ts:28-67` | referência |
| `fin-controle` (:230) | `/financeiro` | financial.read | `financialSummary`, `cashMovements` (`financial.resolver.ts:39,50`) | `financial.read` é compartilhado com previsão, despesas fixas, dashboard, custo de pacote |
| `fin-previsao` (:237) | `/financeiro/previsao` | financial.read | `cashForecast` (`forecast.resolver.ts:15`), `fixedExpenses` | idem |
| `fin-despesas-fixas` (:243) | `/financeiro/despesas-fixas` | financial.read | `fixedExpenses`, `create/update/deleteFixedExpense` (`fixed-expense.resolver.ts`) | escrita exige `financial.expenseWrite` |
| `fin-comissoes` (:264) | `/financeiro/comissoes` | commissionRecord.read | `commissionRecords`, `commissionTotals` (`financial.resolver.ts:60,76`) | Profissional vê só as dela (`:72` `maskForProfessional`, `ComissoesCalculadasPage.tsx:74`) |
| `fin-credito` (:292) | `/financeiro/credito-cliente` | credit.read | `clientCreditBalances`, `clientCreditMovements`, `adjustClientCredit` (`:91-106`) | — |
| `fin-comandas` (:327) | `/comanda`, `/comanda/:id` | comanda.read | `comanda.resolver` (11 ops, `comandas.resolver.ts:15-136`) | recorte da Profissional por `roleName` em `comandas.service.ts:68,477,506`; BottomNav usa `comanda.read` |
| `fin-regras-comissao` (:334) | `/catalogo/comissoes` | commission.read | `commissionRules`, `commissionRule`, `create/update/softDeleteCommissionRule` (`commissions.resolver.ts`) | leitura também usada pela tela de comanda (`reviewRules`) → gate `CATALOGO_REF` |
| `noivas` (:348) | `/noivas`, `/noivas/:id` | bridal.read | `bridal.resolver.ts` (13), `ai-schedule.resolver.ts`, `timeline.resolver.ts` | `scheduleBridalEvent`/`confirmBridal*` exigem `bridal.write` **e** `appointment.write` (E); `assistantDailyRate` mascarado por papel (`bridal.resolver.ts:157`) |
| `contratos` (:355) | `/contratos`, `/contratos/:id` | contract.read | `contracts.resolver.ts`, `contract-payments`, `contract-documents`, `contract-preview`, `contract-letterhead`, `contract-alerts` | mutuamente OU com `noivas` |
| `comercial-painel` (:468) | `/comercial` | commercial.read | `commercialDashboard` (`commercial-reports.resolver.ts:25`) | — |
| `comercial-leads` (:475) | `/comercial/leads`, `/comercial/leads/:id` | commercial.read | leads/deals/interações/importação (`commercial.resolver.ts`, `commercial-deals.resolver.ts`, `commercial-win.resolver.ts`) | **compartilhado com pipeline** (mesmos resolvers) |
| `comercial-pipeline` (:481) | `/comercial/pipeline` | commercial.read | `commercialStages`, deals (mesmos resolvers de leads) | idem |
| `comercial-lembretes` (:489) | `/comercial/lembretes` | commercial.read | `commercial-reminders.resolver.ts` (7 ops) | push do lembrete |
| `comercial-relatorios` (:496) | `/comercial/relatorios` | commercial.read + commercial.manage | `commercialReport`, `commercialReportExport` (`commercial-reports.resolver.ts:34,43`) | recorte por `visibilityWhere(viewer)` no serviço |
| `comercial-config` (:504) | `/comercial/configuracoes` | commercial.read + commercial.manage | etapas e formulário (`commercial.resolver.ts:35-60,136-142`, `commercial-intake.resolver.ts:25-40`) | — |

Como leads e pipeline compartilham resolvers, o gate das operações de negócio/lead é `['comercial-leads','comercial-pipeline']` (OU). Desligar só um deles esconde menu e rota, mas a API segue aceitando via o outro (aceitável: D-06 mira menu/rota/dados de cada tela, e a tela usa as mesmas consultas; registrar como limite conhecido). `comercial-lembretes` tem resolver próprio (gate só dele); `comercial-painel` idem.

### Placeholders (PH): fora do catálogo e da tela (D-07)
`clientes-aniversariantes` (flag `clientesAniversariantes`), `clientes-ranking`, `profissionais-ranking`, `servicos-ranking`, `produtos-ranking` (`rankings`), `fin-caixa`, `fin-pagamento-prof`, `fin-fluxo`, `fin-despesas`, `fin-clientes-debito`, `fin-contas`, `fin-exportacao`, `fin-antecipacao`, `fin-motivos` (`financeiroRelatorios`), todo o grupo `relatorios` (`rel-*`, flag `relatorios`), `campanhas` (`campanhas`), `configuracoes` (`config-*`, flag `configuracoes`). Consequência: quando uma flag ligar, o mesmo commit deve incluir o id no catálogo (regra de checklist + spec de paridade).

### Resolvers sem gate hoje
`auth.resolver.ts` (7 ops, 6 com decorator de público/JWT), `admin.resolver.ts` (platform admin guard), `me` (JWT). Todo o resto tem `@RequirePermission`. Nenhum controller REST autenticado (só `health`, `public-lead`, `public-contract`). Portanto a cobertura de API é inteiramente GraphQL.

## Como o backend decide hoje (pedido 2)

1. **Guard:** `permission.guard.ts` — sem decorator libera (`:47`); resolve tenant do JWT (`:50-77`); `@RequireRole` compara `tenant.roleName` (`:85`); `@RequirePermission` faz `prisma.role.findFirst({name: roleName, isSystem:true, include permissions})` por requisição (`:93-106`). `roles` é global (`organization_id` nulo, sem RLS), por isso o guard consulta sem tenant. `members` e a nova tabela têm RLS forçada, então o guard novo precisa de `runWithTenant(orgId, …)`.
2. **Interceptor de tenant:** `tenant-context.middleware.ts:60-72` monta `{organizationId, memberId, roleName}` **do JWT**.
3. **Locais que ramificam por papel e precisam consultar o acesso efetivo (D-05):**

| Local | Hoje | Mudança |
|---|---|---|
| `commercial/commercial-access.ts:8-60` (`isManagerRole`, `canUseCommercial`, `canWinDeal`, `visibilityWhere`) + `viewerOf()` em `commercial.resolver.ts:15`, `commercial-deals.resolver.ts:18`, `commercial-reminders.resolver.ts:14`, `commercial-reports.resolver.ts:12`, `commercial-intake.resolver.ts:13` | escopo "tudo" só para ADMIN/MANAGER; ATTENDANT = só os dela; PROFESSIONAL lança `FORBIDDEN` (`:61`) | `CommercialViewer` ganha `scopeAll: boolean` (manager por papel **ou** item comercial *ganho*); `visibilityWhere` usa `scopeAll`; Profissional que ganhou Comercial entra como "tudo" em vez de lançar |
| `commercial-reports.service.ts:84-87` (`visibilityWhere(viewer).deal`) | recorte do atendente | Relatórios ganhos por atendente: viewer com `scopeAll=true` (D-05 cita exatamente este caso) |
| `commercial-deals.service.ts:272, :364, :481, :558`; `commercial-leads.service.ts:226, :235, :262, :409`; `commercial-import.service.ts:52, :77`; `commercial-form-settings.service.ts:83`; `commercial-reminders.service.ts:306`; `commercial-win.service.ts:88` | `role.name in [ADMIN,MANAGER,ATTENDANT]` para listar responsáveis elegíveis; `viewer.roleName === 'ATTENDANT'`; `isManagerRole` | listar responsáveis = membros com o item comercial efetivo (helper do `AccessService`); demais trocam por `viewer.scopeAll`. `leads.service:235` (`creator.role.name not ATTENDANT`) é a fila "sem responsável"; manter e registrar como limite |
| `comandas/comandas.service.ts:68-69, :477, :506`; `financial.resolver.ts:72` | recorte da PROFESSIONAL (só as dela) | **Sem mudança**: itens `fin-comandas` e `fin-comissoes` são padrão ligado da Profissional, então ela nunca "ganha" esses itens; o recorte por papel segue válido. Regra geral: recorte por papel só muda para itens GANHOS |
| `catalog/catalog-costs.ts:15-18` (`canSeeCatalogCosts`) usado em `packages.resolver.ts:88-131` e `bridal.resolver.ts:157` | `ROLE_PERMISSIONS[roleName]` contém `financial.read` | passar a usar permissões **efetivas** (`access.permissions` contém `financial.read`): atendente que ganha `fin-controle` vê custos/diária (D-05) |
| `bridal/timeline/timeline-guard.ts:78-83` (`canOverrideTimeline`) | `ROLE_PERMISSIONS` | usar permissões efetivas (consistência) |
| `identity/members.service.ts:139` (`PERSONAL_DATA_ROLES`, `redactPersonal`) | telefone/Pix/nascimento só ADMIN/MANAGER | **manter por papel** (LGPD; `profissionais-todos` é padrão de todos, nunca "ganho"); registrar |
| `appointments.resolver.ts:24-27` | Profissional só vê a própria agenda | manter (agenda é padrão da Profissional) |
| `push/push.service.ts:28-29, :105-113, :210-225`; `contracts/alerts/contract-alerts.service.ts:48, :182-186` | destinatários por papel | ver "Push e avisos" |
| `identity/members.service.update` (`:293-420`) | troca de papel | ao mudar `roleId`, apagar overrides do membro na mesma transação + `recordAudit('member.access.reset', metadata {reason:'role_change'})` |

## Como o frontend decide hoje (pedido 3)

- **Menu:** `useMenu()` → `menuForRole(roleName)` → `filterMenuByRole` (`menu-config.ts:546-566`), que só usa `item.roles` (único uso: grupo Comercial `roles: COMMERCIAL_ROLES`, e `roles:['ADMIN','MANAGER']` em relatórios/config do Comercial). Consumidores: `SidebarNav.tsx:58,317`, `AppDrawer.tsx:37`, `GlobalSearchSheet.tsx:28`. **`BottomNav.tsx:22-25`** não usa `useMenu`: decide por `useHasPermission('comanda.read')`, `useBridalPermission('bridal.read')` e `isPathEnabled` → precisa migrar para itens (`fin-comandas`, `noivas`, `agenda`, `clientes-todos`).
- **Rotas:** `router.tsx:109-152` é uma tabela `{path, element}` filtrada só por flag (`:159`); a única guarda por papel é `CommercialRoute` (`CommercialRoute.tsx:17-19`). Detalhes (`/clientes/:id`, `/comanda/:id`, `/noivas/:id`, `/contratos/:id`, `/comercial/leads/:id`) não têm guarda.
- **~40 usos de `roleName` e 18 arquivos com `useHasPermission`** (lista completa levantada por grep; agrupados):
  - menu/layout: `use-menu.ts`, `menu-config.ts`, `BottomNav.tsx`, `HomeRoute.tsx:8-9` (`homePathForRole`), `SessionUser.tsx`/`TopHeader.tsx` (só exibição, manter).
  - comercial: `commercial-permissions.ts` (`canUse`, `isManager`, `canWin`), `CommercialRoute.tsx`, `LeadsPage.tsx:32`, `PipelinePage.tsx:25`, `LeadDetailPage.tsx:181`, `DealFormDialog.tsx:44`.
  - operações: `operations-permissions.ts` (espelho estático), `schedule-permissions.ts` (agenda: manter por papel), `ComissoesCalculadasPage.tsx:72-77`, `PrevisaoPage.tsx:156`, `DespesasFixasPage.tsx:244-245`, `FinanceiroPage.tsx:117`, `CreditoClientePage.tsx:263-264`, `ComandaListPage.tsx:40`, `ComandaPage.tsx:73-76`, `PacotesPage.tsx:49`, `PacoteForm.tsx:134`, `BridalAssistantCard.tsx:29`, `ContractLinkCard.tsx:81`, `VisitFormDialog.tsx:412`, e os 4 cartões do painel (`DayKpiStrip.tsx:59`, `ForecastCard.tsx:35`, `UpcomingContractsCard.tsx:18`, `OpenComandasCard.tsx:15-16`).
  - equipe: `team-permissions.ts`, `ProfissionaisPage.tsx:52-55,289`, `MemberEditDialog.tsx` (manter por papel, só adicionar o atalho "Acessos").
- **Store:** `permissions` nunca é populado (`useAuth.ts:30`); `partialize` persiste `permissions`/`roleName` (`auth.store.ts:120-130`) apesar do comentário "never re-hydrate". `roleName` só muda no login.

### Entrega ao frontend e atualização em ~1 min (D-13)
Recomendado (MEDIUM de confiança só no ponto 4):
1. **`useMyAccess()`** montado uma vez no `AppShell` (já é o casco autenticado): `useQuery(MyAccessQuery, {pollInterval: 60000, fetchPolicy: 'cache-and-network'})`. Resultado gravado no auth store (`access`, `accessFresh`), sobrescrevendo `roleName` e `permissions` — isso corrige de quebra o `roleName` velho.
2. **Troca de tela:** `useEffect` em `useLocation().pathname` chama `refetch()` com trava de 10 s (evita rajada).
3. **Voltar do segundo plano:** `document.addEventListener('visibilitychange', …)` (cobre PWA iPhone e Chrome) e, no app Capacitor, `App.addListener('appStateChange', ({isActive}) => isActive && refetch())` dentro do `NativeAppBridge.tsx` (já importa `@capacitor/app`, `:43`). Timers de `pollInterval` são suspensos/limitados em segundo plano, por isso os eventos são necessários, não só o poll. **MEDIUM:** o comportamento exato do WebView Android com `server.url` remoto (`capacitor.config.ts:10`) e do iOS standalone deve ser confirmado em aparelho; o plano deve ter um passo de verificação manual.
4. **Recusa da API:** `error-link.ts` passa a tratar `extensions.code === 'ACCESS_DENIED'` **antes** do bloco `FORBIDDEN`: dispara `refetch` de `myAccess`, mostra aviso ("Seu acesso a esta área foi alterado") e navega para a home; **não** chama `goToLogin()`. Também vale para permissão faltante (a recusa por permissão passa a usar o mesmo code; mensagem mantém o prefixo `FORBIDDEN:` porque os testes de integração casam `/FORBIDDEN/`, ex. `phase9-win-deal.e2e.spec.ts:272`). Lançar com `new GraphQLError(msg, {extensions:{code:'ACCESS_DENIED'}})` (padrão do `graphql` v16 usado pelo Apollo; verificar no spec do guard que o code chega ao cliente).
5. **Persistência:** persistir o último `myAccess` (menu aparece instantâneo na abertura a frio) mas rota **só nega** quando `accessFresh` (buscado nesta sessão do app); antes disso mostra `Skeleton`. Evita piscar menu indevido e evita negar por dado antigo.
6. **Impersonação de admin de plataforma:** chega como membro ADMIN (`team-permissions.ts` comentário) → `myAccess` devolve tudo ligado.
7. **Guarda de rota:** `GatedRoute` ganha `access?: string[]` (OU); novo `<AccessRoute items>` envolve o `element`. Rota negada → `Navigate` para a home efetiva. **Home efetiva:** `homePathForRole` hoje manda não-gestores para `/agenda`; se a agenda estiver desligada isso causa laço → nova regra: gestor ou `agenda` desligada → `/dashboard`; senão `/agenda`. `DashboardPage` precisa funcionar para Atendente/Profissional (hoje `HomeRoute` só renderiza o painel para ADMIN/MANAGER).
8. **Hooks:** `useHasPermission(p)` = `myAccess.permissions.includes(p)` quando `accessFresh`; antes disso cai no espelho estático atual (mantém testes existentes e abertura a frio). Novos: `useHasAccess(itemId)`, `useItemPermission(itemId, p)` (para `isManager` do Comercial por item), `useCommercialAccess` reescrito sobre eles.
9. **Cartões do painel:** cada cartão passa a depender de item (`DayKpiStrip`→`fin-controle`, `ForecastCard`→`fin-previsao`, `OpenComandasCard`→`fin-comandas`, `UpcomingContractsCard`→`contratos`, próximos atendimentos→`agenda`) para não disparar consulta recusada.

## Modelo de dados (pedido 4)

```sql
-- migration 2026112X000000_member_access_overrides
CREATE TABLE member_access_overrides (
  member_id        uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  organization_id  uuid NOT NULL REFERENCES organizations(id),
  item_id          varchar(60) NOT NULL,
  enabled          boolean NOT NULL,            -- true = concedido além do papel; false = negado
  updated_by       uuid REFERENCES members(id) ON DELETE SET NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, item_id)
);
CREATE INDEX ix_mao_org ON member_access_overrides (organization_id);
ALTER TABLE member_access_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_access_overrides FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON member_access_overrides
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);
```
(Padrão copiado de `20261122000000_phase9_commercial/migration.sql:176-208`; privilégios para `sgs_app` vêm de `ALTER DEFAULT PRIVILEGES` da migration inicial, `20260502000000_init_identity_and_rls:332-336`. Confirmar nas tabelas da fase 9 que não houve `GRANT` explícito.)

- **Sem `CHECK` de `item_id` no banco:** a validação contra o catálogo é no serviço (catálogo evolui em código; migração por item novo seria atrito). `item_id` desconhecido na leitura é ignorado.
- **Só diferenças:** o serviço calcula `default` e grava/apaga linha conforme o alvo difira do padrão. `setMemberAccess` é idempotente e aceita lote (um clique em "grupo" = N mudanças em uma transação e um único registro de auditoria).
- **Exclusão definitiva:** `purge_member` (`20261112000000_hard_delete_member_bridal`, função `SECURITY DEFINER` com deletes explícitos) termina apagando `members`; com `ON DELETE CASCADE` não precisa mudar, mas **o cleanup dos testes de integração** (`helpers/phase9-cleanup.ts` e correlatos) precisa incluir a nova tabela antes de apagar membros/orgs.
- **Mudança de papel:** apagar overrides do membro na mesma transação de `updateMember` quando `roleId` muda + auditoria + aviso na tela de edição ("os acessos ajustados desta pessoa voltam ao padrão do novo papel"). Pessoa desativada/reativada mantém os ajustes.
- **Regras D-08/D-09 no serviço (`AccessService.assertCanAdjust(actor, target)`):** alvo ADMIN → recusa (sem efeito); ator ADMIN → qualquer alvo não-admin; ator MANAGER → só alvo ATTENDANT/PROFESSIONAL e `actor.memberId !== target.memberId`; ATTENDANT/PROFESSIONAL → recusa (já barrado por `member.editRole`). `profissionais-perfis` não aceita override `enabled=true` para ATTENDANT/PROFESSIONAL. **Recomendado (Open Q 2):** Gerente só pode *conceder* itens que ele próprio tem efetivos (impede escalada quando o Admin tirou algo do Gerente).
- **Auditoria:** `recordAudit(tx, {action:'member.access.update', entityType:'member', entityId: alvo, metadata:{changes:[{itemId, from, to}], actorRole, targetRole}})`; `member.access.reset` para "voltar ao padrão" e para troca de papel. `audit_log.action` é `varchar(60)` e `entity_id` é uuid (member id serve).
- **Cache no guard:** hoje 1 consulta de `role`+`permissions` por requisição com decorator. Novo: 1 transação curta (`runWithTenant`) que lê `member` (+ `status`, `deletedAt`) com `role.permissions` e `accessOverrides`, **memoizada no contexto GraphQL** (`gqlCtx.access`) para as várias operações de uma mesma requisição HTTP (batch). **Sem cache entre requisições** nesta fase; se houver custo, versão por membro em Redis é evolução posterior. Aproveitar a leitura para recusar membro desativado/excluído (endurecimento barato; hoje o token continua valendo até 15 min).
- **Fonte do padrão:** `role_permissions` do banco (não a constante), igual ao guard atual; `ROLE_PERMISSIONS` do catálogo só serve de teste de paridade com a seed.

## Push e avisos (pedido 5)

| Fonte | Hoje | Mudança |
|---|---|---|
| Lembrete do Comercial (`push.service.ts:196-228`, `dispatchCommercialReminder`) | dono do negócio ∪ ADMIN/MANAGER, filtrados por `role.name in COMMERCIAL_ROLES` | trocar `COMMERCIAL_ROLES` por "membro tem `comercial-lembretes` efetivo" (helper `AccessService.membersWithItem(tx, ids, itemId)` sobre a mesma transação). Profissional que ganhou o Comercial e é dona do negócio passa a receber; gerente com o item negado deixa de receber |
| Push de agenda (`appointment.created/cancelled`, `bridal.scheduled`) (`push.service.ts:~100-190`, `resolve-push-targets.ts`) | profissional recebe os dela; ADMIN/MANAGER recebem todos | filtrar `managers` e `activeProfs` por `agenda` efetivo antes de `resolvePushTargets` |
| Push `bridal.cancelled` (cancelamento de contrato, `contract-payments.service.ts:103`) | idem | idem (`agenda`) |
| Alertas de contrato — notificações in-app + e-mail (`contract-alerts.service.ts:48,182-217`) | `RECIPIENT_ROLES = ['ADMIN','MANAGER']` | manter os papéis-base, **excluir quem tem `contratos` negado**; v1 não adiciona quem ganhou (registrar) |
| Notificação `stock_low` (`catalog/products/stock.ts:80-110`, `memberId = null` = organização inteira) | todos com `notification.read` | filtrar na **leitura** (`notifications`, `unreadNotificationCount`): `stock_low` só com `produtos-todos` efetivo; tipos `ALERT_KINDS` só com `contratos`. Mesma regra evita contador do sino incoerente |
| Tokens de aparelho | `registerDeviceToken` exige `notification.read` | sem mudança (item "Notificações" sempre ligado); filtro acontece no envio |

Importante: o envio roda em job (sem requisição), por isso o helper de acesso não pode depender do contexto GraphQL; precisa aceitar `tx` e lista de `memberId` e usar a mesma função pura `resolveAccess`.

## Common Pitfalls

### Pitfall 1: `FORBIDDEN` desloga a pessoa
**O que dá errado:** API recusa área desligada com `ForbiddenException`; `error-link.ts:34-95` limpa a sessão e leva ao login.
**Por quê:** o handler foi escrito supondo que `FORBIDDEN` = token adulterado.
**Como evitar:** `ACCESS_DENIED` (GraphQLError com `extensions.code`) + ramo novo no `error-link` antes do `FORBIDDEN`; teste vitest em `infrastructure/apollo/__tests__/error-link.test.ts`.
**Sinal:** E2E em que o gerente com Financeiro desligado é jogado na tela de login ao abrir a URL.

### Pitfall 2: papel e permissões velhos (JWT)
**O que dá errado:** troca de papel/ajuste só vale após 15 min ou novo login.
**Como evitar:** guard e serviços leem papel/overrides do banco; frontend sobrescreve `roleName` com `myAccess.roleName`.

### Pitfall 3: operação sem `@RequireAccess` vira buraco
**O que dá errado:** resolver novo/esquecido continua só por permissão; item desligado não bloqueia a API (viola D-02).
**Como evitar:** `access-inventory.spec.ts` percorre todos os providers/métodos com `@Query/@Mutation` (reflexão sobre `RESOLVER_TYPE_METADATA`/metadados do `@nestjs/graphql` ou lista de arquivos `*.resolver.ts`) e falha se há `@RequirePermission` sem `@RequireAccess` e fora de `ACCESS_EXEMPT` (lista explícita e comentada: `myAccess`, notificações, tokens de aparelho, `members*` leitura, auth, admin). Falha também se `@RequireAccess` cita id fora do catálogo.

### Pitfall 4: escalada por permissão compartilhada
**O que dá errado:** atendente que ganha Relatórios do Comercial vira gerente em Leads/Pipeline (`commercial.manage`).
**Como evitar:** permissões por item (Pattern 2) + teste: atendente com `comercial-relatorios` ganho chama `reopenDeal`/`deleteDeal` e recebe `ACCESS_DENIED`/`FORBIDDEN`.

### Pitfall 5: semântica E de `@RequirePermission(BRIDAL_WRITE, APPOINTMENT_WRITE)`
**O que dá errado:** quem ganha `noivas` mas não tem `appointment.write` não consegue agendar.
**Como evitar:** `managerPermissions` de `noivas` inclui `appointment.read/write` (seguro porque as operações de agenda continuam fechadas pelo gate `['agenda']`); mesmo raciocínio para `fin-comandas` (inclui `client.read/write` para o cadastro rápido).

### Pitfall 6: menu mostrando item que a API recusa (e o inverso)
**Como evitar:** menu, rotas, BottomNav, busca global, cartões do painel e hooks leem **o mesmo** `myAccess`; spec de paridade garante que todo id de folha ativa do `MENU` existe no catálogo (e vice-versa, exceto `home`).

### Pitfall 7: laço de home
Atendente/Profissional com `agenda` desligada: `homePathForRole` → `/agenda` → guarda nega → home → `/agenda`. Tratar na regra de home (item 7 acima).

### Pitfall 8: dependências quebram telas
Consultas de referência (clientes, serviços, profissionais) negadas derrubam Agenda/Comanda. Resolvido pelos gates de referência (OU de consumidores) e por `MEMBROS_REF` sem gate.

### Pitfall 9: RLS no guard
`member_access_overrides` e `members` só aparecem dentro de `runWithTenant`; consulta com `prisma` direto devolve vazio e **liberaria** (padrão "sem override" = padrão do papel) ou **bloquearia** tudo conforme a implementação. Tratar "membro não encontrado" como recusa e cobrir com teste de integração.

### Pitfall 10: switch sem acessibilidade e toque pequeno
Tela usada no celular da dona; toggles `role="switch"`, alvo >= 44 px, estado "padrão"/"ajustado" por texto (não só cor), `aria-live` ao salvar.

### Pitfall 11: flags que ligam depois
Item novo sem entrada no catálogo fica sem gate e sem linha na tela. Mitigar com a regra de que cada commit que liga uma flag de rota também adiciona o item (checklist no plano + spec de paridade que lê `MENU` já podado).

### Pitfall 12: Profissional perde itens do menu
Mudança visível de produto (padrão derivado de `requires`). Combinar com a usuária (Open Q 1) e cobrir os testes existentes `menu-por-papel.test.ts`, `sidebar-nav.test.tsx`, `menu-dom.test.tsx`, `casco-gestor-beauty.test.tsx`, `equipe-acoes-por-papel.spec.ts`, `comercial-visibilidade.spec.ts` (E2E já assertam menu por papel e precisarão ser atualizados).

## Code Examples

### Decorator (mesmo padrão de `require-permission.decorator.ts`)
```typescript
// authz/decorators/require-access.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const REQUIRED_ACCESS_KEY = 'required_access';
/** OU entre ids de item do catálogo ou nomes de gate (ACCESS_GATES). */
export const RequireAccess = (...itemsOrGates: string[]) =>
  SetMetadata(REQUIRED_ACCESS_KEY, itemsOrGates);
```

### Uso por classe com sobrescrita por método
```typescript
@Resolver()
@RequireAccess('fin-comandas')              // classe: padrão
export class ComandasResolver {
  @Query('comanda') @RequirePermission(PERMISSIONS.COMANDA_READ) comanda(/*…*/) {}
}
@Resolver()
export class CommercialReportsResolver {
  @Query('commercialDashboard') @RequireAccess('comercial-painel')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ) commercialDashboard(/*…*/) {}
  @Query('commercialReport') @RequireAccess('comercial-relatorios')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE) commercialReport(/*…*/) {}
}
```

### Viewer do Comercial com escopo
```typescript
// commercial-access.ts
export interface CommercialViewer { roleName: string; memberId: string; scopeAll: boolean }
export function visibilityWhere(v: CommercialViewer) {
  if (v.scopeAll) return { deal: { deletedAt: null }, lead: { deletedAt: null }, /* … */ };
  if (v.roleName === 'ATTENDANT') { /* recorte atual */ }
  throw new Error('FORBIDDEN'); // defesa: o guard já barrou
}
// resolver: scopeAll = isManagerRole(access.roleName) || access.item('comercial-…').source === 'GRANTED'
```

### Paridade catálogo × menu (jest do backend)
```typescript
// lê apps/frontend/src/components/layout/menu-config.ts como texto, extrai id: '…' de folhas
// com `to:` e compara com ACCESS_ITEMS ∪ PLACEHOLDER_IDS (lista explícita das 21 folhas PH)
```

## State of the Art

| Antes | Agora (esta fase) | Impacto |
|---|---|---|
| Papel do JWT decide tudo | Papel + overrides do banco por requisição | efeito imediato (D-13) |
| Espelhos estáticos de `ROLE_PERMISSIONS` no frontend (3 arquivos) | `myAccess` único | fim da divergência |
| `FORBIDDEN` = logout | `ACCESS_DENIED` = refetch + aviso | necessário para D-02 sem derrubar a sessão |
| Menu só filtra Comercial | Menu filtra por item efetivo | a Profissional deixa de ver o que já era recusado |

## Open Questions

1. **Padrão do menu derivado de `requires` muda o que a Profissional (e a Atendente) veem hoje.**
   - Sabemos: hoje o menu mostra tudo menos Comercial; a API já recusa o resto.
   - Falta: confirmação de que "padrão do papel = o que a API já permite" é o que a usuária espera (ex.: Profissional sem Financeiro/Noivas/Contratos; Atendente sem Previsão de caixa e Despesas fixas).
   - Recomendação: seguir a derivação (é o único padrão coerente com D-02) e listar a matriz padrão no checkpoint de verificação para a usuária aprovar.
2. **Gerente pode conceder item que ele mesmo não tem?** (Admin tirou Financeiro do Gerente; o Gerente liga Financeiro para uma Atendente.)
   - Recomendação: não pode (só concede o que tem efetivo); registrar como requisito PERM-08.
3. **"Profissionais › Todos os profissionais" é padrão ligado para todos os papéis (leitura de equipe).** Ações de gestão da equipe seguem por papel (`member.invite/editRole/remove`), não por item.
   - Recomendação: aceitar; ganhar o item não dá poder de gestão. Se a usuária quiser "Atendente que gerencia equipe", é outra fase (ação por tela, fora de D-01).
4. **Leads e Pipeline compartilham resolvers.** Desligar só um esconde menu/rota mas a API continua servindo via o outro. Recomendação: aceitar e documentar; só `comercial-relatorios`, `comercial-config`, `comercial-lembretes`, `comercial-painel` têm fechamento próprio na API.
5. **Alertas de contrato por e-mail/notificação para quem *ganhou* Contratos.** Recomendação v1: só os papéis-base menos negados.
6. **Comportamento real de retomada (iOS PWA instalado e WebView Android).** Recomendação: tarefa de verificação manual em aparelho no fim da fase (ver Validation).

## Environment Availability

Fase só de código/config. Auditoria rápida do ambiente (somente leitura, sem executar testes/build/docker por ordem do orquestrador): o repositório tem os frameworks necessários (jest + `jest-integration.config.ts` com `--runInBand`, vitest, Playwright `@sgs/e2e`, containers `sgs_postgres/sgs_pgbouncer/sgs_valkey` documentados no README do e2e). Não foi verificada disponibilidade dos containers porque há gate/deploy em andamento. Step 2.6: **SKIPPED (sem dependência externa nova)**.

## Validation Architecture

### Test Framework
| Propriedade | Valor |
|---|---|
| Backend unit | jest 29 + ts-jest, `corepack pnpm --filter @sgs/backend test` (`jest --config jest.config.ts`) |
| Backend integração (Postgres real, RLS) | `corepack pnpm --filter @sgs/backend test:integration` (`jest --config jest-integration.config.ts --runInBand`), specs em `apps/backend/test/integration/*.e2e.spec.ts`, fixtures em `helpers/phase9-fixtures.ts` |
| Frontend | vitest 2.1 (`corepack pnpm --filter @sgs/frontend test` = `vitest run`), `apps/frontend/vitest.config.ts` |
| E2E | Playwright `corepack pnpm --filter @sgs/e2e test:e2e tests/<prefixo>` (sobe backend :3100 e frontend :5180; seed pela API: owner, MANAGER, ATTENDANT, profissionais) |
| Execução rápida de um arquivo | `corepack pnpm --filter @sgs/backend exec jest --config jest.config.ts src/authz/access` / `corepack pnpm --filter @sgs/frontend exec vitest run src/features/access` |

### Phase Requirements → Test Map

| Req | Comportamento | Tipo | Comando automatizado | Arquivo existe? |
|---|---|---|---|---|
| PERM-01 | catálogo cobre todo item ativo do menu, ids únicos, `requires`/`managerPermissions` ⊆ permissões do Gerente, `home` e `perfis` marcados | unit (backend) + paridade | `jest --config jest.config.ts src/authz/access/access-catalog.spec.ts` | Wave 0 |
| PERM-02 | `resolveAccess`: padrão por papel (matriz 4 papéis × 24 itens), grant/deny, ADMIN ignora deny, grant redundante vira no-op, perm por item | unit puro | `jest … access-resolve.spec.ts` | Wave 0 |
| PERM-03 | migration: tabela, RLS forçada (`relforcerowsecurity`), isolamento entre orgs, cascade ao excluir membro (`purge_member`) | integração | `jest --config jest-integration.config.ts --runInBand phase10-rls-access` | Wave 0 |
| PERM-04 | API recusa com `ACCESS_DENIED` item desligado; aceita item ganho; efeito na próxima chamada com o mesmo JWT | integração | `… phase10-access-guard` | Wave 0 |
| PERM-05 | inventário: todo `@RequirePermission` tem `@RequireAccess` ou está em `ACCESS_EXEMPT`; ids existem no catálogo | unit (reflexão) | `jest … access-inventory.spec.ts` | Wave 0 |
| PERM-06 | Comercial: atendente com Relatórios ganho vê tudo nos relatórios mas não ganha `manage` em Leads/Pipeline; profissional com Comercial ganho vê como gerente; negado some do lembrete | integração | `… phase10-commercial-scope` | Wave 0 |
| PERM-07 | custo/diária visíveis a quem ganhou `fin-controle` (permissão efetiva) | integração | `… phase10-cost-masks` | Wave 0 |
| PERM-08 | D-08/D-09: Admin ajusta qualquer não-admin; Gerente só Atendente/Profissional, nunca a si, Admin ou outro Gerente; Atendente/Profissional recusados; Gerente não concede o que não tem; `profissionais-perfis` não ligável a Att/Prof | integração | `… phase10-access-admin` | Wave 0 |
| PERM-09 | auditoria `member.access.update`/`reset` com `changes` | integração | idem | Wave 0 |
| PERM-10 | troca de papel apaga overrides + audit; membro desativado é recusado | integração | `… phase10-role-change` | Wave 0 |
| PERM-11 | push do lembrete/agenda e alertas de contrato respeitam item negado | integração/unit | `… phase10-push-access` (+ ajuste de `push-commercial.spec.ts`, `push-bridal.spec.ts`) | Wave 0 |
| PERM-12 | notificações `stock_low`/alertas de contrato filtradas na leitura | integração | `… phase10-notifications` | Wave 0 |
| PERM-13 | `useMenu` filtra por item efetivo; grupo vazio some; busca global usa o mesmo menu; BottomNav | unit (vitest) | `vitest run src/components/layout/__tests__` | atualizar `menu-por-papel.test.ts` etc. |
| PERM-14 | `AccessRoute`: nega só com `accessFresh`; detalhe de rota segue o item; home sem laço | unit (vitest) | `vitest run src/features/access` | Wave 0 |
| PERM-15 | `error-link`: `ACCESS_DENIED` não limpa sessão, dispara refetch; `FORBIDDEN` continua limpando | unit (vitest) | `vitest run src/infrastructure/apollo` | estender `error-link.test.ts` |
| PERM-16 | tela Perfis: lista, padrão vs ajustado, toggle de item e de grupo, voltar ao padrão, atalho no `MemberEditDialog`, a11y do switch | unit + E2E | `vitest run src/features/access` ; `test:e2e tests/permissoes-` | Wave 0 |
| PERM-16/D-13 | menu muda em até 1 min sem relogar (poll) e ao trocar de tela | E2E | `test:e2e tests/permissoes-menu-ao-vivo` | Wave 0 |
| D-13 PWA/Android | retomada do segundo plano atualiza o menu | **manual** (iPhone PWA instalado + Android Gestor Beauty) | roteiro no plano de verificação | manual-only (depende de aparelho) |

### Taxa de amostragem
- Por commit de tarefa: jest/vitest do módulo tocado (< 30 s).
- Por merge de onda: `corepack pnpm --filter @sgs/backend test` + `--filter @sgs/frontend test` + integração dos specs `phase10-*`.
- Gate de fase: suíte completa verde + E2E `permissoes-*` e os E2E de menu por papel atualizados, antes de `/gsd:verify-work`.

### Lacunas da Wave 0
- [ ] `apps/backend/src/authz/access/*.spec.ts` (catálogo, resolve, inventário)
- [ ] `apps/backend/test/integration/helpers/phase10-fixtures.ts` (reusa `createPhase9World`; adiciona helper para gravar override e logar como cada papel) e `phase10-cleanup.ts` (apaga `member_access_overrides` antes de membros)
- [ ] `apps/frontend/src/features/access/__tests__/`
- [ ] `apps/e2e/tests/permissoes-*.spec.ts` (+ `support/phase10.ts` com `setMemberAccessViaApi`)
- [ ] Atualizar testes existentes que fixam menu por papel (lista no Pitfall 12)

## Proposed Requirements

Copiar para `REQUIREMENTS.md` em nova seção "### Permissões por usuário (Fase 10)" e para a tabela de rastreio (`Phase 10`).

- [ ] **PERM-01**: Existe um catálogo de itens de acesso (um por submenu ativo do menu, mais o grupo como agrupador na tela); itens placeholder (flag desligada) ficam fora do catálogo e da tela; "Início", notificações e a troca de senha/perfil ficam sempre ligados e fora do ajuste _(10 D-06, D-07, critério do Claude)_
- [ ] **PERM-02**: O padrão de cada item para cada papel é derivado das permissões que o papel já tem no banco; quem ganha um item passa a poder nele o mesmo que o Gerente, e quem tem o item ligado por padrão mantém o que o papel já permitia _(10 D-04, D-05)_
- [ ] **PERM-03**: Admin/Gerente liga ou desliga cada item para uma pessoa (tirar e dar); só a diferença em relação ao padrão é guardada, por membro e por salão, com isolamento por salão (RLS forçada) _(10 D-04, D-12)_
- [ ] **PERM-04**: Item desligado para a pessoa: a API recusa com um erro de acesso próprio (sem derrubar a sessão) na próxima ação, e o item ligado a mais passa a funcionar na API; o acesso é lido do banco a cada requisição, não do token _(10 D-02, D-13)_
- [ ] **PERM-05**: Toda operação da API que hoje exige permissão passa a declarar também o(s) item(ns) de acesso que a servem; um teste automático falha se alguma ficar de fora _(10 D-02, critério do Claude)_
- [ ] **PERM-06**: Quem ganha um item do Comercial passa a ver como o Gerente: Atendente com Relatórios vê os relatórios de todos (sem ganhar poder de excluir/trocar responsável nos Leads e Pipeline) e Profissional com Comercial vê todos os leads e negócios _(10 D-05, D-06)_
- [ ] **PERM-07**: Quem ganha Financeiro (controle, previsão ou despesas fixas) vê também os custos e a diária da assistente que antes eram só do Gerente; recortes "só os meus" de itens que o papel já tinha (comandas e comissões da Profissional, agenda) continuam valendo _(10 D-05)_
- [ ] **PERM-08**: Admin sempre vê tudo e não é ajustável; Admin ajusta qualquer pessoa; Gerente ajusta só Atendente e Profissional (nunca a si, outro Gerente ou Admin) e só concede itens que ele mesmo tem; Atendente e Profissional não ajustam acessos _(10 D-08)_
- [ ] **PERM-09**: "Perfis de acesso" não pode ser ligado para Atendente nem Profissional _(10 D-09)_
- [ ] **PERM-10**: Cada mudança de acesso (e cada "voltar ao padrão") grava no registro de auditoria quem mudou, em quem, quais itens e de qual valor para qual _(10, critério do Claude)_
- [ ] **PERM-11**: Quando a pessoa muda de papel, os ajustes dela voltam ao padrão do novo papel, com aviso na tela de edição, e a mudança é auditada _(10, critério do Claude)_
- [ ] **PERM-12**: Lembretes do Comercial, avisos de agenda (push), alertas de contrato (notificação e e-mail), estoque baixo e o contador do sino respeitam o item desligado: quem perdeu o item não recebe nem vê o aviso _(10 critério do Claude)_
- [ ] **PERM-13**: O menu (barra lateral, gaveta do celular, barra inferior e busca global) mostra só os itens ligados para a pessoa; grupo sem itens some; cartões do painel inicial não aparecem nem consultam o que está desligado _(10 D-02, D-06)_
- [ ] **PERM-14**: A rota (inclusive telas de detalhe) de um item desligado bloqueia e leva a pessoa para uma tela inicial válida, sem laço e sem logout _(10 D-02)_
- [ ] **PERM-15**: O app consulta os acessos da pessoa e atualiza o menu em até 1 minuto, ao trocar de tela, ao voltar do segundo plano (iPhone instalado e Android) e quando a API recusa, sem sair e entrar _(10 D-13)_
- [ ] **PERM-16**: A tela Profissionais › Perfis de acesso lista as pessoas ativas e, para cada uma, as áreas e itens com liga/desliga acessível, controle de grupo, indicação do que é padrão do papel e do que foi ajustado e "voltar ao padrão"; o atalho "Acessos" no editar profissional abre o mesmo ajuste _(10 D-06, D-10, D-11)_

## Sugestão de ondas (pedido 7)

**Onda 0 — fundação (TDD, sem I/O):** catálogo + `resolveAccess` + specs de catálogo/paridade/matriz de papéis; decisões dos Open Q 1-2 confirmadas com a usuária. Entrega: PERM-01, 02 (domínio).

**Onda 1 — dados e núcleo da API:** migration `member_access_overrides` (RLS) + modelo Prisma + `AccessService` (carrega do banco, memoiza no contexto) + `@RequireAccess` + extensão do `PermissionGuard` com `AccessDeniedError` + `access.graphql` (`myAccess`) + cleanup dos testes de integração. Deploy seguro: guard só ativa quando há `@RequireAccess` (sem anotação o comportamento é o atual). Entrega: PERM-03, 04 (base).

**Onda 2 — cobertura da API (volumosa, paralelizável por pasta):** anotar todos os resolvers (financeiro, comandas, catálogo, clientes, equipe, noivas/contratos, comercial) + `access-inventory.spec.ts` + gates de referência. Entrega: PERM-05.

**Onda 3 — escopos e avisos (D-05):** `CommercialViewer.scopeAll` e listas de responsáveis, máscaras de custo/diária por permissão efetiva, reset por troca de papel, push/alertas/notificações filtrados. Entrega: PERM-06, 07, 11, 12.

**Onda 4 — administração:** `memberAccess`, `setMemberAccess`, `resetMemberAccess` com regras D-08/D-09, subconjunto do Gerente e auditoria. Entrega: PERM-08, 09, 10.

**Onda 5 — frontend núcleo:** `error-link` (`ACCESS_DENIED`), `useMyAccess` + store, `useMenu` por itens, `AccessRoute` + `GatedRoute.access`, home sem laço, `BottomNav`, cartões do painel, hooks `useHasPermission`/`useCommercialAccess` sobre `myAccess`, remoção de `roles`/`COMMERCIAL_ROLES` do menu, atualização dos testes de menu. Entrega: PERM-13, 14, 15.

**Onda 6 — tela e atalho:** `PerfisAcessoPage` (flag `perfisAcesso` substitui a de `/profissionais/perfis` em `features.ts:88`), `MemberAccessPanel`, atalho "Acessos" e aviso de troca de papel no `MemberEditDialog`. Entrega: PERM-16.

**Onda 7 — E2E e verificação:** Playwright `permissoes-*` (gerente sem Financeiro; atendente com Financeiro vê o caixa todo; ao vivo em <= 1 min; ACCESS_DENIED sem logout), atualização dos E2E de menu por papel, roteiro manual iPhone PWA + Android. Gate completo antes de commit (preferência do usuário) e deploy de staging com worktree limpo se houver trabalho alheio.

Ondas 2 e 3 podem andar em paralelo depois da 1; 5 pode começar depois da 1 (contrato `myAccess` fixado) em paralelo com 2-4.

## Riscos (resumo para o planejador)

| Risco | Severidade | Mitigação |
|---|---|---|
| `FORBIDDEN` → logout | Alta | `ACCESS_DENIED` + `error-link` (Pitfall 1) |
| Operação sem `@RequireAccess` | Alta | spec de inventário por reflexão |
| Escalada via `commercial.manage` | Alta | permissões por item |
| JWT com papel velho | Média | papel do banco; `myAccess.roleName` |
| Menu muda para Profissional/Atendente | Média (produto) | confirmar matriz padrão |
| Custo por requisição no guard | Baixa | memoização por requisição; 1 transação curta; sem cache global |
| Retomada em segundo plano (iOS/Android) | Média | eventos + poll + verificação manual |
| Cleanup de testes de integração/`purge_member` | Média | `ON DELETE CASCADE` + helper de cleanup |
| Muitos arquivos tocados (~30 resolvers, ~25 arquivos de frontend) | Média | ondas 2/3 por pasta, inventário automático |

## Sources

### Primário (HIGH, leitura direta do código em 2026-11-24)
- `apps/backend/src/authz/guards/permission.guard.ts`, `authz.module.ts`, `tenant-context.middleware.ts`, `permissions.catalog.ts`, `decorators/*`
- `apps/backend/src/commercial/commercial-access.ts` e serviços citados; `catalog/catalog-costs.ts`; `bridal/timeline/timeline-guard.ts`; `comandas/comandas.service.ts`; `financial/financial.resolver.ts`; `identity/members.service.ts`; `push/push.service.ts`, `resolve-push-targets.ts`; `contracts/alerts/contract-alerts.service.ts`; `catalog/products/stock.ts`; `common/audit-log.ts`; `database/tenant-context.service.ts`; `auth/token.service.ts`, `auth.service.ts`
- `apps/backend/prisma/migrations/20261122000000_phase9_commercial` (padrão RLS), `20261112000000_hard_delete_member_bridal` (`purge_member`), `20260918220000_*` (`auth_user_memberships`)
- `apps/frontend/src/components/layout/menu-config.ts`, `use-menu.ts`, `BottomNav.tsx`, `config/features.ts`, `router.tsx`, `infrastructure/stores/auth.store.ts`, `infrastructure/apollo/error-link.ts`, `refresh-session.ts`, `infrastructure/native/NativeAppBridge.tsx`, `features/*/…-permissions.ts`, `features/commercial/components/CommercialRoute.tsx`, `features/notifications/api/notifications.api.ts`
- `apps/mobile/capacitor.config.ts` (casca remota), `apps/e2e/README.md`, `apps/e2e/tests/comercial-visibilidade.spec.ts`, `apps/backend/test/integration/phase9-*`
- `.planning/phases/10-permiss-es-por-usu-rio/10-CONTEXT.md`, `REQUIREMENTS.md`, `ROADMAP.md` § Phase 10

### Secundário (MEDIUM)
- Comportamento de `visibilitychange` e de timers em segundo plano no iOS PWA e no WebView Android com `server.url` remoto: conhecimento geral de plataforma, **não verificado em aparelho nesta pesquisa**.
- Code `ACCESS_DENIED` via `GraphQLError` em Apollo Server (graphql v16): padrão da biblioteca; confirmar com um teste de integração do guard.

### Terciário (LOW)
- Nenhum.

## Metadata

**Confiança:**
- Stack: HIGH (nenhuma dependência nova; tudo é padrão já existente no repo)
- Arquitetura: HIGH para o modelo em duas camadas e para a lista de pontos de mudança (leitura direta); MEDIUM para a escolha "sem cache entre requisições" (topologia de réplicas não verificada)
- Armadilhas: HIGH (as de logout, JWT velho, `commercial.manage` e laço de home foram demonstradas no código)

**Pesquisado em:** 2026-11-24
**Válido até:** 2026-12-24 (código do repositório muda rápido; revalidar listas de resolvers/arquivos se outra fase mexer em `authz/` ou no menu antes da execução)
