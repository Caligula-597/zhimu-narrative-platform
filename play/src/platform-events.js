import { api } from "./api.js";

const RECONNECT_MS = 5000;
const POLL_MS = 20000;

let streamAbort = null;
let reconnectTimer = null;
let pollTimer = null;
let pollInFlight = false;
let active = false;
let streamConnected = false;

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(connect) {
  if (reconnectTimer || !active) return;
  setStreamStatus("reconnecting");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_MS);
}

function setStreamStatus(status) {
  platformCtxRef?.setStreamStatus?.(status);
}

let platformCtxRef = null;

function syncPlatformPoll(activePoll, ctx) {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (!activePoll || !ctx.hasSession?.() || streamConnected) {
    if (streamConnected) setStreamStatus("connected");
    return;
  }
  setStreamStatus("polling");
  pollTimer = setInterval(async () => {
    if (!active || pollInFlight) return;
    pollInFlight = true;
    try {
      await runPlatformPoll(ctx);
    } catch {
      /* polling is best-effort */
    } finally {
      pollInFlight = false;
    }
  }, POLL_MS);
}

async function runPlatformPoll(ctx) {
  const view = ctx.getView();
  if (view === "plaza") await ctx.onPlazaRefresh?.();
  else if (view === "plaza-thread") await ctx.onPlazaThreadRefresh?.();
  else if (view === "friends") await ctx.onFriendsRefresh?.();
  else if (view === "messages" || view === "dm") await ctx.onMessagesRefresh?.();
  else if (view === "game") await ctx.onInGameCommRefresh?.();
  if (view === "dm" && ctx.getDmConversationId?.()) await ctx.onDmRefresh?.();
}

async function handlePlatformEvent(type, data, ctx) {
  switch (type) {
    case "plaza.post_created":
    case "plaza.post_deleted":
      if (ctx.getView() === "plaza") await ctx.onPlazaRefresh?.();
      if (ctx.getView() === "plaza-thread" && data.postId === ctx.getPlazaPostId?.()) {
        if (type === "plaza.post_deleted") ctx.onPlazaThreadClosed?.();
        else await ctx.onPlazaThreadRefresh?.();
      }
      break;
    case "plaza.reply_created":
    case "plaza.reply_deleted":
      if (ctx.getView() === "plaza-thread" && data.postId === ctx.getPlazaPostId?.()) {
        await ctx.onPlazaThreadRefresh?.();
      }
      if (ctx.getView() === "plaza") await ctx.onPlazaRefresh?.();
      break;
    case "social.friend_request":
      ctx.onToast?.("收到新的好友请求");
      if (ctx.getView() === "friends") await ctx.onFriendsRefresh?.();
      break;
    case "social.friend_accepted":
      ctx.onToast?.("好友请求已通过");
      if (ctx.getView() === "friends") await ctx.onFriendsRefresh?.();
      break;
    case "social.friend_declined":
      if (ctx.getView() === "friends") await ctx.onFriendsRefresh?.();
      break;
    case "dm.message_created":
      if (ctx.getView() === "game") {
        ctx.onToast?.("收到新私信");
        await ctx.onInGameCommRefresh?.();
        break;
      }
      if (ctx.getView() === "messages" || ctx.getView() === "dm") {
        await ctx.onMessagesRefresh?.();
      }
      if (ctx.getView() === "dm" && data.conversationId === ctx.getDmConversationId?.()) {
        await ctx.onDmRefresh?.();
      } else if (data.conversationId !== ctx.getDmConversationId?.()) {
        ctx.onToast?.("收到新私信");
      }
      break;
    default:
      break;
  }
}

export function disconnectPlatformEvents(ctx) {
  active = false;
  platformCtxRef = null;
  clearReconnectTimer();
  if (streamAbort) {
    streamAbort.abort();
    streamAbort = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  streamConnected = false;
  ctx?.setStreamStatus?.("idle");
  ctx?.setConnected?.(false);
}

export function connectPlatformEvents(ctx) {
  disconnectPlatformEvents(ctx);
  if (!ctx.hasSession?.()) return;
  active = true;
  platformCtxRef = ctx;

  const connect = () => {
    if (!active) return;
    if (streamAbort) streamAbort.abort();
    streamAbort = new AbortController();
    const signal = streamAbort.signal;
    setStreamStatus("reconnecting");

    api.streamPlatformEvents(async (type, data) => {
      if (type === "__connected__") {
        streamConnected = true;
        syncPlatformPoll(false, ctx);
        setStreamStatus("connected");
        ctx.setConnected?.(true);
        return;
      }
      await handlePlatformEvent(type, data, ctx);
    }, signal).catch((error) => {
      if (error?.status === 401) ctx.onAuthLost?.();
    }).finally(() => {
      const shouldReconnect = active && !signal.aborted;
      streamConnected = false;
      ctx.setConnected?.(false);
      if (shouldReconnect) {
        syncPlatformPoll(true, ctx);
        scheduleReconnect(connect);
      } else {
        setStreamStatus("idle");
      }
    });
  };

  connect();
  syncPlatformPoll(true, ctx);
}
