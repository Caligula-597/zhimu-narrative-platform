import { escapeHtml } from "../../../shared/security.js";
import { state } from "../state.js";
import { PLAYER_PRODUCT_MODES, productModeForRoom } from "../product-mode.js";
import { commercialGameLibraryEntry } from "../../../shared/commercial-game-library.js";

function roomMode(room) {
  return productModeForRoom(room) || "murder_mystery";
}

function renderLobbyCard(room) {
  const game = commercialGameLibraryEntry(room.boardGameId || room.board_game_id || room.settings?.boardGameId);
  return `
    <article class="lobby-card card">
      ${room.worldCoverUrl
        ? `<div class="lobby-card-cover"><img src="${escapeHtml(room.worldCoverUrl)}" alt="" loading="lazy" decoding="async" /></div>`
        : `<div class="lobby-card-cover lobby-card-cover-fallback" aria-hidden="true"><span>${escapeHtml((room.worldName || "本")[0])}</span></div>`}
      <div class="lobby-card-head">
        <p class="eyebrow">${escapeHtml(room.worldName)}</p>
        <h3>${escapeHtml(room.roomName)}</h3>
      </div>
      <p class="lobby-summary">${escapeHtml(room.worldSummary || "暂无内容简介")}</p>
      ${game ? `<div class="lobby-game-badge"><span>桌游机制</span><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(game.family)} · ${escapeHtml(game.sourceGame)}</small></div>` : ""}
      <dl class="entry-meta lobby-meta">
        <div><dt>主持</dt><dd>${escapeHtml(room.hostDisplayName || "玩家")}</dd></div>
        <div><dt>空席</dt><dd>${room.openSeats} / ${room.roleCount}</dd></div>
        <div><dt>状态</dt><dd>${escapeHtml(room.roomStatus || "运行中")}</dd></div>
      </dl>
      <button class="btn primary full" type="button" data-action="lobby-join" data-invite-code="${escapeHtml(room.inviteCode)}" ${room.openSeats <= 0 || state.busy ? "disabled" : ""}>
        ${room.openSeats <= 0 ? "席位已满" : "加入这局"}
      </button>
    </article>`;
}

function renderLobbySection(mode, items) {
  const unavailable = mode.id === "tabletop_rpg" && !mode.available;
  return `
    <section class="lobby-product-section" aria-labelledby="lobby-${mode.id}">
      <div class="lobby-product-heading">
        <div>
          <p class="eyebrow">${escapeHtml(mode.label)}</p>
          <h2 id="lobby-${mode.id}">${escapeHtml(mode.label)}房间</h2>
        </div>
        <span class="lobby-product-status">${unavailable ? "暂未开放" : `${items.length} 个房间`}</span>
      </div>
      ${items.length
        ? `<div class="lobby-grid">${items.map(renderLobbyCard).join("")}</div>`
        : `<article class="card lobby-empty lobby-product-empty"><span class="empty-icon" aria-hidden="true">◇</span><h3>${unavailable ? "跑团暂未开放" : "暂时没有公开房间"}</h3><p class="muted">${unavailable ? "" : `主持人公开${escapeHtml(mode.label)}房间后，会显示在这里。`}</p></article>`}
    </section>`;
}

export function renderLobby() {
  const listing = state.publicRooms;
  const items = listing?.items || [];
  const filter = state.lobbyProductFilter || "all";
  const visibleModes = filter === "all" ? PLAYER_PRODUCT_MODES : PLAYER_PRODUCT_MODES.filter((mode) => mode.id === filter);
  const selectedGame = commercialGameLibraryEntry(state.boardGameLibrarySelection);
  const visibleRooms = (items) => items.filter((room) => {
    if (!selectedGame) return true;
    return roomMode(room) === "board_game" && (room.boardGameId || room.board_game_id || room.settings?.boardGameId) === selectedGame.id;
  });
  return `
    <section class="lobby-shell">
      <div class="lobby-head">
        <div>
          <p class="eyebrow">PUBLIC LOBBY · 在线凑局</p>
          <h1>正在开放的房间</h1>
          <p class="lede">公开房间按<strong>剧本杀、跑团、桌游</strong>分区显示。这里仅展示已经存在的实时房间。</p>
        </div>
        <button class="btn outline" type="button" data-action="refresh-lobby" ${state.busy ? "disabled" : ""}>刷新列表</button>
      </div>

      ${selectedGame ? `<div class="lobby-selection-banner"><span>已选择桌游</span><strong>${escapeHtml(selectedGame.title)}</strong><small>${escapeHtml(selectedGame.family)} · ${escapeHtml(selectedGame.sourceGame)}</small><button class="text-btn" type="button" data-action="lobby-clear-board-selection">查看全部桌游牌局</button></div>` : ""}
      <nav class="lobby-product-filter" aria-label="房间类型">
        <button class="btn ${filter === "all" ? "primary" : "outline"}" type="button" data-action="lobby-filter" data-product-mode="all" aria-pressed="${filter === "all"}">全部</button>
        ${PLAYER_PRODUCT_MODES.map((mode) => `<button class="btn ${filter === mode.id ? "primary" : "outline"}" type="button" data-action="lobby-filter" data-product-mode="${mode.id}" aria-pressed="${filter === mode.id}">${escapeHtml(mode.label)}</button>`).join("")}
      </nav>

      ${listing === null && !state.lobbyError
        ? `<article class="card lobby-empty enriched-empty"><span class="loading-dots">加载大厅中…</span></article>`
        : state.lobbyError
          ? `<div class="banner error inline-retry">${escapeHtml(state.lobbyError)}<button class="btn outline compact" type="button" data-action="refresh-lobby">重试</button></div>`
          : `<div class="lobby-product-sections">${visibleModes.map((mode) => renderLobbySection(mode, visibleRooms(items.filter((room) => roomMode(room) === mode.id)))).join("")}</div>`}

      <button class="text-btn" type="button" data-action="back-landing">← 返回首页</button>
    </section>`;
}
