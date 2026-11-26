-- Quick 261126-fgp — busca indexada do refresh token.
-- Logout e renovação comparavam o token com todos os refresh tokens vivos via Argon2 (~70 ms cada):
-- 84 ativos no staging = ~6 s para sair. lookup_hash = sha256 hex do token (64 bytes aleatórios),
-- único e indexado. Tokens antigos ficam NULL e usam a busca antiga até vencer (30 dias).
ALTER TABLE refresh_tokens ADD COLUMN lookup_hash VARCHAR(64) NULL;
CREATE UNIQUE INDEX ux_refresh_tokens_lookup_hash ON refresh_tokens (lookup_hash);
