/**
 * GDPR-style account data export — metadata JSON (no passwords, tokens, or binary blobs).
 */
import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { buildAccountEntitlements } from "./account-entitlements.js";

export async function buildAccountExport(userId) {
  const user = await query(
    `SELECT id, display_name, email, user_kind, email_verified_at, created_at, updated_at
     FROM users WHERE id = $1`,
    [userId]
  );
  if (!user.rowCount) throwErr("USER_NOT_FOUND");

  const [oauth, sessions, ownedWorlds, collaboratorWorlds, assets, hostedRooms, entitlements] =
    await Promise.all([
      query(`SELECT provider, email, created_at, updated_at FROM oauth_accounts WHERE user_id = $1 ORDER BY provider`, [userId]),
      query(
        `SELECT id, device_label, user_agent, created_at, last_seen_at, expires_at
         FROM auth_sessions WHERE user_id = $1 ORDER BY last_seen_at DESC NULLS LAST`,
        [userId]
      ),
      query(
        `SELECT id, name, summary, status, catalog_public, created_at, updated_at, content_revision
         FROM worlds WHERE owner_user_id = $1 AND status <> 'archived' ORDER BY updated_at DESC`,
        [userId]
      ),
      query(
        `SELECT w.id AS world_id, w.name AS world_name, wm.role, wm.created_at
         FROM world_members wm
         INNER JOIN worlds w ON w.id = wm.world_id
         WHERE wm.user_id = $1 AND wm.role <> 'owner' AND w.status <> 'archived'
         ORDER BY w.name`,
        [userId]
      ),
      query(
        `SELECT id, original_filename, content_type, byte_size, world_id, created_at, updated_at, status
         FROM asset_files WHERE owner_user_id = $1 AND status <> 'deleted' ORDER BY created_at DESC`,
        [userId]
      ),
      query(
        `SELECT COUNT(*)::int AS count
         FROM rooms r INNER JOIN worlds w ON w.id = r.world_id
         WHERE r.host_user_id = $1 AND w.owner_user_id <> $1`,
        [userId]
      ),
      buildAccountEntitlements(userId)
    ]);

  const profile = user.rows[0];
  return {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    note:
      "此导出包含账号元数据与资产清单，不含密码、会话令牌或对象存储二进制内容。如需批量下载资产文件请联系支持。",
    profile: {
      id: profile.id,
      displayName: profile.display_name,
      email: profile.email,
      userKind: profile.user_kind,
      emailVerifiedAt: profile.email_verified_at,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at
    },
    plan: entitlements.plan,
    usage: entitlements.usage,
    oauthAccounts: oauth.rows.map((row) => ({
      provider: row.provider,
      email: row.email,
      linkedAt: row.created_at,
      updatedAt: row.updated_at
    })),
    sessions: sessions.rows.map((row) => ({
      id: row.id,
      deviceLabel: row.device_label,
      userAgent: row.user_agent,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at
    })),
    ownedWorlds: ownedWorlds.rows.map((row) => ({
      id: row.id,
      name: row.name,
      summary: row.summary,
      status: row.status,
      catalogPublic: Boolean(row.catalog_public),
      contentRevision: Number(row.content_revision),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })),
    collaboratorWorlds: collaboratorWorlds.rows.map((row) => ({
      worldId: row.world_id,
      worldName: row.world_name,
      role: row.role,
      joinedAt: row.created_at
    })),
    assets: assets.rows.map((row) => ({
      id: row.id,
      fileName: row.original_filename,
      mimeType: row.content_type,
      byteSize: Number(row.byte_size),
      worldId: row.world_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })),
    hostedRoomsOnOthersWorlds: hostedRooms.rows[0]?.count ?? 0
  };
}
