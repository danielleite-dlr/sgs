-- Pacote contratado pela noiva, escolhido direto no grupo de noivas.
-- Nullable: grupo sem pacote continua valendo. Pacote é soft delete (deleted_at),
-- então o vínculo histórico permanece; ON DELETE SET NULL só cobre exclusão física.
-- RLS de bridal_groups já cobre a coluna nova.
ALTER TABLE bridal_groups ADD COLUMN package_id uuid NULL;
ALTER TABLE bridal_groups
  ADD CONSTRAINT fk_bridal_groups_package FOREIGN KEY (package_id)
  REFERENCES packages(id) ON DELETE SET NULL;
CREATE INDEX ix_bg_package ON bridal_groups(package_id);
