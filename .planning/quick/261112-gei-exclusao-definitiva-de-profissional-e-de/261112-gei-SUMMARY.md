# Quick 261112-gei: Exclusão definitiva de profissional e de noiva - Summary

Exclusão definitiva (hard delete) de profissional e de grupo de noiva, via funções Postgres `SECURITY DEFINER` (`purge_member`, `purge_bridal_group`), duas mutations GraphQL e confirmação digitando o nome na UI.

## Commits

- `9f2e553` feat(equipe): exclusão definitiva de profissional e de grupo de noiva (backend)
- `f742d7d` feat(equipe): exclusão definitiva na UI com confirmação digitando o nome

## O que foi feito

- Migration `20261112000000_hard_delete_member_bridal`: `purge_member(uuid)` e `purge_bridal_group(uuid)`.
  - `SECURITY DEFINER`, `SET search_path = public, pg_temp`, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE` só a `sgs_app`.
  - Abortam com "tenant ausente" se `app.current_organization` estiver vazio.
  - Toda instrução filtra `organization_id = v_org`. Nenhuma tabela append-only ganhou GRANT.
  - FKs conferidas no `sgs_dev` por `pg_constraint` (56 FKs relevantes) antes de escrever.
- `deleteMemberPermanently(id)` (MEMBER_REMOVE, só ADMIN):
  - Bloqueia com `MEMBER_HAS_OPEN_WORK` e contagem ("3 atendimentos agendados e 1 comanda aberta") quando há atendimento scheduled/confirmed/in_progress ou comanda aberta com item dela.
  - Recusa `CANNOT_DELETE_SELF` e `CANNOT_DELETE_OWNER` (ADMIN mais antigo).
  - Apaga o histórico fechado dela e anula as colunas de autoria. O `users` só é apagado se ela não tiver vínculo com outra organização.
  - Grava audit `member.delete_permanent`.
- `deleteBridalGroupPermanently(id)` (CONTRACT_CANCEL, ADMIN e MANAGER):
  - Não exige contrato cancelado.
  - Apaga grupo, pessoas, agendamentos, deslocamentos, contratos, versões, aceites, tokens, parcelas, pagamentos, caixa e comandas do grupo.
  - As clientes ficam.
  - Recusa `BRIDAL_SHARED_COMANDA` se a comanda tiver item fora do grupo (inclui item avulso).
  - Grava audit `bridal.delete_permanent`.
- Frontend: `ConfirmByNameDialog` genérico, ação "Excluir definitivamente" em Profissionais (oculta na própria linha) e botão `delete-group-permanent` no grupo de noiva.

## Gate (rodado sobre a árvore final, antes dos dois commits)

| Etapa | Resultado |
| --- | --- |
| Backend lint (`--max-warnings 0`) | OK |
| Backend tsc | OK |
| Jest unit | 35 suites, 387 testes passando |
| `prisma migrate deploy` (sgs_dev, com todas as migrations anteriores) | aplicou limpa |
| Jest integração completa (sgs_dev, 5433/5434) | 57 suites, 620 testes passando (11 novos em `hard-delete-member-bridal`) |
| Frontend lint (`--max-warnings 0`) | OK |
| Frontend tsc | OK |
| Vitest | 104 arquivos, 748 testes passando |
| E2E Playwright (`corepack pnpm --filter @sgs/e2e test:e2e`) | 49 passando (3 novos em `exclusao-definitiva`) |
| E2E tsc | OK |

## Desvios do plano

- Nenhum de regra de negócio. Ajustes menores:
  - O dialog da profissional ficou inline em `ProfissionaisPage.tsx`, como no plano.
  - A UI do grupo de noiva usa textos fixos em português, como o resto da feature `bridal` (que não usa i18n). Profissionais usa `pt-BR.json`.
  - `namesMatch` não é exportada, por causa do lint `react-refresh/only-export-components`. É coberta pelos testes do componente.
  - No teste de integração houve um ajuste de fixture: a exclusion constraint de sobreposição por profissional exigiu horários distintos por agendamento.
- Gate rodado uma vez sobre a árvore final e os dois commits saíram em seguida, sem alterar código entre o gate e o commit.

## Known Stubs

Nenhum.

## Notas para o deploy

- A migration roda no `scripts/deploy-staging.sh`. As funções ficam com o dono que aplicar a migration (`sgs_migrator`, superuser), e é isso que faz o `SECURITY DEFINER` ignorar RLS. Por isso o filtro `organization_id = v_org` em cada instrução.
- Nenhum push nem deploy foi feito. ROADMAP.md e STATE.md não foram alterados.

## Self-Check: PASSED

- Migration, `members-delete.spec.ts`, `hard-delete-member-bridal.e2e.spec.ts`, `confirm-by-name-dialog.tsx` e `exclusao-definitiva.spec.ts` existem.
- Commits `9f2e553` e `f742d7d` existem em `master`.
