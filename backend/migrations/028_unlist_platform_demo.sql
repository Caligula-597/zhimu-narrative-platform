-- Stop listing the legacy platform demo world in the public catalog.
UPDATE worlds
SET catalog_public = false,
    catalog_review_status = 'none',
    updated_at = now()
WHERE id = '08646748-e4ae-446a-a5e7-ce59ca23ffc3';
