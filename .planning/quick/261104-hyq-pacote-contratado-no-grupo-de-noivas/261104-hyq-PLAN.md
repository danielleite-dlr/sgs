---
phase: quick-261104-hyq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/backend/prisma/schema.prisma
  - apps/backend/prisma/migrations/20261104020000_bridal_group_package/migration.sql
  - apps/backend/src/graphql/schema/bridal.graphql
  - apps/backend/src/bridal/bridal-serialize.ts
  - apps/backend/src/bridal/bridal.service.ts
  - apps/backend/src/bridal/bridal.resolver.ts
  - apps/backend/test/integration/phase4-bridal-group.e2e.spec.ts
  - apps/frontend/src/features/bridal/api/bridal.api.ts
  - apps/frontend/src/features/bridal/api/contracts.api.ts
  - apps/frontend/src/features/bridal/components/BridalGroupFormDialog.tsx
  - apps/frontend/src/features/bridal/components/ContractFormDialog.tsx
  - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx
  - apps/frontend/src/features/bridal/__tests__/bridal-fixtures.ts
  - apps/frontend/src/features/bridal/__tests__/bridal-groups-page.test.tsx
  - apps/frontend/src/features/bridal/__tests__/bridal-group-detail.test.tsx
  - apps/frontend/src/features/bridal/__tests__/contracts-page.test.tsx
autonomous: true
requirements: [QUICK-261104-hyq]

must_haves:
  truths:
    - "Ao criar/editar um grupo de noivas, a dona do salão escolhe o \"Pacote contratado\" entre os pacotes do catálogo (ou \"Sem pacote\")"
    - "Ao definir/trocar o pacote, os serviços do pacote aparecem nos serviços planejados (evento) da noiva, sem duplicar nem remover os que já existiam"
    - "Pacote inexistente, excluído (soft delete) ou de outra organização é rejeitado com erro PACKAGE_NOT_FOUND no campo packageId"
    - "Enviar packageId: null limpa o pacote do grupo sem remover serviços da noiva; omitir packageId no update mantém o atual"
    - "A página de detalhe do grupo mostra o nome do pacote contratado"
    - "Novo contrato aberto a partir do grupo (/contratos?grupo=<id>) já vem com o pacote do grupo selecionado"
  artifacts:
    - path: "apps/backend/prisma/migrations/20261104020000_bridal_group_package/migration.sql"
      provides: "Coluna bridal_groups.package_id + FK packages"
      contains: "package_id"
    - path: "apps/backend/prisma/schema.prisma"
      provides: "BridalGroup.package / Package.bridalGroups"
      contains: "bridalGroups"
    - path: "apps/backend/src/graphql/schema/bridal.graphql"
      provides: "packageId no input e packageId/packageName no tipo BridalGroup"
      contains: "packageName"
    - path: "apps/frontend/src/features/bridal/components/BridalGroupFormDialog.tsx"
      provides: "Select Pacote contratado"
      contains: "bg-package"
  key_links:
    - from: "apps/backend/src/bridal/bridal.service.ts"
      to: "bridal_member_services"
      via: "applyPackageToBrideTx em create/update"
      pattern: "applyPackageToBrideTx"
    - from: "apps/frontend/src/features/bridal/components/ContractFormDialog.tsx"
      to: "ContractGroupQuery.bridalGroup.packageId"
      via: "estado inicial do select #contract-package"
      pattern: "packageId"
---

<objective>
Permitir escolher o pacote contratado pela noiva diretamente no grupo de noivas (a dona tem 3 pacotes de noiva). Hoje o pacote só existe no diálogo de contrato.

Purpose: o grupo passa a registrar o pacote; a noiva recebe automaticamente os serviços do pacote como planejados; o contrato criado a partir do grupo já vem com o pacote.
Output: migração + backend (SDL/serviço/serializer) + frontend (select no formulário, nome no detalhe, pré-seleção no contrato) + testes.

Escopo FECHADO (não rediscutir): coluna nullable em bridal_groups, sem tabela nova; preencher serviços da noiva apenas adicionando os que faltam.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@apps/backend/src/bridal/bridal.service.ts
@apps/backend/src/bridal/bridal-serialize.ts
@apps/frontend/src/features/bridal/components/BridalGroupFormDialog.tsx
@apps/frontend/src/features/bridal/components/ContractFormDialog.tsx

<interfaces>
Prisma (apps/backend/prisma/schema.prisma):
- `model BridalGroup` (~linha 789) — sem pacote hoje. Relations: organization, createdByMember, members, contracts, appointments, timeBlocks, suggestions.
- `model Package` (~linha 335): id, organizationId, name, price Decimal(12,2), deletedAt (soft delete). Relations: services PackageService[], contracts, contractItems, comandaItems, costItems.
- `model PackageService`: packageId, serviceId, quantity, displayOrder; @@id([packageId, serviceId]).
- `model BridalMemberService`: organizationId, groupMemberId, serviceId, purpose ('event'|'trial', default 'event'), sortOrder; @@unique([groupMemberId, serviceId, purpose]).
- Último migration: 20261104010000_service_cost_from_commission.

Backend (apps/backend/src/bridal/):
- bridal-errors.ts: `new BridalError(code, message, field)` lançado dentro da transação; `mapBridalError` converte em UserError.
- bridal.service.ts:
  - `validateGroupFields(tx, input: BridalGroupFieldsInput): Promise<ValidatedFields>` (retorna name, eventDate, readyBy, locationKind, locationAddress, travelMinutesBefore/After, notes) — o resultado é espalhado em `data` do create/update.
  - `create(orgId, memberId, input: CreateBridalGroupInput)`: cria o grupo, depois `insertMemberTx(tx, orgId, group.id, 'bride', 0, input.bride, used)` e acompanhantes; retorna group.id.
  - `update(orgId, memberId, id, input: BridalGroupFieldsInput)`: requireActiveGroup, validateGroupFields, lê `before`, update, rebuildTravelBlocksTx condicional, syncContractCoverageTx.
  - `MAX_SERVICES_PER_PERSON = 10` (só para input manual).
- bridal-serialize.ts: `BRIDAL_GROUP_INCLUDE` (members → client, services → service) e `serializeBridalGroup(row, extras)`.
- SDL bridal.graphql: `type BridalGroup { ... contractId contractCode contractStatus ... }`, `input BridalGroupFieldsInput { name! eventDate! readyBy locationKind locationAddress travelMinutesBefore travelMinutesAfter notes }` (usado por create.group e updateBridalGroup).

Integration spec apps/backend/test/integration/phase4-bridal-group.e2e.spec.ts:
- `w = await createPhase4World('p4bg')` → `w.bridalPackageId` (pacote com serviços `w.serviceId` e `w.serviceBId`), `w.otherOrgId`, `w.clientId`; helper `admin()(QUERY, vars)`; constantes CREATE/UPDATE/PAYLOAD; `fields(extra)`; `createFull()` (noiva com serviceId event + serviceBId trial).

Frontend (apps/frontend/src/features/bridal/):
- api/bridal.api.ts: fragmento `BRIDAL_GROUP_LIST_FIELDS` (incluído em BRIDAL_GROUP_FIELDS), `interface BridalGroupData`, `interface BridalGroupFieldsInput`.
- api/contracts.api.ts: `ContractGroupQuery` (bridalGroup id name eventDate status contractId members{...}), `ContractGroupResult`, `ContractPackagesQuery` (packages { id name price depositKind depositValue }), `ContractPackagesResult`.
- ContractFormDialog: corpo recebe `group` e `packages`; `const [packageId, setPackageId] = useState<string>(contract?.packageId ?? '')`; select `#contract-package` com opção "Sem pacote".
- __tests__/bridal-fixtures.ts: fixtures BridalGroupData compartilhadas.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Backend — package_id no grupo, validação e preenchimento dos serviços da noiva</name>
  <files>apps/backend/prisma/schema.prisma, apps/backend/prisma/migrations/20261104020000_bridal_group_package/migration.sql, apps/backend/src/graphql/schema/bridal.graphql, apps/backend/src/bridal/bridal-serialize.ts, apps/backend/src/bridal/bridal.service.ts, apps/backend/src/bridal/bridal.resolver.ts, apps/backend/test/integration/phase4-bridal-group.e2e.spec.ts</files>
  <behavior>
    Novo `describe`/`it`s em phase4-bridal-group.e2e.spec.ts (adicionar `packageId packageName` ao PAYLOAD):
    - create com `group: fields({ packageId: w.bridalPackageId })` e noiva só com `[{ serviceId: w.serviceId }]` → errors [], group.packageId === w.bridalPackageId, packageName === 'p4bg-pacote-noiva', serviços 'event' da noiva = {serviceId, serviceBId} (sem duplicar serviceId).
    - createFull() (noiva com serviceId event + serviceBId trial) e depois UPDATE com packageId → noiva fica com serviceId event, serviceBId event, serviceBId trial (trial preservado, nada duplicado; total 3).
    - UPDATE com packageId inexistente (uuid aleatório), com pacote soft-deleted (criar via adminPrisma com deletedAt) e com pacote de `w.otherOrgId` (criar via adminPrisma) → errors[0] = { code: 'PACKAGE_NOT_FOUND', field: 'packageId' } e grupo inalterado.
    - UPDATE com packageId: null → packageId/packageName null; serviços da noiva continuam lá. UPDATE sem a chave packageId (só fields()) em grupo com pacote → pacote mantido.
  </behavior>
  <action>
    1) Prisma: em `model BridalGroup` adicionar `packageId String? @map("package_id") @db.Uuid` e `package Package? @relation(fields: [packageId], references: [id], onDelete: SetNull)` + `@@index([packageId], name: "ix_bg_package")`; em `model Package` adicionar `bridalGroups BridalGroup[]`. Migração `20261104020000_bridal_group_package/migration.sql`: `ALTER TABLE bridal_groups ADD COLUMN package_id uuid NULL REFERENCES packages(id) ON DELETE SET NULL;` + `CREATE INDEX ix_bg_package ON bridal_groups(package_id);` (confira o nome que o Prisma espera para a FK — `bridal_groups_package_id_fkey` — usando `ADD CONSTRAINT bridal_groups_package_id_fkey FOREIGN KEY ...` para não gerar drift; rode `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url ...` ou `prisma migrate dev --create-only` se disponível, senão escreva à mão). RLS já cobre a tabela; não mexer em políticas. Rode `npx prisma migrate deploy && npx prisma generate` (carregando /root/sgs/.env linha a linha — DATABASE_URL tem `&` sem aspas).
    2) SDL bridal.graphql: em `type BridalGroup` adicionar `packageId: UUID` e `packageName: String`; em `input BridalGroupFieldsInput` adicionar `packageId: UUID` (comentário: omitido = mantém, null = limpa). Atualizar o tipo TS correspondente de BridalGroupFieldsInput no serviço/resolver (`packageId?: string | null`). O resolver só repassa — mexer apenas se houver tipagem/mapeamento explícito de campos.
    3) bridal-serialize.ts: em `BRIDAL_GROUP_INCLUDE` incluir `package: { select: { id: true, name: true } }`; em `serializeBridalGroup` expor `packageId: row.packageId` e `packageName: row.package?.name ?? null` (pacote soft-deleted continua mostrando o nome — é histórico do que foi contratado).
    4) bridal.service.ts:
       - `async function validatePackage(tx, orgId, packageId: string): Promise<string>`: `tx.package.findFirst({ where: { id: packageId, organizationId: orgId, deletedAt: null }, select: { id: true } })`; se nulo `throw new BridalError('PACKAGE_NOT_FOUND', 'Pacote não encontrado.', 'packageId')`.
       - `async function applyPackageToBrideTx(tx, orgId, groupId, packageId)`: busca a noiva (`bridalGroupMember.findFirst({ where: { groupId, role: 'bride' } })`; se não houver, retorna); lê `packageService.findMany({ where: { packageId, service: { deletedAt: null } }, orderBy: { displayOrder: 'asc' } })`; lê os `bridalMemberService` da noiva com purpose 'event'; filtra os serviceIds que ainda não existem (quantity>1 vira uma linha só — unique constraint); `createMany({ data: missing.map((s, i) => ({ organizationId: orgId, groupMemberId: bride.id, serviceId: s.serviceId, purpose: 'event', sortOrder: maxSort + 1 + i })), skipDuplicates: true })`, onde maxSort = maior sortOrder atual de TODOS os serviços da noiva (ou -1). NUNCA deletar serviços. Não aplicar MAX_SERVICES_PER_PERSON aqui (o pacote vem do catálogo).
       - create: se `input.group.packageId` (string), validar ANTES do create e incluir `packageId` no `data`; após `insertMemberTx` da noiva, chamar `applyPackageToBrideTx`.
       - update: incluir `packageId: true` no select de `before`; se `input.packageId === undefined` não tocar no campo; se `null`, gravar `packageId: null`; se string, validar e gravar; quando o pacote resultante for não-nulo E diferente de `before.packageId`, chamar `applyPackageToBrideTx` antes de `syncContractCoverageTx`. Manter `validateGroupFields` sem o packageId (tratar separado para preservar a semântica undefined/null).
    5) Escrever os testes do <behavior> primeiro (RED), depois implementar (GREEN). Mensagens/códigos em pt-BR conforme padrão existente.
  </action>
  <verify>
    <automated>cd /root/sgs/apps/backend && set -a && while IFS= read -r l; do [[ "$l" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && export "${l%%=*}=${l#*=}"; done < /root/sgs/.env && npx prisma migrate deploy && npx prisma generate && cd /root/sgs && corepack pnpm --filter @sgs/backend lint && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration -- phase4-bridal-group phase4-contracts-core phase4-schema-smoke</automated>
  </verify>
  <done>Migração aplicada; createBridalGroup/updateBridalGroup aceitam packageId; payload expõe packageId/packageName; serviços do pacote entram na noiva sem duplicar/remover; PACKAGE_NOT_FOUND para inválido/excluído/outra org; null limpa; specs de integração verdes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Frontend — select "Pacote contratado", nome no detalhe e pré-seleção no contrato</name>
  <files>apps/frontend/src/features/bridal/api/bridal.api.ts, apps/frontend/src/features/bridal/api/contracts.api.ts, apps/frontend/src/features/bridal/components/BridalGroupFormDialog.tsx, apps/frontend/src/features/bridal/components/ContractFormDialog.tsx, apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx, apps/frontend/src/features/bridal/__tests__/bridal-fixtures.ts, apps/frontend/src/features/bridal/__tests__/bridal-groups-page.test.tsx, apps/frontend/src/features/bridal/__tests__/bridal-group-detail.test.tsx, apps/frontend/src/features/bridal/__tests__/contracts-page.test.tsx</files>
  <behavior>
    - bridal-groups-page.test: abrir "Novo grupo" → existe select com label "Pacote contratado" listando "Sem pacote" + pacotes mockados (via ContractPackagesQuery); escolher um pacote e salvar envia `group.packageId` na CreateBridalGroupMutation (mock com variables exatas).
    - bridal-group-detail.test: grupo com packageName 'Pacote Ouro' mostra "Pacote contratado" / "Pacote Ouro"; sem pacote mostra "—".
    - contracts-page.test (caso existente `/contratos?grupo=g1`): com ContractGroupQuery retornando packageId 'p1' e ContractPackagesQuery com p1, o select `#contract-package` vem com valor 'p1' (e o aviso "Os serviços da noiva entram pelo preço do pacote" aparece). Se o packageId do grupo não estiver na lista de pacotes (excluído), o select fica em ''.
  </behavior>
  <action>
    1) api/bridal.api.ts: adicionar `packageId` e `packageName` em `BRIDAL_GROUP_LIST_FIELDS`, `packageId: string | null; packageName: string | null` em `BridalGroupData`, `packageId?: string | null` em `BridalGroupFieldsInput`. api/contracts.api.ts: adicionar `packageId` em `ContractGroupQuery` e `packageId: string | null` em `ContractGroupResult.bridalGroup`.
    2) BridalGroupFormDialog.tsx: `useQuery<ContractPackagesResult>(ContractPackagesQuery, { skip: !open })` (reusar a query do contrato, que já lista os pacotes do catálogo não excluídos); estado `const [packageId, setPackageId] = useState(group?.packageId ?? '')`; novo campo logo após "Data do evento"/"Pronta até" (seguir o mesmo markup/classes do select `bg-location`: `<Label className={LABEL_CLASS} htmlFor="bg-package">Pacote contratado</Label>` + `<select id="bg-package">` com `<option value="">Sem pacote</option>` e um option por pacote `"{name} — {brl(price)}"` usando o formatador já usado no ContractFormDialog). Texto de ajuda curto: "Os serviços do pacote entram nos serviços da noiva." Em `buildGroupFields` enviar `packageId: packageId || null`. Se o pacote atual do grupo não estiver na lista (excluído), incluir uma option extra com `group.packageName` para não perder o valor.
    3) BridalGroupDetailPage.tsx: no `<dl>` do cabeçalho adicionar bloco `<dt>Pacote contratado</dt><dd>{group.packageName ?? '—'}</dd>` (mesmas classes dos blocos vizinhos; o grid sm:grid-cols-4 acomoda).
    4) ContractFormDialog.tsx: inicializar `useState<string>(contract ? (contract.packageId ?? '') : (group.packageId && packages.some((p) => p.id === group.packageId) ? group.packageId : ''))`. Edição de contrato continua usando o pacote do contrato.
    5) Atualizar fixtures (`bridal-fixtures.ts`: packageId/packageName null) e mocks Apollo dos testes existentes que agora disparam ContractPackagesQuery (abrir o diálogo do grupo) ou cujo ContractGroupQuery precisa de `packageId` (MockedProvider falha em campo ausente). Escrever os testes do <behavior>. Não alterar apps/e2e/tests/noivas-contrato.spec.ts (o grupo do E2E é criado sem pacote; `#contract-package` continua existindo).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend lint && corepack pnpm --filter @sgs/frontend exec tsc -b && corepack pnpm --filter @sgs/frontend test</automated>
  </verify>
  <done>Formulário do grupo mostra e envia "Pacote contratado"; detalhe exibe o nome; novo contrato a partir do grupo vem com o pacote pré-selecionado; vitest, lint e tsc verdes.</done>
</task>

</tasks>

<verification>
Gate completo antes do commit (regra do usuário), a partir de /root/sgs:
- `corepack pnpm --filter @sgs/backend lint` e `corepack pnpm --filter @sgs/frontend lint`
- `corepack pnpm --filter @sgs/backend typecheck` e `corepack pnpm --filter @sgs/frontend exec tsc -b`
- `corepack pnpm --filter @sgs/backend test` e `corepack pnpm --filter @sgs/frontend test`
- `corepack pnpm --filter @sgs/backend test:integration` (env de /root/sgs/.env carregado linha a linha; `npx prisma migrate deploy` + `npx prisma generate` antes). Ignorar SOMENTE phase4-alerts-boot e phase4-contract-alerts (Redis NOAUTH local).
NÃO fazer deploy nem push — o orquestrador cuida disso.
</verification>

<success_criteria>
- bridal_groups.package_id existe (nullable, FK packages ON DELETE SET NULL), schema Prisma sem drift.
- Selecionar um dos 3 pacotes de noiva no grupo grava o pacote, mostra o nome no detalhe e preenche os serviços da noiva sem duplicar.
- Contrato novo vindo do grupo já abre com o pacote do grupo.
- Todos os gates verdes (exceto as 2 specs de Redis conhecidas).
</success_criteria>

<output>
After completion, create `.planning/quick/261104-hyq-pacote-contratado-no-grupo-de-noivas/261104-hyq-SUMMARY.md`
</output>
