-- Quick 261118-gpm: Gerente gerencia a equipe como o Admin (editar papel, desativar, excluir).
DO $$
DECLARE
  v_manager uuid;
BEGIN
  SELECT id INTO v_manager FROM roles WHERE name='MANAGER' AND is_system=true LIMIT 1;

  INSERT INTO role_permissions (role_id, permission) VALUES
    (v_manager, 'member.remove'),
    (v_manager, 'member.editRole')
  ON CONFLICT DO NOTHING;
END $$;
