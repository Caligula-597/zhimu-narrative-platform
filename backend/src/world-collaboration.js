/**
 * World collaborator invites — validation, email delivery, lifecycle.
 */
import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import {
  createWorldMemberInvite,
  listPendingWorldInvites,
  revokeWorldMemberInviteById,
  refreshWorldMemberInvite
} from "./world-invites.js";
import {
  isEmailConfigured,
  sendWorldMemberInviteEmail
} from "./email/index.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_LABELS = { editor: "协作者", host: "主持人", viewer: "只读观察者" };

export function normalizeCollaboratorEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export function assertCollaboratorEmail(email) {
  const normalized = normalizeCollaboratorEmail(email);
  if (!EMAIL_RE.test(normalized)) throwErr("EMAIL_INVALID");
  return normalized;
}

export async function assertNotSelfInvite(actorId, email) {
  const actor = await query(`SELECT email FROM users WHERE id = $1`, [actorId]);
  const actorEmail = actor.rows[0]?.email?.trim().toLowerCase();
  if (actorEmail && actorEmail === email) throwErr("WORLD_INVITE_SELF");
}

export async function findRegisteredUserByEmail(email) {
  const result = await query(
    `SELECT id, email, display_name FROM users WHERE lower(email) = $1 AND user_kind = 'registered'`,
    [email]
  );
  return result.rows[0] ?? null;
}

export async function assertNotExistingMember(worldId, email) {
  const member = await query(
    `SELECT wm.role, u.display_name
     FROM world_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.world_id = $1 AND lower(u.email) = $2`,
    [worldId, email]
  );
  if (member.rowCount) {
    throwErr("COLLABORATOR_ALREADY_MEMBER", undefined, {
      email,
      role: member.rows[0].role,
      displayName: member.rows[0].display_name
    });
  }
}

export async function fetchInviteEmailContext(worldId, invitedByUserId) {
  const result = await query(
    `SELECT w.name AS world_name, u.display_name AS inviter_name
     FROM worlds w
     JOIN users u ON u.id = $2
     WHERE w.id = $1`,
    [worldId, invitedByUserId]
  );
  if (!result.rowCount) throwErr("WORLD_NOT_FOUND");
  return result.rows[0];
}

async function deliverInviteEmail({ email, token, worldName, inviterName, role }) {
  if (!isEmailConfigured()) {
    return { sent: false, reason: "EMAIL_NOT_CONFIGURED", exposeToken: true };
  }
  try {
    await sendWorldMemberInviteEmail({
      to: email,
      inviteToken: token,
      worldName,
      inviterName: inviterName || "织幕用户",
      roleLabel: ROLE_LABELS[role] || role
    });
    return { sent: true, reason: null, exposeToken: false };
  } catch (error) {
    return { sent: false, reason: error.code || "EMAIL_SEND_FAILED", exposeToken: true };
  }
}

export async function inviteWorldCollaborator({ worldId, email, role, invitedByUserId }) {
  const normalized = assertCollaboratorEmail(email);
  if (!["editor", "host", "viewer"].includes(role)) throwErr("COLLABORATION_ROLE_INVALID");
  await assertNotSelfInvite(invitedByUserId, normalized);
  await assertNotExistingMember(worldId, normalized);

  const invite = await createWorldMemberInvite({
    worldId,
    email: normalized,
    role,
    invitedByUserId
  });
  const ctx = await fetchInviteEmailContext(worldId, invitedByUserId);
  const delivery = await deliverInviteEmail({
    email: normalized,
    token: invite.token,
    worldName: ctx.world_name,
    inviterName: ctx.inviter_name,
    role
  });

  return {
    pendingInvite: true,
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expires_at,
    emailSent: delivery.sent,
    emailDeliveryReason: delivery.reason,
    ...(delivery.exposeToken ? { inviteToken: invite.token } : {})
  };
}

export async function addRegisteredWorldCollaborator({ worldId, email, role, invitedByUserId }) {
  const normalized = assertCollaboratorEmail(email);
  if (invitedByUserId) await assertNotSelfInvite(invitedByUserId, normalized);
  const user = await findRegisteredUserByEmail(normalized);
  if (!user) return null;
  await assertNotExistingMember(worldId, normalized);
  await query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1,$2,$3)
     ON CONFLICT (world_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [worldId, user.id, role]
  );
  return { ...user, role };
}

export async function resendWorldCollaboratorInvite({ worldId, inviteId, invitedByUserId }) {
  const row = await query(
    `SELECT id, email, role
     FROM world_member_invites
     WHERE id = $1 AND world_id = $2 AND accepted_at IS NULL AND expires_at > now()`,
    [inviteId, worldId]
  );
  if (!row.rowCount) throwErr("WORLD_INVITE_NOT_FOUND");

  const refreshed = await refreshWorldMemberInvite({
    worldId,
    inviteId,
    invitedByUserId
  });
  if (!refreshed) throwErr("WORLD_INVITE_NOT_FOUND");
  const ctx = await fetchInviteEmailContext(worldId, invitedByUserId);
  const delivery = await deliverInviteEmail({
    email: refreshed.email,
    token: refreshed.token,
    worldName: ctx.world_name,
    inviterName: ctx.inviter_name,
    role: refreshed.role
  });

  return {
    id: refreshed.id,
    email: refreshed.email,
    role: refreshed.role,
    expiresAt: refreshed.expires_at,
    emailSent: delivery.sent,
    emailDeliveryReason: delivery.reason,
    ...(delivery.exposeToken ? { inviteToken: refreshed.token } : {})
  };
}

export async function revokePendingWorldCollaboratorInvite({ worldId, inviteId }) {
  const ok = await revokeWorldMemberInviteById(worldId, inviteId);
  if (!ok) throwErr("WORLD_INVITE_NOT_FOUND");
  return { ok: true };
}

export { listPendingWorldInvites, ROLE_LABELS };
