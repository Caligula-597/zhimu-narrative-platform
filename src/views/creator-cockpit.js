/**
 * Creator cockpit — live workflow shell wired to dashboard, studio, and native panels.
 */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import * as U from "../components/emptyState.js";
import { content } from "../dom.js";
import { render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { studioStore, worldStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import { normalizeError } from "../components/status-ui.js";
import { contentLayerMapHtml } from "../components/content-layer-map.js";
import {
  CANVAS_LABELS,
  CANVAS_MODES,
  buildLiveStages,
  completionPercent,
  defaultCanvasForItem,
  defaultDraft,
  draftStorageKey,
  findItemLink,
  mergeDraftFromSources,
  briefSettingsPatch,
  resolveCheckTarget,
  statusText
} from "./creator-cockpit-model.js";
import {
  linkButton,
  renderAssistant,
  renderArchitectureCanvas,
  renderCharactersCanvas,
  renderConceptCanvas,
  renderFlowCanvas,
  renderLaunchCanvas,
  renderManuscriptCanvas
} from "./creator-cockpit-panels.js";
import { renderProductionStrip } from "./creator-cockpit-production.js";

const showError = (error, fallback = "操作失败") => showToast(normalizeError(error, fallback));

let cockpit = defaultDraft(null);
let saveSummaryTimer = null;
let saveBriefTimer = null;
/** Prevent bindDynamic → refresh → render → bindDynamic request amplification. */
let loadedWorldId = null;
let inFlightPromise = null;
let loadSeq = 0;

export function invalidateCockpitData() {
  loadedWorldId = null;
}

function loadDraft(worldId, studio) {
  try {
    const parsed = JSON.parse(localStorage.getItem(draftStorageKey(worldId)) || "{}");
    return mergeDraftFromSources(parsed, studio);
  } catch {
    return defaultDraft(studio);
  }
}

function saveDraft() {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return;
  localStorage.setItem(draftStorageKey(worldId), JSON.stringify(cockpit));
}

function syncDraftForWorld() {
  cockpit = loadDraft(zhimuApi.context.worldId, studioStore.get().cloudStudio);
}

function buildContext() {
  const studio = studioStore.get().cloudStudio;
  const dash = worldStore.get().cloudCreatorDashboard;
  return {
    studio,
    counts: dash?.counts || {},
    bibleSummary: worldStore.get().cloudBibleSummary,
    checks: dash?.checks || worldStore.get().cloudCreatorChecks || [],
    segments: worldStore.get().cloudSegments || [],
    truthClaims: worldStore.get().cloudTruthClaims || [],
    relationships: worldStore.get().cloudRoleRelationships || [],
    draft: cockpit,
    dashboard: dash
  };
}

function currentStage(stages) {
  return stages.find((s) => s.id === cockpit.activeStage) || stages[0];
}

function ensureCanvas(stage) {
  const allowed = CANVAS_MODES[stage.id] || [];
  if (!allowed.includes(cockpit.activeCanvas)) {
    cockpit.activeCanvas = defaultCanvasForItem(stage.id, cockpit.activeItem) || allowed[0];
  }
}

export function navigateCockpit({ stage, item, canvas, target } = {}) {
  if (target) {
    let parsed = target;
    if (typeof target === "string") {
      try {
        parsed = JSON.parse(target);
      } catch {
        parsed = null;
      }
    }
    const nav = resolveCheckTarget(parsed);
    if (nav) {
      stage = nav.stage;
      item = nav.item;
      canvas = nav.canvas;
    }
  }
  if (stage) cockpit.activeStage = stage;
  if (item) cockpit.activeItem = item;
  if (canvas) cockpit.activeCanvas = canvas;
  else if (stage && item) cockpit.activeCanvas = defaultCanvasForItem(stage, item);
  saveDraft();
  render();
}

export async function refreshCockpitData({ force = false } = {}) {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) {
    loadedWorldId = null;
    return;
  }
  if (!force && loadedWorldId === worldId) return;
  if (!force && inFlightPromise) return inFlightPromise;

  const seq = ++loadSeq;
  syncDraftForWorld();
  inFlightPromise = (async () => {
    try {
      const [dash, bibleSummary, segmentsPayload, truthPayload, relPayload] = await Promise.all([
        zhimuApi.getCreatorDashboard({ worldId }),
        zhimuApi.getBibleSummary(worldId),
        worldStore.get().cloudSegments === null ? zhimuApi.getWorldSegments(worldId) : Promise.resolve(null),
        worldStore.get().cloudTruthClaims === null ? zhimuApi.getTruthClaims(worldId) : Promise.resolve(null),
        worldStore.get().cloudRoleRelationships === null ? zhimuApi.getRoleRelationships(worldId) : Promise.resolve(null)
      ]);
      if (seq !== loadSeq) return;
      const patch = {
        cloudCreatorDashboard: dash,
        cloudCreatorChecks: dash?.checks || [],
        cloudBibleSummary: bibleSummary
      };
      if (segmentsPayload) patch.cloudSegments = segmentsPayload.segments || [];
      if (truthPayload) patch.cloudTruthClaims = truthPayload.claims || [];
      if (relPayload) patch.cloudRoleRelationships = relPayload.relationships || [];
      worldStore.set(patch);
      if (cockpit.activeCanvas === "feedback") {
        await prefetchFeedbackInsights();
      }
      if (seq !== loadSeq) return;
      loadedWorldId = worldId;
      render();
    } catch (error) {
      if (seq === loadSeq) showError(error);
    } finally {
      if (seq === loadSeq) inFlightPromise = null;
    }
  })();
  return inFlightPromise;
}

export function scheduleBriefSave() {
  clearTimeout(saveBriefTimer);
  saveBriefTimer = setTimeout(async () => {
    const worldId = zhimuApi.context.worldId;
    if (!worldId) return;
    try {
      await zhimuApi.patchWorld({ settings: briefSettingsPatch(cockpit) }, worldId);
      const studio = studioStore.get().cloudStudio;
      if (studio?.world) {
        studio.world.settings = { ...(studio.world.settings || {}), ...briefSettingsPatch(cockpit) };
      }
    } catch (error) {
      showError(error, "概念草稿保存失败");
    }
  }, 800);
}

export function selectCockpitSegment(segmentId) {
  cockpit.selectedSegmentId = segmentId || null;
  saveDraft();
  render();
}
export function scheduleSummarySave() {
  clearTimeout(saveSummaryTimer);
  saveSummaryTimer = setTimeout(async () => {
    const worldId = zhimuApi.context.worldId;
    const summary = cockpit.logline?.trim();
    if (!worldId || !summary) return;
    try {
      await zhimuApi.patchWorld({ summary }, worldId);
      const studio = studioStore.get().cloudStudio;
      if (studio?.world) studio.world.summary = summary;
    } catch (error) {
      showError(error, "梗概保存失败");
    }
  }, 700);
}

async function prefetchFeedbackInsights() {
  const ws = worldStore.get();
  const tasks = [];
  if (!ws.cloudSegmentCompletion) {
    tasks.push(zhimuApi.getSegmentCompletion({}).then((data) => {
      worldStore.set({ cloudSegmentCompletion: data });
    }).catch(() => {}));
  }
  if (!ws.cloudClueHitRate) {
    tasks.push(zhimuApi.getClueHitRate({}).then((data) => {
      worldStore.set({ cloudClueHitRate: data });
    }).catch(() => {}));
  }
  if (tasks.length) await Promise.all(tasks);
}

export function getCockpitDraft() {
  return cockpit;
}

export function patchCockpitDraft(patch) {
  cockpit = { ...cockpit, ...patch };
  saveDraft();
}

export function rerenderCockpit() {
  saveDraft();
  render();
}

function renderStageTabs(stages) {
  return stages.map((stage, index) => `
    <button type="button" class="cockpit-stage-tab ${stage.id === cockpit.activeStage ? "active" : ""}" data-cockpit-stage="${stage.id}">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <strong>${stage.short}</strong>
      <small>${completionPercent(stage)}%</small>
    </button>`).join("");
}

function renderChecklist(stage) {
  return stage.items.map((item) => `
    <button type="button" class="cockpit-check-item ${item.id === cockpit.activeItem ? "active" : ""}" data-cockpit-item="${item.id}" data-cockpit-stage="${stage.id}">
      <span class="cockpit-status ${item.status}">${statusText(item.status)}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <small>${escapeHtml(item.hint)}</small>
    </button>`).join("");
}

function renderCanvasSwitch(stage) {
  return (CANVAS_MODES[stage.id] || []).map((mode) => `
    <button type="button" class="cockpit-mode ${mode === cockpit.activeCanvas ? "active" : ""}" data-cockpit-canvas="${mode}">
      ${CANVAS_LABELS[mode]}
    </button>`).join("");
}

function renderCanvas(ctx, stage) {
  const args = [ctx, cockpit, findItemLink];
  if (stage.id === "concept") return renderConceptCanvas(...args);
  if (stage.id === "architecture") return renderArchitectureCanvas(...args);
  if (stage.id === "characters") return renderCharactersCanvas(...args);
  if (stage.id === "flow") return renderFlowCanvas(...args);
  if (stage.id === "manuscript") return renderManuscriptCanvas(ctx, cockpit);
  return renderLaunchCanvas(...args);
}

export function creatorCockpit() {
  const studio = studioStore.get().cloudStudio;
  if (!studio && !studioStore.get().cloudLoading) {
    return U.creatorWorkspaceEmpty?.({
      title: "创作驾驶舱",
      kicker: "CREATOR COCKPIT",
      intro: "按真实创作流程组织：概念 → 架构 → 人物 → 流程 → 文稿 → 测试。请先选择或创建剧本。",
      guideTitle: "开始",
      guideItems: [{ label: "流程", title: "六阶段主流程", text: "驾驶舱是唯一创作顺序；左清单、中画布、右副驾完成多数工作。", bullets: ["灵感池、真相链、章节、角色均可快速添加", "复杂编辑打开侧栏「精细编辑器」"] }]
    }) || `<section class="card"><h3>尚未选择剧本</h3></section>`;
  }
  syncDraftForWorld();
  const ctx = buildContext();
  const stages = buildLiveStages(ctx);
  const stage = currentStage(stages);
  ensureCanvas(stage);
  if (stage.id === "flow" && cockpit.activeCanvas === "beats" && !cockpit.selectedSegmentId && ctx.segments.length) {
    cockpit.selectedSegmentId = ctx.segments[0].id;
  }
  const dash = ctx.dashboard;
  const worldName = studio?.world?.name || "当前剧本";
  return `<section class="creator-cockpit">
    <header class="cockpit-hero">
      <div>
        <p class="eyebrow">CREATOR COCKPIT · ${escapeHtml(worldName)}</p>
        <h2>创作驾驶舱</h2>
        <p class="cockpit-hero-lede">六阶段是唯一主流程。侧栏「精细编辑器」用于复杂专业页；「工作模式」只是按任务类型切换视图。</p>
        <span>字段完成 <strong>${dash?.readiness?.productionPercent ?? "—"}%</strong> · 系统检查 <strong>${(dash?.checks || []).length}</strong> 条 · error ${(dash?.checks || []).filter((c) => c.level === "error").length} · warning ${(dash?.checks || []).filter((c) => c.level === "warning").length}</span>
      </div>
      <div class="cockpit-hero-actions">
        <button class="secondary-btn" type="button" data-action="cockpit-refresh">刷新数据</button>
        <button class="secondary-btn" type="button" data-action="creator-check">系统检查</button>
        <button class="primary-btn" type="button" data-action="world-rooms">测试房</button>
      </div>
    </header>
    <div class="cockpit-stage-strip">${renderStageTabs(stages)}</div>
    ${contentLayerMapHtml({ open: false })}
    ${dash?.production?.length ? renderProductionStrip(dash.production) : ""}
    <div class="cockpit-workbench">
      <aside class="cockpit-nav-band">
        <div class="nav-band-heading"><span>${stage.short}</span><strong>${stage.title}</strong><small>${stage.subtitle}</small></div>
        <div class="stage-progress"><span style="width:${completionPercent(stage)}%"></span></div>
        <div class="cockpit-checklist">${renderChecklist(stage)}</div>
        ${linkButton(findItemLink(stage.id, cockpit.activeItem), "cockpit-placeholder-btn")}
      </aside>
      <main class="cockpit-core-canvas">
        <div class="canvas-toolbar"><div><p>核心画布</p><h3>${CANVAS_LABELS[cockpit.activeCanvas] || stage.short}</h3></div><div class="canvas-modes">${renderCanvasSwitch(stage)}</div></div>
        ${renderCanvas(ctx, stage)}
      </main>
      ${renderAssistant(stage, ctx, cockpit)}
    </div>
  </section>`;
}

function bindCockpitEvents() {
  content.addEventListener("click", (event) => {
    if (!event.target.closest(".creator-cockpit")) return;
    const canvasBtn = event.target.closest("[data-cockpit-canvas]");
    if (canvasBtn) {
      cockpit.activeCanvas = canvasBtn.dataset.cockpitCanvas;
      rerenderCockpit();
      if (cockpit.activeCanvas === "feedback") void prefetchFeedbackInsights().then(() => render());
      return;
    }
    const segBtn = event.target.closest("[data-cockpit-segment-id]");
    if (segBtn && !event.target.closest("[data-action='cockpit-save-segment']")) {
      selectCockpitSegment(segBtn.dataset.cockpitSegmentId);
      return;
    }
    const itemBtn = event.target.closest("[data-cockpit-item]");
    if (itemBtn) {
      cockpit.activeStage = itemBtn.dataset.cockpitStage || cockpit.activeStage;
      cockpit.activeItem = itemBtn.dataset.cockpitItem;
      cockpit.activeCanvas = defaultCanvasForItem(cockpit.activeStage, cockpit.activeItem);
      rerenderCockpit();
      if (cockpit.activeCanvas === "feedback") void prefetchFeedbackInsights().then(() => render());
      return;
    }
    const stageBtn = event.target.closest("[data-cockpit-stage]");
    if (stageBtn) {
      cockpit.activeStage = stageBtn.dataset.cockpitStage;
      cockpit.activeItem = buildLiveStages(buildContext()).find((s) => s.id === cockpit.activeStage)?.items[0]?.id || "";
      cockpit.activeCanvas = defaultCanvasForItem(cockpit.activeStage, cockpit.activeItem);
      rerenderCockpit();
    }
  });

  content.addEventListener("input", (event) => {
    if (!event.target.closest(".creator-cockpit")) return;
    const fieldEl = event.target.closest("[data-cockpit-field]");
    if (!fieldEl) return;
    const key = fieldEl.dataset.cockpitField;
    if (key?.startsWith("selling-")) {
      cockpit.sellingPoints[Number(key.split("-")[1])] = fieldEl.value;
    } else {
      cockpit[key] = fieldEl.value;
    }
    saveDraft();
    if (key === "logline") scheduleSummarySave();
    if (["target", "duration", "type", "magicNote"].includes(key) || key?.startsWith("selling-")) {
      scheduleBriefSave();
    }
  });

  content.addEventListener("change", (event) => {
    const fieldEl = event.target.closest("[data-cockpit-field]");
    if (!fieldEl || !event.target.closest(".creator-cockpit")) return;
    cockpit[fieldEl.dataset.cockpitField] = fieldEl.value;
    saveDraft();
  });
}

bindCockpitEvents();
registerView("creatorCockpit", {
  creatorCockpit,
  refreshCockpitData,
  invalidateCockpitData,
  navigateCockpit,
  selectCockpitSegment,
  getCockpitDraft,
  patchCockpitDraft,
  rerenderCockpit,
  scheduleSummarySave,
  scheduleBriefSave
});
