ALTER TABLE worlds
  ADD COLUMN IF NOT EXISTS catalog_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_worlds_catalog_public
  ON worlds (catalog_public, updated_at DESC)
  WHERE catalog_public = true AND status <> 'archived';

-- 平台示例剧本《雾港来信》（与 seed / E2E fixture 同 ID）
UPDATE worlds
SET catalog_public = true
WHERE id = '08646748-e4ae-446a-a5e7-ce59ca23ffc3';
