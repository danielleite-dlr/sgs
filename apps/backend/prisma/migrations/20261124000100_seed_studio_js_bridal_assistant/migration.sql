-- Fase 09.1 — marca os pacotes com assistente da noiva na org Studio JS (01a0b681-8b9b-790b-921d-4518350e534b).
-- Guardado pelo id da organização; em bancos sem essa org afeta 0 linhas; nada é buscado por nome fora da org.
-- Nenhum vínculo de assistente é criado aqui (D-17: "pendente" é derivado do grupo sem assistente).
UPDATE packages SET includes_bridal_assistant = true WHERE organization_id = '01a0b681-8b9b-790b-921d-4518350e534b'::uuid AND deleted_at IS NULL AND name IN ('Decidida','Essencial','Elegance','Essence','Experience','Glam');
-- A diária configurável (R$ 220) substitui o custo manual 'Assistente = R$ 200' de Essence/Experience/Glam (evita custo em dobro). CONFIRMAR COM A USUÁRIA ANTES DO DEPLOY EM STAGING (09.1 Open Question 1).
DELETE FROM package_cost_items WHERE organization_id = '01a0b681-8b9b-790b-921d-4518350e534b'::uuid AND name ILIKE 'assistente%' AND package_id IN (SELECT id FROM packages WHERE organization_id = '01a0b681-8b9b-790b-921d-4518350e534b'::uuid AND includes_bridal_assistant = true);
