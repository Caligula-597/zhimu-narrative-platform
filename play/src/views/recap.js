import { escapeHtml } from "../security.js";
import { formatTime } from "../utils/format.js";
import { state } from "../state.js";

function recapSection(title, body) {
  return `<section class="recap-section card-soft"><h4>${title}</h4>${body}</section>`;
}

function renderBeatRow(event) {
  return `<div class="recap-timeline-row">
    <time>${formatTime(event.at)}</time>
    <p>${escapeHtml(event.label || event.message || event.title || "")}</p>
  </div>`;
}

function renderPlotSpineNode(node) {
  const labels = {
    chapter_intro: "章节",
    scene_public: "场景",
    host_revelation: "揭示",
    clue_truth: "线索真相",
    runtime: "推进"
  };
  const tag = labels[node.kind] || "节点";
  const title = node.title ? `<strong>${escapeHtml(node.title)}</strong>` : "";
  const excerpt = node.excerpt ? `<p class="recap-spine-excerpt">${escapeHtml(node.excerpt)}</p>` : "";
  const time = node.at ? `<time>${formatTime(node.at)}</time>` : "";
  if (node.kind === "runtime" && node.beat) {
    return renderBeatRow(node.beat);
  }
  return `<div class="recap-spine-node recap-spine-${node.kind}">
    <div class="recap-spine-meta"><span class="recap-spine-tag">${tag}</span>${time}</div>
    ${title}${excerpt}
  </div>`;
}

function renderRevelationTrack(track) {
  if (!track?.length) return "";
  return recapSection(
    "真相揭示顺序",
    `<div class="recap-revelation-track">${track
      .map(
        (row) => `<article class="recap-revelation-item">
          <div class="recap-spine-meta"><span class="recap-spine-tag">${escapeHtml(row.kind === "clue_revelation" ? "线索" : row.kind === "rule_revelation" ? "规则" : "主持")}</span><time>${formatTime(row.at)}</time></div>
          <strong>${escapeHtml(row.title || "")}</strong>
          ${row.excerpt ? `<p class="recap-spine-excerpt">${escapeHtml(row.excerpt)}</p>` : ""}
        </article>`
      )
      .join("")}</div>`
  );
}

function renderStoryNarrative(storyNarrative) {
  if (!storyNarrative) return "";
  const opening = storyNarrative.opening ?? {};
  const chapters = storyNarrative.chapters ?? [];
  const epilogue = storyNarrative.epilogue ?? {};
  const castHtml = (opening.cast ?? []).length
    ? `<ul class="recap-cast">${(opening.cast ?? [])
        .map(
          (row) =>
            `<li><strong>${escapeHtml(row.roleName)}</strong>${row.playerDisplayName ? ` · ${escapeHtml(row.playerDisplayName)}` : ""}</li>`
        )
        .join("")}</ul>`
    : `<p class="muted">尚无玩家入席记录。</p>`;

  const chapterHtml = chapters.length
    ? chapters
        .map(
          (chapter) => `
        <article class="recap-chapter-act">
          <div class="recap-chapter-head">
            <strong>第 ${chapter.sequence} 章 · ${escapeHtml(chapter.title)}</strong>
            <p class="recap-chapter-synopsis">${escapeHtml(chapter.synopsis || chapter.narrativeLine || chapter.summary || "")}</p>
          </div>
          ${
            chapter.plotSpine?.length
              ? `<div class="recap-plot-spine">${chapter.plotSpine.map(renderPlotSpineNode).join("")}</div>`
              : chapter.beats?.length
                ? `<div class="recap-timeline">${chapter.beats.map(renderBeatRow).join("")}</div>`
                : `<p class="muted">本章暂无推进记录。</p>`
          }
        </article>`
        )
        .join("")
    : `<p class="muted">剧本尚未配置章节，时间线见下方完整日志。</p>`;

  const epilogueBeats = epilogue.beats?.length
    ? `<div class="recap-timeline">${epilogue.beats.map(renderBeatRow).join("")}</div>`
    : "";
  const undiscovered = (epilogue.undiscoveredClues ?? []).length
    ? `<p class="muted" style="margin-top:10px">仍有 ${epilogue.undiscoveredClues.length} 条世界线索未被任何角色获得。</p>`
    : "";

  return `${renderRevelationTrack(storyNarrative.revelationTrack)}${recapSection(
    "全剧脉络 · 上帝视角",
    `<div class="recap-narrative-opening">
      <p class="recap-lede">${escapeHtml(opening.summary || "")}</p>
      ${castHtml}
    </div>
    <div class="recap-chapter-stack">${chapterHtml}</div>
    <article class="recap-chapter-act recap-epilogue">
      <div class="recap-chapter-head"><strong>${escapeHtml(epilogue.title || "结局与余波")}</strong><span class="muted">${escapeHtml(epilogue.summary || "")}</span></div>
      ${epilogueBeats}${undiscovered}
    </article>`
  )}`;
}

function renderRolePerformances(rolePerformances, highlightRoleSlotId) {
  if (!rolePerformances?.length) return "";
  const cards = rolePerformances
    .map((role) => {
      const isSelf = highlightRoleSlotId && role.roleSlotId === highlightRoleSlotId;
      const badges = (role.badges ?? [])
        .map((badge) => `<span class="recap-chip recap-badge">${escapeHtml(badge)}</span>`)
        .join("");
      const highlights = (role.highlights ?? []).length
        ? `<ul class="recap-highlights">${role.highlights.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
        : "";
      const chapterMoments = (role.chapterMoments ?? []).length
        ? `<div class="recap-chapter-moments">${role.chapterMoments
            .map(
              (chapter) => `<div class="recap-chapter-moment"><strong>${escapeHtml(chapter.title || `第${chapter.sequence}章`)}</strong><ul>${chapter.moments.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul></div>`
            )
            .join("")}</div>`
        : "";
      return `<article class="recap-performance-card${isSelf ? " is-self" : ""}">
        <header>
          <strong>${escapeHtml(role.roleName)}</strong>
          ${isSelf ? `<span class="recap-self-badge">你</span>` : ""}
          <span class="muted">${escapeHtml(role.playerDisplayName || (role.joined ? "玩家" : "空席"))}</span>
        </header>
        ${role.narrativeSummary ? `<p class="recap-role-summary">${escapeHtml(role.narrativeSummary)}</p>` : ""}
        <div class="recap-performance-stats">
          <span>阅读 ${role.stats?.completedSections ?? 0}/${role.stats?.totalSections ?? 0}</span>
          <span>线索 ${role.stats?.ownedClues ?? 0}（已读 ${role.stats?.readClues ?? 0}）</span>
          <span>调查 ${role.stats?.investigations ?? 0}</span>
          <span>笔记 ${role.stats?.notes ?? 0}</span>
        </div>
        ${badges ? `<div class="recap-chip-row">${badges}</div>` : ""}
        ${chapterMoments}
        ${highlights}
      </article>`;
    })
    .join("");
  return recapSection("角色表现对照", `<div class="recap-performance-grid">${cards}</div>`);
}

function renderLegacyTimeline(snapshot) {
  const events = snapshot.keyTimeline || [];
  if (!events.length) return "";
  return recapSection(
    "完整时间线",
    `<div class="recap-timeline">${events.map(renderBeatRow).join("")}</div>`
  );
}

function renderPersonalNotes(snapshot) {
  const notes = snapshot.personalNotes ?? snapshot.notes ?? [];
  if (!notes.length) return "";
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
    return `<div class="empty enriched-empty"><span class="empty-icon">📜</span>主持人尚未生成本房间的复盘报告。局结束后请让主持人在创作者端「存档与复盘」生成，你即可在此查看<strong>全剧脉络与各角色表现</strong>。</div>`;
  }
  if (!state.recapDetail || state.recapDetail.id !== latest.id) {
    return `
      <article class="card recap-card">
        <p class="eyebrow">局后复盘</p>
        <h3>${escapeHtml(latest.label)}</h3>
        <p class="muted">${escapeHtml(latest.description || "无备注")} · 生成于 ${formatTime(latest.created_at)} · ${escapeHtml(latest.created_by_name || "主持人")}</p>
        <dl class="entry-meta recap-meta">
          <div><dt>入席角色</dt><dd>${latest.summary?.joinedPlayers ?? 0}</dd></div>
          <div><dt>线索流转</dt><dd>${latest.summary?.cluesDiscovered ?? 0}</dd></div>
          <div><dt>调查完成</dt><dd>${latest.summary?.investigationsCompleted ?? 0}</dd></div>
        </dl>
        <button class="btn primary" type="button" data-action="open-recap-detail">查看完整复盘</button>
      </article>`;
  }

  const snapshot = state.recapDetail.snapshot || {};
  const highlightRoleSlotId = snapshot.highlightRoleSlotId || snapshot.roleSlotId || null;
  const storyBlock = snapshot.storyNarrative
    ? renderStoryNarrative(snapshot.storyNarrative)
    : renderLegacyTimeline(snapshot);
  const performanceBlock = renderRolePerformances(snapshot.rolePerformances, highlightRoleSlotId);
  const notesBlock = renderPersonalNotes(snapshot);

  return `
    <article class="card recap-detail">
      <header class="recap-detail-head">
        <div>
          <p class="eyebrow">局后复盘 · 上帝视角</p>
          <h3>${escapeHtml(state.recapDetail.label)}</h3>
          <p class="muted">${escapeHtml(state.recapDetail.description || "")} · ${formatTime(state.recapDetail.created_at)}</p>
        </div>
        <button class="btn quiet" type="button" data-action="close-recap-detail">返回摘要</button>
      </header>
      ${storyBlock}
      ${performanceBlock}
      ${notesBlock}
      <p class="hint">按章节串联剧情骨架与真相揭示，并对照各角色阅读、线索、调查与笔记表现；内容来自本局日志与世界公开/主持文本。</p>
    </article>`;
}
