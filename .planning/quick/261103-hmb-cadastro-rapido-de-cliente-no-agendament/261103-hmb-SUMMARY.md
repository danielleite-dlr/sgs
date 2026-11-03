---
quick_id: 261103-hmb
completed: 2026-11-03
commit: 64888bf
---

# Quick 261103-hmb: cadastro rápido de cliente no agendamento — Summary

Formulário de agendamento (VisitFormDialog) agora cadastra cliente sem sair da tela: busca vazia mostra
"Nenhum cliente encontrado." + "Cadastrar cliente" (nome da busca pré-preenchido); com a busca vazia há o link
"Cadastrar novo cliente". Mini formulário com nome e telefone (máscara BR, enviado em E.164 via
`normalizeBrPhone`), usa `CreateClientMutation` existente e já seleciona o cliente. O cliente selecionado
passou a ser guardado por id+nome (antes dependia da lista da busca).

- `operations-permissions.ts`: `client.write` para ADMIN/MANAGER/ATTENDANT (espelha o backend); PROFESSIONAL não vê o cadastro.
- Testes: `visit-form-dialog.test.tsx` (4 casos).

## Gate
Lint/typecheck ok; backend unit 107; integração 293 (31 suítes); vitest 300; E2E 13.

## Origem
Verificação humana da Fase 3 no staging: Studio JS sem clientes → não era possível salvar agendamento.
