import { FLOW_STEPS } from "../constants.js";
import { escapeHtml } from "../../../shared/security.js";
import { state } from "../state.js";
import { PLAYER_PRODUCT_MODES, productModeMeta } from "../product-mode.js";
import { isRegisteredUser, userSessionLabel } from "../utils/user.js";
import { COMMERCIAL_GAME_LIBRARY } from "../../../shared/commercial-game-library.js";

function renderLandingAuthActions() {
  const label = userSessionLabel(state.user);
  if (isRegisteredUser(state.user)) {
    return `
      <div class="landing-actions landing-actions-signed-in">
        <p class="muted">当前已登录为 <strong>${escapeHtml(label)}</strong>。可直接输入邀请码、进入广场或浏览公开房间。</p>
      </div>`;
  }
  if (state.user?.isGuest) {
    return `
      <div class="landing-actions">
        <button class="btn outline" type="button" data-action="show-auth">登录 / 注册账号</button>
        <p class="hint">你正在以访客身份浏览；注册后可发帖、加好友并加入房间。</p>
      </div>`;
  }
  return `
      <div class="landing-actions">
        <button class="btn outline" type="button" data-action="show-auth">登录 / 注册账号</button>
        <button class="btn quiet" type="button" data-action="guest-continue" ${state.busy ? "disabled" : ""}>以访客身份继续</button>
      </div>`;
}

function renderProductModeSelector() {
  const selectedMode = productModeMeta(state.productMode);
  return `
    <section class="player-mode-panel card" aria-labelledby="player-mode-title">
      <div class="player-mode-heading">
        <div>
          <p class="eyebrow">先选玩法</p>
          <h2 id="player-mode-title">你这次要玩哪一种？</h2>
        </div>
        <span class="player-mode-current">当前：${escapeHtml(selectedMode.label)}</span>
      </div>
      <p class="muted">三个产品入口分开显示。选择已完成的玩法后，再输入对应房间的邀请码。</p>
      <div class="player-mode-grid" role="list" aria-label="选择玩家模式">
        ${PLAYER_PRODUCT_MODES.map((mode) => mode.available === false
          ? `<div class="player-mode-card ${mode.accent} is-unavailable" role="listitem" aria-disabled="true">
              <span class="player-mode-label">${escapeHtml(mode.label)}</span>
              <strong>${escapeHtml(mode.title)}</strong>
            </div>`
          : `<button
              class="player-mode-card ${mode.accent} ${state.productMode === mode.id ? "is-selected" : ""}"
              type="button"
              data-action="select-product-mode"
              data-product-mode="${mode.id}"
              aria-pressed="${state.productMode === mode.id}"
              role="listitem">
              <span class="player-mode-label">${escapeHtml(mode.label)}</span>
              <strong>${escapeHtml(mode.title)}</strong>
              <span>${escapeHtml(mode.description)}</span>
            </button>`).join("")}
      </div>
      <p class="hint">房间列表也会按玩法分区；未完成的玩法不会展示虚构功能。</p>
    </section>`;
}

function renderBoardGameLibrary() {
  if (state.productMode !== "board_game") return "";
  return `<section class="board-library-panel" aria-labelledby="board-library-title">
    <div class="board-library-head"><div><p class="eyebrow">BOARD GAME LIBRARY · 机制研究适配</p><h2 id="board-library-title">选择一款桌游开始找局</h2><p>先按成熟商业桌游的核心机制挑选，再进入对应的公开牌局。这里的世界观、牌面和美术都是原创线上适配。</p></div><span class="board-library-count">${COMMERCIAL_GAME_LIBRARY.length} 款可试玩</span></div>
    <div class="board-library-grid">${COMMERCIAL_GAME_LIBRARY.map((game) => `<article class="board-library-card accent-${escapeHtml(game.accent)} ${state.boardGameLibrarySelection === game.id ? "is-selected" : ""}">
      <div class="board-library-card-art"><img class="board-library-cover" src="${escapeHtml(game.coverAsset)}" alt="${escapeHtml(game.title)}原创视觉封面" loading="lazy" /></div>
      <div class="board-library-card-top"><span class="board-library-glyph">${escapeHtml(game.family.slice(0, 1))}</span><span class="board-library-status">${escapeHtml(game.status)}</span></div>
      <p class="board-library-source">机制研究：${escapeHtml(game.sourceGame)}</p><h3>${escapeHtml(game.title)}</h3><strong>${escapeHtml(game.family)}</strong><p>${escapeHtml(game.summary)}</p>
      <div class="board-library-meta"><span>${escapeHtml(game.players)}</span><span>${escapeHtml(game.minutes)}</span><span>${escapeHtml(game.difficulty)}</span></div>
      <button class="btn primary full" type="button" data-action="board-library-browse" data-board-game-id="${escapeHtml(game.id)}">浏览这款桌游的牌局</button>
    </article>`).join("")}</div>
    <p class="board-library-note">没有公开房间时，主持人可以在创作端载入同名研究适配，创建运行房后会自动出现在这里。</p>
  </section>`;
}

export function renderLanding() {
  const openCount = state.publicRooms?.total || 0;
  return `
    <section class="landing-shell">
      <div class="landing-hero-wrap">
        <div class="landing-backdrop" aria-hidden="true">
          <div class="landing-glow landing-glow-a"></div>
          <div class="landing-glow landing-glow-b"></div>
        </div>
        <div class="landing-hero">
          <p class="eyebrow">PLAYER · 纯玩家视角</p>
          <h1>先选玩法，再进入你的房间</h1>
          <p class="lede">织幕玩家端把<strong>剧本杀、跑团、桌游</strong>分开呈现。先选择已开放的玩法，再输入对应房间的邀请码。</p>
        </div>
      </div>

      ${renderProductModeSelector()}
      ${renderBoardGameLibrary()}

      <div class="entry-grid entry-grid-priority">
        <article class="entry-card entry-card-primary">
          <div class="entry-card-head">
            <p class="eyebrow">我有邀请码</p>
            <h3>加入主持人开的平行房</h3>
          </div>
          <p class="entry-card-lede">当前按“${escapeHtml(productModeMeta(state.productMode).label)}”进入。输入主持人分享的邀请码，选择角色席位，即可进入房间。</p>
          <label class="field-label" for="invite-input">房间邀请码</label>
          <div class="join-row">
            <input id="invite-input" class="field" type="text" placeholder="例如：PLAY-ABC12345" value="${escapeHtml(state.inviteCode)}" data-bind="inviteCode" data-testid="invite-code-input" autocomplete="off" />
            <button class="btn primary" type="button" data-action="start-join" data-testid="start-join" ${state.busy ? "disabled" : ""}>下一步：选角色</button>
          </div>
          <p class="hint">也可通过链接直接进入：<code>?join=你的邀请码</code>。链接不会替你改变已选择的玩法。</p>
        </article>
      </div>

      <div class="entry-grid entry-grid-secondary">
        <article class="entry-card entry-card-plaza">
          <div class="entry-card-head">
            <p class="eyebrow">无需在局中</p>
            <h3>玩家广场</h3>
          </div>
          <p class="entry-card-lede">自由讨论、招募队友、约局聊天。没参与剧本时也能和陌生玩家互动。</p>
          <button class="btn primary full" type="button" data-action="go-plaza" ${state.busy ? "disabled" : ""}>进入广场</button>
        </article>

        <article class="entry-card entry-card-lobby">
          <div class="entry-card-head">
            <p class="eyebrow">无需认识主持人</p>
            <h3>找人一起玩</h3>
          </div>
          <p class="entry-card-lede">浏览正在公开的运行房，与陌生玩家在线凑局。</p>
          <dl class="entry-meta">
            <div><dt>当前开放</dt><dd>${openCount} 个房间</dd></div>
            <div><dt>适合</dt><dd>想随机匹配玩家的线上局</dd></div>
          </dl>
          <button class="btn primary full" type="button" data-action="go-lobby" ${state.busy ? "disabled" : ""}>浏览公开房间</button>
        </article>
      </div>

      <details class="flow-details card">
        <summary>玩家流程说明（4 步）</summary>
        <div class="flow-grid flow-grid-compact" aria-label="玩家流程说明">
          ${FLOW_STEPS.map((step) => `
            <article class="flow-card">
              <span class="flow-num">${step.n}</span>
              <h3>${step.title}</h3>
              <p>${step.text}</p>
            </article>`).join("")}
        </div>
      </details>

      <section class="help-panel card">
        <h3>邀请码从哪里来？</h3>
        <ul class="help-list">
          <li>主持人在<strong>织幕应用</strong>里创建平行房后，会获得一串房间邀请码</li>
          <li>把邀请码或 <code>play.getzhimu.com/?join=邀请码</code> 链接发给玩家</li>
          <li>每位玩家选择<strong>不同的角色席位</strong>，进入后只能看到自己的私人分幕与线索</li>
        </ul>
      </section>

      ${renderLandingAuthActions()}
    </section>`;
}
