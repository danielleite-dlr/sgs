-- Exclusao definitiva (hard delete) de profissional e de grupo de noiva.
--
-- sgs_app NAO tem UPDATE/DELETE em tabelas append-only (commission_records, audit_log,
-- cash_movements, contract_versions, contract_acceptances, contract_payments,
-- client_credit_movements — REVOKE na migration 20261101000000). A limpeza roda,
-- portanto, em funcoes SECURITY DEFINER (dono sgs_migrator, ignora RLS). Por isso TODA
-- instrucao filtra por organization_id = v_org, e a funcao aborta se
-- app.current_organization estiver vazio. Mesmo padrao de member_user_org_count.

-- ─── purge_member(uuid) ──────────────────────────────────────────────────────
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

-- ─── purge_bridal_group(uuid) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION purge_bridal_group(p_group uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org       uuid := nullif(current_setting('app.current_organization', true), '')::uuid;
  v_appts     uuid[];
  v_contracts uuid[];
  v_comandas  uuid[];
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'tenant ausente';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM bridal_groups WHERE id = p_group AND organization_id = v_org) THEN
    RAISE EXCEPTION 'GROUP_NOT_FOUND';
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_appts
  FROM appointments WHERE organization_id = v_org AND bridal_group_id = p_group;
  SELECT coalesce(array_agg(id), '{}') INTO v_contracts
  FROM contracts WHERE organization_id = v_org AND bridal_group_id = p_group;

  SELECT coalesce(array_agg(DISTINCT x.cid), '{}') INTO v_comandas FROM (
    SELECT ci.comanda_id AS cid FROM comanda_items ci
      WHERE ci.organization_id = v_org
        AND (ci.appointment_id = ANY (v_appts) OR ci.contract_id = ANY (v_contracts))
    UNION
    SELECT a.comanda_id FROM appointments a
      WHERE a.organization_id = v_org AND a.id = ANY (v_appts) AND a.comanda_id IS NOT NULL
  ) x;

  IF EXISTS (
    SELECT 1 FROM comanda_items ci
    WHERE ci.organization_id = v_org AND ci.comanda_id = ANY (v_comandas)
      AND NOT (ci.appointment_id = ANY (v_appts) OR ci.contract_id = ANY (v_contracts))
  ) THEN
    RAISE EXCEPTION 'BRIDAL_SHARED_COMANDA';
  END IF;

  DELETE FROM commission_records WHERE organization_id = v_org AND comanda_id = ANY (v_comandas);
  DELETE FROM cash_movements
    WHERE organization_id = v_org
      AND (comanda_id = ANY (v_comandas) OR contract_id = ANY (v_contracts)
           OR appointment_id = ANY (v_appts));
  DELETE FROM client_credit_movements
    WHERE organization_id = v_org
      AND (comanda_id = ANY (v_comandas) OR appointment_id = ANY (v_appts));
  DELETE FROM comandas WHERE organization_id = v_org AND id = ANY (v_comandas);

  DELETE FROM contract_payments
    WHERE organization_id = v_org AND contract_id = ANY (v_contracts)
      AND reverses_payment_id IS NOT NULL;
  DELETE FROM contract_payments
    WHERE organization_id = v_org AND contract_id = ANY (v_contracts);
  DELETE FROM contract_acceptances WHERE organization_id = v_org AND contract_id = ANY (v_contracts);
  DELETE FROM contract_access_tokens WHERE organization_id = v_org AND contract_id = ANY (v_contracts);
  DELETE FROM contract_versions WHERE organization_id = v_org AND contract_id = ANY (v_contracts);
  DELETE FROM contracts WHERE organization_id = v_org AND id = ANY (v_contracts);

  DELETE FROM appointments WHERE organization_id = v_org AND id = ANY (v_appts);
  DELETE FROM bridal_groups WHERE id = p_group AND organization_id = v_org;
END;
$$;

REVOKE ALL ON FUNCTION purge_bridal_group(uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sgs_app') THEN
    GRANT EXECUTE ON FUNCTION purge_member(uuid) TO sgs_app;
    GRANT EXECUTE ON FUNCTION purge_bridal_group(uuid) TO sgs_app;
  END IF;
END
$$;
