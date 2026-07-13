import { assetStore, uiStore, worldStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as S from "../components/ui-semantics.js";
import {
  CLUE_IMPORTANCE_LABELS, CLUE_KIND_LABELS, CLUE_TYPE_LABELS,
  VISIBILITY_LABELS, clueMetaLabel, grantModeLabel, relationLabel
} from "./clues-catalog.js";

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
      if (edge.to_type === "clue" && edge.from_type === "clue") add(edge.to_id, edge.from_id, "story", relationLabel(edge.relation_type));
    });
    const pointsByScene = new Map();
    (data.investigationPoints || []).forEach((point) => {
      if (!point.scene_id || !point.clue_id || !clueIds.has(point.clue_id)) return;
      const list = pointsByScene.get(point.scene_id) || [];
      list.push(point);
      pointsByScene.set(point.scene_id, list);
    });
    pointsByScene.forEach((points) => {
      points
        .slice()
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || String(a.name).localeCompare(String(b.name), "zh-CN"))
        .forEach((point, index, sorted) => {
          const previous = sorted[index - 1];
          if (previous?.clue_id) add(previous.clue_id, point.clue_id, "investigation", "调查顺序");
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

  export function clueGraphMetrics(count, levelCount = 1, maxLevelSize = 1) {
    const rings = Math.max(1, Math.ceil((count || 1) / 14));
    return {
      width: Math.max(1540, 520 + Math.max(levelCount, rings + 1) * 360),
      height: Math.max(900, 360 + Math.max(maxLevelSize, 4) * 150)
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
    const levelIndex = new Map(levels.map((level, index) => [level, index]));
    return sorted.map((clue) => {
        const level = levelOf.get(clue.id) || 0;
        const bucket = buckets.get(level) || [];
        const row = bucket.findIndex((item) => item.id === clue.id);
        const saved = clue.metadata?.clueGraphPosition;
        const x = saved && Number.isFinite(Number(saved.x)) ? Number(saved.x) : 190 + (levelIndex.get(level) || 0) * 330;
        const gap = Math.max(112, Math.min(170, (metrics.height - 180) / Math.max(bucket.length, 1)));
        const y = saved && Number.isFinite(Number(saved.y)) ? Number(saved.y) : 110 + row * gap + (level % 2 ? 34 : 0);
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

  function graphConnector(from, to, cls = "") {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const width = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    return `<i class="clue-flow-line ${cls}" style="left:${from.x}px;top:${from.y}px;width:${width}px;transform:rotate(${angle}deg)"></i>`;
  }

  export function clueGraph(list, data, q) {
    const allDependencies = clueDependencyEdges(data);
    const visibleIds = new Set(list.map((clue) => clue.id));
    const dependencies = allDependencies.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to));
    const levels = clueLevels(list, dependencies);
    const levelSizes = [...levels.values()].reduce((map, level) => map.set(level, (map.get(level) || 0) + 1), new Map());
    const metrics = clueGraphMetrics(list.length, new Set(levels.values()).size || 1, Math.max(1, ...levelSizes.values()));
    const nodes = clueGraphNodes(list, data, metrics, dependencies);
    const nodeById = new Map(nodes.map((node) => [node.clue.id, node]));
    const selectedId = uiStore.get().cluesSelectedId || "";
    const center = { x: metrics.width / 2, y: metrics.height / 2 };
    const zoom = Number(uiStore.get().clueFlowZoom || 1);
    const filter = uiStore.get().clueFlowFilter || "all";
    const lines = dependencies.length
      ? dependencies.map((edge) => {
        const from = nodeById.get(edge.from);
        const to = nodeById.get(edge.to);
        return from && to ? graphConnector({ x: from.x, y: from.y }, { x: to.x, y: to.y }, edge.kind) : "";
      }).join("")
      : nodes.map((node, index) => graphConnector({ x: node.x, y: node.y }, center, index % 3 === 0 ? "main" : index % 3 === 1 ? "soft" : "dashed")).join("");
    return `<article class="clue-flow-panel">
      <div class="clue-flow-head">
        <div><h3>线索流程图</h3><p>拖动画布移动视野，使用缩放查看完整线索网络。</p></div>
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
            <button type="button" data-action="clue-flow-zoom" data-zoom="reset">重置</button>
          </div>
        </div>
      </div>
      <div class="clue-flow-viewport" data-clue-flow-viewport>
        <div class="clue-flow-canvas" style="width:${metrics.width}px;height:${metrics.height}px;transform:scale(${zoom});">
          ${lines}
          <button type="button" class="clue-truth-node" data-go="studio" style="left:${center.x}px;top:${center.y}px"><span>◇</span><strong>真相节点</strong></button>
          ${nodes.map((node) => {
            const selected = node.clue.id === selectedId ? " selected" : "";
            const tone = node.meta.importance === "关键线索" ? " key" : node.meta.importance === "烟雾弹" ? " decoy" : "";
            const asset = clueAsset(node.clue);
            return `<button type="button" tabindex="-1" class="clue-flow-node${selected}${tone}" data-action="clues-select" data-clue="${node.clue.id}" data-x="${node.x}" data-y="${node.y}" style="left:${node.x}px;top:${node.y}px">
              <span class="clue-thumb">${asset ? "图" : node.meta.type.slice(0, 1)}</span>
              <span class="clue-node-copy"><strong>${highlightQuery(node.clue.name, q)}</strong><small>${escapeHtml(node.scene?.name || node.chapter?.title || node.meta.importance)}</small></span>
              <i aria-label="${node.locked ? "私密线索" : "公开线索"}">${node.locked ? "🔒" : "✓"}</i>
            </button>`;
          }).join("")}
        </div>
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
          <div class="clue-preview-image ${asset ? "has-asset" : ""}"><span>${asset ? "关联附件" : "线索预览"}</span></div>
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

  export function clueAuditCards(list, data) {
    const linked = list.filter((clue) => linkedPoints(clue.id, data).length).length;
    const withText = list.filter((clue) => String(clue.public_text || "").trim()).length;
    const withRules = list.filter((clue) => (data.edges || []).some((edge) => (edge.from_type === "clue" && edge.from_id === clue.id) || (edge.to_type === "clue" && edge.to_id === clue.id))).length;
    const keyed = list.filter((clue) => clue?.metadata?.importance === "key").length;
    const total = list.length || 0;
    const missingText = list.filter((clue) => !String(clue.public_text || "").trim());
    const unlinked = list.filter((clue) => !linkedPoints(clue.id, data).length);
    const noRuleLinks = list.filter((clue) => !(data.edges || []).some((edge) => (edge.from_type === "clue" && edge.from_id === clue.id) || (edge.to_type === "clue" && edge.to_id === clue.id)));
    const nameCounts = list.reduce((acc, clue) => {
      const key = String(clue.name || "").trim();
      if (key) acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const duplicated = Object.entries(nameCounts).filter(([, count]) => count > 1).map(([name]) => name);
    const score = total ? Math.round(((withText + linked + withRules) / (total * 3)) * 100) : 0;
    const cards = [
      { icon: "文", label: "内容审核", value: `${withText}/${total}`, ok: !missingText.length },
      { icon: "线", label: "调查关联", value: `${linked}/${total}`, ok: !unlinked.length },
      { icon: "规", label: "触发关联", value: `${withRules}/${total}`, ok: !noRuleLinks.length },
      { icon: "测", label: "关键线索", value: `${keyed}/${Math.max(keyed, 1)}`, ok: keyed > 0 }
    ];
    const issues = [
      missingText.length ? { title: "缺少玩家可见正文", detail: missingText.slice(0, 4).map((clue) => clue.name).join("、"), tone: "warn" } : null,
      unlinked.length ? { title: "未关联调查点", detail: unlinked.slice(0, 4).map((clue) => clue.name).join("、"), tone: "warn" } : null,
      noRuleLinks.length ? { title: "未接入触发条件或前置线索", detail: noRuleLinks.slice(0, 4).map((clue) => clue.name).join("、"), tone: "warn" } : null,
      duplicated.length ? { title: "线索名称重复", detail: duplicated.slice(0, 4).join("、"), tone: "danger" } : null,
      !keyed && total ? { title: "没有标记关键线索", detail: "建议至少标记 1 条用于真相节点或章节推进。", tone: "warn" } : null
    ].filter(Boolean);
    const issueRows = issues.length
      ? issues.map((issue) => `<div class="clue-audit-issue ${issue.tone}"><b>${escapeHtml(issue.title)}</b><p>${escapeHtml(issue.detail)}</p></div>`).join("")
      : `<div class="clue-audit-issue ok"><b>当前列表无明显审稿问题</b><p>可以进入编排图谱检查章节节奏和真实依赖关系。</p></div>`;
    return `<section class="clue-audit-report">
      <div class="section-head"><div><p class="section-kicker">CLUE AUDIT</p><h3>线索审稿报告</h3><p>线索管理负责正文、调查关联、触发条件和证据链检查；完整流程编排仍交给剧情编排图谱。</p></div><div class="clue-audit-score"><strong>${score}%</strong><span>审稿完整度</span></div></div>
      <div class="clue-audit-grid">${cards.map((card) => `<article class="${card.ok ? "ok" : "warn"}"><span>${card.icon}</span><div><strong>${escapeHtml(card.label)}</strong><p>${escapeHtml(card.value)}</p></div><i>${card.ok ? "✓" : "!"}</i></article>`).join("")}</div>
      <div class="clue-audit-issues">${issueRows}</div>
    </section>`;
  }

  export function clueVisibilityChip(clue) {
    const key = clue.visibility === "public" ? "public" : "private";
    return S.chip?.("clue", key, {
      label: VISIBILITY_LABELS[clue.visibility] || clue.visibility || "私密",
      tone: clue.visibility === "public" ? "published" : "draft"
    }) || `<span class="status-chip ${clue.visibility === "public" ? "published" : "draft"}">${VISIBILITY_LABELS[clue.visibility] || clue.visibility || "私密"}</span>`;
  }
