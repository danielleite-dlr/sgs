-- Fase 04.2: seed das regras de cronograma do Studio JS.
-- Insere SOMENTE para a organizacao Studio JS (guarda pelo id da org, nunca pelo nome:
-- existe "Studio JS Beauty" suspensa). Em bancos sem essa org afeta 0 linhas.
-- Roda como sgs_migrator (BYPASSRLS). Nunca sobrescreve regra existente (NOT EXISTS
-- por pacote); reexecutar nao duplica. Offsets exatamente como a referencia (D-01);
-- duracao de make/penteado = 90 min (D-06). Servicos buscados DENTRO do pacote por
-- service_id (o Glam tambem tem "Maquiagem pre-wedding" na mesma categoria).
-- Essence, Essencial, Decidida, Ouro Rosa, Spa dos 15 e Make & Penteado (madrinhas)
-- ficam sem regra (fluxo "pacote sem regra").

-- BEGIN SEED 04.2
INSERT INTO package_timeline_steps
  (organization_id, package_id, display_order, is_extra, name, offset_minutes, kind, service_id, duration_minutes, starts_registry)
SELECT p.organization_id, p.id, v.ord, v.extra, v.name, v.off, v.kind,
       CASE v.kind
         WHEN 'make' THEN (SELECT ps.service_id FROM package_services ps JOIN services s ON s.id = ps.service_id
                           WHERE ps.package_id = p.id AND s.name = 'Maquiagem noiva' ORDER BY ps.display_order LIMIT 1)
         WHEN 'hair' THEN (SELECT ps.service_id FROM package_services ps JOIN services s ON s.id = ps.service_id
                           WHERE ps.package_id = p.id AND s.name = 'Penteado noiva' ORDER BY ps.display_order LIMIT 1)
       END,
       CASE WHEN v.kind IS NOT NULL THEN 90 END,
       v.reg
FROM packages p
CROSS JOIN (VALUES
  (0, false, 'chegada - coffee', 420, NULL::varchar, false),
  (1, false, 'massagem', 360, NULL, false),
  (2, false, 'banheira', 300, NULL, false),
  (3, false, 'make', 240, 'make', false),
  (4, false, 'penteado', 150, 'hair', false),
  (5, false, 'making of', 60, NULL, true),
  (6, false, 'saída', 0, NULL, false),
  (7, true, 'Chegada fotógrafos', 80, NULL, false)
) AS v(ord, extra, name, off, kind, reg)
WHERE p.organization_id = '01a0b681-8b9b-790b-921d-4518350e534b'
  AND p.name = 'Experience' AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM package_timeline_steps t WHERE t.package_id = p.id);

INSERT INTO package_timeline_steps
  (organization_id, package_id, display_order, is_extra, name, offset_minutes, kind, service_id, duration_minutes, starts_registry)
SELECT p.organization_id, p.id, v.ord, v.extra, v.name, v.off, v.kind,
       CASE v.kind
         WHEN 'make' THEN (SELECT ps.service_id FROM package_services ps JOIN services s ON s.id = ps.service_id
                           WHERE ps.package_id = p.id AND s.name = 'Maquiagem noiva' ORDER BY ps.display_order LIMIT 1)
         WHEN 'hair' THEN (SELECT ps.service_id FROM package_services ps JOIN services s ON s.id = ps.service_id
                           WHERE ps.package_id = p.id AND s.name = 'Penteado noiva' ORDER BY ps.display_order LIMIT 1)
       END,
       CASE WHEN v.kind IS NOT NULL THEN 90 END,
       v.reg
FROM packages p
CROSS JOIN (VALUES
  (0, false, 'chegada - coffee', 450, NULL::varchar, false),
  (1, false, 'massagem', 390, NULL, false),
  (2, false, 'banheira', 330, NULL, false),
  (3, false, 'make', 270, 'make', false),
  (4, false, 'penteado', 180, 'hair', false),
  (5, false, 'fotos', 90, NULL, true),
  (6, false, 'saída', 0, NULL, false),
  (7, true, 'Chegada fotógrafos', 110, NULL, false)
) AS v(ord, extra, name, off, kind, reg)
WHERE p.organization_id = '01a0b681-8b9b-790b-921d-4518350e534b'
  AND p.name = 'Glam' AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM package_timeline_steps t WHERE t.package_id = p.id);

INSERT INTO package_timeline_steps
  (organization_id, package_id, display_order, is_extra, name, offset_minutes, kind, service_id, duration_minutes, starts_registry)
SELECT p.organization_id, p.id, v.ord, v.extra, v.name, v.off, v.kind,
       CASE v.kind
         WHEN 'make' THEN (SELECT ps.service_id FROM package_services ps JOIN services s ON s.id = ps.service_id
                           WHERE ps.package_id = p.id AND s.name = 'Maquiagem noiva' ORDER BY ps.display_order LIMIT 1)
         WHEN 'hair' THEN (SELECT ps.service_id FROM package_services ps JOIN services s ON s.id = ps.service_id
                           WHERE ps.package_id = p.id AND s.name = 'Penteado noiva' ORDER BY ps.display_order LIMIT 1)
       END,
       CASE WHEN v.kind IS NOT NULL THEN 90 END,
       v.reg
FROM packages p
CROSS JOIN (VALUES
  (0, false, 'chegada - coffee', 360, NULL::varchar, false),
  (1, false, 'lavar cabelo', 300, NULL, false),
  (2, false, 'make', 270, 'make', false),
  (3, false, 'penteado', 180, 'hair', false),
  (4, false, 'fotos', 90, NULL, true),
  (5, false, 'saída', 0, NULL, false),
  (6, true, 'Chegada fotógrafos', 110, NULL, false)
) AS v(ord, extra, name, off, kind, reg)
WHERE p.organization_id = '01a0b681-8b9b-790b-921d-4518350e534b'
  AND p.name = 'Elegance' AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM package_timeline_steps t WHERE t.package_id = p.id);

-- END SEED 04.2
