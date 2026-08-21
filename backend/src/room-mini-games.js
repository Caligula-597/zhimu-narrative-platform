import { createHash } from "node:crypto";
import { MINI_GAME_PROTOCOL_VERSION, normalizeMiniGameTemplate } from "../../shared/mini-game-protocol.js";
import { throwErr } from "./api-errors.js";
import { query } from "./db.js";

function normalizeAnswerForHash(answer, pluginKey = "zhimu_lock") {
  const raw = String(answer ?? "").trim();
  if (pluginKey === "zhimu_sequence") {
    return raw
      .replace(/[，、；;|/]+/g, ",")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 12)
      .join(",");
  }
  if (pluginKey === "zhimu_guess") {
    return raw.replace(/\s+/g, "").toLowerCase().slice(0, 64);
  }
  return raw;
}

function hashAnswer(answer, pluginKey = "zhimu_lock") {
  return createHash("sha256")
    .update(normalizeAnswerForHash(answer, pluginKey))
    .digest("hex");
}

function isoDeadline(timeoutSeconds, start = Date.now()) {
  return timeoutSeconds > 0 ? new Date(start + timeoutSeconds * 1000).toISOString() : null;
}

function hasExpired(row, now = Date.now()) {
  return row?.status === "active"
    && row.deadline_at
    && new Date(row.deadline_at).getTime() <= now;
}

function assertRevision(row, expectedRevision) {
  if (expectedRevision == null) return;
  if (Number(expectedRevision) !== Number(row.revision ?? 1)) {
    throwErr("MINI_GAME_VERSION_CONFLICT", undefined, {
      expectedRevision: Number(expectedRevision),
      actualRevision: Number(row.revision ?? 1),
    });
  }
}

function safeSettlement(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    outcome: ["success", "failed", "skipped"].includes(source.outcome) ? source.outcome : "skipped",
    publicSummary: String(source.publicSummary ?? "").trim().slice(0, 1000),
    recapData: source.recapData && typeof source.recapData === "object" && !Array.isArray(source.recapData)
      ? Object.fromEntries(Object.entries(source.recapData).slice(0, 20))
      : {},
    settledAt: new Date().toISOString(),
  };
}

export function buildLockGameConfig(body = {}) {
  const template = normalizeMiniGameTemplate(body);
  if (!template.answer) throwErr("BAD_REQUEST", "Mini game answer is required");
  return {
    protocolVersion: MINI_GAME_PROTOCOL_VERSION,
    gameType: template.pluginKey,
    title: template.title,
    deadlineAt: isoDeadline(template.timeoutSeconds),
    publicConfig: {
      protocolVersion: MINI_GAME_PROTOCOL_VERSION,
      pluginKey: template.pluginKey,
      title: template.title,
      prompt: template.prompt,
      hint: template.hint,
      length: template.length,
      max_attempts: template.maxAttempts,
      timeout_seconds: template.timeoutSeconds,
      allow_recovery: template.allowRecovery,
      success_text: template.successText,
      failure_text: template.failureText,
      recap_label: template.recapLabel,
    },
    privateConfig: { answer_hash: hashAnswer(template.answer, template.pluginKey) },
    state: {
      phase: "active",
      attempts_left: template.maxAttempts,
      attempts_used: 0,
      submission_count: 0,
      recovery_count: 0,
      started_at: new Date().toISOString(),
    },
  };
}

export function publicMiniGame(row) {
  if (!row) return null;
  const config = row.public_config || {};
  const state = row.state || {};
  const rawSettlement = row.settlement && typeof row.settlement === "object" ? row.settlement : {};
  const settlement = Object.keys(rawSettlement).length ? {
    outcome: rawSettlement.outcome || "skipped",
    publicSummary: String(rawSettlement.publicSummary || "").slice(0, 1000),
    settledAt: rawSettlement.settledAt || null,
  } : {};
  const expired = hasExpired(row);
  let status = "playing";
  if (expired || row.status === "timed_out") status = "timeout";
  if (row.status === "completed") status = "success";
  if (row.status === "failed") status = "fail";
  if (row.status === "skipped") status = settlement.outcome === "failed" ? "fail" : "success";
  return {
    id: row.id,
    instanceId: row.id,
    instance_id: row.id,
    protocolVersion: Number(row.protocol_version ?? config.protocolVersion ?? 1),
    protocol_version: Number(row.protocol_version ?? config.protocolVersion ?? 1),
    revision: Number(row.revision ?? 1),
    gameType: row.game_type,
    game_type: row.game_type,
    pluginKey: config.pluginKey || row.game_type,
    title: row.title,
    config,
    status,
    phase: expired ? "timed_out" : (state.phase || status),
    attemptsLeft: state.attempts_left ?? null,
    attempts_left: state.attempts_left ?? null,
    deadlineAt: row.deadline_at ?? null,
    deadline_at: row.deadline_at ?? null,
    settlement: Object.keys(settlement).length ? settlement : null,
    completedAt: row.completed_at ?? null,
    completed_at: row.completed_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

async function expireElapsedGame(client, row) {
  if (!hasExpired(row)) return row;
  const state = {
    ...(row.state || {}),
    phase: "timed_out",
    failure_reason: "deadline_elapsed",
    timed_out_at: new Date().toISOString(),
  };
  const result = await client.query(
    `UPDATE room_mini_games
     SET state = $3::jsonb, status = 'timed_out', revision = revision + 1,
         completed_at = now(), updated_at = now()
     WHERE id = $1 AND room_id = $2 AND status = 'active'
     RETURNING *`,
    [row.id, row.room_id, JSON.stringify(state)],
  );
  return result.rows[0] || row;
}

export async function fetchCurrentMiniGame(runQuery, roomId) {
  const result = await runQuery(
    `SELECT * FROM room_mini_games
     WHERE room_id = $1
     ORDER BY updated_at DESC LIMIT 1`,
    [roomId],
  );
  return publicMiniGame(result.rows[0]);
}

export async function startLockMiniGame(client, { roomId, actorUserId, body }) {
  const game = buildLockGameConfig(body);
  await client.query(
    `UPDATE room_mini_games
     SET status = 'skipped', completed_at = now(), revision = revision + 1, updated_at = now()
     WHERE room_id = $1 AND status = 'active'`,
    [roomId],
  );
  const result = await client.query(
    `INSERT INTO room_mini_games
       (room_id, protocol_version, game_type, title, public_config, private_config,
        state, status, deadline_at, revision, settlement, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb,
             'active', $8, 1, '{}'::jsonb, $9)
     RETURNING *`,
    [roomId, game.protocolVersion, game.gameType, game.title,
      JSON.stringify(game.publicConfig), JSON.stringify(game.privateConfig),
      JSON.stringify(game.state), game.deadlineAt, actorUserId],
  );
  return publicMiniGame(result.rows[0]);
}

export async function submitMiniGameAnswer(client, {
  roomId, gameId, actorUserId, answer, expectedRevision,
}) {
  const current = await client.query(
    `SELECT * FROM room_mini_games WHERE id = $1 AND room_id = $2 FOR UPDATE`,
    [gameId, roomId],
  );
  let row = current.rows[0];
  if (!row) return { found: false };
  assertRevision(row, expectedRevision);
  row = await expireElapsedGame(client, row);
  if (row.status !== "active") {
    return {
      found: true,
      correct: false,
      completed: true,
      timedOut: row.status === "timed_out",
      game: publicMiniGame(row),
    };
  }

  const expected = row.private_config?.answer_hash || "";
  const pluginKey = row.game_type || row.public_config?.pluginKey || "zhimu_lock";
  const correct = Boolean(expected) && hashAnswer(answer, pluginKey) === expected;
  const state = row.state || {};
  const attemptsLeft = Math.max(0, Number(state.attempts_left ?? row.public_config?.max_attempts ?? 3));
  const nextState = {
    ...state,
    phase: correct ? "success" : (attemptsLeft <= 1 ? "failed" : "active"),
    attempts_used: Number(state.attempts_used || 0) + 1,
    attempts_left: correct ? attemptsLeft : Math.max(0, attemptsLeft - 1),
    submission_count: Number(state.submission_count || 0) + 1,
    last_submit_at: new Date().toISOString(),
  };
  const nextStatus = correct ? "completed" : nextState.attempts_left <= 0 ? "failed" : "active";
  const updated = await client.query(
    `UPDATE room_mini_games
     SET state = $4::jsonb, status = $5, revision = revision + 1,
         completed_by_user_id = CASE WHEN $5 IN ('completed', 'failed') THEN $3 ELSE completed_by_user_id END,
         completed_at = CASE WHEN $5 IN ('completed', 'failed') THEN now() ELSE completed_at END,
         updated_at = now()
     WHERE id = $1 AND room_id = $2 RETURNING *`,
    [gameId, roomId, actorUserId, JSON.stringify(nextState), nextStatus],
  );
  return {
    found: true,
    correct,
    completed: nextStatus !== "active",
    timedOut: false,
    game: publicMiniGame(updated.rows[0]),
  };
}

export async function recoverMiniGame(client, {
  roomId, gameId, actorUserId, expectedRevision, bonusAttempts = 1, timeoutSeconds = 0,
}) {
  const current = await client.query(
    `SELECT * FROM room_mini_games WHERE id = $1 AND room_id = $2 FOR UPDATE`,
    [gameId, roomId],
  );
  let row = current.rows[0];
  if (!row) return null;
  assertRevision(row, expectedRevision);
  row = await expireElapsedGame(client, row);
  if (row.status === "active") throwErr("MINI_GAME_RECOVERY_INVALID", "Mini game is still active");
  if (!["failed", "timed_out"].includes(row.status) || row.public_config?.allow_recovery === false) {
    throwErr("MINI_GAME_RECOVERY_INVALID");
  }
  const attempts = Math.max(1, Math.min(12, Number(bonusAttempts) || 1));
  const duration = Math.max(0, Math.min(86_400, Number(timeoutSeconds) || 0));
  const nextState = {
    ...(row.state || {}),
    phase: "recovered",
    attempts_left: attempts,
    recovery_count: Number(row.state?.recovery_count || 0) + 1,
    recovered_at: new Date().toISOString(),
    recovered_by_user_id: actorUserId,
  };
  delete nextState.failure_reason;
  const updated = await client.query(
    `UPDATE room_mini_games
     SET state = $3::jsonb, status = 'active', deadline_at = $4,
         completed_by_user_id = NULL, completed_at = NULL, settlement = '{}'::jsonb,
         revision = revision + 1, updated_at = now()
     WHERE id = $1 AND room_id = $2 RETURNING *`,
    [gameId, roomId, JSON.stringify(nextState), isoDeadline(duration)],
  );
  return publicMiniGame(updated.rows[0]);
}

export async function settleMiniGame(client, {
  roomId, gameId, actorUserId, expectedRevision, outcome, publicSummary, recapData,
}) {
  const current = await client.query(
    `SELECT * FROM room_mini_games WHERE id = $1 AND room_id = $2 FOR UPDATE`,
    [gameId, roomId],
  );
  const row = current.rows[0];
  if (!row) return null;
  assertRevision(row, expectedRevision);
  const settlement = safeSettlement({ outcome, publicSummary, recapData });
  const nextStatus = settlement.outcome === "success"
    ? "completed"
    : settlement.outcome === "failed" ? "failed" : "skipped";
  const nextState = {
    ...(row.state || {}),
    phase: "settled",
    settled_outcome: settlement.outcome,
  };
  const updated = await client.query(
    `UPDATE room_mini_games
     SET state = $4::jsonb, status = $5, settlement = $6::jsonb,
         completed_by_user_id = $3, completed_at = now(),
         revision = revision + 1, updated_at = now()
     WHERE id = $1 AND room_id = $2 RETURNING *`,
    [gameId, roomId, actorUserId, JSON.stringify(nextState), nextStatus, JSON.stringify(settlement)],
  );
  return publicMiniGame(updated.rows[0]);
}

export async function forceCompleteMiniGame(client, { roomId, gameId, actorUserId }) {
  return settleMiniGame(client, {
    roomId,
    gameId,
    actorUserId,
    outcome: "success",
    publicSummary: "主持人已结束机关并放行。",
    recapData: { forced: true },
  });
}

export async function listRoomMiniGames(roomId, { limit = 20 } = {}) {
  await query(
    `UPDATE room_mini_games
     SET status = 'timed_out',
         state = state || jsonb_build_object('phase', 'timed_out', 'failure_reason', 'deadline_elapsed', 'timed_out_at', now()),
         completed_at = now(), revision = revision + 1, updated_at = now()
     WHERE room_id = $1 AND status = 'active' AND deadline_at IS NOT NULL AND deadline_at <= now()`,
    [roomId],
  );
  const result = await query(
    `SELECT id, room_id, protocol_version, game_type, title, public_config, state, status,
            deadline_at, revision, settlement, created_by_user_id, completed_by_user_id,
            completed_at, created_at, updated_at
     FROM room_mini_games WHERE room_id = $1
     ORDER BY updated_at DESC LIMIT $2`,
    [roomId, limit],
  );
  return result.rows.map(publicMiniGame);
}
