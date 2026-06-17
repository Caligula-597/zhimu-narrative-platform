-- Stop listing the legacy platform demo world in the public catalog.
UPDATE worlds
SET catalog_public = false,
    catalog_review_status = 'none',
    updated_at = now()
WHERE id = '11111111-2222-4333-8444-555555550001';
