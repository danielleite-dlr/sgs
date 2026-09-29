---
phase: quick-260929-gta
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [EQUIPE-01, EQUIPE-02, EQUIPE-03, EQUIPE-05]
files_modified:
  # Task 1: captura de e-mail no backend + infraestrutura Playwright + seed
  - apps/backend/src/config/env.schema.ts
  - apps/backend/src/email/file-outbox.adapter.ts
  - apps/backend/src/email/file-outbox.adapter.spec.ts
  - apps/backend/src/email/email.module.ts
  - apps/e2e/package.json
  - apps/e2e/tsconfig.json
  - apps/e2e/playwright.config.ts
  - apps/e2e/scripts/e2e-env.mjs
  - apps/e2e/scripts/start-backend.mjs
  - apps/e2e/support/graphql.ts
  - apps/e2e/support/outbox.ts
  - apps/e2e/support/seed-state.ts
  - apps/e2e/support/ui.ts
  - apps/e2e/tests/seed.setup.ts
  - apps/e2e/tests/smoke.spec.ts
  - .gitignore
  - pnpm-lock.yaml
  # Task 2: os 4 cenários da verificação manual
  - apps/e2e/tests/equipe-cadastro-e-convite.spec.ts
  - apps/e2e/tests/equipe-desativar-bloqueado.spec.ts
  - apps/e2e/tests/equipe-editar-desativar-reativar.spec.ts
  - apps/e2e/tests/equipe-acoes-por-papel.spec.ts
  # Task 3: CI e fechamento
  - .github/workflows/ci.yml
  - apps/e2e/README.md
  - .planning/phases/02.1-equipe-e-profissionais-cadastro-completo-de-profissionais/02.1-VERIFICATION.md

must_haves:
  truths:
    - "`corepack pnpm --filter @sgs/e2e test:e2e` sobe backend (porta 3100) e frontend Vite (porta 5180) locais, faz o seed pela API GraphQL e roda os 4 cenários em Chromium com resultado verde (ou test.fixme justificado para bug registrado)"
    - "Cenário 1: um profissional criado pela UI (cadastro direto com senha provisória) e outro que aceita convite em /convite/:token aparecem ativos em /profissionais, no seletor de profissional de /agenda e no picker de membro de /catalogo/comissoes, com senioridade Sênior, sem reload da página entre as navegações"
    - "Cenário 2: desativar pela UI um profissional com agendamento futuro deixa o dialog no estado bloqueado com a contagem e a linha 'cliente — serviço — data', e o membro continua Ativo"
    - "Cenário 3: editar papel/senioridade e depois desativar/reativar atualiza a linha na tabela sem reload"
    - "Cenário 4: MANAGER vê 'Cadastrar profissional' mas nenhuma coluna/menu de Ações (Editar, Desativar, Reativar, Gerar senha); ATTENDANT não vê nenhuma ação de equipe"
    - "O token do convite é capturado de um outbox em arquivo, habilitado só por EMAIL_OUTBOX_DIR e nunca em NODE_ENV=production; sem a variável o backend continua usando o ResendAdapter"
    - "O CI tem um job `e2e` que sobe postgres/pgbouncer/valkey, aplica migrations, instala só o Chromium, roda o Playwright e publica playwright-report/test-results como artifact quando falha"
  artifacts:
    - path: "apps/backend/src/email/file-outbox.adapter.ts"
      provides: "EmailAdapter que grava cada e-mail como JSON num diretório (só fora de produção)"
      exports: ["FileOutboxEmailAdapter"]
    - path: "apps/backend/src/email/email.module.ts"
      provides: "Seleção do adapter por env: outbox quando EMAIL_OUTBOX_DIR e NODE_ENV != production, senão ResendAdapter"
      contains: "EMAIL_OUTBOX_DIR"
    - path: "apps/e2e/playwright.config.ts"
      provides: "Config Playwright: webServer backend+frontend, projeto setup + chromium, locale pt-BR, fuso America/Sao_Paulo"
      contains: "webServer"
    - path: "apps/e2e/tests/seed.setup.ts"
      provides: "Seed pela API pública: org, admin, MANAGER, ATTENDANT, profissionais, categoria, serviço, cliente, agendamento futuro"
    - path: "apps/e2e/support/outbox.ts"
      provides: "Leitura do outbox e extração do token de /convite/:token"
      exports: ["waitForInvitationToken"]
    - path: ".github/workflows/ci.yml"
      provides: "Job e2e"
      contains: "playwright install"
  key_links:
    - from: "apps/e2e/scripts/start-backend.mjs"
      to: "apps/backend/dist/main.js"
      via: "nest build + node dist/main com env da raiz carregado linha a linha e overrides (PORT=3100, EMAIL_OUTBOX_DIR, RESEND_API_KEY vazio, FRONTEND_URL=http://localhost:5180)"
      pattern: "EMAIL_OUTBOX_DIR"
    - from: "apps/e2e/playwright.config.ts"
      to: "apps/frontend (vite)"
      via: "webServer com VITE_API_URL=http://localhost:3100 e --port 5180 --strictPort"
      pattern: "VITE_API_URL"
    - from: "apps/e2e/support/outbox.ts"
      to: "apps/backend/src/email/file-outbox.adapter.ts"
      via: "mesmo diretório apps/e2e/.e2e-state/outbox e mesmo formato JSON {to, subject, text, html, sentAt}"
      pattern: "outbox"
    - from: "apps/e2e/tests/*.spec.ts"
      to: "apps/e2e/.e2e-state/seed.json"
      via: "readSeedState() escrito pelo projeto setup (dependencies: ['setup'])"
      pattern: "readSeedState"
---

<objective>
Automatizar com Playwright os 4 itens de `human_verification` da Fase 02.1 (02.1-VERIFICATION.md) contra backend NestJS e frontend Vite reais, rodando localmente e num job novo de CI.

Purpose: a fase está como `human_needed` porque o fluxo ao vivo nunca foi exercitado (os testes de frontend usam MockedProvider e os de backend não passam pela UI). O CLAUDE.md exige "E2E para fluxos críticos, bloqueio de PR em falha".
Output: pacote `apps/e2e` (@sgs/e2e) com Playwright, um outbox de e-mail em arquivo no backend para capturar o token do convite, seed pela API GraphQL, 4 specs verdes, job `e2e` no CI.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.planning/phases/02.1-equipe-e-profissionais-cadastro-completo-de-profissionais/02.1-VERIFICATION.md
@.planning/quick/260929-dek-esconder-acoes-de-equipe-por-papel-prote/260929-dek-SUMMARY.md
@.planning/quick/260929-dvr-cadastro-direto-de-profissional-com-senh/260929-dvr-SUMMARY.md
@.github/workflows/ci.yml

<findings>
<!-- O que o planner descobriu lendo o código. Use direto e não refaça a exploração. -->

Ambiente local (VPS):
- `pnpm` NÃO está no PATH. Use `corepack pnpm ...` (9.15.4). Node atual é v26; engines >=22.
- Containers locais rodando: sgs_postgres (host **5434**, a 5432 do host é um postgres do sistema), sgs_pgbouncer (5433), sgs_valkey (6379). Não há meilisearch local (o backend sobe sem ele; só MEILISEARCH_KEY é validada). NÃO tocar em nenhum container `sgs_stg_*` (staging usa 127.0.0.1:3010 e 8090).
- `.env` só existe na raiz (`/root/sgs/.env`); o backend NÃO tem `apps/backend/.env` e o ConfigModule lê `process.env`. O `.env` tem `DATABASE_URL=...?pgbouncer=true&connection_limit=10` sem aspas: parse linha a linha (`KEY=VALUE`, ignorar comentários/linhas vazias, tirar aspas externas se houver), nunca `source`. Na raiz, `DIRECT_URL` aponta para localhost:5434 e `RESEND_API_KEY` está preenchida (pode ser placeholder): o E2E TEM que forçar `RESEND_API_KEY=` vazio.
- Portas 3000 e 5173 estão livres agora, mas o dev pode estar usando. O E2E usa portas próprias: backend **3100**, frontend **5180**.
- Chromium do Playwright ainda não está instalado (`~/.cache/ms-playwright` não existe). Instalar com `corepack pnpm --filter @sgs/e2e exec playwright install --with-deps chromium` (roda como root, apt ok).

Criação de membros hoje (quick dvr substituiu o convite na UI):
- /profissionais NÃO tem mais botão de convite. O CTA é "Cadastrar profissional" (`CreateMemberDialog`: Nome, E-mail, Telefone, Chave Pix (com tipo, commit ade1e3d), Data de nascimento opcional, Papel (Select aria-label "Papel"), "Também atende clientes" quando papel != PROFESSIONAL, Categorias quando profissional, Senha provisória gerada no navegador). Não tem campo de senioridade: a senioridade só é definida no `MemberEditDialog` (label "Senioridade") ou no convite.
- A mutation `inviteMember(input: {email, roleName, isProfessional, seniorityTier})` e a rota `/convite/:token` (`InvitationPage`: campos `#fullName` e `#password`, navega para /dashboard -> HOME_PATH que é /agenda) continuam existindo. Portanto o item 1 é coberto pelos DOIS caminhos: cadastro direto pela UI (caminho atual) e convite disparado pela API + aceite pela UI.
- Tabela de /profissionais: colunas Nome, E-mail, Telefone, Papel, Categorias, Status (badge "Ativo"/"Inativo"), e Ações (botão ghost com aria-label "Ações" abrindo DropdownMenu com "Editar", "Gerar nova senha provisória", "Desativar" ou "Reativar"). Senioridade NÃO é coluna: verificar abrindo "Editar" e lendo o Select de senioridade, ou via query `allMembers` na API.
- Gates de UI (quick dek, `features/identity/team-permissions.ts`): `canInviteMembers` = ADMIN, MANAGER (mostra "Cadastrar profissional"); `canManageMembers` = ADMIN (mostra a coluna Ações). Então o comportamento entregue para MANAGER é: VÊ "Cadastrar profissional", NÃO vê Ações. ATTENDANT não vê nada. O teste deve afirmar exatamente isso (não "MANAGER não vê Cadastrar").
- Dialog de desativação bloqueado (`DeactivateMemberDialog.tsx`): título "Não é possível desativar {{name}} agora", corpo "{{count}} agendamento(s) futuro(s) dependem deste profissional...", lista "Próximos agendamentos" com `<li>{clientName} — {serviceName} — {formatStartsAt}</li>` (Intl pt-BR), botão "Entendi". Confirmação normal: "Desativar {{name}}?" com botão "Desativar".
- Strings vêm de `apps/frontend/src/infrastructure/i18n/locales/pt-BR.json` (chaves `team.*`, `pages.profissionais.*`). Prefira `getByRole`/`getByLabel` com esses textos.
- /agenda: `SchedulePage` usa `MembersQuery` filtrando `isProfessional`; a barra lateral lista profissionais com botões `aria-label="{nome} — visível|oculto"` (linha ~397). /catalogo/comissoes: `CommissionRuleForm` usa `MembersQuery` num `EntityCombobox` (itens = profissionais ativos).
- Rotas: `/login` (LoginPage, `#email`, `#password`), `/trocar-senha` (obrigatória se mustChangePassword), `/profissionais`, `/agenda`, `/catalogo/comissoes`, `/convite/:token`. Sessão persistida em localStorage pelo zustand `persist` (auth.store.ts).

Seed / autenticação:
- Não há signup público. Bootstrap: `apps/backend/src/scripts/create-platform-admin.ts` (compilado em `dist/scripts/create-platform-admin.js`, idempotente, usa PrismaClient com DATABASE_URL; tabela users sem RLS). Depois tudo pela API: `login` (platform admin) -> `adminCreateClient(input:{salonName, ownerName, ownerEmail})` devolve `temporaryPassword` (owner nasce verificado, mustChangePassword=true) -> `login` do owner -> `changePassword(input:{currentPassword,newPassword})` -> chamadas de org com `Authorization: Bearer` + `X-Organization-Id` (organizationId de `session.memberships[0]`).
- `createMember(input:{displayName,email,phone,pixKey,birthDate?,roleName,isProfessional?,categoryIds?,temporaryPassword})` — validações de phone/pix em `apps/backend/src/identity/member-contact.ts`; senha provisória nasce com mustChangePassword=true -> no seed, logar cada MANAGER/ATTENDANT e chamar `changePassword` para a UI não cair em /trocar-senha.
- Catálogo/agenda: `createCategory(input:{name})`, `createService(input:{name,categoryId,basePrice:String,defaultDurationMinutes})`, `createClient(input:{fullName,phone?})`, `createAppointment(input:{professionalId,clientId,serviceId,startsAt,endsAt})`. Todos devolvem payload com `errors` (erro-como-dado): o seed deve falhar alto se `errors.length > 0`.
- Não há como obter o token do convite pelo banco (só `token_hash` SHA-256). O `TestEmailAdapter` existe mas é in-memory e só é injetado em Test.createTestingModule, inútil para um backend de verdade. Sem RESEND_API_KEY o `ResendAdapter` só loga. Solução deste plano: `FileOutboxEmailAdapter` ativado por `EMAIL_OUTBOX_DIR`.
</findings>

<interfaces>
From apps/backend/src/email/resend.adapter.ts:
```typescript
export interface SendEmailParams { to: string; subject: string; html: string; text?: string; }
export interface EmailAdapter { send(params: SendEmailParams): Promise<void>; }
@Injectable() export class ResendAdapter implements EmailAdapter { constructor(config: ConfigService<Env, true>) }
```
From apps/backend/src/email/email.module.ts (atual):
```typescript
@Global() @Module({
  providers: [ResendAdapter, { provide: EMAIL_ADAPTER, useExisting: ResendAdapter }, EmailService],
  exports: [EmailService, EMAIL_ADAPTER],
})
export class EmailModule {}
```
From apps/backend/src/email/email.service.ts: convite gera `${FRONTEND_URL}/convite/${encodeURIComponent(token)}` no text e no html.
From apps/backend/src/graphql/schema/identity.graphql: `inviteMember(input: InviteMemberInput!): InviteMemberPayload!` (`{invitationId, expiresAt, errors}`), `allMembers: [Member!]!` (`id displayName email roleName seniorityTier isProfessional status`), `enum SeniorityTier` (junior|pleno|senior).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Outbox de e-mail no backend + pacote apps/e2e com Playwright, launchers e seed pela API</name>
  <files>apps/backend/src/config/env.schema.ts, apps/backend/src/email/file-outbox.adapter.ts, apps/backend/src/email/file-outbox.adapter.spec.ts, apps/backend/src/email/email.module.ts, apps/e2e/package.json, apps/e2e/tsconfig.json, apps/e2e/playwright.config.ts, apps/e2e/scripts/e2e-env.mjs, apps/e2e/scripts/start-backend.mjs, apps/e2e/support/graphql.ts, apps/e2e/support/outbox.ts, apps/e2e/support/seed-state.ts, apps/e2e/support/ui.ts, apps/e2e/tests/seed.setup.ts, apps/e2e/tests/smoke.spec.ts, .gitignore, pnpm-lock.yaml</files>
  <behavior>
    - file-outbox.adapter.spec: `send()` grava 1 arquivo `.json` no diretório (criado se não existir) com `{to, subject, text, html, sentAt}`; dois envios geram dois arquivos com nomes distintos e ordenáveis por tempo.
    - file-outbox.adapter.spec: fábrica de seleção (função pura exportada, ex. `selectEmailAdapter({nodeEnv, outboxDir})` ou `shouldUseOutbox(nodeEnv, outboxDir)`) retorna outbox só quando outboxDir não vazio E nodeEnv != 'production'; em production com outboxDir setado retorna Resend.
  </behavior>
  <action>
**Parte A — backend (TDD: escreva o spec antes).**
1. `env.schema.ts`: adicionar `EMAIL_OUTBOX_DIR: z.string().optional().describe('Somente dev/test/E2E: grava e-mails como JSON neste diretório em vez de enviar. Ignorado em production.')`.
2. `file-outbox.adapter.ts`: `export class FileOutboxEmailAdapter implements EmailAdapter` com `constructor(private readonly dir: string)`; `send()` faz `mkdir(dir,{recursive:true})` e `writeFile(join(dir, `${Date.now()}-${randomUUID()}.json`), JSON.stringify({...params, sentAt: new Date().toISOString()}))` (fs/promises). Exportar também a função pura `shouldUseOutbox(nodeEnv: string | undefined, outboxDir: string | undefined): boolean`. Comentário curto explicando que existe para o E2E capturar o link do convite, já que o token só existe em hash no banco.
3. `email.module.ts`: manter `ResendAdapter` como provider e trocar o `useExisting` por `{ provide: EMAIL_ADAPTER, inject: [ConfigService, ResendAdapter], useFactory: (config, resend) => shouldUseOutbox(config.get('NODE_ENV'), config.get('EMAIL_OUTBOX_DIR')) ? new FileOutboxEmailAdapter(dir) : resend }`. Logar um `Logger.warn` único quando o outbox estiver ativo. Os testes de integração que fazem `overrideProvider(EMAIL_ADAPTER).useClass(TestEmailAdapter)` continuam funcionando (override de token).
4. Rodar `corepack pnpm --filter @sgs/backend test -- file-outbox` (RED->GREEN).

**Parte B — pacote `apps/e2e` (@sgs/e2e, private, `"type": "module"`).** Já coberto pelo `apps/*` do pnpm-workspace.
- `package.json`: devDependencies `@playwright/test` (última 1.x), `typescript` (mesma faixa do repo), `@types/node`. Scripts: `"test:e2e": "playwright test"`, `"typecheck": "tsc --noEmit"`, `"report": "playwright show-report"`. Sem script `lint` (o CI roda `pnpm -r --if-present lint`; não vale criar config eslint nova para isso). Rodar `corepack pnpm install` na raiz para atualizar o `pnpm-lock.yaml`, depois instalar o Chromium (ver findings).
- `tsconfig.json`: strict, `module`/`moduleResolution` `NodeNext` (ou `Bundler`), `types: ["node"]`, `noEmit`, include `**/*.ts`. Pode estender `../../tsconfig.base.json` se os campos não conflitarem.
- `scripts/e2e-env.mjs`: exporta `E2E_PORTS = { backend: 3100, frontend: 5180 }`, `OUTBOX_DIR` (absoluto: `apps/e2e/.e2e-state/outbox`), e `loadE2eEnv()` que: lê `/<raiz>/.env` se existir, parse linha a linha (ver findings, `&` preservado), mescla `{...fileEnv, ...process.env}` (process.env ganha, para o CI) e aplica overrides fixos: `PORT=3100`, `NODE_ENV=test`, `FRONTEND_URL=http://localhost:5180`, `EMAIL_OUTBOX_DIR=OUTBOX_DIR`, `RESEND_API_KEY=''` (nenhum e-mail real sai do E2E).
- `scripts/start-backend.mjs`: com `loadE2eEnv()`, roda `nest build` resolvendo o binário a partir de `apps/backend` (`createRequire(<backend>/package.json).resolve('@nestjs/cli/bin/nest.js')` executado com `process.execPath`, sem depender de `pnpm` no PATH), limpa `OUTBOX_DIR`, e dá `spawn(process.execPath, ['dist/main.js'], {cwd: apps/backend, env, stdio: 'inherit'})`, repassando SIGTERM/SIGINT ao filho.
- `playwright.config.ts`: `testDir: './tests'`, `workers: 1`, `fullyParallel: false`, `retries: process.env.CI ? 1 : 0`, `reporter: [['list'], ['html', { open: 'never' }]]`, `use: { baseURL: 'http://localhost:5180', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', trace: 'retain-on-failure', screenshot: 'only-on-failure' }`. `projects`: `{ name: 'setup', testMatch: /.*\.setup\.ts/ }` e `{ name: 'chromium', use: devices['Desktop Chrome'], dependencies: ['setup'] }` (setup como projeto garante que o seed roda DEPOIS do webServer subir). `webServer`: (1) `node scripts/start-backend.mjs`, `url: 'http://localhost:3100/health'`, `timeout: 180_000`; (2) `command` que roda o vite do frontend com `--port 5180 --strictPort` (`node ../frontend/node_modules/vite/bin/vite.js --port 5180 --strictPort` com `cwd: '../frontend'`, ou equivalente sem pnpm no PATH), `env: { VITE_API_URL: 'http://localhost:3100' }`, `url: 'http://localhost:5180'`, `timeout: 120_000`. `reuseExistingServer: !process.env.CI` nos dois (portas são exclusivas do E2E, então reusar é seguro).
- `support/graphql.ts`: `gql<T>(query, variables?, {token?, orgId?})` com `fetch('http://localhost:3100/graphql')`, lança erro com o corpo se houver `errors` top-level; helper `expectNoUserErrors(payload)` que lança se `payload.errors.length`.
- `support/outbox.ts`: `waitForInvitationToken(email, {timeoutMs = 10_000})` que faz polling em `OUTBOX_DIR`, pega o JSON mais recente com `to` igual (case-insensitive) e extrai `/convite/([^\s"<?]+)` do `text` (fallback `html`), `decodeURIComponent`.
- `support/seed-state.ts`: tipo `SeedState` + `writeSeedState`/`readSeedState` em `apps/e2e/.e2e-state/seed.json`.
- `support/ui.ts`: `loginViaUi(page, email, password)` (goto /login, preencher `#email`/`#password`, submit, esperar sair de /login) e `markNoReload(page)` / `expectNoReload(page)` (seta `window.__e2eNoReload = <id>` e depois confere que ainda existe; é assim que os specs provam "sem recarregar").
- `tests/seed.setup.ts` (`setup('seed', ...)`): sufixo único por execução (`Date.now().toString(36)`) em todos os e-mails/nomes (o banco local é persistente; não limpar dados). Passos: (a) `execFileSync(process.execPath, ['<backend>/dist/scripts/create-platform-admin.js', 'e2e-platform@example.com', <senha>, 'E2E Platform'], {env: loadE2eEnv()})`; (b) login platform admin -> `adminCreateClient` -> login owner com a senha temporária -> `changePassword` para senha conhecida; (c) com o token do owner + `X-Organization-Id`: `createMember` para MANAGER ("E2E Gerente"), ATTENDANT ("E2E Atendente"), PROFESSIONAL "E2E Pro Bloqueado" e PROFESSIONAL "E2E Pro Editavel" (phone e pix válidos para `member-contact.ts`); logar MANAGER e ATTENDANT e chamar `changePassword`; (d) `createCategory`, `createService` (60 min), `createClient`, `createAppointment` para "E2E Pro Bloqueado" amanhã 10:00-11:00 em America/Sao_Paulo (`-03:00`). Gravar tudo (e-mails, senhas, ids, nomes, orgId, dados do agendamento) com `writeSeedState`. Qualquer `errors` não vazio falha o setup com mensagem clara.
- `tests/smoke.spec.ts`: owner loga pela UI e chega em /agenda (HOME_PATH), sem ir para /trocar-senha.
- `.gitignore`: `apps/e2e/.e2e-state/`, `apps/e2e/test-results/`, `apps/e2e/playwright-report/`, `apps/e2e/blob-report/`.

Se algo do app impedir o seed ou o smoke (bug real): corrigir se for pequeno e óbvio (com teste), senão registrar no SUMMARY e seguir.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- file-outbox && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend lint && corepack pnpm --filter @sgs/e2e typecheck && corepack pnpm --filter @sgs/e2e test:e2e -- tests/smoke.spec.ts</automated>
  </verify>
  <done>Spec do outbox verde; backend lint/typecheck/unit limpos; `playwright test tests/smoke.spec.ts` sobe os dois servidores nas portas 3100/5180, roda o setup (seed.json escrito) e o smoke passa de verdade; nenhum container sgs_stg_* tocado. Commit: `feat(e2e): infraestrutura Playwright com outbox de e-mail e seed pela API`.</done>
</task>

<task type="auto">
  <name>Task 2: Specs dos 4 itens de verificação manual da Fase 02.1</name>
  <files>apps/e2e/tests/equipe-cadastro-e-convite.spec.ts, apps/e2e/tests/equipe-desativar-bloqueado.spec.ts, apps/e2e/tests/equipe-editar-desativar-reativar.spec.ts, apps/e2e/tests/equipe-acoes-por-papel.spec.ts</files>
  <action>
Todos os specs leem `readSeedState()` e logam pela UI com `loginViaUi`. Use locators por papel/label com os textos de pt-BR.json (findings). "Sem recarregar": depois do primeiro `goto`, chamar `markNoReload(page)`, navegar SOMENTE por cliques no menu/links da SPA (nunca `page.goto`/`reload` no meio) e terminar com `expectNoReload(page)`. Localizar a linha do membro por `page.getByRole('row', { name: /<nome>/ })`.

**Item 1 — `equipe-cadastro-e-convite.spec.ts` (dois testes).**
- `cadastro direto pela UI` (caminho atual de criação, quick dvr): owner loga, vai primeiro a /agenda (para o `MembersQuery` já estar em cache e o teste pegar cache velho), `markNoReload`, navega pelo menu até /profissionais, "Cadastrar profissional" -> preenche Nome/E-mail/Telefone/Chave Pix, Papel "Profissional", mantém a senha gerada -> "Cadastrar" -> vê "Profissional cadastrado" -> "Concluir". Afirma a linha com badge "Ativo" sem reload. Abre Ações -> "Editar" -> Senioridade "Sênior" -> "Salvar"; reabre "Editar" e confere "Sênior". Navega pelo menu até /agenda e afirma o profissional na lista lateral (`aria-label` "<nome> — visível" ou equivalente). Navega até /catalogo/comissoes, abre o formulário de nova regra e afirma que o nome aparece no picker de membro. `expectNoReload`.
- `convite aceito em /convite/:token`: via API com o token do owner chama `inviteMember({email, roleName:'PROFESSIONAL', isProfessional:true, seniorityTier:'senior'})` (a UI não tem mais botão de convite, então o disparo é por API; o aceite é pela UI), pega o token com `waitForInvitationToken(email)`. Num `browser.newContext()` separado, abre `/convite/<token>`, preenche `#fullName` e `#password`, envia e espera sair da página de convite. No contexto do owner: goto /profissionais, `markNoReload`, afirma a linha "Ativo", "Editar" mostra "Sênior" (fechar com "Cancelar"), depois menu -> /agenda (nome presente) -> /catalogo/comissoes (nome no picker), `expectNoReload`. Complementar com `allMembers` via API: `seniorityTier === 'senior'`, `status === 'active'`, `isProfessional === true`.

**Item 2 — `equipe-desativar-bloqueado.spec.ts`.** Owner em /profissionais, `markNoReload`, Ações de "E2E Pro Bloqueado" -> "Desativar" -> confirma "Desativar" no dialog "Desativar E2E Pro Bloqueado...?". Afirma o título "Não é possível desativar E2E Pro Bloqueado agora", o texto com "1 agendamento(s) futuro(s)", a seção "Próximos agendamentos" e um `listitem` contendo `<cliente> — <serviço> — ` + a data do seed formatada em pt-BR (calcule o texto esperado com o mesmo `Intl.DateTimeFormat` do `formatStartsAt` do `DeactivateMemberDialog.tsx`, leia as options lá, com `timeZone: 'America/Sao_Paulo'`). "Entendi" fecha; a linha continua "Ativo"; `allMembers` via API confirma `status: 'active'`. `expectNoReload`.

**Item 3 — `equipe-editar-desativar-reativar.spec.ts`.** Owner em /profissionais, `markNoReload`, "E2E Pro Editavel": "Editar" -> Papel "Atendente", mantém "É profissional" marcado, Senioridade "Pleno" -> "Salvar" -> a célula Papel da linha vira "Atendente" sem reload e reabrir "Editar" mostra "Pleno". Depois "Desativar" -> confirmar (sem agendamento, desativa) -> badge "Inativo" e o menu passa a oferecer "Reativar" -> "Reativar" -> badge "Ativo". `expectNoReload`.

**Item 4 — `equipe-acoes-por-papel.spec.ts` (dois testes).** Comportamento entregue pela quick dek (member.invite = ADMIN+MANAGER; editRole/remove = ADMIN):
- MANAGER: loga, goto /profissionais, espera a tabela com os membros do seed; afirma que "Cadastrar profissional" está VISÍVEL, que não existe `columnheader` "Ações" nem botão com aria-label "Ações", e que os textos "Editar", "Desativar", "Reativar" e "Gerar nova senha provisória" têm count 0. Extra (API, com token do MANAGER): `deactivateMember` do "E2E Pro Editavel" devolve erro FORBIDDEN/ausência de sucesso e o membro segue ativo.
- ATTENDANT: mesmo fluxo; "Cadastrar profissional" NÃO visível e nenhuma ação.
Registrar no SUMMARY que o item 4 da VERIFICATION (que descrevia "ações aparecem e o backend devolve FORBIDDEN") foi resolvido pela quick dek e é isso que o teste trava.

**Política de bug:** se um cenário falhar por bug real do app (não do teste), corrigir se for pequeno e óbvio (com teste unitário/vitest junto e rodando o gate do pacote afetado); senão marcar só aquele teste com `test.fixme(true, '<bug observado> — ver SUMMARY')`, registrar o bug com passo a passo no SUMMARY e seguir. Nunca afrouxar asserções para o teste passar. Rode cada spec até estar estável: `--repeat-each=2` sem flakiness.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/e2e typecheck && corepack pnpm --filter @sgs/e2e test:e2e && corepack pnpm --filter @sgs/e2e test:e2e -- --repeat-each=2 tests/equipe-</automated>
  </verify>
  <done>Os 4 specs (6 testes) passam localmente contra backend e frontend reais, inclusive com `--repeat-each=2`; qualquer `test.fixme` tem justificativa e bug registrado. Commit: `test(e2e): cobrir com Playwright a verificacao manual da fase 02.1`.</done>
</task>

<task type="auto">
  <name>Task 3: Job e2e no CI, README do pacote, gate completo e atualização da VERIFICATION</name>
  <files>.github/workflows/ci.yml, apps/e2e/README.md, .planning/phases/02.1-equipe-e-profissionais-cadastro-completo-de-profissionais/02.1-VERIFICATION.md</files>
  <action>
1. `ci.yml`: novo job `e2e` (`runs-on: ubuntu-latest`, `timeout-minutes: 30`), espelhando o `integration`: checkout, pnpm/action-setup, setup-node 22 com cache pnpm, `cp .env.example .env`, `docker compose up -d postgres pgbouncer valkey`, o mesmo loop "Wait for healthy", `pnpm install --frozen-lockfile`, `prisma:migrate:deploy` e `prisma:generate` com os mesmos DIRECT_URL/DATABASE_URL do integration, `pnpm --filter @sgs/e2e exec playwright install --with-deps chromium` (só chromium), e `pnpm --filter @sgs/e2e test:e2e` com env `CI: 'true'`, `DIRECT_URL`, `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MEILISEARCH_KEY` (os mesmos valores do integration; o loader dá prioridade ao process.env e força PORT/FRONTEND_URL/EMAIL_OUTBOX_DIR/RESEND_API_KEY). Depois: `actions/upload-artifact@v4` com `if: failure()`, `name: playwright-report`, paths `apps/e2e/playwright-report` e `apps/e2e/test-results`, `retention-days: 7`; e "Tear down" com `if: always()` e `docker compose down -v`. Opcional: cache de `~/.cache/ms-playwright` por versão do @playwright/test. Validar o YAML localmente (`python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"`, e `actionlint` se existir).
2. `apps/e2e/README.md` (curto, pt-BR): pré-requisitos (containers sgs_postgres/pgbouncer/valkey de pé, migrations aplicadas, `.env` na raiz), `corepack pnpm --filter @sgs/e2e exec playwright install --with-deps chromium`, `corepack pnpm --filter @sgs/e2e test:e2e`, portas 3100/5180, como funciona o outbox (EMAIL_OUTBOX_DIR, nunca em production) e que o seed cria orgs novas a cada execução no banco local.
3. Gate completo antes do commit (memória do projeto: gate completo antes de commit). Carregar a env da raiz linha a linha para as suítes de integração (por causa do `&`). Rodar e registrar contagens no SUMMARY: backend `lint`, `typecheck`, `test`, `test:integration`; frontend `lint`, `typecheck`, `test`; e2e `typecheck` + `test:e2e` completo. Tudo verde.
4. `02.1-VERIFICATION.md`: acrescentar uma seção "Verificação automatizada (quick 260929-gta)" mapeando cada item de `human_verification` para o spec Playwright que o cobre, com o resultado da execução local e a nota do item 4 (resolvido pela quick dek, MANAGER vê cadastrar mas não gerencia). Se todos passaram sem fixme, mudar `status: human_needed` para `status: passed`; se houver fixme, manter `human_needed` e listar o que falta.
5. Commit `ci(e2e): rodar Playwright no CI e publicar relatorio em falha`, depois `git push` e acompanhar o workflow (`gh run watch` / `gh run view --log-failed`) até o job `e2e` terminar verde. Se falhar só no CI (ex.: portas, env, dependências do browser), corrigir e repetir; registrar a causa no SUMMARY.
  </action>
  <verify>
    <automated>cd /root/sgs && python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml')); j=d['jobs']['e2e']; s=str(j); assert 'playwright install --with-deps chromium' in s and 'upload-artifact' in s and 'test:e2e' in s" && corepack pnpm --filter @sgs/frontend lint && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend test && corepack pnpm --filter @sgs/e2e test:e2e</automated>
  </verify>
  <done>Job `e2e` existe no ci.yml e passou no GitHub Actions após o push; artifact configurado para falhas; gate completo verde localmente com contagens no SUMMARY; README do pacote escrito; 02.1-VERIFICATION.md atualizado com o mapeamento item->spec e status coerente.</done>
</task>

</tasks>

<verification>
- `corepack pnpm --filter @sgs/e2e test:e2e` verde localmente: setup + smoke + 6 testes dos 4 itens.
- Backend sem `EMAIL_OUTBOX_DIR` continua usando ResendAdapter; com `NODE_ENV=production` o outbox nunca é usado (spec unitário).
- Suítes existentes intactas: backend unit + integração, frontend vitest, lint e typecheck dos dois apps.
- Job `e2e` verde no GitHub Actions.
- Nenhum container `sgs_stg_*` foi alterado (`docker ps` antes e depois igual para eles).
</verification>

<success_criteria>
- Os 4 itens de human_verification da Fase 02.1 são reproduzidos por Playwright contra a stack real, sem mocks de GraphQL.
- O token do convite é obtido de forma testável e segura (outbox só fora de produção).
- O seed usa a API GraphQL pública; SQL/script direto só no bootstrap do platform admin (script oficial `create-platform-admin`).
- CI bloqueia PR em falha de E2E e publica relatório.
</success_criteria>

<output>
After completion, create `.planning/quick/260929-gta-automatizar-com-playwright-os-testes-de-/260929-gta-SUMMARY.md`
</output>
