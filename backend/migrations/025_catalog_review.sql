-- Public catalog: manual review before catalog_public = true
ALTER TABLE worlds
  ADD COLUMN IF NOT EXISTS catalog_review_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS catalog_review_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS catalog_review_note text;

ALTER TABLE worlds DROP CONSTRAINT IF EXISTS worlds_catalog_review_status_check;
ALTER TABLE worlds
  ADD CONSTRAINT worlds_catalog_review_status_check
  CHECK (catalog_review_status IN ('none', 'pending', 'approved', 'rejected'));

UPDATE worlds
SET catalog_review_status = 'approved'
WHERE catalog_public = true AND catalog_review_status = 'none';
