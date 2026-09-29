-- Cadastro direto de profissional: contato pessoal no member e categorias atendidas.
-- Migration somente aditiva: nenhuma coluna existente e alterada ou removida.

-- ─── Dados pessoais no member (por organizacao, sob RLS) ─────────────────────
-- Nullable: members antigos ficam com null; a obrigatoriedade e regra da API.
ALTER TABLE members
  ADD COLUMN phone      varchar(20),
  ADD COLUMN pix_key    varchar(140),
  ADD COLUMN birth_date date;

-- ─── member_categories: categorias que o profissional atende ─────────────────
-- ON DELETE CASCADE: cleanups por SQL cru de members/categories nao podem
-- ser barrados por FK restritiva.
CREATE TABLE member_categories (
  organization_id uuid           NOT NULL,
  member_id       uuid           NOT NULL,
  category_id     uuid           NOT NULL,
  created_at      timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_member_categories PRIMARY KEY (member_id, category_id),
  CONSTRAINT fk_member_categories_org
    FOREIGN KEY (organization_id) REFERENCES organizations (id),
  CONSTRAINT fk_member_categories_member
    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
  CONSTRAINT fk_member_categories_category
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
);

CREATE INDEX ix_member_categories_org_category
  ON member_categories (organization_id, category_id);

ALTER TABLE member_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_categories FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON member_categories
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sgs_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON member_categories TO sgs_app;
  END IF;
END
$$;

-- ─── member_user_org_count(uuid) ─────────────────────────────────────────────
-- members e FORCE RLS; o reset de senha precisa saber se o usuario pertence a
-- OUTRA organizacao. Janela fixa e estreita (so devolve uma contagem), mesmo
-- padrao de auth_user_memberships.
CREATE OR REPLACE FUNCTION member_user_org_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(DISTINCT organization_id)::int
  FROM members
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION member_user_org_count(uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sgs_app') THEN
    GRANT EXECUTE ON FUNCTION member_user_org_count(uuid) TO sgs_app;
  END IF;
END
$$;
