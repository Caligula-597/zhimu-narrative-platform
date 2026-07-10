import { api } from "./api.js";

const POLL_MS = 15000;
const RECONNECT_MS = 5000;

let streamAbort = null;
let reconnectTimer = null;
let pollTimer = null;
let pollInFlight = false;
let boundRoomId = "";
let streamConnected = false;

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(connect, ctx) {
  if (reconnectTimer || !boundRoomId) return;
  ctxSetStatus("reconnecting", ctx);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_MS);
}

function ctxSetStatus(status, ctx) {
  ctx?.setStreamStatus?.(status);
}

async function handleRoomEvent(type, data, ctx) {
  if (ctx.getView() !== "game" || !ctx.getRoomId()) return;
  const roleId = ctx.getRoleId();
  const affectsPlayer = !data.roleSlotId || data.roleSlotId === roleId;
  const sharedClue = type === "room.clue_granted"
    && (data.source === "shared_room" || data.source === "shared_roles");

  switch (type) {
    case "room.clue_granted":
      if (affectsPlayer || sharedClue) {
        ctx.bumpTabPulse?.("clues");
        await ctx.onRefresh();
        if (data.clueName) {
          const label = data.source === "shared_room"
            ? `房间公开线索：${data.clueName}`
            : data.source === "shared_roles"
              ? `玩家分享线索：${data.clueName}`
              : `获得线索：${data.clueName}`;
          ctx.onToast(label);
        }
      }
      break;
    case "room.item_granted":
      if (affectsPlayer) {
        ctx.bumpTabPulse?.("inventory");
        await ctx.onRefresh();
        if (data.itemName) ctx.onToast(`获得物品：${data.itemName}`);
      }
      break;
    case "room.section_unlocked":
    case "room.player_joined":
    case "room.checkpoint_restored":
      if (type === "room.section_unlocked") ctx.bumpTabPulse?.("sections");
      if (type === "room.player_joined") ctx.bumpTabPulse?.("home");
      await ctx.onRefresh();
      if (type === "room.section_unlocked") ctx.onToast("新分幕已解锁");
      break;
    case "room.scene_unlocked":
      ctx.bumpTabPulse?.("explore");
      await ctx.onRefresh();
      ctx.onToast("新场景已开放");
      break;
    case "room.host_event_pending":
      ctx.bumpTabPulse?.("home");
      if (data.action === "executed") {
        ctx.bumpTabPulse?.("explore");
        ctx.bumpTabPulse?.("sections");
        ctx.bumpTabPulse?.("clues");
      }
      await ctx.onRefresh();
      if (data.action === "executed") {
        ctx.onToast("主持人已确认推进 · 新内容可能已解锁");
      } else if (data.action === "dismissed") {
        ctx.onToast("主持人已处理待确认事件");
      } else if (ctx.getHostConfirmWaiting?.()) {
        ctx.onToast("剧情推进等待主持人确认");
      }
      break;
    case "room.investigation_completed":
      if (affectsPlayer) {
        ctx.bumpTabPulse?.("explore");
        await ctx.onRefresh();
        ctx.onToast("调查点已完成 · 请查看探索页");
      }
      break;
    case "room.host_nudge": {
      const targets = data.roleSlotIds || [];
      const forMe = !targets.length || targets.some((id) => String(id) === String(roleId));
      if (forMe) {
        ctx.setHostNudge?.(data.message || "主持人提醒你稍候");
        ctx.bumpTabPulse?.("home");
        ctx.onToast(data.message || "主持人提醒你稍候");
      }
      break;
    }
    case "room.game_started":
    case "room.game_updated":
      ctx.setCurrentGame?.(data.currentGame || data.current_game || data.game || data);
      ctx.bumpTabPulse?.("home");
      ctx.onToast(data.title ? `解密机关：${data.title}` : "新的解密机关已开启");
      break;
    case "room.game_completed":
      ctx.setCurrentGame?.(data.currentGame || data.current_game || data.game || { status: "success" });
      ctx.bumpTabPulse?.("home");
      ctx.onToast(data.success === false ? "解密机关已结束" : "解密机关已解开");
      break;
    case "room.player_kicked": {
      const myId = ctx.getUserId?.();
      if (myId && data.userId && String(data.userId) === String(myId)) {
        ctx.onKicked?.(data);
      }
      break;
    }
    case "room.voice_message_created":
      if (data.voiceRoomId === ctx.getVoiceRoomId?.()) {
        ctx.onVoiceRefresh?.();
      } else {
        ctx.bumpTabPulse?.("voice");
      }
      break;
    case "room.vote_created":
    case "room.vote_updated":
    case "room.private_action_submitted":
    case "room.private_action_updated":
      ctx.bumpTabPulse?.("social");
      await ctx.onRefresh();
      if (type === "room.vote_created") ctx.onToast("主持人开启了投票/指认");
      break;
    default:
      break;
  }
}

export function disconnectRoomEvents(ctx) {
  clearReconnectTimer();
  if (streamAbort) {
    streamAbort.abort();
    streamAbort = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  boundRoomId = "";
  streamConnected = false;
  ctxSetStatus("idle", ctx);
  ctx?.setConnected?.(false);
}

export function syncRoomPoll(active, ctx) {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (!active || !ctx.getRoomId() || streamConnected) {
    if (streamConnected) ctxSetStatus("connected", ctx);
    return;
  }
  ctxSetStatus("polling", ctx);
  pollTimer = setInterval(async () => {
    if (ctx.getView() !== "game" || !ctx.getRoomId() || pollInFlight) return;
    pollInFlight = true;
    try {
      await ctx.onRefresh();
    } catch {
      /* polling is best-effort */
    } finally {
      pollInFlight = false;
    }
  }, POLL_MS);
}

export function connectRoomEvents(roomId, ctx) {
  disconnectRoomEvents(ctx);
  if (!roomId) return;
  boundRoomId = roomId;

  const connect = () => {
    if (!boundRoomId || boundRoomId !== roomId) return;
    if (streamAbort) streamAbort.abort();
    streamAbort = new AbortController();
    const signal = streamAbort.signal;
    ctxSetStatus("reconnecting", ctx);

    api.streamRoomEvents(roomId, async (type, data) => {
      if (type === "__connected__") {
        streamConnected = true;
        syncRoomPoll(false, ctx);
        ctxSetStatus("connected", ctx);
        ctx.setConnected?.(true);
        return;
      }
      await handleRoomEvent(type, data, ctx);
    }, signal).catch((error) => {
      if (error?.status === 401) ctx.onAuthLost?.();
    }).finally(() => {
      const shouldReconnect = boundRoomId === roomId && !signal.aborted;
      streamConnected = false;
      ctx.setConnected?.(false);
      if (shouldReconnect) {
        syncRoomPoll(true, ctx);
        scheduleReconnect(connect, ctx);
      } else {
        ctxSetStatus("idle", ctx);
      }
    });
  };

  connect();
  syncRoomPoll(true, ctx);
}
