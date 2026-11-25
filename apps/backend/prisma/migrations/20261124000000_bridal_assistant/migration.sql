-- Fase 09.1 — assistente da noiva: colunas, bloqueio 'acompanhamento' e purge_member atualizada.
-- A migração de dados (marcar pacotes da Studio JS) fica em 20261124000100.

-- A. Colunas
ALTER TABLE members ADD COLUMN is_bridal_assistant BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE packages ADD COLUMN includes_bridal_assistant BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE contract_settings
  ADD COLUMN bridal_assistant_daily_rate NUMERIC(12,2) NOT NULL DEFAULT 220.00,
  ADD CONSTRAINT chk_cs_bridal_assistant_rate
    CHECK (bridal_assistant_daily_rate >= 0 AND bridal_assistant_daily_rate <= 99999.99);
-- FK sem ON DELETE de propósito: SET NULL quebraria chk_bg_assistant_snapshot;
-- purge_member zera as 3 colunas antes de apagar o membro.
ALTER TABLE bridal_groups
  ADD COLUMN assistant_member_id UUID NULL,
  ADD COLUMN assistant_daily_rate NUMERIC(12,2) NULL,
  ADD COLUMN assistant_linked_at TIMESTAMPTZ(6) NULL,
  ADD CONSTRAINT fk_bg_assistant_member FOREIGN KEY (assistant_member_id) REFERENCES members(id),
  ADD CONSTRAINT chk_bg_assistant_snapshot CHECK (
    (assistant_member_id IS NULL) = (assistant_daily_rate IS NULL)
    AND (assistant_member_id IS NULL) = (assistant_linked_at IS NULL)
  );
CREATE INDEX ix_bg_assistant ON bridal_groups (organization_id, assistant_member_id)
  WHERE assistant_member_id IS NOT NULL;

-- B. time_blocks: bloqueio 'acompanhamento' ligado ao grupo (no máximo um por grupo)
ALTER TABLE time_blocks DROP CONSTRAINT chk_time_blocks_kind;
ALTER TABLE time_blocks ADD CONSTRAINT chk_time_blocks_kind
  CHECK (kind IN ('folga','intervalo','feriado','indisponibilidade','deslocamento','acompanhamento'));
ALTER TABLE time_blocks DROP CONSTRAINT chk_time_blocks_travel;
ALTER TABLE time_blocks ADD CONSTRAINT chk_time_blocks_travel
  CHECK ((kind IN ('deslocamento','acompanhamento')) = (bridal_group_id IS NOT NULL));
CREATE UNIQUE INDEX uq_time_blocks_group_escort ON time_blocks (bridal_group_id)
  WHERE kind = 'acompanhamento';

-- C. purge_member (copiada de 20261112000000 + zera o vínculo de assistente)
CREATE OR REPLACE FUNCTION purge_member(p_member uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org   uuid := nullif(current_setting('app.current_organization', true), '')::uuid;
  v_user  uuid;
  v_appts uuid[];
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'tenant ausente';
  END IF;

  SELECT user_id INTO v_user
  FROM members WHERE id = p_member AND organization_id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND';
  END IF;

  -- Defesa: o servico ja bloqueia, mas a funcao nao confia no chamador.
  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE organization_id = v_org AND professional_id = p_member
      AND status IN ('scheduled', 'confirmed', 'in_progress')
  ) OR EXISTS (
    SELECT 1 FROM comanda_items ci
    JOIN comandas c ON c.id = ci.comanda_id AND c.organization_id = v_org
    WHERE ci.organization_id = v_org AND ci.professional_id = p_member
      AND c.status = 'open'
  ) THEN
    RAISE EXCEPTION 'MEMBER_HAS_OPEN_WORK';
  END IF;

  -- 09.1: a profissional pode ser assistente de um grupo; o vínculo é zerado (as 3 colunas
  -- juntas, por causa de chk_bg_assistant_snapshot) antes de apagar o membro.
  UPDATE bridal_groups
     SET assistant_member_id = NULL, assistant_daily_rate = NULL, assistant_linked_at = NULL
   WHERE organization_id = v_org AND assistant_member_id = p_member;

  SELECT coalesce(array_agg(id), '{}') INTO v_appts
  FROM appointments WHERE organization_id = v_org AND professional_id = p_member;

  UPDATE cash_movements SET appointment_id = NULL
    WHERE organization_id = v_org AND appointment_id = ANY (v_appts);
  UPDATE client_credit_movements SET appointment_id = NULL
    WHERE organization_id = v_org AND appointment_id = ANY (v_appts);

  DELETE FROM commission_records WHERE organization_id = v_org AND member_id = p_member;
  DELETE FROM comanda_items WHERE organization_id = v_org AND professional_id = p_member;
  DELETE FROM appointments WHERE organization_id = v_org AND id = ANY (v_appts);
  DELETE FROM commission_rules WHERE organization_id = v_org AND member_id = p_member;
  DELETE FROM time_blocks WHERE organization_id = v_org AND professional_id = p_member;
  DELETE FROM notifications WHERE organization_id = v_org AND member_id = p_member;

  -- Colunas de autoria/ator: viram NULL.
  UPDATE appointments SET cancelled_by = NULL WHERE organization_id = v_org AND cancelled_by = p_member;
  UPDATE ai_schedule_suggestions SET created_by = NULL WHERE organization_id = v_org AND created_by = p_member;
  UPDATE audit_log SET actor_member_id = NULL WHERE organization_id = v_org AND actor_member_id = p_member;
  UPDATE bridal_groups SET created_by = NULL WHERE organization_id = v_org AND created_by = p_member;
  UPDATE cash_movements SET member_id = NULL WHERE organization_id = v_org AND member_id = p_member;
  UPDATE client_credit_movements SET created_by = NULL WHERE organization_id = v_org AND created_by = p_member;
  UPDATE comanda_items SET created_by = NULL WHERE organization_id = v_org AND created_by = p_member;
  UPDATE comanda_payments SET member_id = NULL WHERE organization_id = v_org AND member_id = p_member;
  UPDATE comandas SET opened_by = NULL WHERE organization_id = v_org AND opened_by = p_member;
  UPDATE comandas SET closed_by = NULL WHERE organization_id = v_org AND closed_by = p_member;
  UPDATE contract_settings SET updated_by = NULL WHERE organization_id = v_org AND updated_by = p_member;
  UPDATE contracts SET cancelled_by = NULL WHERE organization_id = v_org AND cancelled_by = p_member;
  UPDATE contracts SET created_by = NULL WHERE organization_id = v_org AND created_by = p_member;
  UPDATE contract_access_tokens SET created_by = NULL WHERE organization_id = v_org AND created_by = p_member;
  UPDATE contract_letterheads SET uploaded_by = NULL WHERE organization_id = v_org AND uploaded_by = p_member;
  UPDATE contract_payments SET member_id = NULL WHERE organization_id = v_org AND member_id = p_member;
  UPDATE contract_versions SET created_by = NULL WHERE organization_id = v_org AND created_by = p_member;
  UPDATE stock_movements SET performed_by = NULL WHERE organization_id = v_org AND performed_by = p_member;
  UPDATE time_blocks SET created_by = NULL WHERE organization_id = v_org AND created_by = p_member;

  DELETE FROM members WHERE id = p_member AND organization_id = v_org;

  -- Conta so some quando nao pertence a nenhuma outra organizacao (sem filtro de org:
  -- e justamente a pergunta).
  IF NOT EXISTS (SELECT 1 FROM members WHERE user_id = v_user) THEN
    DELETE FROM refresh_tokens WHERE user_id = v_user;
    DELETE FROM email_verification_tokens WHERE user_id = v_user;
    DELETE FROM users WHERE id = v_user;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION purge_member(uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sgs_app') THEN
    GRANT EXECUTE ON FUNCTION purge_member(uuid) TO sgs_app;
  END IF;
END
$$;
