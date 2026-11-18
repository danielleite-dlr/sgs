---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 14
type: execute
wave: 4
depends_on: ["09-03", "09-10"]
files_modified:
  - apps/frontend/src/features/commercial/api/intake.api.ts
  - apps/frontend/src/features/commercial/api/public-lead.api.ts
  - apps/frontend/src/features/commercial/components/LeadImportDialog.tsx
  - apps/frontend/src/features/commercial/components/FormSettingsTab.tsx
  - apps/frontend/src/features/commercial/public/PublicLeadFormPage.tsx
  - apps/frontend/nginx.conf
  - apps/frontend/src/features/commercial/__tests__/lead-import-dialog.test.tsx
  - apps/frontend/src/features/commercial/__tests__/form-settings-tab.test.tsx
  - apps/frontend/src/features/commercial/__tests__/public-lead-form.test.tsx
autonomous: true
requirements: [COM-02, COM-03]

must_haves:
  truths:
    - "Importar planilha: escolher .xlsx/.csv (até 2,5 MB), ver a prévia (válidas, inválidas com motivo, duplicadas marcadas 'já é cliente'/'lead existente'), ADMIN/MANAGER escolhem responsável, e confirmar mostra quantos leads e negócios foram criados (D-04)"
    - "A aba 'Formulário do site' (ADMIN/MANAGER) liga/desliga o formulário, escolhe responsável padrão, edita mensagem e texto de consentimento, mostra o link público e o código <iframe> para copiar, e regera o token com confirmação"
    - "A página pública /contato/:orgId/:token (sem login) mostra o nome do salão, pede nome, telefone, e-mail opcional, Noiva/Debutante, data do evento, mensagem e o consentimento LGPD obrigatório, tem campo honeypot oculto e mostra a mensagem de sucesso; token inválido mostra 'Formulário indisponível'"
    - "A página pública pode ser embutida em iframe no site do salão: /contato/ sai com Content-Security-Policy frame-ancestors * e sem X-Frame-Options; o resto do app continua SAMEORIGIN"
  artifacts:
    - path: "apps/frontend/src/features/commercial/public/PublicLeadFormPage.tsx"
      provides: "formulário público"
      contains: "consent"
    - path: "apps/frontend/nginx.conf"
      provides: "location ^~ /contato/ com frame-ancestors"
      contains: "frame-ancestors"
    - path: "apps/frontend/src/features/commercial/components/LeadImportDialog.tsx"
      provides: "importação com prévia"
      exports: ["LeadImportDialog", "LeadImportDialogProps"]
  key_links:
    - from: "apps/frontend/src/features/commercial/public/PublicLeadFormPage.tsx"
      to: "/public/leads/:orgId/:token"
      via: "fetch same-origin"
      pattern: "/public/leads/"
    - from: "apps/frontend/src/features/commercial/components/LeadImportDialog.tsx"
      to: "previewCommercialLeadImport / importCommercialLeads"
      via: "FileReader → base64"
      pattern: "PreviewCommercialLeadImportMutation"
---

<objective>
Telas das entradas externas: diálogo de importação com prévia, aba de configuração do formulário do site, página pública do formulário, e o ajuste do nginx do container do frontend para permitir o iframe só em `/contato/`.

Purpose: COM-02 e COM-03 no navegador. Resolve o item "não verificado" de `frame-ancestors`.
Output: 2 APIs, 3 componentes/páginas, `nginx.conf`, 3 testes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-03-SUMMARY.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-10-SUMMARY.md

**Ambiente de execução:** igual ao 09-01. Referência: `/root/atmo-crm/atmos-crm/src/components/settings/WidgetSettings.tsx`.

**Verificado no planejamento (nginx):** o nginx do HOST (`infra/nginx/sgs-staging.conf`) não manda `X-Frame-Options`; quem manda é o nginx do CONTAINER do frontend (`apps/frontend/nginx.conf`), com `add_header X-Frame-Options "SAMEORIGIN" always;` no `server` e repetido em cada `location` (um `add_header` dentro de `location` cancela os herdados). O fallback SPA `location /` faz `try_files $uri $uri/ /index.html`, que redireciona internamente para `location = /index.html` (SAMEORIGIN). Por isso a rota pública precisa de um `location ^~ /contato/` próprio que sirva o `index.html` SEM redirecionamento interno (`try_files /index.html =404;` — o primeiro argumento encontrado é servido no próprio location). Os assets (`.js/.css`) continuarem com SAMEORIGIN não atrapalha (o cabeçalho só vale para documento). O host não precisa mudar.

<interfaces>
Backend 09-10: `previewCommercialLeadImport(base64, filename)` → `{ totalRows valid { line fullName phone email kind eventDate source notes duplicateOf { type id name } } invalid { line reason } errors }`; `importCommercialLeads(base64, filename, assigneeMemberId)` → `{ createdLeads createdDeals linkedClients skipped errors }`; `commercialFormSettings` → `{ isActive token publicPath defaultAssignee { id displayName } successMessage consentText consentTextVersion }`; `updateCommercialFormSettings(input { isActive defaultAssigneeMemberId clearDefaultAssignee successMessage consentText })`; `regenerateCommercialFormToken`.
REST público: `GET /public/leads/:orgId/:token` → 200 `{ orgName, consentText, consentTextVersion, successMessage }` | 404; `POST` mesmo caminho com `{ fullName, phone, email?, kind, eventDate?, message?, consent: true, website: '' }` → 201 `{ ok, message }` | 400 `{ code, message }` | 429.
Modelo de cliente REST: `features/bridal/api/public-contract.api.ts` (fetch sem Apollo). Modelo de página pública fora do AppShell: `features/bridal/public/ContractAcceptPage.tsx`.
Do 09-03: `LeadImportDialogProps { open; onOpenChange; onImported?(count) }`, `FormSettingsTab()` (montado na aba `formulario` de `CommercialSettingsPage`), `useCommercialAccess()`. Do 09-04: `CommercialAssigneesQuery` está em `leads.api.ts` do 09-11 (onda paralela): NÃO importar de lá; declarar a query `CommercialAssigneesForIntake` em `intake.api.ts`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Diálogo de importação com prévia</name>
  <files>apps/frontend/src/features/commercial/api/intake.api.ts, apps/frontend/src/features/commercial/components/LeadImportDialog.tsx, apps/frontend/src/features/commercial/__tests__/lead-import-dialog.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/commercial/components/LeadImportDialog.tsx (placeholder com a assinatura)
    - apps/frontend/src/features/bridal/components/LetterheadUpload.tsx (arquivo → base64, limite de tamanho)
    - apps/backend/src/graphql/schema/commercial-intake.graphql
  </read_first>
  <behavior>
    - arquivo .pdf ou maior que 2.500.000 bytes mostra erro local ('Use um arquivo .xlsx ou .csv' / 'Arquivo maior que 2,5 MB') sem chamar a API
    - arquivo válido chama previewCommercialLeadImport com base64 sem o prefixo data: e o nome; mostra 'N válidas', 'M com problema' (lista linha + motivo) e marca duplicadas com 'Já é cliente: X' ou 'Lead existente: Y'
    - como MANAGER mostra select 'Responsável dos negócios' com opção 'Sem responsável' (padrão, D-20); como ATTENDANT não mostra
    - 'Importar' chama importCommercialLeads e mostra '3 leads e 2 negócios criados, 1 ignorado'; chama onImported(3) e fecha
    - errors da prévia (ex.: HEADER_MISSING) aparecem no diálogo
    - texto de ajuda lista as colunas aceitas: Nome, Telefone, E-mail, Tipo (noiva/debutante), Data do evento, Origem, Observações
  </behavior>
  <action>`intake.api.ts` com os documentos do backend 09-10 (+ `CommercialAssigneesForIntake`). `LeadImportDialog` substitui o placeholder mantendo `LeadImportDialogProps`; passos 'Escolher arquivo' → 'Prévia' → 'Resultado'; `FileReader.readAsDataURL` e corte em `,`. Teste do `<behavior>`. Commit `feat(09-14): importação de leads por planilha`.</action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/commercial/__tests__/lead-import-dialog.test.tsx && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "2_500_000\|2500000" apps/frontend/src/features/commercial/components/LeadImportDialog.tsx` encontra
    - `grep -n "PreviewCommercialLeadImportMutation" apps/frontend/src/features/commercial/components/LeadImportDialog.tsx` encontra
    - `grep -n "return null" apps/frontend/src/features/commercial/components/LeadImportDialog.tsx` vazio
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Importação pela tela com prévia.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Aba do formulário, página pública e nginx</name>
  <files>apps/frontend/src/features/commercial/api/public-lead.api.ts, apps/frontend/src/features/commercial/components/FormSettingsTab.tsx, apps/frontend/src/features/commercial/public/PublicLeadFormPage.tsx, apps/frontend/nginx.conf, apps/frontend/src/features/commercial/__tests__/form-settings-tab.test.tsx, apps/frontend/src/features/commercial/__tests__/public-lead-form.test.tsx</files>
  <read_first>
    - apps/frontend/nginx.conf
    - apps/frontend/src/features/bridal/api/public-contract.api.ts
    - apps/frontend/src/features/bridal/public/ContractAcceptPage.tsx
    - apps/frontend/src/features/commercial/components/FormSettingsTab.tsx (placeholder)
    - scripts/check-pwa-headers.sh (o que já é conferido no container)
  </read_first>
  <behavior>
    - FormSettingsTab: switch 'Formulário ativo' chama updateCommercialFormSettings({ isActive }); mostra o link `${window.location.origin}${publicPath}` e o código `<iframe src="..." width="100%" height="720" style="border:0" title="Formulário de contato"></iframe>` com botões 'Copiar link' e 'Copiar código'; 'Gerar novo link' pede confirmação ('O link antigo deixa de funcionar') e chama regenerateCommercialFormToken; responsável padrão (select) e textos com contador
    - PublicLeadFormPage: GET 404 mostra 'Formulário indisponível'; GET OK mostra o nome do salão e o texto de consentimento; enviar sem marcar consentimento mostra 'É preciso autorizar o contato' sem chamar o POST
    - campo honeypot 'website' existe, fora da tela (classe sr-only não serve: usar position absolute/left -10000px), com tabIndex -1 e autocomplete off, e vai vazio no POST
    - POST 201 mostra a message do backend; 400 mostra a message; 429 mostra 'Muitas tentativas. Tente de novo em um minuto.'
    - com ?embed=1 a página não mostra cabeçalho nem rodapé (só o formulário)
  </behavior>
  <action>
1. `public-lead.api.ts`: `fetchPublicLeadForm(orgId, token)` e `submitPublicLead(orgId, token, body)` com `fetch('/public/leads/' + encodeURIComponent(orgId) + '/' + encodeURIComponent(token), ...)`, tipos e tratamento de 404/400/429.
2. `FormSettingsTab.tsx` e `PublicLeadFormPage.tsx` conforme o `<behavior>`; página pública com tokens visuais Gestor Beauty, campos de 44 px, rótulos visíveis, mensagens com `role="alert"` (WCAG).
3. `apps/frontend/nginx.conf`: antes de `location /`, acrescentar:
```nginx
    # Fase 9: formulário público do Comercial pode ser embutido (iframe) no site do salão.
    # Serve o index.html aqui mesmo (sem redirecionar para "location = /index.html", que
    # manda SAMEORIGIN) e troca X-Frame-Options por CSP frame-ancestors só nesta rota.
    location ^~ /contato/ {
        try_files /index.html =404;
        add_header Cache-Control "no-cache" always;
        add_header Content-Security-Policy "frame-ancestors *" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }
```
4. Conferir no container: `docker build -t sgs-fe-contato-check -f apps/frontend/Dockerfile .` (conferir o contexto de build usado em `docker-compose.staging.yml`), `docker run -d --rm --name sgs-fe-contato-check -p 127.0.0.1:8098:80 sgs-fe-contato-check`, `curl -sI http://127.0.0.1:8098/contato/x/y` tem `content-security-policy: frame-ancestors *` e NÃO tem `x-frame-options`; `curl -sI http://127.0.0.1:8098/agenda` continua com `x-frame-options: SAMEORIGIN`; `./scripts/check-pwa-headers.sh http://127.0.0.1:8098` continua verde; `docker stop sgs-fe-contato-check`.
5. Testes do `<behavior>` (mock de `fetch`). Commit `feat(09-14): formulário do site e página pública embutível`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/commercial && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint && grep -n "frame-ancestors \*" apps/frontend/nginx.conf</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "location ^~ /contato/" apps/frontend/nginx.conf` encontra e `grep -n "try_files /index.html =404;" apps/frontend/nginx.conf` encontra
    - `awk '/location \^~ \/contato\//,/}/' apps/frontend/nginx.conf | grep -c "X-Frame-Options"` = 0
    - `grep -c 'X-Frame-Options "SAMEORIGIN"' apps/frontend/nginx.conf` igual ao de antes (6)
    - curl no container (passo 4) com `frame-ancestors *` em `/contato/x/y` e `SAMEORIGIN` em `/agenda` (registrar a saída no SUMMARY)
    - `grep -n "website" apps/frontend/src/features/commercial/public/PublicLeadFormPage.tsx` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Formulário configurável, página pública e iframe liberado só onde precisa.</done>
</task>

</tasks>

<verification>
`vitest run src/features/commercial`, typecheck, lint e conferência de cabeçalhos no container.
</verification>

<success_criteria>
Leads entram pelo site (inclusive embutido) e por planilha, pela tela.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-14-SUMMARY.md`
</output>
