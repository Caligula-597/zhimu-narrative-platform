/** Story-spine canvas for the Creator cockpit. Rendering only; assembly lives on the backend. */
import { escapeHtml } from "../utils/format.js";
import {
  STORY_SPINE_CORE_SECTIONS,
  isStorySpineEmpty,
  normalizeStorySpine,
  storySpineCoverage,
  storySpineDiff
} from "../../shared/story-spine.js";

const STATUS_META = Object.freeze({
  author_confirmed: { label: "作者已确认", className: "confirmed" },
  ai_draft: { label: "AI 暂拟", className: "draft" },
  unresolved: { label: "尚未解决", className: "unresolved" }
});

function statusChip(value) {
  const meta = STATUS_META[value] || STATUS_META.ai_draft;
  return `<span class="story-spine-status ${meta.className}">${meta.label}</span>`;
}

function sourceNote(refs = []) {
  return refs.length
    ? `<small>综合 ${refs.length} 项已填写材料</small>`
    : `<small>暂未绑定明确来源</small>`;
}

function storyBlock(spine, key, label, { candidate = false, wide = false } = {}) {
  const block = spine[key];
  if (!block?.text) return "";
  const canConfirm = !candidate && block.status === "ai_draft";
  return `<article class="story-spine-block ${wide ? "wide" : ""}" data-story-spine-section="${escapeHtml(key)}">
    <header><div><span>${escapeHtml(label)}</span>${sourceNote(block.sourceRefs)}</div>${statusChip(block.status)}</header>
    <p>${escapeHtml(block.text)}</p>
    ${canConfirm ? `<button type="button" class="text-btn compact" data-action="cockpit-story-spine-confirm" data-story-spine-key="${escapeHtml(key)}">确认为作者设定</button>` : ""}
  </article>`;
}

function chapterArc(spine) {
  if (!spine.chapterArc.length) return "";
  return `<section class="story-spine-section">
    <div class="story-spine-section-head"><div><p>CAUSAL ARC</p><h4>章节因果主干</h4></div><span>${spine.chapterArc.length} 章</span></div>
    <div class="story-spine-chapters">${spine.chapterArc.map((chapter) => `<article>
      <div class="story-spine-sequence">${String(chapter.sequence).padStart(2, "0")}</div>
      <div><h5>${escapeHtml(chapter.title)}</h5>
        <p><b>承接</b>${escapeHtml(chapter.cause || "尚未说明前置原因")}</p>
        <p><b>玩家行动</b>${escapeHtml(chapter.playerAction || "尚未说明")}</p>
        <p><b>转折</b>${escapeHtml(chapter.turn || "尚未说明")}</p>
        <p><b>留下的后果</b>${escapeHtml(chapter.consequence || "尚未说明")}</p>
      </div>
    </article>`).join("")}</div>
  </section>`;
}

function roleFunctions(spine) {
  if (!spine.roleFunctions.length) return "";
  return `<section class="story-spine-section">
    <div class="story-spine-section-head"><div><p>PLAYER FUNCTIONS</p><h4>角色为什么不可替代</h4></div><span>${spine.roleFunctions.length} 人</span></div>
    <div class="story-spine-role-grid">${spine.roleFunctions.map((role) => `<article>
      <header><h5>${escapeHtml(role.roleName)}</h5>${statusChip(role.status)}</header>
      <p><b>故事作用</b>${escapeHtml(role.storyFunction || "尚未说明")}</p>
      <p><b>主动目标</b>${escapeHtml(role.goal || "尚未说明")}</p>
      <p><b>行动压力</b>${escapeHtml(role.pressure || "尚未说明")}</p>
    </article>`).join("")}</div>
  </section>`;
}

function endings(spine) {
  if (!spine.endingDirections.length) return "";
  return `<section class="story-spine-section">
    <div class="story-spine-section-head"><div><p>ENDING DIRECTIONS</p><h4>早期选择如何抵达结局</h4></div><span>${spine.endingDirections.length} 条</span></div>
    <div class="story-spine-ending-grid">${spine.endingDirections.map((ending) => `<article>
      <header><h5>${escapeHtml(ending.title)}</h5>${statusChip(ending.status)}</header>
      <p><b>形成条件</b>${escapeHtml(ending.requirements || "尚未说明")}</p>
      <p><b>最终代价</b>${escapeHtml(ending.consequence || "尚未说明")}</p>
    </article>`).join("")}</div>
  </section>`;
}

function openIssues(spine) {
  const questions = spine.unresolvedQuestions || [];
  const assumptions = spine.assumptions || [];
  if (!questions.length && !assumptions.length) return "";
  return `<section class="story-spine-section story-spine-open-issues">
    <div class="story-spine-section-head"><div><p>AUTHOR DECISIONS</p><h4>仍需作者决定</h4></div><span>${questions.length + assumptions.length} 项</span></div>
    <div class="story-spine-issue-grid">
      ${questions.map((item) => `<article class="question"><span>待决定</span><h5>${escapeHtml(item.question)}</h5><p>${escapeHtml(item.whyItMatters)}</p></article>`).join("")}
      ${assumptions.map((item) => `<article class="assumption"><span>暂定假设</span><h5>${escapeHtml(item.text)}</h5><p>${escapeHtml(item.impact)}</p></article>`).join("")}
    </div>
  </section>`;
}

function generatedAtLabel(spine) {
  const raw = spine.provenance?.generatedAt;
  if (!raw) return "尚未记录生成时间";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString("zh-CN", { hour12: false });
}

function spineBody(spine, { candidate = false } = {}) {
  const coverage = storySpineCoverage(spine);
  return `<div class="story-spine-document ${candidate ? "candidate" : "current"}">
    <div class="story-spine-document-head">
      <div><p>${candidate ? "ASSEMBLY CANDIDATE" : "LIVING STORY OVERVIEW"}</p><h3>${escapeHtml(spine.title || "当前故事主干")}</h3>
        <span>${candidate ? "尚未写入项目" : generatedAtLabel(spine)} · 主干覆盖 ${coverage.score}%</span></div>
      <div class="story-spine-legend"><span>${coverage.confirmed} 项作者确认</span><span>${coverage.draft} 项 AI 暂拟</span><span>${coverage.unresolved} 项待决定</span></div>
    </div>
    <div class="story-spine-downstream" aria-label="故事主干后续用途">
      <article><span>01</span><div><b>角色创作</b><small>读取玩家前提与角色作用，避免只生成六份人物档案。</small></div></article>
      <article><span>02</span><div><b>章节编排</b><small>读取章节因果主干，让上一章结果成为下一章条件。</small></div></article>
      <article><span>03</span><div><b>机制与流程</b><small>读取反复行动、反馈和代价，继续设计可玩的章节机制。</small></div></article>
      <article><span>04</span><div><b>文稿生产</b><small>读取整体故事、真相与结局方向，减少各模块互相跑偏。</small></div></article>
    </div>
    <div class="story-spine-core-grid">
      ${storyBlock(spine, "logline", "一句话故事", { candidate, wide: true })}
      ${storyBlock(spine, "overview", "整体故事", { candidate, wide: true })}
      ${STORY_SPINE_CORE_SECTIONS.filter(([key]) => !["logline", "overview"].includes(key))
        .map(([key, label]) => storyBlock(spine, key, label, { candidate })).join("")}
    </div>
    ${chapterArc(spine)}
    ${roleFunctions(spine)}
    ${endings(spine)}
    ${openIssues(spine)}
  </div>`;
}

function emptyStorySpine(ctx, configured) {
  const counts = ctx.counts || {};
  const summary = String(ctx.studio?.world?.summary || ctx.draft?.logline || "").trim();
  const materialCount = [
    summary ? 1 : 0,
    (ctx.draft?.sparks || []).length,
    ctx.truthClaims?.length || 0,
    ctx.relationships?.length || 0,
    counts.roles || 0,
    counts.chapters || 0
  ].reduce((sum, value) => sum + Number(value || 0), 0);
  return `<section class="story-spine-empty">
    <div><p class="section-kicker">STORY ASSEMBLY</p><h3>把已经填写的材料组成一部能读懂的故事</h3>
      <p>系统会综合世界简介、灵感、创作宪法、角色、关系、核心事实与章节，先形成故事主干；缺失部分会标成暂定假设，不会冒充作者设定。</p></div>
    <div class="story-spine-material-count"><strong>${materialCount}</strong><span>项现有材料可参与装配</span></div>
    ${configured ? `<button type="button" class="primary-btn" data-action="cockpit-story-spine-assemble">组装第一版故事</button>` : ""}
  </section>`;
}

function candidateHeader(current, candidate) {
  const diff = storySpineDiff(current, candidate);
  const changeLabels = diff.changedSections.map((item) => item.label);
  return `<div class="story-spine-candidate-bar">
    <div><span>候选版本</span><strong>${changeLabels.length ? `更新 ${changeLabels.length} 个主干区块` : "已保留全部作者确认区块"}</strong>
      <small>${changeLabels.length ? `变化：${escapeHtml(changeLabels.join("、"))}` : "可继续检查章节、角色和结局变化"}</small></div>
    <div class="row"><button type="button" class="secondary-btn" data-action="cockpit-story-spine-discard">放弃候选</button>
      <button type="button" class="primary-btn" data-action="cockpit-story-spine-adopt">采用为当前故事总览</button></div>
  </div>`;
}

export function renderStorySpinePanel(ctx, cockpit) {
  const current = normalizeStorySpine(ctx.studio?.world?.settings?.storySpine);
  const candidate = cockpit.storySpineCandidate
    ? normalizeStorySpine(cockpit.storySpineCandidate)
    : null;
  const configured = Boolean(ctx.storySpineLlmStatus?.configured);
  const assembling = Boolean(cockpit.storySpineAssembling);

  if (assembling) {
    return `<section class="cockpit-panel story-spine-panel"><div class="story-spine-loading"><span></span><div><p class="section-kicker">STORY ASSEMBLY</p><h3>正在组装整体故事</h3><p>后端正在读取当前项目材料。结果只会成为候选版本，不会覆盖作者已经确认的内容。</p></div></div></section>`;
  }

  if (candidate) {
    return `<section class="cockpit-panel story-spine-panel">${candidateHeader(current, candidate)}${spineBody(candidate, { candidate: true })}</section>`;
  }

  if (isStorySpineEmpty(current)) {
    return `<section class="cockpit-panel story-spine-panel">${emptyStorySpine(ctx, configured)}</section>`;
  }

  return `<section class="cockpit-panel story-spine-panel">
    <div class="story-spine-toolbar"><div><p class="section-kicker">STORY OVERVIEW</p><h3>当前故事总览</h3><span>修改项目材料后，可重新装配候选版本并比较变化。</span></div>
      ${configured ? `<button type="button" class="secondary-btn" data-action="cockpit-story-spine-assemble">重新组装候选</button>` : ""}</div>
    ${spineBody(current)}
  </section>`;
}
