import { buildAccountDeletePreview, deleteUserAccount } from "./account-delete.js";
import { throwErr } from "./api-errors.js";
import { query } from "./db.js";
import { enterpriseEmails } from "./enterprise-emails.js";

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function protectedOperationsEmails() {
  const configured = enterpriseEmails();
  return new Set([
    configured.support,
    configured.hello,
    configured.admin,
    configured.opsNotify
  ].map(normalizeEmail).filter(Boolean));
}

export function isProtectedOperationsEmail(email) {
  return protectedOperationsEmails().has(normalizeEmail(email));
}

function mapOpsUser(row) {
  const emailVerified = Boolean(row.email_verified_at);
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    userKind: row.user_kind,
    emailVerified,
    verificationStatus: emailVerified ? "verified" : "pending",
    hasActiveVerification: Boolean(row.has_active_verification),
    verificationLastSentAt: row.verification_last_sent_at ?? null,
    planCode: row.plan_code || "free",
    ownedWorlds: Number(row.owned_worlds ?? 0),
    collaboratorWorlds: Number(row.collaborator_worlds ?? 0),
    assetCount: Number(row.asset_count ?? 0),
    activeSessions: Number(row.active_sessions ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    protectedOperationsAccount: isProtectedOperationsEmail(row.email)
  };
}

function listWhere({ search, verification }) {
  const params = [];
  const where = ["u.user_kind = 'registered'", "u.email IS NOT NULL"];
  const normalizedSearch = normalizeEmail(search);
  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    where.push(`(lower(u.email) LIKE $${params.length} OR lower(u.display_name) LIKE $${params.length})`);
  }
  if (verification === "pending") where.push("u.email_verified_at IS NULL");
  if (verification === "verified") where.push("u.email_verified_at IS NOT NULL");
  return { params, whereClause: `WHERE ${where.join(" AND ")}` };
}

export async function listOpsUsers({
  search = "",
  verification = "all",
  limit = 20,
  offset = 0
} = {}, queryRunner = query) {
  const { params, whereClause } = listWhere({ search, verification });
  const dataParams = [...params, limit, offset];
  const limitIndex = dataParams.length - 1;
  const offsetIndex = dataParams.length;
  const [rows, count] = await Promise.all([
    queryRunner(
      `SELECT
         u.id,
         u.email,
         u.display_name,
         u.user_kind,
         u.email_verified_at,
         u.created_at,
         u.updated_at,
         COALESCE(up.plan_code, 'free') AS plan_code,
         (SELECT COUNT(*)::int FROM worlds w WHERE w.owner_user_id = u.id AND w.status <> 'archived') AS owned_worlds,
         (SELECT COUNT(*)::int FROM world_members wm WHERE wm.user_id = u.id AND wm.role <> 'owner') AS collaborator_worlds,
         (SELECT COUNT(*)::int FROM asset_files af WHERE af.owner_user_id = u.id AND af.status <> 'deleted') AS asset_count,
         (SELECT COUNT(*)::int
            FROM auth_sessions session
           WHERE session.user_id = u.id
             AND session.revoked_at IS NULL
             AND session.expires_at > now()) AS active_sessions,
         EXISTS (
           SELECT 1
             FROM email_verification_tokens token
            WHERE token.user_id = u.id
              AND token.used_at IS NULL
              AND COALESCE(token.verification_code_expires_at, token.expires_at) > now()
         ) AS has_active_verification,
         (SELECT MAX(token.last_sent_at)
            FROM email_verification_tokens token
           WHERE token.user_id = u.id) AS verification_last_sent_at
       FROM users u
       LEFT JOIN user_plans up ON up.user_id = u.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      dataParams
    ),
    queryRunner(
      `SELECT COUNT(*)::int AS total
       FROM users u
       ${whereClause}`,
      params
    )
  ]);

  return {
    items: rows.rows.map(mapOpsUser),
    total: Number(count.rows[0]?.total ?? 0),
    limit,
    offset
  };
}

export async function getOpsUser(userId, queryRunner = query) {
  const result = await queryRunner(
    `SELECT
       u.id,
       u.email,
       u.display_name,
       u.user_kind,
       u.email_verified_at,
       u.created_at,
       u.updated_at,
       COALESCE(up.plan_code, 'free') AS plan_code,
       (SELECT COUNT(*)::int FROM worlds w WHERE w.owner_user_id = u.id AND w.status <> 'archived') AS owned_worlds,
       (SELECT COUNT(*)::int FROM world_members wm WHERE wm.user_id = u.id AND wm.role <> 'owner') AS collaborator_worlds,
       (SELECT COUNT(*)::int FROM asset_files af WHERE af.owner_user_id = u.id AND af.status <> 'deleted') AS asset_count,
       (SELECT COUNT(*)::int
          FROM auth_sessions session
         WHERE session.user_id = u.id
           AND session.revoked_at IS NULL
           AND session.expires_at > now()) AS active_sessions,
       EXISTS (
         SELECT 1
           FROM email_verification_tokens token
          WHERE token.user_id = u.id
            AND token.used_at IS NULL
            AND COALESCE(token.verification_code_expires_at, token.expires_at) > now()
       ) AS has_active_verification,
       (SELECT MAX(token.last_sent_at)
          FROM email_verification_tokens token
         WHERE token.user_id = u.id) AS verification_last_sent_at
     FROM users u
     LEFT JOIN user_plans up ON up.user_id = u.id
     WHERE u.id = $1 AND u.user_kind = 'registered'`,
    [userId]
  );
  if (!result.rowCount) throwErr("USER_NOT_FOUND");
  return mapOpsUser(result.rows[0]);
}

export function assertOpsUserConfirmation(target, confirmationEmail) {
  if (!target?.email || normalizeEmail(target.email) !== normalizeEmail(confirmationEmail)) {
    throwErr("ACCOUNT_DELETE_CONFIRMATION_INVALID", "Confirmation email does not match the target account");
  }
}

export async function buildOpsUserDeletePreview(userId) {
  const [target, deletion] = await Promise.all([
    getOpsUser(userId),
    buildAccountDeletePreview(userId)
  ]);
  return {
    target,
    deletion,
    canResetRegistration:
      !target.emailVerified
      && !target.protectedOperationsAccount
      && deletion.canDelete,
    canDeleteAccount:
      !target.protectedOperationsAccount
      && deletion.canDelete
  };
}

export async function deleteOpsUser({
  userId,
  confirmationEmail,
  acknowledged,
  mode
}) {
  if (!acknowledged) throwErr("BAD_REQUEST", "You must acknowledge that deletion is permanent");
  const target = await getOpsUser(userId);
  assertOpsUserConfirmation(target, confirmationEmail);
  if (target.protectedOperationsAccount) {
    throwErr("ACCOUNT_DELETE_BLOCKED", "Protected operations mailboxes cannot be deleted from OPS");
  }
  if (mode === "pending_reset" && target.emailVerified) {
    throwErr("ACCOUNT_DELETE_BLOCKED", "Only an unverified account can be reset as a pending registration");
  }
  const result = await deleteUserAccount(userId, {
    requireUnverifiedRegistered: mode === "pending_reset"
  });
  return { ...result, target, mode };
}

export async function recordOpsUserAction({
  action,
  targetUserId,
  targetEmail,
  metadata = {}
}, queryRunner = query) {
  await queryRunner(
    `INSERT INTO ops_user_audit_log (
       action, target_user_id, target_email, metadata
     ) VALUES ($1, $2, $3, $4::jsonb)`,
    [
      action,
      targetUserId,
      normalizeEmail(targetEmail),
      JSON.stringify(metadata)
    ]
  );
}
