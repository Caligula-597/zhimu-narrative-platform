/** Room SSE stream with overview/player polling reconciliation. */
import * as zhimuApi from "../api/index.js";
import { showToast, updateNotifyBadge } from "../components/toast.js";
import { uiStore, roomStore, userStore, voiceStore } from "../state/index.js";
import { getRuntime, go, render } from "./runtime-facade.js";
import { callView } from "./view-registry.js";
import { createSseLifecycle } from "../../shared/sse-lifecycle.js";
(function (window) {
  const HOST_RUNTIME_POLL_MS = 15000;
  const PLAYER_POLL_MS = 15000;
  let roomEventStreamKey = "";
  let roomEventLifecycle = null;

  function runtime() {
    return getRuntime();
  }

  async function refreshPlayerHome() {
    if (!zhimuApi.context.roomId) return;
    const view = uiStore.get().view;
    try {
      roomStore.set({ cloudPlayer: await zhimuApi.getPlayerHome() });
      if (view === "player") render();
    } catch {
      /* stream refresh best-effort */
    }
  }

  async function refreshExploration() {
    if (!zhimuApi.context.roomId) return;
    const view = uiStore.get().view;
    try {
      roomStore.set({ cloudExploration: await zhimuApi.getExploration() });
      if (view === "player") render();
    } catch {
      /* stream refresh best-effort */
    }
  }

  async function refreshHostRuntimeSnapshot() {
    const R = runtime();
    const view = uiStore.get().view;
    try {
      await Promise.all([
        R.refreshHostEvents?.(false, true),
        R.refreshHostPlayers?.(false, true)
      ]);
      if (view === "overview") render();
    } catch (error) {
      userStore.set({ apiError: error.message });
    }
  }

  function disconnectRoomEventStream() {
    roomEventLifecycle?.stop();
    roomEventLifecycle = null;
    roomEventStreamKey = "";
    const { view } = uiStore.get();
    const { roomEventsConnected } = roomStore.get();
    if (roomEventsConnected) {
      roomStore.set({ roomEventsConnected: false });
      if (view === "overview") render();
    }
  }

  function scheduleRoomEventReconnect() {
    roomEventLifecycle?.reconnect();
  }

  function streamUserIdForRoom() {
    return uiStore.get().view === "player" && zhimuApi.context.playerUserId
      ? zhimuApi.context.playerUserId
      : zhimuApi.context.hostUserId;
  }

  async function handleRoomEvent(type, data) {
    if (!zhimuApi.context.roomId) return;
    const R = runtime();
    const { view } = uiStore.get();
    const { cloudPlayer } = roomStore.get();
    const { voiceRoomId } = voiceStore.get();
    switch (type) {
      case "room.player_joined":
        if (view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          showToast("有新玩家加入房间", 2800);
        }
        break;
      case "room.player_kicked":
        if (view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          showToast("已移出玩家", 2800);
        } else if (
          view === "player"
          && data.userId
          && String(data.userId) === String(zhimuApi.context.playerUserId)
        ) {
          roomStore.set({ cloudPlayer: null });
          showToast(
            data.roleName ? `你已被移出角色「${data.roleName}」` : "你已被主持人移出房间",
            3600
          );
          go("overview");
        }
        break;
      case "room.section_completed":
        if (view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          await R.refreshHostEvents?.(false, true);
        } else if (view === "player" && data.roleSlotId === cloudPlayer?.role?.id) await refreshPlayerHome();
        break;
      case "room.clue_granted":
        if (view === "overview") {
          await R.refreshHostPlayers?.(false, true);
        } else if (view === "player") {
          await refreshPlayerHome();
          if (data.source === "shared_room") showToast(data.clueName ? `房间内有新公开线索：${data.clueName}` : "有新的公开线索", 2800);
          else if (data.source === "shared_roles") showToast(data.clueName ? `${data.clueName} · 有玩家私享给你` : "有玩家私享线索给你", 2800);
          else showToast(data.clueName ? `获得新线索：${data.clueName}` : "获得新线索", 2800);
        }
        break;
      case "room.clue_revoked":
      case "room.clue_resent":
        if (view === "overview") {
          await R.refreshHostPlayers?.(false, true);
        } else if (view === "player" && data.roleSlotId === cloudPlayer?.role?.id) {
          await refreshPlayerHome();
          showToast(type === "room.clue_revoked"
            ? (data.clueName ? `主持人已撤回线索：${data.clueName}` : "主持人已撤回一条线索")
            : (data.clueName ? `主持人补发线索：${data.clueName}` : "主持人补发了一条线索"), 3000);
        }
        break;
      case "room.item_granted":
        if (view === "overview") await R.refreshHostPlayers?.(false, true);
        else if (view === "player") {
          await refreshPlayerHome();
          await refreshExploration();
          if (data.roleSlotId === cloudPlayer?.role?.id) showToast(data.itemName ? `获得物品：${data.itemName}` : "获得新物品", 2800);
        }
        break;
      case "room.host_event_pending":
        await R.refreshHostEvents?.(false, true);
        if (view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          if (data.action === "executed") {
            showToast("待确认事件已执行 · 玩家端将收到解锁通知", 3200);
          } else if (data.action === "dismissed") {
            showToast("待确认事件已拒绝", 2800);
          } else {
            showToast("有新的待确认事件 · 玩家可能在等待", 3200);
          }
        } else if (view === "player") {
          await refreshPlayerHome();
          if (data.action === "executed") {
            await refreshExploration();
            showToast("主持人已确认推进 · 新内容可能已解锁", 3200);
          } else if (data.action === "dismissed") {
            showToast("主持人已处理待确认事件", 2800);
          } else if (cloudPlayer?.hostConfirm?.waitingForYou) {
            showToast("剧情推进等待主持人确认", 3200);
          }
        }
        break;
      case "room.host_nudge": {
        const roleId = cloudPlayer?.role?.id;
        const targets = data.roleSlotIds || [];
        const forMe = !targets.length || targets.some((id) => String(id) === String(roleId));
        if (view === "player" && forMe) {
          showToast(data.message || "主持人提醒你稍候", 3600);
        }
        break;
      }
      case "room.host_log_created":
        if (view === "overview") await R.refreshHostRoom?.(false);
        break;
      case "room.host_player_notes_updated":
        if (view === "overview") await R.refreshHostPlayers?.(false, true);
        break;
      case "room.section_unlocked":
        if (view === "overview") await R.refreshHostPlayers?.(false, true);
        else if (view === "player") {
          await refreshPlayerHome();
          showToast("新分幕已解锁", 2800);
        }
        break;
      case "room.section_relocked":
      case "room.section_skipped":
        if (view === "overview") await R.refreshHostPlayers?.(false, true);
        else if (view === "player" && data.roleSlotId === cloudPlayer?.role?.id) {
          await refreshPlayerHome();
          showToast(type === "room.section_relocked" ? "主持人已撤回一个分幕" : "主持人已跳过一个分幕并继续推进", 3000);
        }
        break;
      case "room.investigation_completed":
        if (view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          await R.refreshHostEvents?.(false, true);
        } else if (view === "player" && data.roleSlotId === cloudPlayer?.role?.id) {
          await refreshExploration();
          await refreshPlayerHome();
          showToast("调查点已完成 · 请查看探索页", 3200);
        }
        break;
      case "room.scene_unlocked":
        if (view === "player") {
          await refreshExploration();
          showToast("新场景已开放", 2800);
        } else if (view === "overview") await R.refreshHostPlayers?.(false, true);
        break;
      case "room.voice_message_created":
        if (data.voiceRoomId === voiceRoomId) {
          await window.zhimuViewLoader?.ensureViewModules?.("player");
          await callView("player", "refreshVoiceMessages");
        }
        break;
      case "room.checkpoint_restored":
        if (view === "overview" || view === "archive") {
          await R.refreshHostRoom?.(false);
          showToast("房间已从存档恢复", 2800);
        }
        break;
      case "room.game_started":
      case "room.game_updated":
      case "room.game_completed":
      case "room.vote_created":
      case "room.vote_updated":
      case "room.private_action_submitted":
      case "room.private_action_updated":
      case "room.role_state_updated":
      case "room.player_task_completed":
      case "room.testimony_submitted":
      case "room.segment_remedy_applied":
      case "room.physical_token_activated":
      case "room.physical_token_event":
        if (view === "overview") await refreshHostRuntimeSnapshot();
        else if (view === "player") await refreshPlayerHome();
        break;
    }
  }

  function connectRoomEventStream() {
    const roomId = zhimuApi.context.roomId;
    if (!roomId) return;
    const streamUserId = streamUserIdForRoom();
    const nextStreamKey = `${roomId}:${streamUserId || ""}`;
    if (roomEventLifecycle && roomEventStreamKey === nextStreamKey) return;
    disconnectRoomEventStream();
    roomEventStreamKey = nextStreamKey;
    roomEventLifecycle = createSseLifecycle({
      pollMs: Math.min(HOST_RUNTIME_POLL_MS, PLAYER_POLL_MS),
      open: ({ signal, onConnected }) => zhimuApi.streamRoomEvents(roomId, async (type, data) => {
        if (type === "__connected__") return onConnected(data);
        await handleRoomEvent(type, data);
      }, signal, streamUserId),
      poll: async () => {
        const view = uiStore.get().view;
        if (view === "overview") await refreshHostRuntimeSnapshot();
        else if (view === "player") {
          await refreshPlayerHome();
          await refreshExploration();
        }
      },
      reconcile: async () => {
        const view = uiStore.get().view;
        if (view === "overview") await refreshHostRuntimeSnapshot();
        else if (view === "player") {
          await refreshPlayerHome();
          await refreshExploration();
        }
      },
      onConnected: () => roomStore.set({ roomEventsConnected: true }),
      onDisconnected: () => roomStore.set({ roomEventsConnected: false }),
      onStatus: () => {
        if (["overview", "player"].includes(uiStore.get().view)) render();
      },
      onAuthLost: () => {
        window.zhimuSessionAuth?.markLoggedOut?.();
        showToast("登录已过期，请重新登录", 3200);
        go("overview");
      },
      onError: (error, meta) => {
        if (meta?.phase === "stream") userStore.set({ apiError: `实时同步异常：${error.message}` });
      }
    });
    roomEventLifecycle.start();
  }

  window.zhimuRoomEvents = {
    disconnectRoomEventStream,
    scheduleRoomEventReconnect,
    connectRoomEventStream,
    handleRoomEvent,
    refreshPlayerHome,
    refreshExploration,
    refreshHostRuntimeSnapshot,
    streamUserIdForRoom
  };
})(window);
export {};
