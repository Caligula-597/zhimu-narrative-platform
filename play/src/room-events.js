import { api } from "./api.js";

const POLL_MS = 15000;
const RECONNECT_MS = 5000;

let streamAbort = null;
let reconnectTimer = null;
let pollTimer = null;
let boundRoomId = "";

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(connect) {
  if (reconnectTimer || !boundRoomId) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_MS);
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
        await ctx.onRefresh();
        if (data.itemName) ctx.onToast(`获得物品：${data.itemName}`);
      }
      break;
    case "room.section_unlocked":
    case "room.player_joined":
    case "room.checkpoint_restored":
      await ctx.onRefresh();
      if (type === "room.section_unlocked") ctx.onToast("新分幕已解锁");
      break;
    case "room.scene_unlocked":
      await ctx.onRefresh();
      ctx.onToast("新场景已开放");
      break;
    case "room.host_event_pending":
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
      await ctx.onRefresh();
      break;
    case "room.voice_message_created":
      if (data.voiceRoomId === ctx.getVoiceRoomId?.()) {
        await ctx.onVoiceRefresh?.();
      }
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
  if (ctx?.setConnected) ctx.setConnected(false);
}

export function syncRoomPoll(active, ctx) {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (!active || !ctx.getRoomId()) return;
  pollTimer = setInterval(async () => {
    if (ctx.getView() !== "game" || !ctx.getRoomId()) return;
    try {
      await ctx.onRefresh();
    } catch {
      /* polling is best-effort */
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

    api.streamRoomEvents(roomId, async (type, data) => {
      if (type === "__connected__") {
        ctx.setConnected?.(true);
        return;
      }
      await handleRoomEvent(type, data, ctx);
    }, signal).catch(() => {}).finally(() => {
      const shouldReconnect = boundRoomId === roomId && !signal.aborted;
      ctx.setConnected?.(false);
      if (shouldReconnect) scheduleReconnect(connect);
    });
  };

  connect();
  syncRoomPoll(true, ctx);
}
