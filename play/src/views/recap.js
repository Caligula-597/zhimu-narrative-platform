import { escapeHtml } from "../security.js";
import { formatTime } from "../utils/format.js";
import { state } from "../state.js";

function recapSection(title, body) {
  return `<section class="recap-section card-soft"><h4>${title}</h4>${body}</section>`;
}

function renderTimeline(snapshot) {
  const events = snapshot.keyTimeline || [];
  if (!events.length) {
    return recapSection("关键时间线", `<p class="muted">尚无时间线事件。</p>`);
  }
  return recapSection(
    "关键时间线",
    `<div class="recap-timeline">${events
      .map(
        (event) => `
      <div class="recap-timeline-row">
        <time>${formatTime(event.at)}</time>
        <p>${escapeHtml(event.label || event.message || event.title || "")}</p>
      </div>`
      )
      .join("")}</div>`
  );
}

function renderClues(snapshot) {
  const discovered = snapshot.clueDiscovery || [];
  const missed = snapshot.missedClues || [];
  const discoveredHtml = discovered.length
    ? discovered
        .map(
          (row) => `
        <div class="recap-row">
          <strong>${row.masked ? "【未公开线索】" : escapeHtml(row.clueName || "未命名线索")}</strong>
          <p>${escapeHtml(row.roleName || "")}${row.readAt ? ` · 已读 ${formatTime(row.readAt)}` : ""}</p>
        </div>`
        )
        .join("")
    : `<p class="muted">本局尚无已发放线索。</p>`;
  const missedHtml = missed.length
    ? missed
        .map(
          (row) => `
        <div class="recap-row">
          <strong>${row.masked ? "某角色持有的未公开线索" : escapeHtml(row.clueName || "未命名线索")}</strong>
          <p>${row.acquiredByRoleName ? `${escapeHtml(row.acquiredByRoleName)} 已获得` : "全房间无人获得"}</p>
        </div>`
        )
        .join("")
    : `<p class="muted">你没有明显错过的已知线索。</p>`;
  return `${recapSection("线索发现", `<div class="recap-rows">${discoveredHtml}</div>`)}${recapSection("我错过的线索", `<div class="recap-rows">${missedHtml}</div>`)}`;
}

function renderHostEvents(snapshot) {
  const events = snapshot.hostConfirmedEvents || [];
  if (!events.length) {
    return recapSection("主持确认事件", `<p class="muted">本局没有已处理的主持确认事件。</p>`);
  }
  return recapSection(
    "主持确认事件",
    `<div class="recap-rows">${events
      .map(
        (event) => `
      <div class="recap-row">
        <strong>${escapeHtml(event.title)}</strong>
        <p>${event.status === "executed" ? "已确认执行" : "已驳回"} · ${formatTime(event.resolvedAt || event.createdAt)}</p>
      </div>`
      )
      .join("")}</div>`
  );
}

function renderNotes(snapshot) {
  const notes = snapshot.notes || [];
  if (!notes.length) {
    return recapSection("我的笔记", `<p class="muted">尚无笔记记录。</p>`);
  }
  return recapSection(
    "我的笔记",
    `<div class="recap-rows">${notes
      .slice(0, 12)
      .map(
        (note) => `
      <div class="recap-row">
        <strong>${escapeHtml(note.title)}</strong>
        <p>${formatTime(note.createdAt)}</p>
        <small>${escapeHtml((note.body || "").slice(0, 160))}${(note.body || "").length > 160 ? "…" : ""}</small>
      </div>`
      )
      .join("")}</div>`
  );
}

export function renderRecapTab() {
  if (state.recapLoading) {
    return `<div class="empty enriched-empty"><span class="empty-icon">📜</span>正在加载复盘…</div>`;
  }
  if (state.recapError) {
    return `<div class="empty enriched-empty"><span class="empty-icon">📜</span>${escapeHtml(state.recapError)}<button class="btn outline" type="button" data-action="reload-recap">重试</button></div>`;
  }
  const latest = state.recapLatest;
  if (!latest) {
    return `<div class="empty enriched-empty"><span class="empty-icon">📜</span>主持人尚未生成本房间的复盘报告。局结束后请让主持人在创作者端「存档与复盘」生成，你即可在此查看<strong>我的视角</strong>回顾。</div>`;
  }
  if (!state.recapDetail || state.recapDetail.id !== latest.id) {
    return `
      <article class="card recap-card">
        <p class="eyebrow">我的复盘</p>
        <h3>${escapeHtml(latest.label)}</h3>
        <p class="muted">${escapeHtml(latest.description || "无备注")} · 生成于 ${formatTime(latest.created_at)} · ${escapeHtml(latest.created_by_name || "主持人")}</p>
        <dl class="entry-meta recap-meta">
          <div><dt>线索流转</dt><dd>${latest.summary?.cluesDiscovered ?? 0}</dd></div>
          <div><dt>调查完成</dt><dd>${latest.summary?.investigationsCompleted ?? 0}</dd></div>
        </dl>
        <button class="btn primary" type="button" data-action="open-recap-detail">查看完整复盘</button>
      </article>`;
  }
  const snapshot = state.recapDetail.snapshot || {};
  const truth = snapshot.truth || {};
  return `
    <article class="card recap-detail">
      <header class="recap-detail-head">
        <div>
          <p class="eyebrow">我的视角 · MY RECAP</p>
          <h3>${escapeHtml(state.recapDetail.label)}</h3>
          <p class="muted">${escapeHtml(state.recapDetail.description || "")} · ${formatTime(state.recapDetail.created_at)}</p>
        </div>
        <button class="btn quiet" type="button" data-action="close-recap-detail">返回摘要</button>
      </header>
      ${truth.worldSummary ? `<div class="banner soft">${escapeHtml(truth.worldSummary)}</div>` : ""}
      ${renderTimeline(snapshot)}
      ${renderClues(snapshot)}
      ${renderHostEvents(snapshot)}
      ${renderNotes(snapshot)}
      <p class="hint">以上内容来自真实游戏日志与流转记录，非 AI 生成。</p>
    </article>`;
}
