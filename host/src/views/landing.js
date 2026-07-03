import { escapeHtml } from "../../../shared/security.js";
import { renderStatusChip } from "../../../shared/components/status-chip.js";
import { getWorldId } from "../session.js";
import { state } from "../state.js";

export function renderLanding() {
  const worldId = getWorldId();
  const worlds = state.worlds || [];
  const rooms = state.rooms || [];
  const step = state.landingStep || (worldId ? "rooms" : "worlds");
  const showRooms = step === "rooms" && worldId;

  const worldCards = worlds.length
    ? worlds
        .map(
          (world) => `<button type="button" class="pick-card" data-action="world-select" data-world-id="${escapeHtml(world.id)}">
            <span class="pick-card-mark" aria-hidden="true">${escapeHtml((world.name || "剧").slice(0, 1))}</span>
            <span class="pick-card-copy"><strong>${escapeHtml(world.name)}</strong><small>${escapeHtml(world.summary || "尚未填写剧本简介")}</small></span>
            ${renderStatusChip({ tone: worldId === world.id ? "published" : "draft", label: worldId === world.id ? "当前" : "进入" })}
          </button>`
        )
        .join("")
    : `<div class="empty-state host-empty-state"><span class="empty-state-mark" aria-hidden="true">◇</span><p><strong>尚无可主持的剧本</strong></p><p>请先创建世界，或让主创将你的账号加入主持成员。</p><div class="row"><button class="secondary-btn" type="button" data-action="open-creator">打开创作者端</button>${!state.user ? `<button class="primary-btn" type="button" data-action="show-auth">登录账号</button>` : ""}</div></div>`;

  const roomCards = rooms.length
    ? rooms
        .map(
          (room) => `<button type="button" class="pick-card room-pick-card" data-action="room-select" data-room-id="${escapeHtml(room.id)}">
            <span class="pick-card-mark room" aria-hidden="true">◉</span>
            <span class="pick-card-copy"><strong>${escapeHtml(room.name)}</strong><small>邀请码 ${escapeHtml(room.invite_code || "—")} · ${escapeHtml(room.status || "运行中")}</small></span>
            <span class="room-enter-label">进入监控台 <b aria-hidden="true">→</b></span>
          </button>`
        )
        .join("")
    : `<div class="empty-state host-empty-state"><span class="empty-state-mark" aria-hidden="true">⌘</span><p><strong>当前世界尚无平行房</strong></p><p>可以直接在主持端创建运行房；如果刚在创作者端创建过，请刷新列表。</p><div class="row"><button class="primary-btn" type="button" data-action="create-room">创建运行房</button><button class="secondary-btn" type="button" data-action="refresh-rooms">刷新运行房</button><button class="secondary-btn" type="button" data-action="open-creator">打开创作者端</button></div></div>`;

  return `
    <section class="host-landing">
      <div class="host-page-head">
        <div><p class="eyebrow">HOST WORKSPACE</p><h1>${showRooms ? "选择运行房" : "主持工作区"}</h1><p class="host-page-summary">${showRooms ? "选择一个平行运行房，进入实时监控。" : "选择你有权主持的剧本世界。"}</p></div>
        <div class="host-page-meta"><span><b>${worlds.length}</b> 个剧本</span><span><b>${showRooms ? rooms.length : "—"}</b> 个运行房</span></div>
      </div>
      ${showRooms
        ? `<div class="host-selection-toolbar"><button class="text-btn" type="button" data-action="landing-back-worlds">← 返回剧本</button><div><span>当前剧本</span><strong>${escapeHtml(state.studio?.world?.name || "当前世界")}</strong></div><div class="row"><button class="secondary-btn" type="button" data-action="refresh-rooms">刷新运行房</button><button class="primary-btn" type="button" data-action="create-room">创建运行房</button></div></div><div class="pick-grid">${roomCards}</div>`
        : `<div class="pick-grid">${worldCards}</div>`}
      ${!state.user ? `<div class="host-auth-notice"><span aria-hidden="true">!</span><p><strong>登录后载入主持权限</strong><small>访客模式不会展示私密运行数据。</small></p><button class="primary-btn" type="button" data-action="show-auth">登录</button></div>` : ""}
    </section>`;
}
