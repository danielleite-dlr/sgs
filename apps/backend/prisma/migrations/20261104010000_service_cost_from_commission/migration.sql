-- O custo do serviço no pacote passa a vir da comissão (repasse à profissional),
-- que já é a fonte do pagamento no fechamento da comanda. cost_price ficaria
-- duplicado (e divergente) — removido. Estava zerado em todos os ambientes.
ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_services_cost_price;
ALTER TABLE services DROP COLUMN IF EXISTS cost_price;
