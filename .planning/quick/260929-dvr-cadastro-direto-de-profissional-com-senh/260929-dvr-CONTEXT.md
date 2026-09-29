# Quick Task 260929-dvr: Cadastro direto de profissional com senha provisória, categorias atendidas e filtro de profissional por categoria na agenda - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Task Boundary

Ajustes pedidos pelo usuário (dono do produto) na tela `/profissionais` (fase 02.1) depois de testar no staging:

1. Não existe serviço de envio de e-mail, então o fluxo "convidar por e-mail" não funciona. Substituir por **cadastro direto** do profissional com senha provisória.
2. Papel "Profissional" não deve exigir marcar de novo o checkbox "é profissional".
3. Em vez de senioridade, o profissional é vinculado às **categorias que atende** (Maquiagem, Penteados…), e na agenda o seletor de profissional mostra só quem atende a categoria do serviço escolhido.

</domain>

<decisions>
## Implementation Decisions (locked — discutidas com o usuário)

### Cadastro direto (substitui o convite na UI)
- Botão/dialog "Cadastrar profissional" no lugar de "Convidar". Campos:
  - Nome — obrigatório (vira `displayName` do member e `fullName` do user novo)
  - E-mail — obrigatório (login)
  - Telefone — obrigatório (BR, normalizar para E.164 `+55…`, validar)
  - Chave Pix — obrigatória (aceitar CPF, CNPJ, e-mail, telefone ou chave aleatória/EVP; validação de formato leve)
  - Data de nascimento — opcional
  - Papel (ADMIN, MANAGER, ATTENDANT, PROFESSIONAL)
  - Categorias atendidas (multi-seleção) — ver abaixo
  - Senha provisória — campo com botão "Gerar" (gera no navegador com `crypto.getRandomValues`, legível, ≥ 12 chars) e botão copiar; o admin pode editar; o backend valida a política mínima de senha existente e faz hash (reusar o PasswordService/argon2 já usado em `apps/backend/src/admin/admin.service.ts`).
- Após salvar, mostrar a senha provisória uma última vez com botão copiar, orientando enviar ao profissional (ex.: WhatsApp). Não é armazenada em claro nem exibida depois.
- Usuário criado com `mustChangePassword: true`. No primeiro login o fluxo existente de troca obrigatória (`ChangePasswordPage`, já usado pelo cadastro de salões em admin.service.ts) deve ser acionado — verificar que funciona para um member comum (não platform admin) e redireciona para a home do salão depois.
- **E-mail que já tem conta** (user existe, ex.: trabalha em outro salão): NÃO alterar a senha dele. Criar apenas o member nesta organização vinculado ao user existente e retornar um aviso ("essa pessoa já tem conta e entra com a senha que já usa"). Se já é member desta organização → erro `MEMBER_ALREADY_EXISTS`.
- Ação "Gerar nova senha provisória" no menu de ações (só ADMIN): gera nova senha, grava hash, marca `mustChangePassword: true`, revoga refresh tokens do user, mostra a senha uma vez. Só permitida se o user pertence APENAS a esta organização (senão erro — não se reseta senha de alguém que também é de outro salão).
- O fluxo de convite por e-mail (backend `invitation.*`, rota `/convite/:token`) permanece no código, mas some da UI (sem "Convidar" e sem a seção de convites pendentes). Não apagar.
- Permissões: cadastrar usa `member.invite` (ADMIN e MANAGER), mas MANAGER não pode cadastrar ADMIN. Reset de senha e edição continuam ADMIN (`member.editRole`). Manter o gating por papel feito em 260929-dek (`features/identity/team-permissions.ts`).

### Dados pessoais — onde ficam
- Telefone, chave Pix e data de nascimento ficam no **member** (por organização, sob RLS), não no user global. Migration nova adicionando colunas em `members` (`phone`, `pix_key`, `birth_date`). Members antigos ficam com null (colunas nullable no banco; obrigatoriedade é regra da API no cadastro/edição).
- Editar (MemberEditDialog) passa a permitir alterar telefone, Pix, nascimento, categorias, papel, profissional e senioridade.
- Lista mostra categorias (chips) e telefone; senioridade sai da lista.

### Papel × "é profissional"
- Papel PROFESSIONAL ⇒ `isProfessional = true` automaticamente; checkbox escondido. Backend também força isso (não confiar só na UI).
- Papéis ADMIN/MANAGER/ATTENDANT ⇒ checkbox "Também atende clientes" (default desmarcado).
- Categorias só aparecem/valem quando o member é profissional.

### Categorias atendidas (substitui senioridade no cadastro)
- Nova tabela de junção `member_categories` (member_id, category_id, organization_id) com RLS forçada por `app.current_organization`, igual às demais tabelas tenant (seguir o padrão das migrations existentes, incluindo policies e grants para o role da aplicação).
- Categorias são hierárquicas (`categories.parent_id`). O profissional é vinculado a categorias (normalmente as de topo); um serviço é atendido por ele se a categoria do serviço **for uma das vinculadas ou descendente** delas.
- Senioridade: sai do cadastro, **continua opcional em Editar** (é usada nas variações de preço por senioridade dos serviços — não quebrar).
- Profissional **sem nenhuma categoria vinculada atende todos os serviços** (fallback para não sumir ninguém da agenda; hoje nenhum member tem categoria). No cadastro novo, profissional exige ≥ 1 categoria.

### Filtro na agenda
- Ao criar/editar agendamento: depois de escolher o serviço, o seletor de profissional mostra só profissionais ativos que atendem a categoria do serviço (regra acima). Se trocar o serviço e o profissional selecionado não atender, limpar a seleção.
- Backend (`appointments.service.ts`, que já exige member ativo e profissional) passa a recusar com erro-como-dado quando o profissional não atende a categoria do serviço.
- Expor no GraphQL o que o frontend precisa (ex.: `categoryIds` no Member e/ou query `professionalsForService(serviceId)`) — decisão do planner, preferindo filtrar no backend.

### Claude's Discretion
- Nomes exatos de mutations/inputs (ex.: `createMember`, `resetMemberPassword`), formato das mensagens pt-BR, layout do dialog (shadcn/ui existente), i18n keys.

</decisions>

<specifics>
## Specific Ideas

- Reaproveitar `generatePassword`/hash de `apps/backend/src/admin/admin.service.ts` (cadastro de salão já cria user com senha provisória e `mustChangePassword: true`).
- Frontend: `apps/frontend/src/pages/ProfissionaisPage.tsx`, `features/identity/components/InviteMemberDialog.tsx` (virar CreateMemberDialog), `MemberEditDialog.tsx`, `features/catalog/api/members.api.ts`, agenda em `SchedulePage.tsx` (~1107).
- Backend: `apps/backend/src/identity/members.service.ts` (já tem LAST_ADMIN), `members.resolver.ts`, `graphql/schema/identity.graphql`, `operations`/`appointments.service.ts` (~103-109).
- Quality gate do usuário: commits sem erro — lint, typecheck, testes unit + integração backend (Postgres local sgs_dev 5433/5434, nunca staging) e vitest frontend completos antes de cada commit. Staging do usuário tem dados reais (org "Studio JS"): migration deve ser aditiva e segura.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/phases/02.1-equipe-e-profissionais-cadastro-completo-de-profissionais/02.1-CONTEXT.md` e `02.1-VERIFICATION.md`
- `.planning/quick/260929-dek-esconder-acoes-de-equipe-por-papel-prote/260929-dek-SUMMARY.md` (gating por papel e LAST_ADMIN)
- `apps/backend/src/authz/permissions.catalog.ts` (ROLE_PERMISSIONS)

</canonical_refs>
