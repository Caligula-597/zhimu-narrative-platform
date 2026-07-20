import { query } from "../db.js";
import { IDENTITY_USER_FIELDS } from "./auth-identity-repository.js";

export async function insertOAuthState({
  stateHash,
  providerId,
  guestUserId,
  expiresAt,
  returnOrigin
}, executor = query) {
  await executor(
    `INSERT INTO oauth_states (state_hash, provider, guest_user_id, expires_at, return_origin)
     VALUES ($1, $2, $3, $4, $5)`,
    [stateHash, providerId, guestUserId, expiresAt, returnOrigin]
  );
}

export async function deleteValidOAuthState({ stateHash, providerId }, executor = query) {
  const result = await executor(
    `DELETE FROM oauth_states
     WHERE state_hash = $1 AND provider = $2 AND expires_at > now()
     RETURNING guest_user_id, return_origin`,
    [stateHash, providerId]
  );
  return result.rows[0] ?? null;
}

export async function lockOAuthIdentity(client, { providerId, providerUserId }) {
  await client.query(
    `SELECT pg_advisory_xact_lock(
       hashtextextended('oauth-identity:' || $1 || ':' || $2, 0)
     )`,
    [providerId, providerUserId]
  );
}

export async function findOAuthAccountForUpdate(client, { providerId, providerUserId }) {
  const result = await client.query(
    `SELECT account.user_id, account.email AS oauth_email,
            ${IDENTITY_USER_FIELDS.split(", ").map((field) => `users.${field}`).join(", ")}
     FROM oauth_accounts account
     JOIN users ON users.id = account.user_id
     WHERE account.provider = $1 AND account.provider_user_id = $2
     FOR UPDATE OF account, users`,
    [providerId, providerUserId]
  );
  return result.rows[0] ?? null;
}

export async function updateOAuthAccountProfile(client, {
  providerId,
  providerUserId,
  email,
  profileJson
}) {
  await client.query(
    `UPDATE oauth_accounts
     SET email = COALESCE($3, email), profile = $4::jsonb, updated_at = now()
     WHERE provider = $1 AND provider_user_id = $2`,
    [providerId, providerUserId, email, profileJson]
  );
}

export async function listRegisteredUsersByEmailForUpdate(client, email) {
  const result = await client.query(
    `SELECT ${IDENTITY_USER_FIELDS}
     FROM users
     WHERE lower(email) = lower($1) AND user_kind = 'registered'
     ORDER BY id
     LIMIT 2
     FOR UPDATE`,
    [email]
  );
  return result.rows;
}

export async function lockOAuthEmailAndListRegisteredUsers(client, email) {
  const result = await client.query(
    `WITH email_lock AS MATERIALIZED (
       SELECT pg_advisory_xact_lock(hashtextextended('oauth-email:' || lower($1), 0))
     )
     SELECT ${IDENTITY_USER_FIELDS}
     FROM users
     CROSS JOIN email_lock
     WHERE lower(email) = lower($1) AND user_kind = 'registered'
     ORDER BY id
     LIMIT 2
     FOR UPDATE OF users`,
    [email]
  );
  return result.rows;
}

export async function lockOAuthGuest(client, userId) {
  const result = await client.query(
    `SELECT ${IDENTITY_USER_FIELDS}
     FROM users
     WHERE id = $1
     FOR UPDATE`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function upgradeOAuthGuest(client, { userId, email, displayName }) {
  const result = await client.query(
    `UPDATE users
     SET email = $2,
         display_name = COALESCE(NULLIF(display_name, ''), $3),
         user_kind = 'registered',
         email_verified_at = COALESCE(email_verified_at, now()),
         updated_at = now()
     WHERE id = $1 AND user_kind = 'guest'
     RETURNING ${IDENTITY_USER_FIELDS}`,
    [userId, email, displayName]
  );
  return result.rows[0] ?? null;
}

export async function insertOAuthUser(client, { email, displayName }) {
  const result = await client.query(
    `INSERT INTO users (email, display_name, user_kind, email_verified_at)
     VALUES ($1, $2, 'registered', now())
     ON CONFLICT (email) DO NOTHING
     RETURNING ${IDENTITY_USER_FIELDS}`,
    [email, displayName]
  );
  return result.rows[0] ?? null;
}

export async function markOAuthUserEmailVerified(client, userId) {
  const result = await client.query(
    `UPDATE users
     SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
     WHERE id = $1
     RETURNING ${IDENTITY_USER_FIELDS}`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function linkOAuthAccount(client, {
  providerId,
  providerUserId,
  userId,
  email,
  profileJson
}) {
  const result = await client.query(
    `INSERT INTO oauth_accounts (provider, provider_user_id, user_id, email, profile)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (provider, provider_user_id)
     DO UPDATE SET email = EXCLUDED.email, profile = EXCLUDED.profile, updated_at = now()
     WHERE oauth_accounts.user_id = EXCLUDED.user_id
     RETURNING user_id`,
    [providerId, providerUserId, userId, email, profileJson]
  );
  return result.rows[0]?.user_id ?? null;
}

export async function deleteOAuthUserSessions(client, userId) {
  await client.query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);
}

export async function insertOAuthLoginCode(client, { codeHash, userId, expiresAt }) {
  await client.query(
    `INSERT INTO oauth_login_codes (code_hash, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [codeHash, userId, expiresAt]
  );
}

export async function deleteValidOAuthLoginCode(client, codeHash) {
  const result = await client.query(
    `DELETE FROM oauth_login_codes
     WHERE code_hash = $1 AND expires_at > now()
     RETURNING user_id`,
    [codeHash]
  );
  return result.rows[0]?.user_id ?? null;
}
