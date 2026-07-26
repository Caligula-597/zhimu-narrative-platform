import { query } from "./db.js";

export function buildIdentityFoundationStatus(row = {}) {
  const usersMissingPlan = Number(row.users_missing_plan ?? 0);
  const usersMissingQuota = Number(row.users_missing_quota ?? 0);
  const approvedRegisteredUsersWithoutBeta = Number(
    row.approved_registered_users_without_beta ?? 0
  );
  const approvedApplicationsAwaitingRegistration = Number(
    row.approved_applications_awaiting_registration ?? 0
  );
  return {
    ready:
      usersMissingPlan === 0
      && usersMissingQuota === 0
      && approvedRegisteredUsersWithoutBeta === 0,
    usersMissingPlan,
    usersMissingQuota,
    approvedRegisteredUsersWithoutBeta,
    approvedApplicationsAwaitingRegistration
  };
}

export async function getIdentityFoundationStatus() {
  const result = await query(
    `WITH account_integrity AS (
       SELECT
         COUNT(*) FILTER (WHERE plan.user_id IS NULL)::int AS users_missing_plan,
         COUNT(*) FILTER (WHERE quota.user_id IS NULL)::int AS users_missing_quota
       FROM users account
       LEFT JOIN user_plans plan ON plan.user_id = account.id
       LEFT JOIN storage_quotas quota ON quota.user_id = account.id
     ), approved_beta AS (
       SELECT
         COUNT(*) FILTER (
           WHERE account.id IS NOT NULL
             AND (
               plan.plan_code IS DISTINCT FROM 'beta'
               OR application.user_id IS DISTINCT FROM account.id
             )
         )::int AS approved_registered_users_without_beta,
         COUNT(*) FILTER (WHERE account.id IS NULL)::int
           AS approved_applications_awaiting_registration
       FROM beta_applications application
       LEFT JOIN users account
         ON account.user_kind = 'registered'
        AND lower(account.email) = lower(application.email)
       LEFT JOIN user_plans plan ON plan.user_id = account.id
       WHERE application.status = 'approved'
     )
     SELECT account_integrity.*, approved_beta.*
     FROM account_integrity CROSS JOIN approved_beta`
  );
  return buildIdentityFoundationStatus(result.rows[0]);
}
