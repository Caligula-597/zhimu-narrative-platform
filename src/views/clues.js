/* Clue management — list, search, edit without opening the full studio canvas. */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { modal, modalBackdrop } from "../dom.js";
import { go, loadCloudData, render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { uiStore, roomStore, studioStore, assetStore, worldStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as M from "../components/modal.js";
import * as U from "../components/emptyState.js";
import * as S from "../components/ui-semantics.js";
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const catalogExperienceBanner = U.catalogExperienceBanner || (() => "");
  const studioField = M.studioField || (() => "");
  const studioSelect = M.studioSelect || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioModal = M.studioModal || (() => {});
  const showError = S.showError;
  const closeModal = M.closeModal || (() => {});

  const VISIBILITY_LABELS = { role: "私密", public: "房间公开", host: "主持可见" };
  const CLUE_TYPE_LABELS = {
    text: "文字",
    document: "文书",
    image: "图片",
    physical: "实物",
    testimony: "证词",
    location: "地点",
    cipher: "密码",
    timeline: "时间线",
    relationship: "关系",
    evidence: "证据",
    secret: "秘密",
    audio: "音频",
    file: "文件"
  };
  const CLUE_IMPORTANCE_LABELS = {
    normal: "普通线索",
    key: "关键线索",
    prerequisite: "前置钥匙",
    truth_piece: "真相碎片",
    finale_key: "终局关键",
    optional: "支线补充",
    red_herring: "烟雾弹"
  };
  const CLUE_TYPE_OPTIONS = Object.entries(CLUE_TYPE_LABELS).map(([id, name]) => ({ id, name }));
  const CLUE_IMPORTANCE_OPTIONS = Object.entries(CLUE_IMPORTANCE_LABELS).map(([id, name]) => ({ id, name }));

  function cluePointCount(clueId, data) {
    return (data.investigationPoints || []).filter((point) => point.clue_id === clueId).length;
  }

  function formatClueDeleteRefs(refs) {
    const parts = [];
    if (refs.edgeCount) parts.push(`${refs.edgeCount} 条剧情连线`);
    if (refs.clueGrantCount) parts.push(`${refs.clueGrantCount} 个调查点会停止发放此线索`);
    if (refs.ruleReferenceCount) parts.push(`${refs.ruleReferenceCount} 条规则仍引用此线索`);
    return parts.length ? `<p>检测到 ${parts.join("、")}。删除后运行房可能受影响。</p>` : "";
  }

  export function toggleCluesSelection(clueId, checked) {
    const ui = uiStore.get();
    const set = new Set(ui.cluesBulkSelection || []);
    if (checked) set.add(clueId);
    else set.delete(clueId);
    uiStore.set({ cluesBulkSelection: [...set] });
    render();
  }

  export function syncCluesSelectAll(checked, visibleIds) {
    uiStore.set({ cluesBulkSelection: checked ? [...visibleIds] : [] });
    render();
  }

  export function selectClue(clueId) {
    if (!clueId) return;
    const scroll = captureClueFlowViewport();
    uiStore.set({ cluesSelectedId: clueId });
    render();
    restoreClueFlowViewport(scroll);
  }

  export function closeClueDetail() {
    const scroll = captureClueFlowViewport();
    uiStore.set({ cluesSelectedId: "" });
    uiStore.set({ clueDetailTab: "detail" });
    render();
    restoreClueFlowViewport(scroll);
  }

  export function setClueFlowFilter(filter = "all") {
    captureClueFlowViewport();
    uiStore.set({ clueFlowFilter: ["all", "linked", "incomplete"].includes(filter) ? filter : "all" });
    render();
  }

  export function setClueDetailTab(tab = "detail") {
    captureClueFlowViewport();
    uiStore.set({ clueDetailTab: tab === "triggers" ? "triggers" : "detail" });
    render();
  }

  export function adjustClueFlowZoom(mode = "reset") {
    const scroll = captureClueFlowViewport();
    const current = Number(uiStore.get().clueFlowZoom || 1);
    if (mode === "in") uiStore.set({ clueFlowZoom: Math.min(1.45, Math.round((current + 0.1) * 10) / 10) });
    else if (mode === "out") uiStore.set({ clueFlowZoom: Math.max(0.65, Math.round((current - 0.1) * 10) / 10) });
    else uiStore.set({ clueFlowZoom: 1 });
    render();
    restoreClueFlowViewport(scroll);
  }

  async function saveClueGraphPosition(clueId, position) {
    const data = studioStore.get().cloudStudio;
    const clue = data?.clues?.find((item) => item.id === clueId);
    if (!clue || !position) return;
    const metadata = {
      ...(clue.metadata || {}),
      clueGraphPosition: {
        x: Math.max(80, Math.round(Number(position.x) || 80)),
        y: Math.max(70, Math.round(Number(position.y) || 70))
      }
    };
    clue.metadata = metadata;
    try {
      await zhimuApi.updateClue(clue.id, {
        name: clue.name,
        publicText: clue.public_text || "",
        hostText: clue.host_text || "",
        visibility: clue.visibility || "role",
        metadata
      });
    } catch (error) {
      showError(error, "线索位置保存失败，请稍后重试");
    }
  }

  export async function confirmDeleteClue(clueId) {
    const data = studioStore.get().cloudStudio;
    const clue = data?.clues?.find((item) => item.id === clueId);
    if (!clue) return showToast("线索不存在或已删除");
    try {
      const refs = await zhimuApi.getStudioNodeReferences("clue", clueId);
      studioModal(
        "确认删除线索",
        `${formatClueDeleteRefs(refs)}<p>删除后无法恢复；已入房玩家若曾获得此线索，相关记录也会一并清除。</p><div class="rule-block"><strong>${escapeHtml(clue.name)}</strong></div>`,
        "确认删除",
        async () => {
          try {
            await zhimuApi.deleteStudioNode("clue", clueId);
            const ui = uiStore.get();
            uiStore.set({ cluesBulkSelection: (ui.cluesBulkSelection || []).filter((id) => id !== clueId) });
            if (ui.cluesSelectedId === clueId) uiStore.set({ cluesSelectedId: null });
            closeModal();
            await loadCloudData();
            showToast("线索已删除");
          } catch (error) {
            showError(error);
          }
        }
      );
    } catch (error) {
      showError(error);
    }
  }

  export async function batchDeleteClues() {
    const ui = uiStore.get();
    const ids = ui.cluesBulkSelection || [];
    if (!ids.length) return showToast("请先勾选要删除的线索");
    const data = studioStore.get().cloudStudio;
    const names = ids.map((id) => data?.clues?.find((item) => item.id === id)?.name || "未命名线索");
    studioModal(
      `确认删除 ${ids.length} 条线索`,
      `<p>以下线索将被永久删除，且无法恢复：</p><ul class="clues-delete-list">${names.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul><p>关联的剧情连线会一并移除；调查点将不再发放这些线索。</p>`,
      "确认删除",
      async () => {
        try {
          for (const clueId of ids) {
            await zhimuApi.deleteStudioNode("clue", clueId);
          }
          uiStore.set({ cluesBulkSelection: [] });
          if (ui.cluesSelectedId && ids.includes(ui.cluesSelectedId)) uiStore.set({ cluesSelectedId: null });
          closeModal();
          await loadCloudData();
          showToast(`已删除 ${ids.length} 条线索`);
        } catch (error) {
          showError(error);
        }
      }
    );
  }

  function highlightQuery(text, query) {
    const clean = String(text || "");
    if (!query) return escapeHtml(clean);
    const idx = clean.toLowerCase().indexOf(String(query).toLowerCase());
    if (idx < 0) return escapeHtml(clean);
    return `${escapeHtml(clean.slice(0, idx))}<mark class="search-mark">${escapeHtml(clean.slice(idx, idx + query.length))}</mark>${escapeHtml(clean.slice(idx + query.length))}`;
  }

  function grantModeLabel(mode) {
    return { auto: "自动发放", host_confirm: "主持确认", explore: "探索获得" }[mode] || "";
  }

  function clueActBadge(clue) {
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

  function clueMetaLabel(clue) {
    const meta = clue?.metadata || {};
    const type = CLUE_TYPE_LABELS[meta.clueType] || CLUE_TYPE_LABELS.text;
    const importance = CLUE_IMPORTANCE_LABELS[meta.importance] || CLUE_IMPORTANCE_LABELS.normal;
    return { type, importance };
  }

  function clueAsset(clue) {
    const assetId = clue?.metadata?.assetId;
    return assetId ? (assetStore.get().cloudAssets || []).find((asset) => asset.id === assetId) : null;
  }

  function linkedPoints(clueId, data) {
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

  function relationLabel(type) {
    return ({ mainline: "主线", parallel: "并列", extension: "延伸" })[type] || "关联";
  }

  function captureClueFlowViewport() {
    const viewport = document.querySelector("[data-clue-flow-viewport]");
    if (!viewport) return null;
    const scroll = { left: viewport.scrollLeft, top: viewport.scrollTop };
    uiStore.set({ clueFlowScroll: scroll });
    return scroll;
  }

  function restoreClueFlowViewport(scroll = uiStore.get().clueFlowScroll) {
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

  function clueDependencyEdges(data) {
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

  function clueGraphMetrics(count, levelCount = 1, maxLevelSize = 1) {
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

  function clueGraph(list, data, q) {
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

  function clueTimeline(data) {
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

  function clueDetailPanel(clue, data) {
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
    const detailBody = `<p class="section-kicker">${escapeHtml(meta.type)} · ${escapeHtml(meta.importance)}</p>
        <h3>${escapeHtml(clue.name)}</h3>
        <div class="clue-detail-tags">${clueVisibilityChip(clue)}${clueActBadge(clue)}${clueGrantModeBadge(clue)}<span class="cloud-pill">${points.length || 0} 个调查点</span></div>
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

  function clueAuditCards(list, data) {
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

  function clueVisibilityChip(clue) {
    const key = clue.visibility === "public" ? "public" : "private";
    return S.chip?.("clue", key, {
      label: VISIBILITY_LABELS[clue.visibility] || clue.visibility || "私密",
      tone: clue.visibility === "public" ? "published" : "draft"
    }) || `<span class="status-chip ${clue.visibility === "public" ? "published" : "draft"}">${VISIBILITY_LABELS[clue.visibility] || clue.visibility || "私密"}</span>`;
  }

  /** 加载线索命中率聚合数据（A3）— 镜像 runCreatorChecks 的加载模式 */
  export async function loadClueHitRate() {
    const roomId = zhimuApi.context.roomId || null;
    try {
      const data = await zhimuApi.getClueHitRate(roomId ? { roomId } : {});
      worldStore.set({ cloudClueHitRate: data });
      render();
      showToast("线索命中率已刷新");
    } catch (error) {
      showError(error);
    }
  }

  function clueHitRatePanel() {
    const { cloudClueHitRate: data } = worldStore.get();
    if (!data) {
      return `<section class="clue-hit-rate-panel">
        <div class="section-head">
          <div><p class="section-kicker">CLUE HIT RATE</p><h3>线索命中率</h3><p>统计每条线索在运行房中的获得、已读与分享情况，定位未触发的线索。</p></div>
          <button class="secondary-btn" data-action="load-clue-hit-rate">加载命中率</button>
        </div>
        <div class="empty-state">点击「加载命中率」从云端拉取当前世界/运行房的线索命中统计。</div>
      </section>`;
    }
    const scopeLabel = data.scope === "room" ? "当前运行房" : `全世界 · ${data.totalRooms} 个运行房`;
    const insights = data.insights || {};
    const neverHit = insights.neverHit || [];
    const lowRead = insights.lowRead || [];
    const highShare = insights.highShare || [];
    const insightBlock = (items, label, tone) => items.length
      ? `<div class="hit-rate-insight ${tone}">
          <p class="section-kicker">${escapeHtml(label)} · ${items.length} 条</p>
          <ul>${items.map((item) => `<li><b>${escapeHtml(item.name)}</b><span>${escapeHtml(item.detail || "")}</span></li>`).join("")}</ul>
        </div>`
      : "";
    const insightsHtml = neverHit.length || lowRead.length || highShare.length
      ? `<div class="hit-rate-insights">${insightBlock(neverHit, "未被获得", "risk-error")}${insightBlock(lowRead, "已读率低", "risk-warning")}${insightBlock(highShare, "过度公开", "risk-warning")}</div>`
      : "";
    const clueRows = (data.clues || []).length
      ? data.clues
          .slice()
          .sort((a, b) => (b.hitRate || 0) - (a.hitRate || 0))
          .map((clue) => {
            const pct = clue.hitRate || 0;
            const tone = pct >= 80 ? "published" : pct >= 40 ? "testing" : "draft";
            return `<div class="hit-rate-row">
              <div class="hit-rate-row-head"><strong>${escapeHtml(clue.name)}</strong><span class="status-chip ${tone}">${pct}%</span></div>
              <div class="hit-rate-row-meta"><span>${escapeHtml(clue.label || "")}</span>${clue.detail ? `<span class="muted-note">${escapeHtml(clue.detail)}</span>` : ""}</div>
              <div class="progress"><i style="width:${pct}%"></i></div>
            </div>`;
          })
          .join("")
      : `<div class="empty-state">暂无线索数据。先在编排台创建线索并让玩家进入运行房调查。</div>`;
    return `<section class="clue-hit-rate-panel">
      <div class="section-head">
        <div><p class="section-kicker">CLUE HIT RATE</p><h3>线索命中率</h3><p>统计每条线索在运行房中的获得、已读与分享情况，定位未触发的线索。</p></div>
        <div class="row">
          <span class="status-chip ${data.averageHitRate >= 80 ? "published" : data.averageHitRate >= 40 ? "testing" : "draft"}">${scopeLabel} · 平均 ${data.averageHitRate}%</span>
          <button class="secondary-btn" data-action="load-clue-hit-rate">刷新</button>
        </div>
      </div>
      <div class="hit-rate-summary">${escapeHtml(data.summary?.label || "")}</div>
      ${insightsHtml}
      <details class="hit-rate-clue-list" open>
        <summary>线索明细 · ${data.totalClues || 0} 条</summary>
        <div class="hit-rate-clue-rows">${clueRows}</div>
      </details>
    </section>`;
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
    ${clueHitRatePanel()}
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
        return `<article class="clues-row${selected}" data-clue-row="${clue.id}"><label class="clues-row-select check-label"><input type="checkbox" data-action="clues-toggle-select" data-clue="${clue.id}"${checked}></label><div class="clues-row-main"><div class="clues-row-head"><strong>${highlightQuery(clue.name, q)}</strong>${clueActBadge(clue)}${clueVisibilityChip(clue)}${points ? `<span class="cloud-pill">${points} 个调查点</span>` : ""}</div><p>${highlightQuery((clue.public_text || "").slice(0, 160), q)}${(clue.public_text || "").length > 160 ? "…" : ""}</p></div><div class="row clues-row-actions"><button class="text-btn" data-action="clues-edit" data-clue="${clue.id}">编辑</button><button class="text-btn" data-action="clues-open-studio" data-clue="${clue.id}">在图谱中定位</button><button class="text-btn danger-text" data-action="clues-delete" data-clue="${clue.id}">删除</button></div></article>`;
      })
      .join("")}</div></details>
      </main>
      ${selectedClue ? clueDetailPanel(selectedClue, data) : ""}
    </div>` : (q ? `<div class="empty-state">没有匹配「${escapeHtml(q)}」的线索。</div>` : `<div class="empty-state enriched-empty"><p><strong>尚未创建线索</strong></p><p>线索是玩家调查与规则推进的核心。空列表不代表功能未完成——可在编排图谱批量创建，或在此快速新建。</p><ul class="empty-hints"><li>编排台：筛选「线索」节点 → 拖拽创建并连线到场景/调查点</li><li>调查点完成可自动发放线索；规则页可配置「拥有线索 → 开放场景」</li></ul><div class="row"><button class="primary-btn" data-action="clues-add">＋ 新建线索</button><button class="secondary-btn" data-go="studio">打开编排图谱</button><button class="text-btn" data-action="open-creator-guide">阅读线索说明</button></div></div>`)}
    </section>`;
  }

  export function bindCluesSearch() {
    bindClueFlowPan();
    const input = document.getElementById("clues-search-input");
    if (!input || input.dataset.bound) return;
    input.dataset.bound = "1";
    let timer = null;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        uiStore.set({ cluesSearchQuery: input.value.trim() });
        render();
        bindCluesSearch();
      }, 280);
    });
  }

  function bindClueFlowPan() {
    const viewport = document.querySelector("[data-clue-flow-viewport]");
    if (!viewport || viewport.dataset.panBound) return;
    viewport.dataset.panBound = "1";
    const savedScroll = uiStore.get().clueFlowScroll;
    if (savedScroll) {
      viewport.scrollLeft = savedScroll.left || 0;
      viewport.scrollTop = savedScroll.top || 0;
    } else if (!viewport.scrollLeft && !viewport.scrollTop) {
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
    }
    viewport.addEventListener("scroll", () => {
      uiStore.set({ clueFlowScroll: { left: viewport.scrollLeft, top: viewport.scrollTop } });
    }, { passive: true });
    viewport.addEventListener("click", (event) => {
      const node = event.target.closest(".clue-flow-node");
      if (!node) {
        if (event.target.closest(".clue-flow-canvas") && uiStore.get().cluesSelectedId) closeClueDetail();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (uiStore.get().clueFlowSuppressClick) {
        uiStore.set({ clueFlowSuppressClick: false });
        return;
      }
      selectClue(node.dataset.clue);
    }, true);
    viewport.addEventListener("pointerdown", (event) => {
      const node = event.target.closest(".clue-flow-node");
      if (node) {
        event.preventDefault();
        event.stopPropagation();
        const zoom = Number(uiStore.get().clueFlowZoom || 1) || 1;
        const start = {
          x: event.clientX,
          y: event.clientY,
          left: Number.parseFloat(node.dataset.x || node.style.left) || 0,
          top: Number.parseFloat(node.dataset.y || node.style.top) || 0,
          moved: false
        };
        node.classList.add("dragging");
        node.setPointerCapture?.(event.pointerId);
        const move = (moveEvent) => {
          const dx = (moveEvent.clientX - start.x) / zoom;
          const dy = (moveEvent.clientY - start.y) / zoom;
          if (Math.abs(dx) + Math.abs(dy) > 4) start.moved = true;
          const x = Math.max(72, start.left + dx);
          const y = Math.max(62, start.top + dy);
          node.style.left = `${x}px`;
          node.style.top = `${y}px`;
          node.dataset.x = String(Math.round(x));
          node.dataset.y = String(Math.round(y));
        };
        const finish = async () => {
          node.classList.remove("dragging");
          node.releasePointerCapture?.(event.pointerId);
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", finish);
          if (!start.moved) {
            selectClue(node.dataset.clue);
            return;
          }
          uiStore.set({ clueFlowSuppressClick: true });
          const scroll = captureClueFlowViewport();
          await saveClueGraphPosition(node.dataset.clue, {
            x: Number.parseFloat(node.dataset.x || node.style.left),
            y: Number.parseFloat(node.dataset.y || node.style.top)
          });
          render();
          restoreClueFlowViewport(scroll);
          setTimeout(() => {
            uiStore.set({ clueFlowSuppressClick: false });
          }, 180);
        };
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", finish, { once: true });
        return;
      }
      if (event.target.closest("button")) return;
      viewport.classList.add("panning");
      const start = {
        x: event.clientX,
        y: event.clientY,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
        moved: false
      };
      const move = (moveEvent) => {
        if (Math.abs(moveEvent.clientX - start.x) + Math.abs(moveEvent.clientY - start.y) > 4) start.moved = true;
        viewport.scrollLeft = start.left - (moveEvent.clientX - start.x);
        viewport.scrollTop = start.top - (moveEvent.clientY - start.y);
      };
      const finish = () => {
        viewport.classList.remove("panning");
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", finish);
        if (!start.moved && uiStore.get().cluesSelectedId) closeClueDetail();
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", finish, { once: true });
    });
  }

  export function openClueInStudio(clueId) {
    uiStore.set({ searchFocus: { view: "studio", type: "clue", id: clueId, nodeType: "clue" } });
    go("studio");
  }

  export function openCluesEditor(clueId = "") {
    const data = studioStore.get().cloudStudio;
    if (!data) return showToast("请先选择剧本世界");
    const clue = clueId ? data.clues.find((item) => item.id === clueId) : null;
    const assets = [{ id: "", name: "不关联附件" }, ...(assetStore.get().cloudAssets || []).map((asset) => ({ id: asset.id, name: asset.original_filename }))];
    const meta = clue?.metadata || {};
    studioModal(
      clue ? `编辑线索 · ${clue.name}` : "新建线索",
      studioField("线索名称", "name", "input", clue?.name || "") +
        studioField("获得后可见内容", "publicText", "textarea", clue?.public_text || "") +
        studioField("主持解释", "hostText", "textarea", clue?.host_text || "") +
        studioSelect("默认可见性", "visibility", [
          { id: "role", name: "私密 · 仅获得角色可见" },
          { id: "public", name: "房间公开" },
          { id: "host", name: "主持可见" }
        ], clue?.visibility || "role") +
        studioSelect("发放模式", "grantMode", [
          { id: "auto", name: "自动发放" },
          { id: "host_confirm", name: "主持确认后发放" },
          { id: "explore", name: "探索调查获得" }
        ], meta.grantMode || "auto") +
        studioSelect("线索类型", "clueType", CLUE_TYPE_OPTIONS, meta.clueType || "text") +
        studioSelect("关联资产", "assetId", assets, meta.assetId || "") +
        studioSelect("重要程度", "importance", CLUE_IMPORTANCE_OPTIONS, meta.importance || "normal") +
        studioField("触发条件说明", "triggerNote", "textarea", meta.triggerNote || ""),
      clue ? "保存修改" : "写入云端",
      async () => {
        try {
          const values = studioValues();
          if (clue) {
            await zhimuApi.updateClue(clue.id, {
              name: values.name,
              publicText: values.publicText,
              hostText: values.hostText,
              visibility: values.visibility || "role",
              metadata: {
                ...(clue.metadata || {}),
                clueType: values.clueType || "text",
                assetId: values.assetId || null,
                importance: values.importance || "normal",
                grantMode: values.grantMode || "auto",
                triggerNote: values.triggerNote || ""
              }
            });
          } else {
            await zhimuApi.createClue({
              name: values.name,
              publicText: values.publicText,
              hostText: values.hostText,
              visibility: values.visibility || "role",
              metadata: {
                clueType: values.clueType || "text",
                assetId: values.assetId || null,
                importance: values.importance || "normal",
                grantMode: values.grantMode || "auto",
                triggerNote: values.triggerNote || ""
              }
            });
          }
          closeModal();
          await loadCloudData();
          showToast(clue ? "线索已更新" : "线索已创建");
        } catch (error) {
          showError(error);
        }
      }
    );
    if (clue) {
      modal.querySelector('[data-studio-field="visibility"]').value = clue.visibility || "role";
      modal.querySelector('[data-studio-field="grantMode"]').value = meta.grantMode || "auto";
      modal.querySelector('[data-studio-field="clueType"]').value = meta.clueType || "text";
      modal.querySelector('[data-studio-field="importance"]').value = meta.importance || "normal";
    }
  }


export const cluesViewApi = { clues, selectClue, closeClueDetail, setClueFlowFilter, setClueDetailTab, adjustClueFlowZoom, bindCluesSearch, openClueInStudio, openCluesEditor, confirmDeleteClue, batchDeleteClues, toggleCluesSelection, syncCluesSelectAll, loadClueHitRate };
registerView("clues", cluesViewApi);
