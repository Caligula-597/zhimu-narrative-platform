import "./board-game.css";
import * as zhimuApi from "../api/index.js";
import { generateBoardGameAiDraft } from "../products/board-game/api.js";
import { normalizeError } from "../components/status-ui.js";
import { showToast } from "../components/toast.js";
import { loadCloudData, render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { uiStore, worldStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import { setHtml } from "../../shared/safe-dom.js";
import {
  advanceBoardGamePlaygroundRound as advancePlaygroundRoundState,
  chooseBoardGamePlaygroundCommand as choosePlaygroundCommandState,
  chooseBoardGamePlaygroundTarget as choosePlaygroundTargetState,
  confirmBoardGamePlaygroundAction as confirmPlaygroundActionState,
  createBoardGamePlaygroundState,
  renderBoardGamePlayground,
  resetBoardGamePlayground as resetPlaygroundState
} from "./board-game-playground.js";
import {
  BOARD_GAME_COMPONENT_TYPES,
  BOARD_GAME_CONDITION_OPERATORS,
  BOARD_GAME_EFFECT_OPERATIONS,
  BOARD_GAME_MECHANISM_TEMPLATES,
  BOARD_GAME_VARIABLE_SCOPES,
  boardGameComponentTypeLabel,
  createBoardGameComponent,
  createBoardGameMechanism,
  createBoardGameSeat,
  createBoardGameVariable,
  createDefaultBoardGameDesign,
  initialBoardGameState,
  normalizeBoardGameAsset,
  normalizeBoardGameDesign,
  normalizeBoardGameEntry,
  normalizeBoardGameStateField,
  simulateBoardGameMechanism
} from "../../shared/board-game-design.js";

const COMPONENT_ICONS = Object.freeze({
  board: "盘",
  deck: "组",
  card: "牌",
  token_pool: "子",
  track: "轨",
  dice: "骰",
  timer: "时",
  phase: "阶",
  custom: "＋"
});

const TAB_LABELS = Object.freeze({
  components: "组件与素材",
  seats: "玩家席位",
  mechanisms: "条件与计算",
  playground: "互动试玩",
  rulebook: "游戏说明书"
});
const AI_SECTION_LABELS = Object.freeze({ ...TAB_LABELS, engine: "试玩引擎" });
const AI_SCOPE_LABELS = Object.freeze({ patch: "修改当前 Demo", missing: "只补齐空白", current: "重做当前模块", full: "生成完整新原型" });

const SCOPE_LABELS = Object.freeze({ global: "整局", player: "每位玩家", component: "指定组件" });
const OPERATOR_LABELS = Object.freeze({ eq: "等于", neq: "不等于", gt: "大于", gte: "大于等于", lt: "小于", lte: "小于等于", contains: "包含" });
const EFFECT_LABELS = Object.freeze({ set: "设为", add: "增加", subtract: "减少", multiply: "乘以", min: "取较小值", max: "取较大值", toggle: "切换真假" });
const COMPONENT_NESTED_FIELDS = Object.freeze([
  ["boardStateField", "stateFields", "[data-board-state-id]", "boardStateId"],
  ["boardAssetField", "assets", "[data-board-asset-id]", "boardAssetId"],
  ["boardEntryField", "entries", "[data-board-entry-id]", "boardEntryId"]
]);
const MECHANISM_NESTED_FIELDS = Object.freeze([
  ["boardConditionField", "conditions", "[data-board-condition-id]", "boardConditionId"],
  ["boardEffectField", "effects", "[data-board-effect-id]", "boardEffectId"]
]);
let editorSession = null;

function activeWorld() {
  const previewWorld = worldStore.get().cloudWorkspacePreview?.world;
  if (previewWorld?.id === zhimuApi.context.worldId) return previewWorld;
  return (worldStore.get().cloudWorlds || []).find((world) => world.id === zhimuApi.context.worldId) || null;
}

function activeSeats(session = editorSession) {
  return (session?.design?.seats || []).slice().sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
}

function initializeSession() {
  const world = activeWorld();
  const worldId = world?.id || zhimuApi.context.worldId || "";
  if (editorSession?.worldId === worldId) return editorSession;
  const design = normalizeBoardGameDesign(
    world?.settings?.boardGameDesign || createDefaultBoardGameDesign(world?.name || ""),
    { title: world?.name || "" }
  );
  editorSession = {
    worldId,
    design,
    activeTab: "components",
    selectedId: design.components[0]?.id || "",
    selectedMechanismId: design.mechanisms[0]?.id || "",
    simulationState: initialBoardGameState(design.variables),
    playgroundState: createBoardGamePlaygroundState(design, design.seats.length || design.playerCount.min),
    assetUrls: {},
    seatDeleteArmedId: "",
    aiScope: design.components.length || design.engine.actions.length ? "patch" : "missing",
    aiInstructions: "",
    aiDraft: null,
    aiDraftBase: null,
    aiGenerating: false,
    aiError: "",
    undoDesign: null,
    dirty: false,
    saving: false,
    busy: false
  };
  return editorSession;
}

function selectedComponent(session = initializeSession()) {
  return session.design.components.find((component) => component.id === session.selectedId) || null;
}

function selectedMechanism(session = initializeSession()) {
  return session.design.mechanisms.find((mechanism) => mechanism.id === session.selectedMechanismId) || null;
}

function markDirty() {
  const session = initializeSession();
  session.dirty = true;
  document.querySelector("[data-board-save]")?.classList.add("has-changes");
  const label = document.querySelector("[data-board-save-label]");
  if (label) label.textContent = "保存更改";
}

function optionList(values, labels, selected) {
  return values.map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(labels[value] || value)}</option>`).join("");
}

function componentPalette() {
  return BOARD_GAME_COMPONENT_TYPES.map((type) => `<button type="button" class="board-component-preset" data-action="board-component-add" data-board-component-type="${type}">
    <span>${COMPONENT_ICONS[type]}</span><strong>${escapeHtml(boardGameComponentTypeLabel(type))}</strong>
  </button>`).join("");
}

function componentList(session) {
  if (!session.design.components.length) return `<div class="board-component-empty"><strong>还没有组件</strong><p>先放入玩家在桌面上真正能看到、拿起或改变的东西。</p></div>`;
  return session.design.components.map((component) => `<button type="button" class="board-component-row ${component.id === session.selectedId ? "selected" : ""}" data-action="board-component-select" data-board-component-id="${escapeHtml(component.id)}">
    <span>${COMPONENT_ICONS[component.type] || "＋"}</span>
    <span><strong>${escapeHtml(component.name)}</strong><small>${escapeHtml(boardGameComponentTypeLabel(component.type))} · ${component.quantity} 件</small></span>
  </button>`).join("");
}

function typeOptions(selectedType) {
  return BOARD_GAME_COMPONENT_TYPES.map((type) => `<option value="${type}" ${type === selectedType ? "selected" : ""}>${escapeHtml(boardGameComponentTypeLabel(type))}</option>`).join("");
}

function stateFields(component) {
  if (!component.stateFields.length) return `<div class="board-state-empty">静态物料可以留空。会被条件、回合或玩家动作改变的内容才需要状态。</div>`;
  return component.stateFields.map((field) => `<div class="board-state-row" data-board-state-id="${escapeHtml(field.id)}">
    <label><span>显示名称</span><input class="field" data-board-state-field="label" maxlength="80" value="${escapeHtml(field.label)}"></label>
    <label><span>字段键</span><input class="field" data-board-state-field="key" maxlength="80" value="${escapeHtml(field.key)}"></label>
    <label><span>初始值</span><input class="field" data-board-state-field="initialValue" maxlength="300" value="${escapeHtml(field.initialValue)}" placeholder="0 / 未翻开 / 空"></label>
    <button type="button" class="text-btn danger-text" data-action="board-state-delete" data-board-state-id="${escapeHtml(field.id)}">删除</button>
  </div>`).join("");
}

function loadAssetPreview(asset) {
  const session = initializeSession();
  if (asset.kind !== "image" || !asset.assetId || session.assetUrls[asset.id]) return;
  session.assetUrls[asset.id] = "loading";
  zhimuApi.getAssetDownloadUrl(asset.assetId).then((ticket) => {
    if (editorSession !== session) return;
    session.assetUrls[asset.id] = ticket?.downloadUrl || "failed";
    render();
  }).catch(() => {
    if (editorSession === session) session.assetUrls[asset.id] = "failed";
  });
}

function componentAssets(component) {
  if (!component.assets.length) return `<div class="board-assets-empty"><strong>还没有视觉素材</strong><p>棋盘可上传底图，卡组与卡牌可上传卡面或参考图。每张图下面都保留解释，避免只存一张无法理解的图片。</p></div>`;
  return component.assets.map((asset) => {
    loadAssetPreview(asset);
    const url = initializeSession().assetUrls[asset.id];
    const preview = asset.kind === "image"
      ? (url && !["loading", "failed"].includes(url)
        ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(asset.fileName)}">`
        : `<div class="board-asset-placeholder">${url === "failed" ? "预览不可用" : "正在读取图片"}</div>`)
      : `<div class="board-asset-document"><span>文档</span><strong>${escapeHtml(asset.fileName)}</strong></div>`;
    return `<article class="board-asset-card" data-board-asset-id="${escapeHtml(asset.id)}">
      <div class="board-asset-visual">${preview}</div>
      <div class="board-asset-copy"><div><strong>${escapeHtml(asset.fileName)}</strong><button type="button" class="text-btn danger-text" data-action="board-asset-delete" data-board-asset-id="${escapeHtml(asset.id)}">移除</button></div>
      <label><span>图片 / 文件说明</span><textarea class="field" rows="3" maxlength="1200" data-board-asset-field="caption" placeholder="它展示什么，玩家应如何使用或阅读它？">${escapeHtml(asset.caption)}</textarea></label></div>
    </article>`;
  }).join("");
}

function componentEntries(component) {
  if (!component.entries.length) return `<div class="board-state-empty">还没有卡牌条目。可以手动添加，也可以导入 JSON / CSV 卡表。</div>`;
  return component.entries.map((entry) => `<div class="board-entry-row" data-board-entry-id="${escapeHtml(entry.id)}">
    <label><span>名称</span><input class="field" data-board-entry-field="name" maxlength="160" value="${escapeHtml(entry.name)}"></label>
    <label class="wide"><span>效果 / 说明</span><input class="field" data-board-entry-field="description" maxlength="1600" value="${escapeHtml(entry.description)}"></label>
    <label><span>数量</span><input class="field" data-board-entry-field="quantity" type="number" min="1" max="9999" value="${entry.quantity}"></label>
    <button type="button" class="text-btn danger-text" data-action="board-entry-delete" data-board-entry-id="${escapeHtml(entry.id)}">删除</button>
  </div>`).join("");
}

function componentInspector(component) {
  if (!component) return `<div class="board-inspector-empty"><span>◇</span><h3>先放入第一个组件</h3><p>组件是桌游设计的实体单位。规则只负责连接它们，不会替你虚构另一套内容。</p></div>`;
  const acceptsEntries = component.type === "deck" || component.type === "card";
  return `<div class="board-inspector" data-board-component-editor="${escapeHtml(component.id)}">
    <header><div><p class="section-kicker">COMPONENT</p><h2>${escapeHtml(component.name)}</h2></div><button type="button" class="text-btn danger-text" data-action="board-component-delete" data-board-component-id="${escapeHtml(component.id)}">删除组件</button></header>
    <div class="board-field-grid">
      <label class="wide"><span>组件名称</span><input class="field" data-board-component-field="name" maxlength="120" value="${escapeHtml(component.name)}"></label>
      <label><span>组件类型</span><select class="field" data-board-component-field="type">${typeOptions(component.type)}</select></label>
      <label><span>数量</span><input class="field" data-board-component-field="quantity" type="number" min="1" max="9999" value="${component.quantity}"></label>
      <label class="wide"><span>它在桌面上是什么</span><textarea class="field" data-board-component-field="description" maxlength="1600" rows="3" placeholder="描述玩家能看到、拿到或摆放的东西">${escapeHtml(component.description)}</textarea></label>
      <label class="wide"><span>玩家能对它做什么</span><textarea class="field" data-board-component-field="playerAction" maxlength="1600" rows="3" placeholder="例如抽取、支付、移动、翻面、组合">${escapeHtml(component.playerAction)}</textarea></label>
    </div>
    <section class="board-state-section">
      <div class="board-section-head"><div><h3>视觉素材与自定义文件</h3><p>支持安全图片、PDF、Word；卡组和卡牌还可直接导入 JSON / CSV 卡表。</p></div><button type="button" class="secondary-btn" data-action="board-asset-open">＋ 上传 / 导入</button></div>
      <input class="board-file-input" type="file" multiple data-board-asset-input accept="image/png,image/jpeg,image/webp,image/gif,.docx,.json,.csv">
      <div class="board-assets-grid">${componentAssets(component)}</div>
    </section>
    ${acceptsEntries ? `<section class="board-state-section"><div class="board-section-head"><div><h3>卡牌条目</h3><p>结构化卡表会成为可继续编辑的数据，不会只作为附件躺在素材库里。</p></div><button type="button" class="secondary-btn" data-action="board-entry-add">＋ 添加卡牌</button></div><div class="board-entry-list">${componentEntries(component)}</div></section>` : ""}
    <section class="board-state-section"><div class="board-section-head"><div><h3>组件状态</h3><p>字段可被下面的条件判断器和数字计算规则直接引用。</p></div><button type="button" class="secondary-btn" data-action="board-state-add">＋ 添加状态</button></div><div class="board-state-list">${stateFields(component)}</div></section>
    <label class="board-notes-field"><span>设计备注</span><textarea class="field" data-board-component-field="notes" maxlength="2400" rows="4" placeholder="原型尺寸、印刷要求、边界情况或以后再处理的问题">${escapeHtml(component.notes)}</textarea></label>
  </div>`;
}

function renderComponentsTab(session) {
  const componentCount = session.design.components.reduce((sum, component) => sum + Number(component.quantity || 0), 0);
  return `<section class="board-component-library"><div class="board-section-head"><div><h2>添加组件</h2><p>棋盘上传在“棋盘 / 区域”组件内；卡组、卡牌、资源、数值轨都各自保存素材与说明。</p></div><span>${session.design.components.length} 类 · ${componentCount} 件</span></div><div class="board-component-palette">${componentPalette()}</div></section>
    <div class="board-game-editor-grid"><aside class="board-component-sidebar"><div class="board-component-sidebar-title"><strong>组件清单</strong><small>点击编辑</small></div>${componentList(session)}</aside><main class="board-game-inspector">${componentInspector(selectedComponent(session))}</main></div>`;
}

function renderSeatsTab(session) {
  const roles = activeSeats(session);
  return `<section class="board-panel board-seats-panel">
    <div class="board-panel-head"><div><p class="section-kicker">PLAYER SEATS</p><h2>玩家席位</h2><p>在这里维护参与人数、席位名称和顺序；规则引用与试玩 Demo 会使用同一份席位名单。</p></div><div class="board-head-actions"><button type="button" class="secondary-btn" data-action="board-seat-add" ${session.busy ? "disabled" : ""}>＋ 增加 1 席</button><button type="button" class="primary-btn" data-action="board-seat-init-six" ${session.busy || roles.length >= 6 ? "disabled" : ""}>补齐为 6 人</button></div></div>
    <div class="board-seat-summary"><strong>${roles.length}</strong><span>个玩家席位</span><small>${roles.length ? `保存桌游时，人数会同步为 ${roles.length} 人` : "从这里直接建立试玩所需的席位"}</small></div>
    <div class="board-seat-list">${roles.length ? roles.map((role, index) => `<article class="board-seat-row" data-board-seat-id="${escapeHtml(role.id)}"><span class="board-seat-number">${index + 1}</span><label><span>席位名称</span><input class="field" data-board-seat-name maxlength="120" value="${escapeHtml(role.name || `玩家席位 ${index + 1}`)}"></label><small>顺序 ${Number(role.sequence || index + 1)}</small><button type="button" class="text-btn" data-action="board-seat-name-save" data-board-seat-id="${escapeHtml(role.id)}">保存名称</button><button type="button" class="text-btn danger-text ${session.seatDeleteArmedId === role.id ? "armed" : ""}" data-action="board-seat-delete" data-board-seat-id="${escapeHtml(role.id)}">${session.seatDeleteArmedId === role.id ? "确认删除" : "删除"}</button></article>`).join("") : `<div class="board-assets-empty"><strong>还没有玩家席位</strong><p>点击“补齐为 6 人”，系统会一次建立六个可继续命名并用于试玩的席位。</p></div>`}</div>
  </section>`;
}

function variableOptions(variables, selected = "") {
  const options = variables.map((variable) => `<option value="${escapeHtml(variable.id)}" ${variable.id === selected ? "selected" : ""}>${escapeHtml(variable.label)}</option>`).join("");
  return `<option value="">选择数值…</option>${options}`;
}

function variablesEditor(session) {
  if (!session.design.variables.length) return `<div class="board-assets-empty"><strong>还没有可计算数值</strong><p>先添加金币、生命、行动点、分数、回合数等变量，再把它们接入规则。</p></div>`;
  return session.design.variables.map((variable) => `<article class="board-variable-row" data-board-variable-id="${escapeHtml(variable.id)}">
    <label><span>名称</span><input class="field" data-board-variable-field="label" maxlength="100" value="${escapeHtml(variable.label)}"></label>
    <label><span>作用范围</span><select class="field" data-board-variable-field="scope">${optionList(BOARD_GAME_VARIABLE_SCOPES, SCOPE_LABELS, variable.scope)}</select></label>
    <label><span>初始值</span><input class="field" type="number" data-board-variable-field="initialValue" value="${variable.initialValue}"></label>
    <label><span>最小</span><input class="field" type="number" data-board-variable-field="min" value="${variable.min}"></label>
    <label><span>最大</span><input class="field" type="number" data-board-variable-field="max" value="${variable.max}"></label>
    <button type="button" class="text-btn danger-text" data-action="board-variable-delete" data-board-variable-id="${escapeHtml(variable.id)}">删除</button>
  </article>`).join("");
}

function mechanismTemplates() {
  return BOARD_GAME_MECHANISM_TEMPLATES.map((template) => `<button type="button" class="board-template-card" data-action="board-mechanism-add" data-board-template-key="${template.key}"><strong>${escapeHtml(template.label)}</strong><small>${escapeHtml(template.description)}</small></button>`).join("");
}

function mechanismList(session) {
  if (!session.design.mechanisms.length) return `<div class="board-component-empty"><strong>还没有规则</strong><p>从上面的基础机制中选一种，然后改成你的玩法。</p></div>`;
  return session.design.mechanisms.map((mechanism) => `<button type="button" class="board-component-row ${mechanism.id === session.selectedMechanismId ? "selected" : ""}" data-action="board-mechanism-select" data-board-mechanism-id="${escapeHtml(mechanism.id)}"><span>则</span><span><strong>${escapeHtml(mechanism.name)}</strong><small>${escapeHtml(mechanism.trigger)} · ${mechanism.effects.length} 项效果</small></span></button>`).join("");
}

function conditionsEditor(mechanism, variables) {
  if (!mechanism.conditions.length) return `<div class="board-state-empty">没有前置条件时，这条规则每次触发都会执行。</div>`;
  return mechanism.conditions.map((condition) => `<div class="board-rule-row" data-board-condition-id="${escapeHtml(condition.id)}">
    <select class="field" data-board-condition-field="sourceKey">${variableOptions(variables, condition.sourceKey)}</select>
    <select class="field" data-board-condition-field="operator">${optionList(BOARD_GAME_CONDITION_OPERATORS, OPERATOR_LABELS, condition.operator)}</select>
    <input class="field" data-board-condition-field="value" maxlength="300" value="${escapeHtml(condition.value)}" placeholder="比较值">
    <button type="button" class="text-btn danger-text" data-action="board-condition-delete" data-board-condition-id="${escapeHtml(condition.id)}">删除</button>
  </div>`).join("");
}

function effectsEditor(mechanism, variables) {
  if (!mechanism.effects.length) return `<div class="board-state-empty">规则至少要有一项执行效果，才算可运行。</div>`;
  return mechanism.effects.map((effect) => `<div class="board-rule-row" data-board-effect-id="${escapeHtml(effect.id)}">
    <select class="field" data-board-effect-field="targetKey">${variableOptions(variables, effect.targetKey)}</select>
    <select class="field" data-board-effect-field="operation">${optionList(BOARD_GAME_EFFECT_OPERATIONS, EFFECT_LABELS, effect.operation)}</select>
    <input class="field" data-board-effect-field="value" maxlength="300" value="${escapeHtml(effect.value)}" placeholder="变化值">
    <button type="button" class="text-btn danger-text" data-action="board-effect-delete" data-board-effect-id="${escapeHtml(effect.id)}">删除</button>
  </div>`).join("");
}

function simulator(session, mechanism) {
  if (!mechanism || !session.design.variables.length) return `<div class="board-simulator-empty">添加数值并选择一条规则后，这里会实时显示条件是否成立和数值如何变化。</div>`;
  const result = simulateBoardGameMechanism(mechanism, session.simulationState, session.design.variables);
  return `<div class="board-simulator" data-board-simulator>
    <div class="board-simulator-state">${session.design.variables.map((variable) => `<label><span>${escapeHtml(variable.label)}</span><input class="field" type="number" data-board-simulation-key="${escapeHtml(variable.id)}" value="${Number(session.simulationState[variable.id] ?? variable.initialValue)}"></label>`).join("")}</div>
    <div class="board-simulator-result ${result.passed ? "passed" : "blocked"}" data-board-simulation-result><strong>${result.passed ? "条件成立，效果会执行" : "条件不成立，本次不执行"}</strong><div>${session.design.variables.map((variable) => `<span>${escapeHtml(variable.label)} <b>${escapeHtml(String(session.simulationState[variable.id] ?? variable.initialValue))}</b> → <b>${escapeHtml(String(result.state[variable.id] ?? session.simulationState[variable.id] ?? variable.initialValue))}</b></span>`).join("")}</div></div>
  </div>`;
}

function mechanismInspector(session, mechanism) {
  if (!mechanism) return `<div class="board-inspector-empty"><span>则</span><h3>选择一条机制</h3><p>条件负责判断“现在能不能做”，效果负责计算“做完以后发生什么”。</p></div>`;
  return `<div class="board-inspector" data-board-mechanism-editor="${escapeHtml(mechanism.id)}">
    <header><div><p class="section-kicker">EXECUTABLE RULE</p><h2>${escapeHtml(mechanism.name)}</h2></div><button type="button" class="text-btn danger-text" data-action="board-mechanism-delete" data-board-mechanism-id="${escapeHtml(mechanism.id)}">删除规则</button></header>
    <div class="board-field-grid board-mechanism-basics">
      <label class="wide"><span>规则名称</span><input class="field" data-board-mechanism-field="name" maxlength="160" value="${escapeHtml(mechanism.name)}"></label>
      <label><span>触发时机</span><input class="field" data-board-mechanism-field="trigger" maxlength="160" value="${escapeHtml(mechanism.trigger)}"></label>
      <label><span>条件关系</span><select class="field" data-board-mechanism-field="conditionMode"><option value="all" ${mechanism.conditionMode === "all" ? "selected" : ""}>全部满足</option><option value="any" ${mechanism.conditionMode === "any" ? "selected" : ""}>任一满足</option></select></label>
      <label><span>来源组件</span><select class="field" data-board-mechanism-field="sourceComponentId"><option value="">不限组件</option>${session.design.components.map((component) => `<option value="${escapeHtml(component.id)}" ${component.id === mechanism.sourceComponentId ? "selected" : ""}>${escapeHtml(component.name)}</option>`).join("")}</select></label>
    </div>
    <section class="board-state-section"><div class="board-section-head"><div><h3>如果</h3><p>用数值、范围或状态判断这项效果能否发生。</p></div><button type="button" class="secondary-btn" data-action="board-condition-add">＋ 添加条件</button></div><div class="board-rule-list">${conditionsEditor(mechanism, session.design.variables)}</div></section>
    <section class="board-state-section"><div class="board-section-head"><div><h3>那么</h3><p>效果按顺序执行，并自动遵守变量的最小值和最大值。</p></div><button type="button" class="secondary-btn" data-action="board-effect-add">＋ 添加效果</button></div><div class="board-rule-list">${effectsEditor(mechanism, session.design.variables)}</div></section>
    <label class="board-notes-field"><span>规则解释与边界情况</span><textarea class="field" data-board-mechanism-field="notes" maxlength="2400" rows="4">${escapeHtml(mechanism.notes)}</textarea></label>
    <section class="board-state-section"><div class="board-section-head"><div><h3>实时试算</h3><p>改变当前数值，立即检查这一条规则是否成立，以及执行后的结果。</p></div><button type="button" class="secondary-btn" data-action="board-simulator-reset">重置</button></div>${simulator(session, mechanism)}</section>
  </div>`;
}

function renderMechanismsTab(session) {
  return `<section class="board-panel"><div class="board-panel-head"><div><p class="section-kicker">STATE ENGINE</p><h2>数值、条件与特殊效果</h2><p>先用基础模板搭出可玩的原型。模板不是玩法答案，只减少重复写判断和算术的工作。</p></div><button type="button" class="secondary-btn" data-action="board-variable-add">＋ 添加数值</button></div><div class="board-variable-list">${variablesEditor(session)}</div></section>
    <section class="board-component-library"><div class="board-section-head"><div><h2>基础机制模型</h2><p>第一版先覆盖资源、卡牌、移动、轨道、骰点、条件奖励、阶段、倒计时与胜负。</p></div><span>${BOARD_GAME_MECHANISM_TEMPLATES.length} 种</span></div><div class="board-template-grid">${mechanismTemplates()}</div></section>
    <div class="board-game-editor-grid"><aside class="board-component-sidebar"><div class="board-component-sidebar-title"><strong>已用规则</strong><small>${session.design.mechanisms.length} 条</small></div>${mechanismList(session)}</aside><main class="board-game-inspector">${mechanismInspector(session, selectedMechanism(session))}</main></div>`;
}

function renderRulebookTab(session) {
  const fields = [
    ["objective", "游戏目标", "玩家最终要争取什么？不要只写主题，要写可判断的目标。", 5],
    ["setup", "开局准备", "列出组件摆放、发牌、初始资源、先手和公开信息。", 7],
    ["turnStructure", "回合 / 阶段流程", "按发生顺序写清每轮推进方式，以及何时进入下一阶段。", 8],
    ["playerActions", "玩家可执行动作", "玩家轮到自己时可以做什么，每项动作要支付什么、改变什么。", 8],
    ["endCondition", "结束与胜负条件", "什么事件让游戏结束？如何判定胜者、阵营结果或共同失败？", 5],
    ["tieBreak", "平局处理", "如果主要胜负条件相同，依次比较什么？", 4],
    ["notes", "例外、术语与补充", "集中解释特殊情况。未定义的自造名词必须在这里给出明确规则。", 7]
  ];
  return `<section class="board-panel"><div class="board-panel-head"><div><p class="section-kicker">RULEBOOK</p><h2>游戏说明书</h2><p>说明书是桌游的必需交付物。这里引用的是同一套席位、组件、数值和规则，不需要重新录入。</p></div></div><div class="board-rulebook-grid">${fields.map(([key, label, placeholder, rows]) => `<label class="${["setup", "turnStructure", "playerActions", "notes"].includes(key) ? "wide" : ""}"><span>${label}</span><textarea class="field" data-board-rulebook-field="${key}" maxlength="8000" rows="${rows}" placeholder="${placeholder}">${escapeHtml(session.design.rulebook[key])}</textarea></label>`).join("")}</div></section>`;
}

function aiDraftPreview(session) {
  const proposal = session.aiDraft;
  if (!proposal) return "";
  const report = proposal.engineReport;
  const metrics = (proposal.diff?.metrics || []).filter((item) => item.changed);
  const capabilityErrors = (proposal.capabilityPlan?.unsupported || []).map((item) => ({
    code: item.capabilityId || "CAPABILITY_UNSUPPORTED",
    message: item.reason || item.description || "当前引擎不能完整执行这项要求。"
  }));
  const errors = [...(proposal.issues || []).filter((item) => item.level === "error"), ...capabilityErrors].slice(0, 5);
  return `<section class="board-ai-preview ${proposal.blocking ? "blocked" : ""}">
    <div class="board-ai-preview-head"><div><span>尚未写入项目</span><h3>${escapeHtml(proposal.summary || "结构化桌游候选")}</h3><p>${escapeHtml(AI_SCOPE_LABELS[proposal.scope] || proposal.scope)} · ${escapeHtml(AI_SECTION_LABELS[proposal.currentSection] || proposal.currentSection)}</p></div><span>候选 Demo</span></div>
    <div class="board-ai-diff">${metrics.map((item) => `<article><span>${escapeHtml(item.label)}</span><strong>${item.before} → ${item.after}</strong><small>${item.delta > 0 ? "+" : ""}${item.delta}</small></article>`).join("") || "<p>候选不会改变当前数据。</p>"}</div>
    ${report ? `<div class="board-ai-engine-report"><div><span class="${proposal.blocking ? "blocked" : "supported"}">${proposal.blocking ? "暂不能运行" : "引擎可运行"}</span><strong>${report.tests.filter((item) => item.passed).length}/${report.tests.length} 项结构测试通过</strong><small>${report.engine.map.nodes.length} 区域 · ${report.engine.map.edges.length} 路线 · ${report.engine.actions.length} 行动</small></div><div><span>能力匹配</span><strong>${report.capabilities.supported} 支持 · ${report.capabilities.partial} 部分 · ${report.capabilities.unsupported} 不支持</strong><small>部分支持不会冒充为已实现</small></div></div>` : ""}
    ${errors.length ? `<ul class="board-ai-issues">${errors.map((item) => `<li><strong>${escapeHtml(item.code)}</strong><span>${escapeHtml(item.message)}</span></li>`).join("")}</ul>` : ""}
    ${proposal.capabilityPlan?.assumptions?.length ? `<p class="board-ai-assumptions"><strong>AI 自由补全：</strong>${proposal.capabilityPlan.assumptions.slice(0, 6).map(escapeHtml).join("；")}</p>` : ""}
    <div class="board-ai-actions"><button type="button" class="text-btn" data-action="board-ai-discard">放弃候选</button><button type="button" class="primary-btn" data-action="board-ai-apply" ${proposal.blocking || !proposal.diff?.changed ? "disabled" : ""}>${proposal.blocking ? "当前能力无法完整执行" : "确认写入编辑器与试玩"}</button></div>
  </section>`;
}

function aiDraftPanel(session) {
  const currentSection = session.activeTab === "playground" ? "engine" : session.activeTab;
  return `<section class="board-ai-panel"><div class="board-ai-copy"><p class="section-kicker">AI-FIRST AUTHORING</p><h2>描述你想创建或修改的桌游</h2><p>未说明但运行必需的部分会自由补全；组件、地图、行动和说明书写入同一个 Demo。</p></div><div class="board-ai-controls">
    <label><span>本次范围</span><select class="field" data-board-ai-scope>${Object.entries(AI_SCOPE_LABELS).map(([key, label]) => `<option value="${key}" ${session.aiScope === key ? "selected" : ""}>${escapeHtml(label)}${key === "current" ? ` · ${escapeHtml(AI_SECTION_LABELS[currentSection])}` : ""}</option>`).join("")}</select></label>
    <label class="wide"><span>用一句话说明本次创建或修改</span><textarea class="field" rows="2" maxlength="3000" data-board-ai-instructions placeholder="例如：创建4—8人团队竞争桌游；或把移动改为消耗2补给，并新增两块山地">${escapeHtml(session.aiInstructions)}</textarea></label>
    <button type="button" class="secondary-btn" data-action="board-ai-generate" ${session.aiGenerating ? "disabled" : ""}>${session.aiGenerating ? "正在编译 Demo…" : "生成可执行候选"}</button>${session.undoDesign ? `<button type="button" class="text-btn" data-action="board-ai-undo">撤销上次 AI 写入</button>` : ""}</div>
    ${session.aiError ? `<div class="board-ai-error" role="alert">${escapeHtml(session.aiError)}</div>` : ""}${aiDraftPreview(session)}</section>`;
}

export function boardGame() {
  const world = activeWorld();
  if (!world) return `<div class="empty-state"><h3>请先选择一个桌游项目</h3><p>创建项目后，席位、组件、规则和可玩 Demo 都从这里逐步补齐。</p></div>`;
  const creationType = world.settings?.narrativeProfile?.creationType || world.settings?.creationType;
  if (creationType !== "board_game") {
    return `<section class="card"><h3>工作区不匹配</h3><p>桌游编辑器只属于桌游项目。</p></section>`;
  }
  const session = initializeSession();
  const requestedTab = uiStore.get().boardGameRequestedTab;
  if (TAB_LABELS[requestedTab]) {
    session.activeTab = requestedTab;
    uiStore.set({ boardGameRequestedTab: "" });
  }
  const tabContent = session.activeTab === "seats" ? renderSeatsTab(session)
    : session.activeTab === "mechanisms" ? renderMechanismsTab(session)
      : session.activeTab === "playground" ? renderBoardGamePlayground(session.design, session.playgroundState, activeSeats(session))
      : session.activeTab === "rulebook" ? renderRulebookTab(session)
        : renderComponentsTab(session);
  return `<div class="board-game-workbench" data-board-workbench>
    <header class="board-game-header"><div><p class="section-kicker">BOARD GAME WORKBENCH</p><h1>${escapeHtml(world.name)}</h1><p>桌游专属工作台：玩家席位、组件资产、状态规则与说明书在同一份数据里互相引用。</p></div><button type="button" class="primary-btn ${session.dirty ? "has-changes" : ""}" data-action="board-design-save" data-board-save ${session.saving ? "disabled" : ""}><span data-board-save-label>${session.saving ? "正在保存…" : session.dirty ? "保存更改" : "已保存"}</span></button></header>
    ${aiDraftPanel(session)}
    <section class="board-game-brief"><label class="wide"><span>设计目标</span><input class="field" data-board-design-field="designGoal" maxlength="2400" value="${escapeHtml(session.design.designGoal)}" placeholder="这套规则围绕哪些对象、行动和状态变化运转？"></label><label><span>实际席位</span><input class="field" value="${activeSeats(session).length} 人" disabled></label><label><span>预计分钟</span><input class="field" data-board-design-field="playTimeMinutes" type="number" min="1" max="10080" value="${session.design.playTimeMinutes}"></label></section>
    <nav class="board-tabs" aria-label="桌游设计模块">${Object.entries(TAB_LABELS).map(([key, label]) => `<button type="button" class="${session.activeTab === key ? "active" : ""}" data-action="board-tab-select" data-board-tab="${key}">${label}</button>`).join("")}</nav>
    ${tabContent}
  </div>`;
}

function setDesignField(path, value) {
  const session = initializeSession();
  session.design[path] = path === "playTimeMinutes" ? (Number.parseInt(value, 10) || 1) : String(value || "");
  markDirty();
}

function setComponentField(componentId, field, value) {
  const component = initializeSession().design.components.find((item) => item.id === componentId);
  if (!component) return;
  component[field] = field === "quantity" ? (Number.parseInt(value, 10) || 1) : String(value || "");
  markDirty();
}

function setNestedItem(componentId, collection, itemId, field, value) {
  const component = initializeSession().design.components.find((item) => item.id === componentId);
  const item = component?.[collection]?.find((row) => row.id === itemId);
  if (!item) return;
  item[field] = field === "quantity" ? (Number.parseInt(value, 10) || 1) : String(value || "");
  markDirty();
}

function setVariableField(variableId, field, value) {
  const variable = initializeSession().design.variables.find((item) => item.id === variableId);
  if (!variable) return;
  variable[field] = ["initialValue", "min", "max"].includes(field) ? (Number(value) || 0) : String(value || "");
  if (["initialValue", "min", "max"].includes(field)) initializeSession().simulationState[variable.id] = variable.initialValue;
  markDirty();
}

function setMechanismField(mechanismId, field, value) {
  const mechanism = initializeSession().design.mechanisms.find((item) => item.id === mechanismId);
  if (!mechanism) return;
  mechanism[field] = String(value || "");
  markDirty();
}

function setMechanismChild(mechanismId, collection, itemId, field, value) {
  const mechanism = initializeSession().design.mechanisms.find((item) => item.id === mechanismId);
  const item = mechanism?.[collection]?.find((row) => row.id === itemId);
  if (!item) return;
  item[field] = String(value || "");
  markDirty();
}

function updateSimulatorResult() {
  const root = document.querySelector("[data-board-simulator]");
  const resultNode = root?.querySelector("[data-board-simulation-result]");
  const session = initializeSession();
  const mechanism = selectedMechanism(session);
  if (!root || !resultNode || !mechanism) return;
  const result = simulateBoardGameMechanism(mechanism, session.simulationState, session.design.variables);
  resultNode.className = `board-simulator-result ${result.passed ? "passed" : "blocked"}`;
  setHtml(resultNode, `<strong>${result.passed ? "条件成立，效果会执行" : "条件不成立，本次不执行"}</strong><div>${session.design.variables.map((variable) => `<span>${escapeHtml(variable.label)} <b>${escapeHtml(String(session.simulationState[variable.id] ?? variable.initialValue))}</b> → <b>${escapeHtml(String(result.state[variable.id] ?? session.simulationState[variable.id] ?? variable.initialValue))}</b></span>`).join("")}</div>`);
}

export function bindBoardGameEditor() {
  const root = document.querySelector("[data-board-workbench]");
  if (!root) return;
  root.addEventListener("input", handleBoardGameEditorInput);
  root.addEventListener("change", handleBoardGameEditorChange);
}

function handleBoardGameEditorInput(event) {
  const input = event.target;
  if (!input?.dataset) return;
  if (input.dataset.boardAiInstructions !== undefined) {
    initializeSession().aiInstructions = input.value;
    return;
  }
  if (input.dataset.boardDesignField) {
    setDesignField(input.dataset.boardDesignField, input.value);
    return;
  }
  const componentEditor = input.closest?.("[data-board-component-editor]");
  if (input.dataset.boardComponentField) {
    setComponentField(componentEditor?.dataset.boardComponentEditor, input.dataset.boardComponentField, input.value);
    return;
  }
  for (const [fieldKey, collection, selector, idKey] of COMPONENT_NESTED_FIELDS) {
    if (!input.dataset[fieldKey]) continue;
    const row = input.closest(selector);
    setNestedItem(componentEditor?.dataset.boardComponentEditor, collection, row?.dataset[idKey], input.dataset[fieldKey], input.value);
    return;
  }
  if (input.dataset.boardVariableField) {
    const row = input.closest("[data-board-variable-id]");
    setVariableField(row?.dataset.boardVariableId, input.dataset.boardVariableField, input.value);
    return;
  }
  const mechanismEditor = input.closest?.("[data-board-mechanism-editor]");
  if (input.dataset.boardMechanismField) {
    setMechanismField(mechanismEditor?.dataset.boardMechanismEditor, input.dataset.boardMechanismField, input.value);
    updateSimulatorResult();
    return;
  }
  for (const [fieldKey, collection, selector, idKey] of MECHANISM_NESTED_FIELDS) {
    if (!input.dataset[fieldKey]) continue;
    const row = input.closest(selector);
    setMechanismChild(mechanismEditor?.dataset.boardMechanismEditor, collection, row?.dataset[idKey], input.dataset[fieldKey], input.value);
    updateSimulatorResult();
    return;
  }
  if (input.dataset.boardSimulationKey) {
    initializeSession().simulationState[input.dataset.boardSimulationKey] = Number(input.value) || 0;
    updateSimulatorResult();
    return;
  }
  if (input.dataset.boardRulebookField) {
    initializeSession().design.rulebook[input.dataset.boardRulebookField] = String(input.value || "");
    markDirty();
  }
}

function handleBoardGameEditorChange(event) {
  const input = event.target;
  if (!input?.dataset) return;
  if (input.dataset.boardAiScope !== undefined) {
    initializeSession().aiScope = input.value;
    return;
  }
  if (input.dataset.boardAssetInput !== undefined) {
    void uploadBoardGameAssets(input.files);
    return;
  }
  if (input.dataset.boardSeatName !== undefined) {
    const row = input.closest("[data-board-seat-id]");
    void renameBoardGameSeat(row?.dataset.boardSeatId, input.value);
  }
}

export function selectBoardGameTab(tab) {
  if (!TAB_LABELS[tab]) return;
  initializeSession().activeTab = tab;
  render();
}

export function addBoardGameComponent(type) {
  const session = initializeSession();
  const component = createBoardGameComponent(type, session.design.components.length);
  session.design.components.push(component);
  session.selectedId = component.id;
  session.dirty = true;
  render();
}

export function selectBoardGameComponent(componentId) {
  const session = initializeSession();
  if (!session.design.components.some((component) => component.id === componentId)) return;
  session.selectedId = componentId;
  render();
}

export function deleteBoardGameComponent(componentId) {
  const session = initializeSession();
  const index = session.design.components.findIndex((component) => component.id === componentId);
  if (index < 0) return;
  session.design.components.splice(index, 1);
  session.design.mechanisms.forEach((mechanism) => { if (mechanism.sourceComponentId === componentId) mechanism.sourceComponentId = ""; });
  session.selectedId = session.design.components[index]?.id || session.design.components[index - 1]?.id || "";
  session.dirty = true;
  render();
}

export function addBoardGameStateField() {
  const session = initializeSession();
  const component = selectedComponent(session);
  if (!component) return;
  component.stateFields.push(normalizeBoardGameStateField({ id: `state-${Date.now().toString(36)}-${component.stateFields.length + 1}` }, component.stateFields.length));
  session.dirty = true;
  render();
}

export function deleteBoardGameStateField(stateId) {
  const session = initializeSession();
  const component = selectedComponent(session);
  if (!component) return;
  component.stateFields = component.stateFields.filter((field) => field.id !== stateId);
  session.dirty = true;
  render();
}

export function openBoardGameAssetPicker() {
  document.querySelector("[data-board-asset-input]")?.click();
}

function parseCsvRow(row) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (char === '"' && quoted && row[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += char;
  }
  values.push(value.trim());
  return values;
}

async function structuredEntries(file) {
  const raw = await file.text();
  if (file.name.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.cards) ? parsed.cards : []);
    if (!rows.length) throw new Error("JSON 需要是卡牌数组，或包含 cards 数组");
    return rows.map((row, index) => normalizeBoardGameEntry(row, index));
  }
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV 至少需要表头和一行卡牌数据");
  const headers = parseCsvRow(lines[0]).map((header) => header.toLowerCase());
  return lines.slice(1).map((line, index) => {
    const columns = parseCsvRow(line);
    const row = Object.fromEntries(headers.map((header, cellIndex) => [header, columns[cellIndex] || ""]));
    return normalizeBoardGameEntry({ name: row.name || row.title || columns[0], description: row.description || row.text || columns[1], quantity: row.quantity || columns[2] }, index);
  });
}

export async function uploadBoardGameAssets(fileList) {
  const session = initializeSession();
  const component = selectedComponent(session);
  const files = Array.from(fileList || []);
  if (!component || !files.length || session.busy) return;
  session.busy = true;
  try {
    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".json") || lowerName.endsWith(".csv")) {
        if (!["deck", "card"].includes(component.type)) throw new Error("JSON / CSV 卡表只能导入卡组或卡牌组件");
        component.entries.push(...await structuredEntries(file));
      } else {
        const uploaded = await zhimuApi.uploadAsset(file);
        component.assets.push(normalizeBoardGameAsset({
          id: `asset-${Date.now().toString(36)}-${component.assets.length + 1}`,
          assetId: uploaded?.id,
          fileName: uploaded?.original_filename || file.name,
          kind: file.type.startsWith("image/") ? "image" : "document",
          caption: ""
        }, component.assets.length));
      }
    }
    session.dirty = true;
    showToast("桌游素材已加入当前组件");
  } catch (error) {
    showToast(normalizeError(error, "素材处理失败，请检查文件格式"));
  } finally {
    session.busy = false;
    render();
  }
}

export function deleteBoardGameAsset(assetId) {
  const session = initializeSession();
  const component = selectedComponent(session);
  if (!component) return;
  component.assets = component.assets.filter((asset) => asset.id !== assetId);
  delete session.assetUrls[assetId];
  session.dirty = true;
  render();
}

export function addBoardGameEntry() {
  const session = initializeSession();
  const component = selectedComponent(session);
  if (!component) return;
  component.entries.push(normalizeBoardGameEntry({ id: `entry-${Date.now().toString(36)}-${component.entries.length + 1}` }, component.entries.length));
  session.dirty = true;
  render();
}

export function deleteBoardGameEntry(entryId) {
  const session = initializeSession();
  const component = selectedComponent(session);
  if (!component) return;
  component.entries = component.entries.filter((entry) => entry.id !== entryId);
  session.dirty = true;
  render();
}

function createSeat(sequence) {
  const session = initializeSession();
  const seat = createBoardGameSeat(sequence - 1);
  seat.sequence = sequence;
  session.design.seats.push(seat);
  session.design.playerCount = { min: session.design.seats.length, max: session.design.seats.length };
  session.dirty = true;
  return seat;
}

export async function addBoardGameSeat() {
  const session = initializeSession();
  if (session.busy) return;
  session.busy = true;
  render();
  try {
    createSeat(activeSeats(session).length + 1);
    showToast("已增加玩家席位");
  } catch (error) {
    showToast(normalizeError(error, "玩家席位创建失败"));
  } finally {
    session.busy = false;
    render();
  }
}

export async function initializeSixBoardGameSeats() {
  const session = initializeSession();
  if (session.busy) return;
  const existing = activeSeats(session).length;
  if (existing >= 6) return;
  session.busy = true;
  render();
  try {
    for (let sequence = existing + 1; sequence <= 6; sequence += 1) createSeat(sequence);
    showToast(`已补齐为 6 人桌游，新增 ${6 - existing} 个玩家席位`);
  } catch (error) {
    await loadCloudData(false, true);
    showToast(normalizeError(error, "席位未能全部创建，请重试"));
  } finally {
    session.busy = false;
    render();
  }
}

export async function renameBoardGameSeat(roleId, name) {
  const session = initializeSession();
  const role = activeSeats(session).find((item) => item.id === roleId);
  const nextName = String(name || "").trim();
  if (!role || !nextName || nextName === role.name) return;
  role.name = nextName;
  session.dirty = true;
  render();
  showToast("席位名称已写入桌游草稿");
}

export function saveBoardGameSeatName(roleId) {
  const row = document.querySelector(`[data-board-seat-id="${CSS.escape(roleId || "")}"]`);
  const input = row?.querySelector("[data-board-seat-name]");
  if (input) void renameBoardGameSeat(roleId, input.value);
}

export async function deleteBoardGameSeat(roleId) {
  const session = initializeSession();
  if (session.busy) return;
  if (session.seatDeleteArmedId !== roleId) {
    session.seatDeleteArmedId = roleId;
    render();
    showToast("删除会同时移除该席位的关联数据，请再次点击确认");
    return;
  }
  session.busy = true;
  render();
  try {
    session.design.seats = session.design.seats
      .filter((seat) => seat.id !== roleId)
      .map((seat, index) => ({ ...seat, sequence: index + 1 }));
    session.design.playerCount = session.design.seats.length
      ? { min: session.design.seats.length, max: session.design.seats.length }
      : session.design.playerCount;
    session.dirty = true;
    session.seatDeleteArmedId = "";
    showToast("玩家席位已从桌游草稿删除");
  } catch (error) {
    session.seatDeleteArmedId = "";
    showToast(normalizeError(error, "玩家席位删除失败"));
  } finally {
    session.busy = false;
    render();
  }
}

export function addBoardGameVariable() {
  const session = initializeSession();
  const variable = createBoardGameVariable(session.design.variables.length);
  session.design.variables.push(variable);
  session.simulationState[variable.id] = variable.initialValue;
  session.dirty = true;
  render();
}

export function deleteBoardGameVariable(variableId) {
  const session = initializeSession();
  session.design.variables = session.design.variables.filter((variable) => variable.id !== variableId);
  session.design.mechanisms.forEach((mechanism) => {
    mechanism.conditions = mechanism.conditions.filter((condition) => condition.sourceKey !== variableId);
    mechanism.effects = mechanism.effects.filter((effect) => effect.targetKey !== variableId);
  });
  delete session.simulationState[variableId];
  session.dirty = true;
  render();
}

export function addBoardGameMechanism(templateKey) {
  const session = initializeSession();
  const mechanism = createBoardGameMechanism(templateKey, session.design.variables, session.design.mechanisms.length);
  session.design.mechanisms.push(mechanism);
  session.selectedMechanismId = mechanism.id;
  session.dirty = true;
  render();
}

export function selectBoardGameMechanism(mechanismId) {
  const session = initializeSession();
  if (!session.design.mechanisms.some((mechanism) => mechanism.id === mechanismId)) return;
  session.selectedMechanismId = mechanismId;
  render();
}

export function deleteBoardGameMechanism(mechanismId) {
  const session = initializeSession();
  const index = session.design.mechanisms.findIndex((mechanism) => mechanism.id === mechanismId);
  if (index < 0) return;
  session.design.mechanisms.splice(index, 1);
  session.selectedMechanismId = session.design.mechanisms[index]?.id || session.design.mechanisms[index - 1]?.id || "";
  session.dirty = true;
  render();
}

export function addBoardGameCondition() {
  const session = initializeSession();
  const mechanism = selectedMechanism(session);
  if (!mechanism) return;
  mechanism.conditions.push({ id: `condition-${Date.now().toString(36)}-${mechanism.conditions.length + 1}`, sourceKey: session.design.variables[0]?.id || "", operator: "gte", value: "0" });
  session.dirty = true;
  render();
}

export function deleteBoardGameCondition(conditionId) {
  const session = initializeSession();
  const mechanism = selectedMechanism(session);
  if (!mechanism) return;
  mechanism.conditions = mechanism.conditions.filter((condition) => condition.id !== conditionId);
  session.dirty = true;
  render();
}

export function addBoardGameEffect() {
  const session = initializeSession();
  const mechanism = selectedMechanism(session);
  if (!mechanism) return;
  mechanism.effects.push({ id: `effect-${Date.now().toString(36)}-${mechanism.effects.length + 1}`, targetKey: session.design.variables[0]?.id || "", operation: "add", value: "1" });
  session.dirty = true;
  render();
}

export function deleteBoardGameEffect(effectId) {
  const session = initializeSession();
  const mechanism = selectedMechanism(session);
  if (!mechanism) return;
  mechanism.effects = mechanism.effects.filter((effect) => effect.id !== effectId);
  session.dirty = true;
  render();
}

export function resetBoardGameSimulator() {
  const session = initializeSession();
  session.simulationState = initialBoardGameState(session.design.variables);
  render();
}

export function selectBoardGamePlaygroundCommand(commandId) {
  const session = initializeSession();
  if (!choosePlaygroundCommandState(session.playgroundState, session.design, commandId)) return;
  render();
}

export function selectBoardGamePlaygroundTarget(targetId) {
  const session = initializeSession();
  if (!choosePlaygroundTargetState(session.playgroundState, session.design, targetId)) return;
  render();
}

export function confirmBoardGamePlaygroundAction() {
  const session = initializeSession();
  if (!confirmPlaygroundActionState(session.playgroundState, session.design)) return;
  render();
}

export function advanceBoardGamePlaygroundRound() {
  const session = initializeSession();
  if (!advancePlaygroundRoundState(session.playgroundState, session.design)) return;
  render();
}

export function resetBoardGamePlaygroundView() {
  const session = initializeSession();
  session.playgroundState = resetPlaygroundState(session.design, activeSeats(session).length || session.design.playerCount.min);
  render();
}

function replaceSessionDesign(session, value) {
  session.design = normalizeBoardGameDesign(value, { title: session.design.title });
  session.selectedId = session.design.components[0]?.id || "";
  session.selectedMechanismId = session.design.mechanisms[0]?.id || "";
  session.simulationState = initialBoardGameState(session.design.variables);
  session.playgroundState = createBoardGamePlaygroundState(session.design, activeSeats(session).length || session.design.playerCount.min);
  session.dirty = true;
}

export async function generateBoardGameDraft() {
  const session = initializeSession();
  if (session.aiGenerating) return;
  session.aiGenerating = true; session.aiError = ""; session.aiDraft = null; session.aiDraftBase = structuredClone(session.design); render();
  try {
    const seatCount = activeSeats(session).length;
    const currentDesign = normalizeBoardGameDesign({ ...session.design, playerCount: seatCount ? { min: seatCount, max: seatCount } : session.design.playerCount });
    const proposal = await generateBoardGameAiDraft({
      currentDesign, scope: session.aiScope, currentSection: session.activeTab === "playground" ? "engine" : session.activeTab,
      instructions: session.aiInstructions, seed: globalThis.crypto?.randomUUID?.() || `${Date.now()}`
    }, session.worldId);
    session.aiDraft = proposal;
    if (proposal.blocking) session.aiError = "候选包含当前引擎不能完整执行的结构；请查看能力报告后调整描述。";
    else showToast("可执行候选已生成，确认前不会覆盖当前内容");
  } catch (error) {
    session.aiError = normalizeError(error, "桌游候选生成失败，请检查模型连接后重试"); session.aiDraftBase = null;
  } finally { session.aiGenerating = false; render(); }
}

export function applyBoardGameDraft() {
  const session = initializeSession();
  if (!session.aiDraft?.draft || session.aiDraft.blocking) return;
  if (!session.aiDraftBase || JSON.stringify(normalizeBoardGameDesign(session.design)) !== JSON.stringify(normalizeBoardGameDesign(session.aiDraftBase))) {
    session.aiError = "候选生成后当前内容已经变化，请重新生成以免覆盖。"; render(); return;
  }
  session.undoDesign = structuredClone(session.design); replaceSessionDesign(session, session.aiDraft.draft); session.aiScope = "patch";
  session.aiDraft = null; session.aiDraftBase = null; session.aiError = ""; render(); showToast("已同步写入编辑器与试玩，尚未保存");
}

export function discardBoardGameDraft() { const session = initializeSession(); session.aiDraft = null; session.aiDraftBase = null; session.aiError = ""; render(); }
export function undoBoardGameDraft() { const session = initializeSession(); if (!session.undoDesign) return; const previous = session.undoDesign; session.undoDesign = null; replaceSessionDesign(session, previous); render(); }

export async function saveBoardGameDesign() {
  const session = initializeSession();
  const world = activeWorld();
  if (!world || !zhimuApi.context.worldId || session.saving) return;
  session.saving = true;
  render();
  try {
    const seatCount = activeSeats(session).length;
    const boardGameDesign = normalizeBoardGameDesign({
      ...session.design,
      playerCount: seatCount ? { min: seatCount, max: seatCount } : session.design.playerCount,
      updatedAt: new Date().toISOString()
    }, { title: world.name });
    const settingsPatch = { boardGameDesign };
    const updated = await zhimuApi.patchWorld({ settings: settingsPatch }, world.id, { revision: world.content_revision });
    const nextWorld = { ...world, ...updated, settings: updated.settings || { ...(world.settings || {}), ...settingsPatch }, content_revision: updated.content_revision ?? world.content_revision };
    worldStore.set({
      cloudWorlds: (worldStore.get().cloudWorlds || []).map((item) => item.id === world.id ? { ...item, ...nextWorld } : item),
      cloudWorkspacePreview: { world: nextWorld }
    });
    session.design = boardGameDesign;
    session.dirty = false;
    showToast("桌游设计已保存");
  } catch (error) {
    showToast(normalizeError(error, "桌游设计保存失败，请稍后重试"));
  } finally {
    session.saving = false;
    render();
  }
}

registerView("boardGame", {
  boardGame,
  bindBoardGameEditor,
  selectBoardGameTab,
  addBoardGameComponent,
  selectBoardGameComponent,
  deleteBoardGameComponent,
  addBoardGameStateField,
  deleteBoardGameStateField,
  openBoardGameAssetPicker,
  uploadBoardGameAssets,
  deleteBoardGameAsset,
  addBoardGameEntry,
  deleteBoardGameEntry,
  addBoardGameSeat,
  initializeSixBoardGameSeats,
  renameBoardGameSeat,
  saveBoardGameSeatName,
  deleteBoardGameSeat,
  addBoardGameVariable,
  deleteBoardGameVariable,
  addBoardGameMechanism,
  selectBoardGameMechanism,
  deleteBoardGameMechanism,
  addBoardGameCondition,
  deleteBoardGameCondition,
  addBoardGameEffect,
  deleteBoardGameEffect,
  resetBoardGameSimulator,
  selectBoardGamePlaygroundCommand,
  selectBoardGamePlaygroundTarget,
  confirmBoardGamePlaygroundAction,
  advanceBoardGamePlaygroundRound,
  resetBoardGamePlaygroundView,
  generateBoardGameDraft,
  applyBoardGameDraft,
  discardBoardGameDraft,
  undoBoardGameDraft,
  saveBoardGameDesign
});
