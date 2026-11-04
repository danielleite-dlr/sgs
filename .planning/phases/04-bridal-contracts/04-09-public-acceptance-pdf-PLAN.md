---
phase: 04-bridal-contracts
plan: 09
type: execute
wave: 3
depends_on: ["04-04", "04-06"]
files_modified:
  - apps/backend/src/main.ts
  - apps/backend/src/http/fastify-adapter.ts
  - apps/backend/test/integration/helpers/phase3-fixtures.ts
  - apps/backend/src/contracts/acceptance/contract-acceptance.module.ts
  - apps/backend/src/contracts/acceptance/public-contract.controller.ts
  - apps/backend/src/contracts/acceptance/contract-acceptance.service.ts
  - apps/backend/src/contracts/acceptance/contract-pdf.service.ts
  - apps/backend/src/contracts/acceptance/contract-pdf.service.spec.ts
  - apps/backend/src/contracts/acceptance/contract-documents.resolver.ts
  - apps/backend/src/graphql/schema/contract-documents.graphql
  - apps/backend/test/integration/phase4-public-acceptance.e2e.spec.ts
  - apps/backend/test/integration/phase4-public-ratelimit.e2e.spec.ts
  - apps/frontend/vite.config.ts
  - apps/frontend/src/features/bridal/api/public-contract.api.ts
  - apps/frontend/src/features/bridal/public/ContractAcceptPage.tsx
  - apps/frontend/src/features/bridal/__tests__/contract-accept-page.test.tsx
autonomous: true
requirements: [CONT-01, CONT-03]

must_haves:
  truths:
    - "A noiva abre /aceite/<orgId>/<token>, lê o texto do contrato, informa nome + CPF e clica 'Aceito' (D-15)"
    - "O aceite grava data/hora, IP real (atrás do nginx), user-agent e sha256 do texto exato aceito; o registro é imutável"
    - "Token inexistente, revogado, expirado ou de outra org responde 404 genérico; hash divergente (texto mudou) é rejeitado; CPF inválido é rejeitado; segundo aceite responde 409"
    - "Mais de 5 POSTs de aceite por minuto do mesmo IP recebem 429"
    - "Depois do aceite a noiva baixa o PDF pelo link e o proprietário baixa pela tela do contrato"
  artifacts:
    - path: "apps/backend/src/contracts/acceptance/public-contract.controller.ts"
      provides: "GET /public/contracts/:orgId/:token, POST .../accept, GET .../pdf"
      contains: "@Public()"
    - path: "apps/backend/src/contracts/acceptance/contract-pdf.service.ts"
      exports: ["ContractPdfService"]
    - path: "apps/frontend/src/features/bridal/public/ContractAcceptPage.tsx"
      provides: "Página pública de aceite"
  key_links:
    - from: "main.ts"
      to: "FastifyAdapter trustProxy"
      via: "createFastifyAdapter()"
      pattern: "trustProxy: true"
    - from: "public-contract.controller.ts"
      to: "ThrottlerGuard"
      via: "@UseGuards(ThrottlerGuard) só neste controller"
      pattern: "ThrottlerGuard"
    - from: "ContractAcceptPage.tsx"
      to: "/public/contracts/:orgId/:token"
      via: "fetch (sem Apollo)"
      pattern: "public/contracts"
---

<objective>
Aceite digital por link público (D-15, D-16, D-23) e PDF do contrato: controller REST `@Public()` com rate limit, IP real via `trustProxy`, registro de aceite append-only com hash do texto, PDF via pdfkit (público após aceite; dono via GraphQL base64) e a página pública React.

Purpose: fecha o ciclo "contrato → link → aceite" que o E2E (04-15) exercita; atende a parte de assinatura digital de CONT-01/PROJECT.md.
Output: controller, services, SDL `contract-documents.graphql`, página pública, 2 suítes de integração + testes unit/vitest.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@.planning/phases/04-bridal-contracts/04-RESEARCH.md
@.planning/phases/04-bridal-contracts/04-06-SUMMARY.md
@apps/backend/src/main.ts
@apps/backend/src/health/health.controller.ts
@apps/backend/src/clients/cpf.util.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
```
Branch `master`; sempre `corepack pnpm`. Gate antes de cada commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration -- phase4 && corepack pnpm --filter @sgs/frontend test`. Dono exclusivo de `src/contracts/acceptance/*` e de `contract-documents.graphql`.

Artefato gerado: se o merge com um plano paralelo conflitar em `apps/frontend/src/gql/`, não resolver à mão — regenerar com `corepack pnpm --filter @sgs/frontend codegen` e commitar o resultado.

<interfaces>
- `@Public()` de `src/auth/decorators/public.decorator` — obrigatório: o `JwtAuthGuard` global é GraphQL-bound (ver comentário em health.controller.ts — Pitfall 2).
- `@nestjs/throttler@6.7.1` (instalado no 04-01): `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])`, `@UseGuards(ThrottlerGuard)`, `@Throttle({ default: { limit: 5, ttl: 60_000 } })`.
- `validateCpf(input): boolean`, `normalizeCpf(input): string` (clients/cpf.util.ts).
- Do 04-02: `hashToken`, `sha256Hex`, `maskCpf`, `formatDateBR`. Do 04-06: `lockContract(tx, id)`, tabela `contract_access_tokens(token_hash, version_id, expires_at, revoked_at)`, `contract_versions(rendered_text, text_sha256, version)`.
- `TenantContextService.runWithTenant(orgId, fn)` — o orgId vem do path (validar UUID) e resolve o tenant sem SECURITY DEFINER (RESEARCH Pattern 7).
- `recordAudit(tx, { orgId, actorMemberId: null, action: 'contract.accept', entityType: 'contract', entityId })`.
- Frontend: Apollo usa `import.meta.env.VITE_API_URL` (`${VITE_API_URL}/graphql`) e o Vite tem proxy de `/graphql` em vite.config.ts.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: trustProxy, controller público com rate limit e serviço de aceite</name>
  <files>apps/backend/src/http/fastify-adapter.ts, apps/backend/src/main.ts, apps/backend/test/integration/helpers/phase3-fixtures.ts, apps/backend/src/contracts/acceptance/contract-acceptance.module.ts, apps/backend/src/contracts/acceptance/public-contract.controller.ts, apps/backend/src/contracts/acceptance/contract-acceptance.service.ts</files>
  <read_first>
    - apps/backend/src/main.ts
    - apps/backend/src/health/health.controller.ts (padrão @Public em REST)
    - apps/backend/test/integration/helpers/phase3-fixtures.ts (linha `new FastifyAdapter()`)
    - apps/backend/src/contracts/contract-lock.ts e contract-serialize.ts (04-06)
  </read_first>
  <action>
1. `src/http/fastify-adapter.ts`: `export function createFastifyAdapter(opts: { logger?: boolean } = {}) { return new FastifyAdapter({ logger: opts.logger ?? false, trustProxy: true }); }`. `main.ts` usa `createFastifyAdapter({ logger: true })` (Pitfall 3). `phase3-fixtures.ts` troca `new FastifyAdapter()` por `createFastifyAdapter()` (para `X-Forwarded-For` funcionar nos testes).
2. `ContractAcceptanceService`:
   - `resolveToken(orgId, token)`: `isUuid(orgId)` senão `NotFoundException`; `runWithTenant(orgId)`: `contract_access_tokens WHERE token_hash = hashToken(token)` com `revoked_at IS NULL AND expires_at > now()` e contrato `status <> 'cancelled'`; qualquer falha → `NotFoundException('Link inválido ou expirado.')` (mesma mensagem sempre — sem oráculo).
   - `view(orgId, token)` → `{ orgName (organizations.trade_name), code, eventDate, version, text: rendered_text da versão do token, textSha256, accepted: boolean (existe aceite da versão do token), acceptedAt, acceptedName, isCurrentVersion, expiresAt }`. Se a versão do token não é a atual → 404 (token deveria ter sido revogado).
   - `accept(orgId, token, body: { fullName; cpf; accepted; textSha256 }, meta: { ip; userAgent })`: `fullName.trim()` 3..255 (`INVALID_NAME`, 422); `validateCpf` (`INVALID_CPF`, 422); `accepted === true` (`NOT_ACCEPTED`, 422); dentro de `runWithTenant`: resolve token, `lockContract`; versão do token ≠ `current_version` → 404; `textSha256` ≠ hash da versão → 409 `TEXT_CHANGED`; já existe aceite da versão → 409 `ALREADY_ACCEPTED`; se a cliente noiva tem CPF cadastrado e `normalizeCpf` difere → 422 `CPF_MISMATCH`; INSERT em `contract_acceptances` (`accepted_cpf = normalizeCpf`, `ip`, `user_agent` truncado a 1000, `text_sha256`); `contracts` → `status 'active'`, `accepted_version = current_version`, `accepted_at = now()`; `recordAudit('contract.accept', metadata { version, ip })`. P2002 em `uq_ca_version` (corrida) → 409 `ALREADY_ACCEPTED`. Erros 4xx com corpo `{ code, message }`.
3. `PublicContractController` (`@Public()`, `@Controller('public/contracts')`, `@UseGuards(ThrottlerGuard)`): `GET :orgId/:token` → view; `POST :orgId/:token/accept` com `@Throttle({ default: { limit: 5, ttl: 60_000 } })` → accept (IP = `req.ip`, UA = `req.headers['user-agent']`); `GET :orgId/:token/pdf` → só se aceito, stream `application/pdf` com `Content-Disposition: attachment; filename="contrato-<code>.pdf"` (Task 2). Em todas as respostas: `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`.
4. `ContractAcceptanceModule`: `imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])]`, controllers `[PublicContractController]`, providers `[ContractAcceptanceService, ContractPdfService, ContractDocumentsResolver]` (os dois últimos na Task 2). Throttler NÃO global (não registrar `APP_GUARD`).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend test:integration -- phase3-fixtures</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "trustProxy: true" apps/backend/src/http/fastify-adapter.ts` encontra; `grep -n "createFastifyAdapter" apps/backend/src/main.ts apps/backend/test/integration/helpers/phase3-fixtures.ts` encontra nos 2
    - `grep -n "@Public()" apps/backend/src/contracts/acceptance/public-contract.controller.ts` encontra
    - `grep -n "APP_GUARD" apps/backend/src/contracts/acceptance/contract-acceptance.module.ts` não encontra
    - `grep -n "no-store" apps/backend/src/contracts/acceptance/public-contract.controller.ts` encontra
  </acceptance_criteria>
  <done>Rota pública segura (token com hash, 404 genérico, rate limit, IP real) gravando aceite append-only.</done>
</task>

<task type="auto">
  <name>Task 2: PDF (pdfkit) público e do dono + suítes de aceite e rate limit</name>
  <files>apps/backend/src/contracts/acceptance/contract-pdf.service.ts, apps/backend/src/contracts/acceptance/contract-pdf.service.spec.ts, apps/backend/src/contracts/acceptance/contract-documents.resolver.ts, apps/backend/src/graphql/schema/contract-documents.graphql, apps/backend/test/integration/phase4-public-acceptance.e2e.spec.ts, apps/backend/test/integration/phase4-public-ratelimit.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/contracts/acceptance/contract-acceptance.service.ts (Task 1)
    - apps/backend/test/integration/helpers/phase4-fixtures.ts
    - apps/backend/src/contracts/contracts.service.ts (generateLink — para obter token em claro nos testes)
  </read_first>
  <action>
1. `ContractPdfService.render({ orgName, code, text, acceptance: { name, cpfMasked, acceptedAtLocal, ip, sha256, version } | null }): Promise<Buffer>` com `pdfkit` (A4, margens 56, Helvetica 11, título em Helvetica-Bold 14 com `orgName` + "Contrato <code>"), corpo = `text` (texto puro), e bloco final "Aceite digital" (nome, CPF mascarado, data/hora no fuso da org `dd/MM/yyyy HH:mm`, IP, versão, "SHA-256: <hash>"); rodapé com hash em todas as páginas. Coletar `doc.on('data')` em Buffer. Spec unit: buffer começa com `%PDF-` e tem > 1000 bytes; texto com acentos ("Cláusula, ação, noiva") não lança.
2. `contract-documents.graphql`: `type ContractPdf { filename: String!  base64: String! }` + `extend type Query { contractPdf(id: UUID!): ContractPdf }` (null se não houver aceite da versão atual — o dono pode baixar só o aceito; se `acceptedVersion` existir mas não for a atual, gerar o PDF da versão aceita com aviso "Versão aceita v<n>"). `ContractDocumentsResolver` com `CONTRACT_READ`.
3. Ligar o `GET .../pdf` do controller ao service.
4. **phase4-public-acceptance** (supertest em `w.app.getHttpServer()`): criar grupo/contrato via mutations (04-06) e `generateContractLink` → extrair token da URL. Casos: GET válido → 200 com `text`, `textSha256` e headers `cache-control: no-store`; token inválido → 404; `orgId` de outra org com token válido → 404 (não vaza); `orgId` não-UUID → 404; expirado (adminPrisma `UPDATE expires_at = now() - interval '1 minute'`) → 404; POST com CPF inválido → 422 `INVALID_CPF`; com hash errado → 409 `TEXT_CHANGED`; válido com header `X-Forwarded-For: 203.0.113.7` → 200, linha em `contract_acceptances` com `ip = '203.0.113.7'`, `text_sha256` = hash da versão, contrato `active`/`acceptedVersion 1`; segundo POST → 409 `ALREADY_ACCEPTED`; `appPrisma` (sgs_app) `UPDATE contract_acceptances` → permission denied; `updateContract` → token antigo 404, novo link exige novo aceite (`needsAcceptance true`); GET pdf antes do aceite → 404, depois → 200 `application/pdf`; `contractPdf(id)` GraphQL devolve base64 que decodifica para `%PDF-`; `audit_log` tem `contract.accept`.
5. **phase4-public-ratelimit:** 5 POSTs de aceite inválidos seguidos do mesmo IP → 422; o 6º → 429. GETs: 20 ok, 21º → 429.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- contract-pdf && corepack pnpm --filter @sgs/backend test:integration -- phase4-public-acceptance phase4-public-ratelimit</automated>
  </verify>
  <acceptance_criteria>
    - Suítes e spec verdes
    - `grep -n "203.0.113.7" apps/backend/test/integration/phase4-public-acceptance.e2e.spec.ts` encontra
    - `grep -n "429" apps/backend/test/integration/phase4-public-ratelimit.e2e.spec.ts` encontra
    - `grep -n "contractPdf(id: UUID!): ContractPdf" apps/backend/src/graphql/schema/contract-documents.graphql` encontra
  </acceptance_criteria>
  <done>D-15/D-16/D-23 provados por integração; PDF disponível após aceite.</done>
</task>

<task type="auto">
  <name>Task 3: Página pública de aceite (frontend)</name>
  <files>apps/frontend/vite.config.ts, apps/frontend/src/features/bridal/api/public-contract.api.ts, apps/frontend/src/features/bridal/public/ContractAcceptPage.tsx, apps/frontend/src/features/bridal/__tests__/contract-accept-page.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/bridal/public/ContractAcceptPage.tsx (casca do 04-04)
    - apps/frontend/vite.config.ts (proxy /graphql)
    - apps/frontend/src/infrastructure/apollo/client.ts (VITE_API_URL)
    - apps/frontend/src/features/operations/lib/input-masks.ts (máscara de CPF, se existir; senão a de clientes)
  </read_first>
  <action>
1. `vite.config.ts`: adicionar proxy `'/public'` para o mesmo target de `/graphql`.
2. `public-contract.api.ts`: `const base = import.meta.env.VITE_API_URL ?? ''`; `fetchPublicContract(orgId, token)`, `acceptPublicContract(orgId, token, body)`, `publicContractPdfUrl(orgId, token)`; erros: lança `PublicContractError { status, code, message }` lendo o JSON `{ code, message }`.
3. `ContractAcceptPage.tsx` (fora do AppShell; sem Apollo/auth store): estados carregando / erro 404 ("Este link é inválido ou expirou. Peça um novo link ao estúdio.") / contrato. Mostra `orgName`, `Contrato <code>`, texto em `<div className="whitespace-pre-wrap">` (NUNCA `dangerouslySetInnerHTML`), campos "Nome completo" e "CPF" (máscara `000.000.000-00`, validação de dígitos no cliente com a mesma regra de `validateCpf` — copiar a função para `features/bridal/lib/cpf.ts` se não houver equivalente no frontend), checkbox "Li e aceito os termos deste contrato", botão "Aceito" desabilitado até tudo válido; envia `textSha256` recebido. Sucesso ou `accepted` já true → tela "Contrato aceito em <data>" + botão "Baixar PDF" (link para `publicContractPdfUrl`). 409 `TEXT_CHANGED` → "O contrato foi atualizado. Recarregue a página para ler a nova versão."; 429 → "Muitas tentativas. Aguarde um minuto."; 422 → mensagem do servidor no campo. Acessibilidade: `label` em todos os campos, foco no primeiro erro, `aria-live="polite"` no status.
4. Teste vitest (mock de `fetch`): renderiza texto e desabilita botão sem CPF válido; envio correto chama POST com `textSha256` e mostra "Contrato aceito"; 404 mostra mensagem de link inválido; 409 mostra aviso de atualização.
5. Staging: confirmar se o nginx do VPS que serve o SGS encaminha `/public/` ao backend (`grep -rn "location" /etc/nginx/sites-enabled/*sgs* 2>/dev/null`); se só `/graphql` for encaminhado, adicionar `location /public/ { proxy_pass <mesmo upstream do /graphql>; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Real-IP $remote_addr; }`, `nginx -t && systemctl reload nginx`, e registrar no SUMMARY. Se o host não for acessível desta máquina, registrar como pendência de deploy no SUMMARY.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- contract-accept-page && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "dangerouslySetInnerHTML" apps/frontend/src/features/bridal/public/ContractAcceptPage.tsx` não encontra
    - `grep -n "whitespace-pre-wrap" apps/frontend/src/features/bridal/public/ContractAcceptPage.tsx` encontra
    - `grep -n "'/public'" apps/frontend/vite.config.ts` encontra
    - Teste vitest verde
  </acceptance_criteria>
  <done>Noiva aceita o contrato pelo link público e baixa o PDF.</done>
</task>

</tasks>

<verification>`corepack pnpm --filter @sgs/backend test:integration -- phase4-public` verde; frontend verde. Manual (VALIDATION): IP real no staging ≠ 127.0.0.1; layout do PDF.</verification>

<success_criteria>Aceite digital por link com evidência (IP, UA, hash) imutável e PDF, sem vazar entre orgs.</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-09-SUMMARY.md`
</output>
