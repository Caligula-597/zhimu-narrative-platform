import { randomUUID } from "node:crypto";
import { query, transaction } from "./db.js";
import { throwErr } from "./api-errors.js";
import { deleteOwnedWorld } from "./world-delete.js";
import { isProtectedPlatformWorldId } from "./official-example.js";
import {
  collectUserObjectKeys,
  createAccountDeleteJob,
  markAccountDeleteJobCompleted,
  markAccountDeleteJobDbDeleted,
  markAccountDeleteJobFailed,
  markAccountDeleteJobStoragePending,
  purgeObjectKeys
} from "./account-delete-job.js";

export async function buildAccountDeletePreview(userId) {
  const user = await query(
    `SELECT id, display_name, email, user_kind FROM users WHERE id = $1`,
    [userId]
  );
  if (!user.rowCount) throwErr("USER_NOT_FOUND");

  const ownedWorlds = await query(
    `SELECT id, name, catalog_public, status
     FROM worlds
     WHERE owner_user_id = $1 AND status <> 'archived'
     ORDER BY updated_at DESC`,
    [userId]
  );
  const collaboratorWorlds = await query(
    `SELECT COUNT(*)::int AS count
     FROM world_members wm
     INNER JOIN worlds w ON w.id = wm.world_id
     WHERE wm.user_id = $1 AND wm.role <> 'owner' AND w.status <> 'archived'`,
    [userId]
  );
  const hostedRooms = await query(
    `SELECT COUNT(*)::int AS count
     FROM rooms r
     INNER JOIN worlds w ON w.id = r.world_id
     WHERE r.host_user_id = $1 AND w.owner_user_id <> $1`,
    [userId]
  );
  const assets = await query(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(byte_size), 0)::bigint AS bytes
     FROM asset_files
     WHERE owner_user_id = $1 AND status <> 'deleted'`,
    [userId]
  );
  const oauth = await query(
    `SELECT provider FROM oauth_accounts WHERE user_id = $1 ORDER BY provider`,
    [userId]
  );
  const authoredCollaborativeContent = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM notebook_entries WHERE created_by_user_id = $1) AS notebook_entries,
       (SELECT COUNT(*)::int FROM checkpoints WHERE created_by_user_id = $1) AS checkpoints,
       (SELECT COUNT(*)::int FROM content_versions WHERE created_by_user_id = $1) AS content_versions,
       (SELECT COUNT(*)::int FROM room_recaps WHERE created_by_user_id = $1) AS room_recaps`,
    [userId]
  );

  const blockers = [];
  if (ownedWorlds.rows.some((row) => isProtectedPlatformWorldId(row.id))) {
    blockers.push({
      code: "ACCOUNT_DELETE_BLOCKED",
      title: "无法注销",
      detail: "该账号拥有平台示范剧本的主创作者权限，请联系支持处理。"
    });
  }

  const displayName = user.rows[0].display_name?.trim() || "";
  if (!displayName) {
    blockers.push({
      code: "ACCOUNT_DELETE_BLOCKED",
      title: "无法注销",
      detail: "账号缺少显示名，请先在账号设置中补充昵称后再试。"
    });
  }

  return {
    canDelete: blockers.length === 0,
    blockers,
    confirmationLabel: displayName,
    summary: {
      ownedWorlds: ownedWorlds.rows.map((row) => ({
        id: row.id,
        name: row.name,
        catalogPublic: Boolean(row.catalog_public)
      })),
      collaboratorWorlds: collaboratorWorlds.rows[0]?.count ?? 0,
      hostedRooms: hostedRooms.rows[0]?.count ?? 0,
      assetCount: assets.rows[0]?.count ?? 0,
      assetBytes: Number(assets.rows[0]?.bytes ?? 0),
      oauthProviders: oauth.rows.map((row) => row.provider),
      authoredCollaborativeContent: authoredCollaborativeContent.rows[0] ?? {
        notebook_entries: 0,
        checkpoints: 0,
        content_versions: 0,
        room_recaps: 0
      }
    },
    warnings: [
      "注销会永久删除你拥有的剧本、资产与 OAuth 绑定；协作剧本仅解除你的成员关系。",
      "这与「退出登录」不同：退出后账号仍在，注销后无法恢复。"
    ]
  };
}

export function assertDeleteConfirmation(confirmationLabel, confirmation) {
  const expected = String(confirmationLabel ?? "").trim();
  const actual = String(confirmation ?? "").trim();
  if (!expected || actual !== expected) {
    throwErr("ACCOUNT_DELETE_CONFIRMATION_INVALID");
  }
}

async function deleteUserAccountDb(client, userId) {
  const owned = await client.query(
    `SELECT id FROM worlds WHERE owner_user_id = $1`,
    [userId]
  );
  for (const row of owned.rows) {
    if (isProtectedPlatformWorldId(row.id)) {
      throwErr("ACCOUNT_DELETE_BLOCKED");
    }
    const deleted = await deleteOwnedWorld(client, row.id, userId);
    if (!deleted) throwErr("WORLD_NOT_FOUND");
  }

  await client.query(`DELETE FROM checkpoint_restores WHERE requested_by_user_id = $1`, [userId]);
  await client.query(`DELETE FROM rooms WHERE host_user_id = $1`, [userId]);
  await client.query(
    `DELETE FROM deleted_assets
     WHERE deleted_by_user_id = $1
        OR asset_file_id IN (SELECT id FROM asset_files WHERE owner_user_id = $1)`,
    [userId]
  );
  await client.query(`DELETE FROM asset_files WHERE owner_user_id = $1`, [userId]);

  const removed = await client.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [userId]);
  if (!removed.rowCount) throwErr("USER_NOT_FOUND");
}

export async function deleteUserAccount(userId, {
  requireUnverifiedRegistered = false
} = {}) {
  const preview = await buildAccountDeletePreview(userId);
  if (!preview.canDelete) {
    const error = new Error(preview.blockers[0]?.detail || "Account deletion blocked");
    error.code = "ACCOUNT_DELETE_BLOCKED";
    error.statusCode = 403;
    throw error;
  }

  const objectKeys = await collectUserObjectKeys(userId);
  let jobId = null;
  const storageClaimToken = randomUUID();

  try {
    await transaction(async (client) => {
      if (requireUnverifiedRegistered) {
        const target = await client.query(
          `SELECT user_kind, email_verified_at
           FROM users
           WHERE id = $1
           FOR UPDATE`,
          [userId]
        );
        if (!target.rowCount) throwErr("USER_NOT_FOUND");
        if (target.rows[0].user_kind !== "registered" || target.rows[0].email_verified_at) {
          throwErr(
            "ACCOUNT_DELETE_BLOCKED",
            "Only an unverified registered account can be reset"
          );
        }
      }
      jobId = await createAccountDeleteJob(userId, objectKeys, client);
      await deleteUserAccountDb(client, userId);
      await markAccountDeleteJobDbDeleted(jobId, client, { claimToken: storageClaimToken });
    });
  } catch (error) {
    if (jobId) {
      try {
        await markAccountDeleteJobFailed(jobId, error);
      } catch {
        /* job row may roll back with user */
      }
    }
    throw error;
  }

  const { purgedCount, failed } = await purgeObjectKeys(objectKeys);
  if (failed.length === 0) {
    await markAccountDeleteJobCompleted(jobId, purgedCount, null, storageClaimToken);
  } else {
    await markAccountDeleteJobStoragePending(jobId, {
      purgedCount,
      error: `${failed.length} object(s) pending retry`
    }, null, storageClaimToken);
  }

  return {
    ok: true,
    deletedAt: new Date().toISOString(),
    storagePending: failed.length > 0
  };
}
