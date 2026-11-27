-- Fase 11 (gap G-01): papel de sistema "Assistente" — só acompanha noiva/debutante no estúdio.
-- Sem login e sem permissões: nenhuma linha em role_permissions. Não altera members existentes.
INSERT INTO roles (id, organization_id, name, description, is_system)
SELECT gen_uuid_v7(), NULL, 'ASSISTANT', 'Assistente de noiva/debutante (não entra no sistema)', true
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'ASSISTANT' AND is_system = true);
