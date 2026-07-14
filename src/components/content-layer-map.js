/**
 * Fixed content-hierarchy explainer for first-time creators.
 * Layers are not duplicates — each feeds the next toward hostable play.
 */

const LAYERS = [
  { key: "manuscript", title: "母稿", text: "完整叙事原文，创作者总览" },
  { key: "chapter", title: "章节", text: "公共剧情阶段与解锁节奏" },
  { key: "section", title: "私人分幕", text: "发给单个玩家阅读的正文" },
  { key: "studio", title: "Studio 节点", text: "场景、线索、物品、调查点" },
  { key: "segment", title: "Segment", text: "聚合为一幕可主持流程" },
  { key: "rule", title: "Rule", text: "定义本幕如何自动推进" }
];

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Compact horizontal map; open=false collapses details by default. */
export function contentLayerMapHtml({ open = false } = {}) {
  const steps = LAYERS.map(
    (layer, index) => `
    <li class="content-layer-step" data-layer="${escapeHtml(layer.key)}">
      <span class="content-layer-index">${index + 1}</span>
      <strong>${escapeHtml(layer.title)}</strong>
      <small>${escapeHtml(layer.text)}</small>
    </li>`
  ).join("");
  return `<details class="content-layer-map card" ${open ? "open" : ""}>
    <summary>
      <span class="section-kicker">CONTENT LAYERS</span>
      <strong>内容层级</strong>
      <span class="content-layer-summary-hint">母稿 → 章节 → 私人分幕 → Studio → Segment → Rule（不是重复数据）</span>
    </summary>
    <p class="content-layer-lede">它们是上下游，不是多套真相。日常写本走驾驶舱六阶段；需要啃某一层时再进对应精细编辑器。</p>
    <ol class="content-layer-steps">${steps}</ol>
  </details>`;
}
