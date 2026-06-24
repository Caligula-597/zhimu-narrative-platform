import { escapeHtml, sanitizeImageUrl, asArray } from "../security.js";
import { currentScene, playerProgress, state } from "../state.js";
import { clueIsRead, clueOwnerLabel, clueShareRoleCount } from "../utils/clues.js";
import { applyStoryHighlights, sectionHighlights } from "../utils/highlights.js";
import { renderVoiceCompact, renderVoiceTab } from "./voice.js";
import { renderRecapTab } from "./recap.js";

export function renderGameResume() {
  return `
    <section class="game-resume card">
      <p class="eyebrow">恢复对局</p>
      <h2>正在进入房间…</h2>
      <p class="muted">读取你的角色、分幕与线索进度</p>
    </section>`;
}

function hostNudgeBanner() {
  const nudge = state.hostNudge;
  if (!nudge?.message) return "";
  return `
    <div class="banner host-nudge-banner">
      <div>
        <strong>主持人提醒</strong>
        <p>${escapeHtml(nudge.message)}</p>
      </div>
      <button class="btn quiet compact" type="button" data-action="dismiss-host-nudge">知道了</button>
    </div>`;
}

function hostConfirmBanner() {
  const hc = state.home?.hostConfirm;
  if (!hc?.pendingCount) return "";
  if (hc.waitingForYou) {
    const sample = hc.titles?.[0] ? `「${escapeHtml(hc.titles[0])}」` : "";
    return `
      <div class="banner host-wait-banner">
        <strong>等待主持人确认</strong>
        <p>${sample}${hc.pendingCount > 1 ? ` 等 ${hc.pendingCount} 条` : ""} — 确认后新分幕/场景会自动解锁。</p>
      </div>`;
  }
  return `
    <div class="banner host-wait-banner soft">
      <strong>主持人正在处理 ${hc.pendingCount} 条待确认事件</strong>
      <p>与你相关的推进会在确认后实时通知。</p>
    </div>`;
}

function renderRoomMembers() {
  const members = state.home?.roomMembers || [];
  if (!members.length) return "";
  return `
    <article class="card members-card">
      <div class="section-head"><h3>房间成员</h3><p>${members.filter((m) => m.online).length} 人已选角色</p></div>
      <div class="member-list">
        ${members
          .map(
            (member) => `
          <div class="member-row ${member.online ? "is-online" : ""}">
            <span class="member-avatar">${escapeHtml(String(member.role_name?.[0] || "?"))}</span>
            <div>
              <strong>${escapeHtml(member.role_name)}</strong>
              <span>${member.display_name ? escapeHtml(member.display_name) : member.online ? "已加入" : "空席"}</span>
            </div>
          </div>`
          )
          .join("")}
      </div>
    </article>`;
}

export function renderRoomMembersHtml() {
  return renderRoomMembers();
}

export function renderGameSidebar() {
  const role = state.home?.role;
  return `
        <article class="role-card-side card">
          <p class="eyebrow">你的角色</p>
          <h2>${escapeHtml(role?.name || "未选择")}</h2>
          <p>${escapeHtml(role?.private_profile || role?.public_profile || "暂无角色资料")}</p>
        </article>
        ${renderRoomMembers()}
        <div class="sidebar-actions">
          <button class="btn quiet full" type="button" data-action="leave-room">离开房间</button>
        </div>`;
}

export function renderGameHome() {
  const home = state.home;
  const progress = playerProgress(home);
  const scene = currentScene(state.exploration);
  const role = home?.role;
  const next = progress.nextSection;

  return `
    <div class="home-dashboard">
      ${renderVoiceCompact()}
      <article class="player-hero card live-flash">
        <div class="player-hero-copy">
          <p class="eyebrow">${escapeHtml(role?.name || "你的角色")} · 当前场景</p>
          <h2>${escapeHtml(scene.title)}</h2>
          <p>${escapeHtml(scene.text)}</p>
        </div>
        <div class="scene-art" aria-hidden="true">${escapeHtml(scene.art)}</div>
      </article>

      <div class="stat-grid">
        <article class="stat-card"><span>分幕进度</span><strong>${progress.sectionsCompleted} / ${progress.sectionsTotal}</strong></article>
        <article class="stat-card"><span>我的线索</span><strong>${progress.clueCount}</strong></article>
        <article class="stat-card"><span>共享线索</span><strong>${progress.sharedClueCount}</strong></article>
        <article class="stat-card"><span>背包物品</span><strong>${progress.inventoryCount}</strong></article>
      </div>

      ${next
        ? `
        <article class="next-action card">
          <div>
            <p class="eyebrow">建议下一步</p>
            <h3>${next.completed ? "回顾分幕" : "继续阅读"} · ${escapeHtml(next.title)}</h3>
            <p class="muted">第 ${next.sequence} 幕${next.completed ? "（已完成，可重温）" : "尚未读完"}</p>
          </div>
          <button class="btn primary" type="button" data-action="goto-section" data-section-id="${next.id}">${next.completed ? "打开分幕" : "继续阅读"}</button>
        </article>`
        : `
        <article class="next-action card card-soft">
          <p class="muted">主持人尚未向你的角色发放可读分幕。请等待主持人推进，或联系主持人确认角色配置。</p>
        </article>`}

      ${(state.exploration?.scenes?.length || 0) > 0
        ? `
        <button class="btn outline" type="button" data-action="switch-tab" data-tab="explore">前往探索场景（${state.exploration.scenes.length}）</button>`
        : ""}
    </div>`;
}

export function renderSections() {
  const sections = state.home?.sections || [];
  const active = sections.find((s) => s.id === state.sectionId) || sections[0];
  if (!sections.length) {
    return `<div class="empty enriched-empty"><span class="empty-icon">📖</span>主持人尚未向你的角色发放可读分幕。回到<strong>概览</strong>查看等待说明。</div>`;
  }
  const activeIndex = sections.findIndex((section) => section.id === active?.id);
  const body = active?.body || "";
  const pages = active?.pages || [];
  const isPages = active?.content_mode === "pages" || active?.metadata?.contentMode === "pages";
  const highlights = sectionHighlights(state.home?.notes, active?.id);
  const highlightHint = highlights.length ? `已高亮 ${highlights.length} 处` : "拖选词句后点「高亮」";
  const bodyHtml = isPages && pages.length
    ? `<div class="reader-pages">${pages
        .map((page, index) => {
          const src = sanitizeImageUrl(page.url);
          if (!src) return "";
          return `<figure class="reader-page"><img src="${escapeHtml(src)}" alt="第 ${index + 1} 页" loading="lazy" decoding="async" referrerpolicy="no-referrer" /><figcaption>第 ${index + 1} / ${pages.length} 页</figcaption></figure>`;
        })
        .filter(Boolean)
        .join("")}</div>`
    : `<div class="story-body reader-body" data-reader-body data-section-id="${active?.id || ""}" data-section-title="${escapeHtml(active?.title || "")}">${applyStoryHighlights(body, highlights)}</div><p class="reader-hint muted">${highlightHint} · 点击已高亮文字可取消</p>`;
  const completedCount = sections.filter((section) => section.completed).length;
  const progressPct = sections.length ? Math.round((completedCount / sections.length) * 100) : 0;
  const progressBar =
    sections.length > 0
      ? `<div class="section-progress-wrap" aria-label="分幕阅读进度">
      <div class="section-progress-bar" style="--pct:${progressPct}%"><span></span></div>
      <span class="section-progress">${completedCount} / ${sections.length} 幕已完成</span>
    </div>`
      : "";
  const switcher =
    sections.length > 1
      ? `
    <div class="section-switcher">
      <button type="button" class="btn quiet compact" data-action="section-prev" ${activeIndex <= 0 ? "disabled" : ""} aria-label="上一幕">←</button>
      <label class="section-select-wrap">
        <span class="sr-only">切换分幕</span>
        <select class="field section-select" data-bind="sectionId">
          ${sections
            .map(
              (section) => `
            <option value="${section.id}" ${section.id === active?.id ? "selected" : ""}>
              第 ${section.sequence} 幕${section.completed ? " · 已完成" : ""}
            </option>`
            )
            .join("")}
        </select>
      </label>
      <button type="button" class="btn quiet compact" data-action="section-next" ${activeIndex >= sections.length - 1 ? "disabled" : ""} aria-label="下一幕">→</button>
    </div>`
      : "";
  return `
    <div class="sections-layout">
      <article class="reader card reader-full">
        ${progressBar}
        ${switcher}
        <header class="reader-head">
          <p class="eyebrow">分幕 ${active?.sequence ?? ""}</p>
          <h3>${escapeHtml(active?.title || "")}</h3>
        </header>
        ${bodyHtml}
        ${pages.length && !isPages
          ? `<div class="story-pages">${pages
              .map((page) => {
                const src = sanitizeImageUrl(page.url);
                if (!src) return "";
                return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(page.filename || page.caption || active.title)}" loading="lazy" referrerpolicy="no-referrer" /><figcaption>${escapeHtml(page.filename || page.caption || "")}</figcaption></figure>`;
              })
              .filter(Boolean)
              .join("")}</div>`
          : ""}
        ${active && !active.completed ? `<button class="btn primary section-complete-btn" type="button" data-action="complete-section" data-section-id="${active.id}" ${state.busy ? "disabled" : ""}>标记阅读完成</button>` : active?.completed ? `<p class="done-note" role="status"><span class="done-badge">✓</span> 已完成阅读 — 主持人会收到进度通知</p>` : ""}
      </article>
    </div>`;
}

function renderOwnedClueDetail(clue) {
  if (!clue) return "";
  const read = clueIsRead(clue, { owned: true });
  const roleShareCount = clueShareRoleCount(clue);
  return `
    <article class="card detail clue-detail">
      <div class="clue-detail-head">
        <h3>${escapeHtml(clue.name)}</h3>
        <div class="status-chips">
          ${clue.shared_with_room ? `<span class="status-chip published">已公开</span>` : ""}
          ${roleShareCount ? `<span class="status-chip testing">已私享 ${roleShareCount} 人</span>` : ""}
          ${read ? `<span class="status-chip ok">已读</span>` : `<span class="status-chip draft">未读</span>`}
        </div>
      </div>
      <p class="story-body">${escapeHtml(clue.public_text || "暂无内容")}</p>
      ${clue.player_note ? `<div class="clue-note-box"><strong>我的解读</strong><p>${escapeHtml(clue.player_note)}</p></div>` : ""}
      <div class="row-actions clue-actions">
        ${!read ? `<button class="btn outline" type="button" data-action="read-clue" data-clue-id="${clue.id}" ${state.busy ? "disabled" : ""}>标记已读</button>` : ""}
        <button class="btn quiet" type="button" data-action="edit-clue-note" data-clue-id="${clue.id}">${clue.player_note ? "修改解读" : "添加解读"}</button>
        <button class="btn quiet" type="button" data-action="share-clue-room" data-clue-id="${clue.id}">${clue.shared_with_room ? "取消公开" : "公开到全房间"}</button>
        <button class="btn quiet" type="button" data-action="share-clue-roles" data-clue-id="${clue.id}">私享给玩家</button>
      </div>
    </article>`;
}

function renderSharedClueDetail(clue) {
  if (!clue) return "";
  const read = clueIsRead(clue, { owned: false });
  const scopeLabel =
    clue.shared_scope === "roles"
      ? `私享 · ${escapeHtml(clueOwnerLabel(clue))}`
      : `来自 ${escapeHtml(clueOwnerLabel(clue))}`;
  return `
    <article class="card detail clue-detail">
      <div class="clue-detail-head">
        <h3>${escapeHtml(clue.name)}</h3>
        <span class="status-chip ${clue.shared_scope === "roles" ? "testing" : "published"}">${scopeLabel}</span>
      </div>
      <p class="story-body">${escapeHtml(clue.public_text || "暂无内容")}</p>
      ${clue.player_note ? `<div class="clue-note-box"><strong>分享者解读</strong><p>${escapeHtml(clue.player_note)}</p></div>` : ""}
      ${!read ? `<button class="btn outline" type="button" data-action="read-clue" data-clue-id="${clue.id}" data-shared="1" ${state.busy ? "disabled" : ""}>标记已读</button>` : `<p class="done-note">✓ 已读</p>`}
    </article>`;
}

export function renderClues() {
  const owned = state.home?.clues || [];
  const shared = state.home?.sharedClues || [];
  const roomShared = shared.filter((c) => c.shared_scope !== "roles");
  const roleShared = shared.filter((c) => c.shared_scope === "roles");

  if (!owned.length && !shared.length) {
    return `<div class="empty enriched-empty"><span class="empty-icon">🔍</span>还没有获得线索。完成分幕阅读或探索场景中的调查点后，线索会出现在这里。</div>`;
  }

  const activeId = state.clueId || owned[0]?.id || shared[0]?.id;
  const activeOwned = owned.find((c) => c.id === activeId);
  const activeShared = shared.find((c) => c.id === activeId);
  const showingOwned = Boolean(activeOwned);

  const ownedList = owned
    .map(
      (clue) => `
    <button type="button" class="list-item ${clue.id === activeId && showingOwned ? "is-active" : ""}" data-action="pick-clue" data-clue-id="${clue.id}" data-owned="1">
      <strong>${escapeHtml(clue.name)}</strong>
      ${clueIsRead(clue, { owned: true }) ? "<span>已读</span>" : '<span class="tag">未读</span>'}
    </button>`
    )
    .join("");

  const sharedList = (section, items) =>
    items
      .map(
        (clue) => `
    <button type="button" class="list-item ${clue.id === activeId && !showingOwned ? "is-active" : ""}" data-action="pick-clue" data-clue-id="${clue.id}" data-owned="0">
      <strong>${escapeHtml(clue.name)}</strong>
      <span class="tag subtle">${section}</span>
    </button>`
      )
      .join("");

  return `
    <div class="clues-layout">
      <aside class="clues-sidebar">
        ${owned.length ? `<section class="clues-group"><h4>我的线索</h4><div class="list">${ownedList}</div></section>` : ""}
        ${roomShared.length ? `<section class="clues-group"><h4>公共讨论区</h4><div class="list">${sharedList("公开", roomShared)}</div></section>` : ""}
        ${roleShared.length ? `<section class="clues-group"><h4>私享线索</h4><div class="list">${sharedList("私享", roleShared)}</div></section>` : ""}
      </aside>
      ${showingOwned ? renderOwnedClueDetail(activeOwned) : renderSharedClueDetail(activeShared)}
    </div>`;
}

export function renderExploration() {
  if (state.explorationError) {
    return `
      <div class="banner error inline-retry">
        ${escapeHtml(state.explorationError)}
        <button class="btn outline compact" type="button" data-action="retry-exploration">重试</button>
      </div>`;
  }
  const scenes = state.exploration?.scenes || [];
  if (!scenes.length) {
    return `<div class="empty enriched-empty"><span class="empty-icon">🗺</span>当前还没有开放探索场景。读完分幕并等待主持人解锁后，新地点会出现在这里。</div>`;
  }
  return scenes
    .map(
      (scene) => `
    <article class="card scene-card">
      <header>
        <p class="eyebrow">场景</p>
        <h3>${escapeHtml(scene.name)}</h3>
      </header>
      <p>${escapeHtml(scene.public_text || "")}</p>
      <div class="point-list">
        ${asArray(scene.investigation_points)
          .map(
            (point) => `
          <div class="point-row">
            <div>
              <strong>${escapeHtml(point.name)}</strong>
              <p>${escapeHtml(point.description || "")}</p>
              ${point.requiredItemName ? `<span class="tag">需要：${escapeHtml(point.requiredItemName)}</span>` : ""}
              ${point.investigated && point.resultText ? `<p class="result-text">${escapeHtml(point.resultText)}</p>` : ""}
            </div>
            <button class="btn ${point.investigated ? "quiet" : "outline"}" type="button"
              data-action="investigate" data-point-id="${point.id}"
              ${point.investigated || !point.hasRequiredItem || state.busy ? "disabled" : ""}>
              ${point.investigated ? "已调查" : "调查"}
            </button>
          </div>`
          )
          .join("")}
      </div>
    </article>`
    )
    .join("");
}

export function renderInventory() {
  const items = state.home?.inventory || [];
  if (!items.length) return `<div class="empty enriched-empty"><span class="empty-icon">🎒</span>背包是空的。探索场景或完成剧情后，物品会出现在这里。</div>`;
  return `
    <div class="inventory-grid">
      ${items
        .map(
          (item) => `
        <article class="card inventory-item">
          <strong>${escapeHtml(item.name)}</strong>
          <span class="qty">× ${item.quantity}</span>
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
        </article>`
        )
        .join("")}
    </div>`;
}

export function renderHostConfirmBannerHtml() {
  return hostNudgeBanner() + hostConfirmBanner();
}

function gameTabDefinitions() {
  const progress = playerProgress(state.home);
  const voiceLive = state.voiceLiveStatus === "connected" ? "live" : "";
  return [
    ["home", "概览", ""],
    ["voice", "语音", voiceLive ? "●" : ""],
    ["sections", "分幕", progress.sectionsTotal ? `${progress.sectionsCompleted}/${progress.sectionsTotal}` : ""],
    ["explore", "探索", state.exploration?.scenes?.length || ""],
    ["clues", "线索", progress.clueTotal || ""],
    ["inventory", "背包", progress.inventoryCount || ""],
    ["recap", "复盘", state.recapLatest ? "●" : ""]
  ];
}

function renderTabBadge(id, badge) {
  const pulse = state.tabPulse?.[id] && state.tab !== id;
  const count = state.tabPulseCount?.[id] || 0;
  const parts = [];
  if (badge) parts.push(`<span class="tab-badge">${badge}</span>`);
  if (pulse && count > 0) {
    parts.push(`<span class="tab-badge tab-badge-new">+${count > 9 ? "9+" : count}</span>`);
  } else if (pulse) {
    parts.push(`<span class="tab-pulse-dot" aria-label="有新内容"></span>`);
  }
  return parts.join("");
}

export function renderGameTabBar() {
  return gameTabDefinitions()
    .map(
      ([id, label, badge]) => `
            <button type="button" role="tab" aria-selected="${state.tab === id ? "true" : "false"}" id="play-tab-${id}" class="tab ${state.tab === id ? "is-active" : ""}${state.tabPulse?.[id] ? " tab-has-pulse" : ""}" data-action="switch-tab" data-tab="${id}">
              ${label}${renderTabBadge(id, badge)}
            </button>`
    )
    .join("");
}

export function renderGameTabBody() {
  if (state.tab === "home") return renderGameHome();
  if (state.tab === "voice") return renderVoiceTab();
  if (state.tab === "sections") return renderSections();
  if (state.tab === "explore") return renderExploration();
  if (state.tab === "clues") return renderClues();
  if (state.tab === "recap") return renderRecapTab();
  return renderInventory();
}

export function renderGame() {
  return `
    <section class="game-shell ${state.gameSidebarCollapsed ? "sidebar-collapsed" : ""}">
      <button class="sidebar-toggle btn outline full" type="button" data-action="toggle-sidebar" aria-expanded="${state.gameSidebarCollapsed ? "false" : "true"}">
        ${state.gameSidebarCollapsed ? "展开角色与成员" : "收起侧栏"}
      </button>
      <aside class="game-sidebar" data-game-sidebar>
        ${renderGameSidebar()}
      </aside>
      <div class="game-main">
        <nav class="tab-bar" data-game-tab-bar aria-label="玩家功能" role="tablist">
          ${renderGameTabBar()}
        </nav>
        <div data-game-host-banner>${renderHostConfirmBannerHtml()}</div>
        <div class="tab-body" data-game-tab-body role="tabpanel" aria-labelledby="play-tab-${state.tab}">${renderGameTabBody()}</div>
      </div>
    </section>`;
}
