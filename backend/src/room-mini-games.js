import { createHash } from "node:crypto";
import { query } from "./db.js";

function hashAnswer(answer) {
  return createHash("sha256").update(String(answer ?? "").trim()).digest("hex");
}

function normalizeAttempts(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(12, Math.trunc(n)));
}

function normalizeAnswer(value) {
  return String(value ?? "").trim();
}

export function buildLockGameConfig(body = {}) {
  const answer = normalizeAnswer(body.answer);
  const length = Math.max(1, Math.min(12, Number(body.length || answer.length || 4)));
  const maxAttempts = normalizeAttempts(body.maxAttempts ?? body.max_attempts);
  return {
    gameType: "zhimu_lock",
    title: String(body.title || "数字密码锁").trim().slice(0, 120),
    publicConfig: {
      title: String(body.title || "数字密码锁").trim().slice(0, 120),
      prompt: String(body.prompt || "输入线索中得到的密码。").trim().slice(0, 500),
      hint: String(body.hint || "").trim().slice(0, 500),
      length,
      max_attempts: maxAttempts
    },
    privateConfig: {
      answer_hash: hashAnswer(answer)
    },
    state: {
      attempts_left: maxAttempts,
      attempts_used: 0
    }
  };
}

export function publicMiniGame(row) {
  if (!row) return null;
  const config = row.public_config || {};
  const state = row.state || {};
  let status = "playing";
  if (row.status === "completed") status = "success";
  if (row.status === "failed") status = "fail";
  if (row.status === "skipped") status = "success";
  return {
    id: row.id,
    instanceId: row.id,
    instance_id: row.id,
    gameType: row.game_type,
    game_type: row.game_type,
    title: row.title,
    config,
    status,
    attemptsLeft: state.attempts_left ?? null,
    attempts_left: state.attempts_left ?? null,
    completedAt: row.completed_at ?? null,
    completed_at: row.completed_at ?? null
  };
}

export async function fetchCurrentMiniGame(runQuery, roomId) {
  const result = await runQuery(
    `SELECT *
     FROM room_mini_games
     WHERE room_id = $1 AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1`,
    [roomId]
  );
  return publicMiniGame(result.rows[0]);
}

export async function startLockMiniGame(client, { roomId, actorUserId, body }) {
  const game = buildLockGameConfig(body);
  await client.query(
    `UPDATE room_mini_games
     SET status = 'skipped', completed_at = now(), updated_at = now()
     WHERE room_id = $1 AND status = 'active'`,
    [roomId]
  );
  const result = await client.query(
    `INSERT INTO room_mini_games
       (room_id, game_type, title, public_config, private_config, state, status, created_by_user_id)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, 'active', $7)
     RETURNING *`,
    [
      roomId,
      game.gameType,
      game.title,
      JSON.stringify(game.publicConfig),
      JSON.stringify(game.privateConfig),
      JSON.stringify(game.state),
      actorUserId
    ]
  );
  return publicMiniGame(result.rows[0]);
}

export async function submitMiniGameAnswer(client, { roomId, gameId, actorUserId, answer }) {
  const current = await client.query(
    `SELECT * FROM room_mini_games
     WHERE id = $1 AND room_id = $2 AND status = 'active'
     FOR UPDATE`,
    [gameId, roomId]
  );
  const row = current.rows[0];
  if (!row) return { found: false };

  const expected = row.private_config?.answer_hash || "";
  const correct = expected && hashAnswer(answer) === expected;
  const state = row.state || {};
  const attemptsLeft = Math.max(0, Number(state.attempts_left ?? row.public_config?.max_attempts ?? 3));
  const nextState = {
    ...state,
    attempts_used: Number(state.attempts_used || 0) + 1,
    attempts_left: correct ? attemptsLeft : Math.max(0, attemptsLeft - 1),
    last_submit_at: new Date().toISOString()
  };
  const nextStatus = correct ? "completed" : nextState.attempts_left <= 0 ? "failed" : "active";

  const updated = await client.query(
    `UPDATE room_mini_games
     SET state = $4::jsonb,
         status = $5,
         completed_by_user_id = CASE WHEN $5 IN ('completed', 'failed') THEN $3 ELSE completed_by_user_id END,
         completed_at = CASE WHEN $5 IN ('completed', 'failed') THEN now() ELSE completed_at END,
         updated_at = now()
     WHERE id = $1 AND room_id = $2
     RETURNING *`,
    [gameId, roomId, actorUserId, JSON.stringify(nextState), nextStatus]
  );
  return {
    found: true,
    correct,
    completed: nextStatus !== "active",
    game: publicMiniGame(updated.rows[0])
  };
}

export async function forceCompleteMiniGame(client, { roomId, gameId, actorUserId }) {
  const result = await client.query(
    `UPDATE room_mini_games
     SET status = 'skipped',
         completed_by_user_id = $3,
         completed_at = now(),
         updated_at = now()
     WHERE id = $1 AND room_id = $2 AND status = 'active'
     RETURNING *`,
    [gameId, roomId, actorUserId]
  );
  return publicMiniGame(result.rows[0]);
}

export async function listRoomMiniGames(roomId, { limit = 20 } = {}) {
  const result = await query(
    `SELECT id, room_id, game_type, title, public_config, state, status,
            created_by_user_id, completed_by_user_id, completed_at, created_at, updated_at
     FROM room_mini_games
     WHERE room_id = $1
     ORDER BY updated_at DESC
     LIMIT $2`,
    [roomId, limit]
  );
  return result.rows.map(publicMiniGame);
}
