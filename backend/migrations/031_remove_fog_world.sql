-- Remove legacy platform demo world (雾港来信) and related E2E rooms.
DELETE FROM rooms WHERE invite_code IN ('FOG-HARBOR-DEMO', 'FOG-E2E-AUTO');
DELETE FROM worlds WHERE id = '08646748-e4ae-446a-a5e7-ce59ca23ffc3';
