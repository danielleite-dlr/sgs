---
phase: 7
slug: app-android-gestor-beauty-com-capacitor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-14
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Fonte: `07-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 (backend, unit + integração com Postgres real), Vitest + Testing Library (frontend), `node --test` (apps/mobile e packages/shared), job `android` no GitHub Actions (`assembleDebug`) |
| **Config file** | `apps/backend/jest.config.ts`, `apps/backend/jest-integration.config.ts`, `apps/frontend/vitest.config.ts`; `apps/mobile/scripts/check-config.mjs` — Wave 0 cria |
| **Quick run command** | `corepack pnpm --filter @sgs/backend test -- push` · `corepack pnpm --filter @sgs/frontend test -- native` |
| **Full suite command** | `corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/frontend test` + integração (`test:integration`) + `corepack pnpm --filter @sgs/mobile test` |
| **Estimated runtime** | ~180 s local (sem integração); job `android` ~5–8 min no CI |

---

## Sampling Rate

- **After every task commit:** teste do módulo alterado (quick run) + `corepack pnpm -r typecheck`
- **After every plan wave:** suite completa backend + frontend + integração (migration aplicada no Postgres de dev/CI)
- **Before `/gsd:verify-work`:** CI verde (incluindo job `android`), APK/AAB gerado como artefato, `docker compose -f docker-compose.staging.yml build` passando, checklist humano concluído
- **Max feedback latency:** 180 s

---

## Per-Task Verification Map

| Behavior | Req | Test Type | Automated Command | File Exists | Status |
|----------|-----|-----------|-------------------|-------------|--------|
| `resolvePushTargets`: profissional só os dela; ADMIN/MANAGER todos; exclui o autor (D-12/D-13); dedup | C-03 | unit | `corepack pnpm --filter @sgs/backend test -- resolve-push-targets` | ❌ W0 | ⬜ pending |
| Noivas D-15: um aviso por profissional + resumo para gestoras ("3 atendimentos no casamento da Vitória, 08/11") | C-03 | unit | `corepack pnpm --filter @sgs/backend test -- push-bridal` | ❌ W0 | ⬜ pending |
| `FcmPushProvider` (fetch/GoogleAuth mockados): payload string + `channel_id`, 404 UNREGISTERED → token inválido, 5xx → retry | C-03 | unit | `corepack pnpm --filter @sgs/backend test -- fcm-push` | ❌ W0 | ⬜ pending |
| Processor apaga token inválido; sem credencial = no-op | C-03 | unit | `corepack pnpm --filter @sgs/backend test -- push.processor` | ❌ W0 | ⬜ pending |
| Enfileirar pós-commit em `createVisit`/`cancel`/agenda de noivas; falha da fila não falha a mutation | C-03 | unit | `corepack pnpm --filter @sgs/backend test -- appointments.service` | ✅ (ajustar construtores) | ⬜ pending |
| `device_tokens` com RLS: org B não vê token da org A; upsert move token entre membros; unregister apaga | C-03 | integration | `corepack pnpm --filter @sgs/backend test:integration -- device-tokens` | ❌ W0 | ⬜ pending |
| Rota do toque: allowlist só `/agenda`, `buildAgendaRoute` | C-04 | unit | `corepack pnpm --filter @sgs/frontend test -- push-route` | ❌ W0 | ⬜ pending |
| `SchedulePage` abre o atendimento com `?agendamento=<id>` | C-04 | unit (RTL) | `corepack pnpm --filter @sgs/frontend test -- schedule` | ❌ W0 | ⬜ pending |
| `setupNativePush` com `@capacitor/*` mockado: permissão, register, token → mutation, toque → navigate | C-03/C-04 | unit | `corepack pnpm --filter @sgs/frontend test -- use-native-push` | ❌ W0 | ⬜ pending |
| Logout remove o token (falha não impede logout) | C-03 | unit | `corepack pnpm --filter @sgs/frontend test -- useAuth` | ❌ W0 | ⬜ pending |
| Overlay "Sem conexão" (online/offline) + "Tentar novamente" | C-02 | unit | `corepack pnpm --filter @sgs/frontend test -- offline` | ❌ W0 | ⬜ pending |
| `capacitor.config.ts`: appId `br.com.gestorbeauty.app`, `server.url` https do staging, `errorPath` existe em `www/`; ícones/splash gerados presentes | C-01/C-02/C-05 | script | `corepack pnpm --filter @sgs/mobile test` | ❌ W0 | ⬜ pending |
| Projeto Android compila (debug APK) | C-01 | CI | job `android` (`assembleDebug`) | ❌ W0 | ⬜ pending |
| `packages/shared` não quebra install/typecheck nem os builds Docker do staging | C-06 | CI + manual | `corepack pnpm install --frozen-lockfile && corepack pnpm -r typecheck`; `docker compose -f docker-compose.staging.yml build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/src/push/*.spec.ts` — targets, FCM client, processor, hooks
- [ ] `apps/backend/test/integration/device-tokens.e2e.spec.ts` — RLS + upsert
- [ ] `apps/frontend/src/infrastructure/native/__tests__/*` — mocks de `@capacitor/*`
- [ ] `apps/mobile/scripts/check-config.mjs` + script `test` no `package.json` do mobile
- [ ] `packages/shared` com `typecheck` e testes; `pnpm-workspace.yaml` e `pnpm-lock.yaml` atualizados
- [ ] `.github/workflows/android.yml` (debug APK em PR; AAB/APK assinado em dispatch/tag `android-v*`)

---

## Manual-Only Verifications

| Behavior | Req | Why Manual | Test Instructions |
|----------|-----|------------|-------------------|
| Instalação, ícone, nome "Gestor Beauty", splash `#F7F6F3`, login que permanece | C-01/C-05 | aparelho real | Instalar APK/AAB, logar, fechar e reabrir |
| Push em primeiro plano, segundo plano e app fechado (novo agendamento, cancelamento, lote de noivas) | C-03 | FCM real + aparelho | Duas contas em dois aparelhos (profissional e gestora), conferir D-12/D-13/D-15 |
| Toque abre a agenda no dia com o atendimento aberto (inclusive a frio) | C-04 | aparelho real | Tocar na notificação com o app fechado |
| Modo avião → "Sem conexão" → reconectar → "Tentar novamente"; queda no meio da sessão | C-02 | rede real | Alternar modo avião |
| Botão voltar, teclado, notch/safe area, barra de status, PDF de contrato | C-01 | WebView real | Navegar e abrir PDF |
| Teste interno na Play Console (convite, instalação pela loja) | C-01 | depende da conta da usuária | Quando a conta existir |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
