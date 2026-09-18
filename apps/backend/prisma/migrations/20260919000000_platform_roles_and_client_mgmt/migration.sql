-- ─── Papéis de plataforma e gestão de clientes ───────────────────────────────
--
-- is_platform_admin já existia (acesso ao painel). Faltavam duas distinções que
-- o painel passa a exigir:
--
--   is_platform_master     — dono da plataforma. Concede e revoga acesso dos
--                            outros admins. Sempre pode entrar num salão.
--   can_access_client_orgs — permissão de entrar no salão de um cliente. Sem
--                            ela, o admin só enxerga a lista, não acessa dados
--                            do cliente. Master concede.
--
-- must_change_password fecha o ciclo da senha gerada: o cliente entra com a
-- senha temporária e é obrigado a trocar antes de usar o sistema.

ALTER TABLE users
  ADD COLUMN is_platform_master     boolean NOT NULL DEFAULT false,
  ADD COLUMN can_access_client_orgs boolean NOT NULL DEFAULT false,
  ADD COLUMN must_change_password   boolean NOT NULL DEFAULT false;

-- Master implica as duas permissões; quem já é master por definição entra em
-- salão. A checagem fica na aplicação, mas o default aqui evita inconsistência
-- em quem for promovido direto no banco.
UPDATE users SET can_access_client_orgs = true WHERE is_platform_master;

-- ─── auth_user_memberships: agora carrega o status da organização ────────────
-- Suspender um cliente precisa barrar o acesso dele. O status viaja junto da
-- membership para o login e o interceptor de tenant decidirem sem consulta
-- extra — e sem furar o RLS, que continua bloqueando leitura direta.

DROP FUNCTION IF EXISTS auth_user_memberships(uuid);

CREATE FUNCTION auth_user_memberships(p_user_id uuid)
RETURNS TABLE (
  member_id           uuid,
  organization_id     uuid,
  organization_name   varchar(255),
  role_name           varchar(100),
  organization_status varchar(20)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    m.id,
    o.id,
    o.trade_name,
    r.name,
    o.status
  FROM members m
  JOIN organizations o ON o.id = m.organization_id
  JOIN roles r ON r.id = m.role_id
  WHERE m.user_id = p_user_id
    AND m.deleted_at IS NULL
    AND m.status = 'active'
  ORDER BY m.created_at;
$$;

REVOKE ALL ON FUNCTION auth_user_memberships(uuid) FROM PUBLIC;

-- ─── admin_list_clients: telefone e estado da senha do dono ──────────────────
-- O painel edita telefone e precisa mostrar quem ainda não trocou a senha
-- temporária.

DROP FUNCTION IF EXISTS admin_list_clients(uuid);

CREATE FUNCTION admin_list_clients(p_admin_user_id uuid)
RETURNS TABLE (
  organization_id        uuid,
  trade_name             varchar(255),
  legal_name             varchar(255),
  email                  varchar(255),
  phone                  varchar(20),
  subdomain              varchar(63),
  segment                varchar(30),
  status                 varchar(20),
  created_at             timestamptz,
  owner_user_id          uuid,
  owner_name             varchar(255),
  owner_email            varchar(255),
  owner_last_login       timestamptz,
  owner_must_change_pwd  boolean,
  member_count           bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = p_admin_user_id AND u.is_platform_admin
  ) THEN
    RAISE EXCEPTION 'admin_list_clients: user % is not a platform admin', p_admin_user_id
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.trade_name,
    o.legal_name,
    o.email,
    o.phone,
    o.subdomain,
    o.segment,
    o.status,
    o.created_at,
    owner.user_id,
    owner_user.full_name,
    owner_user.email,
    owner_user.last_login_at,
    owner_user.must_change_password,
    (
      SELECT count(*) FROM members m2
      WHERE m2.organization_id = o.id AND m2.deleted_at IS NULL
    )
  FROM organizations o
  LEFT JOIN LATERAL (
    SELECT m.user_id
    FROM members m
    JOIN roles r ON r.id = m.role_id
    WHERE m.organization_id = o.id
      AND m.deleted_at IS NULL
      AND r.name = 'ADMIN'
    ORDER BY m.created_at
    LIMIT 1
  ) owner ON true
  LEFT JOIN users owner_user ON owner_user.id = owner.user_id
  ORDER BY o.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION admin_list_clients(uuid) FROM PUBLIC;

-- ─── admin_list_platform_users(uuid) ─────────────────────────────────────────
-- Só o master enxerga e mexe nos acessos de plataforma. users não é
-- tenant-scoped, mas a função existe para a checagem do papel morar no banco e
-- não só na aplicação.

CREATE OR REPLACE FUNCTION admin_list_platform_users(p_master_user_id uuid)
RETURNS TABLE (
  user_id                uuid,
  full_name              varchar(255),
  email                  varchar(255),
  is_platform_master     boolean,
  can_access_client_orgs boolean,
  last_login_at          timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = p_master_user_id AND u.is_platform_master
  ) THEN
    RAISE EXCEPTION 'admin_list_platform_users: user % is not a platform master', p_master_user_id
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.full_name,
    u.email,
    u.is_platform_master,
    u.can_access_client_orgs,
    u.last_login_at
  FROM users u
  WHERE u.is_platform_admin
  ORDER BY u.is_platform_master DESC, u.full_name;
END;
$$;

REVOKE ALL ON FUNCTION admin_list_platform_users(uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sgs_app') THEN
    GRANT EXECUTE ON FUNCTION auth_user_memberships(uuid) TO sgs_app;
    GRANT EXECUTE ON FUNCTION admin_list_clients(uuid) TO sgs_app;
    GRANT EXECUTE ON FUNCTION admin_list_platform_users(uuid) TO sgs_app;
  END IF;
END
$$;
