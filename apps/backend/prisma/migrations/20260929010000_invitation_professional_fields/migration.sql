ALTER TABLE member_invitations
  ADD COLUMN is_professional boolean NOT NULL DEFAULT false,
  ADD COLUMN seniority_tier  varchar(20);
