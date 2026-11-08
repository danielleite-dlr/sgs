-- 261108-n2o: teste da noiva incluso no pacote.
-- package_services.includes_trial: o serviço do pacote inclui o teste (prova) no valor do
--   pacote. No contrato novo, o valor rateado do serviço vira metade teste + metade evento
--   (centavo ímpar no evento); o total do pacote não muda.
-- contract_items.settled_at_event: item 'trial' do pacote cujo valor é cobrado na comanda do
--   evento (a comanda do teste sai a R$ 0,00). Teste avulso continua cobrado no dia.
ALTER TABLE package_services ADD COLUMN includes_trial boolean NOT NULL DEFAULT false;
ALTER TABLE contract_items ADD COLUMN settled_at_event boolean NOT NULL DEFAULT false;

-- Backfill (261108-n2o): pacotes de noiva do Studio JS no staging. Em dev/CI a org não
-- existe e o UPDATE não afeta nada. Contratos existentes NÃO são tocados.
UPDATE package_services ps SET includes_trial = true
  FROM packages p, services s
 WHERE ps.package_id = p.id AND ps.service_id = s.id
   AND p.organization_id = '01a0b681-8b9b-790b-921d-4518350e534b'
   AND p.deleted_at IS NULL
   AND p.name IN ('Essence', 'Experience', 'Glam')
   AND s.name IN ('Maquiagem noiva', 'Penteado noiva');
