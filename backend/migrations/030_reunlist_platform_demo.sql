-- Re-unlist legacy platform demo; idempotent guard against seed/tests re-listing.
UPDATE worlds
SET catalog_public = false,
    catalog_review_status = 'none',
    summary = CASE WHEN summary = 'updated-by-test' THEN '海雾将旧日的来信送回港口。' ELSE summary END,
    updated_at = now()
WHERE id = '11111111-2222-4333-8444-555555550001'
  AND catalog_public = true;
