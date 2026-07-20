import { query } from "../db.js";
import { IDENTITY_USER_FIELDS } from "./auth-identity-repository.js";

export async function findLoginCandidate(email) {
  const result = await query(
    `SELECT ${IDENTITY_USER_FIELDS}, password_hash, password_salt
     FROM users
     WHERE email = $1 AND user_kind = 'registered'`,
    [email]
  );
  return result.rows[0] ?? null;
}

export async function lockLoginCandidate(client, userId) {
  const result = await client.query(
    `SELECT ${IDENTITY_USER_FIELDS}, users.password_hash, users.password_salt,
            COALESCE(user_plans.plan_code, 'free') AS plan_code
     FROM users
     LEFT JOIN user_plans ON user_plans.user_id = users.id
     WHERE users.id = $1 AND users.user_kind = 'registered'
     FOR UPDATE OF users`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function findIdentityProfile(userId) {
  const result = await query(
    `SELECT ${IDENTITY_USER_FIELDS}, COALESCE(user_plans.plan_code, 'free') AS plan_code
     FROM users
     LEFT JOIN user_plans ON user_plans.user_id = users.id
     WHERE users.id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function listIdentitySessions(userId, currentSessionId = null) {
  const result = await query(
    `SELECT session.id, session.device_label, session.user_agent, session.created_at,
            session.last_seen_at, session.expires_at,
            (session.id = $2) AS is_current
     FROM auth_sessions session
     JOIN users ON users.id = session.user_id
     WHERE session.user_id = $1
       AND session.revoked_at IS NULL
       AND session.expires_at > now()
     ORDER BY session.last_seen_at DESC`,
    [userId, currentSessionId]
  );
  return result.rows;
}

export async function revokeIdentitySession({ userId, sessionId, currentSessionId }) {
  const statement = sessionId === currentSessionId
    ? `DELETE FROM auth_sessions WHERE id = $1 AND user_id = $2 RETURNING id`
    : `UPDATE auth_sessions
       SET revoked_at = now()
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
       RETURNING id`;
  const result = await query(statement, [sessionId, userId]);
  return Boolean(result.rowCount);
}

export async function revokeOtherIdentitySessions(userId, currentSessionId = null) {
  if (!currentSessionId) {
    await query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);
    return;
  }
  await query(
    `UPDATE auth_sessions
     SET revoked_at = now()
     WHERE user_id = $1 AND revoked_at IS NULL AND id <> $2`,
    [userId, currentSessionId]
  );
}

export async function deleteIdentitySessionsByHashes(tokenHashes) {
  if (!tokenHashes.length) return;
  await query(`DELETE FROM auth_sessions WHERE token_hash = ANY($1::text[])`, [tokenHashes]);
}
