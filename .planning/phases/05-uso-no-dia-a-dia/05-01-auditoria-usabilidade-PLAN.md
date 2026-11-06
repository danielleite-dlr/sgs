---
phase: 05-uso-no-dia-a-dia
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .gitignore
  - apps/e2e/playwright.audit.config.ts
  - apps/e2e/audit/audit-helpers.ts
  - apps/e2e/audit/telas.audit.ts
  - apps/e2e/audit/fluxos-escrita.audit.ts
  - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
  - .planning/phases/05-uso-no-dia-a-dia/.05-01-start-sha
autonomous: true
requirements: [UX-DAY]

must_haves:
  truths:
    - "Existe no staging, na org Studio JS, um usuário ADMIN dedicado à auditoria, com credencial guardada só em arquivo local ignorado pelo git (D-12)"
    - "A auditoria no staging não grava nada de negócio: toda mutation GraphQL fora de Login/RefreshSession/Logout é bloqueada no navegador e registrada"
    - "As telas principais foram percorridas em desktop (1366x768) e celular (Pixel 7) na ordem Agenda → Comanda e caixa → Noivas e contratos → Clientes e financeiro → Painel (D-02)"
    - "As tarefas frequentes com escrita (marcar/remarcar horário, fechar comanda e receber, criar contrato e registrar parcela, achar cliente) foram medidas em cliques no ambiente local semeado (D-03, D-12)"
    - "Existe 05-AUDITORIA.md com lista priorizada (severidade, tela, passo a passo, correção proposta, esforço, coluna Aprovado?) sem dados pessoais de clientes"
    - "Nenhuma correção de UX foi feita: os commits deste plano (mensagem com (05-01)) não tocam apps/frontend nem apps/backend (D-01)"
    - "05-AUDITORIA.md fica commitado com status aguardando-aprovacao e a coluna Aprovado? vazia; a aprovação é o primeiro passo do plano 05-08"
  artifacts:
    - path: "apps/e2e/playwright.audit.config.ts"
      provides: "Config Playwright separado para auditoria (staging somente leitura ou local)"
      contains: "AUDIT_TARGET"
    - path: "apps/e2e/audit/audit-helpers.ts"
      provides: "Guarda somente leitura, leitura da credencial, métricas (overflow, alvos de toque, texto sem acento)"
      exports: ["installReadOnlyGuard", "loadAuditEnv", "collectScreenMetrics", "UNACCENTED_WORDS"]
    - path: ".planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md"
      provides: "Lista priorizada para aprovação"
      contains: "Aprovado?"
  key_links:
    - from: "apps/e2e/audit/telas.audit.ts"
      to: "installReadOnlyGuard"
      via: "chamada no beforeEach quando AUDIT_TARGET=staging"
      pattern: "installReadOnlyGuard"
    - from: "apps/e2e/playwright.audit.config.ts"
      to: "/root/sgs/.env.audit"
      via: "loadAuditEnv lê AUDIT_EMAIL/AUDIT_PASSWORD"
      pattern: "\\.env\\.audit"
---

<objective>
Auditoria de usabilidade das telas principais (UX-DAY; D-01, D-02, D-03, D-08, D-12). Produz e commita `05-AUDITORIA.md` com a lista priorizada e a coluna "Aprovado?" vazia, e termina. A aprovação da usuária é o checkpoint inicial do plano 05-08 (assim a onda 1 não fica parada esperando resposta). Nenhuma correção de UX é feita neste plano.

Purpose: a usuária decide o que corrigir com base em problemas reais do dia a dia, medidos no staging (dados reais, só leitura) e no ambiente local (fluxos com escrita).
Output: usuário de auditoria no staging, harness `apps/e2e/audit/*` + `playwright.audit.config.ts`, evidências gitignored, `05-AUDITORIA.md` commitado aguardando aprovação.

Commits deste plano: TODA mensagem de commit contém `(05-01)` (ex.: `chore(05-01): ...`, `docs(05-01): ...`) — a verificação de D-01 da Task 2 depende disso.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-uso-no-dia-a-dia/05-CONTEXT.md
@.planning/phases/05-uso-no-dia-a-dia/05-RESEARCH.md

<interfaces>
Staging (mesma máquina, containers `sgs_stg_*`; URL https://sgs.jessicaseixasmakeup.com.br):
- Banco: `cd /root/sgs && set -a && . ./.env.staging && set +a && docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" sgs_stg_postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"`
- Org Studio JS: `01a0b681-8b9b-790b-921d-4518350e534b` (única `active`). RLS forçada por `app.current_organization`.
- Login lê memberships via `auth_user_memberships(uuid)` que filtra `m.status = 'active' AND m.deleted_at IS NULL` — então `members.status='inactive'` barra o login (usado no fechamento).
- `users`: email (único, minúsculo), password_hash (argon2id: memoryCost 19456, timeCost 2, parallelism 1 — mesmos parâmetros de `apps/backend/src/scripts/create-platform-admin.ts`), full_name, email_verified_at, must_change_password.
- `members`: organization_id, user_id, role_id, display_name, is_professional (default false), status (default 'active'). Papel: `SELECT id FROM roles WHERE name='ADMIN' AND is_system=true LIMIT 1`.

Frontend (operationName das mutations de sessão em `apps/frontend/src/features/auth/api/auth.api.ts`): `Login`, `RefreshSession`, `Logout`.

E2E existente (`apps/e2e`): `playwright.config.ts` (testDir `./tests`, projeto `setup` = `seed.setup.ts`, webServer backend 3100 + frontend 5180, locale pt-BR, timezone America/Sao_Paulo), `support/ui.ts` (`loginViaUi`, `navigateViaMenu`), `support/seed-state.ts` (`readSeedState().owner` = ADMIN local), `support/agenda-ui.ts`, `support/phase3.ts`, `support/phase4.ts`. tsconfig inclui `**/*.ts` (a pasta `audit/` entra no typecheck).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Usuário de auditoria no staging (D-12) + config e helpers da auditoria</name>
  <files>.gitignore, apps/e2e/playwright.audit.config.ts, apps/e2e/audit/audit-helpers.ts, .planning/phases/05-uso-no-dia-a-dia/.05-01-start-sha</files>
  <read_first>
    - apps/backend/src/scripts/create-platform-admin.ts (parâmetros argon2 exatos)
    - apps/backend/src/identity/members.service.ts (método create: campos gravados em users/members)
    - apps/backend/prisma/migrations/20260919000000_platform_roles_and_client_mgmt/migration.sql (auth_user_memberships filtra status 'active')
    - apps/e2e/playwright.config.ts
    - apps/e2e/support/ui.ts
    - apps/frontend/src/features/auth/api/auth.api.ts (operationName das mutations de sessão)
    - .gitignore
  </read_first>
  <action>
**0. Marco de início (para a checagem de D-01 na Task 2):** antes de qualquer commit deste plano, `git rev-parse HEAD > .planning/phases/05-uso-no-dia-a-dia/.05-01-start-sha` (o arquivo é commitado junto com a Task 1).

**A. Criar o usuário de auditoria no staging (escrita única e explícita no staging, autorizada por D-12).** Mecanismo escolhido: hash argon2 gerado DENTRO do container `sgs_stg_backend` (mesma lib e parâmetros do login) + uma transação SQL via `psql` no `sgs_stg_postgres`. Motivo: `createMember` via GraphQL exigiria credencial de um ADMIN real da usuária e forçaria `must_change_password`; o script `create-platform-admin` cria platform admin (não serve). Não alterar código do backend para isso.

1. Conferir containers: `docker ps --format '{{.Names}}' | grep -E '^sgs_stg_(backend|postgres)$'` deve listar os dois.
2. Conferir que ainda não existe: `SELECT id FROM users WHERE email='auditoria.ux@sgs.invalid';` — se existir, NÃO recriar; só reativar (`UPDATE members SET status='active' WHERE user_id=<id> AND organization_id='01a0b681-8b9b-790b-921d-4518350e534b'`) e redefinir a senha com o mesmo hash do passo 3 (`UPDATE users SET password_hash=..., must_change_password=false WHERE id=<id>`).
3. Gerar senha e hash sem gravar a senha em histórico de comando:
   `AUDIT_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"`
   `HASH="$(docker exec -e AUDIT_PW="$AUDIT_PASSWORD" sgs_stg_backend node -e "require('argon2').hash(process.env.AUDIT_PW,{type:2,memoryCost:19456,timeCost:2,parallelism:1}).then(h=>process.stdout.write(h))")"` (type 2 = argon2id). Conferir que `$HASH` começa com `$argon2id$`.
4. Transação (via o comando psql de `<interfaces>`, com `-v hash="$HASH"` e usando `:'hash'` no SQL):
```sql
BEGIN;
SET LOCAL app.current_organization = '01a0b681-8b9b-790b-921d-4518350e534b';
WITH u AS (
  INSERT INTO users (email, password_hash, full_name, email_verified_at, must_change_password)
  VALUES ('auditoria.ux@sgs.invalid', :'hash', 'Auditoria UX (Claude)', now(), false)
  RETURNING id
)
INSERT INTO members (organization_id, user_id, role_id, display_name, is_professional, status)
SELECT '01a0b681-8b9b-790b-921d-4518350e534b', u.id,
       (SELECT id FROM roles WHERE name='ADMIN' AND is_system=true LIMIT 1),
       'Auditoria UX (Claude)', false, 'active'
FROM u
RETURNING id AS member_id, user_id;
COMMIT;
```
5. Gravar a credencial em `/root/sgs/.env.audit` (permissão 600, `chmod 600`), formato KEY=VALUE, uma por linha:
```
AUDIT_BASE_URL=https://sgs.jessicaseixasmakeup.com.br
AUDIT_EMAIL=auditoria.ux@sgs.invalid
AUDIT_PASSWORD=<senha gerada>
AUDIT_USER_ID=<user_id retornado>
AUDIT_MEMBER_ID=<member_id retornado>
AUDIT_ORG_ID=01a0b681-8b9b-790b-921d-4518350e534b
```
6. Conferir o login real: `curl -s https://sgs.jessicaseixasmakeup.com.br/graphql -H 'content-type: application/json' -d '{"operationName":"Login","query":"mutation Login($input: LoginInput!){ login(input:$input){ __typename } }","variables":{"input":{"email":"auditoria.ux@sgs.invalid","password":"<senha>"}}}'` — sem `errors` (se a forma do `LoginInput`/payload diferir, ajustar pelo `apps/backend/src/graphql/schema/auth.graphql`; o objetivo é só confirmar que o login responde sem erro). Nunca imprimir a senha no SUMMARY.

**B. `.gitignore`** — acrescentar ao fim, com comentário `# Fase 5 — auditoria de usabilidade (credencial e evidências com dados reais)`:
```
.env.audit
.planning/phases/05-uso-no-dia-a-dia/05-audit-evidence/
```

**C. `apps/e2e/audit/audit-helpers.ts`** (ESM, TypeScript estrito):
- `export interface AuditEnv { baseUrl: string; email: string; password: string; target: 'staging' | 'local' }`
- `export function loadAuditEnv(): AuditEnv` — `target = process.env.AUDIT_TARGET === 'local' ? 'local' : 'staging'`. Staging: lê `/root/sgs/.env.audit` (caminho resolvido como `resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env.audit')`), parse linha a linha `KEY=VALUE` (ignora vazias e `#`), erro claro `"Credencial de auditoria ausente: crie /root/sgs/.env.audit (plano 05-01, Task 1)"` se faltar. Local: `baseUrl = 'http://localhost:5180'`, email/senha de `readSeedState().owner` (`../support/seed-state`).
- `export const ALLOWED_MUTATIONS = new Set(['Login', 'RefreshSession', 'Logout'])`.
- `export async function installReadOnlyGuard(page: Page, blocked: string[]): Promise<void>` — `page.route('**/graphql', ...)`: se método POST e `query` (de `request.postDataJSON()`) casa `/^\s*mutation\b/` e `operationName` não está em `ALLOWED_MUTATIONS`, empurra o operationName em `blocked` e responde `route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ errors: [{ message: 'Bloqueado pela auditoria (somente leitura)' }] }) })`; senão `route.continue()`.
- `export const UNACCENTED_WORDS = ['nao','voce','servico','servicos','comissao','comissoes','configuracoes','configuracao','informacoes','descricao','situacao','pagina','proximo','opcao','acoes','numero','codigo','periodo','preco','obrigatorio','invalido','sera','historico','observacoes','endereco','horario','horarios','sessao','ultimo','proxima']`.
- `export interface ScreenMetrics { screen: string; project: string; url: string; horizontalOverflow: boolean; smallTargets: { text: string; w: number; h: number }[]; unaccented: string[]; englishWords: string[]; consoleErrors: string[]; loadMs: number }`
- `export async function collectScreenMetrics(page: Page, screen: string, project: string, startedAt: number, consoleErrors: string[]): Promise<ScreenMetrics>` — `horizontalOverflow = document.documentElement.scrollWidth > window.innerWidth`; `smallTargets` = elementos visíveis `button, a, [role=button], input, select` com bounding box w<44 ou h<44 (só no projeto mobile; limitar a 20); `unaccented` = palavras de `UNACCENTED_WORDS` encontradas em `document.body.innerText` com regex `\b<palavra>\b` case-insensitive; `englishWords` = ocorrências de `/\b(Loading|Error|Submit|Cancel|Save|Delete|Search|Next|Previous|No data|Required)\b/`; `loadMs = Date.now() - startedAt`.
- `export const EVIDENCE_DIR` = `resolve(<raiz do repo>, '.planning/phases/05-uso-no-dia-a-dia/05-audit-evidence')` e `export function saveMetrics(m: ScreenMetrics): void` que acrescenta em `${EVIDENCE_DIR}/metrics-${m.project}.jsonl` (cria a pasta com `mkdirSync({recursive:true})`).

**D. `apps/e2e/playwright.audit.config.ts`**: `import base from './playwright.config'`. `const target = process.env.AUDIT_TARGET === 'local' ? 'local' : 'staging'`. `testDir: './audit'`, `testMatch: /.*\.audit\.ts/`, `workers: 1`, `retries: 0`, `reporter: [['list']]`, `use: { locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', baseURL: target === 'local' ? 'http://localhost:5180' : 'https://sgs.jessicaseixasmakeup.com.br', trace: 'off', screenshot: 'off' }`, `outputDir: '../../.planning/phases/05-uso-no-dia-a-dia/05-audit-evidence/test-results'`. Projetos: `{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } }` e `{ name: 'mobile', use: { ...devices['Pixel 7'] } }`; quando `target === 'local'`, acrescentar `{ name: 'setup', testDir: './tests', testMatch: /.*\.setup\.ts/ }`, `dependencies: ['setup']` nos dois projetos e `webServer: base.webServer`. Em staging NÃO há webServer nem setup.
  </action>
  <verify>
    <automated>cd /root/sgs && git check-ignore -q .env.audit && git check-ignore -q .planning/phases/05-uso-no-dia-a-dia/05-audit-evidence/x.png && test "$(stat -c %a .env.audit)" = "600" && grep -q '^AUDIT_EMAIL=auditoria.ux@sgs.invalid$' .env.audit && corepack pnpm --filter @sgs/e2e typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `git check-ignore .env.audit` sai com código 0; `git status --porcelain` não lista `.env.audit`
    - `.gitignore` contém as linhas exatas `.env.audit` e `.planning/phases/05-uso-no-dia-a-dia/05-audit-evidence/`
    - Consulta somente leitura no staging `SELECT m.status, r.name FROM members m JOIN roles r ON r.id=m.role_id JOIN users u ON u.id=m.user_id WHERE u.email='auditoria.ux@sgs.invalid'` (com `SET LOCAL app.current_organization` da Studio JS) retorna exatamente `active | ADMIN`
    - `.env.audit` contém `AUDIT_EMAIL=`, `AUDIT_PASSWORD=`, `AUDIT_USER_ID=`, `AUDIT_MEMBER_ID=` e tem permissão 600
    - `apps/e2e/audit/audit-helpers.ts` contém `export async function installReadOnlyGuard`, `ALLOWED_MUTATIONS = new Set(['Login', 'RefreshSession', 'Logout'])` e `Bloqueado pela auditoria (somente leitura)`
    - `apps/e2e/playwright.audit.config.ts` contém `AUDIT_TARGET`, `testDir: './audit'`, `devices['Pixel 7']` e `width: 1366`
    - `corepack pnpm --filter @sgs/e2e typecheck` passa
    - `.planning/phases/05-uso-no-dia-a-dia/.05-01-start-sha` existe e contém um SHA de 40 caracteres (`git cat-file -e $(cat …)` sai 0)
  </acceptance_criteria>
  <done>Usuário ADMIN de auditoria ativo na Studio JS, credencial só em `/root/sgs/.env.audit` (ignorado), config e helpers da auditoria compilando.</done>
</task>

<task type="auto">
  <name>Task 2: Rodar a auditoria (staging somente leitura + local com escrita) e escrever 05-AUDITORIA.md</name>
  <files>apps/e2e/audit/telas.audit.ts, apps/e2e/audit/fluxos-escrita.audit.ts, .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md</files>
  <read_first>
    - apps/e2e/audit/audit-helpers.ts (Task 1)
    - apps/e2e/support/ui.ts, apps/e2e/support/agenda-ui.ts, apps/e2e/support/phase3.ts, apps/e2e/support/phase4.ts
    - apps/e2e/tests/fluxo-agendamento-comanda-pagamento.spec.ts (passos de UI para marcar horário, fechar comanda e receber)
    - apps/e2e/tests/agenda-dnd.spec.ts (remarcar)
    - apps/e2e/tests/noivas-contrato.spec.ts (criar contrato e registrar parcela)
    - apps/frontend/src/components/layout/menu-config.ts (rótulos do menu para navigateViaMenu)
    - .planning/phases/05-uso-no-dia-a-dia/05-CONTEXT.md (D-01, D-02, D-03, D-08)
  </read_first>
  <action>
**A. `apps/e2e/audit/telas.audit.ts`** — navegação SEM escrita, roda nos dois alvos. `test.describe.configure({ mode: 'serial' })`. `beforeEach`: coleta `console` de tipo `error` num array; se `loadAuditEnv().target === 'staging'` chama `installReadOnlyGuard(page, blocked)`; faz `loginViaUi(page, env.email, env.password)`. `afterEach`: grava `blocked` em `${EVIDENCE_DIR}/blocked-${project}.json`. Um `test()` por tela, nesta ordem (D-02), cada um tirando screenshot `fullPage` em `${EVIDENCE_DIR}/<project>/<NN>-<slug>.png` e chamando `collectScreenMetrics` + `saveMetrics`:
  1. `01-agenda-dia` (`/agenda`), `02-agenda-semana` (alternar para a visão semanal pelo controle da tela), `03-agenda-novo-agendamento` (abrir o diálogo de novo agendamento e preencher até ANTES de confirmar; contar cliques com um contador `let clicks = 0` incrementado a cada `click()` do teste e gravar `{task:'marcar horário (até antes de salvar)', clicks}` em `${EVIDENCE_DIR}/tasks-${project}.jsonl`), `04-agenda-detalhe` (abrir um agendamento existente se houver; senão registrar "sem agendamentos — estado vazio").
  2. `05-comanda-lista` (`/comanda`), `06-comanda-detalhe` (primeira comanda da lista, se houver), `07-financeiro` (`/financeiro`), `08-financeiro-comissoes` (`/financeiro/comissoes`).
  3. `09-noivas-lista` (`/noivas`), `10-noivas-detalhe` (primeiro grupo), `11-contratos-lista` (`/contratos`), `12-contrato-detalhe` (primeiro contrato; abrir o diálogo de registrar pagamento e parar antes de confirmar, contando cliques).
  4. `13-clientes-lista` (`/clientes`), `14-clientes-busca` (digitar 3 letras na busca, medir tempo até a lista atualizar; contar cliques até abrir a ficha), `15-cliente-detalhe`.
  5. `16-painel` (`/dashboard` — hoje redireciona; registrar o que aparece; base para as propostas de D-08).
  Em cada tela, também registrar estados de carregamento visíveis (Skeleton) e mensagens de erro exibidas.

**B. `apps/e2e/audit/fluxos-escrita.audit.ts`** — só local: primeira linha do describe `test.skip(loadAuditEnv().target !== 'local', 'fluxos com escrita só no ambiente local semeado (D-12)')`. Repetir, contando cliques e tempo e tirando screenshot em cada etapa, as tarefas de D-03 copiando os passos de UI das specs existentes listadas em read_first: (a) marcar horário até salvar; (b) remarcar (arrastar e pelo menu); (c) abrir comanda do agendamento, adicionar item, receber em dinheiro e em Pix, fechar; (d) criar grupo de noiva e contrato e registrar uma parcela; (e) buscar cliente e abrir a ficha. Gravar `{task, clicks, ms, notes}` em `${EVIDENCE_DIR}/tasks-local-${project}.jsonl`. Não criar asserts que falhem por UX ruim: a spec mede; ela só falha se a tela quebrar.

**C. Rodar:**
- Staging: `cd /root/sgs/apps/e2e && corepack pnpm exec playwright test -c playwright.audit.config.ts audit/telas.audit.ts`
- Local (sobe backend/frontend e seed como no E2E normal; Postgres local precisa estar de pé): `AUDIT_TARGET=local corepack pnpm exec playwright test -c playwright.audit.config.ts`
- Varredura de texto no código: `grep -rnoiE "['\">][^'\"<>]*\b(nao|voce|servico|comissao|configuracoes|informacoes|descricao|situacao|pagina|proximo|opcao|acoes|numero|codigo|periodo|preco|obrigatorio|invalido|historico|observacoes|endereco|horario)\b" apps/frontend/src --include=*.tsx --include=*.ts | grep -v __tests__` (anotar os achados como itens "Polimento" de acentuação).
- Abrir com a ferramenta Read as screenshots de cada tela (desktop e mobile) e julgar: textos confusos, erros sem explicação, estados vazios, carregamento, overflow, alvos pequenos, consistência PT-BR (D-03).
- `blocked-staging*.json` deve listar só mutations disparadas pela UI (ex.: marcar notificação como lida); qualquer escrita que tenha passado é falha — conferir que o arquivo de bloqueio existe e que nenhuma resposta de mutation de negócio teve sucesso.

**D. Escrever `.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md`** exatamente com esta estrutura (texto em PT-BR com acentos; SEM nomes, telefones, CPF ou e-mail de clientes — descrever genericamente, ex.: "cliente com nome longo"; Pitfall 9):
Frontmatter YAML no topo do arquivo (entre as duas linhas delimitadoras de três hífens, como nos PLAN.md) com exatamente estas chaves: `phase: 05-uso-no-dia-a-dia`, `status: aguardando-aprovacao`, `audited_at: <AAAA-MM-DD>`, `ambientes: staging (somente leitura, usuário de auditoria) e local semeado (fluxos com escrita)`. Depois do frontmatter, o corpo:
```
# Auditoria de usabilidade — Fase 5

## Resumo para a usuária
<até 1 página: os 5–10 problemas que mais atrapalham o dia a dia, em linguagem simples, cada um com o ID>

## Como aprovar
Preencha a coluna "Aprovado?" de cada item com **sim**, **não** ou **depois**. Também vale responder em texto (ex.: "aprovo todos os Bloqueia e Atrapalha; UX-07 depois"). Só os itens com **sim** viram correção.

## Itens por tela
Severidade: **Bloqueia** (impede a tarefa), **Atrapalha** (atrasa ou confunde), **Polimento** (acabamento). Esforço: **P** (< 1 h), **M** (1–3 h), **G** (> 3 h).

### 1. Agenda
| ID | Severidade | Tela | Passo a passo | Esperado x Observado | Correção proposta | Esforço | Evidência | Aprovado? |
|----|------------|------|---------------|----------------------|-------------------|---------|-----------|-----------|
### 2. Comanda e caixa
(mesma tabela)
### 3. Noivas e contratos
(mesma tabela)
### 4. Clientes e financeiro
(mesma tabela)
### 5. Painel (propostas — D-08; nada entra no painel além da previsão sem aprovação)
(mesma tabela)

## Medição das tarefas frequentes (D-03)
| Tarefa | Ambiente | Dispositivo | Cliques | Tempo | Observações |

## Ideias de funcionalidade nova (fora da correção — vão para o backlog)
- ...

## Registro de aprovação
(preenchido após a resposta da usuária: data, forma da aprovação, IDs aprovados)

## Correções
| ID | Lote (plano) | Corrigido em (commit) | Verificado no staging |
```
IDs sequenciais `UX-01`, `UX-02`… na ordem das seções; dentro de cada seção, ordenar Bloqueia → Atrapalha → Polimento. Coluna "Evidência" = nome do arquivo de screenshot (ex.: `mobile/03-agenda-novo-agendamento.png`), nunca a imagem. Coluna "Aprovado?" preenchida com `—`. Funcionalidade nova NÃO vira item (vai para a seção de ideias; D-03).

**E. Commit e fim do plano:** commitar `apps/e2e/audit/telas.audit.ts`, `apps/e2e/audit/fluxos-escrita.audit.ts` e `05-AUDITORIA.md` com mensagem `docs(05-01): auditoria de usabilidade aguardando aprovação` (+ linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`). NÃO pedir aprovação aqui: o plano 05-08 começa apresentando a lista à usuária.

**Proibido neste plano:** alterar qualquer arquivo em `apps/frontend` ou `apps/backend` (D-01). Como outros planos da onda 1 (05-02, 05-05) mexem nessas pastas em paralelo, a checagem olha só os commits deste plano (mensagem com `(05-01)`) desde o SHA de `.05-01-start-sha`.
  </action>
  <verify>
    <automated>cd /root/sgs && F=.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md && test -s $F && grep -q '| ID | Severidade | Tela | Passo a passo | Esperado x Observado | Correção proposta | Esforço | Evidência | Aprovado? |' $F && grep -q '^status: aguardando-aprovacao' $F && grep -qE '^\| UX-01 \|' $F && ! grep -qE '[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}|\(?[0-9]{2}\)? ?9[0-9]{4}-?[0-9]{4}' $F && S=$(cat .planning/phases/05-uso-no-dia-a-dia/.05-01-start-sha) && test -z "$(git log --format= --name-only --fixed-strings --grep='(05-01)' "$S"..HEAD | grep -E '^apps/(frontend|backend)/')" && git log --format=%s "$S"..HEAD | grep -qF 'docs(05-01)' && corepack pnpm --filter @sgs/e2e typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `05-AUDITORIA.md` existe, tem `status: aguardando-aprovacao`, as 5 seções `### 1. Agenda`, `### 2. Comanda e caixa`, `### 3. Noivas e contratos`, `### 4. Clientes e financeiro`, `### 5. Painel` e o cabeçalho de tabela exato `| ID | Severidade | Tela | Passo a passo | Esperado x Observado | Correção proposta | Esforço | Evidência | Aprovado? |`
    - Pelo menos uma linha começa com `| UX-01 |`; toda linha de item tem `—` na coluna Aprovado?
    - Seção `## Medição das tarefas frequentes (D-03)` tem linhas para "marcar horário", "remarcar", "fechar comanda", "registrar parcela" e "achar cliente"
    - O arquivo não contém padrões de CPF (`ddd.ddd.ddd-dd`) nem de celular (`9dddd-dddd`)
    - Existem `05-audit-evidence/desktop/` e `05-audit-evidence/mobile/` com screenshots, e `git status --porcelain .planning/phases/05-uso-no-dia-a-dia/05-audit-evidence` sai vazio (ignorado)
    - `git log --format= --name-only --fixed-strings --grep='(05-01)' $(cat .planning/phases/05-uso-no-dia-a-dia/.05-01-start-sha)..HEAD | grep -E '^apps/(frontend|backend)/'` não imprime nada (nenhuma correção feita por este plano, D-01)
    - Existe commit `docs(05-01): auditoria de usabilidade aguardando aprovação` contendo `05-AUDITORIA.md`
  </acceptance_criteria>
  <done>Lista priorizada pronta em 05-AUDITORIA.md, evidências locais fora do git, nenhuma linha de código de produto alterada.</done>
</task>


</tasks>

<verification>
- `git check-ignore .env.audit` e da pasta de evidências: ok
- Staging: usuário `auditoria.ux@sgs.invalid` ativo como ADMIN da Studio JS
- `05-AUDITORIA.md` commitado com `status: aguardando-aprovacao`, sem dados pessoais
- Nenhum commit `(05-01)` toca `apps/frontend`/`apps/backend`
</verification>

<success_criteria>
Existe uma lista priorizada de problemas de usabilidade das telas principais, pronta para a aprovação da usuária no início do plano 05-08 (critério de sucesso 1, primeira parte). Nenhuma correção feita.
</success_criteria>

<output>
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-01-SUMMARY.md` (sem a senha; mencionar o caminho `/root/sgs/.env.audit` e o e-mail do usuário de auditoria, que será desativado no plano 05-20).
</output>
