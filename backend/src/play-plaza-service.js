import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

const HOURLY_POST_LIMIT = 12;

function mapPost(row) {
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    authorDisplayName: row.author_display_name,
    inviteCode: row.invite_code || null,
    roomLabel: row.room_label || null,
    worldLabel: row.world_label || null,
    createdAt: row.created_at
  };
}

async function resolveInviteLabels(inviteCode) {
  if (!inviteCode) return { roomLabel: null, worldLabel: null };
  const result = await query(
    `SELECT r.name AS room_name, w.name AS world_name
     FROM rooms r
     JOIN worlds w ON w.id = r.world_id
     WHERE r.invite_code = $1 AND w.status <> 'archived'`,
    [inviteCode]
  );
  if (!result.rowCount) return { roomLabel: null, worldLabel: null };
  return {
    roomLabel: result.rows[0].room_name,
    worldLabel: result.rows[0].world_name
  };
}

export async function listPlazaPosts({ kind, limit = 40 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 60);
  const params = [safeLimit];
  let kindFilter = "";
  if (kind === "chat" || kind === "recruit") {
    kindFilter = "WHERE kind = $2";
    params.push(kind);
  }
  const result = await query(
    `SELECT id, author_user_id, author_display_name, kind, body, invite_code,
            room_label, world_label, created_at
     FROM play_plaza_posts
     ${kindFilter}
     ORDER BY created_at DESC
     LIMIT $1`,
    params
  );
  return {
    total: result.rowCount,
    items: result.rows.map(mapPost)
  };
}

export async function createPlazaPost({ actorId, displayName, kind, body, inviteCode }) {
  const normalizedKind = kind === "recruit" ? "recruit" : "chat";
  const text = String(body ?? "").trim();
  if (!text || text.length > 500) throwErr("PLAZA_POST_INVALID", "发言内容需为 1～500 字。");

  const recent = await query(
    `SELECT COUNT(*)::int AS count
     FROM play_plaza_posts
     WHERE author_user_id = $1 AND created_at > now() - interval '1 hour'`,
    [actorId]
  );
  if (recent.rows[0].count >= HOURLY_POST_LIMIT) {
    throwErr("RATE_LIMITED", "发帖过于频繁，请稍后再试。");
  }

  let code = null;
  let roomLabel = null;
  let worldLabel = null;
  if (normalizedKind === "recruit" && inviteCode) {
    code = String(inviteCode).trim().slice(0, 80);
    if (code) {
      const labels = await resolveInviteLabels(code);
      roomLabel = labels.roomLabel;
      worldLabel = labels.worldLabel;
    }
  }

  const user = await query(`SELECT display_name FROM users WHERE id = $1`, [actorId]);
  const authorName = displayName || user.rows[0]?.display_name || "玩家";

  const inserted = await query(
    `INSERT INTO play_plaza_posts
       (author_user_id, author_display_name, kind, body, invite_code, room_label, world_label)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, author_display_name, kind, body, invite_code, room_label, world_label, created_at`,
    [actorId, authorName.slice(0, 40), normalizedKind, text, code, roomLabel, worldLabel]
  );
  return mapPost(inserted.rows[0]);
}
