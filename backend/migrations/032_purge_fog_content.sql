-- Purge any remaining 雾港来信 rows (world, rooms, invite codes).
DELETE FROM rooms WHERE invite_code IN ('FOG-HARBOR-DEMO', 'FOG-E2E-AUTO') OR name ILIKE '%雾港%';
DELETE FROM worlds WHERE id = '08646748-e4ae-446a-a5e7-ce59ca23ffc3' OR name = '雾港来信';
