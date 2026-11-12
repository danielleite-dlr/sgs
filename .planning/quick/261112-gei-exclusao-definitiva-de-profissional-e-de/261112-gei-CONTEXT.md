# Quick Task 261112-gei: Exclusão definitiva de profissional e de noiva - Context

**Gathered:** 2026-11-12
**Status:** Ready for planning

<domain>
## Task Boundary

Criar exclusão definitiva (hard delete, remove as linhas do banco) para:
1. Profissional (`members` com `is_professional`) — hoje só existe `deactivateMember` (soft: status inactive) e, via SQL, `deleted_at`.
2. Noiva (grupo de noiva `bridal_groups`) — hoje só existe `cancelBridalGroup` (exige contrato cancelado, cancela agendamentos).

Motivação do usuário: limpar dados de teste de verdade (ex.: profissional placeholder "A definir 2", noivas teste) no staging/produção.
</domain>

<decisions>
## Implementation Decisions

### Profissional — quando bloquear
- Bloqueia SOMENTE se houver, ligado a ela: atendimento em aberto (`appointments.status` in scheduled/confirmed/in_progress) OU comanda em aberto (comanda `open` com item dela). A mensagem de bloqueio diz o que impede e quantos (ex.: "3 atendimentos agendados, 1 comanda aberta").
- Sem nada em aberto → prossegue e apaga do banco. Histórico fechado ligado a ela (atendimentos completed/cancelled/no_show, itens de comanda fechada, commission_records/rules, member_categories, time_blocks etc.) é apagado ou desvinculado conforme o FK permitir; referências de autoria/ator nuláveis (created_by, opened_by, closed_by, cancelled_by, member_id de pagamento/caixa, audit_log.actor_member_id) viram NULL. Se uma FK de autoria não for nulável, o plano decide (migration para tornar nulável é aceitável).
- O `users` vinculado: apagar também se não pertencer a nenhuma outra organização (nunca apagar o próprio usuário logado nem o dono).
- Não pode excluir a si mesma nem o owner da organização.

### Noiva — o que apagar
- Excluir de vez o grupo da noiva e tudo dele: membros do grupo (bridal_group_members, bridal_member_services), agendamentos do grupo, contrato(s) do grupo com itens/versões/aceites/tokens/parcelas/pagamentos, lançamentos de caixa (cash_movements) ligados a esses pagamentos/agendamentos, comandas/itens gerados para esses agendamentos, deslocamentos.
- Os registros de `clients` das pessoas do grupo NÃO são apagados (cliente pode ter outros históricos) — fica a critério do plano oferecer apagar a cliente-noiva se ela não tiver mais nada.
- Não exige contrato cancelado (é exclusão de teste/limpeza).

### Permissão e UI
- Restrito a quem tem permissão de gestão (owner/admin — seguir o CASL/permissões existentes para membros e noivas).
- Confirmação na UI digitando o nome (da profissional / da noiva) — ação marcada como destrutiva e irreversível.
- Profissional: botão "Excluir definitivamente" na tela/ficha da equipe. Noiva: botão na tela do grupo da noiva.
- Registrar no audit_log a exclusão (ator, tipo, nome excluído) — o registro do audit não pode depender da linha apagada.

### Claude's Discretion
- Nome das mutations (sugestão: `deleteMemberPermanently(id)`, `deleteBridalGroupPermanently(id)`), formato de erro de bloqueio, onde ficam os botões exatamente.
- Tudo numa transação só, respeitando RLS (`app.current_organization`).
</decisions>

<specifics>
## Specific Ideas

- Teste de integração com Postgres real (sgs_dev) cobrindo: bloqueio por atendimento aberto, bloqueio por comanda aberta, exclusão com histórico fechado, exclusão de noiva com contrato+pagamento+caixa.
- E2E Playwright do fluxo de confirmação digitando o nome.
- Ver memória de workflow: gate completo (lint, tsc, jest unit + integração, vitest, e2e) antes do commit; branch `master`.
</specifics>

<canonical_refs>
## Canonical References

- apps/backend/src/graphql/schema/identity.graphql (deactivateMember), bridal.graphql (cancelBridalGroup)
- apps/backend/prisma/schema.prisma (FKs de members, bridal_groups, contracts)
</canonical_refs>
