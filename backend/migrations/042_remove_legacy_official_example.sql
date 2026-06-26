-- Remove the legacy fixture-backed official example from public catalog data.
-- The production official example is configured via OFFICIAL_EXAMPLE_WORLD_ID
-- and currently points at the creator-owned production sample world.
DELETE FROM rooms
WHERE world_id = '33333333-3333-4333-8444-555555550003';

DELETE FROM worlds
WHERE id = '33333333-3333-4333-8444-555555550003';

UPDATE worlds
SET catalog_public = false,
    catalog_review_status = 'none',
    updated_at = now()
WHERE id = '11111111-2222-4333-8444-555555550001';
