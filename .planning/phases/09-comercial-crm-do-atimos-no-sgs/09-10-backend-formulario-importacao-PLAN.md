---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 10
type: execute
wave: 3
depends_on: ["09-04"]
files_modified:
  - apps/backend/src/graphql/schema/commercial-intake.graphql
  - apps/backend/src/commercial/commercial-intake.module.ts
  - apps/backend/src/commercial/commercial-intake.resolver.ts
  - apps/backend/src/commercial/lead-sheet.ts
  - apps/backend/src/commercial/lead-sheet.spec.ts
  - apps/backend/src/commercial/commercial-import.service.ts
  - apps/backend/src/commercial/commercial-form-settings.service.ts
  - apps/backend/src/commercial/public-lead.controller.ts
  - apps/backend/src/commercial/public-lead.service.ts
  - apps/backend/test/integration/phase9-import.e2e.spec.ts
  - apps/backend/test/integration/phase9-public-form.e2e.spec.ts
autonomous: true
requirements: [COM-02, COM-03, COM-10]

must_haves:
  truths:
    - "Planilha .xlsx ou .csv (vírgula ou ponto e vírgula, com ou sem BOM) gera prévia com linhas válidas, inválidas (com motivo) e duplicadas contra leads e clientes; a importação grava leads com origem 'import' e, quando há tipo/data, um negócio na primeira etapa (D-04)"
    - "Limites: 2,5 MB de arquivo (cabe no bodyLimit de 4 MiB do Fastify em base64) e 2.000 linhas; fórmulas são lidas como texto"
    - "O formulário público GET/POST /public/leads/:orgId/:token só funciona com token ativo (comparação em tempo constante); token errado, inativo ou org inválida dão o mesmo 404"
    - "O POST exige consentimento LGPD (grava consent_at e a versão do texto), tem honeypot (responde ok sem gravar), limite de 5 envios por minuto por IP e não loga telefone nem e-mail"
    - "Lead e negócio do site e da importação entram sem responsável (visíveis só a ADMIN/MANAGER, D-20), salvo o responsável padrão do formulário ou o escolhido por ADMIN/MANAGER na importação"
    - "Só ADMIN/MANAGER veem e editam a configuração do formulário e regeram o token"
  artifacts:
    - path: "apps/backend/src/commercial/lead-sheet.ts"
      provides: "parseLeadSheet"
      exports: ["parseLeadSheet", "MAX_IMPORT_BYTES", "MAX_IMPORT_ROWS"]
    - path: "apps/backend/src/commercial/public-lead.controller.ts"
      provides: "GET/POST /public/leads/:orgId/:token"
      contains: "@Throttle"
    - path: "apps/backend/src/graphql/schema/commercial-intake.graphql"
      provides: "importação e configuração do formulário"
      contains: "previewCommercialLeadImport"
  key_links:
    - from: "apps/backend/src/commercial/public-lead.controller.ts"
      to: "ThrottlerGuard global options"
      via: "@UseGuards(ThrottlerGuard) sem novo ThrottlerModule.forRoot"
      pattern: "UseGuards\\(ThrottlerGuard\\)"
    - from: "apps/backend/src/commercial/public-lead.service.ts"
      to: "timingSafeEqual"
      via: "comparação do token"
      pattern: "timingSafeEqual"
    - from: "apps/backend/src/commercial/commercial-import.service.ts"
      to: "findDuplicatesTx"
      via: "duplicidade na prévia"
      pattern: "findDuplicatesTx"
---

<objective>
As duas entradas externas de leads: importação de planilha (prévia + gravação) e formulário público do site (configuração por ADMIN/MANAGER + endpoint REST público com anti-spam e LGPD).

Purpose: COM-02 e COM-03 (D-04).
Output: parser puro com spec, serviços de importação e de formulário, controller público, resolver, SDL e duas suítes de integração.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-RESEARCH.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-04-SUMMARY.md

**Ambiente de execução:** igual ao 09-01.

**Verificado no planejamento (itens "não verificado" da pesquisa):**
- `apps/backend/src/http/fastify-adapter.ts`: `bodyLimit: 4 * 1024 * 1024` (4 MiB) global. 2,5 MB de planilha viram ~3,4 MB em base64: cabe. Por isso o limite da importação é 2,5 MB (não 5 MB como sugeria a pesquisa). nginx do staging aceita 25m.
- `@nestjs/throttler` `ThrottlerModule` é `@Global()` e já é registrado com `forRoot([{ ttl: 60_000, limit: 20 }])` em `ContractAcceptanceModule`. NÃO chamar `forRoot` de novo (dois registros globais conflitam): o controller novo usa `@UseGuards(ThrottlerGuard)` e `@Throttle` por rota. Comentário no módulo explicando a dependência.
- O nginx do staging já encaminha `/public/` para o backend com `X-Forwarded-For` (o `trustProxy` do adapter dá o IP real para o limite).

**Referência:** `/root/atmo-crm/atmos-crm/src/app/api/widget/leads/route.ts` (comportamento), `/root/atmo-crm/atmos-crm/supabase/migrations/20260327_017_add_widget_and_source.sql` e `20260403_019_add_legacy_clients.sql`.

<interfaces>
`apps/backend/src/contracts/acceptance/public-contract.controller.ts`: `@Public()` (`../../auth/decorators/public.decorator`), `@Controller('public/contracts')`, `@UseGuards(ThrottlerGuard)`, `PrivateResponse()` = `Header('Cache-Control','no-store')` + `Header('X-Robots-Tag','noindex')` + `Header('Referrer-Policy','no-referrer')`, `@Throttle({ default: { limit: 5, ttl: 60_000 } })` na escrita, tipos mínimos `HttpReq { ip; headers }`.
`contract-acceptance.service.ts`: `notFound()` → `new NotFoundException({ code: 'NOT_FOUND', message })`; `runWithTenant(orgId)` com o orgId da URL (validar UUID antes; inválido = mesmo 404).
Do 09-04: `findDuplicatesTx(tx, { phone, email })`, `ensureDefaultStagesTx(tx, orgId)`, `CommercialError`. Do 09-02: `phoneDigits`, `phoneKey`, `COMMERCIAL_SOURCES`, `DEAL_KINDS`, `isManagerRole`.
exceljs 4.4.0: `new ExcelJS.Workbook()`, `wb.xlsx.load(buffer)`, `wb.csv.read(stream, { parserOptions: { delimiter } })`, `ws.eachRow({ includeEmpty: false }, (row, n) => ...)`, `cell.value` pode ser `string | number | Date | { formula, result } | { richText } | { text, hyperlink }`.
Modelos de teste: `phase4-public-acceptance.e2e.spec.ts`, `phase4-public-ratelimit.e2e.spec.ts`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Parser de planilha e importação (prévia + gravação)</name>
  <files>apps/backend/src/commercial/lead-sheet.ts, apps/backend/src/commercial/lead-sheet.spec.ts, apps/backend/src/commercial/commercial-import.service.ts, apps/backend/src/graphql/schema/commercial-intake.graphql, apps/backend/src/commercial/commercial-intake.resolver.ts, apps/backend/src/commercial/commercial-intake.module.ts, apps/backend/test/integration/phase9-import.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/commercial/commercial-intake.module.ts (shell do 09-04)
    - apps/backend/src/commercial/commercial-leads.service.ts (findDuplicatesTx)
    - apps/backend/src/contracts/contract-letterhead.service.ts (base64 por GraphQL e limite)
  </read_first>
  <behavior>
    parseLeadSheet(buffer, filename):
    - xlsx com cabeçalhos 'Nome', 'Celular', 'E-mail', 'Tipo', 'Data do evento', 'Origem', 'Observações' (acento/caixa variando) → linhas normalizadas { line, fullName, phone, email, kind, eventDate 'YYYY-MM-DD', source, notes }
    - csv com ';' e BOM e csv com ',' → mesmo resultado
    - célula com fórmula '=HYPERLINK(...)' → usa o texto do resultado ou a fórmula como texto, nunca avalia
    - data '10/05/2027', '2027-05-10' e Date do Excel → '2027-05-10'; data inválida → linha inválida 'Data do evento inválida'
    - tipo 'Noiva'/'noiva'/'NOIVA' → 'noiva'; 'debutante'/'15 anos' → 'debutante'; vazio → null; outro → inválida 'Tipo deve ser noiva ou debutante'
    - sem nome → inválida 'Nome obrigatório'; sem telefone e sem e-mail → inválida 'Informe telefone ou e-mail'
    - origem desconhecida ou vazia → 'import'
    - mesmo telefone repetido no arquivo → a segunda linha vai para inválidas 'Repetido na planilha (linha N)'
    - mais de 2.000 linhas → erro TOO_MANY_ROWS; buffer > 2,5 MB → FILE_TOO_LARGE; extensão fora de .xlsx/.csv ou xlsx sem assinatura 'PK' → FILE_TYPE_INVALID; sem coluna de nome → HEADER_MISSING
    integração:
    - previewCommercialLeadImport devolve valid/invalid e duplicateOf { type: 'client'|'lead', id, name } para linhas que casam com cliente do SGS ou lead existente
    - importCommercialLeads cria os leads (source da linha, created_by = quem importa), liga à cliente quando duplicateOf é client, pula duplicadas de lead (skipped), cria negócio na primeira etapa aberta quando há tipo; negócios sem responsável (D-20) a menos que ADMIN/MANAGER passe assigneeMemberId (validado); ATTENDANT passando assigneeMemberId → ignorado
    - tudo numa transação: erro inesperado não deixa importação parcial
    - PROFESSIONAL → FORBIDDEN; ATTENDANT pode importar (COMMERCIAL_WRITE)
  </behavior>
  <action>
1. `lead-sheet.ts`: `export const MAX_IMPORT_BYTES = 2_500_000; export const MAX_IMPORT_ROWS = 2000;` `export async function parseLeadSheet(buffer: Buffer, filename: string): Promise<{ valid: ParsedLeadRow[]; invalid: { line: number; reason: string }[] }>` lançando `CommercialError` para os erros de arquivo. Só a primeira planilha; valores convertidos para texto (`richText` → junção, `{ formula, result }` → `String(result ?? '')`, hyperlink → `text`), trim, até 255 caracteres por campo (notas até 2000). Mapa de cabeçalhos normalizados (sem acento, minúsculo): nome/name/nome completo → fullName; telefone/celular/whatsapp/fone/phone → phone; e-mail/email → email; tipo/evento tipo → kind; data do evento/data/data evento → eventDate; origem/source → source; observacoes/obs/notas → notes. CSV: remover BOM, detectar `;` vs `,` pela primeira linha.
2. SDL `commercial-intake.graphql`:
```graphql
type CommercialImportDuplicate { type: String! id: UUID! name: String! }

type CommercialImportRow {
  line: Int!
  fullName: String!
  phone: String
  email: String
  kind: String
  eventDate: String
  source: String!
  notes: String
  duplicateOf: CommercialImportDuplicate
}

type CommercialImportInvalid { line: Int! reason: String! }

type CommercialImportPreview {
  totalRows: Int!
  valid: [CommercialImportRow!]!
  invalid: [CommercialImportInvalid!]!
  errors: [UserError!]!
}

type CommercialImportResult {
  createdLeads: Int!
  createdDeals: Int!
  linkedClients: Int!
  skipped: Int!
  errors: [UserError!]!
}

type CommercialFormSettings {
  isActive: Boolean!
  token: String!
  publicPath: String!
  defaultAssignee: CommercialMember
  successMessage: String
  consentText: String!
  consentTextVersion: String!
}

input UpdateCommercialFormSettingsInput {
  isActive: Boolean
  defaultAssigneeMemberId: UUID
  clearDefaultAssignee: Boolean
  successMessage: String
  consentText: String
}

type CommercialFormSettingsPayload { settings: CommercialFormSettings errors: [UserError!]! }

extend type Query {
  commercialFormSettings: CommercialFormSettings!
}

extend type Mutation {
  previewCommercialLeadImport(base64: String!, filename: String!): CommercialImportPreview!
  importCommercialLeads(base64: String!, filename: String!, assigneeMemberId: UUID): CommercialImportResult!
  updateCommercialFormSettings(input: UpdateCommercialFormSettingsInput!): CommercialFormSettingsPayload!
  regenerateCommercialFormToken: CommercialFormSettingsPayload!
}
```
   (a importação relê e revalida o arquivo no servidor; não confia em linhas vindas do cliente.)
3. `commercial-import.service.ts`: `preview` (parse + `findDuplicatesTx` por linha) e `import` (uma `runWithTenant` com `timeout` de 60 s: `{ timeout: 60_000 }` se o `runWithTenant` aceitar opções, conferir assinatura), regras do `<behavior>`. Resolver: as duas mutações com `COMMERCIAL_WRITE`.
4. `lead-sheet.spec.ts` (gera planilhas em memória com exceljs e CSV como string) e `phase9-import.e2e.spec.ts`.
Commits `test(09-10): importação de planilha` e `feat(09-10): importação de leads por planilha`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- src/commercial/lead-sheet && corepack pnpm --filter @sgs/backend test:integration -- phase9-import && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export const MAX_IMPORT_BYTES = 2_500_000" apps/backend/src/commercial/lead-sheet.ts` encontra
    - `grep -n "FILE_TOO_LARGE\|TOO_MANY_ROWS\|FILE_TYPE_INVALID\|HEADER_MISSING" apps/backend/src/commercial/lead-sheet.spec.ts` encontra os 4
    - `grep -n "findDuplicatesTx" apps/backend/src/commercial/commercial-import.service.ts` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Importação segura, com prévia e sem gravação parcial.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Configuração do formulário e endpoint público</name>
  <files>apps/backend/src/commercial/commercial-form-settings.service.ts, apps/backend/src/commercial/public-lead.controller.ts, apps/backend/src/commercial/public-lead.service.ts, apps/backend/src/commercial/commercial-intake.resolver.ts, apps/backend/src/commercial/commercial-intake.module.ts, apps/backend/test/integration/phase9-public-form.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/contracts/acceptance/public-contract.controller.ts
    - apps/backend/src/contracts/acceptance/contract-acceptance.module.ts
    - apps/backend/src/contracts/acceptance/contract-acceptance.service.ts (notFound, runWithTenant com orgId da URL)
    - apps/backend/test/integration/phase4-public-ratelimit.e2e.spec.ts e phase4-public-acceptance.e2e.spec.ts
  </read_first>
  <behavior>
    - commercialFormSettings (MANAGER) cria a linha na primeira leitura com token aleatório (32 bytes base64url, 43 caracteres), isActive false, publicPath '/contato/{orgId}/{token}'; ATTENDANT → FORBIDDEN
    - updateCommercialFormSettings muda isActive/responsável padrão (validado: membro ativo ADMIN/MANAGER/ATTENDANT, senão ASSIGNEE_INVALID)/mensagem (≤300)/texto de consentimento (≤2000); mudar consentText incrementa consentTextVersion (v1 → v2)
    - regenerateCommercialFormToken troca o token; o antigo passa a dar 404
    - GET /public/leads/:orgId/:token ativo → 200 { orgName, consentText, consentTextVersion, successMessage } com Cache-Control no-store; token errado, inativo, orgId não-UUID ou de outra org → 404 { code: 'NOT_FOUND' } idêntico
    - POST válido { fullName, phone, email?, kind: 'noiva'|'debutante', eventDate?, message?, consent: true, website: '' } → 201 { ok: true, message: successMessage ou 'Recebemos seu contato. Em breve falaremos com você.' }; cria lead source 'site', consent_at, consent_text_version, created_by null; negócio na primeira etapa aberta, source 'site', notes = message, assignee = responsável padrão ou null
    - website preenchido (honeypot) → 201 { ok: true } e nada gravado
    - consent ausente/false → 400 CONSENT_REQUIRED; telefone inválido → 400 PHONE_INVALID; nome < 2 ou > 120 → 400 NAME_INVALID; message > 1000 → 400 MESSAGE_TOO_LONG; kind inválido → 400 KIND_INVALID
    - mesmo telefone enviado de novo em menos de 30 min → não cria lead nem negócio; acrescenta interação 'other' 'Novo envio pelo formulário do site'
    - telefone de lead existente (mais antigo) → reusa o lead; cria negócio novo só se não houver negócio aberto do mesmo tipo
    - 6º POST no mesmo minuto do mesmo IP → 429
    - lead do site aparece para MANAGER e não para ATTENDANT (D-20)
    - nenhum log do processo contém o telefone/e-mail enviados (espião no Logger)
  </behavior>
  <action>
1. `commercial-form-settings.service.ts`: `get(orgId)` (cria se faltar, com `randomBytes(32).toString('base64url')`), `update`, `regenerate`.
2. `public-lead.service.ts`: `view(orgId, token)` e `submit(orgId, token, body, ip)`; validar `orgId` UUID (regex) antes de `runWithTenant(orgId)`; carregar settings, `is_active`, comparar token com `timingSafeEqual` (buffers de mesmo tamanho; tamanho diferente = falha) — qualquer falha → mesmo `NotFoundException({ code: 'NOT_FOUND', message: 'Formulário não encontrado.' })`. Erros de validação → `BadRequestException({ code, message })`. Regras do `<behavior>`. Não registrar IP em claro em lugar nenhum; não logar corpo.
3. `public-lead.controller.ts`: `@Public() @Controller('public/leads') @UseGuards(ThrottlerGuard)`; `@Get(':orgId/:token')` com `PrivateResponse` (mesmos 3 cabeçalhos do aceite); `@Post(':orgId/:token') @HttpCode(201) @Throttle({ default: { limit: 5, ttl: 60_000 } })`. Corpo tipado como `unknown` e validado no serviço (sem class-validator global).
4. `commercial-intake.module.ts`: controller + serviços + resolver; comentário "ThrottlerModule é @Global e já registrado em ContractAcceptanceModule; não chamar forRoot aqui". Resolver: `commercialFormSettings`, `updateCommercialFormSettings`, `regenerateCommercialFormToken` → `COMMERCIAL_MANAGE`.
5. `phase9-public-form.e2e.spec.ts` (requests via `app.inject` como os testes públicos da fase 4).
Commits `test(09-10): formulário público` e `feat(09-10): formulário do site com LGPD e anti-spam`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase9-public-form phase4-public-ratelimit phase4-public-acceptance && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "ThrottlerModule.forRoot" apps/backend/src/commercial/*.ts` vazio
    - `grep -n "timingSafeEqual" apps/backend/src/commercial/public-lead.service.ts` encontra
    - `grep -n "@Throttle({ default: { limit: 5, ttl: 60_000 } })" apps/backend/src/commercial/public-lead.controller.ts` encontra
    - `grep -n "website" apps/backend/test/integration/phase9-public-form.e2e.spec.ts` encontra (honeypot) e `grep -n "429" apps/backend/test/integration/phase9-public-form.e2e.spec.ts` encontra
    - comando do `<verify>` sai 0 (testes públicos da fase 4 sem regressão)
  </acceptance_criteria>
  <done>Leads chegam pelo site com consentimento e proteção contra abuso.</done>
</task>

</tasks>

<verification>
`lead-sheet` (unit), `phase9-import`, `phase9-public-form` e os testes públicos da fase 4 verdes.
</verification>

<success_criteria>
COM-02 e COM-03 prontos no backend.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-10-SUMMARY.md`
</output>
