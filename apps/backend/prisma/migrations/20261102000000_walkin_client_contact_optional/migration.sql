-- Migration: 20261102000000_walkin_client_contact_optional
-- D-06 (Fase 3): comanda walk-in abre com cliente minimo (so nome; telefone opcional).
-- A exigencia de telefone OU e-mail continua valendo no cadastro completo
-- (ClientsService.create); o banco deixa de impor a regra para permitir o walk-in.
ALTER TABLE clients DROP CONSTRAINT IF EXISTS chk_clients_contact;
