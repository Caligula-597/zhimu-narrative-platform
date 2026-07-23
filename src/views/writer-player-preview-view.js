import { escapeHtml } from "../utils/format.js";
import { buildPlayerReaderPreview, normalizePlayerPreviewDraft } from "./writer-player-preview-model.js";

function optionRows(items, selectedId, { allLabel = "" } = {}) {
  const all = allLabel ? [{ id: "", name: allLabel }, ...items] : items;
  return all.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === selectedId ? " selected" : ""}>${escapeHtml(item.name || item.title || "未命名")}</option>`).join("");
}

function warningRows(warnings) {
  return warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");
}

function visibleSectionRows(sections) {
  if (!sections.length) {
    return `<div class="writer-player-preview-empty"><strong>当前没有可读私人分幕</strong><p>检查分幕发布状态、角色归属和首幕序号；非首幕需要运行时解锁。</p></div>`;
  }
  return sections.map((section, index) => `<article class="writer-player-preview-section">
    <header>
      <div><span>PRIVATE ACT ${escapeHtml(section.sequence || index + 1)}</span><h3>${escapeHtml(section.title || "未命名分幕")}</h3></div>
      <span class="status-chip published">玩家可读</span>
    </header>
    <p class="writer-player-preview-reason">${escapeHtml(section.reason)}</p>
    <div class="writer-player-preview-copy">${escapeHtml(section.body || "该分幕尚未填写正文")}</div>
  </article>`).join("");
}

function hiddenRows(items, emptyLabel) {
  if (!items.length) return `<div class="empty-state">${escapeHtml(emptyLabel)}</div>`;
  return items.map((item) => `<article class="writer-player-preview-hidden-row">
    <div><strong>${escapeHtml(item.title || "未命名内容")}</strong><p>${escapeHtml(item.reason)}</p></div>
    <span class="status-chip draft">不可见</span>
  </article>`).join("");
}

function availabilityRows(title, visible, hidden) {
  return `<section class="writer-player-preview-availability">
    <header><div><p class="section-kicker">INITIAL AVAILABILITY</p><h3>${escapeHtml(title)}</h3></div><b>${visible.length}</b></header>
    ${visible.length
      ? visible.map((item) => `<article class="writer-player-preview-available-row"><strong>${escapeHtml(item.title || "未命名内容")}</strong><span>${escapeHtml(item.reason)}</span></article>`).join("")
      : `<p class="writer-player-preview-muted">初始态无可见${escapeHtml(title)}。</p>`}
    <details>
      <summary>查看 ${hidden.length} 项不可见原因</summary>
      <div class="writer-player-preview-hidden-list">${hiddenRows(hidden, `没有隐藏${title}`)}</div>
    </details>
  </section>`;
}

export function playerPreviewWorkspaceHtml(data, session) {
  normalizePlayerPreviewDraft(data, session.draft);
  const preview = buildPlayerReaderPreview(data, session.draft);
  const role = preview.role;
  if (!role) return "";
  const roomStatus = preview.room?.status === "testing" ? "测试房" : "正式房";
  const portalButton = preview.room?.source === "room" && preview.room.inviteCode
    ? `<button type="button" class="primary-btn" data-action="open-player-portal" data-invite-code="${escapeHtml(preview.room.inviteCode)}">用真实玩家端核验</button>`
    : "";
  return `<section class="writer-tool-workspace writer-player-preview-workspace" data-writer-tool="preview">
    <header class="writer-player-preview-head">
      <div>
        <p class="section-kicker">PLAYER READER PREVIEW</p>
        <h1>玩家阅读模拟</h1>
        <p>以真实 Player 查询规则检查角色初始能看到什么，同时保留每项不可见原因。</p>
      </div>
      <div class="row">${portalButton}<button type="button" class="secondary-btn" data-action="writer-tool-close">返回创作中心</button></div>
    </header>
    <div class="writer-player-preview-layout">
      <aside class="writer-player-preview-controls">
        <div>
          <p class="section-kicker">SIMULATION CONTEXT</p>
          <h2>模拟条件</h2>
          <p>切换条件只重新计算本地预览，不会修改云端内容。</p>
        </div>
        <label><span>模拟角色</span><select class="field" data-player-preview-role>${optionRows(preview.roles, session.draft.roleId)}</select></label>
        <label><span>房间阶段</span><select class="field" data-player-preview-room>${optionRows(preview.rooms, session.draft.roomId)}</select></label>
        <label><span>章节筛选</span><select class="field" data-player-preview-chapter>${optionRows(preview.chapters, session.draft.chapterId, { allLabel: "全部章节" })}</select></label>
        <dl class="writer-metadata-facts">
          <div><dt>可读分幕</dt><dd>${preview.summary.visibleSections}</dd></div>
          <div><dt>隐藏分幕</dt><dd>${preview.summary.hiddenSections}</dd></div>
          <div><dt>初始场景</dt><dd>${preview.summary.visibleScenes}</dd></div>
          <div><dt>初始线索</dt><dd>${preview.summary.visibleClues}</dd></div>
        </dl>
        <aside class="writer-player-preview-warnings">
          <strong>验证边界</strong>
          <ul>${warningRows(preview.warnings)}</ul>
        </aside>
      </aside>
      <main class="writer-player-reader" aria-label="${escapeHtml(role.name || "角色")}玩家阅读预览">
        <header class="writer-player-reader-cover">
          <div>
            <span>${escapeHtml(roomStatus)} · 初始阅读态</span>
            <h2>${escapeHtml(role.name || "未命名角色")}</h2>
            <p>${escapeHtml(role.public_profile || "尚未填写公开角色简介")}</p>
          </div>
          <b>${escapeHtml(String(role.name || "?").slice(0, 1))}</b>
        </header>
        <section class="writer-player-reader-secret">
          <p class="section-kicker">ONLY YOU KNOW</p>
          <h3>角色秘密</h3>
          <p>${escapeHtml(role.private_profile || "尚未补充角色秘密")}</p>
        </section>
        <section class="writer-player-reader-sections">
          <div class="section-head"><div><p class="section-kicker">PRIVATE SCRIPT</p><h2>当前可读剧情</h2><p>以下正文会进入该角色的 Player 阅读列表。</p></div></div>
          ${visibleSectionRows(preview.visibleSections)}
        </section>
        <details class="writer-player-preview-hidden">
          <summary>检查 ${preview.hiddenSections.length} 个未显示分幕</summary>
          <div class="writer-player-preview-hidden-list">${hiddenRows(preview.hiddenSections, "当前筛选没有隐藏分幕")}</div>
        </details>
        <div class="writer-player-preview-runtime-grid">
          ${availabilityRows("场景", preview.visibleScenes, preview.hiddenScenes)}
          ${availabilityRows("线索", preview.visibleClues, preview.hiddenClues)}
        </div>
      </main>
    </div>
  </section>`;
}
