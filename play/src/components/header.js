import { getAppOrigin, getSessionToken } from "../api.js";
import { escapeHtml } from "../../../shared/security.js";
import { dmUnreadTotal, state } from "../state.js";
import { userSessionLabel } from "../utils/user.js";
import { renderPortalAvatar } from "../../../shared/portal-profile-ui.js";

function syncPillLabel() {
  if (state.roomEventsStatus === "connected") return "实时";
  if (state.roomEventsStatus === "reconnecting") return "重连中";
  if (state.roomEventsStatus === "polling") return "轮询";
  if (state.platformEventsStatus === "connected") return "在线";
  if (state.platformEventsStatus === "reconnecting") return "重连中";
  if (state.platformEventsStatus === "polling") return "轮询";
  return "";
}

function showSyncPill() {
  return Boolean(syncPillLabel());
}

export function renderHeader() {
  const appOrigin = getAppOrigin();
  const roleName = state.home?.role?.name || "";
  const roomName = state.home?.room?.name || "";
  const sessionLabel = userSessionLabel(state.user);
  const dmUnread = dmUnreadTotal();
  const syncLabel = syncPillLabel();
  const syncReconnect = state.roomEventsStatus === "reconnecting"
    || state.roomEventsStatus === "polling"
    || state.platformEventsStatus === "reconnecting"
    || state.platformEventsStatus === "polling";

  return `
    <header class="play-header">
      <a class="brand" href="/" data-action="go-home">
        <span class="brand-mark">织</span>
        <span><strong>织幕</strong><small>玩家端</small></span>
      </a>
      <div class="header-meta">
        ${roomName ? `<span class="pill" data-room-pill="1">${escapeHtml(roomName)}</span>` : ""}
        ${roleName ? `<span class="pill accent" data-role-pill="1">${escapeHtml(roleName)}</span>` : ""}
        ${showSyncPill() ? `<span class="pill live ${syncReconnect ? "is-reconnecting" : ""}">${escapeHtml(syncLabel)}</span>` : ""}
        ${sessionLabel && !roleName ? `<span class="pill ${state.user?.isGuest ? "guest" : "session"}">${escapeHtml(sessionLabel)}</span>` : ""}
      </div>
      <div class="header-actions">
        ${state.view === "game"
          ? `<button class="link-btn quiet" type="button" data-action="go-messages-ingame">消息${dmUnread ? `<span class="nav-badge">${dmUnread > 99 ? "99+" : dmUnread}</span>` : ""}</button>`
          : state.roomId && state.view !== "landing" && state.view !== "join"
            ? `<button class="link-btn quiet accent" type="button" data-action="return-game">返回对局</button>`
            : ""}
        ${state.view !== "game" && state.view !== "landing" ? `<button class="link-btn quiet" type="button" data-action="go-home">首页</button>` : ""}
        ${state.view !== "game" ? `
          <button class="link-btn quiet ${state.view === "plaza" || state.view === "plaza-thread" ? "is-active" : ""}" type="button" data-action="go-plaza">广场</button>
          <button class="link-btn quiet ${state.view === "friends" ? "is-active" : ""}" type="button" data-action="go-friends">好友</button>
          <button class="link-btn quiet ${state.view === "messages" || state.view === "dm" ? "is-active" : ""}" type="button" data-action="go-messages">消息${dmUnread ? `<span class="nav-badge">${dmUnread > 99 ? "99+" : dmUnread}</span>` : ""}</button>
          <button class="link-btn quiet ${state.view === "lobby" ? "is-active" : ""}" type="button" data-action="go-lobby">找人一起玩</button>` : ""}
        <a class="link-btn quiet" href="${appOrigin}/" target="_blank" rel="noopener">创作者入口</a>
        ${state.user ? `<button class="play-profile-trigger" type="button" data-action="open-profile" title="编辑玩家端身份资料">${renderPortalAvatar({ displayName: state.user.displayName, avatarUrl: state.user.avatarUrl }, "play-profile-avatar")}<span>${escapeHtml(state.user.displayName || "玩家资料")}</span></button>` : ""}
        ${getSessionToken() ? `<button class="link-btn quiet" type="button" data-action="logout">退出</button>` : ""}
      </div>
    </header>`;
}
