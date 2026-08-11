import { api } from "../api.js";
import { formatApiError } from "../errors.js";
import { getRoomId, getWorldId, setRoomId, setWorldId } from "../session.js";
import { state } from "../state.js";

let loadPromise = null;
let loadKey = "";
let roomRefreshGeneration = 0;

export function applyHostPlayersPayload(value) {
  state.cloudHostPlayers = value?.players || [];
  state.cloudHostStuckCount = value?.stuckCount || 0;
  state.cloudHostPlayersError = "";
}

export function failHostPlayersLoad(error) {
  state.cloudHostPlayers = [];
  state.cloudHostStuckCount = 0;
  state.cloudHostPlayersError = formatApiError(error, "无法加载玩家进度");
}

export function applyHostMiniGamesPayload(value) {
  state.cloudHostMiniGames = Array.isArray(value?.games) ? value.games : [];
}

export function applyHostVoiceSessionPayload(value) {
  state.voiceSession = value || null;
  const rooms = value?.voiceRooms || [];
  const preferred = rooms.find((room) => room.id === value?.voicePolicy?.mainRoomId)
    || rooms.find((room) => room.room_type === "public")
    || null;
  state.hostVoiceRoomId = preferred?.id || "";
}

export async function loadHostData(withToast = false, force = false) {
  const roomId = getRoomId();
  const worldId = getWorldId();
  const key = `${worldId}:${roomId}`;
  if (!force && loadPromise && loadKey === key) return loadPromise;
  loadKey = key;
  loadPromise = loadHostDataInternal(withToast).finally(() => {
    if (loadKey === key) {
      loadPromise = null;
      loadKey = "";
    }
  });
  return loadPromise;
}

async function loadHostDataInternal(withToast = false) {
  const roomId = getRoomId();
  const worldId = getWorldId();
  state.loading = true;
  state.apiError = "";
  if (state.view === "console") renderRef();
  const errors = [];

  try {
    if (!worldId) {
      errors.push("请先选择剧本世界");
    } else {
      try {
        if (roomId) {
          try {
            const runtime = await api.getRuntimeContent();
            state.runtimeContent = runtime;
            state.studio = runtime?.content || null;
            state.rules = runtime?.content?.rules || [];
            state.cloudWorldSegments = runtime?.content?.segments || [];
          } catch (error) {
            if (error?.status !== 404) throw error;
            const [studio, rules, segments] = await Promise.all([
              api.getStudio(worldId),
              api.getRules(worldId),
              api.getWorldSegments(worldId).catch(() => ({ segments: [] }))
            ]);
            state.runtimeContent = null;
            state.studio = studio;
            state.rules = rules;
            state.cloudWorldSegments = segments?.segments || [];
          }
        } else {
          const [studio, rules, segments] = await Promise.all([
            api.getStudio(worldId),
            api.getRules(worldId),
            api.getWorldSegments(worldId).catch(() => ({ segments: [] }))
          ]);
          state.runtimeContent = null;
          state.studio = studio;
          state.rules = rules;
          state.cloudWorldSegments = segments?.segments || [];
        }
      } catch (error) {
        state.runtimeContent = null;
        state.studio = null;
        state.cloudWorldSegments = [];
        errors.push(formatApiError(error, "无法加载剧本数据"));
      }
      try {
        state.rooms = await api.getWorldRooms(worldId);
        const current = state.rooms.find((room) => room.id === roomId);
        if (current) state.room = current;
      } catch (error) {
        state.rooms = [];
        errors.push(formatApiError(error, "无法加载平行房列表"));
      }
    }

    if (roomId && worldId) {
      const logParams = { limit: "20", roomId };
      const results = await Promise.allSettled([
        api.getHostPlayers(),
        api.getHostEvents(),
        api.getWorldLogs(logParams),
        api.getHostClueMatrix(),
        api.getHostAuditLog().catch(() => ({ entries: [] })),
        api.getHostTestimonies().catch(() => ({ items: [] })),
        api.getHostSegmentRemedies().catch(() => ({ items: [] })),
        api.getHostVotes().catch(() => ({ votes: [] })),
        api.getHostPrivateActions().catch(() => ({ actions: [] })),
        api.getHostMiniGames().catch(() => ({ games: [] })),
        api.getHostCurrentState().catch(() => null),
        api.getHostMechanismRuntime().catch((error) => ({
          initialized: false,
          error: formatApiError(error, "机制运行态加载失败"),
          errorCode: error?.code || ""
        })),
        api.getVoiceSession().catch(() => null)
      ]);
      if (results[0].status === "fulfilled") applyHostPlayersPayload(results[0].value);
      else {
        failHostPlayersLoad(results[0].reason);
        errors.push(formatApiError(results[0].reason, "玩家进度加载失败"));
      }
      if (results[1].status === "fulfilled") state.cloudHostEvents = results[1].value || [];
      else state.cloudHostEvents = [];
      if (results[2].status === "fulfilled") state.cloudWorldLogs = results[2].value || [];
      if (results[3].status === "fulfilled") state.cloudHostClueMatrix = results[3].value;
      if (results[4].status === "fulfilled") state.cloudHostAuditLog = results[4].value?.entries || [];
      if (results[5].status === "fulfilled") state.cloudHostTestimonies = results[5].value?.items || [];
      if (results[6].status === "fulfilled") state.cloudHostSegmentRemedies = results[6].value?.items || [];
      if (results[7].status === "fulfilled") state.cloudHostVotes = results[7].value?.votes || [];
      if (results[8].status === "fulfilled") state.cloudHostPrivateActions = results[8].value?.actions || [];
      if (results[9].status === "fulfilled") applyHostMiniGamesPayload(results[9].value);
      if (results[10].status === "fulfilled") state.currentState = results[10].value;
      if (results[11].status === "fulfilled") state.cloudHostMechanismRuntime = results[11].value;
      if (results[12].status === "fulfilled") applyHostVoiceSessionPayload(results[12].value);
    } else {
      state.cloudHostPlayers = [];
      state.cloudHostEvents = [];
      state.cloudWorldSegments = [];
      state.cloudWorldLogs = [];
      state.cloudHostClueMatrix = null;
      state.cloudHostAuditLog = [];
      state.cloudHostTestimonies = [];
      state.cloudHostSegmentRemedies = [];
      state.cloudHostVotes = [];
      state.cloudHostPrivateActions = [];
      state.cloudHostMiniGames = [];
      state.currentState = null;
      state.cloudHostMechanismRuntime = null;
      state.voiceSession = null;
      state.hostVoiceRoomId = "";
      state.hostMechanismBusy = "";
      state.hostMechanismError = "";
      state.cloudRunReport = null;
    }

    state.apiError = [...new Set(errors)].join(" · ");
    if (withToast) {
      showToastInternal(errors.length ? errors[0] : "主持数据已刷新");
    }
  } finally {
    state.loading = false;
    if (state.view === "console") renderRef();
  }
}

let toastRef = () => {};
let renderRef = () => {};

export function bindDataContext({ showToast, render }) {
  toastRef = showToast;
  renderRef = render;
}

function showToastInternal(message) {
  toastRef(message);
}

export async function refreshHostEvents(withToast = false, silent = false) {
  if (!getRoomId()) {
    if (withToast && !silent) toastRef("请先选择运行房");
    return;
  }
  try {
    state.cloudHostEvents = (await api.getHostEvents()) || [];
    if (state.view === "console") renderRef();
    if (withToast && !silent) toastRef(`待确认事件已刷新（${state.cloudHostEvents.length} 条）`);
  } catch (error) {
    if (withToast && !silent) toastRef(formatApiError(error, "刷新失败"));
  }
}

export async function refreshHostPlayers(withToast = false, silent = false) {
  if (!getRoomId()) {
    if (withToast && !silent) toastRef("请先选择运行房");
    return;
  }
  try {
    applyHostPlayersPayload(await api.getHostPlayers());
    if (state.view === "console") renderRef();
    if (withToast && !silent) {
      toastRef(`玩家进度已刷新（${state.cloudHostPlayers.filter((p) => p.joined).length} 人已加入）`);
    }
  } catch (error) {
    failHostPlayersLoad(error);
    if (state.view === "console") renderRef();
    if (withToast && !silent) toastRef(formatApiError(error, "刷新失败"));
  }
}

export async function refreshHostAuditLog(withToast = false, silent = false) {
  if (!getRoomId()) return;
  try {
    const payload = await api.getHostAuditLog();
    state.cloudHostAuditLog = payload?.entries || [];
    if (state.view === "console") renderRef();
    if (withToast && !silent) toastRef(`主持审计已刷新（${state.cloudHostAuditLog.length} 条）`);
  } catch (error) {
    if (withToast && !silent) toastRef(formatApiError(error, "刷新失败"));
  }
}

export async function refreshHostClueMatrix(withToast = false, silent = false) {
  if (!getRoomId()) return false;
  try {
    state.cloudHostClueMatrix = await api.getHostClueMatrix();
    if (state.view === "console") renderRef();
    if (withToast && !silent) toastRef("线索矩阵已刷新");
    return true;
  } catch (error) {
    if (withToast && !silent) toastRef(formatApiError(error, "刷新失败"));
    return false;
  }
}

export async function refreshHostMiniGames(withToast = false, silent = false) {
  if (!getRoomId()) return;
  try {
    applyHostMiniGamesPayload(await api.getHostMiniGames());
    if (state.view === "console") renderRef();
    if (withToast && !silent) toastRef("小游戏运行状态已刷新");
  } catch (error) {
    if (withToast && !silent) toastRef(formatApiError(error, "小游戏状态刷新失败"));
  }
}

export async function refreshHostRoom(withToast = false) {
  if (!getRoomId()) {
    if (withToast) toastRef("请先选择运行房");
    return false;
  }
  const generation = ++roomRefreshGeneration;
  try {
    const logParams = { limit: "20", roomId: getRoomId() };
    const [hostPlayers, hostEvents, worldLogs, clueMatrix, auditLog, miniGames, votes, privateActions, currentState, mechanismRuntime, voiceSession] = await Promise.all([
      api.getHostPlayers(),
      api.getHostEvents(),
      api.getWorldLogs(logParams),
      api.getHostClueMatrix(),
      api.getHostAuditLog().catch(() => ({ entries: [] })),
      api.getHostMiniGames().catch(() => ({ games: [] })),
      api.getHostVotes().catch(() => ({ votes: [] })),
      api.getHostPrivateActions().catch(() => ({ actions: [] })),
      api.getHostCurrentState().catch(() => null),
      api.getHostMechanismRuntime().catch((error) => ({
        initialized: false,
        error: formatApiError(error, "机制运行态加载失败"),
        errorCode: error?.code || ""
      })),
      api.getVoiceSession().catch(() => null)
    ]);
    if (generation !== roomRefreshGeneration) return false;
    applyHostPlayersPayload(hostPlayers);
    state.cloudHostEvents = hostEvents || [];
    state.cloudWorldLogs = worldLogs || [];
    state.cloudHostClueMatrix = clueMatrix;
    state.cloudHostAuditLog = auditLog?.entries || [];
    applyHostMiniGamesPayload(miniGames);
    state.cloudHostVotes = votes?.votes || [];
    state.cloudHostPrivateActions = privateActions?.actions || [];
    state.currentState = currentState;
    state.cloudHostMechanismRuntime = mechanismRuntime;
    applyHostVoiceSessionPayload(voiceSession);
    if (state.view === "console") renderRef();
    if (withToast) {
      toastRef(
        `房间状态已刷新 · 待确认 ${state.cloudHostEvents.length} 条 · 玩家 ${state.cloudHostPlayers.filter((p) => p.joined).length} 人`
      );
    }
    return true;
  } catch (error) {
    if (generation !== roomRefreshGeneration) return false;
    failHostPlayersLoad(error);
    if (state.view === "console") renderRef();
    if (withToast) toastRef(formatApiError(error, "刷新失败"));
    return false;
  }
}

export async function refreshHostVoiceSession({ render = true } = {}) {
  if (!getRoomId()) return null;
  const session = await api.getVoiceSession();
  applyHostVoiceSessionPayload(session);
  if (render && state.view === "console") renderRef();
  return session;
}

export async function loadWorldsList() {
  try {
    const payload = await api.getWorlds();
    state.worlds = Array.isArray(payload) ? payload : payload?.worlds || [];
  } catch (error) {
    state.worlds = [];
    state.error = formatApiError(error, "无法加载剧本列表");
  }
}

export async function resolveRoomDeepLink(roomId) {
  if (!roomId) return false;
  await loadWorldsList();
  for (const world of state.worlds) {
    try {
      const rooms = await api.getWorldRooms(world.id);
      const room = rooms.find((item) => item.id === roomId);
      if (room) {
        setWorldId(world.id);
        setRoomId(world.id, room.id);
        state.room = room;
        state.rooms = rooms;
        return true;
      }
    } catch {
      /* try next world */
    }
  }
  return false;
}
