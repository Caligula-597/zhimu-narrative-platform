import { escapeHtml } from "../../../shared/security.js";
import { state } from "../state.js";

export function renderLobby() {
  const listing = state.publicRooms;
  const items = listing?.items || [];
  return `
    <section class="lobby-shell">
      <div class="lobby-head">
        <div>
          <p class="eyebrow">PUBLIC LOBBY · 在线凑局</p>
          <h1>正在开放的剧本房间</h1>
          <p class="lede">主持人在织幕里把平行房<strong>公开到大厅</strong>后，会出现在这里。选一间加入，认领角色即可与陌生玩家同局。</p>
          <p class="hint muted">这与「公开剧本库」不同：这里是<strong>正在运行的实时房间</strong>。</p>
        </div>
        <button class="btn outline" type="button" data-action="refresh-lobby" ${state.busy ? "disabled" : ""}>刷新列表</button>
      </div>

      ${listing === null && !state.lobbyError
        ? `<article class="card lobby-empty enriched-empty"><span class="loading-dots">加载大厅中…</span></article>`
        : state.lobbyError
          ? `<div class="banner error inline-retry">${escapeHtml(state.lobbyError)}<button class="btn outline compact" type="button" data-action="refresh-lobby">重试</button></div>`
          : items.length
        ? `
        <div class="lobby-grid">
          ${items
            .map(
              (room) => `
            <article class="lobby-card card">
              ${room.worldCoverUrl
                ? `<div class="lobby-card-cover"><img src="${escapeHtml(room.worldCoverUrl)}" alt="" loading="lazy" decoding="async" /></div>`
                : `<div class="lobby-card-cover lobby-card-cover-fallback" aria-hidden="true"><span>${escapeHtml((room.worldName || "本")[0])}</span></div>`}
              <div class="lobby-card-head">
                <p class="eyebrow">${escapeHtml(room.worldName)}</p>
                <h3>${escapeHtml(room.roomName)}</h3>
              </div>
              <p class="lobby-summary">${escapeHtml(room.worldSummary || "暂无剧本简介")}</p>
              <dl class="entry-meta lobby-meta">
                <div><dt>主持</dt><dd>${escapeHtml(room.hostDisplayName || "玩家")}</dd></div>
                <div><dt>空席</dt><dd>${room.openSeats} / ${room.roleCount}</dd></div>
                <div><dt>状态</dt><dd>${escapeHtml(room.roomStatus || "运行中")}</dd></div>
              </dl>
              <button class="btn primary full" type="button" data-action="lobby-join" data-invite-code="${escapeHtml(room.inviteCode)}" ${room.openSeats <= 0 || state.busy ? "disabled" : ""}>
                ${room.openSeats <= 0 ? "席位已满" : "加入这局"}
              </button>
            </article>`
            )
            .join("")}
        </div>`
        : `
        <article class="card lobby-empty enriched-empty">
          <span class="empty-icon" aria-hidden="true">◇</span>
          <h3>暂时没有公开房间</h3>
          <p class="muted">主持人可在创作者端把平行房「公开到大厅」；或使用邀请码 / 官方示例入房。</p>
          <div class="row-actions">
            <button class="btn outline" type="button" data-action="back-landing">输入邀请码</button>
            <button class="btn quiet" type="button" data-action="join-official">体验官方示例</button>
          </div>
        </article>`}

      <button class="text-btn" type="button" data-action="back-landing">← 返回首页</button>
    </section>`;
}
