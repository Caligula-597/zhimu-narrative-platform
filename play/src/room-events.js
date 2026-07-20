import { api } from "./api.js";
import { createSseLifecycle } from "../../shared/sse-lifecycle.js";

const POLL_MS = 15000;
let boundRoomId = "";
let lifecycle = null;

function ctxSetStatus(status, ctx) {
  ctx?.setStreamStatus?.(status);
}

export async function handleRoomEvent(type, data, ctx) {
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
    case "room.clue_revoked":
      if (affectsPlayer) {
        ctx.bumpTabPulse?.("clues");
        await ctx.onRefresh();
        ctx.onToast(data.clueName ? `主持人已撤回线索：${data.clueName}` : "主持人已撤回一条线索");
      }
      break;
    case "room.clue_resent":
      if (affectsPlayer) {
        ctx.bumpTabPulse?.("clues");
        await ctx.onRefresh();
        ctx.onToast(data.clueName ? `主持人补发线索：${data.clueName}` : "主持人补发了一条线索");
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
    case "room.section_relocked":
      if (affectsPlayer) {
        ctx.bumpTabPulse?.("sections");
        await ctx.onRefresh();
        ctx.onToast("主持人已撤回一个分幕");
      }
      break;
    case "room.section_skipped":
      if (affectsPlayer) {
        ctx.bumpTabPulse?.("sections");
        await ctx.onRefresh();
        ctx.onToast("主持人已跳过一个分幕并继续推进");
      }
      break;
    case "room.section_completed":
    case "room.player_task_completed":
    case "room.role_state_updated":
    case "room.physical_token_activated":
    case "room.physical_token_event":
      ctx.bumpTabPulse?.("home");
      await ctx.onRefresh();
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
    case "room.host_log_created":
      // Host-only by server audience projection; kept explicit for contract drift checks.
      break;
    case "room.host_player_notes_updated":
      // Host-only by server audience projection; player details must remain private.
      break;
    case "room.game_updated": {
      const game = data.currentGame || data.current_game || data.game || data;
      ctx.setCurrentGame?.(game);
      ctx.bumpTabPulse?.("home");
      const attempts = game.attemptsLeft ?? game.attempts_left;
      ctx.onToast(data.correct
        ? "机关已解开"
        : attempts == null ? "答案不正确" : `答案不正确，剩余 ${attempts} 次`);
      break;
    }
    case "room.game_started":
      ctx.setCurrentGame?.(data.currentGame || data.current_game || data.game || data);
      ctx.bumpTabPulse?.("home");
      ctx.onToast(data.title ? `解密机关：${data.title}` : "新的解密机关已开启");
      break;
    case "room.game_completed":
      ctx.setCurrentGame?.(data.currentGame || data.current_game || data.game || { status: "success" });
      ctx.bumpTabPulse?.("home");
      ctx.onToast(data.correct === false || data.success === false ? "机关尝试次数已耗尽" : "机关已解开");
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
    case "room.testimony_submitted":
    case "room.segment_remedy_applied":
      ctx.bumpTabPulse?.("social");
      await ctx.onRefresh();
      if (type === "room.vote_created") ctx.onToast("主持人开启了投票/指认");
      break;
    default:
      break;
  }
}

export function disconnectRoomEvents(ctx) {
  lifecycle?.stop();
  lifecycle = null;
  boundRoomId = "";
  ctxSetStatus("idle", ctx);
  ctx?.setConnected?.(false);
}

export function syncRoomPoll(active, ctx) {
  if (!active) lifecycle?.stop();
  else if (!lifecycle && ctx.getRoomId()) connectRoomEvents(ctx.getRoomId(), ctx);
}

export function connectRoomEvents(roomId, ctx) {
  disconnectRoomEvents(ctx);
  if (!roomId) return;
  boundRoomId = roomId;

  lifecycle = createSseLifecycle({
    pollMs: POLL_MS,
    open: ({ signal, onConnected }) => api.streamRoomEvents(roomId, async (type, data) => {
      if (type === "__connected__") return onConnected(data);
      await handleRoomEvent(type, data, ctx);
    }, signal, ctx.getUserId?.()),
    poll: () => {
      if (ctx.getView() !== "game" || ctx.getRoomId() !== roomId) return;
      return ctx.onRefresh();
    },
    reconcile: () => ctx.onRefresh(),
    onStatus: (status) => ctxSetStatus(status, ctx),
    onConnected: () => ctx.setConnected?.(true),
    onDisconnected: () => ctx.setConnected?.(false),
    onAuthLost: () => ctx.onAuthLost?.(),
    onError: (error, meta) => ctx.onStreamError?.(error, meta)
  });
  lifecycle.start();
}
