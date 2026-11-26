-- Fase 11 — prioridade de profissionais: marcações na profissional e limite das acompanhantes. Sem migração de dados (D-03).
ALTER TABLE members
  ADD COLUMN is_fixed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN serves_bridal BOOLEAN NOT NULL DEFAULT false;
-- NULL = igual ao make-off (início do registro do cronograma confirmado), D-14.
ALTER TABLE bridal_groups ADD COLUMN companions_ready_by TIMESTAMPTZ(6) NULL;
