---
phase: 10-permiss-es-por-usu-rio
plan: 14
subsystem: e2e
tags: [permissoes, e2e, playwright, perfis-de-acesso]
requires: [10-08, 10-10, 10-13]
provides:
  - "support/phase10.ts: createMemberWithRole, setMemberAccessViaApi, resetMemberAccessViaApi"
  - "E2E permissoes-perfis, permissoes-area-ganha, permissoes-menu-ao-vivo"
affects: [10-15, 10-16]
key-files:
  created:
    - apps/e2e/support/phase10.ts
    - apps/e2e/tests/permissoes-perfis.spec.ts
    - apps/e2e/tests/permissoes-area-ganha.spec.ts
    - apps/e2e/tests/permissoes-menu-ao-vivo.spec.ts
  modified:
    - apps/e2e/tests/comercial-visibilidade.spec.ts
requirements-completed: [PERM-04, PERM-13, PERM-14, PERM-15, PERM-16]
metrics:
  completed: 2026-11-25
---

# Fase 10 Plano 14: E2E das permissões por pessoa

Três specs novos com navegador real (Admin ajusta pela tela Perfis de acesso, segundo contexto como a pessoa ajustada, poll de 60 s do menu) e a regressão da matriz padrão nova.

## O que foi feito

- `support/phase10.ts`: cria membro próprio por papel (senha já trocada) e ajusta/desfaz acessos via API.
- `permissoes-perfis`: Admin desliga "Controle de entrada e saída" do Gerente; o Gerente perde o item ao trocar de tela, `/financeiro` pela URL termina em `/dashboard` sem ir ao login e o nome segue no rodapé; "Voltar ao padrão do papel" devolve o item; atalho "Acessos" no editar profissional abre o mesmo painel; o Gerente vê o Administrador com todos os switches travados e o texto de trava.
- `permissoes-area-ganha`: Atendente com `fin-controle` vê o item e abre o caixa (KPIs visíveis); `afterAll` desfaz.
- `permissoes-menu-ao-vivo` (celular 390x844): Profissional parada na Agenda perde "Comanda" da barra inferior em até 65 s sem recarregar (`expectNoReload`) nem relogar; `/comanda` pela URL leva à Agenda.

## Resultados reais dos E2E (stack local: sgs_dev, backend :3100, frontend :5180)

- `permissoes-perfis` + `permissoes-area-ganha`: 5 passaram e 1 falhou na primeira rodada (seletor ambíguo do texto de trava, corrigido no spec).
- `permissoes-perfis` + `permissoes-menu-ao-vivo`: 7 passed (2,9 min).
- Suíte E2E inteira: 75 passed, 1 failed (`comercial-visibilidade` › atendente, 15,0 min). A falha era a asserção antiga de que `/comercial/relatorios` redireciona a `/comercial`; hoje a rota sem acesso leva à tela inicial (Agenda). Spec ajustado e rerodado: 4 passed.
- `equipe-acoes-por-papel` e `painel-inicio` passaram sem alteração (não fixavam o menu antigo). Não rodei a suíte inteira uma segunda vez depois do ajuste; só o spec alterado.
- `tsc --noEmit` do pacote e2e: sem erros.

## Deviations from Plan

1. [Rule 1 - Bug no plano] O plano cita o item "Controle financeiro"; o rótulo real do catálogo e do menu é "Controle de entrada e saída". Os specs usam o rótulo real.
2. [Rule 1] O toast "Acesso atualizado." é um aviso `role="status"` para leitor de tela (sr-only); o spec confere o elemento anexado, não visível.
3. [Rule 3] A leitura do acesso por troca de rota tem trava de 10 s (`ROUTE_REFETCH_LOCK_MS`); o spec repete a troca de tela dentro de `toPass` (até 40 s) em vez de uma troca só.
4. [Ambiente] O worktree precisou de `.env` copiado da raiz (ignorado pelo git) e `prisma generate`; as migrations já estavam aplicadas no `sgs_dev`.

## Known Stubs

Nenhum.

## Self-Check: PASSED
