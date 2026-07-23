import { renderWorkspaceEditor } from "../components/workspace-editor.js";
import { escapeHtml, formatTime } from "../utils/format.js";
import {
  DOMAIN_LABELS,
  KIND_LABELS,
  MAX_REVIEW_BODY_LENGTH,
  MAX_REVIEW_TITLE_LENGTH,
  MAX_SUGGESTED_PATCH_BYTES,
  MAX_SUGGESTED_PATCH_PROPERTIES,
  SEVERITY_LABELS,
  STATUS_LABELS,
  TARGET_TYPE_LABELS,
  canResolveReviews,
  reviewImpactText,
  targetKey
} from "./writer-review-model.js";
import {
  writerToolContextPanelHtml,
  writerToolFactsHtml,
  writerToolGuidanceHtml,
  writerToolSurfaceHtml
} from "./writer-tool-layout.js";

function targetOptionsHtml(groups, selectedKey) {
  return groups
    .filter((group) => group.rows.length)
    .map((group) => `<optgroup label="${escapeHtml(group.label)}">${group.rows.map((row) => {
      const value = targetKey(group.type, row.id);
      return `<option value="${escapeHtml(value)}"${value === selectedKey ? " selected" : ""}>${escapeHtml(row.label)}</option>`;
    }).join("")}</optgroup>`)
    .join("");
}

function repliesByParent(reviews) {
  const result = new Map();
  for (const review of reviews.filter((item) => item.parent_id)) {
    if (!result.has(review.parent_id)) result.set(review.parent_id, []);
    result.get(review.parent_id).push(review);
  }
  return result;
}

function reviewThreadRowsHtml(session, canResolve) {
  if (session.listLoading) {
    return `<div class="writer-review-loading"><strong>正在读取审稿意见…</strong><p>筛选变化不会丢失右侧尚未提交的草稿。</p></div>`;
  }
  if (session.listError) {
    return `<div class="writer-review-loading error"><strong>意见列表加载失败</strong><p>${escapeHtml(session.listError)}</p><button type="button" class="secondary-btn" data-action="writer-review-refresh">重新加载</button></div>`;
  }
  const replies = repliesByParent(session.reviews);
  const roots = session.reviews.filter((item) => !item.parent_id);
  if (!roots.length) {
    return `<div class="empty-state">当前筛选下还没有审稿意见。可以在右侧针对剧本、角色、章节或具体内容提交第一条意见。</div>`;
  }
  return roots.map((review) => {
    const reviewId = String(review.id || "");
    const pendingReply = session.pendingActions.has(`reply:${reviewId}`);
    const pendingStatus = session.pendingActions.has(`status:${reviewId}`);
    const replyRows = (replies.get(reviewId) || []).map((reply) => `
      <div class="writer-review-reply">
        <div><b>${escapeHtml(reply.created_by_name || "协作者")}</b><span>${escapeHtml(formatTime(reply.created_at))}</span></div>
        <p>${escapeHtml(reply.body || "")}</p>
      </div>`).join("");
    const statusActions = canResolve
      ? review.status === "open"
        ? `<button type="button" class="text-btn" data-action="writer-review-status" data-review-id="${escapeHtml(reviewId)}" data-review-status="resolved"${pendingStatus ? " disabled" : ""}>标记解决</button>
           <button type="button" class="text-btn danger-text" data-action="writer-review-status" data-review-id="${escapeHtml(reviewId)}" data-review-status="dismissed"${pendingStatus ? " disabled" : ""}>驳回</button>`
        : `<button type="button" class="text-btn" data-action="writer-review-status" data-review-id="${escapeHtml(reviewId)}" data-review-status="open"${pendingStatus ? " disabled" : ""}>重新打开</button>`
      : "";
    const suggestion = review.suggested_patch && Object.keys(review.suggested_patch).length
      ? `<details class="writer-review-suggestion"><summary>结构化修改建议</summary><pre>${escapeHtml(JSON.stringify(review.suggested_patch, null, 2))}</pre></details>`
      : "";
    const threadError = session.threadErrors[reviewId]
      ? `<div class="workspace-editor-errors show" role="alert">${escapeHtml(session.threadErrors[reviewId])}</div>`
      : "";
    const statusClass = review.status === "open" ? "testing" : review.status === "dismissed" ? "draft" : "published";
    return `<article class="writer-review-thread" aria-busy="${pendingReply || pendingStatus ? "true" : "false"}">
      <div class="section-head">
        <div>
          <p class="section-kicker">${escapeHtml(review.target_label || TARGET_TYPE_LABELS[review.target_type] || review.target_type)} · ${escapeHtml(SEVERITY_LABELS[review.severity] || review.severity)}</p>
          <h3>${escapeHtml(review.title || "未命名审稿意见")}</h3>
        </div>
        <span class="status-chip ${statusClass}">${escapeHtml(STATUS_LABELS[review.status] || review.status)}</span>
      </div>
      <p class="writer-review-body">${escapeHtml(review.body || "")}</p>
      <div class="writer-review-meta">
        <span>${escapeHtml(review.created_by_name || "协作者")}</span>
        <span>${escapeHtml(formatTime(review.created_at))}</span>
        <span>${escapeHtml(KIND_LABELS[review.kind] || review.kind)}</span>
        <span>影响：${escapeHtml(reviewImpactText(review.impact_scope))}</span>
      </div>
      ${suggestion}
      ${replyRows ? `<div class="writer-review-replies">${replyRows}</div>` : ""}
      ${threadError}
      <label class="writer-review-reply-field">
        <span>回复讨论</span>
        <textarea class="field" rows="2" maxlength="${MAX_REVIEW_BODY_LENGTH}" data-review-reply-draft="${escapeHtml(reviewId)}" placeholder="补充讨论或确认修改结果">${escapeHtml(session.replyDrafts[reviewId] || "")}</textarea>
      </label>
      <div class="row writer-review-thread-actions">
        <button type="button" class="secondary-btn" data-action="writer-review-reply" data-review-id="${escapeHtml(reviewId)}"${pendingReply ? " disabled" : ""}>${pendingReply ? "正在发送…" : "发送回复"}</button>
        ${statusActions}
      </div>
    </article>`;
  }).join("");
}

function reviewFilterHtml(session) {
  const filterOptions = [
    ["open", "待处理"],
    ["", "全部状态"],
    ["resolved", "已解决"],
    ["dismissed", "已驳回"]
  ].map(([value, label]) => `<option value="${value}"${session.filterStatus === value ? " selected" : ""}>${label}</option>`).join("");
  const targetOptions = [
    ["", "全部对象"],
    ...Object.entries(TARGET_TYPE_LABELS).map(([value, label]) => [value, label])
  ].map(([value, label]) => `<option value="${value}"${session.filterTargetType === value ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
  return `<aside class="writer-review-filters">
    <p class="section-kicker">REVIEW QUEUE</p>
    <h2>审稿队列</h2>
    <p>意见按阻塞程度和最近讨论排序。筛选只影响列表，不会清空右侧新意见或回复草稿。</p>
    <label>处理状态
      <select class="field" data-action="writer-review-filter-status">${filterOptions}</select>
    </label>
    <label>内容类型
      <select class="field" data-action="writer-review-filter-target">${targetOptions}</select>
    </label>
    ${writerToolFactsHtml([
      { label: "当前根意见", value: session.reviews.filter((item) => !item.parent_id).length },
      { label: "回复", value: session.reviews.filter((item) => item.parent_id).length },
      { label: "筛选", value: STATUS_LABELS[session.filterStatus] || "全部" }
    ])}
    ${session.targetWarning ? writerToolGuidanceHtml({ title: "部分对象未载入", text: session.targetWarning }) : ""}
    <button type="button" class="secondary-btn full-btn" data-action="writer-review-refresh">刷新意见</button>
  </aside>`;
}

function reviewDraftEditorHtml(session) {
  const body = `<label>审稿对象
      <select class="field" data-studio-field="targetKey" data-review-draft="targetKey">${targetOptionsHtml(session.targetGroups, session.draft.targetKey)}</select>
    </label>
    <div class="writer-review-field-pair">
      <label>意见类型
        <select class="field" data-studio-field="kind" data-review-draft="kind">
          ${Object.entries(KIND_LABELS).map(([value, label]) => `<option value="${value}"${session.draft.kind === value ? " selected" : ""}>${label}</option>`).join("")}
        </select>
      </label>
      <label>严重程度
        <select class="field" data-studio-field="severity" data-review-draft="severity">
          ${Object.entries(SEVERITY_LABELS).map(([value, label]) => `<option value="${value}"${session.draft.severity === value ? " selected" : ""}>${label}</option>`).join("")}
        </select>
      </label>
    </div>
    <label>意见标题
      <input class="field" maxlength="${MAX_REVIEW_TITLE_LENGTH}" data-studio-field="title" data-review-draft="title" value="${escapeHtml(session.draft.title)}" placeholder="一句话说明需要关注的问题">
    </label>
    <label>问题、理由与验收标准
      <textarea class="field" rows="7" maxlength="${MAX_REVIEW_BODY_LENGTH}" data-studio-field="body" data-review-draft="body" placeholder="说明问题出现在哪里、为什么需要修改，以及怎样算处理完成">${escapeHtml(session.draft.body)}</textarea>
    </label>
    <label>结构化修改建议 JSON（选填）
      <textarea class="field writer-review-json" rows="5" maxlength="${MAX_SUGGESTED_PATCH_BYTES}" data-studio-field="suggestedPatch" data-review-draft="suggestedPatch" spellcheck="false" placeholder='例如：{"publicationStatus":"draft"}'>${escapeHtml(session.draft.suggestedPatch)}</textarea>
      <small>这里只记录建议，不会自动改写正文。最多 ${MAX_SUGGESTED_PATCH_PROPERTIES} 个字段、32 KiB。</small>
    </label>`;
  const status = session.createError
    ? `<strong>意见未提交</strong><p>${escapeHtml(session.createError)}</p>`
    : session.status === "loading"
      ? `<strong>正在准备审稿对象…</strong><p>角色、章节、真相和运行段落载入完成后即可提交。</p>`
      : "";
  return renderWorkspaceEditor({
    title: "新建审稿意见",
    kicker: "REVIEW NOTE",
    intro: "批注只对作者、编辑和受邀审稿人可见，不会展示给玩家。",
    body,
    submitLabel: session.savingAction === "create" ? "正在提交…" : "提交审稿意见",
    submitAction: session.status === "ready" ? "writer-review-create" : "",
    cancelAction: "writer-tool-close",
    cancelLabel: session.discardArmed ? "再次点击放弃草稿" : "返回创作中心",
    className: "writer-review-editor",
    status
  });
}

function reviewDiscussionHtml(data, session) {
  return `<div class="writer-review-grid">
    ${reviewFilterHtml(session)}
    <main class="writer-review-list" aria-live="polite">${reviewThreadRowsHtml(session, canResolveReviews(data.world))}</main>
    ${reviewDraftEditorHtml(session)}
  </div>`;
}

function versionOptionsHtml(versions, selectedId, { includeCurrent = false } = {}) {
  const current = includeCurrent ? `<option value=""${selectedId ? "" : " selected"}>当前内容</option>` : "";
  return current + versions.map((version) => `
    <option value="${escapeHtml(version.id)}"${version.id === selectedId ? " selected" : ""}>${escapeHtml(version.label || "未命名版本")} · ${escapeHtml(formatTime(version.created_at))}</option>`).join("");
}

export function creatorVersionDiffHtml(payload) {
  const comparison = payload?.comparison || {};
  const summary = comparison.summary || {};
  const added = Number(summary.added) || 0;
  const removed = Number(summary.removed) || 0;
  const changed = Number(summary.changed) || 0;
  const changedDomains = Object.entries(comparison.domains || {})
    .filter(([, value]) => {
      const counts = value?.counts || {};
      return counts.added || counts.removed || counts.changed;
    })
    .map(([key, value]) => {
      const counts = value?.counts || {};
      return `<li><strong>${escapeHtml(DOMAIN_LABELS[key] || key)}</strong><span>新增 ${Number(counts.added) || 0} · 删除 ${Number(counts.removed) || 0} · 修改 ${Number(counts.changed) || 0}${value?.truncated ? " · 仅显示前 100 项" : ""}</span></li>`;
    })
    .join("");
  const baseLabel = payload?.base?.label || "基准版本";
  const headLabel = payload?.head?.label || "当前内容";
  const changedWorldFields = Array.isArray(comparison.world?.fields) ? comparison.world.fields : [];
  return `<section class="writer-review-diff-result">
    <div class="section-head">
      <div><p class="section-kicker">VERSION DIFF</p><h3>${escapeHtml(baseLabel)} → ${escapeHtml(headLabel)}</h3></div>
      <span class="cloud-pill">${added + removed + changed} 项变化</span>
    </div>
    <div class="proposal-stats"><span>新增 ${added}</span><span>删除 ${removed}</span><span>修改 ${changed}</span></div>
    ${comparison.world?.changed ? `<p>剧本级字段：${escapeHtml(changedWorldFields.join("、"))}</p>` : ""}
    <ul class="writer-review-diff-domains">${changedDomains || "<li><strong>没有结构差异</strong><span>两个版本的受比较内容一致。</span></li>"}</ul>
    ${writerToolGuidanceHtml({
      title: "保密边界",
      text: "版本对比只展示对象和字段级变化，不直接展开角色私人正文。"
    })}
  </section>`;
}

function reviewCompareHtml(data, session) {
  const versions = data.versions || [];
  const disabled = versions.length ? "" : " disabled";
  return `<div class="writer-review-compare-grid">
    ${writerToolContextPanelHtml({
      kicker: "VERSION IMPACT",
      title: "版本影响对比",
      intro: "以保存的内容版本为基准，对比当前内容或另一个版本。结果只读，不会执行恢复。",
      facts: [
        { label: "可用版本", value: versions.length },
        { label: "基准", value: session.compareBaseId ? "已选择" : "待选择" },
        { label: "目标", value: session.compareHeadId ? "历史版本" : "当前内容" }
      ],
      bodyHtml: `<label class="writer-review-compare-field">基准版本
        <select class="field" data-review-compare-field="baseId"${disabled}>${versions.length ? versionOptionsHtml(versions, session.compareBaseId) : '<option value="">尚无版本快照</option>'}</select>
      </label>
      <label class="writer-review-compare-field">对比目标
        <select class="field" data-review-compare-field="headId"${disabled}>${versionOptionsHtml(versions, session.compareHeadId, { includeCurrent: true })}</select>
      </label>
      <button type="button" class="primary-btn full-btn" data-action="writer-review-compare"${disabled}${session.compareLoading ? " disabled" : ""}>${session.compareLoading ? "正在对比…" : "开始对比"}</button>
      ${session.compareError ? `<div class="workspace-editor-errors show" role="alert">${escapeHtml(session.compareError)}</div>` : ""}`
    })}
    <main class="writer-review-diff-panel" aria-live="polite">
      ${session.compareLoading
        ? `<div class="writer-review-loading"><strong>正在计算版本差异…</strong><p>大型剧本可能需要几秒，切换剧本后旧结果不会写回当前页面。</p></div>`
        : session.comparison
          ? creatorVersionDiffHtml(session.comparison)
          : `<div class="writer-tool-empty-preview"><strong>等待选择版本</strong><p>先选择一个基准版本，再与当前内容或另一个历史版本比较。</p></div>`}
    </main>
  </div>`;
}

function workspaceTabsHtml(session) {
  return `<div class="writer-review-tabs" role="tablist" aria-label="审稿工作区">
    <button type="button" role="tab" aria-selected="${session.mode === "threads"}" class="${session.mode === "threads" ? "active" : ""}" data-action="writer-review-mode" data-review-mode="threads">审稿意见</button>
    <button type="button" role="tab" aria-selected="${session.mode === "compare"}" class="${session.mode === "compare" ? "active" : ""}" data-action="writer-review-mode" data-review-mode="compare">版本对比</button>
  </div>`;
}

export function reviewWorkspaceHtml(data, session) {
  return writerToolSurfaceHtml({
    type: "review",
    className: "writer-review-workspace",
    bodyHtml: `<button type="button" class="workspace-back-btn" data-action="writer-tool-close">← 返回创作中心</button>
    <header class="writer-review-head">
      <div><p class="section-kicker">COLLABORATIVE REVIEW</p><h1>协作者审稿台</h1><p>在同一页面追踪意见、讨论、处理状态和版本影响，不遮挡创作上下文。</p></div>
      ${workspaceTabsHtml(session)}
    </header>
    ${session.mode === "compare" ? reviewCompareHtml(data, session) : reviewDiscussionHtml(data, session)}`
  });
}
