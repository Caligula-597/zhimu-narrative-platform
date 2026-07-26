/**
 * GDPR-style account data export — metadata JSON (no passwords, tokens, or binary blobs).
 */
import { query, resolveQueryTimeoutMs, transaction } from "./db.js";
import { throwErr } from "./api-errors.js";
import { buildAccountEntitlements } from "./account-entitlements.js";
import { buildWorldArchiveSnapshot } from "./world-snapshot-service.js";

const DEFAULT_ACCOUNT_EXPORT_STATEMENT_TIMEOUT_MS = 120_000;

export function resolveAccountExportStatementTimeoutMs(
  raw = process.env.ACCOUNT_EXPORT_STATEMENT_TIMEOUT_MS
) {
  return resolveQueryTimeoutMs(raw, DEFAULT_ACCOUNT_EXPORT_STATEMENT_TIMEOUT_MS);
}

export async function buildOwnedWorldArchives(
  worlds,
  {
    snapshotBuilder = buildWorldArchiveSnapshot,
    runTransaction = transaction,
    statementTimeoutMs = resolveAccountExportStatementTimeoutMs()
  } = {}
) {
  if (!worlds.length) return [];
  const timeoutMs = resolveAccountExportStatementTimeoutMs(statementTimeoutMs);
  return runTransaction(async (client) => {
    await client.query(
      `SELECT set_config('statement_timeout', $1, true)`,
      [String(timeoutMs)]
    );
    const archives = [];
    for (const world of worlds) {
      archives.push({
        worldId: world.id,
        snapshot: await snapshotBuilder(world.id, client)
      });
    }
    return archives;
  });
}

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
  const [
    worldArchives,
    plazaPosts,
    plazaReplies,
    sentDirectMessages,
    plazaReports,
    feedback,
    betaApplications,
    planUpgradeRequests,
    creditLedger,
    creditBalance,
    llmConnections,
    llmPreferences,
    notebookEntries,
    hostAuditActions
  ] = await Promise.all([
    buildOwnedWorldArchives(ownedWorlds.rows),
    query(
      `SELECT id, kind, body, invite_code, review_status, ai_review_note,
              published_at, created_at, deleted_at
       FROM play_plaza_posts
       WHERE author_user_id = $1
       ORDER BY created_at`,
      [userId]
    ),
    query(
      `SELECT id, post_id, parent_reply_id, body, review_status, ai_review_note,
              published_at, created_at, deleted_at
       FROM play_plaza_replies
       WHERE author_user_id = $1
       ORDER BY created_at`,
      [userId]
    ),
    query(
      `SELECT m.id, m.conversation_id, m.body, m.created_at, m.read_at
       FROM play_dm_messages m
       WHERE m.sender_user_id = $1
       ORDER BY m.created_at`,
      [userId]
    ),
    query(
      `SELECT id, target_type, target_id, reason, human_review_status,
              ops_note, resolved_at, created_at
       FROM play_plaza_reports
       WHERE reporter_user_id = $1
       ORDER BY created_at`,
      [userId]
    ),
    query(
      `SELECT id, kind, subject, body, page_url, status, created_at, updated_at
       FROM feedback
       WHERE user_id = $1
       ORDER BY created_at`,
      [userId]
    ),
    query(
      `SELECT id, email, display_name, role_intent, use_case, referral_source,
              contact, status, review_note, created_at, updated_at
       FROM beta_applications
       WHERE user_id = $1 OR lower(email) = lower($2)
       ORDER BY created_at`,
      [userId, profile.email]
    ),
    query(
      `SELECT id, email, display_name, current_plan_code, desired_plan_code,
              reason, contact, status, review_note, created_at, reviewed_at, updated_at
       FROM plan_upgrade_requests
       WHERE user_id = $1
       ORDER BY created_at`,
      [userId]
    ),
    query(
      `SELECT id, delta, reason, ref_type, ref_id, created_at
       FROM credit_ledger
       WHERE user_id = $1
       ORDER BY created_at`,
      [userId]
    ),
    query(
      `SELECT balance, lifetime_granted, lifetime_spent, last_monthly_grant_at, updated_at
       FROM user_credit_balances
       WHERE user_id = $1`,
      [userId]
    ),
    query(
      `SELECT id, name, provider, base_url, model, api_key_hint, is_active,
              enabled, created_at, updated_at
       FROM user_llm_connections
       WHERE user_id = $1
       ORDER BY created_at`,
      [userId]
    ),
    query(
      `SELECT routing_mode, updated_at
       FROM user_llm_preferences
       WHERE user_id = $1`,
      [userId]
    ),
    query(
      `SELECT id, room_id, role_slot_id, source_type, source_id, title, body, created_at
       FROM notebook_entries
       WHERE created_by_user_id = $1
       ORDER BY created_at`,
      [userId]
    ),
    query(
      `SELECT id, room_id, action, target_type, target_id, metadata, created_at
       FROM host_audit_log
       WHERE actor_user_id = $1
       ORDER BY created_at`,
      [userId]
    )
  ]);

  return {
    exportedAt: new Date().toISOString(),
    formatVersion: 2,
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
    worldArchives,
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
    hostedRoomsOnOthersWorlds: hostedRooms.rows[0]?.count ?? 0,
    plazaPosts: plazaPosts.rows,
    plazaReplies: plazaReplies.rows,
    sentDirectMessages: sentDirectMessages.rows,
    plazaReports: plazaReports.rows,
    feedback: feedback.rows,
    betaApplications: betaApplications.rows,
    planUpgradeRequests: planUpgradeRequests.rows,
    credits: {
      balance: creditBalance.rows[0] ?? null,
      ledger: creditLedger.rows
    },
    llm: {
      preferences: llmPreferences.rows[0] ?? null,
      connections: llmConnections.rows
    },
    notebookEntries: notebookEntries.rows,
    hostAuditActions: hostAuditActions.rows
  };
}
