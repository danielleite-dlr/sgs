---
phase: quick-260929-dvr
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [EQUIPE-01, EQUIPE-02, EQUIPE-03]
files_modified:
  # Task 1 — backend members (data + API)
  - apps/backend/prisma/migrations/20260929120000_member_contact_and_categories/migration.sql
  - apps/backend/prisma/schema.prisma
  - apps/backend/src/auth/temporary-password.ts
  - apps/backend/src/auth/temporary-password.spec.ts
  - apps/backend/src/admin/admin.service.ts
  - apps/backend/src/identity/member-contact.ts
  - apps/backend/src/identity/member-contact.spec.ts
  - apps/backend/src/identity/dto/member.input.ts
  - apps/backend/src/identity/members.service.ts
  - apps/backend/src/identity/members.resolver.ts
  - apps/backend/src/graphql/schema/identity.graphql
  - apps/backend/test/integration/members-create.e2e.spec.ts
  # Task 2 — frontend cadastro / edicao / lista
  - apps/frontend/src/features/catalog/api/members.api.ts
  - apps/frontend/src/features/identity/temporary-password.ts
  - apps/frontend/src/features/identity/member-validation.ts
  - apps/frontend/src/features/identity/__tests__/member-helpers.test.ts
  - apps/frontend/src/features/identity/components/CreateMemberDialog.tsx
  - apps/frontend/src/features/identity/components/MemberCategoriesField.tsx
  - apps/frontend/src/features/identity/components/ResetMemberPasswordDialog.tsx
  - apps/frontend/src/features/identity/components/MemberEditDialog.tsx
  - apps/frontend/src/features/identity/__tests__/member-dialogs.test.tsx
  - apps/frontend/src/pages/ProfissionaisPage.tsx
  - apps/frontend/src/pages/__tests__/profissionais-page.test.tsx
  - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  # Task 3 — filtro por categoria na agenda (full-stack)
  - apps/backend/src/identity/member-categories.ts
  - apps/backend/src/identity/member-categories.spec.ts
  - apps/backend/src/appointments/appointments.service.ts
  - apps/backend/test/integration/professional-categories.e2e.spec.ts
  - apps/frontend/src/features/operations/api/appointments.api.ts
  - apps/frontend/src/features/operations/professional-filter.ts
  - apps/frontend/src/features/operations/__tests__/professional-filter.test.ts
  - apps/frontend/src/features/operations/pages/SchedulePage.tsx

must_haves:
  truths:
    - "ADMIN (ou MANAGER, exceto para papel ADMIN) cadastra um profissional direto na tela /profissionais com nome, e-mail, telefone, chave Pix, nascimento opcional, papel, categorias e senha provisoria — sem envio de e-mail"
    - "A senha provisoria aparece uma unica vez apos salvar, com botao copiar; nunca e armazenada em claro nem reexibida"
    - "O usuario novo entra com a senha provisoria, e forcado para /trocar-senha e, apos trocar, cai no /dashboard do salao"
    - "E-mail de quem ja tem conta cria apenas o member nesta organizacao, sem tocar na senha, e a UI mostra o aviso; e-mail ja membro desta organizacao retorna MEMBER_ALREADY_EXISTS"
    - "ADMIN gera nova senha provisoria para um membro que so pertence a esta organizacao; refresh tokens dele sao revogados e mustChangePassword volta a true; membro de outro salao e recusado"
    - "Papel PROFESSIONAL implica isProfessional=true (UI esconde o checkbox e o backend forca)"
    - "Lista de equipe mostra telefone e chips de categorias; senioridade sai da lista e da UI de convites; convites pendentes somem da UI (backend de convite permanece)"
    - "Na agenda, apos escolher o servico, o seletor mostra so profissionais ativos que atendem a categoria do servico (ou descendente), com fallback: profissional sem categorias atende tudo; profissional que nao atende e limpo da selecao"
    - "createAppointment recusa com erro-como-dado PROFESSIONAL_DOES_NOT_SERVE_CATEGORY quando o profissional nao atende a categoria"
  artifacts:
    - path: "apps/backend/prisma/migrations/20260929120000_member_contact_and_categories/migration.sql"
      provides: "Colunas phone/pix_key/birth_date em members, tabela member_categories com FORCE RLS e funcao member_user_org_count"
      contains: "CREATE TABLE member_categories"
    - path: "apps/backend/src/identity/members.service.ts"
      provides: "create, resetPassword, update estendido, listProfessionalsForService"
      exports: ["MembersService"]
    - path: "apps/backend/src/identity/member-categories.ts"
      provides: "Regra pura memberServesCategory + loader professionalServesCategory(tx, ...)"
      exports: ["memberServesCategory", "professionalServesCategory"]
    - path: "apps/backend/src/graphql/schema/identity.graphql"
      provides: "createMember, resetMemberPassword, professionalsForService, Member.phone/pixKey/birthDate/categories"
      contains: "createMember"
    - path: "apps/frontend/src/features/identity/components/CreateMemberDialog.tsx"
      provides: "Dialog de cadastro direto com gerar/copiar senha e passo final de exibicao unica"
      min_lines: 150
    - path: "apps/frontend/src/features/identity/components/ResetMemberPasswordDialog.tsx"
      provides: "Confirmacao + exibicao unica da nova senha"
    - path: "apps/frontend/src/features/operations/professional-filter.ts"
      provides: "Filtro puro de profissionais pelo resultado de professionalsForService"
  key_links:
    - from: "apps/frontend/src/features/identity/components/CreateMemberDialog.tsx"
      to: "createMember mutation"
      via: "useMutation(CreateMemberMutation)"
      pattern: "CreateMemberMutation"
    - from: "apps/frontend/src/pages/ProfissionaisPage.tsx"
      to: "CreateMemberDialog / ResetMemberPasswordDialog"
      via: "botao Cadastrar profissional (canInviteMembers) e acao Gerar nova senha (canManageMembers)"
      pattern: "CreateMemberDialog"
    - from: "apps/backend/src/appointments/appointments.service.ts"
      to: "apps/backend/src/identity/member-categories.ts"
      via: "professionalServesCategory(tx, professionalId, service.categoryId) antes do conflito de horario"
      pattern: "professionalServesCategory"
    - from: "apps/frontend/src/features/operations/pages/SchedulePage.tsx"
      to: "professionalsForService query"
      via: "useQuery(ProfessionalsForServiceQuery, { skip: !serviceId }) + filterProfessionalsForService"
      pattern: "ProfessionalsForServiceQuery"
    - from: "apps/backend/src/identity/members.service.ts"
      to: "member_user_org_count(uuid)"
      via: "tx.$queryRaw no resetPassword (SECURITY DEFINER, enxerga members de outras orgs)"
      pattern: "member_user_org_count"
---

<objective>
Substituir o convite por e-mail (nao ha servico de e-mail) por cadastro direto do profissional com senha provisoria, vincular profissionais a categorias atendidas (no lugar da senioridade no cadastro) e filtrar o seletor de profissional da agenda pela categoria do servico.

Purpose: o dono do produto testou /profissionais no staging e o fluxo de convite nao funciona; o salao precisa cadastrar a equipe e agendar so com quem atende o servico.
Output: migration aditiva + API de members (create/reset/update/professionalsForService) + UI de cadastro/edicao/reset + filtro na agenda, com testes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260929-dvr-cadastro-direto-de-profissional-com-senh/260929-dvr-CONTEXT.md
@.planning/quick/260929-dek-esconder-acoes-de-equipe-por-papel-prote/260929-dek-SUMMARY.md
@apps/backend/src/identity/members.service.ts
@apps/backend/src/admin/admin.service.ts
@apps/backend/test/integration/members-lifecycle.e2e.spec.ts

<interfaces>
<!-- Extraido do codigo. Use direto, sem explorar. -->

apps/backend/src/admin/admin.service.ts (a extrair para src/auth/temporary-password.ts):
```ts
/** Sem I, l, O, 0 e 1: a senha e ditada por WhatsApp. */
const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
function generatePassword(length = 14): string  // usa randomInt de node:crypto
// resetOwnerPassword: user.update({ passwordHash: await this.password.hash(tmp), mustChangePassword: true })
//                     + prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
```

apps/backend/src/auth/password.service.ts: `PasswordService.hash(plain): Promise<string>`, `.verify(hash, plain)` (argon2id). Exportado por AuthModule (IdentityModule ja importa AuthModule).
Politica de senha existente (auth.service.ts changePassword): `newPassword.length < 8` -> erro. Reusar: minimo 8 (erro code `WEAK_PASSWORD`, field `temporaryPassword`); maximo 128.

apps/backend/src/authz/decorators/current-tenant.decorator.ts:
```ts
export interface TenantContext { organizationId: string; memberId: string; roleName: string; }
```
PERMISSIONS: MEMBER_READ ('member.read', 4 papeis), MEMBER_INVITE ('member.invite', ADMIN+MANAGER), MEMBER_EDIT_ROLE ('member.editRole', ADMIN), MEMBER_REMOVE.

members.service.ts: `errPayload(code, message, field?)`, `MEMBER_SELECT`, `toMemberDto`, `isLastActiveAdmin(tx, orgId, member)`, `this.tenant.runWithTenant(orgId, tx => ...)` (SET LOCAL app.current_organization dentro de transacao).

Prisma Member (hoje): id, organizationId, userId, roleId, displayName, isProfessional, status, seniorityTier, createdAt, updatedAt, deletedAt; `@@unique([organizationId, userId])`.
Prisma Category: id, organizationId, parentId (hierarquia), name, deletedAt.
Prisma User: id, email (unique, global, SEM RLS), passwordHash, fullName, emailVerifiedAt, isPlatformAdmin, mustChangePassword.

Padrao RLS (migration appointments):
```sql
ALTER TABLE t ENABLE ROW LEVEL SECURITY;
ALTER TABLE t FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON t
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);
```
Padrao SECURITY DEFINER (migration 20260918220000_auth_user_memberships_fn): `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp`, `REVOKE ALL ... FROM PUBLIC`, `DO $$ IF EXISTS (pg_roles sgs_app) THEN GRANT EXECUTE ... TO sgs_app; END IF; $$`.

appointments.graphql: `Appointment.professional: Member!` resolve com a linha crua do Prisma — NAO consultar `categories` via appointment.professional no frontend.

Frontend:
- `apps/frontend/src/features/identity/team-permissions.ts`: `canInviteMembers(roleName)` (ADMIN, MANAGER), `canManageMembers(roleName)` (ADMIN). roleName vem de `useAuthStore` (campo `roleName`).
- `apps/frontend/src/features/catalog/api/categorias.api.ts`: `CategoriesQuery` -> `categories { id name parentId displayOrder children { id name parentId ... } }` (topo com filhos).
- `apps/frontend/src/features/catalog/api/members.api.ts`: `MembersQuery`, `AllMembersQuery`, `UpdateMemberMutation`, `ROLE_OPTIONS`, `SENIORITY_OPTIONS`, `AdminMemberData`, `UserErrorData`, `InviteMemberMutation`, `PendingInvitationsQuery` (convite fica no arquivo, so sai da UI).
- SchedulePage.tsx `AppointmentModal` (~linha 805): estados `professionalId`, `serviceId`; select de profissional (~977) usa prop `professionals: ScheduleProfessional[]` (id, name...); select de servico (~994) chama setServiceId.
- Fluxo de troca obrigatoria ja existe: `RequirePasswordChange` -> `/trocar-senha` (ChangePasswordPage) -> `navigate(isPlatformAdmin ? '/admin' : '/dashboard')`. Nao precisa mudar; so provar no teste de integracao que o login do member novo devolve mustChangePassword=true e que changePassword zera a flag.
</interfaces>
</context>

<quality_gate>
Antes de CADA commit (exigencia do usuario — commits sem erro), rodar tudo e so commitar com tudo verde:

```bash
# Carregar env linha a linha (o .env tem '&' sem aspas no DATABASE_URL; `source` quebra)
set -a; while IFS= read -r l; do [[ -z "$l" || "$l" == \#* ]] && continue; export "$l"; done < /root/sgs/.env; set +a
# Banco LOCAL (sgs_dev: postgres 5434 / pgbouncer 5433). NUNCA staging. Se estiver parado: cd /root/sgs && docker compose up -d postgres pgbouncer
cd /root/sgs/apps/backend && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration
cd /root/sgs/apps/frontend && pnpm lint && pnpm typecheck && pnpm test
```
Confirmar que DATABASE_URL/DIRECT_URL apontam para localhost antes de rodar migrate/integration. Sem push, sem deploy.
</quality_gate>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Backend — migration aditiva, cadastro direto, reset de senha e edicao estendida de members</name>
  <files>apps/backend/prisma/migrations/20260929120000_member_contact_and_categories/migration.sql, apps/backend/prisma/schema.prisma, apps/backend/src/auth/temporary-password.ts, apps/backend/src/auth/temporary-password.spec.ts, apps/backend/src/admin/admin.service.ts, apps/backend/src/identity/member-contact.ts, apps/backend/src/identity/member-contact.spec.ts, apps/backend/src/identity/dto/member.input.ts, apps/backend/src/identity/members.service.ts, apps/backend/src/identity/members.resolver.ts, apps/backend/src/graphql/schema/identity.graphql, apps/backend/test/integration/members-create.e2e.spec.ts</files>
  <behavior>
    Unit (member-contact.spec.ts):
    - normalizeBrPhone('(11) 98765-4321') -> '+5511987654321'; '+55 11 98765-4321' -> '+5511987654321'; '1133334444' (fixo 10 digitos) -> '+551133334444'; '5511987654321' -> '+5511987654321'
    - normalizeBrPhone('123'), '(00) 98765-4321' (DDD < 11), '11 88765-432' -> null
    - normalizePixKey: CPF '123.456.789-09' -> {type:'cpf', value:'12345678909'}; CNPJ com mascara -> 14 digitos; 'Foo@Bar.com' -> email minusculo; '+55 11 98765-4321' -> {type:'phone', value:'+5511987654321'}; UUID EVP -> minusculo; 'abc' / '' -> null. (Validacao leve: so formato/tamanho, sem digito verificador.) 11 digitos sem '+' = CPF.
    Unit (temporary-password.spec.ts): generatePassword() tem 14 chars, so do alfabeto sem ambiguos; generatePassword(20) tem 20.
    Integracao (members-create.e2e.spec.ts, prefixo 'memcr-' em e-mails/legal_name/display_name, orgs A e B, tokens ADMIN/MANAGER/PROFESSIONAL de A e ADMIN de B, categorias em A e B):
    - ADMIN A createMember PROFESSIONAL com isProfessional:false + 1 categoria de A -> member com isProfessional=true, phone E.164, pixKey normalizada, categories [{id,name}], existingAccount=false; user no banco com mustChangePassword=true e fullName=displayName.
    - login com a senha provisoria -> mustChangePassword=true e membership da org A; changePassword(tmp -> nova) -> login seguinte com mustChangePassword=false.
    - Erros (errors[0].code/field): INVALID_PHONE/phone, INVALID_PIX_KEY/pixKey, WEAK_PASSWORD/temporaryPassword (7 chars), CATEGORY_REQUIRED/categoryIds (profissional sem categoria), CATEGORY_NOT_FOUND/categoryIds (categoria da org B), INVALID_NAME/displayName (1 char).
    - MANAGER A cria ATTENDANT -> ok; MANAGER A cria ADMIN -> FORBIDDEN_ROLE/roleName; PROFESSIONAL A chama createMember -> erro GraphQL de permissao.
    - E-mail de usuario que so existe na org B -> member criado em A, existingAccount=true, warning preenchido, passwordHash e mustChangePassword do user inalterados (comparar antes/depois via adminPrisma).
    - Repetir o mesmo e-mail em A -> MEMBER_ALREADY_EXISTS/email.
    - resetMemberPassword: member so de A -> temporaryPassword (14 chars) no payload, mustChangePassword=true, refresh tokens anteriores com revokedAt, login com a nova senha funciona; member que tambem esta em B -> MEMBER_IN_OTHER_ORGANIZATION; ADMIN resetando a si mesmo -> CANNOT_RESET_SELF; MANAGER -> erro de permissao; id de member da org B com token de A -> MEMBER_NOT_FOUND.
    - updateMember: altera phone/pixKey/birthDate/categoryIds (substitui o conjunto); roleName PROFESSIONAL forca isProfessional=true; isProfessional=false (papel nao PROFESSIONAL) apaga os vinculos de categoria; phone invalido -> INVALID_PHONE; LAST_ADMIN continua funcionando (suite members-lifecycle segue verde).
    - Privacidade: `members`/`allMembers` com token PROFESSIONAL retornam phone/pixKey/birthDate null; com ADMIN/MANAGER retornam os valores.
    - RLS: via appPrisma numa transacao com `SELECT set_config('app.current_organization', <orgB>, true)`, `SELECT count(*) FROM member_categories` nao enxerga vinculos da org A.
  </behavior>
  <action>
    1. Migration `20260929120000_member_contact_and_categories/migration.sql` (somente aditiva, segura para dados reais do staging "Studio JS"):
       - `ALTER TABLE members ADD COLUMN phone varchar(20), ADD COLUMN pix_key varchar(140), ADD COLUMN birth_date date;` (todas nullable, sem default; members antigos ficam null — per CONTEXT "Dados pessoais").
       - `CREATE TABLE member_categories (organization_id uuid NOT NULL, member_id uuid NOT NULL, category_id uuid NOT NULL, created_at timestamptz(6) NOT NULL DEFAULT now(), CONSTRAINT pk_member_categories PRIMARY KEY (member_id, category_id), FK organization -> organizations(id), FK member -> members(id) ON DELETE CASCADE, FK category -> categories(id) ON DELETE CASCADE)`. CASCADE e obrigatorio: suites existentes apagam members/categories por SQL cru no cleanup e quebrariam com FK restritiva. Index `ix_member_categories_org_category (organization_id, category_id)`.
       - ENABLE + FORCE RLS + policy `tenant_isolation` identica ao padrao acima. Grant explicito guardado: `DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname='sgs_app') THEN GRANT SELECT, INSERT, UPDATE, DELETE ON member_categories TO sgs_app; END IF; END $$;` (default privileges ja cobrem, mas o grant explicito protege caso o migrate rode com outro role).
       - Funcao `member_user_org_count(p_user_id uuid) RETURNS integer` SECURITY DEFINER (mesmo padrao de auth_user_memberships: sql STABLE, search_path fixo, REVOKE PUBLIC, GRANT EXECUTE a sgs_app guardado): `SELECT count(DISTINCT organization_id)::int FROM members WHERE user_id = p_user_id AND deleted_at IS NULL`. Necessaria porque members e FORCE RLS e o reset precisa saber se o user pertence a outra org.
    2. schema.prisma: em Member `phone String? @db.VarChar(20)`, `pixKey String? @map("pix_key") @db.VarChar(140)`, `birthDate DateTime? @map("birth_date") @db.Date`, `categories MemberCategory[]`; novo `model MemberCategory { organizationId, memberId, categoryId, createdAt; @@id([memberId, categoryId], name: "pk_member_categories"); @@index([organizationId, categoryId], name: "ix_member_categories_org_category"); @@map("member_categories") }` com relations (onDelete: Cascade em member e category) e back-relations em Organization (`memberCategories`) e Category (`memberLinks`). Aplicar localmente com env carregado: `cd apps/backend && pnpm prisma migrate deploy && pnpm prisma generate`. NAO usar `migrate dev` (pode propor reset). Conferir `pnpm prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url ...` so se houver shadow disponivel; caso contrario, basta o typecheck + integracao verdes.
    3. Extrair `PASSWORD_ALPHABET` + `generatePassword` de admin.service.ts para `src/auth/temporary-password.ts` (export), admin.service.ts passa a importar (comportamento identico). Adicionar `export const TEMP_PASSWORD_MIN = 8; export const TEMP_PASSWORD_MAX = 128;` (politica existente de changePassword).
    4. `src/identity/member-contact.ts`: `normalizeBrPhone(raw): string | null` (remove nao-digitos; se 12-13 digitos e comeca com 55, remove o 55; aceita 10 digitos (fixo) ou 11 digitos com 3o digito '9' (celular); DDD 11-99; retorna `+55${digits}`) e `normalizePixKey(raw): { type: 'cpf'|'cnpj'|'email'|'phone'|'evp'; value: string } | null` (trim; email por regex simples -> lowercase; UUID v4-ish -> lowercase; comecando com '+' -> normalizeBrPhone; so digitos apos remover `.-/` com 11 -> cpf, 14 -> cnpj; resto null). Testes primeiro (RED), depois implementacao.
    5. DTOs (`dto/member.input.ts`): `CreateMemberInput { displayName; email; phone; pixKey; birthDate?: Date|null; roleName ('ADMIN'|'MANAGER'|'ATTENDANT'|'PROFESSIONAL'); isProfessional?: boolean; categoryIds?: string[]; temporaryPassword }`, `ResetMemberPasswordInput { id }`, e `UpdateMemberInput` ganha `phone?`, `pixKey?`, `birthDate?: Date|null`, `categoryIds?: string[]` (class-validator no mesmo estilo; regras de negocio ficam no service como erro-como-dado).
    6. identity.graphql: `Member` ganha `phone: String`, `pixKey: String`, `birthDate: DateTime`, `categories: [MemberCategory!]!`; `type MemberCategory { id: UUID! name: String! }`; `input CreateMemberInput { displayName: String! email: Email! phone: String! pixKey: String! birthDate: DateTime roleName: String! isProfessional: Boolean categoryIds: [UUID!] temporaryPassword: String! }`; `type CreateMemberPayload { member: Member existingAccount: Boolean! warning: String errors: [UserError!]! }` (a senha NAO volta no payload de create — o frontend ja a tem); `input ResetMemberPasswordInput { id: UUID! }`; `type ResetMemberPasswordPayload { member: Member temporaryPassword: String errors: [UserError!]! }`; `UpdateMemberInput` ganha `phone: String pixKey: String birthDate: DateTime categoryIds: [UUID!]`; Mutations `createMember(input: CreateMemberInput!): CreateMemberPayload!` e `resetMemberPassword(input: ResetMemberPasswordInput!): ResetMemberPasswordPayload!`. inviteMember/pendingInvitations/revokeInvitation/acceptInvitation ficam intactos (per CONTEXT: convite permanece no codigo).
    7. members.service.ts:
       - `MEMBER_SELECT` + `phone, pixKey, birthDate, categories: { select: { category: { select: { id, name, deletedAt } } } }`; `toMemberDto` mapeia `categories` filtrando deletedAt!=null e ordenando por nome.
       - `create(orgId, callerRoleName, input)`: valida displayName (trim >= 2, INVALID_NAME), email lowercase/trim, `normalizeBrPhone` (INVALID_PHONE/phone), `normalizePixKey` (INVALID_PIX_KEY/pixKey), role existente isSystem (ROLE_NOT_FOUND), `callerRoleName === 'MANAGER' && roleName === 'ADMIN'` -> FORBIDDEN_ROLE/roleName (per CONTEXT permissoes). `isProfessional = roleName === 'PROFESSIONAL' ? true : !!input.isProfessional` (backend forca, per CONTEXT "Papel x e profissional"). Se profissional: `categoryIds` unicos, >=1 (CATEGORY_REQUIRED) e todos existentes na org com deletedAt null via `tx.category.findMany` sob RLS (CATEGORY_NOT_FOUND); se nao profissional, ignora categoryIds. Dentro de `runWithTenant`: `tx.user.findUnique({ where: { email } })`. Se existe: se ja ha member (qualquer, inclusive deletado) em (orgId, userId) -> MEMBER_ALREADY_EXISTS/email; senao cria so o member (NAO toca passwordHash/mustChangePassword) e retorna `existingAccount: true, warning: 'Essa pessoa já tem conta no SGS e entra com a senha que já usa.'`. Se nao existe: valida senha (trim nao; length entre 8 e 128 -> WEAK_PASSWORD/temporaryPassword) ANTES de abrir a transacao, `hash` com PasswordService (fora da tx — argon2 e lento), cria user `{ email, passwordHash, fullName: displayName, emailVerifiedAt: new Date(), mustChangePassword: true }` (mesmo padrao de admin.service createClient). Cria member (status 'active', seniorityTier null, phone, pixKey normalizada `.value`, birthDate) + `tx.memberCategory.createMany` com organizationId. Capturar `Prisma.PrismaClientKnownRequestError` P2002 -> MEMBER_ALREADY_EXISTS. Validacao da senha so e exigida quando o user e novo (existingAccount ignora a senha).
       - `resetPassword(orgId, callerMemberId, id)`: member em org nao deletado (MEMBER_NOT_FOUND); `id === callerMemberId` -> CANNOT_RESET_SELF; user.isPlatformAdmin -> MEMBER_IN_OTHER_ORGANIZATION; `tx.$queryRaw<{count:number}[]>\`SELECT member_user_org_count(${userId}::uuid) AS count\`` > 1 -> MEMBER_IN_OTHER_ORGANIZATION ('Essa pessoa também trabalha em outro salão; a senha dela não pode ser redefinida por aqui.'); gera `generatePassword()`, grava hash + mustChangePassword true, revoga refresh tokens (`refreshToken.updateMany` revokedAt null -> now), loga `warn` sem a senha; retorna `{ member, temporaryPassword, errors: [] }`.
       - `update`: novos campos — phone/pixKey quando presentes (nao undefined) sao validados (null ou invalido -> INVALID_PHONE / INVALID_PIX_KEY; nao permitir limpar); birthDate aceita null (limpa). Calcular `finalRoleName` e `finalIsProfessional` (PROFESSIONAL forca true); se `finalIsProfessional` false -> `memberCategory.deleteMany({ where: { memberId } })`; se `categoryIds` presente e profissional -> validar existencia (CATEGORY_NOT_FOUND) e substituir o conjunto (deleteMany + createMany). Em edicao lista vazia e permitida (fallback atende tudo). LAST_ADMIN inalterado. seniorityTier continua editavel (usado pelas variacoes de preco — nao quebrar).
       - Privacidade LGPD: helper `redactPersonal(dto, callerRoleName)` zera phone/pixKey/birthDate quando o chamador nao e ADMIN/MANAGER; aplicar no resolver em `members` e `allMembers`.
    8. members.resolver.ts: `createMember` com `@RequirePermission(PERMISSIONS.MEMBER_INVITE)` (passa `tenantCtx.roleName`); `resetMemberPassword` com `MEMBER_EDIT_ROLE` (passa `tenantCtx.memberId`); `members`/`allMembers` aplicam redacao por `tenantCtx.roleName`. Injetar PrismaService no MembersService so se precisar fora da tx (users/refresh_tokens nao tem RLS, podem ir pelo `tx`).
    9. Teste de integracao novo `test/integration/members-create.e2e.spec.ts` seguindo o setup de members-lifecycle.e2e.spec.ts (Test.createTestingModule + override EMAIL_ADAPTER, FastifyAdapter, supertest em /graphql, cleanup por prefixo 'memcr-' antes e depois: member_categories cai por CASCADE; apagar refresh_tokens -> members -> users -> categories -> organizations). Nome precisa terminar em `.spec.ts` com ponto (regex do jest-integration). Cobrir todos os casos do <behavior>.
    Rodar o quality gate completo e commitar: `feat(identity): cadastro direto de membro com senha provisoria e categorias atendidas`.
  </action>
  <verify>
    <automated>cd /root/sgs/apps/backend && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration (com env local carregado linha a linha; ver quality_gate)</automated>
  </verify>
  <done>Migration aplicada no sgs_dev local; createMember/resetMemberPassword/updateMember estendido funcionando com erro-como-dado; unit e integracao completas verdes (todas as suites antigas incluidas); commit feito.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Frontend — dialog "Cadastrar profissional", reset de senha, edicao estendida e lista com categorias</name>
  <files>apps/frontend/src/features/catalog/api/members.api.ts, apps/frontend/src/features/identity/temporary-password.ts, apps/frontend/src/features/identity/member-validation.ts, apps/frontend/src/features/identity/__tests__/member-helpers.test.ts, apps/frontend/src/features/identity/components/CreateMemberDialog.tsx, apps/frontend/src/features/identity/components/MemberCategoriesField.tsx, apps/frontend/src/features/identity/components/ResetMemberPasswordDialog.tsx, apps/frontend/src/features/identity/components/MemberEditDialog.tsx, apps/frontend/src/features/identity/__tests__/member-dialogs.test.tsx, apps/frontend/src/pages/ProfissionaisPage.tsx, apps/frontend/src/pages/__tests__/profissionais-page.test.tsx, apps/frontend/src/infrastructure/i18n/locales/pt-BR.json</files>
  <behavior>
    - generateTemporaryPassword(): 14 chars, so do alfabeto sem ambiguos (mesmo do backend), usa crypto.getRandomValues (com rejection sampling para nao enviesar); duas chamadas geram valores diferentes.
    - normalizeBrPhone / isValidPixKey espelham o backend (mesmos casos principais do spec do backend).
    - CreateMemberDialog: exige nome, e-mail valido, telefone valido, Pix valido, papel e senha >= 8; botao "Gerar" preenche a senha; papel PROFESSIONAL esconde "Também atende clientes" e mostra categorias; ATTENDANT mostra o checkbox desmarcado e so mostra categorias quando marcado; profissional sem categoria bloqueia com mensagem; caller MANAGER nao ve ADMIN nas opcoes; submit envia CreateMemberMutation com isProfessional=true para PROFESSIONAL, telefone normalizado e categoryIds; sucesso -> passo final exibe a senha enviada + botao copiar (navigator.clipboard.writeText) e aviso de exibicao unica; existingAccount -> exibe o warning e NAO exibe senha; erro com field vai para o campo (ex.: email MEMBER_ALREADY_EXISTS), sem field -> toast.
    - ResetMemberPasswordDialog: confirmacao -> chama resetMemberPassword -> mostra temporaryPassword com copiar; erro -> toast e mantem aberto.
    - MemberEditDialog: pre-preenche telefone, Pix, nascimento, categorias, papel, profissional, senioridade; PROFESSIONAL esconde o checkbox; envia os novos campos no UpdateMemberMutation.
    - ProfissionaisPage: ADMIN/MANAGER veem "Cadastrar profissional" (header e empty state), ATTENDANT/PROFESSIONAL nao; sem secao de convites pendentes e sem botao Convidar; colunas nome, e-mail, telefone, papel, categorias (chips; "—" sem categoria), status, acoes; sem coluna senioridade; ADMIN tem acao "Gerar nova senha provisória" no menu.
  </behavior>
  <action>
    1. members.api.ts: adicionar `phone pixKey birthDate categories { id name }` em AllMembersQuery e no retorno de UpdateMemberMutation; `CreateMemberMutation` (member{...mesmos campos} existingAccount warning errors{code message field}) e `ResetMemberPasswordMutation` (member{id} temporaryPassword errors{...}) com interfaces TS (`CreateMemberResult`, `ResetMemberPasswordResult`, `MemberCategoryData`). Estender `AdminMemberData` com `phone?`, `pixKey?`, `birthDate?`, `categories: MemberCategoryData[]`. MembersQuery (pickers) inalterada. Nao remover Invite/PendingInvitations (backend de convite permanece; so sai da UI).
    2. `features/identity/temporary-password.ts` (`generateTemporaryPassword(length = 14)`) e `features/identity/member-validation.ts` (`normalizeBrPhone`, `isValidPixKey`) + `__tests__/member-helpers.test.ts` (RED antes).
    3. `MemberCategoriesField.tsx`: multi-selecao por checkboxes a partir de `CategoriesQuery` (topo + filhos indentados), props `value: string[]`, `onChange`, `error?`; reutilizado no create e no edit.
    4. `CreateMemberDialog.tsx` (react-hook-form + zod + shadcn Dialog/Form/Select/Input/Checkbox, mesmo estilo de InviteMemberDialog): campos Nome, E-mail, Telefone, Chave Pix, Data de nascimento (input type=date, opcional -> ISO), Papel (opcoes = ROLE_OPTIONS sem 'ADMIN' quando `callerRoleName === 'MANAGER'`), "Também atende clientes" (so quando papel != PROFESSIONAL; default false), Categorias (so quando profissional; >=1 obrigatorio no cadastro), Senha provisoria (Input editavel + botao "Gerar" + botao "Copiar"; pre-gerada ao abrir). Submit: telefone via normalizeBrPhone, `isProfessional: roleName === 'PROFESSIONAL' || checkbox`, categoryIds so se profissional. Evict `allMembers` e `members` do cache. Apos sucesso troca para o passo "Senha provisoria" mostrando a senha que foi enviada (ou o warning de existingAccount, sem senha) com texto "Envie essa senha ao profissional (por exemplo, pelo WhatsApp). Ela não será exibida novamente." e botao Concluir; ao fechar, limpar o estado (a senha nao fica guardada em lugar nenhum). Per CONTEXT "Cadastro direto".
    5. `ResetMemberPasswordDialog.tsx`: props `member`, `open`, `onClose`; passo 1 confirmacao ("{{name}} precisará trocar a senha no próximo acesso e será desconectado(a) dos aparelhos."), passo 2 exibe `temporaryPassword` + copiar + aviso de exibicao unica.
    6. MemberEditDialog.tsx: adicionar telefone, Pix, nascimento, MemberCategoriesField (so se profissional; vazio permitido na edicao), esconder checkbox quando PROFESSIONAL (e forcar true no submit), manter senioridade opcional (habilitada so se profissional, como hoje). Enviar os campos novos no input.
    7. ProfissionaisPage.tsx: trocar InviteMemberDialog por CreateMemberDialog (botao "Cadastrar profissional", gate `canInviteMembers`, passando `callerRoleName`), remover `PendingInvitationsQuery`, a tabela de convites, `handleRevoke` e a coluna/label de senioridade; adicionar colunas telefone e categorias (chips com `Badge` existente ou span estilizado); no menu de acoes (so `canManageMembers`) adicionar "Gerar nova senha provisória" abrindo ResetMemberPasswordDialog. Manter o gating de 260929-dek.
    8. pt-BR.json: chaves novas em `team.*` (createDialog, resetPassword, table.phone, table.categories, fields, validation). Nao remover chaves de convite ainda usadas por InviteMemberDialog/AcceptInvitation.
    9. Testes: atualizar `profissionais-page.test.tsx` (Convidar -> Cadastrar profissional; remover testes de convites pendentes e senioridade; adicionar chips de categoria, telefone e acao de reset para ADMIN e ausencia para MANAGER) e `member-dialogs.test.tsx` (manter testes de InviteMemberDialog/DeactivateMemberDialog; adicionar describe CreateMemberDialog, ResetMemberPasswordDialog e casos novos do MemberEditDialog cobrindo o <behavior>, usando MockedProvider como os testes existentes e mock de CategoriesQuery).
    Rodar o quality gate completo (backend inteiro tambem — nada muda la, mas a regra e por commit) e commitar: `feat(equipe): cadastro direto de profissional com senha provisoria e categorias`.
  </action>
  <verify>
    <automated>cd /root/sgs/apps/frontend && pnpm lint && pnpm typecheck && pnpm test (e o gate backend completo, ver quality_gate)</automated>
  </verify>
  <done>Tela /profissionais cadastra, edita e reseta senha sem convite por e-mail; senha exibida uma unica vez; lista com telefone e categorias; vitest completo, lint e typecheck verdes; commit feito.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Agenda — regra "profissional atende a categoria" no backend e filtro do seletor no frontend</name>
  <files>apps/backend/src/identity/member-categories.ts, apps/backend/src/identity/member-categories.spec.ts, apps/backend/src/identity/members.service.ts, apps/backend/src/identity/members.resolver.ts, apps/backend/src/graphql/schema/identity.graphql, apps/backend/src/appointments/appointments.service.ts, apps/backend/test/integration/professional-categories.e2e.spec.ts, apps/frontend/src/features/operations/api/appointments.api.ts, apps/frontend/src/features/operations/professional-filter.ts, apps/frontend/src/features/operations/__tests__/professional-filter.test.ts, apps/frontend/src/features/operations/pages/SchedulePage.tsx</files>
  <behavior>
    Unit backend (member-categories.spec.ts), arvore Cabelo > Penteados > Noiva, Maquiagem:
    - memberServesCategory([], 'penteados', parents) -> true (sem vinculos atende tudo)
    - memberServesCategory(['cabelo'], 'noiva', parents) -> true (descendente)
    - memberServesCategory(['cabelo'], 'cabelo', parents) -> true
    - memberServesCategory(['maquiagem'], 'penteados', parents) -> false
    - memberServesCategory(['penteados'], 'cabelo', parents) -> false (ancestral nao conta)
    - ciclo acidental em parentId nao entra em loop (limite de profundidade / visited set) -> false
    Integracao (professional-categories.e2e.spec.ts, prefixo 'procat-'): org com categorias Cabelo > Penteados e Maquiagem; profissional A vinculado a Cabelo, B a Maquiagem, C sem vinculos, D inativo vinculado a Cabelo, atendente nao profissional; servico em Penteados.
    - professionalsForService(servicoPenteados) -> [A, C] (nao B, nao D, nao atendente); servico inexistente/outra org -> [].
    - createAppointment com B -> errors[0].code 'PROFESSIONAL_DOES_NOT_SERVE_CATEGORY', field 'professionalId'; com A e com C -> criado.
    Unit frontend (professional-filter.test.ts):
    - filterProfessionalsForService(list, null) -> list inteira (sem servico escolhido)
    - filterProfessionalsForService(list, ['a','c']) -> so a e c, preservando a ordem de list
    - shouldClearProfessional('b', ['a','c']) -> true; ('a', ['a','c']) -> false; ('', ...) -> false; (x, null) -> false
  </behavior>
  <action>
    1. `src/identity/member-categories.ts`: `memberServesCategory(memberCategoryIds: readonly string[], serviceCategoryId: string, parentById: ReadonlyMap<string, string | null>): boolean` (vazio -> true; sobe de serviceCategoryId pelos pais com visited set; true se algum id na cadeia estiver no conjunto) e `async professionalServesCategory(tx: TenantPrismaClient, memberId: string, serviceCategoryId: string): Promise<boolean>` (le `memberCategory.findMany({ where: { memberId }, select: { categoryId } })`; se vazio true sem mais queries; senao `category.findMany({ select: { id, parentId } })` da org sob RLS -> Map -> memberServesCategory). Categorias soft-deletadas continuam no mapa de pais (a hierarquia do servico nao deve quebrar se o pai for apagado). Spec primeiro (RED). Per CONTEXT "Categorias atendidas" (descendente e fallback sem vinculo).
    2. members.service.ts `listProfessionalsForService(orgId, serviceId)`: dentro de runWithTenant, busca servico nao deletado (null -> []), membros ativos, nao deletados, isProfessional=true com `MEMBER_SELECT` + `categories { categoryId }` ja presente, carrega o mapa de pais uma unica vez e filtra com memberServesCategory; ordena por displayName; retorna DTOs. identity.graphql: `professionalsForService(serviceId: UUID!): [Member!]!` em Query. Resolver com `@RequirePermission(PERMISSIONS.MEMBER_READ)` (mesmo gate de `members`, que ja alimenta a agenda) e mesma redacao de dados pessoais da Task 1.
    3. appointments.service.ts `create`: depois de validar professional/client/service existentes e ANTES do check de conflito, `if (!(await professionalServesCategory(tx, input.professionalId, service.categoryId))) return errorPayload('PROFESSIONAL_DOES_NOT_SERVE_CATEGORY', 'Este profissional não atende a categoria deste serviço.', 'professionalId')`. Nao mexer no resto (parseAppointmentInterval, exclusao 23P01). Per CONTEXT "Filtro na agenda".
    4. Integracao `test/integration/professional-categories.e2e.spec.ts` (setup igual ao members-lifecycle; cleanup por prefixo antes/depois apagando appointments -> services -> member_categories (cascade) -> members -> refresh_tokens -> users -> categories -> organizations). Conferir que a suite existente que cria agendamento (members-lifecycle) continua verde — os profissionais dela nao tem vinculos, logo atendem tudo.
    5. Frontend `features/operations/api/appointments.api.ts`: `ProfessionalsForServiceQuery` (`professionalsForService(serviceId: $serviceId) { id displayName }`) + tipo `ProfessionalsForServiceResult`. `features/operations/professional-filter.ts`: `filterProfessionalsForService<T extends { id: string }>(list: T[], allowedIds: readonly string[] | null): T[]` e `shouldClearProfessional(selectedId: string, allowedIds: readonly string[] | null): boolean`; testes em `features/operations/__tests__/professional-filter.test.ts` (RED antes).
    6. SchedulePage.tsx `AppointmentModal`: `useQuery<ProfessionalsForServiceResult>(ProfessionalsForServiceQuery, { variables: { serviceId }, skip: !open || !serviceId, fetchPolicy: 'cache-and-network' })`; `allowedIds = serviceId && data ? data.professionalsForService.map(p => p.id) : null`; `visibleProfessionals = filterProfessionalsForService(professionals, allowedIds)` usado no `<select>` de profissional; `useEffect` em `[allowedIds]` que chama `setProfessionalId('')` quando `shouldClearProfessional(professionalId, allowedIds)` (memoizar allowedIds com useMemo para nao disparar em loop); quando `allowedIds` vazio, mostrar abaixo do select "Nenhum profissional atende a categoria deste serviço." Nao alterar a lista `professionals` usada nas colunas da agenda (so o seletor do modal filtra). Erros do backend continuam via toast existente (`errors[0].message`).
    Rodar o quality gate completo (backend + frontend) e commitar: `feat(agenda): filtrar profissional pela categoria do servico`.
  </action>
  <verify>
    <automated>cd /root/sgs/apps/backend && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration; cd /root/sgs/apps/frontend && pnpm lint && pnpm typecheck && pnpm test (env local carregado; ver quality_gate)</automated>
  </verify>
  <done>professionalsForService retorna so quem atende (com fallback sem vinculo); createAppointment recusa profissional fora da categoria; modal da agenda filtra e limpa a selecao; todas as suites backend (unit + integracao) e frontend (vitest) verdes, lint e typecheck limpos; commit feito.</done>
</task>

</tasks>

<verification>
- `psql` local (DIRECT_URL) : `\d member_categories` mostra FKs com ON DELETE CASCADE; `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='member_categories'` -> t, t; `\df member_user_org_count` existe e `has_function_privilege('sgs_app','member_user_org_count(uuid)','execute')` -> t.
- Migration so tem ADD COLUMN nullable / CREATE TABLE / CREATE FUNCTION / CREATE INDEX / GRANT — nenhum DROP, UPDATE ou ALTER de coluna existente (grep no arquivo).
- `git log -3` mostra 3 commits, cada um apos gate completo verde. Nenhum push, nenhum deploy, nenhum comando contra o staging.
- Rotas/backend de convite intactos: `grep -n "inviteMember\|acceptInvitation" apps/backend/src/graphql/schema/identity.graphql` ainda encontra; rota `/convite/:token` ainda no router.
</verification>

<success_criteria>
- Cadastro direto funciona ponta a ponta (cadastro -> senha exibida uma vez -> login -> troca obrigatoria -> dashboard), provado pela integracao.
- Conta existente vira apenas member novo, sem alterar senha; duplicata na mesma org e barrada.
- Reset de senha so para membro exclusivo da org, revogando sessoes.
- PROFESSIONAL implica isProfessional no backend e na UI.
- Categorias vinculadas com RLS forcada; agenda filtra por categoria/descendente com fallback; backend recusa profissional fora da categoria.
- Suites completas verdes em cada commit: backend lint/typecheck/unit/integracao; frontend lint/typecheck/vitest.
</success_criteria>

<output>
After completion, create `.planning/quick/260929-dvr-cadastro-direto-de-profissional-com-senh/260929-dvr-SUMMARY.md`
</output>
