-- Backfill (só dados): o pacote escolhido no contrato passa a valer para o grupo de noivas.
-- Até aqui o pacote só entrava na lista da noiva quando era escolhido NO GRUPO; grupos cujo
-- pacote foi escolhido só no contrato (ex.: ALINE SANTOS / CT-2026-001) ficaram com
-- package_id NULL e a noiva sem serviços. Para cada grupo sem pacote, usa o pacote do
-- contrato não cancelado mais recente e adiciona à noiva (purpose 'event') os serviços
-- do pacote que ela ainda não tem. Nunca remove nada; rodar de novo não muda nada.
-- Roda como migrator (BYPASSRLS), então não precisa de app.current_organization.

CREATE TEMP TABLE _bg_pkg_backfill AS
SELECT DISTINCT ON (c.bridal_group_id)
       c.bridal_group_id AS group_id, c.package_id, g.organization_id
  FROM contracts c
  JOIN bridal_groups g ON g.id = c.bridal_group_id
  JOIN packages p ON p.id = c.package_id AND p.deleted_at IS NULL
 WHERE g.package_id IS NULL
   AND c.package_id IS NOT NULL
   AND c.status <> 'cancelled'
 ORDER BY c.bridal_group_id, c.created_at DESC;

UPDATE bridal_groups g
   SET package_id = b.package_id
  FROM _bg_pkg_backfill b
 WHERE g.id = b.group_id;

INSERT INTO bridal_member_services (organization_id, group_member_id, service_id, purpose, sort_order)
SELECT b.organization_id, m.id, ps.service_id, 'event',
       COALESCE((SELECT MAX(x.sort_order) FROM bridal_member_services x WHERE x.group_member_id = m.id), -1)
         + ROW_NUMBER() OVER (PARTITION BY m.id ORDER BY ps.display_order, ps.service_id)
  FROM _bg_pkg_backfill b
  JOIN bridal_group_members m ON m.group_id = b.group_id AND m.role = 'bride'
  JOIN package_services ps ON ps.package_id = b.package_id
  JOIN services s ON s.id = ps.service_id AND s.deleted_at IS NULL
 WHERE NOT EXISTS (
         SELECT 1 FROM bridal_member_services e
          WHERE e.group_member_id = m.id AND e.service_id = ps.service_id AND e.purpose = 'event'
       )
ON CONFLICT ON CONSTRAINT uq_bms_member_service_purpose DO NOTHING;

DROP TABLE _bg_pkg_backfill;
