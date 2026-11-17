---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 12
subsystem: infra
tags: [firebase, fcm, keystore, secrets, android, play]
requires:
  - phase: 07-11
provides:
  - Push FCM habilitado no staging (service account no .env.staging)
  - Secrets de assinatura e google-services no GitHub; AAB/APK assinados no CI
  - Impressões digitais da chave de upload no KEYSTORE.md
affects: [07-13]
key-files:
  created: []
  modified:
    - apps/mobile/KEYSTORE.md
requirements-completed: [C-01, C-03]
completed: 2026-11-17
---

# Phase 7 Plan 12: Firebase, keystore e secrets Summary

**Firebase ligado ao staging, build assinado no CI e keystore com backup confirmado pela usuária e removida do servidor.**

## Verificação

| Item | Evidência |
|------|-----------|
| FCM no staging | log do `sgs_stg_backend` em 17/11 03:28: `[PushModule] Push FCM habilitado` |
| Secrets no GitHub | ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD, GOOGLE_SERVICES_JSON_BASE64 (17/11 03:27) |
| Build assinado | run 44010411126 (workflow_dispatch) e 44010958871 (push) verdes |
| Impressões digitais | SHA-1/SHA-256 no `apps/mobile/KEYSTORE.md` |
| Backup da keystore | usuária confirmou hash SHA-256 (6d998254…c020e6), cópia no gerenciador de senhas e offline |
| Remoção do servidor | `/root/gestor-beauty-secrets/` apagada com `shred -u` em 17/11; busca no disco não achou outra cópia do `.jks` |
| Conta Google Play | criação iniciada pela usuária (D-10) |

## Desvios

Nenhum.
