import { assetStore, uiStore, worldStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as S from "../components/ui-semantics.js";
import {
  CLUE_IMPORTANCE_LABELS, CLUE_KIND_LABELS, CLUE_TYPE_LABELS,
  VISIBILITY_LABELS, clueMetaLabel, grantModeLabel, relationLabel
} from "./clues-catalog.js";
import { renderClueImageSlot } from "./clue-image-slot.js";

const escapeHtml = F.escapeHtml || ((value = "") => String(value));

export function highlightQuery(text, query) {
    const clean = String(text || "");
    if (!query) return escapeHtml(clean);
    const idx = clean.toLowerCase().indexOf(String(query).toLowerCase());
    if (idx < 0) return escapeHtml(clean);
    return `${escapeHtml(clean.slice(0, idx))}<mark class="search-mark">${escapeHtml(clean.slice(idx, idx + query.length))}</mark>${escapeHtml(clean.slice(idx + query.length))}`;
  }

  export function clueActBadge(clue) {
    const meta = clue?.metadata || {};
    const actKey = meta.actKey || meta.matrixActKey;
    const seq = meta.actSequence || meta.unlockOrder;
    if (!actKey && !seq) return "";
    return `<span class="cloud-pill">${seq ? `第 ${seq} 幕` : ""}${actKey ? ` · ${escapeHtml(actKey)}` : ""}</span>`;
  }

  function clueGrantModeBadge(clue) {
    const mode = clue?.metadata?.grantMode;
    if (!mode || mode === "auto") return "";
    return `<span class="cloud-pill">${escapeHtml(grantModeLabel(mode))}</span>`;
  }

  function clueSceneLabel(clue, data) {
    const meta = clue?.metadata || {};
    const sceneKey = meta.matrixSceneKey;
    if (sceneKey) {
      const scene = (data.scenes || []).find((s) => s.metadata?.matrixSceneKey === sceneKey || s.metadata?.proposalKey === sceneKey);
      if (scene) return scene.name;
    }
    const points = linkedPoints(clue.id, data);
    const scene = pointScene(points[0], data);
    return scene?.name || "";
  }

  export function clueKindBadge(clue) {
    const kind = clue?.clue_kind || clue?.clueKind || "general";
    return `<span class="cloud-pill">${escapeHtml(CLUE_KIND_LABELS[kind] || CLUE_KIND_LABELS.general)}</span>`;
  }

  function clueAsset(clue) {
    const assetId = clue?.metadata?.assetId;
    return assetId ? (assetStore.get().cloudAssets || []).find((asset) => asset.id === assetId) : null;
  }

  export function linkedPoints(clueId, data) {
    return (data.investigationPoints || []).filter((point) => point.clue_id === clueId);
  }

  export function clueHasDiscoveryPath(clue, data) {
    const metadata = clue?.metadata || {};
    return Boolean(
      linkedPoints(clue?.id, data).length ||
      metadata.segmentKey ||
      metadata.segment_key ||
      metadata.allowUnbound === true
    );
  }

  function pointScene(point, data) {
    return (data.scenes || []).find((scene) => scene.id === point?.scene_id);
  }

  function sceneChapter(scene, data) {
    return (data.chapters || []).find((chapter) => chapter.id === scene?.chapter_id);
  }

  function clueChapterSequence(clue, data) {
    const points = linkedPoints(clue.id, data);
    const sequences = points
      .map((point) => sceneChapter(pointScene(point, data), data)?.sequence)
      .filter((value) => Number.isFinite(Number(value)))
      .map(Number);
    return sequences.length ? Math.min(...sequences) : 99;
  }

  export function captureClueFlowViewport() {
    const viewport = document.querySelector("[data-clue-flow-viewport]");
    if (!viewport) return null;
    const scroll = { left: viewport.scrollLeft, top: viewport.scrollTop };
    uiStore.set({ clueFlowScroll: scroll });
    return scroll;
  }

  export function restoreClueFlowViewport(scroll = uiStore.get().clueFlowScroll) {
    if (!scroll) return;
    const apply = () => {
      const viewport = document.querySelector("[data-clue-flow-viewport]");
      if (!viewport) return;
      viewport.scrollLeft = scroll.left || 0;
      viewport.scrollTop = scroll.top || 0;
    };
    setTimeout(apply, 0);
    setTimeout(apply, 80);
    setTimeout(apply, 260);
    setTimeout(apply, 520);
  }

  function collectClueIdsFromRuleNode(node, ids = new Set()) {
    if (!node || typeof node !== "object") return ids;
    if (node.clueId) ids.add(node.clueId);
    for (const key of ["all", "any", "not"]) {
      const value = node[key];
      if (Array.isArray(value)) value.forEach((item) => collectClueIdsFromRuleNode(item, ids));
      else collectClueIdsFromRuleNode(value, ids);
    }
    return ids;
  }

  export function clueDependencyEdges(data) {
    const clueIds = new Set((data.clues || []).map((clue) => clue.id));
    const sceneToClues = new Map();
    (data.investigationPoints || []).forEach((point) => {
      if (!point.scene_id || !point.clue_id || !clueIds.has(point.clue_id)) return;
      const set = sceneToClues.get(point.scene_id) || new Set();
      set.add(point.clue_id);
      sceneToClues.set(point.scene_id, set);
    });
    const edges = [];
    const add = (from, to, kind, label) => {
      if (!from || !to || from === to || !clueIds.has(from) || !clueIds.has(to)) return;
      const key = `${from}:${to}:${kind}`;
      if (edges.some((edge) => edge.key === key)) return;
      edges.push({ key, from, to, kind, label });
    };
    (data.edges || []).forEach((edge) => {
      if (edge.from_type === "clue" && edge.to_type === "clue") add(edge.from_id, edge.to_id, "story", relationLabel(edge.relation_type));
    });
    const pointsByScene = new Map();
    (data.investigationPoints || []).forEach((point) => {
      if (!point.scene_id || !point.clue_id || !clueIds.has(point.clue_id)) return;
      const list = pointsByScene.get(point.scene_id) || [];
      list.push(point);
      pointsByScene.set(point.scene_id, list);
    });
    pointsByScene.forEach((points) => {
      const sequenced = points
        .filter((point) => point.sequence !== null && point.sequence !== "" && Number.isFinite(Number(point.sequence)))
        .slice()
        .sort((a, b) => Number(a.sequence) - Number(b.sequence) || String(a.name).localeCompare(String(b.name), "zh-CN"));
      sequenced
        .forEach((point, index, sorted) => {
          const previous = sorted[index - 1];
          if (previous?.clue_id && Number(previous.sequence) < Number(point.sequence)) add(previous.clue_id, point.clue_id, "investigation", "调查顺序");
        });
    });
    (worldStore.get().cloudRules || []).forEach((rule) => {
      const sources = [...collectClueIdsFromRuleNode(rule.conditions)];
      if (!sources.length) return;
      (rule.actions || []).forEach((action) => {
        if (action.type === "grant_clue" && action.clueId) {
          sources.forEach((source) => add(source, action.clueId, "rule", rule.name || "规则发放"));
        }
        if (action.type === "unlock_scene" && action.sceneId) {
          (sceneToClues.get(action.sceneId) || new Set()).forEach((target) => {
            sources.forEach((source) => add(source, target, "scene", rule.name || "解锁场景"));
          });
        }
      });
    });
    return edges;
  }

  export function clueGraphMetrics(count, columnCount = 1, maxRows = 1) {
    return {
      width: Math.max(1080, 300 + Math.max(columnCount, Math.ceil((count || 1) / 6)) * 290),
      height: Math.max(720, 240 + Math.max(Math.min(maxRows, 6), 4) * 132)
    };
  }

  function clueLevels(list, dependencies) {
    const ids = new Set(list.map((clue) => clue.id));
    const incoming = new Map(list.map((clue) => [clue.id, []]));
    dependencies.forEach((edge) => {
      if (ids.has(edge.from) && ids.has(edge.to)) incoming.get(edge.to)?.push(edge.from);
    });
    const levelOf = new Map();
    const visit = (id, stack = new Set()) => {
      if (levelOf.has(id)) return levelOf.get(id);
      if (stack.has(id)) return 0;
      stack.add(id);
      const parents = incoming.get(id) || [];
      const level = parents.length ? Math.max(...parents.map((parent) => visit(parent, stack) + 1)) : 0;
      stack.delete(id);
      levelOf.set(id, level);
      return level;
    };
    list.forEach((clue) => visit(clue.id));
    return levelOf;
  }

  function clueGraphNodes(list, data, metrics, dependencies) {
    const maxRowsPerColumn = 6;
    const sorted = list
      .slice()
      .sort((a, b) => clueChapterSequence(a, data) - clueChapterSequence(b, data) || String(a.name).localeCompare(String(b.name), "zh-CN"));
    const levelOf = clueLevels(sorted, dependencies);
    const buckets = new Map();
    sorted.forEach((clue) => {
      const level = levelOf.get(clue.id) || 0;
      const bucket = buckets.get(level) || [];
      bucket.push(clue);
      buckets.set(level, bucket);
    });
    const levels = [...buckets.keys()].sort((a, b) => a - b);
    const levelStartColumn = new Map();
    let columnCursor = 0;
    levels.forEach((level) => {
      levelStartColumn.set(level, columnCursor);
      columnCursor += Math.max(1, Math.ceil((buckets.get(level)?.length || 1) / maxRowsPerColumn));
    });
    return sorted.map((clue) => {
        const level = levelOf.get(clue.id) || 0;
        const bucket = buckets.get(level) || [];
        const row = bucket.findIndex((item) => item.id === clue.id);
        const saved = clue.metadata?.clueGraphPosition;
        const bucketColumn = Math.floor(row / maxRowsPerColumn);
        const bucketRow = row % maxRowsPerColumn;
        const x = saved && Number.isFinite(Number(saved.x)) ? Math.min(3400, Math.max(100, Number(saved.x))) : 170 + ((levelStartColumn.get(level) || 0) + bucketColumn) * 290;
        const y = saved && Number.isFinite(Number(saved.y)) ? Math.min(4800, Math.max(80, Number(saved.y))) : 110 + bucketRow * 132 + (level % 2 ? 30 : 0);
        const points = linkedPoints(clue.id, data);
        const scene = pointScene(points[0], data);
        const chapter = sceneChapter(scene, data);
        const meta = clueMetaLabel(clue);
        return {
          clue,
          x: Math.round(x),
          y: Math.round(y),
          chapter,
          scene,
          points,
          meta,
          locked: clue.visibility !== "public",
          done: points.length > 0
        };
      });
  }

  function graphConnector(from, to, edge) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const width = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    return `<i class="clue-flow-line ${escapeHtml(edge.kind || "")}" data-from="${escapeHtml(edge.from)}" data-to="${escapeHtml(edge.to)}" title="${escapeHtml(edge.label || "线索依赖")}" style="left:${from.x}px;top:${from.y}px;width:${width}px;transform:rotate(${angle}deg)"></i>`;
  }

  export function clueGraph(list, data, q) {
    const allDependencies = clueDependencyEdges(data);
    const visibleIds = new Set(list.map((clue) => clue.id));
    const dependencies = allDependencies.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to));
    const levels = clueLevels(list, dependencies);
    const levelSizes = [...levels.values()].reduce((map, level) => map.set(level, (map.get(level) || 0) + 1), new Map());
    const layoutColumns = [...levelSizes.values()].reduce((total, size) => total + Math.max(1, Math.ceil(size / 6)), 0) || 1;
    const baseMetrics = clueGraphMetrics(list.length, layoutColumns, Math.max(1, ...levelSizes.values()));
    const nodes = clueGraphNodes(list, data, baseMetrics, dependencies);
    const metrics = {
      width: Math.min(3600, Math.max(baseMetrics.width, ...nodes.map((node) => node.x + 190))),
      height: Math.min(5000, Math.max(baseMetrics.height, ...nodes.map((node) => node.y + 120)))
    };
    const nodeById = new Map(nodes.map((node) => [node.clue.id, node]));
    const selectedId = uiStore.get().cluesSelectedId || "";
    const zoom = Number(uiStore.get().clueFlowZoom || 1);
    const filter = uiStore.get().clueFlowFilter || "all";
    const lines = dependencies.map((edge) => {
        const from = nodeById.get(edge.from);
        const to = nodeById.get(edge.to);
        return from && to ? graphConnector({ x: from.x, y: from.y }, { x: to.x, y: to.y }, edge) : "";
      }).join("");
    const relationIds = new Set(dependencies.flatMap((edge) => [edge.from, edge.to]));
    const connectedIds = new Set([
      ...relationIds,
      ...list.filter((clue) => clueHasDiscoveryPath(clue, data)).map((clue) => clue.id)
    ]);
    const unlinkedCount = Math.max(0, list.length - connectedIds.size);
    const hiddenRelationCount = Math.max(0, allDependencies.length - dependencies.length);
    return `<article class="clue-flow-panel">
      <div class="clue-flow-head">
        <div><h3>线索流程图</h3><p>只绘制真实剧情连线、明确调查顺序和自动化规则依赖，不再自动臆造关系。</p></div>
        <div class="clue-flow-tools">
          <div class="filter-tabs">
            <button class="filter-tab ${filter === "all" ? "active" : ""}" data-action="clue-flow-filter" data-filter="all">全部线索</button>
            <button class="filter-tab ${filter === "linked" ? "active" : ""}" data-action="clue-flow-filter" data-filter="linked">已关联</button>
            <button class="filter-tab ${filter === "incomplete" ? "active" : ""}" data-action="clue-flow-filter" data-filter="incomplete">待补全</button>
          </div>
          <div class="clue-zoom-controls" aria-label="线索图缩放">
            <button type="button" data-action="clue-flow-zoom" data-zoom="out">-</button>
            <span>${Math.round(zoom * 100)}%</span>
            <button type="button" data-action="clue-flow-zoom" data-zoom="in">+</button>
            <button type="button" data-action="clue-flow-fit">适应视图</button>
            <button type="button" data-action="clue-flow-focus" ${selectedId && visibleIds.has(selectedId) ? "" : "disabled"}>定位选中</button>
          </div>
          <button type="button" class="text-btn" data-go="truth">打开核心事实</button>
        </div>
      </div>
      <div class="clue-flow-summary"><span><b>${list.length}</b> 当前显示</span><span><b>${dependencies.length}</b> 真实依赖</span><span class="${unlinkedCount ? "warn" : "ok"}"><b>${unlinkedCount}</b> 无路径线索</span>${hiddenRelationCount ? `<span><b>${hiddenRelationCount}</b> 条关系被筛选隐藏</span>` : ""}<div class="clue-flow-legend"><i class="story"></i>剧情连线<i class="investigation"></i>调查顺序<i class="rule"></i>规则发放<i class="scene"></i>场景解锁</div></div>
      <div class="clue-flow-viewport" data-clue-flow-viewport>
        <div class="clue-flow-stage" style="width:${metrics.width * zoom}px;height:${metrics.height * zoom}px"><div class="clue-flow-canvas" data-canvas-width="${metrics.width}" data-canvas-height="${metrics.height}" style="width:${metrics.width}px;height:${metrics.height}px;transform:scale(${zoom});">
          ${lines}${dependencies.length ? "" : `<div class="clue-flow-no-relations"><strong>当前没有可验证的线索依赖</strong><span>全部 ${list.length} 条线索仍完整显示；可在剧情编排或自动化规则中建立真实关系。</span></div>`}
          ${nodes.map((node) => {
            const selected = node.clue.id === selectedId ? " selected" : "";
            const tone = node.meta.importance === "关键线索" ? " key" : node.meta.importance === "烟雾弹" ? " decoy" : "";
            const orphan = connectedIds.has(node.clue.id) ? "" : " orphan";
            const asset = clueAsset(node.clue);
            return `<button type="button" class="clue-flow-node${selected}${tone}${orphan}" data-action="clues-select" data-clue="${node.clue.id}" data-x="${node.x}" data-y="${node.y}" style="left:${node.x}px;top:${node.y}px">
              <span class="clue-node-drag-handle" title="拖动调整线索位置">⠿</span>
              <span class="clue-thumb">${asset ? "图" : node.meta.type.slice(0, 1)}</span>
              <span class="clue-node-copy"><strong>${highlightQuery(node.clue.name, q)}</strong><small>${escapeHtml(node.scene?.name || node.chapter?.title || node.meta.importance)}</small></span>
              <i aria-label="${node.locked ? "私密线索" : "公开线索"}">${node.locked ? "🔒" : "✓"}</i>
            </button>`;
          }).join("")}
        </div></div>
      </div>
    </article>`;
  }

  export function clueTimeline(data) {
    const chapters = (data.chapters || []).slice().sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)).slice(0, 7);
    if (!chapters.length) return "";
    return `<article class="clue-timeline-panel"><h3>剧情时间线 · 与编排联动</h3><p class="wizard-intro">按章节顺序展示公共环境与线索解锁；点击跳转剧情编排。</p><div class="clue-timeline-track">
      <span>序章</span>
      ${chapters.map((chapter) => {
        const chapterScenes = (data.scenes || []).filter((scene) => scene.chapter_id === chapter.id);
        const chapterClues = linkedChapterClues(chapterScenes, data);
        const env =
          chapter.metadata?.publicEnvironment ||
          chapterScenes.map((s) => s.metadata?.publicEnvironment).find(Boolean) ||
          "";
        return `<button type="button" data-go="studio" title="${escapeHtml(chapter.title)} · ${chapterClues.length} 条线索${env ? " · 含公共环境" : ""}"><i></i><strong>第 ${chapter.sequence || "?"} 章</strong><small>${escapeHtml(chapter.title)}${env ? ` · ${escapeHtml(env.slice(0, 36))}${env.length > 36 ? "…" : ""}` : ""}</small></button>`;
      }).join("")}
      <span>终局</span>
    </div></article>`;
  }

  function linkedChapterClues(scenes, data) {
    const sceneIds = new Set(scenes.map((scene) => scene.id));
    const clueIds = new Set((data.investigationPoints || []).filter((point) => sceneIds.has(point.scene_id) && point.clue_id).map((point) => point.clue_id));
    return (data.clues || []).filter((clue) => clueIds.has(clue.id));
  }

  export function clueDetailPanel(clue, data) {
    if (!clue) {
      return `<aside class="clue-detail-panel"><div class="empty-state">选择一个线索查看详情。</div></aside>`;
    }
    const meta = clueMetaLabel(clue);
    const rawMeta = clue.metadata || {};
    const asset = clueAsset(clue);
    const points = linkedPoints(clue.id, data);
    const scenes = points.map((point) => pointScene(point, data)).filter(Boolean);
    const edgeRefs = (data.edges || []).filter((edge) => (edge.from_type === "clue" && edge.from_id === clue.id) || (edge.to_type === "clue" && edge.to_id === clue.id));
    const dependencyRefs = clueDependencyEdges(data);
    const incomingDeps = dependencyRefs.filter((edge) => edge.to === clue.id);
    const outgoingDeps = dependencyRefs.filter((edge) => edge.from === clue.id);
    const clueName = (id) => (data.clues || []).find((item) => item.id === id)?.name || "未知线索";
    const excerpt = clue.public_text || clue.host_text || "还没有补充线索正文。";
    const tab = uiStore.get().clueDetailTab === "triggers" ? "triggers" : "detail";
    const detailBody = `<p class="section-kicker">${escapeHtml(meta.type)} · ${escapeHtml(meta.kind)} · ${escapeHtml(meta.importance)}</p>
        <h3>${escapeHtml(clue.name)}</h3>
        <div class="clue-detail-tags">${clueKindBadge(clue)}${clueVisibilityChip(clue)}${clueActBadge(clue)}${clueGrantModeBadge(clue)}<span class="cloud-pill">${points.length || 0} 个调查点</span></div>
        ${rawMeta.triggerNote ? `<p class="wizard-intro">解锁：${escapeHtml(rawMeta.triggerNote)}${clueSceneLabel(clue, data) ? ` · 场景 ${escapeHtml(clueSceneLabel(clue, data))}` : ""}</p>` : ""}
        <div class="clue-preview-card">
          ${renderClueImageSlot(clue, asset)}
          <strong>线索描述</strong>
          <p>${escapeHtml(excerpt.slice(0, 220))}${excerpt.length > 220 ? "…" : ""}</p>
        </div>
        <div class="clue-related-grid">
          <div><span>关联角色</span><strong>${escapeHtml(clue.visibility === "public" ? "全员可见" : clue.visibility === "host" ? "主持可见" : "获得者")}</strong></div>
          <div><span>关联地点</span><strong>${scenes.length || edgeRefs.length}</strong></div>
        </div>`;
    const triggerBody = `<p class="section-kicker">TRIGGER CONDITIONS</p>
        <h3>${escapeHtml(clue.name)}</h3>
        <div class="clue-trigger-summary">
          <div><span>前置线索</span><strong>${incomingDeps.length || 0}</strong></div>
          <div><span>解锁后续</span><strong>${outgoingDeps.length || 0}</strong></div>
        </div>
        <div class="clue-unlock-list expanded">
          ${rawMeta.triggerNote ? `<h4>设计备注</h4><p><span>※</span>${escapeHtml(rawMeta.triggerNote)}</p>` : ""}
          <h4>前置线索</h4>
          ${incomingDeps.length ? incomingDeps.map((edge) => `<p><span>←</span><b>${escapeHtml(clueName(edge.from))}</b> · ${escapeHtml(edge.label || relationLabel(edge.kind))}</p>`).join("") : `<p><span>◇</span>当前线索没有其他线索作为前置条件。</p>`}
          <h4>解锁后续线索</h4>
          ${outgoingDeps.length ? outgoingDeps.map((edge) => `<p><span>→</span><b>${escapeHtml(clueName(edge.to))}</b> · ${escapeHtml(edge.label || relationLabel(edge.kind))}</p>`).join("") : `<p><span>◇</span>当前线索暂未作为其他线索的前置条件。</p>`}
          <h4>调查点触发</h4>
          ${points.length ? points.map((point) => `<p><span>◎</span><b>${escapeHtml(point.name)}</b>${pointScene(point, data) ? ` · ${escapeHtml(pointScene(point, data).name)}` : ""}</p>`).join("") : `<p><span>◇</span>尚未绑定调查点，可在编排图谱中连接。</p>`}
          <h4>剧情关系</h4>
          ${edgeRefs.length ? edgeRefs.map((edge) => `<p><span>↔</span>${escapeHtml(relationLabel(edge.relation_type))}：${escapeHtml(edge.from_type)} → ${escapeHtml(edge.to_type)}</p>`).join("") : `<p><span>◇</span>尚未创建与其他节点的剧情连线。</p>`}
          <h4>可见性规则</h4>
          <p><span>🔒</span>${escapeHtml(VISIBILITY_LABELS[clue.visibility] || clue.visibility || "私密")} · ${clue.visibility === "public" ? "进入房间即可查看" : clue.visibility === "host" ? "仅主持端使用" : "玩家获得后可见"}</p>
        </div>`;
    return `<aside class="clue-detail-panel">
      <div class="clue-detail-topbar">
        <div class="clue-detail-tabs"><button class="${tab === "detail" ? "active" : ""}" data-action="clue-detail-tab" data-tab="detail">线索详情</button><button class="${tab === "triggers" ? "active" : ""}" data-action="clue-detail-tab" data-tab="triggers">触发条件</button></div>
        <button type="button" class="clue-detail-close" data-action="clue-detail-close" aria-label="关闭线索详情">×</button>
      </div>
      <div class="clue-detail-body">
        ${tab === "triggers" ? triggerBody : detailBody}
        ${tab === "detail" ? `<div class="clue-unlock-list">
          <h4>解锁条件</h4>
          ${points.length ? points.slice(0, 4).map((point) => `<p><span>◎</span>完成调查：${escapeHtml(point.name)}${pointScene(point, data) ? ` · ${escapeHtml(pointScene(point, data).name)}` : ""}</p>`).join("") : `<p><span>◇</span>尚未绑定调查点，可在编排图谱中连接。</p>`}
          ${edgeRefs.slice(0, 3).map((edge) => `<p><span>↔</span>${escapeHtml(relationLabel(edge.relation_type))}：${escapeHtml(edge.from_type)} → ${escapeHtml(edge.to_type)}</p>`).join("")}
        </div>` : ""}
        <div class="clue-detail-actions">
          <button class="primary-btn" data-action="clues-edit" data-clue="${clue.id}">编辑线索</button>
          <button class="secondary-btn" data-action="clues-open-studio" data-clue="${clue.id}">在图谱中定位</button>
        </div>
      </div>
    </aside>`;
  }

  export function clueVisibilityChip(clue) {
    const key = clue.visibility === "public" ? "public" : "private";
    return S.chip?.("clue", key, {
      label: VISIBILITY_LABELS[clue.visibility] || clue.visibility || "私密",
      tone: clue.visibility === "public" ? "published" : "draft"
    }) || `<span class="status-chip ${clue.visibility === "public" ? "published" : "draft"}">${VISIBILITY_LABELS[clue.visibility] || clue.visibility || "私密"}</span>`;
  }
