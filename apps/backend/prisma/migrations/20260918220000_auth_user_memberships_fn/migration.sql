-- ─── auth_user_memberships(uuid) ──────────────────────────────────────────────
-- Resolve as memberships de um usuário no login, antes de existir tenant.
--
-- O problema: members e organizations rodam com FORCE ROW LEVEL SECURITY e a
-- policy tenant_isolation confere a linha contra app.current_organization. No
-- login não há tenant context ainda — é justamente a organização que se quer
-- descobrir —, então a consulta do runtime (sgs_app, sem BYPASSRLS) devolvia
-- zero linhas e o JWT saía sem organização, deixando o app vazio.
--
-- A saída é esta função SECURITY DEFINER: ela roda com os privilégios do dono
-- (sgs_migrator, BYPASSRLS), então enxerga as linhas, mas só devolve as do
-- p_user_id pedido e apenas as colunas necessárias para montar a sessão. Não
-- é um bypass geral do RLS: é uma janela fixa e estreita.
--
-- Cuidados aplicados:
--   - search_path fixo, para a função não resolver nomes por um schema
--     plantado pelo chamador;
--   - EXECUTE revogado de PUBLIC e concedido só a sgs_app;
--   - STABLE e sem escrita.

CREATE OR REPLACE FUNCTION auth_user_memberships(p_user_id uuid)
RETURNS TABLE (
  member_id         uuid,
  organization_id   uuid,
  organization_name varchar(255),
  role_name         varchar(100)
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
    r.name
  FROM members m
  JOIN organizations o ON o.id = m.organization_id
  JOIN roles r ON r.id = m.role_id
  WHERE m.user_id = p_user_id
    AND m.deleted_at IS NULL
    AND m.status = 'active'
  ORDER BY m.created_at;
$$;

REVOKE ALL ON FUNCTION auth_user_memberships(uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sgs_app') THEN
    GRANT EXECUTE ON FUNCTION auth_user_memberships(uuid) TO sgs_app;
  END IF;
END
$$;
