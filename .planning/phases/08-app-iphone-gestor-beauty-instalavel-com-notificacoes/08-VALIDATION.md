---
phase: 8
slug: app-iphone-gestor-beauty-instalavel-com-notificacoes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-17
---

# Phase 8 — Validation Strategy

> Contrato de validação da fase. Fonte: seção "Arquitetura de validação" de 08-RESEARCH.md.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29 (backend unit e integração com Postgres real), vitest 2 + jsdom (frontend), Playwright (apps/e2e) |
| **Config file** | `apps/backend/jest.config.ts`, `apps/backend/jest-integration.config.ts`, `apps/frontend/vitest.config.ts`, `apps/e2e/playwright.config.ts` |
| **Quick run command** | `corepack pnpm --filter @sgs/backend test -- push` e `corepack pnpm --filter @sgs/frontend test -- webpush native login` |
| **Full suite command** | gate do projeto: lint + typecheck + jest unit + `test:integration` + vitest; E2E `corepack pnpm --filter @sgs/e2e test:e2e` |
| **Estimated runtime** | ~60 s rápido; ~15 min gate completo |

---

## Sampling Rate

- **After every task commit:** testes do pacote tocado (comando rápido)
- **After every plan wave:** unit completo dos dois pacotes + integração de push/device tokens + typecheck e lint
- **Before `/gsd:verify-work`:** gate completo verde, deploy no staging, `scripts/check-pwa-headers.sh` contra o staging
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Mapa por decisão (os IDs de tarefa são preenchidos pelo planner nos PLAN.md):

| Decisão | Comportamento | Test Type | Automated Command | File Exists | Status |
|---------|---------------|-----------|-------------------|-------------|--------|
| D-01 | Botão "Instalar no iPhone" só em iPhone/iPad fora do standalone; passo a passo; aviso fora do Safari | unit | `pnpm --filter @sgs/frontend test -- login-instalar-iphone platform-ios` | ❌ W0 | ⬜ pending |
| D-02 | Manifest válido, ícones em `public/`, `<link rel=manifest>` e `apple-touch-icon` | unit + E2E | `pnpm --filter @sgs/frontend test -- manifest`; `apps/e2e/tests/pwa-instalavel.spec.ts` | ❌ W0 | ⬜ pending |
| D-03 | `sw.js` sem cache nem handler de `fetch` | unit | `pnpm --filter @sgs/frontend test -- service-worker` | ❌ W0 | ⬜ pending |
| D-04 | `push` sempre chama `showNotification`; `notificationclick` só em rota permitida; paridade da regex | unit | idem + `webpush-bridge` | ❌ W0 | ⬜ pending |
| D-05 | Estados do botão "Ativar notificações" e registro `provider:'webpush'`, `platform:'ios'` | unit | `pnpm --filter @sgs/frontend test -- enable-notifications` | ❌ W0 | ⬜ pending |
| D-06 | Logout remove o registro e faz `unsubscribe()` | unit | `pnpm --filter @sgs/frontend test -- useAuth-logout device-token-api` | ✅ estender | ⬜ pending |
| D-07 | No Capacitor nativo nada de Web Push roda | unit | `pnpm --filter @sgs/frontend test -- native-app-bridge` | ✅ estender | ⬜ pending |
| D-08 | `WebPushProvider` e `PushService.dispatch` com dois canais; registro `webpush` com chaves, RLS e anti-SSRF; migration | unit + integração | `pnpm --filter @sgs/backend test -- push web-push`; `test:integration -- device-tokens push-dispatch` | ❌ W0 / ✅ estender | ⬜ pending |
| D-09 | 404/410 → inscrição removida; 429/5xx/rede retentável | unit + integração | `pnpm --filter @sgs/backend test -- web-push.provider`; `test:integration -- push-dispatch` | ❌ W0 / ✅ estender | ⬜ pending |
| D-10 | Sem VAPID → canal desligado e boot normal; `pushConfig.webPushPublicKey`; chaves fora do log | unit + integração | `pnpm --filter @sgs/backend test -- web-push-credentials`; `test:integration -- push-config` | ❌ W0 | ⬜ pending |
| D-11 | Container serve `sw.js` e manifest com `no-cache` e tipo certo | infra | `scripts/check-pwa-headers.sh` (imagem local e staging) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/src/push/web-push.provider.spec.ts`
- [ ] spec das credenciais VAPID (`web-push-credentials`)
- [ ] estender `push.processor.spec.ts` / `device-tokens.service.spec.ts` e as integrações `device-tokens.e2e.spec.ts`, `push-dispatch.e2e.spec.ts`
- [ ] `apps/frontend/src/infrastructure/webpush/__tests__/*` (plataforma, botão, bridge, SW, manifest)
- [ ] `apps/frontend/src/features/auth/pages/__tests__/login-instalar-iphone.test.tsx`
- [ ] `apps/e2e/tests/pwa-instalavel.spec.ts`
- [ ] `scripts/check-pwa-headers.sh`
- [ ] instalar `web-push@3.6.7` e `@types/web-push@3.6.4`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Instalar, ativar e receber notificação no iPhone | D-01, D-04, D-05, D-06 | Permissão real, entrega pela Apple e modo standalone do iOS não rodam no Playwright | Safari → Compartilhar → Adicionar à Tela de Início → abrir pelo ícone → entrar → Ativar notificações → criar agendamento por outra conta → notificação chega → toque abre a agenda no dia → sair → novo agendamento não chega |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
