export const IDENTITY_USER_FIELDS =
  "id, email, display_name, avatar_url, created_at, email_verified_at, user_kind";

export async function configureIdentityTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '10000ms', true)`
  );
}

export async function ensureIdentityFoundation(client, { userId, planCode = "free" }) {
  const result = await client.query(
    `WITH ensured_plan AS (
       INSERT INTO user_plans (user_id, plan_code)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING user_id
     ), ensured_quota AS (
       INSERT INTO storage_quotas (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING user_id
     )
     SELECT plan_code
     FROM user_plans
     WHERE user_id = $1`,
    [userId, planCode]
  );
  return result.rows[0]?.plan_code ?? planCode;
}

export async function applyIdentityPrivileges(client, {
  userId,
  internalBeta = false,
  currentPlan = null
}) {
  if (internalBeta) {
    await client.query(
      `WITH applied_plan AS (
         INSERT INTO user_plans (user_id, plan_code)
         VALUES ($1, 'beta')
         ON CONFLICT (user_id) DO UPDATE
         SET plan_code = 'beta', updated_at = now()
         RETURNING user_id
       )
       UPDATE users
       SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
       WHERE id = $1
         AND EXISTS (SELECT 1 FROM applied_plan)`,
      [userId]
    );
    return { beta: true, internal: true };
  }

  if (currentPlan === "beta") return { beta: true, internal: false };

  const approved = await client.query(
    `WITH approved AS MATERIALIZED (
       SELECT id
       FROM beta_applications
       WHERE lower(email) = (SELECT lower(email) FROM users WHERE id = $1)
         AND status = 'approved'
         AND (user_id IS NULL OR user_id = $1)
       ORDER BY reviewed_at DESC NULLS LAST
       LIMIT 1
       FOR UPDATE
     ), applied_plan AS (
       INSERT INTO user_plans (user_id, plan_code)
       SELECT $1, 'beta'
       FROM approved
       ON CONFLICT (user_id) DO UPDATE
       SET plan_code = 'beta', updated_at = now()
       RETURNING user_id
     )
     UPDATE beta_applications AS application
     SET user_id = $1, updated_at = now()
     FROM approved, applied_plan
     WHERE application.id = approved.id
     RETURNING application.id`,
    [userId]
  );
  return { beta: approved.rowCount > 0, internal: false };
}

export async function readIdentityUser(client, userId) {
  const result = await client.query(
    `SELECT ${IDENTITY_USER_FIELDS}
     FROM users
     WHERE id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function acceptPendingWorldInvitesForVerifiedUser(client, { userId, email }) {
  if (!email) return [];
  const result = await client.query(
    `WITH pending AS MATERIALIZED (
       SELECT id, world_id, role
       FROM world_member_invites
       WHERE lower(email) = lower($2)
         AND accepted_at IS NULL
         AND expires_at > now()
       ORDER BY world_id, id
       FOR UPDATE
     ), accepted_members AS (
       INSERT INTO world_members (world_id, user_id, role)
       SELECT world_id, $1, role
       FROM pending
       ON CONFLICT (world_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING world_id
     ), accepted_invites AS (
       UPDATE world_member_invites invite
       SET accepted_at = now(), accepted_by_user_id = $1
       FROM pending
       WHERE invite.id = pending.id
       RETURNING pending.world_id, pending.role
     )
     SELECT accepted_invites.world_id, accepted_invites.role
     FROM accepted_invites
     JOIN accepted_members USING (world_id)
     ORDER BY accepted_invites.world_id`,
    [userId, email]
  );
  return result.rows.map((row) => ({ worldId: row.world_id, role: row.role }));
}
