import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { publishPlatformUserEvent } from "./platform-event-bus.js";
import { assertPlayAdFree } from "./play-content-moderation.js";
import { assertPlaySocialWrite } from "./play-social-guard.js";

const HOURLY_DM_LIMIT = 60;

export function canonicalUserPair(userA, userB) {
  const a = String(userA);
  const b = String(userB);
  return a < b ? [a, b] : [b, a];
}

function mapFriendRow(row, actorId) {
  const friendId = row.user_low_id === actorId ? row.user_high_id : row.user_low_id;
  return {
    userId: friendId,
    displayName: row.friend_display_name,
    status: row.status,
    requestedByMe: row.requested_by_user_id === actorId,
    updatedAt: row.updated_at
  };
}

export async function searchPlayers({ actorId, queryText, limit = 10 }) {
  const q = String(queryText ?? "").trim();
  if (q.length < 2) return { items: [] };
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const result = await query(
    `SELECT id, display_name
     FROM users
     WHERE id <> $1
       AND display_name ILIKE $2
     ORDER BY display_name
     LIMIT $3`,
    [actorId, `%${q.replace(/[%_]/g, "")}%`, safeLimit]
  );
  return {
    items: result.rows.map((row) => ({ userId: row.id, displayName: row.display_name }))
  };
}

export async function listFriendships(actorId) {
  const result = await query(
    `SELECT f.user_low_id, f.user_high_id, f.requested_by_user_id, f.status, f.updated_at,
            u.display_name AS friend_display_name
     FROM play_friendships f
     JOIN users u ON u.id = CASE WHEN f.user_low_id = $1 THEN f.user_high_id ELSE f.user_low_id END
     WHERE f.user_low_id = $1 OR f.user_high_id = $1
     ORDER BY f.updated_at DESC`,
    [actorId]
  );
  const friends = [];
  const incoming = [];
  const outgoing = [];
  for (const row of result.rows) {
    const mapped = mapFriendRow(row, actorId);
    if (mapped.status === "accepted") friends.push(mapped);
    else if (mapped.status === "pending" && mapped.requestedByMe) outgoing.push(mapped);
    else if (mapped.status === "pending") incoming.push(mapped);
  }
  return { friends, incoming, outgoing };
}

export async function sendFriendRequest(actorId, targetUserId) {
  await assertPlaySocialWrite(actorId);
  if (actorId === targetUserId) throwErr("FRIEND_SELF", "不能添加自己为好友。");
  const target = await query(`SELECT id, display_name FROM users WHERE id = $1`, [targetUserId]);
  if (!target.rowCount) throwErr("USER_NOT_FOUND", "找不到该玩家。");
  const [low, high] = canonicalUserPair(actorId, targetUserId);
  const existing = await query(
    `SELECT status, requested_by_user_id FROM play_friendships WHERE user_low_id = $1 AND user_high_id = $2`,
    [low, high]
  );
  if (existing.rowCount) {
    const row = existing.rows[0];
    if (row.status === "accepted") throwErr("FRIEND_ALREADY", "你们已经是好友。");
    if (row.status === "pending") throwErr("FRIEND_REQUEST_EXISTS", "好友请求已存在。");
    await query(
      `UPDATE play_friendships
       SET status = 'pending', requested_by_user_id = $1, updated_at = now()
       WHERE user_low_id = $2 AND user_high_id = $3`,
      [actorId, low, high]
    );
  } else {
    await query(
      `INSERT INTO play_friendships (user_low_id, user_high_id, requested_by_user_id, status)
       VALUES ($1, $2, $3, 'pending')`,
      [low, high, actorId]
    );
  }
  publishPlatformUserEvent(targetUserId, "social.friend_request", {
    fromUserId: actorId
  });
  return { ok: true };
}

export async function respondFriendRequest(actorId, targetUserId, accept) {
  const [low, high] = canonicalUserPair(actorId, targetUserId);
  const row = await query(
    `SELECT status, requested_by_user_id FROM play_friendships
     WHERE user_low_id = $1 AND user_high_id = $2`,
    [low, high]
  );
  if (!row.rowCount || row.rows[0].status !== "pending") throwErr("FRIEND_REQUEST_NOT_FOUND", "没有待处理的好友请求。");
  if (row.rows[0].requested_by_user_id === actorId) {
    throwErr("FRIEND_REQUEST_NOT_FOUND", "不能回应自己发出的请求。");
  }
  const status = accept ? "accepted" : "declined";
  await query(
    `UPDATE play_friendships SET status = $1, updated_at = now()
     WHERE user_low_id = $2 AND user_high_id = $3`,
    [status, low, high]
  );
  publishPlatformUserEvent(targetUserId, accept ? "social.friend_accepted" : "social.friend_declined", {
    fromUserId: actorId
  });
  return { ok: true, status };
}

async function requireFriendship(actorId, otherUserId) {
  const [low, high] = canonicalUserPair(actorId, otherUserId);
  const row = await query(
    `SELECT 1 FROM play_friendships WHERE user_low_id = $1 AND user_high_id = $2 AND status = 'accepted'`,
    [low, high]
  );
  if (!row.rowCount) throwErr("DM_FRIEND_REQUIRED", "仅好友之间可以私聊。");
}

export async function listDmConversations(actorId) {
  const result = await query(
    `SELECT c.id, c.user_low_id, c.user_high_id, c.last_message_at,
            u.display_name AS peer_display_name,
            m.body AS last_body,
            m.sender_user_id AS last_sender_user_id,
            (SELECT COUNT(*)::int FROM play_dm_messages um
             WHERE um.conversation_id = c.id
               AND um.sender_user_id <> $1
               AND um.read_at IS NULL) AS unread_count
     FROM play_dm_conversations c
     JOIN users u ON u.id = CASE WHEN c.user_low_id = $1 THEN c.user_high_id ELSE c.user_low_id END
     LEFT JOIN LATERAL (
       SELECT body, sender_user_id FROM play_dm_messages
       WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
     ) m ON true
     WHERE c.user_low_id = $1 OR c.user_high_id = $1
     ORDER BY c.last_message_at DESC`,
    [actorId]
  );
  return {
    items: result.rows.map((row) => ({
      id: row.id,
      peerUserId: row.user_low_id === actorId ? row.user_high_id : row.user_low_id,
      peerDisplayName: row.peer_display_name,
      lastMessage: row.last_body || "",
      lastMessageAt: row.last_message_at,
      lastMessageFromMe: row.last_sender_user_id === actorId,
      unreadCount: row.unread_count
    }))
  };
}

async function getOrCreateConversation(actorId, peerUserId) {
  await requireFriendship(actorId, peerUserId);
  const [low, high] = canonicalUserPair(actorId, peerUserId);
  const existing = await query(
    `SELECT id FROM play_dm_conversations WHERE user_low_id = $1 AND user_high_id = $2`,
    [low, high]
  );
  if (existing.rowCount) return existing.rows[0].id;
  const created = await query(
    `INSERT INTO play_dm_conversations (user_low_id, user_high_id)
     VALUES ($1, $2) RETURNING id`,
    [low, high]
  );
  return created.rows[0].id;
}

export async function openDmConversation(actorId, peerUserId) {
  const conversationId = await getOrCreateConversation(actorId, peerUserId);
  return { conversationId };
}

export async function listDmMessages(actorId, conversationId) {
  const conv = await query(
    `SELECT id, user_low_id, user_high_id FROM play_dm_conversations WHERE id = $1`,
    [conversationId]
  );
  if (!conv.rowCount) throwErr("DM_NOT_FOUND", "会话不存在。");
  const row = conv.rows[0];
  if (row.user_low_id !== actorId && row.user_high_id !== actorId) throwErr("FORBIDDEN", "无权查看该会话。");
  await query(
    `UPDATE play_dm_messages SET read_at = now()
     WHERE conversation_id = $1 AND sender_user_id <> $2 AND read_at IS NULL`,
    [conversationId, actorId]
  );
  const messages = await query(
    `SELECT id, sender_user_id, body, created_at, read_at
     FROM play_dm_messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC
     LIMIT 200`,
    [conversationId]
  );
  const peerId = row.user_low_id === actorId ? row.user_high_id : row.user_low_id;
  const peer = await query(`SELECT display_name FROM users WHERE id = $1`, [peerId]);
  return {
    conversationId,
    peerUserId: peerId,
    peerDisplayName: peer.rows[0]?.display_name || "玩家",
    items: messages.rows.map((message) => ({
      id: message.id,
      body: message.body,
      fromMe: message.sender_user_id === actorId,
      createdAt: message.created_at,
      readAt: message.read_at
    }))
  };
}

export async function sendDmMessage(actorId, conversationId, body) {
  await assertPlaySocialWrite(actorId);
  const text = String(body ?? "").trim();
  if (!text || text.length > 1000) throwErr("DM_MESSAGE_INVALID", "私信内容需为 1～1000 字。");
  assertPlayAdFree(text);
  const conv = await query(
    `SELECT id, user_low_id, user_high_id FROM play_dm_conversations WHERE id = $1`,
    [conversationId]
  );
  if (!conv.rowCount) throwErr("DM_NOT_FOUND", "会话不存在。");
  const row = conv.rows[0];
  if (row.user_low_id !== actorId && row.user_high_id !== actorId) throwErr("FORBIDDEN", "无权在该会话发言。");
  const peerId = row.user_low_id === actorId ? row.user_high_id : row.user_low_id;
  await requireFriendship(actorId, peerId);

  const recent = await query(
    `SELECT COUNT(*)::int AS count FROM play_dm_messages
     WHERE sender_user_id = $1 AND created_at > now() - interval '1 hour'`,
    [actorId]
  );
  if (recent.rows[0].count >= HOURLY_DM_LIMIT) throwErr("RATE_LIMITED", "私信发送过于频繁，请稍后再试。");

  const inserted = await query(
    `INSERT INTO play_dm_messages (conversation_id, sender_user_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, body, created_at`,
    [conversationId, actorId, text]
  );
  await query(`UPDATE play_dm_conversations SET last_message_at = now() WHERE id = $1`, [conversationId]);
  publishPlatformUserEvent(peerId, "dm.message_created", { conversationId, messageId: inserted.rows[0].id });
  return {
    id: inserted.rows[0].id,
    body: inserted.rows[0].body,
    fromMe: true,
    createdAt: inserted.rows[0].created_at
  };
}
