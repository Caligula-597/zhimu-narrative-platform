-- Allow internal beta plan tier (elevated quotas for closed testing).

ALTER TABLE user_plans DROP CONSTRAINT IF EXISTS user_plans_plan_code_check;
ALTER TABLE user_plans ADD CONSTRAINT user_plans_plan_code_check
  CHECK (plan_code IN ('free', 'creator', 'studio', 'beta'));

-- Dev fixture accounts and *.zhimu.local get beta by default.
UPDATE user_plans up
SET plan_code = 'beta', updated_at = now()
FROM users u
WHERE u.id = up.user_id
  AND (
    u.email LIKE '%@zhimu.local'
    OR u.email IN ('host@zhimu.local', 'player@zhimu.local')
  );
