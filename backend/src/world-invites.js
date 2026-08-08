import { randomBytes, createHash } from "node:crypto";
import { query, transaction } from "./db.js";
import { USER_KIND } from "./capabilities.js";
import { throwErr } from "./api-errors.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createWorldMemberInvite({ worldId, email, role, invitedByUserId }) {
  const normalized = email.trim().toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await query(
    `DELETE FROM world_member_invites
     WHERE world_id = $1 AND lower(email) = $2 AND accepted_at IS NULL`,
    [worldId, normalized]
  );

  const result = await query(
    `INSERT INTO world_member_invites (world_id, email, role, token_hash, invited_by_user_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, world_id, email, role, expires_at, created_at`,
    [worldId, normalized, role, tokenHash(token), invitedByUserId, expiresAt]
  );

  return { ...result.rows[0], token };
}

export async function acceptWorldMemberInviteToken(
  userId,
  token,
  { transactionRunner = transaction } = {}
) {
  return transactionRunner(async (client) => {
    const kindResult = await client.query(
      `SELECT user_kind, email FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );
    if (!kindResult.rowCount) throwErr("USER_NOT_FOUND");
    if (kindResult.rows[0].user_kind === USER_KIND.GUEST) throwErr("GUEST_ACCOUNT_RESTRICTED");

    // Lock before validating, then consume only after the authenticated email
    // matches. A wrong-account click must never burn a valid invitation.
    const pending = await client.query(
      `SELECT id, world_id, role, email
       FROM world_member_invites
       WHERE token_hash = $1 AND expires_at > now() AND accepted_at IS NULL
       FOR UPDATE`,
      [tokenHash(token.trim())]
    );
    if (!pending.rowCount) throwErr("WORLD_INVITE_INVALID");

    const invite = pending.rows[0];
    const userEmail = kindResult.rows[0].email?.trim().toLowerCase();
    if (!userEmail || userEmail !== invite.email.trim().toLowerCase()) {
      throwErr("WORLD_INVITE_EMAIL_MISMATCH");
    }

    const accepted = await client.query(
      `UPDATE world_member_invites
       SET accepted_at = now(), accepted_by_user_id = $2
       WHERE id = $1 AND accepted_at IS NULL
       RETURNING world_id, role`,
      [invite.id, userId]
    );
    if (!accepted.rowCount) throwErr("WORLD_INVITE_INVALID");

    const { world_id: worldId, role } = accepted.rows[0];
    await client.query(
      `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (world_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [worldId, userId, role]
    );
    return { worldId, role };
  });
}

export async function listPendingWorldInvites(worldId) {
  const result = await query(
    `SELECT id, email, role, expires_at, created_at
     FROM world_member_invites
     WHERE world_id = $1 AND accepted_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC`,
    [worldId]
  );
  return result.rows;
}

export async function refreshWorldMemberInvite({ worldId, inviteId, invitedByUserId }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const result = await query(
    `UPDATE world_member_invites
     SET token_hash = $3, expires_at = $4, invited_by_user_id = $5
     WHERE id = $1 AND world_id = $2 AND accepted_at IS NULL AND expires_at > now()
     RETURNING id, world_id, email, role, expires_at, created_at`,
    [inviteId, worldId, tokenHash(token), expiresAt, invitedByUserId]
  );
  if (!result.rowCount) return null;
  return { ...result.rows[0], token };
}

export async function revokeWorldMemberInviteById(worldId, inviteId) {
  const result = await query(
    `DELETE FROM world_member_invites
     WHERE id = $1 AND world_id = $2 AND accepted_at IS NULL
     RETURNING id`,
    [inviteId, worldId]
  );
  return Boolean(result.rowCount);
}
