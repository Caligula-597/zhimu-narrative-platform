import { IDENTITY_USER_FIELDS } from "./auth-identity-repository.js";

export async function lockAccountCreationRate(client, { ipHash, accountKind }) {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtextextended('account-create:' || $1 || ':' || $2, 0))`,
    [ipHash, accountKind]
  );
}

export async function countRecentAccountCreations(client, { ipHash, accountKind, windowHours }) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM auth_account_creation_events
     WHERE ip_hash = $1
       AND account_kind = $2
       AND created_at > now() - ($3::text || ' hours')::interval`,
    [ipHash, accountKind, String(windowHours)]
  );
  return result.rows[0]?.count ?? 0;
}

export async function countRecentGuestAccountCreations(client, { ipHash }) {
  const result = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS hour_count,
       COUNT(*)::int AS day_count
     FROM auth_account_creation_events
     WHERE ip_hash = $1
       AND account_kind = 'guest'
       AND created_at > now() - interval '24 hours'`,
    [ipHash]
  );
  return {
    hourCount: result.rows[0]?.hour_count ?? 0,
    dayCount: result.rows[0]?.day_count ?? 0
  };
}

export async function recordAccountCreation(client, { userId, ipHash, accountKind }) {
  await client.query(
    `INSERT INTO auth_account_creation_events (user_id, ip_hash, account_kind)
     VALUES ($1, $2, $3)`,
    [userId, ipHash, accountKind]
  );
}

export async function insertRegisteredUser(client, {
  email,
  displayName,
  passwordHash,
  passwordSalt,
  emailVerified
}) {
  const result = await client.query(
    `INSERT INTO users
       (email, display_name, password_hash, password_salt, email_verified_at, user_kind)
     VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN now() ELSE NULL END, 'registered')
     RETURNING ${IDENTITY_USER_FIELDS}`,
    [email, displayName, passwordHash, passwordSalt, emailVerified]
  );
  return result.rows[0];
}

export async function insertGuestUser(client, displayName) {
  const result = await client.query(
    `INSERT INTO users (display_name, user_kind, email)
     VALUES ($1, 'guest', NULL)
     RETURNING ${IDENTITY_USER_FIELDS}`,
    [displayName]
  );
  return result.rows[0];
}

export async function lockRegistrationUser(client, userId) {
  const result = await client.query(
    `SELECT ${IDENTITY_USER_FIELDS}, password_hash, password_salt
     FROM users
     WHERE id = $1
     FOR UPDATE`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function upgradeGuestUser(client, {
  userId,
  email,
  displayName,
  passwordHash,
  passwordSalt,
  emailVerified
}) {
  const result = await client.query(
    `UPDATE users
     SET email = $2,
         display_name = $3,
         password_hash = $4,
         password_salt = $5,
         user_kind = 'registered',
         email_verified_at = CASE
           WHEN $6 THEN COALESCE(email_verified_at, now())
           ELSE NULL
         END,
         updated_at = now()
     WHERE id = $1 AND user_kind = 'guest'
     RETURNING ${IDENTITY_USER_FIELDS}`,
    [userId, email, displayName, passwordHash, passwordSalt, emailVerified]
  );
  return result.rows[0] ?? null;
}

export async function revokeAllIdentitySessions(client, userId) {
  await client.query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);
}
