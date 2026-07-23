import { renderWorkspaceEditor } from "../components/workspace-editor.js";
import { escapeHtml } from "../utils/format.js";
import {
  STORY_ASSISTANT_MAX_TEXT_LENGTH,
  STORY_NODE_TYPE_DETAILS,
  storyAnalysisIsCurrent,
  storyAssistantCounts
} from "./writer-story-assistant-model.js";
import {
  writerToolContextPanelHtml,
  writerToolGridPageHtml,
  writerToolGuidanceHtml
} from "./writer-tool-layout.js";

function nodeRowsHtml(nodes = []) {
  if (!nodes.length) return `<div class="writer-story-empty"><strong>没有识别到结构节点</strong><p>建议使用“场景：”“调查点：”“线索：”作为段落开头，再重新提取。</p></div>`;
  return nodes.map((node, index) => {
    const detail = STORY_NODE_TYPE_DETAILS[node.type] || STORY_NODE_TYPE_DETAILS.scene;
    return `<article class="writer-story-node writer-story-node-${escapeHtml(node.type)}">
      <header><span>${escapeHtml(detail.short)} ${index + 1}</span><b>${escapeHtml(detail.label)}</b></header>
      <h4>${escapeHtml(node.name)}</h4>
      <p>${escapeHtml(node.text || "尚无说明")}</p>
    </article>`;
  }).join("");
}

function edgeRowsHtml(edges = [], nodes = []) {
  const names = new Map(nodes.map((node) => [node.key, node.name]));
  if (!edges.length) return `<div class="empty-state">当前没有建议连线。至少需要两个结构节点。</div>`;
  return edges.slice(0, 24).map((edge, index) => `<article class="writer-story-edge">
    <span>${index + 1}</span>
    <div><strong>${escapeHtml(names.get(edge.fromKey) || edge.fromKey)} → ${escapeHtml(names.get(edge.toKey) || edge.toKey)}</strong><p>${escapeHtml(edge.label || edge.relationType)}</p></div>
  </article>`).join("");
}

function suggestionsHtml(suggestions = []) {
  if (!suggestions.length) return "";
  return `<aside class="writer-story-suggestions"><strong>整理建议</strong><ul>${suggestions.map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`).join("")}</ul></aside>`;
}

function analysisPreviewHtml(session) {
  if (!session.analysis) {
    return `<section class="writer-story-preview writer-story-preview-empty" data-story-preview>
      <p class="section-kicker">STRUCTURE PREVIEW</p>
      <h3>等待提取</h3>
      <p>结果会先在这里按场景、调查点、线索和建议连线完整展开。只有复核后才会追加到剧情编排。</p>
    </section>`;
  }
  const current = storyAnalysisIsCurrent(session);
  const counts = storyAssistantCounts(session.analysis);
  return `<section class="writer-story-preview${current ? "" : " is-stale"}" data-story-preview>
    <header class="writer-story-preview-head">
      <div><p class="section-kicker">STRUCTURE PREVIEW</p><h3>结构提取结果</h3><p data-story-preview-state>${current ? "当前预览与输入文本一致" : "输入已修改，请重新提取后再写入"}</p></div>
      <span class="cloud-pill">${current ? "仅预览 · 尚未写入" : "预览已失效"}</span>
    </header>
    <div class="writer-story-preview-stats">
      <span><b>${counts.scenes}</b>场景</span>
      <span><b>${counts.points}</b>调查点</span>
      <span><b>${counts.clues}</b>线索</span>
      <span><b>${counts.edges}</b>建议连线</span>
    </div>
    <div class="writer-story-node-grid">${nodeRowsHtml(session.analysis.nodes)}</div>
    <details class="writer-story-edges"${counts.edges <= 8 ? " open" : ""}>
      <summary>查看 ${counts.edges} 条建议连线</summary>
      <div>${edgeRowsHtml(session.analysis.edges, session.analysis.nodes)}</div>
    </details>
    ${suggestionsHtml(session.analysis.suggestions)}
  </section>`;
}

function storyContextHtml(data, session) {
  const counts = storyAssistantCounts(session.analysis);
  const current = storyAnalysisIsCurrent(session);
  return writerToolContextPanelHtml({
    kicker: "NARRATIVE STRUCTURE",
    title: "剧情结构提取",
    intro: "把散文式剧情拆成可继续编辑的场景、调查点、线索和关系建议。它是结构整理器，不是自动化规则生成器。",
    facts: [
      { label: "文本字符", value: String(session.draft.text || "").length, hook: "story-character-count" },
      { label: "识别节点", value: counts.total },
      { label: "预览状态", value: session.analysis ? (current ? "可复核" : "已失效") : "待提取" }
    ],
    bodyHtml: `${writerToolGuidanceHtml({
      title: "写入边界",
      text: "确认后只会追加场景、调查点、线索和剧情连线，不会创建章节、角色、私人分幕或自动化规则，也不会覆盖已有节点。"
    })}
    ${writerToolGuidanceHtml({
      title: "当前剧本",
      text: `${data?.world?.name || "未命名剧本"}。所有请求固定绑定打开工作区时的 worldId，切换剧本后旧响应不会写回新页面。`
    })}`,
    className: "writer-story-context"
  });
}

function storyEditorHtml(session) {
  const counts = storyAssistantCounts(session.analysis);
  const current = storyAnalysisIsCurrent(session);
  const canImport = current && counts.total > 0;
  const body = `<div class="writer-story-source">
    <div class="writer-story-format-guide">
      <strong>推荐分段</strong>
      <span>场景：旧灯塔……</span><span>调查点：检查锁孔……</span><span>线索：蓝色火漆碎片……</span>
    </div>
    <label class="workspace-longform-field">
      <span>待整理剧情文本</span>
      <textarea class="writer-story-source-text" data-story-source maxlength="${STORY_ASSISTANT_MAX_TEXT_LENGTH}" rows="18" placeholder="粘贴剧情梗概、母稿片段或搜证流程。每段用空行分隔；加上“场景：”“调查点：”“线索：”前缀会更准确。">${escapeHtml(session.draft.text || "")}</textarea>
      <small><span data-story-source-count>${String(session.draft.text || "").length}</span> / ${STORY_ASSISTANT_MAX_TEXT_LENGTH.toLocaleString("zh-CN")} 字符 · 文本只在确认写入后生成图谱节点。</small>
    </label>
    <div class="writer-story-inline-actions">
      <button type="button" class="secondary-btn" data-action="writer-story-analyze"${session.savingAction ? " disabled" : ""}>${session.savingAction === "analyze" ? "正在提取…" : "提取结构并生成预览"}</button>
    </div>
    ${analysisPreviewHtml(session)}
  </div>`;
  const status = session.error
    ? `<strong>操作未完成</strong><p>${escapeHtml(session.error)}</p>`
    : session.savingAction === "analyze"
      ? `<strong>正在分析文本</strong><p>完成前会锁定输入，避免结果与当前文本错位。</p>`
      : session.savingAction === "import"
        ? `<strong>正在写入剧情编排</strong><p>请勿关闭页面或重复提交。</p>`
        : "";
  return renderWorkspaceEditor({
    title: "结构提取与写入",
    kicker: "PASTE · EXTRACT · REVIEW · COMMIT",
    intro: "文本变化会立即使旧预览失效；重新提取并复核后才能写入。",
    body,
    submitLabel: session.importArmed ? `再次点击：追加 ${counts.total} 个节点` : "确认追加到剧情编排",
    submitAction: canImport ? "writer-story-import" : "",
    cancelAction: "writer-tool-close",
    cancelLabel: session.discardArmed ? "再次点击放弃文本" : "返回创作中心",
    className: "writer-story-editor",
    status
  });
}

export function storyAssistantWorkspaceHtml(data, session) {
  return writerToolGridPageHtml({
    type: "story-assistant",
    className: "writer-story-workspace",
    wide: true,
    contextHtml: storyContextHtml(data, session),
    contentHtml: storyEditorHtml(session)
  });
}
