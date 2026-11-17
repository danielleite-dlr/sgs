---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 13
subsystem: mobile
tags: [android, capacitor, verificacao-manual, play]
requirements-completed: [C-01, C-05]
completed: 2026-11-17
---

# 07-13 — Verificação no aparelho

**Aprovado pela usuária em 17/11/2026, com teste parcial no aparelho.**

## Preparação (Task 1)

- APK publicado no staging: `https://sgs.jessicaseixasmakeup.com.br/download/gestor-beauty.apk`
  (run `44010411126`, commit `8c4a650`, sha256 `a192608f…1901`, igual ao baixado em
  `/root/gestor-beauty-apks/release-20261117-run44010411126/`). Os runs posteriores
  (`44010958871`, `44023616348`) foram só de docs e geraram apenas APK debug.
- Backend do staging com `Push FCM habilitado`.
- `device_tokens`: 1 registro, criado em 2026-11-17 14:39 UTC — o login da usuária no app registrou o aparelho.

## Resultado (Task 2)

- ✅ Instalação pelo link "Baixar app Android" e login no aparelho.
- ⏭️ Demais itens (push em 1º/2º plano/fechado, cancelamento, lote de noivas, toque abrindo a agenda,
  sessão vencida, modo avião, voltar/teclado/entalhe, PDF e exportação, admin de plataforma):
  **não testados**. A usuária disse: "por aprovado, n vou conseguir testar tudo, mas por hora está aprovado".
  Se algum falhar no uso real, abrir gap com `/gsd:plan-phase 7 --gaps`.
- ⏳ Teste interno na Play Console: pendente só da aprovação da conta de desenvolvedor.

## Pendências

- Publicar o AAB no teste interno da Play quando a conta for aprovada (fecha D-09 e o objetivo da fase).
- PDF/exportação dentro do WebView (Pitfall 9) segue como maior risco não verificado.
