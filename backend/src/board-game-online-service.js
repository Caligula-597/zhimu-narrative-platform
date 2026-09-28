import { transactionWithEvents } from "./transaction-events.js";
import { applyBoardGameOnlineCommand, createBoardGameDeadline, createBoardGameOnlineSnapshot, projectBoardGameViewerState } from "../../shared/board-game-online-runtime.js";
import { compileBoardGameEngine, createBoardGameRuntimeState } from "../../shared/board-game-engine.js";
import { normalizeBoardGameDesign } from "../../shared/board-game-design.js";

const DEADLINE_SECONDS = 15;

function fail(code, message = code, details = undefined) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  throw error;
}

function roomDesign(room) {
  const value = room.world_settings?.boardGameDesign;
  if (!value || typeof value !== "object") fail("BOARD_GAME_DESIGN_MISSING", "当前世界还没有可运行的桌游设计。");
  return normalizeBoardGameDesign(value);
}

function stateFromRoom(room) {
  return room.settings?.boardGameRuntime && typeof room.settings.boardGameRuntime === "object"
    ? room.settings.boardGameRuntime
    : null;
}

async function loadRoom(client, roomId, { forUpdate = false } = {}) {
  const result = await client.query(
    `SELECT r.id, r.world_id, r.settings, w.settings AS world_settings
     FROM rooms r JOIN worlds w ON w.id = r.world_id
     WHERE r.id = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [roomId]
  );
  if (!result.rows[0]) fail("ROOM_NOT_FOUND", "运行房不存在。");
  return result.rows[0];
}

async function loadMembership(client, roomId, actorId) {
  const result = await client.query(
    `SELECT rm.member_type, rm.role_slot_id, rs.sequence
     FROM room_members rm
     LEFT JOIN role_slots rs ON rs.id = rm.role_slot_id
     WHERE rm.room_id = $1 AND rm.user_id = $2 AND rm.status = 'active'`,
    [roomId, actorId]
  );
  if (!result.rows[0]) fail("ROOM_MEMBERSHIP_REQUIRED", "你还没有加入这个运行房。");
  return result.rows[0];
}

function playerSeatIndex(membership) {
  return Number.isFinite(Number(membership.sequence)) ? Math.max(0, Number(membership.sequence) - 1) : null;
}

function publicSnapshot(design, state, now = Date.now()) {
  const snapshot = createBoardGameOnlineSnapshot(design, state, {
    serverNow: now,
    deadline: state.online?.deadline || null,
    revision: state.online?.revision ?? state.sequence
  });
  delete snapshot.viewerStates;
  return snapshot;
}

function viewerResponse(design, state, membership, now = Date.now()) {
  const snapshot = publicSnapshot(design, state, now);
  const seatIndex = playerSeatIndex(membership);
  return {
    snapshot,
    viewerState: seatIndex == null ? null : projectBoardGameViewerState(state, seatIndex)
  };
}

async function persistRoomState(client, room, state) {
  const settings = { ...(room.settings || {}), boardGameRuntime: state };
  await client.query(
    `UPDATE rooms SET settings = $2::jsonb, updated_at = now() WHERE id = $1`,
    [room.id, JSON.stringify(settings)]
  );
  return state;
}

function runtimeResponse(design, state, membership, now = Date.now()) {
  return {
    status: state.online?.status || (state.ended ? "FINISHED" : "RUNNING"),
    revision: state.online?.revision ?? 0,
    ...viewerResponse(design, state, membership, now)
  };
}

function validateRunnable(design) {
  const seatCount = design.seats.length || design.playerCount.min;
  const report = compileBoardGameEngine(design, seatCount);
  if (report.blocking) fail("BOARD_GAME_NOT_RUNNABLE", "桌游设计还没有通过引擎检查。", { issues: report.issues });
  return seatCount;
}

export async function getBoardGameRuntime({ roomId, actorId }) {
  return transactionWithEvents(async (client, queueEvent) => {
    const room = await loadRoom(client, roomId);
    const membership = await loadMembership(client, roomId, actorId);
    let state = stateFromRoom(room);
    // A board-game room has no separate narrative host panel yet. The first
    // authorized room read therefore materializes the authoritative runtime;
    // subsequent reads remain ordinary snapshot reads and are idempotent.
    if (!state) {
      const design = roomDesign(room);
      const seatCount = validateRunnable(design);
      state = createBoardGameRuntimeState(design, seatCount);
      state.online = {
        protocolVersion: 1,
        revision: 0,
        lastCommandId: null,
        lastClientSequence: 0,
        deadline: createBoardGameDeadline(Date.now(), DEADLINE_SECONDS)
      };
      await persistRoomState(client, room, state);
      queueEvent(roomId, "room.board_game_state_updated", {
        revision: 0,
        snapshot: publicSnapshot(design, state)
      });
    }
    return runtimeResponse(roomDesign(room), state, membership);
  }).catch((error) => {
    throw error;
  });
}

export async function initializeBoardGameRuntime({ roomId, actorId }) {
  return transactionWithEvents(async (client, queueEvent) => {
    const room = await loadRoom(client, roomId, { forUpdate: true });
    const membership = await loadMembership(client, roomId, actorId);
    if (!["host", "cohost"].includes(membership.member_type)) fail("HOST_ROLE_REQUIRED", "只有主持人可以初始化桌游运行态。");
    const design = roomDesign(room);
    const seatCount = validateRunnable(design);
    const state = createBoardGameRuntimeState(design, seatCount);
    state.online = {
      protocolVersion: 1,
      revision: 0,
      lastCommandId: null,
      lastClientSequence: 0,
      deadline: createBoardGameDeadline(Date.now(), DEADLINE_SECONDS)
    };
    await persistRoomState(client, room, state);
    queueEvent(roomId, "room.board_game_state_updated", {
      revision: 0,
      snapshot: publicSnapshot(design, state)
    });
    return runtimeResponse(design, state, membership);
  });
}

export async function submitBoardGameCommand({ roomId, actorId, command }) {
  return transactionWithEvents(async (client, queueEvent) => {
    const room = await loadRoom(client, roomId, { forUpdate: true });
    const membership = await loadMembership(client, roomId, actorId);
    const design = roomDesign(room);
    const state = stateFromRoom(room);
    if (!state) fail("BOARD_GAME_RUNTIME_MISSING", "桌游运行态还没有初始化。");
    const seatIndex = playerSeatIndex(membership);
    if (!["host", "cohost"].includes(membership.member_type) && seatIndex !== Number(command?.seatIndex)) {
      fail("BOARD_GAME_SEAT_FORBIDDEN", "命令不能代表另一个玩家席位。");
    }
    const result = applyBoardGameOnlineCommand(design, state, command, {
      serverNow: Date.now(),
      deadline: state.online?.deadline || null
    });
    if (!result.ok) {
      const publicCode = ["DEADLINE_EXPIRED", "DESIGN_SIGNATURE_MISMATCH", "COMMAND_ID_MISSING"].includes(result.code)
        ? result.code
        : "BOARD_GAME_COMMAND_REJECTED";
      fail(publicCode, result.message || "桌游命令被拒绝。", { runtimeCode: result.code });
    }
    if (result.duplicate) return runtimeResponse(design, state, membership);
    const next = result.state;
    if (command.commandType === "advance") {
      next.online.deadline = createBoardGameDeadline(Date.now(), DEADLINE_SECONDS);
    }
    await persistRoomState(client, room, next);
    queueEvent(roomId, "room.board_game_state_updated", {
      revision: next.online.revision,
      snapshot: publicSnapshot(design, next)
    });
    return runtimeResponse(design, next, membership);
  });
}

