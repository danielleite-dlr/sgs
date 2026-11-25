-- Fase 09.1 — marca os pacotes com assistente da noiva na org Studio JS (01a0b681-8b9b-790b-921d-4518350e534b).
-- Guardado pelo id da organização; em bancos sem essa org afeta 0 linhas; nada é buscado por nome fora da org.
-- Nenhum vínculo de assistente é criado aqui (D-17: "pendente" é derivado do grupo sem assistente).
UPDATE packages SET includes_bridal_assistant = true WHERE organization_id = '01a0b681-8b9b-790b-921d-4518350e534b'::uuid AND deleted_at IS NULL AND name IN ('Decidida','Essencial','Elegance','Essence','Experience','Glam');
-- O custo manual 'Assistente = R$ 200' de Essence/Experience/Glam é mantido: é um custo real, separado da diária (decisão da usuária em 2026-11-24).
