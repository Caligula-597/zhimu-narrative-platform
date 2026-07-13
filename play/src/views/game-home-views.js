import { asArray, escapeHtml } from "../../../shared/security.js";
import { currentScene, playerProgress, state } from "../state.js";
import { clueIsRead } from "../utils/clues.js";
import { renderVoiceCompact } from "./voice.js";

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

export function renderHostConfirmBannerHtml() {
  return hostNudgeBanner() + hostConfirmBanner();
}
