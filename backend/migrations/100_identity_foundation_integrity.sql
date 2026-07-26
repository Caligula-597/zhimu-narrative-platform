-- Repair identity foundation rows for legacy/directly-created accounts and
-- reconcile already-approved beta applications with registered identities.

INSERT INTO user_plans (user_id, plan_code)
SELECT id, 'free'
FROM users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO storage_quotas (user_id)
SELECT id
FROM users
ON CONFLICT (user_id) DO NOTHING;

UPDATE user_plans plan
SET plan_code = 'beta',
    updated_at = now()
FROM users account
WHERE plan.user_id = account.id
  AND account.user_kind = 'registered'
  AND EXISTS (
    SELECT 1
    FROM beta_applications application
    WHERE application.status = 'approved'
      AND lower(application.email) = lower(account.email)
  );

UPDATE beta_applications application
SET user_id = account.id,
    updated_at = now()
FROM users account
WHERE application.status = 'approved'
  AND account.user_kind = 'registered'
  AND lower(application.email) = lower(account.email)
  AND application.user_id IS DISTINCT FROM account.id;
