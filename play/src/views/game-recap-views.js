import { asArray, escapeHtml } from "../../../shared/security.js";
import { state } from "../state.js";

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

export function renderTimelineTab() {
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

export function renderNotesTab() {
  const notes = asArray(state.home?.notes);
  const draftTitle = state.notesDraftTitle || "";
  const draftBody = state.notesDraft || "";
  const listHtml = notes.length
    ? notes
        .map((note) => {
          const time = String(note.created_at || "").slice(0, 16).replace("T", " ");
          const sourceLabel = note.source_type === "clue"
            ? "来自线索"
            : note.source_type === "script_section"
              ? "来自角色剧本"
              : "自由记录";
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
