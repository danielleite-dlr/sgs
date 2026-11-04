---
phase: 04-bridal-contracts
plan: 09
subsystem: contracts-acceptance
tags: [nestjs, fastify, throttler, pdfkit, react, public-route]
requires: [04-04, 04-06]
provides:
  - "REST público GET/POST /public/contracts/:orgId/:token[/accept|/pdf]"
  - "createFastifyAdapter (trustProxy) compartilhado por main.ts e testes"
  - "ContractPdfService (pdfkit) e query GraphQL contractPdf(id)"
  - "Página pública /aceite/:orgId/:token funcional"
affects: [04-14, 04-15]
tech-stack:
  added: []
  patterns:
    - "ThrottlerGuard local ao controller (não global), 5 POST/min e 20 req/min por IP"
    - "Erros 4xx públicos com corpo { code, message }; 404 genérico sem oráculo"
key-files:
  created:
    - apps/backend/src/http/fastify-adapter.ts
    - apps/backend/src/contracts/acceptance/contract-acceptance.service.ts
    - apps/backend/src/contracts/acceptance/public-contract.controller.ts
    - apps/backend/src/contracts/acceptance/contract-pdf.service.ts
    - apps/backend/src/contracts/acceptance/contract-pdf.service.spec.ts
    - apps/backend/src/contracts/acceptance/contract-documents.resolver.ts
    - apps/backend/src/graphql/schema/contract-documents.graphql
    - apps/backend/test/integration/phase4-public-acceptance.e2e.spec.ts
    - apps/backend/test/integration/phase4-public-ratelimit.e2e.spec.ts
    - apps/frontend/src/features/bridal/api/public-contract.api.ts
    - apps/frontend/src/features/bridal/__tests__/contract-accept-page.test.tsx
  modified:
    - apps/backend/src/main.ts
    - apps/backend/src/contracts/acceptance/contract-acceptance.module.ts
    - apps/backend/test/integration/helpers/phase3-fixtures.ts
    - apps/frontend/vite.config.ts
    - apps/frontend/src/features/bridal/public/ContractAcceptPage.tsx
    - infra/nginx/sgs-staging.conf
key-decisions:
  - "O orgId do path resolve o tenant via runWithTenant (sem SECURITY DEFINER); orgId não-UUID, token inexistente/expirado/revogado e org errada dão o mesmo 404."
  - "O token não é revogado no aceite: o PDF público depende dele (vale até expirar ou o contrato ser editado/cancelado)."
  - "Frontend reutiliza validateCpf/formatCpf de features/clients/utils/cpf em vez de criar features/bridal/lib/cpf.ts."
  - "Cabeçalhos no-store/noindex/no-referrer aplicados às respostas de sucesso por decorator composto (Header só existe em método)."
metrics:
  tasks: 3
  completed: 2026-11-04
---

# Phase 4 Plan 09: Aceite público e PDF Summary

Aceite digital por link público com evidência imutável (IP real via trustProxy, user-agent, sha256 do texto), rate limit por IP, PDF via pdfkit (link público após aceite e base64 para o dono) e a página React pública de aceite.

## O que foi feito

- **Task 1:** `createFastifyAdapter({ logger })` com `trustProxy: true` usado em `main.ts` e `phase3-fixtures.ts`. `ContractAcceptanceService` (view, accept, dados de PDF), `PublicContractController` (`@Public()`, `ThrottlerGuard` local, `@Throttle` 5/min no aceite) e `ContractAcceptanceModule` (Throttler 20/min, sem `APP_GUARD`).
- **Task 2:** `ContractPdfService` (A4, rodapé com hash em todas as páginas, bloco de aceite), query `contractPdf(id: UUID!): ContractPdf` (`CONTRACT_READ`; versão aceita com aviso quando há alterações posteriores), spec unitário e duas suítes de integração.
- **Task 3:** proxy `/public` no Vite, `public-contract.api.ts` (fetch + `PublicContractError`), `ContractAcceptPage` (texto em `whitespace-pre-wrap`, máscara/validação de CPF, estados 404/409/429/422, `aria-live`, foco no erro) e 5 testes vitest.

## Verificação

- Backend: lint, typecheck, 194 testes unit; integração `phase4-public` (10 testes), `phase4-contracts-core`, `phase4-notifications`, `phase3-comanda-*` verdes.
- Frontend: lint, typecheck e vitest verdes.

## Deviations from Plan

**1. [Rule 3 - Bloqueio] `fastify` não é dependência direta do backend**
- O controller usa interfaces estruturais mínimas (`HttpReq`, `HttpRes`) em vez de tipos do `fastify`.
- Commit: faf1044

**2. [Escolha] CPF no frontend** reaproveita `features/clients/utils/cpf.ts` (espelha o backend), sem criar `features/bridal/lib/cpf.ts`.

**3. [Escolha] Commits do backend** em dois (código + testes) porque o módulo da Task 1 referencia o PDF/resolver da Task 2 e não compilaria isolado.

## Pendência de deploy (nginx do staging)

O vhost `sgs-staging` é symlink para `infra/nginx/sgs-staging.conf` do checkout principal e só encaminhava `/graphql` e `/health`. Adicionado `location /public/` (mesmo upstream 127.0.0.1:3010, com `X-Forwarded-For`/`X-Real-IP`) **no arquivo versionado**, sem recarregar o nginx (sem deploy nesta execução). Após o merge e atualização de `/root/sgs`: `nginx -t && systemctl reload nginx`, e validar manualmente que o IP gravado no aceite não é 127.0.0.1.

## Known Stubs

Nenhum.

## Verificação manual restante (VALIDATION)

IP real no staging; layout visual do PDF.

## Self-Check: PASSED
