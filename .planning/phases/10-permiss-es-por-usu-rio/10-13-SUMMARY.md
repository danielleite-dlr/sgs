---
phase: 10-permiss-es-por-usu-rio
plan: 13
subsystem: frontend-access
tags: [permissoes, frontend, perfis-de-acesso, acessibilidade]
requires: [10-07, 10-11, 10-12]
provides:
  - "AccessSwitch (role=switch, alvo 44 px, sem dependência nova)"
  - "MemberAccessPanel (ajuste de uma pessoa, reutilizável)"
  - "PerfisAcessoPage em /profissionais/perfis"
  - "Botão Acessos e aviso de troca de papel no MemberEditDialog"
affects: [10-14, 10-15, 10-16]
key-files:
  created:
    - apps/frontend/src/features/access/access-admin.api.ts
    - apps/frontend/src/features/access/components/AccessSwitch.tsx
    - apps/frontend/src/features/access/components/MemberAccessPanel.tsx
    - apps/frontend/src/features/access/pages/PerfisAcessoPage.tsx
    - apps/frontend/src/features/access/__tests__/member-access-panel.test.tsx
    - apps/frontend/src/features/access/__tests__/perfis-acesso-page.test.tsx
  modified:
    - apps/frontend/src/router.tsx
    - apps/frontend/src/config/features.ts
    - apps/frontend/src/config/__tests__/features.test.ts
    - apps/frontend/src/features/identity/components/MemberEditDialog.tsx
    - apps/frontend/src/features/identity/__tests__/member-dialogs.test.tsx
    - apps/frontend/src/infrastructure/apollo/client.ts
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
decisions:
  - "AccessItem sem normalização no cache do Apollo (keyFields: false)"
  - "Resultado das mutations gravado no cache da query MemberAccess (writeQuery); só MemberAccessOverview e MyAccess são relidas"
  - "Controle de área liga/desliga só itens ajustáveis; estado misto via aria-checked=mixed"
metrics:
  tasks: 2
  completed: 2026-11-25
---

# Phase 10 Plan 13: Perfis de acesso e atalho Acessos Summary

Admin e Gerente ajustam, pelo celular ou computador, as áreas do menu de cada pessoa em Profissionais › Perfis de acesso e pelo botão "Acessos" no editar profissional; cada item mostra por texto "Padrão do papel" ou "Ajustado", itens travados exibem o motivo e "Voltar ao padrão do papel" pede confirmação.

## Tarefas

1. API do frontend, `AccessSwitch` e `MemberAccessPanel` — e588783.
2. Tela `PerfisAcessoPage`, rota, flag `perfisAcesso` e atalho no `MemberEditDialog` — 4334a5d.

## Deviations from Plan

**1. [Rule 1 - Bug] AccessItem normalizado por id no cache.** `AccessItem` tem `id` (ex.: `fin-previsao`), então o Apollo o normalizaria como `AccessItem:fin-previsao`, igual para todas as pessoas. Ver o acesso de outra pessoa sobrescreveria o `myAccess` de quem está logado (menu mudaria sozinho). Adicionado `AccessItem: { keyFields: false }` em `infrastructure/apollo/client.ts`.

**2. [Rule 3 - Bloqueio] Testes existentes.** `features.test.ts` listava `/profissionais/perfis` como bloqueado; movido para a lista de liberados. `AccessSwitch` usava `shadow` e o teste de paleta (`sem-cor-antiga`) só aceita `shadow-sm`; trocado.

**3. Refetch.** Em vez de reler `MemberAccess` após salvar, o retorno da mutation é gravado com `writeQuery`; `refetchQueries` relê `MemberAccessOverview` e `MyAccess`, e `notifyAccessChanged()` dispara a releitura global.

**4. Setup do worktree.** `pnpm install --offline` (worktree sem node_modules).

## Verificação (frontend, rodada final)

- `pnpm typecheck`: limpo
- `pnpm lint`: limpo (0 warnings)
- `pnpm test`: 165 arquivos / 1159 testes passando
- Backend `jest src/authz/access/access-catalog.spec.ts`: 8/8

Uma rodada intermediária falhou em 2 testes (features gating e sombra grande); corrigidos como descrito acima e a suíte inteira foi rodada de novo.

## Known Stubs

Nenhum.

## Self-Check: PASSED
