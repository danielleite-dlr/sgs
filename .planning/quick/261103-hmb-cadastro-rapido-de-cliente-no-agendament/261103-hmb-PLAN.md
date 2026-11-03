---
quick_id: 261103-hmb
type: quick
files_modified:
  - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
  - apps/frontend/src/features/operations/__tests__/visit-form-dialog.test.tsx
---

# Quick 261103-hmb: cadastro rápido de cliente no agendamento

**Problema:** no staging (Studio JS sem clientes) o usuário não conseguia salvar agendamento: a busca de cliente
voltava vazia sem aviso e o salvar parava em "Escolha o cliente.". O usuário quer cadastrar o cliente na mesma tela.

## Task 1: cadastro inline no VisitFormDialog
- Busca sem resultado → "Nenhum cliente encontrado" + botão "+ Cadastrar cliente" (só para quem tem CLIENT_WRITE:
  ADMIN, MANAGER, ATTENDANT; o nome digitado na busca vem preenchido).
- Botão "+ Cadastrar novo cliente" também sempre visível abaixo da lista (homônimos).
- Mini formulário inline: nome (obrigatório, ≥ 2 letras), telefone com máscara (obrigatório — backend exige telefone ou e-mail).
- Salvar usa `CreateClientMutation` existente; sucesso seleciona o cliente e mostra "Cliente selecionado"; erros do payload aparecem inline.
- Cliente selecionado guardado por id+nome (não depende da lista da busca).

## Task 2: testes vitest do diálogo
- busca vazia mostra aviso e botão; cadastro chama createClient e seleciona o cliente; PROFESSIONAL não vê o botão.

**Verify:** lint, tsc, vitest, unit/integração backend, E2E; deploy staging.
