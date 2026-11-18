---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 10
subsystem: backend/commercial
tags: [importacao, planilha, formulario-publico, lgpd, throttler, rbac]
requires: [09-04]
provides:
  - parseLeadSheet, normalizePersonName, matchAssignee, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS
  - CommercialImportService (prévia e importação)
  - CommercialFormSettingsService e ensureFormSettingsTx
  - GET/POST /public/leads/:orgId/:token
  - commercial-intake.graphql (previewCommercialLeadImport, importCommercialLeads, commercialFormSettings, updateCommercialFormSettings, regenerateCommercialFormToken)
affects: [09-14, 09-15, 09-16]
key-files:
  created:
    - apps/backend/src/commercial/lead-sheet.ts
    - apps/backend/src/commercial/lead-sheet.spec.ts
    - apps/backend/src/commercial/commercial-import.service.ts
    - apps/backend/src/commercial/commercial-form-settings.service.ts
    - apps/backend/src/commercial/public-lead.service.ts
    - apps/backend/src/commercial/public-lead.controller.ts
    - apps/backend/src/commercial/commercial-intake.resolver.ts
    - apps/backend/src/graphql/schema/commercial-intake.graphql
    - apps/backend/test/integration/phase9-import.e2e.spec.ts
    - apps/backend/test/integration/phase9-public-form.e2e.spec.ts
  modified:
    - apps/backend/src/commercial/commercial-intake.module.ts
decisions:
  - "CSV lido por parser próprio (aspas, ; ou , pela primeira linha, BOM removido) em vez de exceljs: o exceljs converte números e datas e perderia zeros e formatos."
  - "Na importação, lead duplicado de lead é pulado; duplicado de cliente é criado e ligado à cliente. Atendente que importa só vê duplicidade de leads que ela enxerga na prévia, mas a gravação também pula lead que ela não vê (sem vazar quem é)."
  - "Negócio só nasce quando a linha tem tipo (deals.kind é NOT NULL); data sozinha não cria negócio."
  - "Reenvio do site em 30 min só vale quando o lead existente é de origem 'site'; lead antigo de outra origem é reusado e ganha negócio novo se não houver um aberto do mesmo tipo."
  - "Duplicidade do formulário público usa telefone ou e-mail (mesma regra do findDuplicatesTx)."
metrics:
  tasks: 2
  completed: 2026-11-18
---

# Phase 9 Plan 10: Backend de formulário e importação Summary

Importação de planilha .xlsx/.csv com prévia (válidas, inválidas com motivo, duplicadas e responsável casado por e-mail ou nome, D-22) e formulário público do site com token em tempo constante, consentimento LGPD, honeypot e limite de 5 envios por minuto por IP.

## Tarefas

1. **Importação** (`f16c96c` teste unitário, `48e39b0` implementação): parser puro com limites de 2,5 MB e 2.000 linhas; fórmulas lidas como texto; prévia e gravação numa única transação de 60 s; `assignee_member_id` do negócio e `created_by` do lead recebem o responsável casado, sem casamento ficam nulos (fila D-20) com o aviso `responsável não encontrado: <valor>`; PROFESSIONAL e membros inativos nunca casam; a mutação não aceita `assigneeMemberId`.
2. **Formulário** (`feat(09-10): formulário do site com LGPD e anti-spam`): configuração só para COMMERCIAL_MANAGE (cria na primeira leitura, token `randomBytes(32)` base64url, regenerar, versão do consentimento sobe ao mudar o texto); controller público com `@UseGuards(ThrottlerGuard)` sem novo `forRoot`; todo erro de acesso é o mesmo 404; nada de telefone ou e-mail em log.

## Verificação

- unit `lead-sheet` (15 testes) verde.
- `phase9-import` (5), `phase9-public-form` (12), `phase4-public-acceptance` e `phase4-public-ratelimit` verdes.
- typecheck e eslint do backend limpos nos arquivos novos.

## Deviations from Plan

- **[Rule 1 - ajuste de desenho]** CSV com parser próprio em vez de `wb.csv.read` do exceljs (ver decisões). Sem mudança de comportamento exigido pelo plano.
- A mutação do formulário não recebe IP no serviço (`submit(orgId, token, body)`): o IP só serve ao ThrottlerGuard e nunca é gravado.
- Código novo de erro de formulário: `CONSENT_TEXT_INVALID` (texto de consentimento vazio ou acima de 2000), `DATE_INVALID`, `EMAIL_INVALID` no POST público.

## Notas para os próximos planos

- Rota pública do site: `/public/leads/:orgId/:token` (GET devolve `orgName`, `consentText`, `consentTextVersion`, `successMessage`; POST `{ fullName, phone, email?, kind, eventDate? 'YYYY-MM-DD', message?, consent: true, website: '' }`). A página do site (`publicPath` = `/contato/{orgId}/{token}`) é do frontend (09-14).
- Erros de validação do POST vêm como `{ code, message }` com HTTP 400.

## Known Stubs

Nenhum.

## Self-Check: PASSED

Arquivos conferidos no disco e commits f16c96c, 48e39b0 e o commit do formulário presentes no git log.
