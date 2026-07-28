import { escapeHtml } from "../../../shared/security.js";
import { getAppOrigin, getPlayerJoinUrl } from "../api.js";
import { state } from "../state.js";
import { roomContentBindingPresentation } from "../../../shared/room-content-binding.js";

export function renderHeader() {
  const user = state.user;
  const room = state.room;
  const binding = room ? roomContentBindingPresentation(room.contentBinding) : null;
  const userLabel = user?.displayName || user?.email || "已登录";
  const userInitial = userLabel.slice(0, 1).toUpperCase();
  return `
    <header class="host-header">
      <div class="host-header-inner">
        <button type="button" data-action="go-home" class="host-brand" aria-label="返回主持端首页">
          <span class="host-brand-mark" aria-hidden="true">织</span>
          <span class="host-brand-copy"><strong>织幕</strong><small>HOST CONTROL</small></span>
        </button>
        <div class="host-header-context">
          <span class="host-product-label"><i></i>主持监控台</span>
          ${room ? `<span class="host-room-pill" title="${escapeHtml(binding.detail)}">${escapeHtml(room.name)} · ${escapeHtml(binding.label)}</span>` : ""}
        </div>
        <nav class="host-nav" aria-label="主持端导航">
          ${state.view === "console" ? `<button class="secondary-btn host-room-switch" type="button" data-action="go-pick-room" aria-label="切换房间" title="切换房间"><span aria-hidden="true">⌘</span>切换房间</button>` : ""}
          <a class="host-nav-link" href="${escapeHtml(getAppOrigin())}" target="_blank" rel="noopener noreferrer" aria-label="打开创作者端" title="打开创作者端"><span aria-hidden="true">◇</span>创作者端</a>
          <a class="host-nav-link" href="${escapeHtml(getPlayerJoinUrl(room?.invite_code))}" target="_blank" rel="noopener noreferrer" aria-label="${room?.invite_code ? "打开当前房间玩家端" : "打开玩家端"}" title="${room?.invite_code ? "打开当前房间玩家端" : "打开玩家端"}"><span aria-hidden="true">♙</span>${room?.invite_code ? "当前房间玩家端" : "玩家端"}</a>
          ${user
            ? `<span class="host-user" title="${escapeHtml(userLabel)}"><span class="host-user-avatar">${escapeHtml(userInitial)}</span><span class="host-user-name">${escapeHtml(userLabel)}</span></span><button class="ghost-btn" type="button" data-action="logout">退出</button>`
            : `<button class="primary-btn" type="button" data-action="show-auth">登录</button>`}
        </nav>
      </div>
    </header>`;
}
