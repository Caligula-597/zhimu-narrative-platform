import "./tabletop-map.css";
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { studioStore, worldStore } from "../state/index.js";
import * as F from "../utils/format.js";
import { bindTabletopMapCanvas } from "./tabletop-map-canvas.js";
import {
  CONDITION_OPERATORS,
  VARIABLE_COLORS,
  evaluateEndings,
  normalizeMapDesign,
  touchMapDesign
} from "./tabletop-map-model.js";
import {
  COMMON_COMBAT_CONDITIONS,
  COMMON_DICE_SIDES,
  addTabletopCondition,
  applyTabletopHpChange,
  normalizeCombatantStats,
  normalizeTabletopSystem,
  removeTabletopCondition,
  resetTabletopCombat,
  resolveTabletopAttack,
  rollTabletopCheck,
  skipTabletopTurn,
  startTabletopCombat,
  tabletopCombatState
} from "../../shared/tabletop-system.js";

const escapeHtml = F.escapeHtml || ((value = "") => String(value));
const LOCAL_DRAFT_PREFIX = "zhimuTabletopMapDraft";
const LOCATION_TYPES = ["室内场景", "公共场景", "探索场景", "危险场景", "机关场景", "休整场景"];
const MAP_ZOOM_MIN = 0.6;
const MAP_ZOOM_MAX = 2;
const MAP_ZOOM_STEP = 0.1;

function mapPanLimit(zoom) {
  const normalized = Math.max(1, Math.min(MAP_ZOOM_MAX, Number(zoom) || 1));
  return Math.min(0.25, Math.max(0, (normalized - 1) / normalized / 2));
}

let mapSession = null;
let saving = false;
let draftPersistTimer = null;

function icon(name) {
  const paths = {
    add: '<path d="M12 5v14M5 12h14"/>',
    route: '<circle cx="6" cy="7" r="2.5"/><circle cx="18" cy="5" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="m8.5 6.6 7-1.2M7.4 9l8 7"/>',
    rotateLeft: '<path d="M4 8V4m0 0h4M4.5 4.5a8 8 0 1 1-1 9.5"/>',
    rotateRight: '<path d="M20 8V4m0 0h-4m3.5.5a8 8 0 1 0 1 9.5"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5M8 11h6"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5M8 11h6m-3-3v6"/>',
    height: '<path d="m5 17 7 4 7-4M5 12l7 4 7-4M5 7l7-4 7 4-7 4-7-4Z"/>',
    grid: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 4v16"/>',
    reset: '<path d="M4 7V3m0 0h4M4.6 3.8A9 9 0 1 1 3 15"/>',
    save: '<path d="M5 4h11l3 3v13H5V4Z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
    spark: '<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/>',
    upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 15v5h14v-5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="2"/><path d="m21 15-5-5L5 20"/>',
    blank: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16M16 4v16M4 8h16M4 16h16"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>'
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.spark}</svg>`;
}

function draftKey() {
  return `${LOCAL_DRAFT_PREFIX}:${zhimuApi.context.worldId || "prototype"}`;
}

function readLocalDraft(system) {
  try {
    const raw = localStorage.getItem(draftKey());
    return raw ? normalizeMapDesign(JSON.parse(raw), { system }) : null;
  } catch {
    return null;
  }
}

function writeLocalDraft() {
  if (!mapSession?.design) return;
  try {
    localStorage.setItem(draftKey(), JSON.stringify(mapSession.design));
  } catch {
    // Local draft persistence is best effort; explicit cloud save still works.
  }
}

function persistLocalDraft({ immediate = false } = {}) {
  if (draftPersistTimer) {
    window.clearTimeout(draftPersistTimer);
    draftPersistTimer = null;
  }
  if (immediate) {
    writeLocalDraft();
    return;
  }
  draftPersistTimer = window.setTimeout(() => {
    draftPersistTimer = null;
    writeLocalDraft();
  }, 180);
}

window.addEventListener("pagehide", () => persistLocalDraft({ immediate: true }));

function markInlineDraft() {
  if (!mapSession?.design) return;
  mapSession.design.updatedAt = new Date().toISOString();
  mapSession.dirty = true;
  persistLocalDraft();
}

function timestamp(value) {
  const number = Date.parse(value || "");
  return Number.isFinite(number) ? number : 0;
}

function initializeSession() {
  const worldId = zhimuApi.context.worldId || "prototype";
  if (mapSession?.worldId === worldId) return mapSession;
  const settings = studioStore.get().cloudStudio?.world?.settings || {};
  const cloud = settings.tabletopMapDesign;
  const cloudDesign = cloud ? normalizeMapDesign(cloud, { system: settings.tabletopSystem }) : null;
  const localDesign = readLocalDraft(settings.tabletopSystem);
  const localIsNewer = localDesign && (!cloudDesign || timestamp(localDesign.updatedAt) > timestamp(cloudDesign.updatedAt));
  const design = localIsNewer
    ? localDesign
    : normalizeMapDesign(cloudDesign || localDesign || {}, { system: settings.tabletopSystem });
  mapSession = {
    worldId,
    design,
    selectedId: design.locations[0]?.id || "",
    dirty: Boolean(localIsNewer),
    routeMode: false,
    routeStartId: "",
    inspectorTab: "location",
    combatVariableId: design.variables[0]?.id || "",
    combatVariableDelta: 5,
    checkMode: "normal",
    checkBonus: 0,
    hpTargetId: design.system.players?.[0]?.id || design.system.player?.id || "",
    hpDelta: 5,
    conditionTargetId: design.system.players?.[0]?.id || design.system.player?.id || "",
    conditionLabel: COMMON_COMBAT_CONDITIONS[0],
    conditionRounds: 2,
    canvasView: { rotation: 0, zoom: 1, panX: 0, panY: 0, height: 1, grid: false }
  };
  return mapSession;
}

function replaceDesign(nextDesign, { dirty = true } = {}) {
  const session = initializeSession();
  session.design = touchMapDesign(nextDesign);
  session.dirty = dirty;
  if (!session.design.locations.some((location) => location.id === session.selectedId)) {
    session.selectedId = session.design.locations[0]?.id || "";
  }
  persistLocalDraft();
  return session.design;
}

function selectedLocation() {
  const session = initializeSession();
  return session.design.locations.find((location) => location.id === session.selectedId) || session.design.locations[0];
}

function effectSummary(location, variables) {
  const metadata = new Map(variables.map((variable) => [variable.id, variable]));
  const entries = Object.entries(location.effects || {})
    .filter(([, value]) => Number(value) !== 0)
    .map(([key, value]) => `${metadata.get(key)?.label || key}${Number(value) > 0 ? "+" : ""}${Number(value)}`);
  return entries.join(" · ") || "无数值变化";
}

function locationRail(session) {
  return `<aside class="map-location-rail" aria-label="地点与路线">
    <div class="map-panel-heading">
      <div><h2>地点与路线</h2><p>拖动地图标记可调整位置</p></div>
      <div class="map-heading-actions">
        <button type="button" class="map-icon-button" data-action="map-add-location" aria-label="新增地点" title="新增地点">${icon("add")}</button>
        <button type="button" class="map-icon-button${session.routeMode ? " is-active" : ""}" data-action="map-toggle-route-mode" aria-pressed="${session.routeMode}" aria-label="管理路线" title="管理路线">${icon("route")}</button>
      </div>
    </div>
    ${session.routeMode ? `<div class="map-route-mode" role="status"><strong>${session.routeStartId ? "再选一个地点" : "选择路线起点"}</strong><span>${session.routeStartId ? "再次选择可连线或移除已有路线" : "在清单或地图上选择第一个地点"}</span></div>` : ""}
    <div class="map-location-list">
      ${session.design.locations.map((location, index) => `<button type="button" class="map-location-item${location.id === session.selectedId ? " is-selected" : ""}${location.id === session.routeStartId ? " is-route-start" : ""}" data-action="map-select-location" data-location-id="${escapeHtml(location.id)}">
        <span class="map-location-index">${index + 1}</span>
        <span class="map-location-copy"><strong>${escapeHtml(location.name)}</strong><small>${escapeHtml(location.type)}</small><em>${escapeHtml(effectSummary(location, session.design.variables))}</em></span>
      </button>`).join("")}
    </div>
    <button type="button" class="secondary-btn map-route-button${session.routeMode ? " is-active" : ""}" data-action="map-toggle-route-mode">${icon("route")}<span>${session.routeMode ? "退出路线管理" : "管理路线"}</span></button>
  </aside>`;
}

function toolbarButton(operation, iconName, label, active = null, disabled = false) {
  const pressed = typeof active === "boolean" ? ` aria-pressed="${active}"` : "";
  return `<button type="button" class="map-tool-button${active ? " is-active" : ""}" data-action="map-canvas-view" data-map-operation="${operation}" aria-label="${label}" title="${label}"${pressed}${disabled ? " disabled" : ""}>${icon(iconName)}<span>${label}</span></button>`;
}

function canvasModeButton(mode, iconName, label, active = false) {
  const action = mode === "custom" ? "map-open-background-upload" : "map-set-canvas-mode";
  return `<button type="button" class="map-tool-button${active ? " is-active" : ""}" data-action="${action}" data-map-canvas-mode="${mode}" aria-pressed="${active}">${icon(iconName)}<span>${label}</span></button>`;
}

function mapCanvas(session) {
  const view = session.canvasView;
  const canvas = session.design.canvas;
  const zoomPercent = Math.round(view.zoom * 100);
  const status = session.dirty ? "有未保存修改" : session.design.savedAt ? "云端已保存" : "本地草稿";
  const sourceLabel = canvas.mode === "custom"
    ? canvas.fileName || "自定义底图"
    : canvas.mode === "blank"
      ? "空白画布"
      : "示例底图";
  return `<main class="map-canvas-panel" data-map-zoom="${view.zoom.toFixed(2)}" data-map-rotation="${view.rotation}" data-map-pan-x="${Number(view.panX || 0).toFixed(3)}" data-map-pan-y="${Number(view.panY || 0).toFixed(3)}">
    <div class="map-canvas-toolbar" aria-label="地图视角控制">
      <div class="map-tool-group map-source-tools">
        ${canvasModeButton("template", "image", "示例", canvas.mode === "template")}
        ${canvasModeButton("custom", "upload", canvas.mode === "custom" ? "换底图" : "上传", canvas.mode === "custom")}
        ${canvasModeButton("blank", "blank", "空白", canvas.mode === "blank")}
      </div>
      <label class="map-grid-select"><span>格线</span><select data-map-grid-type aria-label="地图格线类型">
        <option value="square"${canvas.gridType === "square" ? " selected" : ""}>方格</option>
        <option value="hex"${canvas.gridType === "hex" ? " selected" : ""}>六边格</option>
        <option value="none"${canvas.gridType === "none" ? " selected" : ""}>无</option>
      </select></label>
      <div class="map-tool-group">
        ${toolbarButton("rotate-left", "rotateLeft", "左旋")}
        ${toolbarButton("rotate-right", "rotateRight", "右旋")}
      </div>
      <div class="map-tool-group map-zoom-tools" aria-label="地图缩放">
        ${toolbarButton("zoom-out", "zoomOut", "缩小地图", null, view.zoom <= MAP_ZOOM_MIN)}
        <output class="map-zoom-value" data-map-zoom-output aria-live="polite">${zoomPercent}%</output>
        ${toolbarButton("zoom-in", "zoomIn", "放大地图", null, view.zoom >= MAP_ZOOM_MAX)}
      </div>
      <div class="map-tool-group">
        ${toolbarButton("height", "height", `高度 ${view.height.toFixed(2)}×`, view.height !== 1)}
        ${toolbarButton("grid", "grid", "网格", view.grid)}
      </div>
      <div class="map-tool-group">${toolbarButton("reset", "reset", "复位")}</div>
    </div>
    <div class="map-canvas-wrap${session.routeMode ? " is-route-mode" : ""}">
      <canvas data-tabletop-map-canvas aria-label="${escapeHtml(session.design.title)}地图画布。可拖动地点标记调整位置。"></canvas>
      <div class="map-canvas-tip">${session.routeMode ? "依次选择两个地点以切换路线" : canvas.mode === "blank" ? "空白画布：拖动地点 · 滚轮缩放 · 放大后拖动空白处平移" : "拖动标记调整地点 · 滚轮缩放 · 放大后拖动空白处平移"}</div>
    </div>
    <footer class="map-canvas-status" aria-label="地图状态">
      <span><b>${session.design.locations.length}</b> 个地点</span>
      <span><b>${session.design.routes.length}</b> 条路线</span>
      <span title="${escapeHtml(sourceLabel)}"><b>${escapeHtml(sourceLabel)}</b></span>
      <span class="${session.dirty ? "is-dirty" : "is-saved"}">${session.dirty ? "●" : "✓"} ${status}</span>
    </footer>
  </main>`;
}

function signedValue(value) {
  const number = Number(value) || 0;
  return number > 0 ? `+${number}` : String(number);
}

function locationCheckCard(check) {
  const modeLabel = { normal: "普通", advantage: "优势", disadvantage: "劣势" };
  return `<article class="map-location-check-card" data-map-location-check="${escapeHtml(check.id)}">
    <div class="map-location-check-head">
      <label class="map-field"><span>判定名称</span><input class="field" maxlength="80" value="${escapeHtml(check.label)}" data-map-location-check-field="label" data-check-id="${escapeHtml(check.id)}"></label>
      <button type="button" class="map-mini-button danger-text" data-action="map-delete-location-check" data-check-id="${escapeHtml(check.id)}" aria-label="删除判定">${icon("trash")}</button>
    </div>
    <label class="map-field"><span>玩家行动提示</span><textarea class="field" rows="2" maxlength="240" data-map-location-check-field="instruction" data-check-id="${escapeHtml(check.id)}">${escapeHtml(check.instruction)}</textarea></label>
    <div class="map-location-check-numbers">
      <label class="map-field"><span>难度</span><input class="field" type="number" min="-9999" max="9999" step="1" value="${check.target}" data-map-location-check-field="target" data-check-id="${escapeHtml(check.id)}"></label>
      <label class="map-field"><span>加值</span><input class="field" type="number" min="-999" max="999" step="1" value="${check.bonus}" data-map-location-check-field="bonus" data-check-id="${escapeHtml(check.id)}"></label>
      <label class="map-field"><span>模式</span><select class="field" data-map-location-check-field="rollMode" data-check-id="${escapeHtml(check.id)}">${Object.entries(modeLabel).map(([value, label]) => `<option value="${value}"${check.rollMode === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
    </div>
    <label class="map-field"><span>成功结果</span><textarea class="field" rows="2" maxlength="240" data-map-location-check-field="successText" data-check-id="${escapeHtml(check.id)}">${escapeHtml(check.successText)}</textarea></label>
    <label class="map-field"><span>失败代价</span><textarea class="field" rows="2" maxlength="240" data-map-location-check-field="failureText" data-check-id="${escapeHtml(check.id)}">${escapeHtml(check.failureText)}</textarea></label>
  </article>`;
}

function locationInspector(session, location) {
  if (!location) return `<section class="map-inspector-section"><p>暂无地点，请先新增地点。</p></section>`;
  const encounterNpcs = session.design.system.npcs || [];
  return `<section class="map-inspector-section map-location-inspector">
    <div class="map-inspector-heading"><div><h2>地点设置</h2><p>位置可直接在沙盘中拖动</p></div><button type="button" class="text-btn danger-text" data-action="map-delete-location" data-location-id="${escapeHtml(location.id)}">删除</button></div>
    <label class="map-field"><span>名称</span><input class="field" maxlength="80" value="${escapeHtml(location.name)}" data-map-location-field="name"></label>
    <label class="map-field"><span>类型</span><select class="field" data-map-location-field="type">${LOCATION_TYPES.map((type) => `<option value="${escapeHtml(type)}"${type === location.type ? " selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label>
    <label class="map-field"><span>高度</span><input class="field" type="number" min="0" max="8" step="1" value="${location.z}" data-map-location-field="z"></label>
    <label class="map-field"><span>对应运行段落 Key</span><input class="field" maxlength="120" placeholder="例如 ch1；主持切换此段时自动定位" value="${escapeHtml(location.segmentKey || "")}" data-map-location-field="segmentKey"></label>
    <label class="map-field"><span>玩家可见描述</span><textarea class="field" rows="3" maxlength="360" data-map-location-field="description">${escapeHtml(location.description)}</textarea></label>
    <label class="map-field"><span>主持备注</span><textarea class="field" rows="3" maxlength="360" data-map-location-field="hostNotes">${escapeHtml(location.hostNotes || "")}</textarea></label>
    <div class="map-effect-editor">
      <div><strong>到达影响</strong><small>每个地点都能改变创作者定义的变量</small></div>
      <div class="map-effect-grid">
        ${session.design.variables.map((variable) => {
          const span = variable.max - variable.min;
          return `<label><span>${escapeHtml(variable.label)}</span><input class="field" type="number" min="${-span}" max="${span}" step="1" value="${Number(location.effects?.[variable.id] || 0)}" data-map-effect="${escapeHtml(variable.id)}"><em>${signedValue(location.effects?.[variable.id])}</em></label>`;
        }).join("")}
      </div>
      <button type="button" class="secondary-btn full-btn" data-action="map-simulate-location" data-location-id="${escapeHtml(location.id)}">${icon("spark")}<span>模拟玩家到达</span></button>
    </div>
    <div class="map-location-check-editor">
      <div class="map-location-check-title"><div><strong>地点判定</strong><small>预设主持端可直接发起的行动与成功/失败导向</small></div><button type="button" class="secondary-btn compact" data-action="map-add-location-check"${location.checks?.length >= 6 ? " disabled" : ""}>新增判定</button></div>
      ${location.checks?.length ? location.checks.map(locationCheckCard).join("") : `<div class="map-condition-empty">尚未设置判定。主持人仍可临场创建，也可以在这里预设最多 6 项。</div>`}
    </div>
    <div class="map-encounter-editor">
      <div><strong>地点遭遇</strong><small>勾选会在这里登场的 NPC；先攻开始后按回合运行</small></div>
      ${encounterNpcs.length ? `<div class="map-encounter-list">${encounterNpcs.map((npc) => `<label><input type="checkbox" data-map-location-npc data-npc-id="${escapeHtml(npc.id)}"${location.encounterNpcIds?.includes(npc.id) ? " checked" : ""}><span><b>${escapeHtml(npc.name)}</b><small>${escapeHtml(npc.role)} · HP ${npc.hp}/${npc.maxHp}</small></span></label>`).join("")}</div>` : `<div class="map-condition-empty">先在「检定与对战」中添加 NPC。</div>`}
      <button type="button" class="primary-btn full-btn" data-action="map-start-encounter" data-location-id="${escapeHtml(location.id)}"${location.encounterNpcIds?.length ? "" : " disabled"}>开始此处遭遇</button>
    </div>
  </section>`;
}

function variableMeter(variable, total) {
  const percentage = Math.round((variable.value - variable.min) / Math.max(1, variable.max - variable.min) * 100);
  return `<article class="map-variable-card" data-map-variable-card="${escapeHtml(variable.id)}">
    <div class="map-variable-card-head">
      <input type="color" value="${escapeHtml(variable.color)}" data-map-variable-field="color" data-variable-id="${escapeHtml(variable.id)}" aria-label="${escapeHtml(variable.label)}颜色">
      <input class="field map-variable-name" maxlength="24" value="${escapeHtml(variable.label)}" data-map-variable-field="label" data-variable-id="${escapeHtml(variable.id)}" aria-label="变量名称">
      <output data-map-variable-output="${escapeHtml(variable.id)}">${variable.value}</output>
      <button type="button" class="map-mini-button danger-text" data-action="map-delete-variable" data-variable-id="${escapeHtml(variable.id)}"${total <= 1 ? " disabled" : ""} aria-label="删除变量">${icon("trash")}</button>
    </div>
    <input class="map-variable-slider" type="range" min="${variable.min}" max="${variable.max}" step="1" value="${variable.value}" data-map-variable-value="${escapeHtml(variable.id)}" style="--map-meter:${percentage}%;--map-meter-color:${escapeHtml(variable.color)}" aria-label="${escapeHtml(variable.label)}当前值">
    <div class="map-variable-bounds">
      <label><span>最小</span><input class="field" type="number" min="-9999" max="${variable.max - 1}" value="${variable.min}" data-map-variable-field="min" data-variable-id="${escapeHtml(variable.id)}"></label>
      <label><span>最大</span><input class="field" type="number" min="${variable.min + 1}" max="9999" value="${variable.max}" data-map-variable-field="max" data-variable-id="${escapeHtml(variable.id)}"></label>
    </div>
  </article>`;
}

function gapLabel(condition) {
  if (condition.matched) return "已满足";
  if (condition.operator === "!=") return `需不同于 ${condition.threshold}`;
  return `距离条件 ${Math.round(condition.gap)}`;
}

function conditionRow(condition, variables, endingId) {
  const variable = variables.find((item) => item.id === condition.variableId) || variables[0];
  return `<div class="map-condition-row${condition.matched ? " is-met" : ""}">
    <select class="field" data-map-condition-field="variableId" data-ending-id="${escapeHtml(endingId)}" data-condition-id="${escapeHtml(condition.id)}" aria-label="条件变量">
      ${variables.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === condition.variableId ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
    </select>
    <select class="field" data-map-condition-field="operator" data-ending-id="${escapeHtml(endingId)}" data-condition-id="${escapeHtml(condition.id)}" aria-label="判断符">
      ${CONDITION_OPERATORS.map((operator) => `<option value="${operator}"${operator === condition.operator ? " selected" : ""}>${operator}</option>`).join("")}
    </select>
    <input class="field" type="number" min="${variable?.min ?? 0}" max="${variable?.max ?? 100}" value="${condition.threshold}" data-map-condition-field="value" data-ending-id="${escapeHtml(endingId)}" data-condition-id="${escapeHtml(condition.id)}" aria-label="条件值">
    <button type="button" class="map-mini-button danger-text" data-action="map-delete-condition" data-ending-id="${escapeHtml(endingId)}" data-condition-id="${escapeHtml(condition.id)}" aria-label="删除条件">${icon("trash")}</button>
    <small>${escapeHtml(gapLabel(condition))}</small>
  </div>`;
}

function endingCard(result, likelyId, variables) {
  const active = result.id === likelyId;
  return `<article class="map-ending-card is-${escapeHtml(result.tone)}${active ? " is-likely" : ""}">
    <div class="map-ending-head">
      <div>${active ? `<span>${icon("spark")} ${result.eligible ? "当前触发" : "当前最接近"}</span>` : ""}<input class="field map-ending-name" maxlength="60" value="${escapeHtml(result.name)}" data-map-ending-field="name" data-ending-id="${escapeHtml(result.id)}" aria-label="结局名称"></div>
      <div class="map-ending-score"><b>${result.readiness}%</b><button type="button" class="map-mini-button danger-text" data-action="map-delete-ending" data-ending-id="${escapeHtml(result.id)}" aria-label="删除结局">${icon("trash")}</button></div>
    </div>
    <textarea class="field map-ending-summary" rows="2" maxlength="300" data-map-ending-field="summary" data-ending-id="${escapeHtml(result.id)}" aria-label="结局说明">${escapeHtml(result.summary)}</textarea>
    <div class="map-ending-options">
      <label><span>条件关系</span><select class="field" data-map-ending-field="logic" data-ending-id="${escapeHtml(result.id)}"><option value="all"${result.logic === "all" ? " selected" : ""}>全部满足 AND</option><option value="any"${result.logic === "any" ? " selected" : ""}>任一满足 OR</option></select></label>
      <label><span>优先级</span><input class="field" type="number" min="-99" max="99" value="${result.priority}" data-map-ending-field="priority" data-ending-id="${escapeHtml(result.id)}"></label>
      <label><span>语气</span><select class="field" data-map-ending-field="tone" data-ending-id="${escapeHtml(result.id)}"><option value="neutral"${result.tone === "neutral" ? " selected" : ""}>中性</option><option value="resolve"${result.tone === "resolve" ? " selected" : ""}>达成</option><option value="cost"${result.tone === "cost" ? " selected" : ""}>代价</option><option value="danger"${result.tone === "danger" ? " selected" : ""}>危机</option></select></label>
    </div>
    <div class="map-condition-list">
      ${result.conditions.length ? result.conditions.map((condition) => conditionRow(condition, variables, result.id)).join("") : `<div class="map-condition-empty">尚无条件，这个结局不会自动触发。</div>`}
    </div>
    <button type="button" class="map-add-condition" data-action="map-add-condition" data-ending-id="${escapeHtml(result.id)}">${icon("add")} 添加条件</button>
    <div class="map-ending-progress"><i style="width:${result.readiness}%"></i></div>
  </article>`;
}

function endingInspector(session) {
  const evaluation = evaluateEndings(session.design);
  return `<section class="map-inspector-section map-ending-inspector">
    <div class="map-inspector-heading"><div><h2>变量与结局</h2><p>系统只执行判断，不预设创作者的故事答案</p></div><button type="button" class="map-icon-button" data-action="map-add-variable" aria-label="新增变量" title="新增变量">${icon("add")}</button></div>
    <div class="map-variable-list">
      ${session.design.variables.map((variable) => variableMeter(variable, session.design.variables.length)).join("")}
    </div>
    <div class="map-ending-builder-head"><div><strong>结局判断器</strong><small>条件可使用 AND／OR，优先级解决多结局同时触发</small></div><button type="button" class="secondary-btn" data-action="map-add-ending">${icon("add")} 新增结局</button></div>
    <div class="map-likely-ending">${evaluation.likely ? `${evaluation.likely.eligible ? "当前触发" : "当前最接近"}：<strong>${escapeHtml(evaluation.likely.name)}</strong>` : "尚未定义结局，添加后再组合触发条件。"}</div>
    <div class="map-ending-list">${evaluation.results.length ? evaluation.results.map((result) => endingCard(result, evaluation.likely?.id, session.design.variables)).join("") : `<div class="map-rule-empty"><strong>没有预设结局</strong><span>由创作者添加结局，并用条件判断器决定何时触发。</span><button type="button" class="secondary-btn" data-action="map-add-ending">创建第一个结局</button></div>`}</div>
    <p class="map-threshold-note">判断器会实时模拟，但不会替你生成或锁定结局内容；名称、叙述、变量和触发线都由创作者决定。</p>
  </section>`;
}

function healthPercent(combatant) {
  return Math.round(Math.max(0, Math.min(100, combatant.hp / Math.max(1, combatant.maxHp) * 100)));
}

function combatantCard(combatant, { npc = false, active = false, initiative = null } = {}) {
  const defeated = combatant.hp <= 0;
  return `<article class="map-combatant-card${defeated ? " is-defeated" : ""}${active ? " is-active" : ""}">
    <div class="map-combatant-head"><div><span>${active ? "当前回合 · " : ""}${npc ? "NPC" : "玩家角色"}${initiative == null ? "" : ` · 先攻 ${initiative}`}</span><strong>${escapeHtml(combatant.name)}</strong><small>${escapeHtml(combatant.role)}</small></div><b>${combatant.hp} / ${combatant.maxHp}</b></div>
    <div class="map-hp-track"><i style="width:${healthPercent(combatant)}%"></i></div>
    <dl><div><dt>攻击</dt><dd>${combatant.attack}</dd></div><div><dt>防御</dt><dd>${combatant.defense}</dd></div><div><dt>伤害</dt><dd>${combatant.damage}</dd></div><div><dt>先攻</dt><dd>${combatant.initiative}</dd></div></dl>
    ${combatant.conditions?.length ? `<div class="map-status-chips">${combatant.conditions.map((condition) => `<button type="button" data-action="map-remove-status" data-combatant-id="${escapeHtml(combatant.id)}" data-condition-id="${escapeHtml(condition.id)}" title="移除状态">${escapeHtml(condition.label)} · ${condition.rounds}R ×</button>`).join("")}</div>` : ""}
  </article>`;
}

function combatantEditor(combatant, { npc = false } = {}) {
  const id = escapeHtml(combatant.id);
  return `<section class="map-combatant-editor">
    <div class="map-combatant-editor-head"><strong>${npc ? "NPC 数值" : "玩家数值"}</strong>${npc ? `<button type="button" class="text-btn danger-text" data-action="map-delete-npc" data-npc-id="${id}">删除</button>` : ""}</div>
    <div class="map-combatant-identity">
      <label><span>名称</span><input class="field" maxlength="60" value="${escapeHtml(combatant.name)}" data-map-combatant-field="name" data-combatant-id="${id}"></label>
      <label><span>定位</span><input class="field" maxlength="80" value="${escapeHtml(combatant.role)}" data-map-combatant-field="role" data-combatant-id="${id}"></label>
    </div>
    <div class="map-combatant-stats">
      <label><span>当前 HP</span><input class="field" type="number" min="0" max="${combatant.maxHp}" value="${combatant.hp}" data-map-combatant-field="hp" data-combatant-id="${id}"></label>
      <label><span>HP 上限</span><input class="field" type="number" min="1" max="9999" value="${combatant.maxHp}" data-map-combatant-field="maxHp" data-combatant-id="${id}"></label>
      <label><span>攻击</span><input class="field" type="number" min="-99" max="999" value="${combatant.attack}" data-map-combatant-field="attack" data-combatant-id="${id}"></label>
      <label><span>防御</span><input class="field" type="number" min="-9" max="999" value="${combatant.defense}" data-map-combatant-field="defense" data-combatant-id="${id}"></label>
      <label><span>伤害</span><input class="field" type="number" min="1" max="999" value="${combatant.damage}" data-map-combatant-field="damage" data-combatant-id="${id}"></label>
      <label><span>先攻</span><input class="field" type="number" min="-99" max="999" value="${combatant.initiative}" data-map-combatant-field="initiative" data-combatant-id="${id}"></label>
    </div>
  </section>`;
}

function checkResultCard(result) {
  if (!result) return `<div class="map-check-empty">尚未进行检定</div>`;
  const mode = result.rollMode === "advantage" ? "优势" : result.rollMode === "disadvantage" ? "劣势" : "普通";
  const attempts = result.attempts?.length > 1 ? ` · 两组 ${result.attempts.map((rolls) => `[${rolls.join("+")}]`).join(" / ")}` : "";
  const margin = Number(result.margin || 0);
  const marginCopy = margin >= 0 ? `高于难度 ${margin}` : `低于难度 ${Math.abs(margin)}`;
  const degreeLabel = result.degreeLabel || (result.success ? "成功" : "失败");
  return `<div class="map-check-result ${result.success ? "is-success" : "is-failure"}"><div><span>${escapeHtml(result.label)}</span><strong>${result.total}</strong></div><p>${mode} · 骰面 ${result.rolls.join(" + ")} · 目标 ${result.target} · ${marginCopy}${attempts}</p><b>${escapeHtml(degreeLabel)}</b></div>`;
}

function checkOutcomeLink(session, result) {
  if (!result || !session.design.variables.length) return "";
  const selectedId = session.design.variables.some((variable) => variable.id === session.combatVariableId)
    ? session.combatVariableId
    : session.design.variables[0].id;
  return `<div class="map-check-link"><span>写入结局变量</span><select class="field" data-map-combat-variable>${session.design.variables.map((variable) => `<option value="${escapeHtml(variable.id)}"${variable.id === selectedId ? " selected" : ""}>${escapeHtml(variable.label)}</option>`).join("")}</select><input class="field" type="number" min="1" max="9999" value="${session.combatVariableDelta}" data-map-combat-delta aria-label="变量变化量"><button type="button" class="secondary-btn" data-action="map-apply-check-variable">${result.success ? "+" : "−"}${Math.abs(session.combatVariableDelta)}</button></div>`;
}

function combatOutcomeLink(session, combat) {
  if (!combat.outcome || !session.design.variables.length) return "";
  const variable = session.design.variables.find((item) => item.id === session.combatVariableId) || session.design.variables[0];
  const delta = combat.outcome === "victory" ? Math.abs(session.combatVariableDelta) : -Math.abs(session.combatVariableDelta);
  return `<div class="map-combat-outcome is-${combat.outcome}"><strong>${combat.outcome === "victory" ? "遭遇胜利" : "队伍失去战斗能力"}</strong><span>${combat.outcomeApplied ? `已写入「${escapeHtml(variable.label)}」` : `可将结果写入「${escapeHtml(variable.label)}」${signedValue(delta)}`}</span><button type="button" class="secondary-btn" data-action="map-apply-combat-outcome"${combat.outcomeApplied ? " disabled" : ""}>${combat.outcomeApplied ? "已写入" : "写入结局变量"}</button></div>`;
}

function combatRoster(system) {
  const activeId = system.combat.initiativeOrder[system.combat.activeIndex];
  const orderedIds = system.combat.initiativeOrder.length
    ? system.combat.initiativeOrder
    : [...system.players, ...system.npcs].map((combatant) => combatant.id);
  const combatants = new Map([...system.players, ...system.npcs].map((combatant) => [combatant.id, combatant]));
  return `<div class="map-combat-roster">${orderedIds.map((id) => {
    const combatant = combatants.get(id);
    if (!combatant) return "";
    return combatantCard(combatant, {
      npc: system.npcs.some((npc) => npc.id === id),
      active: id === activeId,
      initiative: system.combat.initiativeRolls[id] ?? null
    });
  }).join("")}</div>`;
}

function combatUtilityPanel(session, system) {
  const participants = [...system.players, ...system.npcs];
  const hpTargetId = participants.some((item) => item.id === session.hpTargetId) ? session.hpTargetId : participants[0]?.id || "";
  const conditionTargetId = participants.some((item) => item.id === session.conditionTargetId) ? session.conditionTargetId : participants[0]?.id || "";
  const options = (selectedId) => participants.map((combatant) => `<option value="${escapeHtml(combatant.id)}"${combatant.id === selectedId ? " selected" : ""}>${escapeHtml(combatant.name)} · HP ${combatant.hp}/${combatant.maxHp}</option>`).join("");
  return `<section class="map-combat-utility">
    <div class="map-quick-adjust"><strong>即时调整</strong><select class="field" data-map-hp-target>${options(hpTargetId)}</select><input class="field" type="number" min="1" max="9999" value="${session.hpDelta}" data-map-hp-delta aria-label="HP 调整数值"><button type="button" class="secondary-btn danger-text" data-action="map-adjust-hp" data-hp-direction="-1">伤害</button><button type="button" class="secondary-btn" data-action="map-adjust-hp" data-hp-direction="1">治疗</button></div>
    <div class="map-status-editor"><strong>状态效果</strong><select class="field" data-map-condition-target>${options(conditionTargetId)}</select><select class="field" data-map-condition-label>${COMMON_COMBAT_CONDITIONS.map((label) => `<option value="${escapeHtml(label)}"${label === session.conditionLabel ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select><label><input class="field" type="number" min="1" max="99" value="${session.conditionRounds}" data-map-condition-rounds aria-label="持续回合"> 回合</label><button type="button" class="secondary-btn" data-action="map-add-status">添加状态</button></div>
  </section>`;
}

function combatInspector(session) {
  const state = tabletopCombatState(session.design.system);
  const system = state.system;
  const active = state.active;
  const activeIsNpc = active && system.npcs.some((npc) => npc.id === active.id);
  const activeNpcIds = new Set(system.combat.activeNpcIds);
  const targets = activeIsNpc
    ? system.players.filter((player) => player.hp > 0)
    : system.npcs.filter((npc) => activeNpcIds.has(npc.id) && npc.hp > 0);
  const target = targets.find((combatant) => combatant.id === system.combat.targetId) || targets[0] || null;
  const dice = system.dice;
  const notation = `${dice.count}d${dice.sides}${dice.modifier > 0 ? `+${dice.modifier}` : dice.modifier < 0 ? dice.modifier : ""}`;
  return `<section class="map-inspector-section map-combat-inspector">
    <div class="map-inspector-heading"><div><h2>检定与遭遇</h2><p>队伍先攻、回合行动、状态与结局变量联动</p></div><button type="button" class="map-icon-button" data-action="map-add-npc" aria-label="新增 NPC" title="新增 NPC">${icon("add")}</button></div>
    <section class="map-dice-panel">
      <div class="map-dice-head"><div><span>默认骰制</span><strong>${escapeHtml(notation)}</strong></div><button type="button" class="primary-btn" data-action="map-roll-check">${icon("spark")} 随机检定</button></div>
      <div class="map-dice-grid">
        <label><span>数量</span><input class="field" type="number" min="1" max="10" value="${dice.count}" data-map-dice-field="count"></label>
        <label><span>面数</span><input class="field" type="number" min="2" max="1000" list="map-dice-sides" value="${dice.sides}" data-map-dice-field="sides"><datalist id="map-dice-sides">${COMMON_DICE_SIDES.map((side) => `<option value="${side}"></option>`).join("")}</datalist></label>
        <label><span>修正</span><input class="field" type="number" min="-999" max="999" value="${dice.modifier}" data-map-dice-field="modifier"></label>
        <label><span>难度</span><input class="field" type="number" min="-9999" max="9999" value="${dice.defaultTarget}" data-map-dice-field="defaultTarget"></label>
        <label><span>情境</span><select class="field" data-map-check-mode><option value="normal"${session.checkMode === "normal" ? " selected" : ""}>普通</option><option value="advantage"${session.checkMode === "advantage" ? " selected" : ""}>优势</option><option value="disadvantage"${session.checkMode === "disadvantage" ? " selected" : ""}>劣势</option></select></label>
        <label><span>临时加值</span><input class="field" type="number" min="-999" max="999" value="${session.checkBonus}" data-map-check-bonus></label>
      </div>
      <div class="map-check-thresholds" aria-label="检定等级阈值"><span><b>差值 ≥ 5</b>强成功</span><span><b>差值 0～4</b>成功</span><span><b>差值 −1～−4</b>失败</span><span><b>差值 ≤ −5</b>严重失败</span></div>
      <p class="map-check-natural-rule">单骰最大面固定为大成功，掷出 1 固定为大失败；差值＝最终总值−难度。</p>
      ${checkResultCard(system.combat.lastCheck)}
      ${checkOutcomeLink(session, system.combat.lastCheck)}
    </section>
    <section class="map-battle-panel">
      <div class="map-battle-head"><div><span>${system.combat.started ? `第 ${system.combat.round} 轮` : "尚未开始"}</span><strong>${system.combat.outcome ? "遭遇已结束" : active ? `${escapeHtml(active.name)}行动` : "等待先攻"}</strong></div><button type="button" class="text-btn" data-action="map-reset-combat">重置对战</button></div>
      ${system.players.length && system.npcs.length ? `${combatRoster(system)}${system.combat.started && !system.combat.outcome && active && target ? `<label class="map-target-select"><span>行动目标</span><select class="field" data-map-combat-target>${targets.map((combatant) => `<option value="${escapeHtml(combatant.id)}"${combatant.id === target.id ? " selected" : ""}>${escapeHtml(combatant.name)} · HP ${combatant.hp}/${combatant.maxHp}</option>`).join("")}</select></label><div class="map-battle-actions"><button type="button" class="primary-btn" data-action="map-active-attack">${escapeHtml(active.name)}攻击</button><button type="button" class="secondary-btn" data-action="map-skip-turn">结束回合</button></div>` : `<button type="button" class="primary-btn full-btn" data-action="map-start-combat">${system.combat.outcome ? "重新掷先攻" : "掷先攻并开始遭遇"}</button>`}${combatOutcomeLink(session, system.combat)}${combatUtilityPanel(session, system)}${active ? combatantEditor(active, { npc: activeIsNpc }) : ""}${target && target.id !== active?.id ? combatantEditor(target, { npc: system.npcs.some((npc) => npc.id === target.id) }) : ""}` : `<div class="map-rule-empty"><strong>需要玩家与 NPC</strong><span>世界创建会自动带入玩家角色；添加 NPC 后即可掷先攻。</span><button type="button" class="secondary-btn" data-action="map-add-npc">添加第一个 NPC</button></div>`}
      <div class="map-combat-log"><strong>对战记录</strong>${system.combat.log.length ? `<ol>${[...system.combat.log].reverse().map((entry) => `<li class="is-${entry.tone}"><span>R${entry.round}</span>${escapeHtml(entry.text)}</li>`).join("")}</ol>` : `<p>行动结果会记录在这里。</p>`}</div>
    </section>
  </section>`;
}

function inspector(session) {
  return `<aside class="map-inspector" aria-label="地图与结局设置">
    <nav class="map-inspector-tabs" aria-label="编辑面板">
      <button type="button" class="${session.inspectorTab === "location" ? "is-active" : ""}" data-action="map-set-inspector-tab" data-map-inspector-tab="location">地点设置</button>
      <button type="button" class="${session.inspectorTab === "rules" ? "is-active" : ""}" data-action="map-set-inspector-tab" data-map-inspector-tab="rules">规则与结局</button>
      <button type="button" class="${session.inspectorTab === "combat" ? "is-active" : ""}" data-action="map-set-inspector-tab" data-map-inspector-tab="combat">检定与对战</button>
    </nav>
    ${session.inspectorTab === "rules" ? endingInspector(session) : session.inspectorTab === "combat" ? combatInspector(session) : locationInspector(session, selectedLocation())}
  </aside>`;
}

export function tabletopMap() {
  const session = initializeSession();
  const worldName = studioStore.get().cloudStudio?.world?.name || "当前剧本";
  const savedLabel = session.design.savedAt
    ? `上次保存：${new Date(session.design.savedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : "尚未保存到云端";
  return `<section class="tabletop-map-page" data-tabletop-map-page>
    <header class="tabletop-map-page-head">
      <div><input class="map-title-input" maxlength="80" value="${escapeHtml(session.design.title)}" data-map-title aria-label="地图名称"><p>为「${escapeHtml(worldName)}」自行搭建地图、叙事变量与结局判断规则。</p></div>
      <div class="tabletop-map-save"><button type="button" class="primary-btn" data-action="map-save"${saving ? " disabled" : ""}>${icon("save")}<span>${saving ? "正在保存…" : "保存草稿"}</span></button><small>${escapeHtml(savedLabel)}</small></div>
    </header>
    <input type="file" accept="image/png,image/jpeg,image/webp" data-map-background-input hidden>
    <div class="tabletop-map-workbench">
      ${locationRail(session)}
      ${mapCanvas(session)}
      ${inspector(session)}
    </div>
  </section>`;
}

export function bindTabletopMapEditor() {
  const root = document.querySelector("[data-tabletop-map-page]");
  if (!root || !mapSession) return;
  const canvas = root.querySelector("[data-tabletop-map-canvas]");
  bindTabletopMapCanvas(canvas, {
    design: mapSession.design,
    selectedId: mapSession.selectedId,
    routeMode: mapSession.routeMode,
    routeStartId: mapSession.routeStartId,
    view: mapSession.canvasView,
    onSelect: (locationId) => selectMapLocation(locationId),
    onMove: (locationId, position, { preview } = {}) => moveMapLocation(locationId, position, { preview }),
    onZoom: (direction) => updateMapCanvasView(direction),
    onPan: (position) => updateMapCanvasPan(position)
  });

  root.querySelectorAll("[data-map-location-field]").forEach((field) => {
    if (["name", "description", "hostNotes", "segmentKey"].includes(field.dataset.mapLocationField)) {
      field.addEventListener("input", () => {
        const location = selectedLocation();
        if (!location) return;
        location[field.dataset.mapLocationField] = field.value;
        markInlineDraft();
      });
    }
    field.addEventListener("change", () => updateSelectedLocationField(field.dataset.mapLocationField, field.value));
  });
  const titleField = root.querySelector("[data-map-title]");
  titleField?.addEventListener("input", () => {
    mapSession.design.title = titleField.value;
    markInlineDraft();
  });
  titleField?.addEventListener("change", (event) => updateMapTitle(event.currentTarget.value));
  root.querySelector("[data-map-grid-type]")?.addEventListener("change", (event) => updateMapGridType(event.currentTarget.value));
  root.querySelector("[data-map-background-input]")?.addEventListener("change", async (event) => {
    const [file] = event.currentTarget.files || [];
    event.currentTarget.value = "";
    if (file) await applyMapBackgroundFile(file);
  });
  root.querySelectorAll("[data-map-effect]").forEach((field) => {
    field.addEventListener("change", () => updateSelectedLocationEffect(field.dataset.mapEffect, field.value));
  });
  root.querySelectorAll("[data-map-location-npc]").forEach((field) => {
    field.addEventListener("change", () => updateSelectedLocationEncounterNpc(field.dataset.npcId, field.checked));
  });
  root.querySelectorAll("[data-map-location-check-field]").forEach((field) => {
    if (field.dataset.mapLocationCheckField !== "rollMode") {
      field.addEventListener("input", () => updateLocationCheckField(
        field.dataset.checkId,
        field.dataset.mapLocationCheckField,
        field.value,
        { preview: true }
      ));
    }
    field.addEventListener("change", () => updateLocationCheckField(
      field.dataset.checkId,
      field.dataset.mapLocationCheckField,
      field.value
    ));
  });
  root.querySelectorAll("[data-map-variable-value]").forEach((field) => {
    field.addEventListener("input", () => {
      const variableId = field.dataset.mapVariableValue;
      const variable = mapSession.design.variables.find((item) => item.id === variableId);
      if (!variable) return;
      const value = Math.round(Math.max(variable.min, Math.min(variable.max, Number(field.value) || 0)));
      updateVariableValue(variableId, value, { preview: true });
      const percentage = Math.round((value - variable.min) / Math.max(1, variable.max - variable.min) * 100);
      field.style.setProperty("--map-meter", `${percentage}%`);
      const output = root.querySelector(`[data-map-variable-output="${variableId}"]`);
      if (output) output.textContent = String(value);
    });
    field.addEventListener("change", () => render());
  });
  root.querySelectorAll("[data-map-variable-field]").forEach((field) => {
    if (field.dataset.mapVariableField === "label") {
      field.addEventListener("input", () => {
        const variable = mapSession.design.variables.find((item) => item.id === field.dataset.variableId);
        if (!variable) return;
        variable.label = field.value;
        markInlineDraft();
      });
    }
    field.addEventListener("change", () => updateVariableField(
      field.dataset.variableId,
      field.dataset.mapVariableField,
      field.value
    ));
  });
  root.querySelectorAll("[data-map-ending-field]").forEach((field) => {
    if (["name", "summary"].includes(field.dataset.mapEndingField)) {
      field.addEventListener("input", () => {
        const ending = mapSession.design.endings.find((item) => item.id === field.dataset.endingId);
        if (!ending) return;
        ending[field.dataset.mapEndingField] = field.value;
        markInlineDraft();
      });
    }
    if (field.dataset.mapEndingField === "priority") {
      field.addEventListener("input", () => {
        const ending = mapSession.design.endings.find((item) => item.id === field.dataset.endingId);
        if (!ending) return;
        ending.priority = Math.round(Number(field.value) || 0);
        markInlineDraft();
      });
    }
    field.addEventListener("change", () => updateEndingField(
      field.dataset.endingId,
      field.dataset.mapEndingField,
      field.value
    ));
  });
  root.querySelectorAll("[data-map-condition-field]").forEach((field) => {
    if (field.dataset.mapConditionField === "value") {
      field.addEventListener("input", () => {
        const ending = mapSession.design.endings.find((item) => item.id === field.dataset.endingId);
        const condition = ending?.conditions.find((item) => item.id === field.dataset.conditionId);
        if (!condition) return;
        condition.value = Math.round(Number(field.value) || 0);
        markInlineDraft();
      });
    }
    field.addEventListener("change", () => updateEndingCondition(
      field.dataset.endingId,
      field.dataset.conditionId,
      field.dataset.mapConditionField,
      field.value
    ));
  });
  root.querySelectorAll("[data-map-dice-field]").forEach((field) => {
    field.addEventListener("change", () => updateMapDiceField(field.dataset.mapDiceField, field.value));
  });
  root.querySelector("[data-map-check-mode]")?.addEventListener("change", (event) => {
    mapSession.checkMode = event.currentTarget.value;
  });
  root.querySelector("[data-map-check-bonus]")?.addEventListener("change", (event) => {
    mapSession.checkBonus = Math.max(-999, Math.min(999, Math.round(Number(event.currentTarget.value) || 0)));
  });
  root.querySelector("[data-map-combat-target]")?.addEventListener("change", (event) => setMapCombatTarget(event.currentTarget.value));
  root.querySelector("[data-map-combat-variable]")?.addEventListener("change", (event) => {
    mapSession.combatVariableId = event.currentTarget.value;
  });
  root.querySelector("[data-map-combat-delta]")?.addEventListener("change", (event) => {
    mapSession.combatVariableDelta = Math.max(1, Math.round(Number(event.currentTarget.value) || 1));
    render();
  });
  root.querySelector("[data-map-hp-target]")?.addEventListener("change", (event) => {
    mapSession.hpTargetId = event.currentTarget.value;
  });
  root.querySelector("[data-map-hp-delta]")?.addEventListener("change", (event) => {
    mapSession.hpDelta = Math.max(1, Math.min(9999, Math.round(Number(event.currentTarget.value) || 1)));
  });
  root.querySelector("[data-map-condition-target]")?.addEventListener("change", (event) => {
    mapSession.conditionTargetId = event.currentTarget.value;
  });
  root.querySelector("[data-map-condition-label]")?.addEventListener("change", (event) => {
    mapSession.conditionLabel = event.currentTarget.value;
  });
  root.querySelector("[data-map-condition-rounds]")?.addEventListener("change", (event) => {
    mapSession.conditionRounds = Math.max(1, Math.min(99, Math.round(Number(event.currentTarget.value) || 1)));
  });
  root.querySelectorAll("[data-map-combatant-field]").forEach((field) => {
    if (["name", "role"].includes(field.dataset.mapCombatantField)) {
      field.addEventListener("input", () => {
        const system = mapSession.design.system;
        const combatant = [...(system.players || [system.player]), ...system.npcs]
          .find((item) => item?.id === field.dataset.combatantId);
        if (!combatant) return;
        combatant[field.dataset.mapCombatantField] = field.value;
        markInlineDraft();
      });
    }
    field.addEventListener("change", () => updateMapCombatantField(
      field.dataset.combatantId,
      field.dataset.mapCombatantField,
      field.value
    ));
  });
}

export function selectMapLocation(locationId) {
  const session = initializeSession();
  if (!session.design.locations.some((location) => location.id === locationId)) return;
  session.selectedId = locationId;
  if (!session.routeMode) {
    session.inspectorTab = "location";
    render();
    return;
  }
  if (!session.routeStartId) {
    session.routeStartId = locationId;
    render();
    showToast("已选择路线起点，请再选择一个地点");
    return;
  }
  if (session.routeStartId === locationId) {
    session.routeStartId = "";
    render();
    return;
  }
  const fromId = session.routeStartId;
  const routeKey = [fromId, locationId].sort().join(":");
  const existing = session.design.routes.findIndex(([from, to]) => [from, to].sort().join(":") === routeKey);
  const routes = [...session.design.routes];
  if (existing >= 0) routes.splice(existing, 1);
  else routes.push([fromId, locationId]);
  session.routeStartId = "";
  replaceDesign({ ...session.design, routes });
  render();
  showToast(existing >= 0 ? "路线已移除" : "路线已连接");
}

export function moveMapLocation(locationId, position, { preview = false } = {}) {
  const session = initializeSession();
  const location = session.design.locations.find((item) => item.id === locationId);
  if (!location) return;
  location.x = Math.max(0.04, Math.min(0.96, Number(position.x) || location.x));
  location.y = Math.max(0.05, Math.min(0.95, Number(position.y) || location.y));
  session.selectedId = locationId;
  session.dirty = true;
  session.design.updatedAt = new Date().toISOString();
  if (preview) return;
  persistLocalDraft();
  render();
}

export function updateSelectedLocationField(field, value) {
  const session = initializeSession();
  const location = selectedLocation();
  if (!location || !["name", "type", "description", "z"].includes(field)) return;
  const nextValue = field === "z"
    ? Math.round(Math.max(0, Math.min(8, Number(value) || 0)))
    : String(value || "").trim();
  const locations = session.design.locations.map((item) => item.id === location.id ? { ...item, [field]: nextValue } : item);
  replaceDesign({ ...session.design, locations });
  render();
}

export function updateSelectedLocationEffect(key, value) {
  const session = initializeSession();
  const location = selectedLocation();
  const variable = session.design.variables.find((item) => item.id === key);
  if (!location || !variable) return;
  const span = variable.max - variable.min;
  const amount = Math.round(Math.max(-span, Math.min(span, Number(value) || 0)));
  const locations = session.design.locations.map((item) => item.id === location.id
    ? { ...item, effects: { ...item.effects, [key]: amount } }
    : item);
  replaceDesign({ ...session.design, locations });
  render();
}

export function updateSelectedLocationEncounterNpc(npcId, enabled) {
  const session = initializeSession();
  const location = selectedLocation();
  if (!location || !session.design.system.npcs.some((npc) => npc.id === npcId)) return;
  const ids = new Set(location.encounterNpcIds || []);
  if (enabled) ids.add(npcId);
  else ids.delete(npcId);
  const locations = session.design.locations.map((item) => item.id === location.id
    ? { ...item, encounterNpcIds: [...ids] }
    : item);
  replaceDesign({ ...session.design, locations });
  render();
}

export function addLocationCheck() {
  const session = initializeSession();
  const location = selectedLocation();
  if (!location) return;
  if ((location.checks || []).length >= 6) return showToast("每个地点最多预设 6 项判定");
  const check = {
    id: `check-${Date.now().toString(36)}`,
    label: "新的地点判定",
    instruction: "描述角色如何行动，然后由主持人发起判定。",
    target: session.design.system.dice.defaultTarget,
    bonus: 0,
    rollMode: "normal",
    successText: "判定成功，获得预期进展。",
    failureText: "判定失败，但故事仍会带着代价继续。"
  };
  const locations = session.design.locations.map((item) => item.id === location.id
    ? { ...item, checks: [...(item.checks || []), check] }
    : item);
  replaceDesign({ ...session.design, locations });
  render();
}

export function deleteLocationCheck(checkId) {
  const session = initializeSession();
  const location = selectedLocation();
  if (!location) return;
  const locations = session.design.locations.map((item) => item.id === location.id
    ? { ...item, checks: (item.checks || []).filter((check) => check.id !== checkId) }
    : item);
  replaceDesign({ ...session.design, locations });
  render();
}

export function updateLocationCheckField(checkId, field, value, { preview = false } = {}) {
  const session = initializeSession();
  const location = selectedLocation();
  const allowed = ["label", "instruction", "target", "bonus", "rollMode", "successText", "failureText"];
  if (!location || !allowed.includes(field)) return;
  const nextValue = field === "target"
    ? Math.round(Math.max(-9999, Math.min(9999, Number(value) || 0)))
    : field === "bonus"
      ? Math.round(Math.max(-999, Math.min(999, Number(value) || 0)))
      : field === "rollMode"
        ? (["normal", "advantage", "disadvantage"].includes(value) ? value : "normal")
        : String(value || "");
  const target = (location.checks || []).find((check) => check.id === checkId);
  if (!target) return;
  target[field] = nextValue;
  markInlineDraft();
  if (!preview) persistLocalDraft({ immediate: true });
}

export function updateMapTitle(value) {
  const session = initializeSession();
  replaceDesign({ ...session.design, title: String(value || "").trim() || "未命名地图" });
  render();
}

export function setMapCanvasMode(mode) {
  const session = initializeSession();
  if (!["template", "custom", "blank"].includes(mode)) return;
  if (mode === "custom" && !session.design.canvas.dataUrl) {
    openMapBackgroundPicker();
    return;
  }
  replaceDesign({ ...session.design, canvas: { ...session.design.canvas, mode } });
  render();
}

export function openMapBackgroundPicker() {
  document.querySelector("[data-map-background-input]")?.click();
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const source = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(source);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error("无法读取这张图片"));
    };
    image.src = source;
  });
}

export async function applyMapBackgroundFile(file) {
  if (!file?.type?.startsWith("image/")) return showToast("请选择 PNG、JPG 或 WebP 图片");
  if (file.size > 12 * 1024 * 1024) return showToast("底图文件请控制在 12MB 以内");
  try {
    const image = await loadImageFile(file);
    const maxWidth = 1800;
    const maxHeight = 1400;
    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = Math.max(640, Math.round(image.naturalWidth * scale));
    const height = Math.max(480, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#f8f4ea";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    let dataUrl = canvas.toDataURL("image/jpeg", 0.84);
    if (dataUrl.length > 4_300_000) dataUrl = canvas.toDataURL("image/jpeg", 0.68);
    const session = initializeSession();
    replaceDesign({
      ...session.design,
      canvas: {
        ...session.design.canvas,
        mode: "custom",
        dataUrl,
        fileName: file.name,
        width,
        height
      }
    });
    render();
    showToast(`已载入底图「${file.name}」`);
  } catch (error) {
    showToast(error?.message || "底图载入失败");
  }
}

export function updateMapGridType(gridType) {
  const session = initializeSession();
  if (!["square", "hex", "none"].includes(gridType)) return;
  replaceDesign({ ...session.design, canvas: { ...session.design.canvas, gridType } });
  session.canvasView.grid = gridType !== "none";
  render();
}

export function setMapInspectorTab(tab) {
  const session = initializeSession();
  if (!["location", "rules", "combat"].includes(tab)) return;
  session.inspectorTab = tab;
  render();
}

function runtimeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function updateMapDiceField(field, value) {
  if (!["count", "sides", "modifier", "defaultTarget"].includes(field)) return;
  const session = initializeSession();
  const system = normalizeTabletopSystem(session.design.system);
  system.dice[field] = Number(value);
  replaceDesign({ ...session.design, system: normalizeTabletopSystem(system) });
  session.inspectorTab = "combat";
  render();
}

export function setMapCombatTarget(combatantId) {
  const session = initializeSession();
  const system = normalizeTabletopSystem(session.design.system);
  if (![...system.players, ...system.npcs].some((combatant) => combatant.id === combatantId)) return;
  system.combat.targetId = combatantId;
  if (system.npcs.some((npc) => npc.id === combatantId)) system.combat.targetNpcId = combatantId;
  replaceDesign({ ...session.design, system });
  session.inspectorTab = "combat";
  render();
}

export function updateMapCombatantField(combatantId, field, value) {
  if (!["name", "role", "hp", "maxHp", "attack", "defense", "damage", "initiative"].includes(field)) return;
  const session = initializeSession();
  const system = normalizeTabletopSystem(session.design.system);
  const combatant = [...system.players, ...system.npcs].find((item) => item.id === combatantId);
  if (!combatant) return;
  if (["name", "role"].includes(field)) combatant[field] = String(value || "").trim();
  else combatant[field] = Number(value);
  const stats = normalizeCombatantStats(combatant);
  Object.assign(combatant, stats);
  replaceDesign({ ...session.design, system: normalizeTabletopSystem(system) });
  session.inspectorTab = "combat";
  render();
}

export function addMapNpc() {
  const session = initializeSession();
  const system = normalizeTabletopSystem(session.design.system);
  if (system.npcs.length >= 24) return showToast("一个世界最多支持 24 个对战 NPC");
  const npc = {
    id: runtimeId("npc"),
    name: `新 NPC ${system.npcs.length + 1}`,
    role: "中立角色",
    notes: "",
    conditions: [],
    ...normalizeCombatantStats()
  };
  system.npcs.push(npc);
  system.combat.targetNpcId = npc.id;
  system.combat.targetId = npc.id;
  system.combat.activeNpcIds.push(npc.id);
  replaceDesign({ ...session.design, system: normalizeTabletopSystem(system) });
  session.inspectorTab = "combat";
  render();
  showToast("已新增 NPC，可直接编辑数值并发起对战");
}

export function deleteMapNpc(npcId) {
  const session = initializeSession();
  const system = normalizeTabletopSystem(session.design.system);
  const npcs = system.npcs.filter((npc) => npc.id !== npcId);
  if (npcs.length === system.npcs.length) return;
  system.npcs = npcs;
  system.combat.targetNpcId = npcs[0]?.id || "";
  system.combat.targetId = npcs[0]?.id || system.players[0]?.id || "";
  system.combat.activeNpcIds = system.combat.activeNpcIds.filter((id) => id !== npcId);
  system.combat.initiativeOrder = system.combat.initiativeOrder.filter((id) => id !== npcId);
  const locations = session.design.locations.map((location) => ({
    ...location,
    encounterNpcIds: (location.encounterNpcIds || []).filter((id) => id !== npcId)
  }));
  replaceDesign({ ...session.design, locations, system: normalizeTabletopSystem(system) });
  session.inspectorTab = "combat";
  render();
  showToast("NPC 已移除");
}

export function rollMapCheck() {
  const session = initializeSession();
  const system = normalizeTabletopSystem(session.design.system);
  const result = rollTabletopCheck(system.dice, {
    label: "临时随机检定",
    bonus: session.checkBonus,
    rollMode: session.checkMode
  });
  system.combat.lastCheck = result;
  system.combat.log.push({
    id: runtimeId("check"),
    round: system.combat.round,
    text: `${result.label}：${result.total} / ${result.target}，${result.degreeLabel || (result.success ? "成功" : "失败")}。`,
    tone: result.success ? "success" : "neutral"
  });
  replaceDesign({ ...session.design, system: normalizeTabletopSystem(system) });
  session.inspectorTab = "combat";
  render();
  showToast(`${result.rolls.join(" + ")} → ${result.total}，${result.degreeLabel || (result.success ? "成功" : "失败")}`);
}

export function applyLastCheckToVariable() {
  const session = initializeSession();
  const result = session.design.system?.combat?.lastCheck;
  if (!result) return showToast("请先进行一次检定或攻击");
  const targetId = session.design.variables.some((variable) => variable.id === session.combatVariableId)
    ? session.combatVariableId
    : session.design.variables[0]?.id;
  const delta = Math.max(1, Math.round(Number(session.combatVariableDelta) || 1)) * (result.success ? 1 : -1);
  const variables = session.design.variables.map((variable) => variable.id === targetId
    ? { ...variable, value: Math.max(variable.min, Math.min(variable.max, variable.value + delta)) }
    : variable);
  const target = variables.find((variable) => variable.id === targetId);
  replaceDesign({ ...session.design, variables });
  session.inspectorTab = "combat";
  render();
  showToast(`已将判定结果写入「${target?.label || "叙事变量"}」${delta > 0 ? ` +${delta}` : ` ${delta}`}`);
}

export function runMapCombatAttack(side) {
  const session = initializeSession();
  const system = normalizeTabletopSystem(session.design.system);
  const targetId = system.combat.targetNpcId;
  if (!targetId) return showToast("请先添加并选择一个 NPC");
  const playerId = system.players[0]?.id || "party";
  const attackerId = side === "npc" ? targetId : playerId;
  const defenderId = side === "npc" ? playerId : targetId;
  const resolved = resolveTabletopAttack(system, attackerId, defenderId);
  if (!resolved.result) return;
  replaceDesign({ ...session.design, system: resolved.system });
  session.inspectorTab = "combat";
  render();
  showToast(resolved.result.text);
}

export function startMapCombat() {
  const session = initializeSession();
  const base = session.design.system?.combat?.outcome
    ? resetTabletopCombat(session.design.system)
    : session.design.system;
  const started = startTabletopCombat(base);
  if (!started.started) return showToast("至少需要一名可行动的玩家角色和 NPC");
  replaceDesign({ ...session.design, system: started.system });
  session.inspectorTab = "combat";
  render();
  showToast("先攻已确定，遭遇开始");
}

export function startLocationEncounter(locationId) {
  const session = initializeSession();
  const location = session.design.locations.find((item) => item.id === locationId);
  if (!location?.encounterNpcIds?.length) return showToast("请先为地点勾选至少一个 NPC");
  const base = session.design.system?.combat?.outcome
    ? resetTabletopCombat(session.design.system)
    : session.design.system;
  const started = startTabletopCombat(base, { npcIds: location.encounterNpcIds, locationId });
  if (!started.started) return showToast("地点遭遇中没有可行动的玩家或 NPC");
  replaceDesign({ ...session.design, system: started.system });
  session.inspectorTab = "combat";
  render();
  showToast(`「${location.name}」遭遇开始`);
}

export function runActiveCombatAttack() {
  const session = initializeSession();
  const state = tabletopCombatState(session.design.system);
  if (!state.active || !state.target) return showToast("当前没有可执行攻击的行动者或目标");
  const resolved = resolveTabletopAttack(state.system, state.active.id, state.target.id);
  if (!resolved.result) return showToast("当前行动不合法，请检查先攻与目标状态");
  replaceDesign({ ...session.design, system: resolved.system });
  session.inspectorTab = "combat";
  render();
  showToast(resolved.result.text);
}

export function skipMapCombatTurn() {
  const session = initializeSession();
  const next = skipTabletopTurn(session.design.system);
  replaceDesign({ ...session.design, system: next });
  session.inspectorTab = "combat";
  render();
}

export function adjustMapCombatHp(direction) {
  const session = initializeSession();
  const amount = Math.max(1, Math.round(Number(session.hpDelta) || 1));
  const normalized = normalizeTabletopSystem(session.design.system);
  const participants = [...normalized.players, ...normalized.npcs];
  const targetId = participants.some((item) => item.id === session.hpTargetId)
    ? session.hpTargetId
    : participants[0]?.id;
  const result = applyTabletopHpChange(normalized, targetId, amount * (Number(direction) < 0 ? -1 : 1));
  if (!result.changed) return showToast("HP 没有发生变化");
  replaceDesign({ ...session.design, system: result.system });
  session.inspectorTab = "combat";
  render();
  showToast(result.changed > 0 ? `已恢复 ${result.changed} 点 HP` : `已造成 ${Math.abs(result.changed)} 点伤害`);
}

export function addMapCombatStatus() {
  const session = initializeSession();
  const normalized = normalizeTabletopSystem(session.design.system);
  const participants = [...normalized.players, ...normalized.npcs];
  const targetId = participants.some((item) => item.id === session.conditionTargetId)
    ? session.conditionTargetId
    : participants[0]?.id;
  const system = addTabletopCondition(normalized, targetId, {
    label: session.conditionLabel,
    rounds: session.conditionRounds
  });
  replaceDesign({ ...session.design, system });
  session.inspectorTab = "combat";
  render();
}

export function removeMapCombatStatus(combatantId, conditionId) {
  const session = initializeSession();
  const system = removeTabletopCondition(session.design.system, combatantId, conditionId);
  replaceDesign({ ...session.design, system });
  session.inspectorTab = "combat";
  render();
}

export function applyCombatOutcomeToVariable() {
  const session = initializeSession();
  const system = normalizeTabletopSystem(session.design.system);
  if (!system.combat.outcome || system.combat.outcomeApplied) return showToast("当前没有尚未写入的遭遇结果");
  const targetId = session.design.variables.some((variable) => variable.id === session.combatVariableId)
    ? session.combatVariableId
    : session.design.variables[0]?.id;
  const delta = Math.max(1, Math.round(Number(session.combatVariableDelta) || 1))
    * (system.combat.outcome === "victory" ? 1 : -1);
  const variables = session.design.variables.map((variable) => variable.id === targetId
    ? { ...variable, value: Math.max(variable.min, Math.min(variable.max, variable.value + delta)) }
    : variable);
  system.combat.outcomeApplied = true;
  replaceDesign({ ...session.design, variables, system });
  session.inspectorTab = "rules";
  render();
  showToast(`遭遇结果已写入结局变量 ${delta > 0 ? `+${delta}` : delta}`);
}

export function resetMapCombat() {
  const session = initializeSession();
  replaceDesign({ ...session.design, system: resetTabletopCombat(session.design.system) });
  session.inspectorTab = "combat";
  render();
  showToast("对战状态已重置");
}

export function addMapVariable() {
  const session = initializeSession();
  if (session.design.variables.length >= 8) return showToast("一个地图最多支持 8 个叙事变量");
  const index = session.design.variables.length;
  const variable = {
    id: runtimeId("variable"),
    label: `变量 ${index + 1}`,
    color: VARIABLE_COLORS[index % VARIABLE_COLORS.length],
    min: 0,
    max: 100,
    value: 50
  };
  const locations = session.design.locations.map((location) => ({
    ...location,
    effects: { ...location.effects, [variable.id]: 0 }
  }));
  replaceDesign({ ...session.design, variables: [...session.design.variables, variable], locations });
  session.inspectorTab = "rules";
  render();
  showToast("已新增变量，可修改名称、范围与当前值");
}

export function deleteMapVariable(variableId) {
  const session = initializeSession();
  if (session.design.variables.length <= 1) return showToast("至少保留一个叙事变量");
  if (!session.design.variables.some((variable) => variable.id === variableId)) return;
  const variables = session.design.variables.filter((variable) => variable.id !== variableId);
  const locations = session.design.locations.map((location) => ({
    ...location,
    effects: Object.fromEntries(Object.entries(location.effects || {}).filter(([key]) => key !== variableId))
  }));
  const endings = session.design.endings.map((ending) => ({
    ...ending,
    conditions: ending.conditions.filter((condition) => condition.variableId !== variableId)
  }));
  replaceDesign({ ...session.design, variables, locations, endings });
  render();
  showToast("变量及引用它的条件已移除");
}

export function updateVariableValue(variableId, value, { preview = false } = {}) {
  const session = initializeSession();
  const variable = session.design.variables.find((item) => item.id === variableId);
  if (!variable) return;
  variable.value = Math.round(Math.max(variable.min, Math.min(variable.max, Number(value) || 0)));
  session.design.updatedAt = new Date().toISOString();
  session.dirty = true;
  persistLocalDraft();
  if (!preview) render();
}

export function updateVariableField(variableId, field, value) {
  const session = initializeSession();
  if (!["label", "color", "min", "max"].includes(field)) return;
  const variables = session.design.variables.map((variable) => {
    if (variable.id !== variableId) return variable;
    if (field === "label") return { ...variable, label: String(value || "").trim() || "未命名变量" };
    if (field === "color") return { ...variable, color: String(value || "") };
    return { ...variable, [field]: Math.round(Number(value) || 0) };
  });
  replaceDesign({ ...session.design, variables });
  render();
}

export function addMapEnding() {
  const session = initializeSession();
  if (session.design.endings.length >= 12) return showToast("一个地图最多支持 12 个结局规则");
  const ending = {
    id: runtimeId("ending"),
    name: `新结局 ${session.design.endings.length + 1}`,
    summary: "描述这个结局最终呈现的状态。",
    tone: "neutral",
    priority: 0,
    logic: "all",
    conditions: []
  };
  replaceDesign({ ...session.design, endings: [...session.design.endings, ending] });
  session.inspectorTab = "rules";
  render();
  showToast("已创建空白结局规则");
}

export function deleteMapEnding(endingId) {
  const session = initializeSession();
  const endings = session.design.endings.filter((ending) => ending.id !== endingId);
  if (endings.length === session.design.endings.length) return;
  replaceDesign({ ...session.design, endings });
  render();
}

export function updateEndingField(endingId, field, value) {
  const session = initializeSession();
  if (!["name", "summary", "tone", "priority", "logic"].includes(field)) return;
  const nextValue = field === "priority" ? Math.round(Number(value) || 0) : String(value || "").trim();
  const endings = session.design.endings.map((ending) => ending.id === endingId ? { ...ending, [field]: nextValue } : ending);
  replaceDesign({ ...session.design, endings });
  render();
}

export function addEndingCondition(endingId) {
  const session = initializeSession();
  const variable = session.design.variables[0];
  const ending = session.design.endings.find((item) => item.id === endingId);
  if (!ending || !variable) return;
  if (ending.conditions.length >= 8) return showToast("一个结局最多支持 8 条判断条件");
  const condition = { id: runtimeId("condition"), variableId: variable.id, operator: ">=", value: variable.value };
  const endings = session.design.endings.map((item) => item.id === endingId
    ? { ...item, conditions: [...item.conditions, condition] }
    : item);
  replaceDesign({ ...session.design, endings });
  render();
}

export function deleteEndingCondition(endingId, conditionId) {
  const session = initializeSession();
  const endings = session.design.endings.map((ending) => ending.id === endingId
    ? { ...ending, conditions: ending.conditions.filter((condition) => condition.id !== conditionId) }
    : ending);
  replaceDesign({ ...session.design, endings });
  render();
}

export function updateEndingCondition(endingId, conditionId, field, value) {
  const session = initializeSession();
  if (!["variableId", "operator", "value"].includes(field)) return;
  const nextValue = field === "value" ? Math.round(Number(value) || 0) : String(value || "");
  const endings = session.design.endings.map((ending) => ending.id === endingId
    ? {
      ...ending,
      conditions: ending.conditions.map((condition) => condition.id === conditionId
        ? { ...condition, [field]: nextValue }
        : condition)
    }
    : ending);
  replaceDesign({ ...session.design, endings });
  render();
}

export function addMapLocation() {
  const session = initializeSession();
  if (session.design.locations.length >= 24) return showToast("一个地图最多支持 24 个地点");
  const index = session.design.locations.length;
  const id = `location-${Date.now().toString(36)}`;
  const location = {
    id,
    name: `新地点 ${index + 1}`,
    type: "探索场景",
    description: "补充这里会发生什么，以及玩家为何需要来到此处。",
    hostNotes: "",
    segmentKey: "",
    x: 0.46 + (index % 3) * 0.07,
    y: 0.5 + (index % 2) * 0.08,
    z: 1,
    encounterNpcIds: [],
    checks: [],
    effects: Object.fromEntries(session.design.variables.map((variable) => [variable.id, 0]))
  };
  session.selectedId = id;
  session.inspectorTab = "location";
  replaceDesign({ ...session.design, locations: [...session.design.locations, location] });
  render();
  showToast("已新增地点，可在地图中拖动定位");
}

export function deleteMapLocation(locationId) {
  const session = initializeSession();
  if (session.design.locations.length <= 1) return showToast("地图至少需要保留一个地点");
  const locations = session.design.locations.filter((location) => location.id !== locationId);
  const routes = session.design.routes.filter(([from, to]) => from !== locationId && to !== locationId);
  session.selectedId = locations[0]?.id || "";
  if (session.routeStartId === locationId) session.routeStartId = "";
  replaceDesign({ ...session.design, locations, routes });
  render();
  showToast("地点已从草稿中移除");
}

export function toggleMapRouteMode() {
  const session = initializeSession();
  session.routeMode = !session.routeMode;
  session.routeStartId = "";
  render();
}

export function updateMapCanvasView(operation) {
  const session = initializeSession();
  const view = session.canvasView;
  if (operation === "rotate-left") view.rotation = (view.rotation + 3) % 4;
  if (operation === "rotate-right") view.rotation = (view.rotation + 1) % 4;
  if (operation === "zoom-out") view.zoom = Math.max(MAP_ZOOM_MIN, Number((view.zoom - MAP_ZOOM_STEP).toFixed(2)));
  if (operation === "zoom-in") view.zoom = Math.min(MAP_ZOOM_MAX, Number((view.zoom + MAP_ZOOM_STEP).toFixed(2)));
  const panLimit = mapPanLimit(view.zoom);
  view.panX = Math.max(-panLimit, Math.min(panLimit, Number(view.panX) || 0));
  view.panY = Math.max(-panLimit, Math.min(panLimit, Number(view.panY) || 0));
  if (operation === "height") view.height = view.height >= 1.25 ? 0.75 : Number((view.height + 0.25).toFixed(2));
  if (operation === "grid") view.grid = !view.grid;
  if (operation === "reset") session.canvasView = { rotation: 0, zoom: 1, panX: 0, panY: 0, height: 1, grid: false };
  render();
}

export function updateMapCanvasPan(position = {}) {
  const session = initializeSession();
  const limit = mapPanLimit(session.canvasView.zoom);
  session.canvasView.panX = Math.max(-limit, Math.min(limit, Number(position.x) || 0));
  session.canvasView.panY = Math.max(-limit, Math.min(limit, Number(position.y) || 0));
  render();
}

export function simulateMapLocation(locationId) {
  const session = initializeSession();
  const location = session.design.locations.find((item) => item.id === locationId);
  if (!location) return;
  const variables = session.design.variables.map((variable) => ({
    ...variable,
    value: Math.max(variable.min, Math.min(variable.max, variable.value + Number(location.effects?.[variable.id] || 0)))
  }));
  replaceDesign({ ...session.design, variables });
  session.inspectorTab = "rules";
  render();
  showToast(`已模拟到达「${location.name}」，结局导向已更新`);
}

export async function saveTabletopMap() {
  if (saving) return;
  const session = initializeSession();
  const studio = studioStore.get().cloudStudio;
  const world = studio?.world;
  const savedAt = new Date().toISOString();
  const design = normalizeMapDesign({ ...session.design, savedAt, updatedAt: savedAt });
  if (!world || !zhimuApi.context.worldId) {
    session.design = design;
    session.dirty = false;
    persistLocalDraft({ immediate: true });
    render();
    showToast("地图雏形已保存在当前浏览器");
    return;
  }
  saving = true;
  render();
  try {
    const settings = {
      ...(world.settings || {}),
      tabletopSystem: design.system,
      tabletopMapDesign: design
    };
    const updated = await zhimuApi.patchWorld({ settings }, zhimuApi.context.worldId, { revision: world.content_revision });
    const nextWorld = {
      ...world,
      settings: updated.settings || settings,
      content_revision: updated.content_revision ?? world.content_revision
    };
    studioStore.set({ cloudStudio: { ...studio, world: nextWorld } });
    worldStore.set({
      cloudWorlds: (worldStore.get().cloudWorlds || []).map((item) => item.id === zhimuApi.context.worldId
        ? { ...item, settings: nextWorld.settings, content_revision: nextWorld.content_revision }
        : item)
    });
    session.design = normalizeMapDesign(nextWorld.settings.tabletopMapDesign || design);
    session.dirty = false;
    persistLocalDraft({ immediate: true });
    showToast("跑团地图草稿已保存到当前剧本");
  } catch (error) {
    showToast(error?.message || "地图草稿保存失败，请稍后重试");
  } finally {
    saving = false;
    render();
  }
}

export const tabletopMapViewApi = {
  tabletopMap,
  bindTabletopMapEditor,
  selectMapLocation,
  moveMapLocation,
  updateSelectedLocationField,
  updateSelectedLocationEffect,
  updateSelectedLocationEncounterNpc,
  addLocationCheck,
  deleteLocationCheck,
  updateLocationCheckField,
  updateMapTitle,
  setMapCanvasMode,
  openMapBackgroundPicker,
  applyMapBackgroundFile,
  updateMapGridType,
  setMapInspectorTab,
  updateMapDiceField,
  setMapCombatTarget,
  updateMapCombatantField,
  addMapNpc,
  deleteMapNpc,
  rollMapCheck,
  applyLastCheckToVariable,
  runMapCombatAttack,
  startMapCombat,
  startLocationEncounter,
  runActiveCombatAttack,
  skipMapCombatTurn,
  adjustMapCombatHp,
  addMapCombatStatus,
  removeMapCombatStatus,
  applyCombatOutcomeToVariable,
  resetMapCombat,
  addMapVariable,
  deleteMapVariable,
  updateVariableValue,
  updateVariableField,
  addMapEnding,
  deleteMapEnding,
  updateEndingField,
  addEndingCondition,
  deleteEndingCondition,
  updateEndingCondition,
  addMapLocation,
  deleteMapLocation,
  toggleMapRouteMode,
  updateMapCanvasView,
  updateMapCanvasPan,
  simulateMapLocation,
  saveTabletopMap
};

registerView("tabletopMap", tabletopMapViewApi);
