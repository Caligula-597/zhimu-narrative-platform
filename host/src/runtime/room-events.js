import { api } from "../api.js";
import { getRoomId } from "../session.js";
import { state } from "../state.js";
import {
  refreshHostClueMatrix,
  refreshHostEvents,
  refreshHostPlayers,
  refreshHostRoom
} from "./data.js";

const DIRECTOR_POLL_MS = 15000;
let directorPollTimer = null;
let directorPollInFlight = false;
let roomEventAbort = null;
let roomEventReconnectTimer = null;

let renderRef = () => {};
let showToastRef = (_msg, _ms) => {};

export function bindRoomEventsContext({ render, showToast }) {
  renderRef = render;
  showToastRef = showToast;
}

function render() {
  renderRef();
}

function showToast(message, ms) {
  showToastRef(message, ms);
}

async function refreshDirectorPoll() {
  try {
    await Promise.all([
      refreshHostEvents(false, true),
      refreshHostPlayers(false, true),
      refreshHostClueMatrix(false, true)
    ]);
    if (state.view === "console") render();
  } catch (error) {
    state.apiError = error.message;
  }
}

export function syncDirectorPolling() {
  if (state.roomEventsConnected) {
    if (directorPollTimer) {
      clearInterval(directorPollTimer);
      directorPollTimer = null;
    }
    return;
  }
  if (state.view === "console" && getRoomId()) {
    if (!directorPollTimer) {
      directorPollTimer = setInterval(async () => {
        if (state.view !== "console" || !getRoomId()) {
          clearInterval(directorPollTimer);
          directorPollTimer = null;
          return;
        }
        if (directorPollInFlight) return;
        directorPollInFlight = true;
        try {
          await refreshDirectorPoll();
        } finally {
          directorPollInFlight = false;
        }
      }, DIRECTOR_POLL_MS);
    }
  } else if (directorPollTimer) {
    clearInterval(directorPollTimer);
    directorPollTimer = null;
  }
}

export function disconnectRoomEvents() {
  if (roomEventReconnectTimer) {
    clearTimeout(roomEventReconnectTimer);
    roomEventReconnectTimer = null;
  }
  if (roomEventAbort) {
    roomEventAbort.abort();
    roomEventAbort = null;
  }
  if (state.roomEventsConnected) {
    state.roomEventsConnected = false;
    syncDirectorPolling();
    if (state.view === "console") render();
  }
}

function scheduleRoomEventReconnect() {
  if (roomEventReconnectTimer || !getRoomId()) return;
  roomEventReconnectTimer = setTimeout(() => {
    roomEventReconnectTimer = null;
    connectRoomEvents();
  }, 5000);
}

async function handleRoomEvent(type, data) {
  if (!getRoomId()) return;
  switch (type) {
    case "room.player_joined":
      await refreshHostPlayers(false, true);
      showToast("有新玩家加入房间", 2800);
      break;
    case "room.player_kicked":
      await refreshHostPlayers(false, true);
      showToast("已移出玩家", 2800);
      break;
    case "room.section_completed":
      await refreshHostPlayers(false, true);
      await refreshHostEvents(false, true);
      break;
    case "room.clue_granted":
      await refreshHostPlayers(false, true);
      await refreshHostClueMatrix(false, true);
      break;
    case "room.item_granted":
      await refreshHostPlayers(false, true);
      break;
    case "room.host_event_pending":
      await refreshHostEvents(false, true);
      await refreshHostPlayers(false, true);
      if (data.action === "executed") showToast("待确认事件已执行 · 玩家端将收到解锁通知", 3200);
      else if (data.action === "dismissed") showToast("待确认事件已拒绝", 2800);
      else showToast("有新的待确认事件 · 玩家可能在等待", 3200);
      break;
    case "room.section_unlocked":
    case "room.scene_unlocked":
      await refreshHostPlayers(false, true);
      break;
    case "room.investigation_completed":
      await refreshHostPlayers(false, true);
      await refreshHostEvents(false, true);
      break;
    case "room.checkpoint_restored":
      await refreshHostRoom(false);
      showToast("房间已从存档恢复", 2800);
      break;
    default:
      break;
  }
}

export function connectRoomEvents() {
  disconnectRoomEvents();
  const roomId = getRoomId();
  if (!roomId) return;
  const boundRoom = roomId;
  roomEventAbort = new AbortController();
  const signal = roomEventAbort.signal;
  api
    .streamRoomEvents(roomId, async (type, payload) => {
      if (type === "__connected__") {
        state.roomEventsConnected = true;
        state.roomEventsStatus = "live";
        syncDirectorPolling();
        if (state.view === "console") render();
        return;
      }
      await handleRoomEvent(type, payload);
    }, signal)
    .catch(() => {})
    .finally(() => {
      const shouldReconnect = state.view === "console" && getRoomId() === boundRoom && !signal.aborted;
      state.roomEventsConnected = false;
      state.roomEventsStatus = shouldReconnect ? "reconnecting" : "idle";
      syncDirectorPolling();
      if (shouldReconnect) scheduleRoomEventReconnect();
    });
}

export function syncRoomStream() {
  if (state.view === "console" && getRoomId()) connectRoomEvents();
  else disconnectRoomEvents();
}
