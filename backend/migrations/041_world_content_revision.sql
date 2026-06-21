ALTER TABLE worlds
  ADD COLUMN IF NOT EXISTS content_revision bigint NOT NULL DEFAULT 1;
