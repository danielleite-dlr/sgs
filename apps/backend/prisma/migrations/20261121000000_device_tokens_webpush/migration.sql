-- Fase 8: Web Push (VAPID) no iPhone. token = endpoint da inscrição; chaves em colunas próprias.
-- Aditiva: linhas fcm existentes ficam com p256dh/auth NULL. RLS da tabela não muda.
ALTER TABLE device_tokens
  ADD COLUMN p256dh VARCHAR(255) NULL,
  ADD COLUMN auth   VARCHAR(255) NULL;

ALTER TABLE device_tokens DROP CONSTRAINT chk_device_tokens_provider;
ALTER TABLE device_tokens ADD CONSTRAINT chk_device_tokens_provider
  CHECK (provider IN ('fcm','expo','webpush'));
ALTER TABLE device_tokens ADD CONSTRAINT chk_device_tokens_webpush_keys
  CHECK (provider <> 'webpush' OR (p256dh IS NOT NULL AND auth IS NOT NULL));
