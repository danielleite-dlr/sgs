---
phase: 05-uso-no-dia-a-dia
plan: 20
subsystem: fechamento
tags: [verificação, staging, aceite, auditoria]
requires: [05-07, 05-08, 05-16]
provides: [fase 5 aceita pela usuária, usuário de auditoria desativado]
key-files:
  modified:
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
    - .planning/REQUIREMENTS.md
    - apps/e2e/audit/telas.audit.ts
decisions:
  - "Itens UX-11 a UX-19 conferidos pelas screenshots novas do roteiro somente leitura (computador e celular); UX-01 a UX-10 já estavam conferidos"
  - "FIN-03 reescrito para a previsão adotada (agenda confirmada + parcelas de contrato − comissões estimadas − despesas fixas, sem média histórica); checkbox e rastreio ficam para a verificação da fase"
  - "Usuário de auditoria desativado (members.status = inactive) e sessões revogadas; o usuário não foi apagado"
metrics:
  tasks: 3
  completed: 2026-11-06
---

# Phase 5 Plan 20: Fechamento Summary

A fase 5 terminou aceita pela usuária ("aprovado", em 2026-11-06). Todos os 19 itens aprovados da auditoria estão corrigidos e conferidos no staging, a previsão de 30 dias bate com o banco e o usuário de auditoria já não acessa os dados da Studio JS.

## Commits

- dd9d217: docs(05-20) reverificação no staging (UX-11 a UX-19), FIN-03 alinhado e ajuste do roteiro de busca de clientes
- commit final de docs: aceite, SUMMARY, STATE e ROADMAP

## Verificação no staging

- Roteiro `telas.audit.ts` + `previsao-staging.audit.ts` (somente leitura, computador e celular): 32 de 32 depois do ajuste do passo 14 (ver Deviations).
- Conferidos nas screenshots: UX-11 (negrito sem asteriscos no texto do contrato), UX-12 (cartões no celular), UX-13 (botão "Completar dados da contratante"), UX-14 (status único "Ativo" com legenda "Contrato em rascunho", telefone formatado, sem "Pronta até" vazio), UX-15/16/19 (nome em link, cartões no celular, nomes padronizados, botão de ações), UX-17/18/19 (tipos em português, cartões explicados, filtros juntos).

## Previsão conferida contra o banco (valores agregados)

| Item | Banco | Tela (/financeiro/previsao, 30 dias) |
|------|-------|--------------------------------------|
| Despesas fixas ativas | 0 (R$ 0,00) | Custo fixo R$ 0,00 |
| Agendamentos de 06/11 a 05/12 | 0 | nenhum item de agendamento |
| Contrato ativo (único) | total R$ 2.800,00, pago R$ 400,00, restante em 02/12 | Restante de contrato, 02/12, +R$ 2.400,00 |
| Totais | — | Entradas R$ 2.400,00 · Saídas R$ 0,00 · Saldo R$ 2.400,00 |

Os outros 4 contratos estão em rascunho e, como previsto, não entram na previsão.

## Usuário de auditoria (D-12)

- E-mail: `auditoria.ux@sgs.invalid`; desativado em 2026-11-06 (`members.status = 'inactive'`, 1 linha) e todas as sessões revogadas (83 refresh tokens, 0 ativos).
- Login depois da desativação: a senha ainda autentica, mas a sessão vem sem nenhuma organização e qualquer consulta de dados responde `FORBIDDEN: no active tenant context`. O token de sessão gerado por esse teste foi revogado em seguida.
- `/root/sgs/.env.audit` sem `AUDIT_PASSWORD`, com `AUDIT_DEACTIVATED_AT=2026-11-06` (arquivo ignorado pelo git, permissão 600).
- Para reativar numa próxima auditoria: `UPDATE members SET status='active' WHERE id = '<AUDIT_MEMBER_ID>'` (com `SET LOCAL app.current_organization`) e nova senha pelo mesmo mecanismo do 05-01, Task 1 (hash argon2id gerado no container do backend).

## Deviations from Plan

1. **Roteiro de busca de clientes (Regra 1, teste).** O passo `14-clientes-busca` falhou no computador porque, desde o UX-15, cada cliente tem dois links iguais (cartão do celular, escondido, e tabela) e o roteiro clicava no primeiro. Passou a clicar só no visível (`:visible`).
2. **Login do usuário desativado não devolve erro de credencial.** O plano esperava `errors`; o backend autentica e entrega uma sessão sem organização, sem acesso a dados. O efeito pedido (nenhum acesso à Studio JS) foi conferido com uma consulta real.

## Observações para depois

- Título do grupo de noivas com o nome sem padronizar ("Noiva julia Souza").
- Tabela "Itens por pessoa" apertada no detalhe do contrato no computador.
