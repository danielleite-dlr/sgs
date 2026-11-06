---
phase: 04-bridal-contracts
plan: 16
subsystem: verificação humana
tags: [human-verify, staging]
requires:
  - phase: 04-bridal-contracts
    provides: noivas, contratos, aceite público, alertas e agenda IA (04-01..04-15)
provides:
  - Resultado das verificações manuais da fase 4 registrado no 04-VALIDATION.md
affects: []
key-files:
  modified:
    - .planning/phases/04-bridal-contracts/04-VALIDATION.md
key-decisions:
  - "Sugestão de agenda com a Claude real adiada pela usuária (2026-11-05): staging sem ANTHROPIC_API_KEY, botão segue na heurística"
  - "Sino por papel aceito pela cobertura de integração (phase4-contract-alerts: só ADMIN/MANAGER recebem; atendente e profissional não), verde no CI de 2026-11-05; staging só tem 2 ADMIN no Studio JS"
requirements-completed: []
duration: ~15min
completed: 2026-11-05
---

# Phase 04 Plan 16: Verificação humana — Summary

| Item | Resultado |
|------|-----------|
| IP real no aceite (atrás do nginx) | ✅ Aceite de 04/11 no staging gravou IP público (187.x), não 127.0.0.1 nem a rede Docker 172.20.x |
| PDF do contrato | ✅ Aprovado pela usuária na verificação do 04.1-17 (layout Studio JS substituiu o layout da fase 4) |
| "Sugerir agenda IA" com a Claude real | ⏸️ Adiado por decisão da usuária — sem `ANTHROPIC_API_KEY` no staging; a heurística continua atendendo |
| Sino de alerta só para ADMIN (não PROFESSIONAL) | ✅ Coberto por `phase4-contract-alerts.e2e.spec.ts` (RECIPIENT_ROLES = ADMIN, MANAGER; atendente e profissional sem notificação nem no `notifications`), verde no CI |

## Pendência carregada

- Quando a IA for ligada: configurar `ANTHROPIC_API_KEY` no `.env.staging`, reiniciar o backend e repetir o passo 3 do 04-16 (grupo sem agenda → "Sugerir agenda IA" → badge "Sugestão da IA", sem conflitos → confirmar → /agenda).
