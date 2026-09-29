---
phase: quick-260929-dek
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/backend/src/identity/members.service.ts
  - apps/backend/test/integration/members-lifecycle.e2e.spec.ts
  - apps/frontend/src/features/identity/team-permissions.ts
  - apps/frontend/src/features/identity/__tests__/team-permissions.test.ts
  - apps/frontend/src/pages/ProfissionaisPage.tsx
  - apps/frontend/src/pages/__tests__/profissionais-page.test.tsx
  - apps/frontend/nginx.conf
autonomous: true
requirements: [EQUIPE-02, EQUIPE-03, EQUIPE-05]

must_haves:
  truths:
    - "MANAGER em /profissionais ve Convidar e Revogar convite, mas nao ve Editar/Desativar/Reativar (coluna de acoes de membros some)"
    - "ATTENDANT e PROFESSIONAL em /profissionais nao veem nenhuma acao (nem CTA de convite no header/empty state, nem coluna de acoes dos convites)"
    - "ADMIN (inclusive platform admin impersonando, roleName 'ADMIN') continua vendo todas as acoes"
    - "Rebaixar o ultimo ADMIN ativo para outro papel devolve errors[{code:'LAST_ADMIN'}] e nao altera o banco"
    - "Desativar o ultimo ADMIN ativo devolve LAST_ADMIN com payload completo (futureAppointmentCount 0, blockingAppointments [], activeCommissionRuleCount) e nao altera o banco"
    - "Com outro ADMIN ativo na org, rebaixar/desativar um ADMIN funciona como antes"
    - "index.html e servido com Cache-Control: no-cache; assets com hash mantem cache de 1 ano; headers de seguranca presentes em todas as respostas"
  artifacts:
    - path: "apps/frontend/src/features/identity/team-permissions.ts"
      provides: "canInviteMembers / canManageMembers espelhando ROLE_PERMISSIONS"
      exports: ["canInviteMembers", "canManageMembers"]
    - path: "apps/backend/src/identity/members.service.ts"
      provides: "guarda de ultimo admin em update() e deactivate()"
      contains: "LAST_ADMIN"
    - path: "apps/frontend/nginx.conf"
      provides: "no-cache para index.html"
      contains: "location = /index.html"
  key_links:
    - from: "apps/frontend/src/pages/ProfissionaisPage.tsx"
      to: "useAuthStore roleName"
      via: "canInviteMembers(roleName) / canManageMembers(roleName)"
      pattern: "can(Invite|Manage)Members"
    - from: "MembersService.update/deactivate"
      to: "tx.member.count (outros ADMIN ativos)"
      via: "dentro de tenant.runWithTenant"
      pattern: "LAST_ADMIN"
---

<objective>
Fechar os tres warnings do 02.1-VERIFICATION.md:
1. Backend: impedir que a org fique sem ADMIN ativo (rebaixar ou desativar o ultimo).
2. Frontend: esconder acoes de equipe para papeis que nao podem executa-las (hoje o FORBIDDEN derruba a sessao via error-link).
3. nginx: index.html sem cache para que deploys novos sejam pegos imediatamente.

Output: 3 commits atomicos (um por task), cada um precedido pelo quality gate completo. SEM push, SEM deploy.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/02.1-equipe-e-profissionais-cadastro-completo-de-profissionais/02.1-VERIFICATION.md
@apps/backend/src/identity/members.service.ts
@apps/backend/test/integration/members-lifecycle.e2e.spec.ts
@apps/frontend/src/pages/ProfissionaisPage.tsx
@apps/frontend/src/pages/__tests__/profissionais-page.test.tsx
@apps/frontend/nginx.conf

<interfaces>
Permissoes efetivas (seed `20260502010000_seed_role_permissions` == ROLE_PERMISSIONS em apps/backend/src/authz/permissions.catalog.ts):
- ADMIN: member.read, member.invite, member.remove, member.editRole
- MANAGER: member.read, member.invite
- ATTENDANT, PROFESSIONAL: member.read
Resolvers: inviteMember + revokeInvitation -> MEMBER_INVITE; updateMember -> MEMBER_EDIT_ROLE; deactivateMember/reactivateMember -> MEMBER_REMOVE.

Frontend auth store (apps/frontend/src/infrastructure/stores/auth.store.ts):
`useAuthStore` com `roleName: string | null` (ADMIN|MANAGER|ATTENDANT|PROFESSIONAL; platform admin impersonando recebe 'ADMIN'). `permissions: string[]` NUNCA e populado — nao usar.

members.service.ts (existente):
- `errPayload(code, message, field?)` -> `{ member: null, errors: [{code,message,field}] }`
- `update(orgId, input: UpdateMemberInput)` — `existing = tx.member.findFirst({ where: { id, organizationId: orgId, deletedAt: null } })`; `input.roleName` resolve `tx.role.findFirst({ where: { name, isSystem: true } })`.
- `deactivate(orgId, id)` — retorna `{ member, futureAppointmentCount, blockingAppointments, activeCommissionRuleCount, errors }`.
- Constantes MEMBER_STATUS_ACTIVE / MEMBER_STATUS_INACTIVE em ./dto/member.input.
- Member tem relacao `role` (role.name) via roleId.

Dialogs ja tratam erro generico: MemberEditDialog.tsx:107-115 (se `errors[0].field` -> form.setError no campo, senao toast.error(message)); DeactivateMemberDialog.tsx:83-90 (branch especifico so p/ MEMBER_HAS_FUTURE_APPOINTMENTS, senao toast.error(errors[0].message)). Logo nenhum branch novo e necessario no frontend.
</interfaces>

Quality gate (OBRIGATORIO antes de CADA commit; commit so com tudo verde):
```
cd /root/sgs/apps/backend && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration
cd /root/sgs/apps/frontend && pnpm lint && pnpm typecheck && pnpm test
```
Integracao roda contra Postgres local sgs_dev (portas 5433/5434, config em test/integration/setup.ts / .env); se o banco nao estiver de pe, subir via docker compose do repo antes — nao pular a suite.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Backend — protecao do ultimo ADMIN (LAST_ADMIN)</name>
  <files>apps/backend/src/identity/members.service.ts, apps/backend/test/integration/members-lifecycle.e2e.spec.ts</files>
  <behavior>
    - Org com um unico ADMIN ativo: updateMember nesse admin com roleName 'MANAGER' -> errors[0].code 'LAST_ADMIN', member null; banco continua com role ADMIN.
    - Mesmo cenario: deactivateMember no unico admin -> errors[0].code 'LAST_ADMIN', member null, futureAppointmentCount 0, blockingAppointments [], activeCommissionRuleCount numerico; status continua 'active'.
    - updateMember no unico admin SEM mudar roleName (ex.: so seniorityTier) ou com roleName 'ADMIN' -> sucesso.
    - Com um segundo ADMIN ativo na org: rebaixar e desativar o primeiro funcionam; restaurar estado ao final do teste (reativar + voltar role ADMIN) para nao contaminar os demais testes.
    - Um segundo ADMIN inativo (status 'inactive') ou com deletedAt NAO conta como "outro admin".
  </behavior>
  <action>
    Em members.service.ts, criar helper privado `isLastActiveAdmin(tx, orgId, member)` que retorna true quando o membro alvo esta ativo (`status === MEMBER_STATUS_ACTIVE`, deletedAt null) com role.name 'ADMIN' E `tx.member.count({ where: { organizationId: orgId, id: { not: member.id }, status: MEMBER_STATUS_ACTIVE, deletedAt: null, role: { name: 'ADMIN' } } }) === 0`. Para ter role.name do alvo, incluir `role: { select: { name: true } }` no findFirst de `existing` (update e deactivate). Tudo dentro do mesmo callback de `this.tenant.runWithTenant` (RLS) — nao usar adminPrisma.
    - update(): depois de validar o role novo, se `input.roleName !== undefined && input.roleName !== 'ADMIN'` e isLastActiveAdmin -> `return errPayload('LAST_ADMIN', 'Não é possível remover o papel de administrador do último administrador ativo do salão. Promova outro membro a administrador antes.', 'roleName')` (field 'roleName' faz o MemberEditDialog mostrar o erro inline no select de papel).
    - deactivate(): logo apos o check MEMBER_NOT_FOUND e ANTES das consultas de agendamento, se isLastActiveAdmin -> retornar `{ member: null, futureAppointmentCount: 0, blockingAppointments: [] (mesmo tipo usado hoje), activeCommissionRuleCount, errors: [{ code: 'LAST_ADMIN', message: 'Não é possível desativar o último administrador ativo do salão. Promova outro membro a administrador antes.', field: null }] }`. Para activeCommissionRuleCount, fazer o `tx.commissionRule.count({ where: { memberId: id, deletedAt: null } })` (mesma query ja existente) — ou 0 se preferir extrair; manter o shape completo do payload (non-null no SDL).
    - Extrair a tipagem repetida de blockingAppointments para um type local se ajudar a legibilidade (opcional).
    - reactivate() nao muda.
    Testes (RED primeiro): novo `describe('Ultimo administrador', ...)` em members-lifecycle.e2e.spec.ts. Precisa do memberId do admin de org A: capturar no beforeAll (o member criado para adminAUser) numa variavel `adminAMemberId`. Criar via adminPrisma um segundo ADMIN em org A (display_name/email com prefixo 'memlc-' para o cleanup existente pegar) apenas dentro do describe, e usa-lo para os cenarios "com outro admin". Cobrir: update rebaixando -> LAST_ADMIN + banco intacto (checar via adminPrisma); deactivate -> LAST_ADMIN + shape completo + status 'active'; outro ADMIN inativo nao conta; com outro ADMIN ativo rebaixar/desativar funciona (restaurar depois). Cuidado: o adminAToken pertence ao admin A — nao deixa-lo rebaixado/inativo ao fim do describe, senao testes seguintes quebram. Rodar tambem a suite de integracao completa: members.e2e/rbac/invitation podem rebaixar admins — se algum quebrar por LAST_ADMIN, ajustar o teste (adicionar segundo admin) e nao relaxar a regra.
    Commit: `fix(identity): impedir rebaixar ou desativar o ultimo admin ativo` (apos quality gate completo).
  </action>
  <verify>
    <automated>cd /root/sgs/apps/backend && pnpm lint && pnpm typecheck && pnpm test && npx jest --config jest-integration.config.ts --runInBand members && pnpm test:integration</automated>
  </verify>
  <done>Novos testes LAST_ADMIN passam; suite de integracao completa (>=114 + novos) e unit verdes; lint/typecheck limpos; commit atomico feito.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Frontend — esconder acoes de equipe por papel</name>
  <files>apps/frontend/src/features/identity/team-permissions.ts, apps/frontend/src/features/identity/__tests__/team-permissions.test.ts, apps/frontend/src/pages/ProfissionaisPage.tsx, apps/frontend/src/pages/__tests__/profissionais-page.test.tsx</files>
  <behavior>
    - canInviteMembers('ADMIN') === true, ('MANAGER') === true, ('ATTENDANT'|'PROFESSIONAL'|null|undefined|'UNKNOWN'|'admin') === false.
    - canManageMembers('ADMIN') === true; ('MANAGER'|'ATTENDANT'|'PROFESSIONAL'|null|'UNKNOWN') === false.
    - Pagina como ADMIN: header CTA Convidar, coluna "Ações" dos membros (Editar/Desativar/Reativar) e Revogar nos convites visiveis (comportamento atual).
    - Pagina como MANAGER: CTA Convidar e Revogar visiveis; nenhum botao/coluna de acoes nos membros (queryByRole button name team.table.actions retorna null; sem header "Ações" na tabela de membros).
    - Pagina como ATTENDANT/PROFESSIONAL: sem CTA de convite no header, sem CTA no empty state, sem coluna de acoes nos membros nem nos convites (lista de convites continua legivel).
  </behavior>
  <action>
    Criar apps/frontend/src/features/identity/team-permissions.ts com funcoes puras `canInviteMembers(roleName: string | null | undefined): boolean` (ADMIN, MANAGER) e `canManageMembers(roleName)` (so ADMIN). Comentario curto dizendo que espelha ROLE_PERMISSIONS (apps/backend/src/authz/permissions.catalog.ts) — member.invite / member.editRole+member.remove — e que `permissions` do auth store nao e populado, por isso o gate e por roleName; impersonacao de platform admin chega como 'ADMIN'. Comparacao exata (case-sensitive), sem fallback permissivo. Teste unitario vitest para as tabelas acima.
    Em ProfissionaisPage.tsx: `const roleName = useAuthStore((s) => s.roleName)`; `const canInvite = canInviteMembers(roleName)`; `const canManage = canManageMembers(roleName)`.
    - Botao Convidar do PageHeader e CTA do empty state: renderizar so se canInvite. Empty state sem CTA continua mostrando a mensagem.
    - Coluna `key: 'actions'` do DataTable de membros: incluir no array de colunas so se canManage (spread condicional), para a coluna sumir inteira.
    - Tabela de convites: TableHead de acoes e celula com Revogar so se canInvite.
    - Dialogs (Invite/MemberEdit/Deactivate) podem ficar montados condicionalmente pelos mesmos flags (nao abrem sem gatilho de qualquer forma).
    - NAO mexer em error-link.ts (fora do escopo).
    Testes da pagina: os testes existentes nao setam o auth store — adicionar `beforeEach(() => useAuthStore.setState({ roleName: 'ADMIN' }))` (e reset no afterEach) para manter o comportamento atual verde; adicionar casos MANAGER, ATTENDANT e PROFESSIONAL (inclusive empty state sem CTA para ATTENDANT) conforme <behavior>. Usar os helpers ja existentes (renderPage, membersMock, invitationsMock, openDropdown).
    Commit: `fix(equipe): esconder acoes de equipe para papeis sem permissao` (apos quality gate completo).
  </action>
  <verify>
    <automated>cd /root/sgs/apps/frontend && pnpm lint && pnpm typecheck && npx vitest run src/features/identity src/pages/__tests__/profissionais-page.test.tsx && pnpm test</automated>
  </verify>
  <done>Helper testado; pagina renderiza acoes conforme papel; vitest completo (>=97 + novos) verde; lint/typecheck limpos; backend gate tambem verde; commit atomico feito.</done>
</task>

<task type="auto">
  <name>Task 3: nginx — no-cache no index.html sem perder headers de seguranca</name>
  <files>apps/frontend/nginx.conf</files>
  <action>
    Reescrever apps/frontend/nginx.conf mantendo gzip, root e try_files. Problema de heranca: add_header em um location descarta os add_header do server; hoje o location de assets ja perde X-Frame-Options/nosniff/Referrer-Policy. Solucao: repetir os 3 headers de seguranca (com `always`) dentro de cada location que define add_header, e manter tambem no nivel server para locations sem add_header.
    - `location ~* \.(js|css|png|...)$` : expires 1y; `Cache-Control "public, immutable"` + 3 headers de seguranca.
    - Novo `location = /index.html { add_header Cache-Control "no-cache" always; expires off/nao usar expires; + 3 headers de seguranca }`.
    - `location / { try_files $uri $uri/ /index.html; add_header Cache-Control "no-cache" always; + 3 headers }` — o fallback faz redirect interno para /index.html (casa com `= /index.html`), mas rotas de diretorio/arquivos sem extensao servidos por `location /` tambem ficam sem cache, o que e o desejado para o SPA.
    - Nao adicionar CSP nova nem outros headers (fora do escopo).
    Verificar com docker (disponivel em /usr/bin/docker): `nginx -t` com a conf montada, e um smoke real: criar dir temporario no scratchpad com index.html e assets/app-abc123.js, subir `nginx:alpine` com a conf e o dir montado em /usr/share/nginx/html em porta local livre, e com curl -sI conferir: `/` e `/profissionais` e `/index.html` -> `Cache-Control: no-cache` + X-Frame-Options + X-Content-Type-Options + Referrer-Policy; `/assets/app-abc123.js` -> `Cache-Control: public, immutable` (e max-age do expires) + os 3 headers. Derrubar o container ao final.
    Commit: `fix(frontend): servir index.html sem cache no nginx` (apos quality gate completo de backend e frontend, mesmo sem mudanca de codigo TS).
  </action>
  <verify>
    <automated>docker run --rm -v /root/sgs/apps/frontend/nginx.conf:/etc/nginx/conf.d/default.conf:ro nginx:alpine nginx -t && (smoke curl -sI descrito na action, checando os headers com grep)</automated>
  </verify>
  <done>nginx -t ok; smoke mostra no-cache em /, /profissionais e /index.html, immutable nos assets, e os 3 headers de seguranca em todas; quality gate verde; commit atomico feito.</done>
</task>

</tasks>

<verification>
- `git log --oneline -3` mostra 3 commits atomicos (backend, frontend, nginx), nenhum push.
- Backend: lint, typecheck, unit e integracao completa verdes.
- Frontend: lint, typecheck, vitest completo verde.
- grep: `LAST_ADMIN` em members.service.ts e no spec; `canManageMembers` usado em ProfissionaisPage.tsx; `location = /index.html` em nginx.conf.
</verification>

<success_criteria>
- Ultimo ADMIN ativo nao pode ser rebaixado nem desativado (error-as-data LAST_ADMIN, pt-BR), com cobertura de integracao.
- MANAGER/ATTENDANT/PROFESSIONAL nao veem acoes que resultariam em FORBIDDEN -> sem logout involuntario.
- index.html sem cache; assets com cache longo; headers de seguranca em todas as respostas.
- Sem push, sem deploy.
</success_criteria>

<output>
After completion, create `.planning/quick/260929-dek-esconder-acoes-de-equipe-por-papel-prote/260929-dek-SUMMARY.md`
</output>
