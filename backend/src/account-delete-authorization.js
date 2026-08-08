import { verifyPassword } from "./auth.js";
import { throwErr } from "./api-errors.js";
import { query } from "./db.js";

export const ACCOUNT_DELETE_RECENT_SESSION_MS = 10 * 60 * 1000;

function hasPasswordCredential(row) {
  return Boolean(row?.password_hash && row?.password_salt);
}

function recentSessionEligible(row, now = Date.now()) {
  if (!row?.session_id || !row?.session_created_at) return false;
  const createdAt = new Date(row.session_created_at).getTime();
  return Number.isFinite(createdAt)
    && createdAt >= now - ACCOUNT_DELETE_RECENT_SESSION_MS
    && createdAt <= now + 30_000;
}

async function readAuthorizationState(userId, sessionId, executor = query) {
  const result = await executor(
    `SELECT users.id, users.password_hash, users.password_salt,
            session.id AS session_id, session.created_at AS session_created_at
     FROM users
     LEFT JOIN auth_sessions session
       ON session.id = $2
      AND session.user_id = users.id
      AND session.revoked_at IS NULL
      AND session.expires_at > now()
     WHERE users.id = $1`,
    [userId, sessionId || null]
  );
  const row = result.rows[0];
  if (!row) throwErr("USER_NOT_FOUND");
  return row;
}

export async function buildAccountDeleteReauthentication(userId, sessionId, {
  executor = query,
  now = Date.now()
} = {}) {
  const row = await readAuthorizationState(userId, sessionId, executor);
  if (hasPasswordCredential(row)) {
    return {
      mode: "password",
      recentSessionEligible: false,
      recentSessionWindowSeconds: ACCOUNT_DELETE_RECENT_SESSION_MS / 1000
    };
  }
  return {
    mode: "recent_session",
    recentSessionEligible: recentSessionEligible(row, now),
    recentSessionWindowSeconds: ACCOUNT_DELETE_RECENT_SESSION_MS / 1000
  };
}

export async function authorizeAccountDeletion({
  userId,
  sessionId,
  password,
  executor = query,
  now = Date.now()
}) {
  const row = await readAuthorizationState(userId, sessionId, executor);
  if (hasPasswordCredential(row)) {
    const valid = await verifyPassword(
      String(password ?? ""),
      row.password_hash,
      row.password_salt
    );
    if (!valid) throwErr("ACCOUNT_DELETE_REAUTHENTICATION_REQUIRED");
    return {
      mode: "password",
      passwordHash: row.password_hash,
      passwordSalt: row.password_salt
    };
  }
  if (!recentSessionEligible(row, now)) {
    throwErr("ACCOUNT_DELETE_REAUTHENTICATION_REQUIRED");
  }
  return {
    mode: "recent_session",
    sessionId: row.session_id,
    sessionCreatedAt: new Date(row.session_created_at).toISOString()
  };
}

export async function assertAccountDeleteAuthorizationProof(
  client,
  userId,
  proof,
  now = Date.now()
) {
  if (!proof || !["password", "recent_session"].includes(proof.mode)) {
    throwErr("ACCOUNT_DELETE_REAUTHENTICATION_REQUIRED");
  }
  const locked = await client.query(
    `SELECT id, password_hash, password_salt
     FROM users
     WHERE id = $1
     FOR UPDATE`,
    [userId]
  );
  const user = locked.rows[0];
  if (!user) throwErr("USER_NOT_FOUND");

  if (proof.mode === "password") {
    if (
      !hasPasswordCredential(user)
      || user.password_hash !== proof.passwordHash
      || user.password_salt !== proof.passwordSalt
    ) {
      throwErr("ACCOUNT_DELETE_REAUTHENTICATION_REQUIRED");
    }
    return;
  }

  if (hasPasswordCredential(user) || !proof.sessionId) {
    throwErr("ACCOUNT_DELETE_REAUTHENTICATION_REQUIRED");
  }
  const session = await client.query(
    `SELECT id, created_at AS session_created_at
     FROM auth_sessions
     WHERE id = $1
       AND user_id = $2
       AND revoked_at IS NULL
       AND expires_at > now()`,
    [proof.sessionId, userId]
  );
  const row = {
    session_id: session.rows[0]?.id,
    session_created_at: session.rows[0]?.session_created_at
  };
  if (!recentSessionEligible(row, now)) {
    throwErr("ACCOUNT_DELETE_REAUTHENTICATION_REQUIRED");
  }
}
