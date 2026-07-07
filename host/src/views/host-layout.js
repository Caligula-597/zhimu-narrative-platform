import { state } from "../state.js";
import { escapeHtml, formatRelativeTime } from "../utils/format.js";
import { resolveChapterSegmentKey, segmentRunbookFromOperations } from "../../../shared/segment-contract.js";

function paceClock(pace = {}) {
  let elapsed = pace.elapsedMs || 0;
  if (pace.running && pace.startedAt) elapsed += Date.now() - pace.startedAt;
  const ms = pace.mode === "count-up" ? elapsed : Math.max(0, (pace.targetMs || 0) - elapsed);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function legacyRunbooks() {
  const settings = state.studio?.world?.settings || {};
  return settings.matrixSync?.hostRunbooks || settings.hostRunbooks || [];
}

function segmentRunbooks() {
  return (state.cloudWorldSegments || [])
    .map((segment) => segmentRunbookFromOperations(segment))
    .filter(Boolean);
}

export function hostRunbooks() {
  const byKey = new Map();
  for (const book of segmentRunbooks()) {
    byKey.set(book.actKey || book.segmentKey, book);
  }
  for (const book of legacyRunbooks()) {
    const key = book.actKey || book.segmentKey || book.key || "";
    if (key && !byKey.has(key)) byKey.set(key, book);
  }
  return [...byKey.values()];
}

export function hostChapterActKey(chapter) {
  return resolveChapterSegmentKey(chapter);
}

function hostActs() {
  const chapters = (state.studio?.chapters || []).slice().sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const byKey = new Map();
  for (const chapter of chapters) {
    const key = hostChapterActKey(chapter);
    byKey.set(key, {
      key,
      title: chapter.title || key,
      chapter,
      sequence: chapter.sequence || byKey.size + 1,
      runbook: null
    });
  }
  for (const book of hostRunbooks()) {
    const key = book.actKey || book.segmentKey || book.key || "";
    if (!key) continue;
    const existing = byKey.get(key) || { key, title: book.title || key, chapter: null, sequence: byKey.size + 1 };
    existing.title = book.title || existing.title;
    existing.sequence = book.sequence || existing.sequence;
    existing.runbook = book;
    byKey.set(key, existing);
  }
  for (const remedy of state.cloudHostSegmentRemedies || []) {
    const key = remedy.segment_key;
    if (!key || byKey.has(key)) continue;
    byKey.set(key, { key, title: remedy.title || key, chapter: null, sequence: byKey.size + 1, runbook: null });
  }
  return [...byKey.values()].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
}

function activeAct() {
  const acts = hostActs();
  if (!acts.length) return null;
  const selected = state.hostSelectedActKey || "";
  return acts.find((act) => act.key === selected) || acts[0];
}

function clueName(clueId) {
  const clue = (state.studio?.clues || []).find((item) => String(item.id) === String(clueId));
  return clue?.name || clueId || "未指定线索";
}

function clueById(clueId) {
  return (
    (state.cloudHostClueMatrix?.clues || []).find((item) => String(item.id) === String(clueId)) ||
    (state.studio?.clues || []).find((item) => String(item.id) === String(clueId)) ||
    null
  );
}

function grantModeLabel(mode) {
  return { auto: "自动发放", host_confirm: "主持确认", explore: "探索获得" }[mode] || mode || "未标注";
}

function roleLabel(roleKey) {
  if (!roleKey) return "全场";
  const players = state.cloudHostClueMatrix?.players || state.cloudHostPlayers || [];
  const match = players.find((player) =>
    [player.role_key, player.roleKey, player.role_slot_id, player.role_name, player.name]
      .filter(Boolean)
      .some((value) => String(value) === String(roleKey))
  );
  return match?.role_name || match?.name || roleKey;
}

function grantStatus(grant) {
  const clueId = grant.clueId || grant.clue_id;
  const roleKey = grant.roleKey || grant.role_key;
  const matrix = state.cloudHostClueMatrix;
  if (!matrix?.cells || !clueId) return { label: "待核对", tone: "draft" };
  const players = matrix.players || [];
  const targetPlayers = roleKey
    ? players.filter((player) =>
        [player.role_key, player.roleKey, player.role_slot_id, player.role_name, player.name]
          .filter(Boolean)
          .some((value) => String(value) === String(roleKey))
      )
    : players.filter((player) => player.joined);
  const roleSlotIds = targetPlayers.map((player) => player.role_slot_id).filter(Boolean);
  if (!roleSlotIds.length) return { label: "待匹配角色", tone: "testing" };
  const ownedCount = roleSlotIds.filter((roleSlotId) => matrix.cells?.[clueId]?.[roleSlotId]?.owned).length;
  if (ownedCount === roleSlotIds.length) return { label: "已发放", tone: "published" };
  if (ownedCount > 0) return { label: `${ownedCount}/${roleSlotIds.length} 已发`, tone: "testing" };
  return { label: "待发放", tone: "draft" };
}

function actSelector(acts, current) {
  if (!acts.length) return "";
  return `<div class="host-act-tabs" role="tablist" aria-label="选择当前幕">
    ${acts
      .map(
        (act) => `<button type="button" role="tab" aria-selected="${act.key === current?.key ? "true" : "false"}" class="host-act-tab ${act.key === current?.key ? "is-active" : ""}" data-action="host-select-act" data-act-key="${escapeHtml(act.key)}">${escapeHtml(act.title)}</button>`
      )
      .join("")}
  </div>`;
}

function renderRunbook(act) {
  const book = act?.runbook;
  if (!book) {
    return `<div class="host-current-empty">当前幕没有主持手册。可先按章节控场，后续由 Matrix/Segment 生成 runbook。</div>`;
  }
  const flow = String(book.flow || "").trim();
  const hostTruth = String(book.hostTruth || "").trim();
  return `<div class="host-current-runbook">
    ${flow ? `<section><p class="section-kicker">流程</p><p>${escapeHtml(flow)}</p></section>` : ""}
    ${hostTruth ? `<section><p class="section-kicker">上帝视角</p><p>${escapeHtml(hostTruth)}</p></section>` : ""}
  </div>`;
}

function renderClueGrants(act) {
  const grants = Array.isArray(act?.runbook?.clueGrants) ? act.runbook.clueGrants : [];
  if (!grants.length) {
    return `<div class="host-current-empty">当前幕没有配置应发线索。需要临场处理时可使用手动发线索。</div>`;
  }
  return `<div class="host-current-list">
    ${grants
      .map((grant) => {
        const clueId = grant.clueId || grant.clue_id;
        const clue = clueById(clueId);
        const status = grantStatus(grant);
        const grantMode = clue?.metadata?.grantMode || clue?.grantMode || "auto";
        return `<article class="host-current-item host-clue-grant-item">
          <div class="host-current-item-head">
            <strong>${escapeHtml(clue?.name || clueName(clueId))}</strong>
            <span class="status-chip ${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>
          </div>
          <p>${escapeHtml(grant.when || grant.timing || "未标注发放时机")}</p>
          <div class="host-grant-meta">
            <span>${escapeHtml(roleLabel(grant.roleKey || grant.role_key))}</span>
            <span>${escapeHtml(grantModeLabel(grantMode))}</span>
          </div>
          <button class="secondary-btn host-grant-now-btn" type="button" data-action="host-manual-grant-clue" data-act-key="${escapeHtml(act?.key || "")}" data-clue-id="${escapeHtml(clueId || "")}" data-role-key="${escapeHtml(grant.roleKey || grant.role_key || "")}">发放这条</button>
        </article>`
      })
      .join("")}
  </div>`;
}

function renderPlayerTasks(act) {
  const tasks = Array.isArray(act?.runbook?.playerTasks) ? act.runbook.playerTasks.filter(Boolean) : [];
  if (!tasks.length) return "";
  return `<section class="host-current-tasks">
    <div class="section-head compact"><div><h3>玩家任务</h3><p>${tasks.length} 项来自当前 Segment</p></div></div>
    <div class="host-current-list">
      ${tasks
        .map(
          (task, index) => `<article class="host-current-item host-task-item">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <p>${escapeHtml(task)}</p>
          </article>`
        )
        .join("")}
    </div>
  </section>`;
}

function renderRemedies(act) {
  const fallbacks = Array.isArray(act?.runbook?.fallbacks) ? act.runbook.fallbacks : [];
  const items = (state.cloudHostSegmentRemedies || []).filter((row) => !act?.key || row.segment_key === act.key);
  if (!fallbacks.length && !items.length) {
    return `<div class="host-current-empty">当前幕没有补救话术。卡关时可先用主持日志或手动发线索。</div>`;
  }
  return `<div class="host-current-list">
    ${fallbacks
      .map(
        (text, index) => `<article class="host-current-item">
          <strong>主持手册兜底 ${index + 1}</strong>
          <p>${escapeHtml(text)}</p>
        </article>`
      )
      .join("")}
    ${items
      .map(
        (row) => `<article class="host-current-item">
          <strong>${escapeHtml(row.title)}</strong>
          <p>${escapeHtml(row.trigger_hint || "无触发提示")}</p>
          <button class="secondary-btn" type="button" data-action="host-apply-remedy" data-remedy="${escapeHtml(row.id)}">执行补救</button>
        </article>`
      )
      .join("")}
  </div>`;
}

function queueItems() {
  const items = [];
  for (const event of (state.cloudHostEvents || []).filter((row) => row.status !== "delayed")) {
    items.push({
      type: "event",
      priority: 10,
      time: event.created_at,
      title: event.title || "待确认事件",
      detail: event.description || event.rule_name || "",
      actions: `<button class="primary-btn" data-action="execute-host-event" data-event="${escapeHtml(event.id)}">确认</button><button class="secondary-btn" data-action="delay-host-event" data-event="${escapeHtml(event.id)}">延后</button>`
    });
  }
  for (const vote of state.cloudHostVotes || []) {
    if (!["open", "closed"].includes(vote.status)) continue;
    const ballots = vote.ballots?.length || 0;
    items.push({
      type: "vote",
      priority: vote.status === "open" ? 20 : 25,
      time: vote.updated_at || vote.created_at,
      title: vote.title || "投票 / 指认",
      detail: `${vote.status === "open" ? "投票中" : "待公布"} · ${ballots} 票`,
      actions:
        vote.status === "open"
          ? `<button class="secondary-btn" data-action="host-vote-status" data-vote-id="${escapeHtml(vote.id)}" data-status="closed">关闭</button>`
          : `<button class="primary-btn" data-action="host-vote-status" data-vote-id="${escapeHtml(vote.id)}" data-status="published">公布</button>`
    });
  }
  for (const action of state.cloudHostPrivateActions || []) {
    if (["accepted", "rejected"].includes(action.status)) continue;
    items.push({
      type: "private",
      priority: 30,
      time: action.created_at,
      title: action.title || "私密行动",
      detail: `${action.actor_role_name || "玩家"} · ${action.action_type || ""}`,
      actions: `<button class="secondary-btn" data-action="host-review-private-action" data-action-id="${escapeHtml(action.id)}" data-status="seen">已阅</button><button class="primary-btn" data-action="host-review-private-action" data-action-id="${escapeHtml(action.id)}" data-status="accepted">接受</button><button class="secondary-btn" data-action="host-review-private-action" data-action-id="${escapeHtml(action.id)}" data-status="rejected">拒绝</button>`
    });
  }
  for (const testimony of state.cloudHostTestimonies || []) {
    if (testimony.host_flag) continue;
    items.push({
      type: "testimony",
      priority: 40,
      time: testimony.submitted_at,
      title: "玩家口供",
      detail: `${testimony.role_name || "角色"} · ${String(testimony.body || "").slice(0, 60)}`,
      actions: `<button class="secondary-btn" data-action="host-review-testimony" data-testimony="${escapeHtml(testimony.id)}" data-flag="noted">已阅</button><button class="secondary-btn" data-action="host-review-testimony" data-testimony="${escapeHtml(testimony.id)}" data-flag="contradiction">标矛盾</button>`
    });
  }
  return items.sort((a, b) => a.priority - b.priority || String(a.time || "").localeCompare(String(b.time || "")));
}

function renderQueuePanel() {
  const items = queueItems();
  if (!items.length) {
    return `<section class="host-command-card host-queue-panel">
      <div class="section-head"><div><p class="section-kicker">QUEUE</p><h3>待处理队列</h3></div></div>
      <div class="empty-state">当前没有需要立即处理的投票、事件、私密行动或口供。</div>
    </section>`;
  }
  return `<section class="host-command-card host-queue-panel">
    <div class="section-head"><div><p class="section-kicker">QUEUE</p><h3>待处理队列</h3><p>${items.length} 项按现场优先级排序</p></div></div>
    <div class="host-queue-list">
      ${items
        .map(
          (item) => `<article class="host-queue-item host-queue-${escapeHtml(item.type)}">
            <span class="host-queue-type">${escapeHtml(item.type)}</span>
            <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p><small>${item.time ? formatRelativeTime(item.time) : ""}</small></div>
            <div class="host-queue-actions">${item.actions}</div>
          </article>`
        )
        .join("")}
    </div>
  </section>`;
}

function renderPlayersColumn({ playersTableRows }) {
  const players = state.cloudHostPlayers || [];
  return `<section class="host-command-card host-players-column">
    <div class="section-head">
      <div><p class="section-kicker">PLAYERS</p><h3>玩家状态</h3><p>${players.filter((p) => p.joined).length}/${players.length} 已入房</p></div>
      <div class="row host-manual-actions">
        <button class="secondary-btn" data-action="host-manual-grant-clue">发线索</button>
        <button class="secondary-btn" data-action="host-manual-grant-item">发物品</button>
        <button class="secondary-btn" data-action="host-manual-unlock-section">解锁分幕</button>
      </div>
    </div>
    <div class="host-runtime-table-wrap host-command-player-table">
      <table class="host-runtime-table"><thead><tr><th>玩家 / 角色</th><th>入房</th><th>阅读</th><th>线索</th><th>最近操作</th><th>状态</th><th></th></tr></thead><tbody>${playersTableRows(players)}</tbody></table>
    </div>
  </section>`;
}

function renderCurrentActColumn() {
  const acts = hostActs();
  const act = activeAct();
  return `<section class="host-command-card host-current-act-panel">
    <div class="section-head">
      <div><p class="section-kicker">CURRENT ACT</p><h3>${escapeHtml(act?.title || "当前幕控场")}</h3><p>${escapeHtml(act?.key || "尚未建立 Segment / Runbook")}</p></div>
      <button class="secondary-btn" data-action="host-manual-log">主持日志</button>
    </div>
    ${actSelector(acts, act)}
    ${renderRunbook(act)}
    ${renderPlayerTasks(act)}
    <div class="host-current-grid">
      <section><div class="section-head compact"><div><h3>应发线索</h3></div><button class="secondary-btn" data-action="host-manual-grant-clue" data-act-key="${escapeHtml(act?.key || "")}">手动发线索</button></div>${renderClueGrants(act)}</section>
      <section><div class="section-head compact"><div><h3>补救话术</h3></div></div>${renderRemedies(act)}</section>
    </div>
    <div class="host-current-actions">
      <button class="secondary-btn" data-action="host-manual-unlock-section" data-act-key="${escapeHtml(act?.key || "")}">解锁本幕分幕</button>
    </div>
  </section>`;
}

function renderTopbar({ room, world }) {
  const pace = state.paceTimer || { mode: "count-up", running: false, elapsedMs: 0 };
  return `<section class="host-command-topbar">
    <div class="host-topbar-room">
      <span class="live-label"><i></i>LIVE</span>
      <div><p class="eyebrow">${escapeHtml(world?.name || "当前世界")}</p><h1>${escapeHtml(room?.name || "主持工作区")}</h1></div>
    </div>
    <div class="host-topbar-meta">
      ${room?.invite_code ? `<span>邀请码 <code class="invite-code-inline">${escapeHtml(room.invite_code)}</code></span>` : ""}
      <span>${state.roomEventsConnected ? "实时同步已连接" : "轮询同步中"}</span>
    </div>
    <div class="host-topbar-timer">
      <strong data-host-pace-clock>${escapeHtml(paceClock(pace))}</strong>
      <button class="secondary-btn" data-action="host-pace-toggle">${pace.running ? "暂停" : "开始"}</button>
      <button class="secondary-btn" data-action="host-pace-reset">重置</button>
    </div>
  </section>`;
}

export function renderHostCommandCenter({ room, world, playersTableRows }) {
  return `<section class="host-command-center">
    ${renderTopbar({ room, world })}
    <div class="host-command-grid">
      ${renderPlayersColumn({ playersTableRows })}
      ${renderCurrentActColumn()}
      ${renderQueuePanel()}
    </div>
  </section>`;
}
