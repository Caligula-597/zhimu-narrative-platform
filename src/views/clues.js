/* Clue management — list, search, edit without opening the full studio canvas. */
import { registerView } from "../runtime/view-registry.js";
import { studioStore, uiStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as U from "../components/emptyState.js";
import * as S from "../components/ui-semantics.js";
import {
  clueActBadge, clueAuditCards, clueDependencyEdges,
  clueDetailPanel, clueGraph, clueKindBadge, clueTimeline, clueVisibilityChip,
  highlightQuery, linkedPoints
} from "./clue-flow-view.js";
import { batchDeleteClues, confirmDeleteClue } from "./clues-crud-controller.js";
import { openClueInStudio, openCluesEditor } from "./clues-editor.js";
import { loadClueHitRate, renderClueHitRatePanel } from "./clues-hit-rate.js";
import {
  adjustClueFlowZoom, bindCluesSearch, closeClueDetail, selectClue,
  fitClueFlow, focusSelectedClue, setClueDetailTab, setClueFlowFilter,
  syncCluesSelectAll, toggleCluesSelection
} from "./clues-interactions.js";
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const catalogExperienceBanner = U.catalogExperienceBanner || (() => "");

  function cluePointCount(clueId, data) {
    return (data.investigationPoints || []).filter((point) => point.clue_id === clueId).length;
  }

  export function clues() {
    const data = studioStore.get().cloudStudio;
    const ui = uiStore.get();
    if (!data) {
      return U.creatorWorkspaceEmpty?.({
        title: "线索管理",
        kicker: "CLUE LIBRARY",
        intro: "集中浏览与编辑当前世界的全部线索，无需打开剧情编排画布。",
        guideTitle: "线索库会提供什么",
        guideItems: [
          { label: "列表", title: "全量线索一览", text: "按名称搜索、查看可见性与关联调查点。", bullets: ["快速 PATCH 正文与主持提示", "一键跳转到编排图谱"] }
        ]
      }) || `<section class="card"><h3>尚未选择剧本</h3><p><button class="primary-btn" data-action="open-catalog">浏览公开剧本库</button></p></section>`;
    }
    const q = ui.cluesSearchQuery || "";
    let list = data.clues || [];
    const dependencyRefs = clueDependencyEdges(data);
    if (q) {
      const lower = q.toLowerCase();
      list = list.filter(
        (clue) =>
          clue.name.toLowerCase().includes(lower) ||
          String(clue.public_text || "").toLowerCase().includes(lower) ||
          String(clue.host_text || "").toLowerCase().includes(lower)
      );
    }
    const flowFilter = ui.clueFlowFilter || "all";
    if (flowFilter === "linked") {
      list = list.filter((clue) => linkedPoints(clue.id, data).length || dependencyRefs.some((edge) => edge.from === clue.id || edge.to === clue.id));
    } else if (flowFilter === "incomplete") {
      list = list.filter((clue) => !String(clue.public_text || "").trim() || (!linkedPoints(clue.id, data).length && !dependencyRefs.some((edge) => edge.from === clue.id || edge.to === clue.id)));
    }
    const bulkSelected = new Set(ui.cluesBulkSelection || []);
    const visibleIds = list.map((clue) => clue.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => bulkSelected.has(id));
    const selectedId = ui.cluesSelectedId || "";
    const selectedClue = selectedId ? (data.clues || []).find((clue) => clue.id === selectedId) || null : null;
    const bulkToolbar = list.length
      ? `<div class="row clues-bulk-toolbar"><label class="check-label"><input type="checkbox" data-action="clues-select-all" ${allVisibleSelected ? "checked" : ""}><span>全选当前列表 (${list.length})</span></label><button class="danger-btn" data-action="clues-batch-delete" ${bulkSelected.size ? "" : "disabled"}>删除所选 (${bulkSelected.size || 0})</button></div>`
      : "";
    return `${catalogExperienceBanner(data.world)}<section class="clues-page ${escapeHtml(S.surface?.("creator")?.className || "")}"><div class="section-head"><div><p class="section-kicker">CLUE LIBRARY</p><h2>线索管理</h2><p>共 ${data.clues.length} 条线索 · 勾选后可批量删除测试线索</p></div><div class="row"><button class="secondary-btn" data-go="studio">打开编排图谱</button><button class="primary-btn" data-action="clues-add">＋ 新建线索</button></div></div>
    ${renderClueHitRatePanel()}
    <div class="clues-command-row">
      <div class="search-box clues-search"><span>⌕</span><input id="clues-search-input" class="field" placeholder="搜索线索名称或正文…" value="${escapeHtml(q)}"></div>
      ${bulkToolbar}
    </div>
    ${list.length ? `<div class="clue-workbench${selectedClue ? "" : " no-detail"}">
      <main class="clue-workbench-main">
        ${clueGraph(list, data, q)}
        ${clueTimeline(data)}
        ${clueAuditCards(list, data)}
        <details class="clues-list-drawer">
          <summary>列表管理 · ${list.length} 条线索</summary>
          <div class="clues-table">${list
      .map((clue) => {
        const points = cluePointCount(clue.id, data);
        const selected = selectedId === clue.id ? " clues-row-selected search-highlight" : "";
        const checked = bulkSelected.has(clue.id) ? " checked" : "";
        return `<article class="clues-row${selected}" data-clue-row="${clue.id}"><label class="clues-row-select check-label"><input type="checkbox" data-action="clues-toggle-select" data-clue="${clue.id}"${checked}></label><div class="clues-row-main"><div class="clues-row-head"><strong>${highlightQuery(clue.name, q)}</strong>${clueKindBadge(clue)}${clueActBadge(clue)}${clueVisibilityChip(clue)}${points ? `<span class="cloud-pill">${points} 个调查点</span>` : ""}</div><p>${highlightQuery((clue.public_text || "").slice(0, 160), q)}${(clue.public_text || "").length > 160 ? "…" : ""}</p></div><div class="row clues-row-actions"><button class="text-btn" data-action="clues-edit" data-clue="${clue.id}">编辑</button><button class="text-btn" data-action="clues-open-studio" data-clue="${clue.id}">在图谱中定位</button><button class="text-btn danger-text" data-action="clues-delete" data-clue="${clue.id}">删除</button></div></article>`;
      })
      .join("")}</div></details>
      </main>
      ${selectedClue ? clueDetailPanel(selectedClue, data) : ""}
    </div>` : (q ? `<div class="empty-state">没有匹配「${escapeHtml(q)}」的线索。</div>` : `<div class="empty-state enriched-empty"><p><strong>尚未创建线索</strong></p><p>线索是玩家调查与规则推进的核心。空列表不代表功能未完成——可在编排图谱批量创建，或在此快速新建。</p><ul class="empty-hints"><li>编排台：筛选「线索」节点 → 拖拽创建并连线到场景/调查点</li><li>调查点完成可自动发放线索；规则页可配置「拥有线索 → 开放场景」</li></ul><div class="row"><button class="primary-btn" data-action="clues-add">＋ 新建线索</button><button class="secondary-btn" data-go="studio">打开编排图谱</button><button class="text-btn" data-action="open-creator-guide">阅读线索说明</button></div></div>`)}
    </section>`;
  }



export const cluesViewApi = { clues, selectClue, closeClueDetail, setClueFlowFilter, setClueDetailTab, adjustClueFlowZoom, fitClueFlow, focusSelectedClue, bindCluesSearch, openClueInStudio, openCluesEditor, confirmDeleteClue, batchDeleteClues, toggleCluesSelection, syncCluesSelectAll, loadClueHitRate };
registerView("clues", cluesViewApi);
