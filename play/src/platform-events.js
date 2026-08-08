import { api } from "./api.js";
import {
  createPortalEventLifecycle,
  PORTAL_POLL_INTERVAL_MS
} from "../../shared/sse-lifecycle.js";

let lifecycle = null;
let boundStreamKey = "";

function setStreamStatus(status) {
  platformCtxRef?.setStreamStatus?.(status);
}

let platformCtxRef = null;

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
  lifecycle?.stop();
  lifecycle = null;
  boundStreamKey = "";
  platformCtxRef = null;
  ctx?.setStreamStatus?.("idle");
  ctx?.setConnected?.(false);
}

export function connectPlatformEvents(ctx, { force = false } = {}) {
  const nextStreamKey = ctx.getUserId?.() || "session";
  if (!force && lifecycle && boundStreamKey === nextStreamKey) return;
  disconnectPlatformEvents(ctx);
  if (!ctx.hasSession?.()) return;
  boundStreamKey = nextStreamKey;
  platformCtxRef = ctx;
  lifecycle = createPortalEventLifecycle({
    pollMs: PORTAL_POLL_INTERVAL_MS.platform,
    connect: ({ signal, onEvent }) => api.streamPlatformEvents(onEvent, signal, ctx.getUserId?.()),
    onEvent: (type, data) => handlePlatformEvent(type, data, ctx),
    refresh: () => runPlatformPoll(ctx),
    onStatus: setStreamStatus,
    onConnectionChange: (connected) => ctx.setConnected?.(connected),
    onAuthLost: () => ctx.onAuthLost?.(),
    onError: (error, meta) => ctx.onStreamError?.(error, meta)
  });
  lifecycle.start();
}
