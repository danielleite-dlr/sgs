-- ─── Platform admin ──────────────────────────────────────────────────────────
-- Papel de plataforma, acima dos tenants: é quem cadastra e acompanha os
-- clientes (salões). Não se confunde com a role ADMIN, que é o dono do salão
-- dentro da própria organização.
--
-- Marca no próprio users porque é um atributo do usuário, não uma membership:
-- um platform admin não pertence a organização nenhuma.

ALTER TABLE users
  ADD COLUMN is_platform_admin boolean NOT NULL DEFAULT false;

-- Índice parcial: a lista de platform admins é curta e consultada no login.
CREATE INDEX ix_users_platform_admin
  ON users (id)
  WHERE is_platform_admin;

-- ─── admin_list_clients(uuid) ────────────────────────────────────────────────
-- Lista as organizações para o painel admin.
--
-- organizations e members rodam sob FORCE RLS com tenant_isolation contra
-- app.current_organization, e o platform admin não tem tenant nenhum — logo,
-- uma consulta direta devolveria zero linhas. Mesma saída de
-- auth_user_memberships: SECURITY DEFINER com janela estreita.
--
-- A função confere o próprio chamador: só devolve linhas se p_admin_user_id
-- for mesmo um platform admin. É defesa em profundidade — o guard da API já
-- barra antes, mas aqui não depende da aplicação estar correta.

CREATE OR REPLACE FUNCTION admin_list_clients(p_admin_user_id uuid)
RETURNS TABLE (
  organization_id   uuid,
  trade_name        varchar(255),
  legal_name        varchar(255),
  email             varchar(255),
  subdomain         varchar(63),
  segment           varchar(30),
  status            varchar(20),
  created_at        timestamptz,
  owner_user_id     uuid,
  owner_name        varchar(255),
  owner_email       varchar(255),
  owner_last_login  timestamptz,
  member_count      bigint
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
    o.subdomain,
    o.segment,
    o.status,
    o.created_at,
    owner.user_id,
    owner_user.full_name,
    owner_user.email,
    owner_user.last_login_at,
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

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sgs_app') THEN
    GRANT EXECUTE ON FUNCTION admin_list_clients(uuid) TO sgs_app;
  END IF;
END
$$;
