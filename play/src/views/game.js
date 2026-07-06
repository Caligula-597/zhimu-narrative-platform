import { escapeHtml, sanitizeImageUrl, asArray } from "../../../shared/security.js";
import { currentScene, playerProgress, state } from "../state.js";
import { clueIsRead, clueOwnerLabel, clueShareRoleCount } from "../utils/clues.js";
import { applyStoryHighlights, sectionHighlights } from "../utils/highlights.js";
import { renderVoiceCompact, renderVoiceTab } from "./voice.js";
import { renderRecapTab } from "./recap.js";
import { renderMiniGamePanel } from "../components/mini-games.js";

const PRIMARY_TAB_GROUPS = {
  home: ["home", "voice"],
  story: ["sections"],
  investigation: ["explore", "clues", "inventory"],
  play: ["tasks", "suspicions", "social"],
  recap: ["recap", "timeline", "notes"]
};

const PRIMARY_TAB_DEFAULTS = {
  home: "home",
  story: "sections",
  investigation: "explore",
  play: "tasks",
  recap: "recap"
};

const LEGACY_TAB_TO_PRIMARY = Object.entries(PRIMARY_TAB_GROUPS).reduce((acc, [primary, ids]) => {
  for (const id of ids) acc[id] = primary;
  return acc;
}, {});

export function primaryTabFor(tabId = state.tab) {
  return LEGACY_TAB_TO_PRIMARY[tabId] || (PRIMARY_TAB_DEFAULTS[tabId] ? tabId : "home");
}

export function defaultGameTabFor(tabId = "home") {
  return PRIMARY_TAB_DEFAULTS[tabId] || tabId || "home";
}

export function tabGroupFor(tabId = state.tab) {
  const primary = primaryTabFor(tabId);
  return PRIMARY_TAB_GROUPS[primary] || [tabId || "home"];
}

export function gameTabPanelLabelId(tabId = state.tab) {
  return `play-tab-${primaryTabFor(tabId)}`;
}

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

      ${renderPlayerActionsHub(home, next)}

      ${(state.exploration?.scenes?.length || 0) > 0
        ? `
        <button class="btn outline" type="button" data-action="switch-tab" data-tab="explore">前往探索场景（${state.exploration.scenes.length}）</button>`
        : ""}
    </div>`;
}

function renderPlayerActionsHub(home, nextSection) {
  const sections = home?.sections || [];
  const tasks = asArray(home?.tasks);
  const clues = home?.clues || [];
  const sharedClues = home?.sharedClues || [];
  const scenes = state.exploration?.scenes || [];
  const points = scenes.flatMap((s) => (s.investigation_points || []).map((p) => ({ ...p, sceneName: s.name })));
  const pending = home?.hostConfirm;
  const currentGame = state.currentGame;
  const votes = asArray(home?.activeVotes);

  const pendingTasks = tasks.filter((task) => task.status !== "completed");
  const openVotes = votes.filter((vote) => vote.status === "open" && !vote.submitted_at);
  const unreadSections = sections.filter((s) => !s.completed);
  const unreadClues = clues.filter((c) => !clueIsRead(c, { owned: true }));
  const unreadShared = sharedClues.filter((c) => !clueIsRead(c, { owned: false }));
  const unreadAllClues = [...unreadClues, ...unreadShared];
  const availablePoints = points.filter((p) => !p.investigated && p.hasRequiredItem);
  const blockedPoints = points.filter((p) => !p.investigated && !p.hasRequiredItem && p.requiredItemName);

  let primary;
  if (pendingTasks.length) {
    primary = { title: pendingTasks[0].body || "完成本幕任务", detail: pendingTasks[0].tips || "先处理未完成任务，再推进调查和讨论。", action: "switch-tab", data: 'data-tab="tasks"', button: "处理任务" };
  } else if (openVotes.length) {
    primary = { title: openVotes[0].title || "参与投票 / 指认", detail: openVotes[0].prompt || "主持人已开启投票，请先完成你的选择。", action: "switch-tab", data: 'data-tab="social"', button: "去投票" };
  } else if (pending?.waitingForYou) {
    primary = { title: "剧情推进等待主持确认", detail: "你已经触发关键节点。确认后新内容会自动刷新。", action: "switch-tab", data: 'data-tab="voice"', button: "进入讨论" };
  } else if (unreadAllClues.length) {
    primary = { title: `阅读线索：${unreadAllClues[0].name}`, detail: "标记已读后可补充解读、公开或私享给指定玩家。", action: "switch-tab", data: 'data-tab="clues"', button: "查看线索" };
  } else if (nextSection && !nextSection.completed) {
    primary = { title: nextSection.title || "阅读当前分幕", detail: `第 ${nextSection.sequence} 幕 · 尚未读完`, action: "goto-section", data: `data-section-id="${escapeHtml(nextSection.id)}"`, button: "继续阅读" };
  } else if (availablePoints.length) {
    primary = { title: `调查：${availablePoints[0].name}`, detail: `地点：${availablePoints[0].sceneName || "当前场景"}`, action: "switch-tab", data: 'data-tab="explore"', button: "去探索" };
  } else {
    primary = { title: "整理线索或进入语音讨论", detail: "当前没有必须完成的动作", action: "switch-tab", data: 'data-tab="voice"', button: "讨论" };
  }

  const readItems = [
    ...pendingTasks.slice(0, 2).map((t) => ({ label: "未完成任务", title: t.body, action: "switch-tab", data: 'data-tab="tasks"' })),
    ...openVotes.slice(0, 2).map((v) => ({ label: "待投票", title: v.title, action: "switch-tab", data: 'data-tab="social"' })),
    ...unreadSections.slice(0, 3).map((s) => ({ label: "未读分幕", title: s.title || `第 ${s.sequence} 幕`, action: "goto-section", data: `data-section-id="${escapeHtml(s.id)}"` })),
    ...unreadClues.slice(0, 2).map((c) => ({ label: "未读线索", title: c.name, action: "switch-tab", data: 'data-tab="clues"' })),
    ...unreadShared.slice(0, 2).map((c) => ({ label: "未读共享", title: c.name, action: "switch-tab", data: 'data-tab="clues"' }))
  ];
  const exploreItems = [
    ...availablePoints.slice(0, 3).map((p) => ({ label: `可调查 · ${p.sceneName || ""}`, title: p.name, action: "switch-tab", data: 'data-tab="explore"' })),
    ...blockedPoints.slice(0, 2).map((p) => ({ label: `需要 ${p.requiredItemName || "物品"}`, title: p.name, action: "switch-tab", data: 'data-tab="explore"' }))
  ];
  const waitItems = [];
  if (pending?.pendingCount && !pending.waitingForYou) waitItems.push({ label: "确认后自动推送", title: `主持人处理 ${pending.pendingCount} 条待确认` });
  if (currentGame && currentGame.status !== "success") waitItems.push({ label: "解密机关", title: "有待解决的数字锁机关" });
  if (!scenes.length) waitItems.push({ label: "完成阅读后解锁", title: "等待主持人开放场景" });
  if (!unreadSections.length && !availablePoints.length && !pending?.pendingCount) waitItems.push({ label: "可自由行动", title: "当前无紧急待办" });

  const renderItem = (item) => item.action
    ? `<button class="action-list-item" type="button" data-action="${escapeHtml(item.action)}" ${item.data || ""}><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.title)}</b></button>`
    : `<div class="action-list-item is-static"><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.title)}</b></div>`;

  return `
    <article class="next-action card">
      <div class="next-action-primary">
        <div>
          <p class="eyebrow">建议下一步</p>
          <h3>${escapeHtml(primary.title)}</h3>
          <p class="muted">${escapeHtml(primary.detail)}</p>
        </div>
        <button class="btn primary" type="button" data-action="${escapeHtml(primary.action)}" ${primary.data}>${escapeHtml(primary.button)} →</button>
      </div>
      <div class="next-action-lists">
        <div class="action-col">
          <p class="action-col-label">📖 读什么</p>
          ${readItems.length ? readItems.map(renderItem).join("") : '<p class="muted small">暂无未读内容</p>'}
        </div>
        <div class="action-col">
          <p class="action-col-label">🔍 查什么</p>
          ${exploreItems.length ? exploreItems.map(renderItem).join("") : '<p class="muted small">当前无可调查点</p>'}
        </div>
        <div class="action-col">
          <p class="action-col-label">⏳ 等什么</p>
          ${waitItems.length ? waitItems.map(renderItem).join("") : '<p class="muted small">暂无等待项</p>'}
        </div>
      </div>
    </article>`;
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

const TIMELINE_EVENT_LABELS = {
  section_completed: "分幕完成",
  section_started: "开始阅读",
  clue_granted: "获得线索",
  clue_read: "阅读线索",
  clue_shared: "分享线索",
  scene_unlocked: "场景解锁",
  investigation_done: "调查完成",
  item_acquired: "获得物品",
  task_completed: "任务完成",
  testimony_submitted: "提交口供",
  host_action: "主持人操作",
  rule_triggered: "规则触发",
  room_event: "房间事件"
};

function renderTimelineTab() {
  const data = state.myTimeline;
  if (state.myTimelineLoading) {
    return `<div class="timeline-panel"><p class="eyebrow">个人时间线</p><div class="empty enriched-empty"><span class="empty-icon">◷</span>正在加载时间线…</div></div>`;
  }
  if (state.myTimelineError) {
    return `<div class="timeline-panel"><p class="eyebrow">个人时间线</p><div class="empty enriched-empty"><span class="empty-icon">⚠</span>${escapeHtml(state.myTimelineError)}</div></div>`;
  }
  if (!data) {
    return `<div class="timeline-panel"><p class="eyebrow">个人时间线</p><div class="empty enriched-empty"><span class="empty-icon">◷</span>切换到本页时自动加载你在本房间的最近事件。</div></div>`;
  }
  const items = asArray(data.items);
  if (!items.length) {
    return `<div class="timeline-panel"><p class="eyebrow">个人时间线</p><div class="empty enriched-empty"><span class="empty-icon">◷</span>暂无时间线事件。阅读分幕、获得线索或完成调查后，事件会自动记录在这里。</div></div>`;
  }
  const rows = items
    .map((item) => {
      const label = TIMELINE_EVENT_LABELS[item.event_type] || item.event_type || "事件";
      const time = String(item.created_at || "").slice(0, 16).replace("T", " ");
      const selfTag = item.is_self ? `<span class="timeline-self">我</span>` : "";
      return `<article class="timeline-item ${item.is_self ? "is-self" : ""}">
        <div class="timeline-item-head">
          <span class="timeline-event-tag">${escapeHtml(label)}</span>
          ${selfTag}
          <time class="timeline-time">${escapeHtml(time)}</time>
        </div>
        <p class="timeline-message">${escapeHtml(item.message || "")}</p>
      </article>`;
    })
    .join("");
  return `
    <div class="timeline-panel">
      <p class="eyebrow">个人时间线 · 最近 ${items.length} 条</p>
      <p class="muted small">汇总你在本房间可见的剧情推进、线索、调查与主持人操作。</p>
      <div class="timeline-list">${rows}</div>
    </div>`;
}

function renderNotesTab() {
  const notes = asArray(state.home?.notes);
  const draftTitle = state.notesDraftTitle || "";
  const draftBody = state.notesDraft || "";
  const listHtml = notes.length
    ? notes
        .map((note) => {
          const time = String(note.created_at || "").slice(0, 16).replace("T", " ");
          const sourceLabel = note.source_type === "clue" ? "来自线索" : note.source_type === "section" ? "来自分幕" : note.source_type === "scene" ? "来自场景" : "自由记录";
          return `<article class="notes-item">
            <div class="notes-item-head">
              <strong>${escapeHtml(note.title || "无标题")}</strong>
              <span class="notes-source">${escapeHtml(sourceLabel)}</span>
              <time class="notes-time">${escapeHtml(time)}</time>
            </div>
            <p class="notes-body">${escapeHtml(note.body || "")}</p>
            <button class="btn quiet compact" type="button" data-action="delete-notebook-entry" data-note-id="${escapeHtml(String(note.id))}">删除</button>
          </article>`;
        })
        .join("")
    : `<div class="empty enriched-empty"><span class="empty-icon">✎</span>还没有笔记。把推理、怀疑或重要台词记下来，方便后续复盘。</div>`;
  return `
    <div class="notes-panel">
      <p class="eyebrow">推理笔记</p>
      <p class="muted small">仅你自己可见。主持人与其他玩家无法读取你的笔记内容。</p>
      <article class="card notes-editor">
        <input class="input" type="text" data-bind="notesTitle" placeholder="笔记标题（如：第二幕怀疑点）" value="${escapeHtml(draftTitle)}">
        <textarea class="input" rows="4" data-bind="notesBody" placeholder="记下你的推理、怀疑或重要对话…">${escapeHtml(draftBody)}</textarea>
        <div class="notes-editor-actions">
          <button class="btn primary" type="button" data-action="add-notebook-entry">保存笔记</button>
          <button class="btn quiet" type="button" data-action="clear-notes-draft">清空</button>
        </div>
      </article>
      <div class="notes-list">${listHtml}</div>
    </div>`;
}

export function renderTasksTab() {
  const home = state.home;
  const tasks = asArray(home?.tasks);
  const actKey = home?.currentActKey || "ch1";
  const testimonies = asArray(home?.testimonies);
  const taskList = tasks.length
    ? tasks
        .map(
          (task) => `
      <article class="card task-card ${task.status === "completed" ? "is-done" : ""}">
        <div class="task-head">
          <span class="task-visibility">${task.visibility === "secret" ? "秘密" : task.visibility === "optional" ? "可选" : "公开"}</span>
          <strong>${escapeHtml(task.body)}</strong>
        </div>
        ${task.tips ? `<p class="muted task-tips">${escapeHtml(task.tips)}</p>` : ""}
        ${task.status === "completed"
          ? `<span class="task-done-label">已完成</span>`
          : `<button class="btn outline compact" type="button" data-action="complete-player-task" data-task-id="${task.id}">标记完成</button>`}
      </article>`
        )
        .join("")
    : `<div class="empty enriched-empty"><span class="empty-icon">📋</span>当前幕（${escapeHtml(actKey)}）暂无任务。导入 Matrix 角色档案后会自动下发。</div>`;

  return `
    <div class="tasks-panel">
      <p class="eyebrow">本幕任务 · ${escapeHtml(actKey)}</p>
      <div class="task-list">${taskList}</div>
      <article class="card testimony-form-card">
        <h3>提交口供</h3>
        <p class="muted">向主持人提交本幕陈述（其他玩家默认不可见）。</p>
        <textarea class="input" rows="4" data-testimony-body placeholder="写下你此刻愿意公开陈述的内容…"></textarea>
        <button class="btn primary" type="button" data-action="submit-testimony">提交口供</button>
        ${testimonies.length
          ? `<div class="testimony-history"><p class="eyebrow">已提交</p>${testimonies
              .slice(0, 3)
              .map(
                (row) => `<div class="testimony-row">
                  <time>${escapeHtml(String(row.submitted_at || "").slice(0, 16))}</time>
                  <p>${escapeHtml(row.body)}</p>
                  ${row.host_flag ? `<span class="host-flag">${row.host_flag === "contradiction" ? "主持标记：矛盾" : "主持已阅"}</span>` : ""}
                </div>`
              )
              .join("")}</div>`
          : ""}
      </article>
    </div>`;
}

function parseVoteOptions(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

export function renderSocialTab() {
  const votes = asArray(state.home?.activeVotes);
  const actions = asArray(state.home?.privateActions);
  const voteBlocks = votes.length
    ? votes
        .map((vote) => {
          const options = parseVoteOptions(vote.options);
          const submitted = Boolean(vote.submitted_at);
          const canVote = vote.status === "open" && !submitted;
          const optionHtml = canVote
            ? options
                .map(
                  (opt) =>
                    `<button class="btn outline compact" type="button" data-action="submit-vote-ballot" data-vote-id="${escapeHtml(String(vote.id))}" data-option-id="${escapeHtml(String(opt.id))}">${escapeHtml(opt.label)}</button>`
                )
                .join(" ")
            : submitted
              ? `<span class="muted">已提交</span>`
              : `<span class="muted">${vote.status === "published" ? "结果已公布" : "投票已关闭"}</span>`;
          return `<article class="card vote-card">
          <h3>${escapeHtml(vote.title)}</h3>
          ${vote.prompt ? `<p class="muted">${escapeHtml(vote.prompt)}</p>` : ""}
          <div class="vote-options row">${optionHtml}</div>
        </article>`;
        })
        .join("")
    : `<div class="empty enriched-empty"><span class="empty-icon">🗳</span>主持人尚未开启投票/指认。</div>`;

  const actionHistory = actions.length
    ? actions
        .slice(0, 10)
        .map(
          (row) => `<article class="notes-item">
        <div class="notes-item-head"><strong>${escapeHtml(row.title)}</strong><span class="notes-source">${escapeHtml(row.action_type || "")}</span><time class="notes-time">${escapeHtml(String(row.created_at || "").slice(0, 16))}</time></div>
        <p class="notes-body">${escapeHtml(row.body || "")}</p>
        ${row.host_response ? `<p class="muted">主持回复：${escapeHtml(row.host_response)}</p>` : ""}
        <span class="status-chip ${row.status === "accepted" ? "published" : row.status === "rejected" ? "draft" : "testing"}">${escapeHtml(row.status || "submitted")}</span>
      </article>`
        )
        .join("")
    : "";

  return `<div class="social-panel">
    <p class="eyebrow">社交博弈</p>
    <p class="muted small">投票由主持人发起；秘密行动/询问仅主持可见（部分类型目标角色可见）。</p>
    <section class="social-section"><h3>投票 / 指认</h3>${voteBlocks}</section>
    <section class="social-section">
      <h3>秘密行动 / 询问主持</h3>
      <article class="card notes-editor">
        <select class="input" data-private-action-type>
          <option value="ask_host">询问主持</option>
          <option value="secret_action">秘密行动</option>
          <option value="trade">交易提议</option>
          <option value="promise">承诺</option>
          <option value="accusation_note">指认笔记</option>
        </select>
        <input class="input" type="text" data-private-action-title placeholder="标题（必填）">
        <textarea class="input" rows="3" data-private-action-body placeholder="详细说明…"></textarea>
        <button class="btn primary" type="button" data-action="submit-private-action">提交</button>
      </article>
      ${actionHistory ? `<div class="notes-list">${actionHistory}</div>` : `<div class="empty enriched-empty"><span class="empty-icon">🤫</span>尚无秘密行动记录。</div>`}
    </section>
  </div>`;
}

export function renderSuspicionsTab() {
  const members = (state.home?.roomMembers || []).filter((m) => m.role_slot_id && m.role_slot_id !== state.home?.role?.id);
  const suspicions = new Map((state.home?.suspicions || []).map((row) => [row.target_role_slot_id, row]));
  if (!members.length) {
    return `<div class="empty enriched-empty"><span class="empty-icon">🕵️</span>尚无其他角色入席，无法标注怀疑对象。</div>`;
  }
  return `
    <div class="suspicions-panel">
      <p class="eyebrow">怀疑度（仅自己可见）</p>
      ${members
        .map((member) => {
          const current = suspicions.get(member.role_slot_id) || { level: 0, reason: "" };
          return `
        <article class="card suspicion-card" data-target-role="${member.role_slot_id}">
          <strong>${escapeHtml(member.role_name)}</strong>
          <label class="suspicion-level">怀疑度
            <input type="range" min="0" max="5" step="1" value="${current.level || 0}" data-suspicion-level />
            <span data-suspicion-level-label>${current.level || 0}</span>
          </label>
          <textarea class="input" rows="2" data-suspicion-reason placeholder="原因（可选）">${escapeHtml(current.reason || "")}</textarea>
          <button class="btn outline compact" type="button" data-action="save-suspicion" data-target-role="${member.role_slot_id}">保存</button>
        </article>`;
        })
        .join("")}
    </div>`;
}

export function renderHostConfirmBannerHtml() {
  return hostNudgeBanner() + hostConfirmBanner();
}

function sectionBlock(title, subtitle, body, action = "") {
  return `<section class="merged-tab-section card">
    <div class="section-head">
      <div><h3>${escapeHtml(title)}</h3>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}</div>
      ${action}
    </div>
    ${body}
  </section>`;
}

function renderStoryTab() {
  const role = state.home?.role;
  const roleCard = `<article class="role-story-card">
    <p class="eyebrow">你的角色</p>
    <h2>${escapeHtml(role?.name || "未选择")}</h2>
    <p>${escapeHtml(role?.private_profile || role?.public_profile || "暂无角色资料")}</p>
  </article>`;
  return `<div class="merged-tab-layout story-tab-layout">
    ${roleCard}
    ${renderSections()}
  </div>`;
}

function renderInvestigationTab() {
  return `<div class="merged-tab-layout investigation-tab-layout">
    ${sectionBlock("探索", "当前开放场景与可调查点", renderExploration())}
    ${sectionBlock("线索", "我的线索、公开线索与私享线索", renderClues())}
    ${sectionBlock("背包", "调查获得的道具与可用物品", renderInventory())}
  </div>`;
}

function renderPlayTab() {
  return `<div class="merged-tab-layout play-tab-layout">
    ${sectionBlock("任务与口供", "本幕目标、可选任务和提交给主持人的陈述", renderTasksTab())}
    ${sectionBlock("怀疑", "仅自己可见的角色怀疑度与理由", renderSuspicionsTab())}
    ${sectionBlock("投票 / 私密行动", "指认、投票、秘密交易和询问主持", renderSocialTab())}
  </div>`;
}

function renderRecapMergedTab() {
  return `<div class="merged-tab-layout recap-tab-layout">
    ${sectionBlock("复盘", "本局结论、揭示轨迹和满意度反馈", renderRecapTab())}
    ${sectionBlock("时间线", "你在本房间可见的最近事件", renderTimelineTab())}
    ${sectionBlock("笔记", "只对自己可见的推理记录", renderNotesTab())}
  </div>`;
}

function gameTabDefinitions() {
  const progress = playerProgress(state.home);
  const voiceLive = state.voiceLiveStatus === "connected" ? "live" : "";
  const pendingTasks = (state.home?.tasks || []).filter((t) => t.status !== "completed").length;
  const openVotes = (state.home?.activeVotes || []).filter((v) => v.status === "open" && !v.submitted_at).length;
  const notesCount = state.home?.notes?.length || 0;
  const primary = primaryTabFor(state.tab);
  const groupPulse = (id) => tabGroupFor(id).reduce((sum, child) => sum + (state.tabPulseCount?.[child] || 0), 0);
  const investigationCount = (state.exploration?.scenes?.length || 0) + progress.clueTotal + progress.inventoryCount;
  const playCount = pendingTasks + openVotes;
  return [
    { id: "home", target: "home", label: "现在", badge: voiceLive ? "●" : "", active: primary === "home", pulse: groupPulse("home") },
    { id: "story", target: "sections", label: "剧情", badge: progress.sectionsTotal ? `${progress.sectionsCompleted}/${progress.sectionsTotal}` : "", active: primary === "story", pulse: groupPulse("story") },
    { id: "investigation", target: "explore", label: "调查", badge: investigationCount || "", active: primary === "investigation", pulse: groupPulse("investigation") },
    { id: "play", target: "tasks", label: "博弈", badge: playCount || "", active: primary === "play", pulse: groupPulse("play") },
    { id: "recap", target: "recap", label: "复盘", badge: state.recapLatest ? "●" : notesCount || "", active: primary === "recap", pulse: groupPulse("recap") }
  ];
}

function renderTabBadge(id, badge, pulseCount = 0) {
  const pulse = pulseCount > 0 && primaryTabFor(state.tab) !== id;
  const parts = [];
  if (badge) parts.push(`<span class="tab-badge">${badge}</span>`);
  if (pulse && pulseCount > 0) {
    parts.push(`<span class="tab-badge tab-badge-new">+${pulseCount > 9 ? "9+" : pulseCount}</span>`);
  } else if (pulse) {
    parts.push(`<span class="tab-pulse-dot" aria-label="有新内容"></span>`);
  }
  return parts.join("");
}

export function renderGameTabBar() {
  return gameTabDefinitions()
    .map(
      ({ id, target, label, badge, active, pulse }) => `
            <button type="button" role="tab" aria-selected="${active ? "true" : "false"}" id="play-tab-${id}" class="tab ${active ? "is-active" : ""}${pulse ? " tab-has-pulse" : ""}" data-action="switch-tab" data-tab="${target}" data-primary-tab="${id}">
              ${label}${renderTabBadge(id, badge, pulse)}
            </button>`
    )
    .join("");
}

export function renderGameTabBody() {
  if (state.tab === "home") return renderGameHome();
  if (state.tab === "voice") return renderVoiceTab();
  if (primaryTabFor(state.tab) === "story") return renderStoryTab();
  if (primaryTabFor(state.tab) === "investigation") return renderInvestigationTab();
  if (primaryTabFor(state.tab) === "play") return renderPlayTab();
  if (primaryTabFor(state.tab) === "recap") return renderRecapMergedTab();
  if (state.tab === "sections") return renderSections();
  if (state.tab === "tasks") return renderTasksTab();
  if (state.tab === "suspicions") return renderSuspicionsTab();
  if (state.tab === "social") return renderSocialTab();
  if (state.tab === "explore") return renderExploration();
  if (state.tab === "clues") return renderClues();
  if (state.tab === "timeline") return renderTimelineTab();
  if (state.tab === "notes") return renderNotesTab();
  if (state.tab === "recap") return renderRecapTab();
  return renderInventory();
}

export function renderGame() {
  return `
    <section class="game-shell ${state.gameSidebarCollapsed ? "sidebar-collapsed" : ""}">
      <button class="sidebar-toggle btn outline full" type="button" data-action="toggle-sidebar" aria-expanded="${state.gameSidebarCollapsed ? "false" : "true"}">
        ${state.gameSidebarCollapsed ? "展开角色与成员" : "收起侧栏"}
      </button>
      <div class="game-main">
        <nav class="tab-bar" data-game-tab-bar aria-label="玩家功能" role="tablist">
          ${renderGameTabBar()}
        </nav>
        <div data-game-host-banner>${renderHostConfirmBannerHtml()}</div>
        <div data-game-mini-game>${renderMiniGamePanel(state.currentGame)}</div>
        <div class="tab-body" data-game-tab-body role="tabpanel" aria-labelledby="${gameTabPanelLabelId(state.tab)}">${renderGameTabBody()}</div>
      </div>
      <aside class="game-sidebar" data-game-sidebar>
        ${renderGameSidebar()}
      </aside>
    </section>`;
}
