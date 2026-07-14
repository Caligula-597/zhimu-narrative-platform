/**
 * Creator six-workspace views: production, structure (Segment workbench),
 * truth & relations, publish lab, and post-play insights.
 */
import * as zhimuApi from "../api/index.js";
import { normalizeBeatPlan, normalizeSegmentOperations } from "shared/segment-contract.js";
import { showToast } from "../components/toast.js";
import { getRuntime, go, render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { studioStore, worldStore, roomStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as U from "../components/emptyState.js";
import { normalizeError } from "../components/status-ui.js";
import { setHtml } from "../../shared/safe-dom.js";
import {
  loadCreatorAnalytics,
  loadQualityReports,
  recordQualityReportSnapshot,
  renderCreatorAnalyticsPanel,
  renderQualityReportsPanel,
  renderRelationshipGraph
} from "./platform-runtime.js";
import { renderTruthBiblePage, loadTruthBibleTab } from "./truth-bible.js";
import { contentLayerMapHtml } from "../components/content-layer-map.js";

const escapeHtml = F.escapeHtml || ((v = "") => String(v));
const activeRuntimeRoom = U.activeRuntimeRoom || (() => null);
const showError = (error, fallback = "操作失败，请稍后重试") => showToast(normalizeError(error, fallback));

function roleOptions(roles = []) {
  return roles.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join("");
}

function workspaceHero(kicker, title, lede) {
  return `<section class="workspace-hero card">
    <p class="section-kicker">${escapeHtml(kicker)}</p>
    <h2>${escapeHtml(title)}</h2>
    <p class="workspace-lede">${lede}</p>
  </section>`;
}

function workspaceLinkCard(view, icon, title, detail) {
  return `<button type="button" class="workspace-link-card" data-go="${escapeHtml(view)}">
    <span class="workspace-link-icon">${icon}</span>
    <strong>${escapeHtml(title)}</strong>
    <p>${escapeHtml(detail)}</p>
  </button>`;
}

export function creatorWorkspaceHub() {
  return `<section class="workspace-mode-intro card">
    <p class="section-kicker">WORK MODE</p>
    <h2>工作模式</h2>
    <p>下面是按<strong>工作类型</strong>切换的入口，不是第二套创作顺序。日常请以侧栏<strong>创作驾驶舱六阶段</strong>为主流程；需要啃大编辑器时再进「精细编辑器」。</p>
  </section>
  <section class="workspace-hub-grid" aria-label="工作模式">
    ${workspaceLinkCard("creatorCockpit", "⌂", "创作驾驶舱", "六阶段主流程 · 完成度与深链")}
    ${workspaceLinkCard("production", "✎", "内容生产", "AI、母稿、角色分幕、导入导出")}
    ${workspaceLinkCard("structure", "◇", "结构编排", "Segment 工作台与编排入口")}
    ${workspaceLinkCard("truth", "◈", "真相与关系", "真相链、关系图、误导线")}
    ${workspaceLinkCard("publish", "▶", "测试与发布", "发布检查、质量报告、试跑")}
    ${workspaceLinkCard("insights", "◷", "复盘改本", "完成率、线索命中、玩后洞察")}
  </section>`;
}

/** 内容生产 — entry hub for writer / AI / import */
export function production() {
  const data = studioStore.get().cloudStudio;
  if (!data) {
    return U.creatorWorkspaceEmpty?.({
      title: "内容生产",
      kicker: "CONTENT PRODUCTION",
      intro: "从 AI/Matrix 生成、角色私人分幕到导入导出，在这里开始写本。",
      guideTitle: "开始",
      guideItems: []
    }) || `<section class="card"><h3>尚未选择剧本</h3></section>`;
  }
  const roleCount = data.roles?.length || 0;
  const sectionCount = data.sections?.length || 0;
  return `${workspaceHero("CONTENT PRODUCTION", "内容生产", "合并 AI 剧本创作、完整剧情、角色私人分幕与内容包导入导出。写本完成后进入 <strong>结构编排</strong> 绑定 Segment。")}
  ${contentLayerMapHtml({ open: false })}
  <section class="workspace-action-grid">
    <button type="button" class="workspace-action-card primary" data-action="deepseek-pipeline"><strong>AI 悬疑创作</strong><span>八层生成 · 立项到入库</span></button>
    <button type="button" class="workspace-action-card" data-action="story-manuscript"><strong>完整剧情</strong><span>母稿与章节总览</span></button>
    <button type="button" class="workspace-action-card" data-action="creator-import"><strong>导入内容包</strong><span>Word / Markdown / 内容包</span></button>
    <button type="button" class="workspace-action-card" data-go="writer"><strong>角色私人剧本</strong><span>${roleCount} 角色 · ${sectionCount} 分幕</span></button>
    <button type="button" class="workspace-action-card" data-action="creator-export"><strong>交付包导出</strong><span>玩家本 · 线索清单 · 主持手册 · JSON</span></button>
    <button type="button" class="workspace-action-card" data-action="story-assistant"><strong>规则分类器</strong><span>从母稿提取结构化规则</span></button>
  </section>
  <section class="card" style="margin-top:14px"><div class="section-head"><div><h3>下一步</h3><p>内容就绪后绑定运行态段落。</p></div><button class="secondary-btn" data-go="structure">打开 Segment 工作台 →</button></div></section>`;
}

function selectedSegment(segments = [], selectedId) {
  if (!segments.length) return null;
  return segments.find((s) => s.id === selectedId) || segments[0];
}

function segmentListItem(segment, selectedId) {
  const active = segment.id === selectedId ? " is-active" : "";
  return `<button type="button" class="segment-list-item${active}" data-action="select-structure-segment" data-segment-id="${escapeHtml(segment.id)}">
    <strong>${escapeHtml(segment.segmentKey)}</strong>
    <span>${escapeHtml(segment.title)}</span>
    <small>顺序 ${segment.sequence}</small>
  </button>`;
}

function linesFromList(items = []) {
  return (items || []).filter(Boolean).join("\n");
}

function listFromLines(value = "") {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function clueGrantsToText(grants = []) {
  return (grants || [])
    .map((grant) => [grant.clueId || grant.clue_id || "", grant.when || grant.timing || "", grant.roleKey || grant.role_key || ""].filter(Boolean).join(" | "))
    .filter(Boolean)
    .join("\n");
}

function clueGrantsFromText(value = "") {
  return listFromLines(value).map((line) => {
    const [clueId = "", when = "", roleKey = ""] = line.split("|").map((part) => part.trim());
    return { clueId, when, roleKey };
  }).filter((grant) => grant.clueId);
}

function beatPlanFromForm(form) {
  return normalizeBeatPlan({
    goal: form.querySelector('[name="beatGoal"]')?.value,
    playerContent: form.querySelector('[name="beatPlayerContent"]')?.value,
    dmTasks: form.querySelector('[name="beatDmTasks"]')?.value,
    openClues: form.querySelector('[name="beatOpenClues"]')?.value,
    privateChatHints: form.querySelector('[name="beatPrivateChat"]')?.value,
    estimatedMinutes: form.querySelector('[name="beatMinutes"]')?.value,
    advanceCondition: form.querySelector('[name="beatAdvance"]')?.value
  });
}

function renderBeatPlanEditor(beatPlan = {}) {
  const beat = normalizeBeatPlan(beatPlan);
  return `<section class="segment-beat-editor">
    <div class="section-head compact"><div><h3>分幕流程 beatPlan</h3><p class="muted-note">写入 segment.story.beatPlan，描述本幕目标、时长与推进条件。</p></div></div>
    <label>本幕目标</label><textarea class="field" name="beatGoal" rows="2">${escapeHtml(beat.goal)}</textarea>
    <label>玩家可读内容摘要</label><textarea class="field" name="beatPlayerContent" rows="2">${escapeHtml(beat.playerContent)}</textarea>
    <label>DM 任务</label><textarea class="field" name="beatDmTasks" rows="2">${escapeHtml(beat.dmTasks)}</textarea>
    <label>可开放线索/地图</label><textarea class="field" name="beatOpenClues" rows="2">${escapeHtml(beat.openClues)}</textarea>
    <label>私聊建议</label><textarea class="field" name="beatPrivateChat" rows="2">${escapeHtml(beat.privateChatHints)}</textarea>
    <label>预计时长（分钟）</label><input class="field" name="beatMinutes" type="number" min="0" max="999" value="${beat.estimatedMinutes ?? ""}" placeholder="例如 45">
    <label>推进条件</label><textarea class="field" name="beatAdvance" rows="2">${escapeHtml(beat.advanceCondition)}</textarea>
  </section>`;
}

function renderSegmentOperationsEditor(operations = {}) {
  const ops = normalizeSegmentOperations(operations);
  const advancedJson = JSON.stringify(operations || {}, null, 2);
  return `<section class="segment-ops-editor">
    <div class="section-head compact"><div><h3>主持运行信息</h3><p class="muted-note">常用字段会写入 Segment.operations，供主持端当前幕读取。</p></div></div>
    <label>主持流程 flow</label><textarea class="field" name="opsFlow" rows="4">${escapeHtml(ops.flow)}</textarea>
    <label>主持真相 hostTruth</label><textarea class="field" name="opsHostTruth" rows="4">${escapeHtml(ops.hostTruth)}</textarea>
    <label>应发线索 clueGrants</label><textarea class="field monospace-field" name="opsClueGrants" rows="4" placeholder="clueId | 发放时机 | roleKey">${escapeHtml(clueGrantsToText(ops.clueGrants))}</textarea>
    <label>补救话术 fallbacks</label><textarea class="field" name="opsFallbacks" rows="3">${escapeHtml(linesFromList(ops.fallbacks))}</textarea>
    <details class="segment-advanced-json">
      <summary>高级 JSON</summary>
      <textarea class="field monospace-field" name="operationsAdvanced" rows="6">${escapeHtml(advancedJson)}</textarea>
    </details>
  </section>`;
}

const REF_TYPE_LABELS = {
  chapter: "公共章节",
  script_section: "私人分幕",
  scene: "场景",
  clue: "线索",
  item: "物品",
  rule: "规则",
  truth_claim: "真相断言"
};

function segmentRefLabel(studio, ref) {
  if (!ref?.refId) return "—";
  const id = ref.refId;
  switch (ref.refType) {
    case "chapter":
      return studio?.chapters?.find((c) => c.id === id)?.title || id.slice(0, 8);
    case "clue":
      return studio?.clues?.find((c) => c.id === id)?.name || id.slice(0, 8);
    case "scene":
      return studio?.scenes?.find((s) => s.id === id)?.name || id.slice(0, 8);
    case "script_section": {
      const section = studio?.sections?.find((s) => s.id === id);
      const role = studio?.roles?.find((r) => r.id === (ref.roleSlotId || section?.role_slot_id));
      return section ? `${role?.name || "角色"} · ${section.title}` : id.slice(0, 8);
    }
    case "rule": {
      const rule = (worldStore.get().cloudRules || []).find((r) => r.id === id);
      return rule?.name || id.slice(0, 8);
    }
    default:
      return id.slice(0, 8);
  }
}

function refResourceOptions(studio, refType) {
  const rules = worldStore.get().cloudRules || [];
  switch (refType) {
    case "chapter":
      return (studio?.chapters || []).map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)}</option>`).join("");
    case "clue":
      return (studio?.clues || []).map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
    case "scene":
      return (studio?.scenes || []).map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join("");
    case "script_section":
      return (studio?.sections || []).map((s) => {
        const role = studio?.roles?.find((r) => r.id === s.role_slot_id);
        return `<option value="${escapeHtml(s.id)}" data-role-slot="${escapeHtml(s.role_slot_id || "")}">${escapeHtml(role?.name || "角色")} · ${escapeHtml(s.title)}</option>`;
      }).join("");
    case "rule":
      return rules.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join("");
    default:
      return "";
  }
}

function segmentRefsPanel(segment, studio) {
  const refs = segment?.refs || [];
  const chapters = studio?.chapters || [];
  const clues = studio?.clues || [];
  const refRows = refs.length
    ? refs.map((r) => `<li class="segment-ref-row">
        <span><code>${escapeHtml(REF_TYPE_LABELS[r.refType] || r.refType)}</code> ${escapeHtml(segmentRefLabel(studio, r))}${r.metadata?.when ? `<small class="muted-note"> · ${escapeHtml(r.metadata.when)}</small>` : ""}</span>
        <button type="button" class="text-btn danger-text" data-action="remove-segment-ref" data-segment-id="${escapeHtml(segment.id)}" data-ref-type="${escapeHtml(r.refType)}" data-ref-id="${escapeHtml(r.refId)}" data-role-slot-id="${escapeHtml(r.roleSlotId || "")}">移除</button>
      </li>`).join("")
    : `<li class="muted-note">暂无关联。Matrix 导入会自动绑定章节/分幕/线索；也可手动追加。</li>`;
  const defaultRefType = "chapter";
  const options = refResourceOptions(studio, defaultRefType);
  return `<div class="segment-refs-panel" data-segment-refs="${escapeHtml(segment.id)}">
    <h4>关联资源</h4>
    <ul class="segment-ref-list">${refRows}</ul>
    <div class="segment-ref-add form-group">
      <label>追加关联</label>
      <select class="field" data-ref-field="refType">${Object.entries(REF_TYPE_LABELS).map(([k, v]) => `<option value="${k}"${k === defaultRefType ? " selected" : ""}>${v}</option>`).join("")}</select>
      <select class="field" data-ref-field="refId">${options || `<option value="">暂无可选资源</option>`}</select>
      <button type="button" class="secondary-btn full-btn" data-action="add-segment-ref" data-segment-id="${escapeHtml(segment.id)}">＋ 添加关联</button>
    </div>
    <div class="segment-quick-links">
      <button type="button" class="text-btn" data-go="studio">编排图谱</button>
      <button type="button" class="text-btn" data-go="clues">线索库 (${clues.length})</button>
      <button type="button" class="text-btn" data-go="rules">规则 (${(worldStore.get().cloudRules || []).filter((r) => r.enabled).length} 启用)</button>
    </div>
    <p class="muted-note">公共章节：${chapters.length} · Matrix 同步后 operations 含主持 runbook。</p>
  </div>`;
}

/** Segment 工作台 — left list / center editor / right refs */
export function structure() {
  const studio = studioStore.get().cloudStudio;
  const { cloudSegments: segments, cloudSelectedSegmentId: selectedId } = worldStore.get();
  if (!studio) {
    return `<section class="card"><h3>尚未选择剧本</h3><p class="muted-note">请先创建或选择世界。</p></section>`;
  }
  const list = segments?.length
    ? segments.map((s) => segmentListItem(s, selectedId || segments[0]?.id)).join("")
    : `<div class="empty-state">尚无 Segment。点击下方创建，或从 Matrix 导入后绑定。</div>`;
  const current = selectedSegment(segments || [], selectedId);
  const storyExtra = { ...(current?.story || {}) };
  delete storyExtra.beatPlan;
  const storyAdvancedJson = Object.keys(storyExtra).length ? JSON.stringify(storyExtra, null, 2) : "{}";
  const editor = current
    ? `<form class="segment-editor" data-segment-editor="${escapeHtml(current.id)}">
        <label>段落键</label><input class="field" name="segmentKey" value="${escapeHtml(current.segmentKey || "")}" readonly>
        <label>标题</label><input class="field" name="title" value="${escapeHtml(current.title || "")}">
        <label>顺序</label><input class="field" name="sequence" type="number" min="1" value="${Number(current.sequence) || 1}">
        ${renderBeatPlanEditor(current?.story?.beatPlan || {})}
        <details class="segment-advanced-json">
          <summary>story 扩展字段（JSON）</summary>
          <textarea class="field monospace-field" name="storyAdvanced" rows="4">${escapeHtml(storyAdvancedJson)}</textarea>
        </details>
        ${renderSegmentOperationsEditor(current.operations || {})}
        <div class="row"><button type="button" class="primary-btn" data-action="save-structure-segment" data-segment-id="${escapeHtml(current.id)}">保存段落</button></div>
      </form>`
    : `<div class="empty-state">选择或创建一个 Segment 开始编辑。</div>`;
  return `${workspaceHero("SEGMENT WORKBENCH", "结构编排", "Segment 是章节、分幕、任务与主持 runbook 的<strong>聚合层</strong>，不替换 script_sections。左选段落，中编辑本幕，右跳转关联资源。")}
  ${contentLayerMapHtml({ open: false })}
  <section class="segment-workbench">
    <aside class="segment-workbench-list card">
      <div class="section-head"><div><h3>段落列表</h3></div><div class="row"><button type="button" class="secondary-btn" data-action="sync-structure-segments">从章节同步</button><button type="button" class="secondary-btn" data-action="refresh-structure-segments">刷新</button></div></div>
      <div class="segment-list">${list}</div>
      <div class="segment-create-inline">
        <input class="field" data-seg-new="segmentKey" placeholder="键 ch1">
        <input class="field" data-seg-new="title" placeholder="标题">
        <button type="button" class="secondary-btn full-btn" data-action="create-structure-segment">＋ 新增段落</button>
      </div>
    </aside>
    <article class="segment-workbench-main card">${editor}</article>
    <aside class="segment-workbench-side card">${current ? segmentRefsPanel(current, studio) : `<div class="empty-state">关联面板</div>`}</aside>
  </section>`;
}

export async function refreshStructureSegments() {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return showToast("请先选择剧本");
  try {
    const payload = await zhimuApi.getWorldSegments(worldId);
    const segments = payload?.segments || [];
    const selected = worldStore.get().cloudSelectedSegmentId;
    worldStore.set({
      cloudSegments: segments,
      cloudSelectedSegmentId: selected && segments.some((s) => s.id === selected) ? selected : segments[0]?.id || null
    });
    render();
  } catch (error) {
    showError(error);
  }
}

export function selectStructureSegment(segmentId) {
  worldStore.set({ cloudSelectedSegmentId: segmentId });
  render();
}

export async function createStructureSegment() {
  const worldId = zhimuApi.context.worldId;
  const keyEl = document.querySelector("[data-seg-new=\"segmentKey\"]");
  const titleEl = document.querySelector("[data-seg-new=\"title\"]");
  const segmentKey = keyEl?.value?.trim();
  const title = titleEl?.value?.trim();
  if (!segmentKey || !title) return showToast("请填写段落键与标题");
  try {
    const created = await zhimuApi.createWorldSegment({ segmentKey, title, sequence: (worldStore.get().cloudSegments?.length || 0) + 1 }, worldId);
    await refreshStructureSegments();
    worldStore.set({ cloudSelectedSegmentId: created?.segment?.id || null });
    showToast("段落已创建");
  } catch (error) {
    showError(error);
  }
}

export async function saveStructureSegment(segmentId) {
  const form = document.querySelector(`[data-segment-editor="${segmentId}"]`);
  if (!form) return;
  const title = form.querySelector('[name="title"]')?.value?.trim();
  const sequence = Number(form.querySelector('[name="sequence"]')?.value || "1");
  let story = {};
  let operations = {};
  try {
    const storyExtra = JSON.parse(form.querySelector('[name="storyAdvanced"]')?.value || "{}");
    story = { ...storyExtra, beatPlan: beatPlanFromForm(form) };
    const advanced = JSON.parse(form.querySelector('[name="operationsAdvanced"]')?.value || "{}");
    operations = normalizeSegmentOperations({
      ...advanced,
      flow: form.querySelector('[name="opsFlow"]')?.value || "",
      hostTruth: form.querySelector('[name="opsHostTruth"]')?.value || "",
      clueGrants: clueGrantsFromText(form.querySelector('[name="opsClueGrants"]')?.value || ""),
      fallbacks: listFromLines(form.querySelector('[name="opsFallbacks"]')?.value || "")
    });
  } catch {
    return showToast("JSON 格式无效");
  }
  try {
    await zhimuApi.updateWorldSegment(segmentId, { title, sequence, story, operations }, zhimuApi.context.worldId);
    await refreshStructureSegments();
    showToast("段落已保存");
  } catch (error) {
    showError(error);
  }
}

function segmentById(segmentId) {
  return (worldStore.get().cloudSegments || []).find((s) => s.id === segmentId) || null;
}

export async function syncStructureSegmentsFromGraph() {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return showToast("请先选择剧本");
  try {
    const result = await zhimuApi.syncWorldSegmentsFromGraph(worldId);
    await refreshStructureSegments();
    showToast(`已从章节同步 ${result?.segmentsSynced ?? 0} 个段落`);
  } catch (error) {
    showError(error);
  }
}

export async function addSegmentRef(segmentId) {
  const panel = document.querySelector(`[data-segment-refs="${segmentId}"]`);
  const refType = panel?.querySelector('[data-ref-field="refType"]')?.value;
  const refSelect = panel?.querySelector('[data-ref-field="refId"]');
  const refId = refSelect?.value;
  if (!refType || !refId) return showToast("请选择关联类型与资源");
  const segment = segmentById(segmentId);
  if (!segment) return showToast("段落不存在，请刷新");
  const refs = [...(segment.refs || [])];
  const roleSlotId = refType === "script_section"
    ? refSelect.selectedOptions[0]?.dataset?.roleSlot || null
    : null;
  if (refs.some((r) => r.refType === refType && r.refId === refId && (r.roleSlotId || "") === (roleSlotId || ""))) {
    return showToast("该关联已存在");
  }
  refs.push({ refType, refId, roleSlotId: roleSlotId || undefined });
  try {
    await zhimuApi.updateWorldSegment(segmentId, { refs }, zhimuApi.context.worldId);
    await refreshStructureSegments();
    showToast("关联已添加");
  } catch (error) {
    showError(error);
  }
}

export async function removeSegmentRef(segmentId, refType, refId, roleSlotId = "") {
  const segment = segmentById(segmentId);
  if (!segment) return;
  const refs = (segment.refs || []).filter(
    (r) => !(r.refType === refType && r.refId === refId && (r.roleSlotId || "") === (roleSlotId || ""))
  );
  try {
    await zhimuApi.updateWorldSegment(segmentId, { refs }, zhimuApi.context.worldId);
    await refreshStructureSegments();
    showToast("关联已移除");
  } catch (error) {
    showError(error);
  }
}

export function bindSegmentRefTypeSelect() {
  const panel = document.querySelector("[data-segment-refs]");
  if (!panel) return;
  const typeSelect = panel.querySelector('[data-ref-field="refType"]');
  const idSelect = panel.querySelector('[data-ref-field="refId"]');
  if (!typeSelect || !idSelect || typeSelect.dataset.bound) return;
  typeSelect.dataset.bound = "1";
  const studio = studioStore.get().cloudStudio;
  typeSelect.onchange = () => {
    const options = refResourceOptions(studio, typeSelect.value);
    setHtml(idSelect, options || `<option value="">暂无可选资源</option>`);
  };
}

export async function refreshTruthWorkspace() {
  const tab = worldStore.get().truthBibleTab || "claims";
  await loadTruthBibleTab(tab);
}

export async function addTruthClaimInline() {
  const title = document.querySelector("[data-truth-field=\"title\"]")?.value?.trim();
  const claim = document.querySelector("[data-truth-field=\"claim\"]")?.value?.trim();
  const confidence = document.querySelector("[data-truth-field=\"confidence\"]")?.value || "canon";
  if (!title || !claim) return showToast("请填写标题与断言");
  try {
    await zhimuApi.createTruthClaim({ title, claim, confidence }, zhimuApi.context.worldId);
    await refreshTruthWorkspace();
    showToast("断言已添加");
  } catch (error) {
    showError(error);
  }
}

export async function addRelationshipInline() {
  const from = document.querySelector("[data-rel-field=\"from\"]")?.value;
  const to = document.querySelector("[data-rel-field=\"to\"]")?.value;
  const label = document.querySelector("[data-rel-field=\"label\"]")?.value?.trim() || "";
  const strengthRaw = document.querySelector("[data-rel-field=\"strength\"]")?.value;
  if (!from || !to || from === to) return showToast("请选择两个不同角色");
  try {
    await zhimuApi.createRoleRelationship({
      fromRoleSlotId: from,
      toRoleSlotId: to,
      label,
      strength: strengthRaw === "" ? undefined : Number(strengthRaw)
    }, zhimuApi.context.worldId);
    await refreshTruthWorkspace();
    showToast("关系已添加");
  } catch (error) {
    showError(error);
  }
}

/** 真相与关系 — professional bible view */
export function truth() {
  return renderTruthBiblePage();
}

/** 测试与发布 */
export function publishLab() {
  const checks = worldStore.get().cloudCreatorChecks || [];
  const room = activeRuntimeRoom();
  const checkRows = checks.length
    ? checks.map((c) => `<div class="check-result ${c.level}"><b>${escapeHtml(c.title)}</b><span>${escapeHtml(c.detail)}</span></div>`).join("")
    : `<div class="empty-state">点击「运行发布检查」生成报告，并可存档为质量报告。</div>`;
  return `${workspaceHero("TEST & PUBLISH", "测试与发布", "发布前检查、质量报告存档、玩家/主持视角试跑与测试房。")}
  <section class="publish-lab-grid">
    <article class="card">
      <div class="section-head"><div><h3>发布检查</h3><p>阻塞项必须先处理。</p></div><button type="button" class="secondary-btn" data-action="creator-check">运行发布检查</button></div>
      <div class="check-list">${checkRows}</div>
      <div class="row" style="margin-top:12px"><button type="button" class="secondary-btn" data-action="record-quality-report">存档为质量报告</button><button type="button" class="secondary-btn" data-action="world-rooms">${room ? "管理运行房" : "创建测试房"}</button></div>
    </article>
    <article class="card publish-preview-card">
      <div class="section-head"><div><h3>视角与发布影响</h3><p>先看“现在玩家能看到什么”，再进端试跑。</p></div></div>
      <button type="button" class="primary-btn full-btn" data-action="publish-impact-preview">发布影响预览</button>
      <button type="button" class="secondary-btn full-btn" style="margin-top:8px" data-action="creator-preview">玩家视角预览（私人分幕正文）</button>
      <button type="button" class="secondary-btn full-btn" style="margin-top:8px" data-go="player">打开独立玩家端</button>
      <button type="button" class="secondary-btn full-btn" style="margin-top:8px" data-action="open-host-console">打开主持端试跑</button>
    </article>
  </section>
  ${renderQualityReportsPanel()}`;
}

/** 复盘改本 */
function renderSegmentCompletionPanel() {
  const data = worldStore.get().cloudSegmentCompletion;
  if (!data) {
    return `<section class="segment-completion-panel card">
      <div class="section-head">
        <div><p class="section-kicker">SEGMENT COMPLETION</p><h3>段落完成率</h3><p>按角色与分幕统计玩家阅读完成情况。</p></div>
        <button type="button" class="secondary-btn" data-action="load-segment-completion">加载完成率</button>
      </div>
      <div class="empty-state">点击「加载完成率」从云端拉取当前世界/运行房的分幕完成统计。</div>
    </section>`;
  }
  const scopeLabel = data.scope === "room" ? "当前运行房" : `全世界 · ${data.totalRooms} 个运行房`;
  const roleGroups = data.roleGroups || [];
  const roleRows = roleGroups.length
    ? roleGroups.map((group) => {
        const sectionRows = (group.sections || [])
          .map((section) => {
            const pct = section.completionRate || 0;
            return `<div class="segment-row">
              <div class="segment-row-head"><strong>${escapeHtml(section.title)}</strong><span class="status-chip neutral">${pct}%</span></div>
              <div class="segment-row-meta"><span>${escapeHtml(section.label || "")}</span>${section.averageMinutes != null ? `<span class="muted-note">平均 ${Math.round(section.averageMinutes)} 分钟</span>` : ""}</div>
              <div class="progress"><i style="width:${pct}%"></i></div>
            </div>`;
          })
          .join("");
        return `<details class="segment-role-group" open>
          <summary><strong>${escapeHtml(group.roleName)}</strong><span class="muted-note">${group.sectionCount} 段 · 平均 ${group.averageCompletion}%</span></summary>
          <div class="segment-role-body">${sectionRows || '<div class="empty-state">该角色暂无分幕。</div>'}</div>
        </details>`;
      }).join("")
    : `<div class="empty-state">暂无分幕数据。先在创作台创建角色与私人分幕，再让玩家进入运行房阅读。</div>`;
  return `<section class="segment-completion-panel card">
    <div class="section-head">
      <div><p class="section-kicker">SEGMENT COMPLETION</p><h3>段落完成率</h3><p>按角色与分幕统计玩家阅读完成情况。</p></div>
      <div class="row">
        <span class="status-chip neutral">${scopeLabel} · 平均 ${data.averageCompletion}%</span>
        <button type="button" class="secondary-btn" data-action="load-segment-completion">刷新</button>
        <button type="button" class="text-btn" data-go="writer">编辑分幕 →</button>
        <button type="button" class="text-btn" data-go="structure">Segment 工作台 →</button>
      </div>
    </div>
    <div class="segment-summary">${escapeHtml(data.summary?.label || "")}</div>
    <div class="segment-role-list">${roleRows}</div>
  </section>`;
}

function renderClueHitRatePanel() {
  const data = worldStore.get().cloudClueHitRate;
  if (!data) {
    return `<section class="clue-hit-rate-panel card">
      <div class="section-head">
        <div><p class="section-kicker">CLUE HIT RATE</p><h3>线索命中率</h3><p>统计每条线索在运行房中的获得、已读与分享情况。</p></div>
        <button type="button" class="secondary-btn" data-action="load-clue-hit-rate">加载命中率</button>
      </div>
      <div class="empty-state">点击「加载命中率」从云端拉取线索命中统计。</div>
    </section>`;
  }
  const scopeLabel = data.scope === "room" ? "当前运行房" : `全世界 · ${data.totalRooms} 个运行房`;
  const clueRows = (data.clues || []).length
    ? data.clues
        .slice()
        .sort((a, b) => (b.hitRate || 0) - (a.hitRate || 0))
        .map((clue) => {
          const pct = clue.hitRate || 0;
          return `<div class="hit-rate-row">
            <div class="hit-rate-row-head"><strong>${escapeHtml(clue.name)}</strong><span class="status-chip neutral">${pct}%</span></div>
            <div class="hit-rate-row-meta"><span>${escapeHtml(clue.label || "")}</span></div>
            <div class="progress"><i style="width:${pct}%"></i></div>
          </div>`;
        })
        .join("")
    : `<div class="empty-state">暂无线索数据。</div>`;
  return `<section class="clue-hit-rate-panel card">
    <div class="section-head">
      <div><p class="section-kicker">CLUE HIT RATE</p><h3>线索命中率</h3><p>统计每条线索在运行房中的获得、已读与分享情况。</p></div>
      <div class="row">
        <span class="status-chip neutral">${scopeLabel} · 平均 ${data.averageHitRate ?? "—"}%</span>
        <button type="button" class="secondary-btn" data-action="load-clue-hit-rate">刷新</button>
        <button type="button" class="text-btn" data-go="clues">线索库 →</button>
      </div>
    </div>
    <div class="hit-rate-summary">${escapeHtml(data.summary?.label || "")}</div>
    <details class="hit-rate-clue-list" open>
      <summary>线索明细 · ${data.totalClues || 0} 条</summary>
      <div class="hit-rate-clue-rows">${clueRows}</div>
    </details>
  </section>`;
}

export function insights() {
  const { cloudSegmentCompletion, cloudClueHitRate } = worldStore.get();
  const completionHint = cloudSegmentCompletion
    ? `平均完成 ${cloudSegmentCompletion.averageCompletion}% · ${cloudSegmentCompletion.scope === "room" ? "当前运行房" : "全世界"}`
    : "尚未加载段落完成率";
  const clueHint = cloudClueHitRate
    ? `线索命中 ${cloudClueHitRate.summary?.hitRate ?? cloudClueHitRate.averageHitRate ?? "—"}%`
    : "尚未加载线索命中率";
  return `${workspaceHero("REVISION INSIGHTS", "复盘改本", "运行数据：段落完成率、线索命中率与玩后统计。可按数据回到对应创作阶段继续编辑。")}
  <section class="insights-toolbar card">
    <div class="row">
      <span class="muted-note">段落：${escapeHtml(completionHint)}</span>
      <span class="muted-note">线索：${escapeHtml(clueHint)}</span>
    </div>
    <div class="row" style="margin-top:12px">
      <button type="button" class="text-btn" data-go="writer">角色私人剧本 →</button>
      <button type="button" class="text-btn" data-go="structure">Segment 工作台 →</button>
      <button type="button" class="text-btn" data-go="clues">线索库 →</button>
      <button type="button" class="text-btn" data-go="truth">真相与关系 →</button>
      <button type="button" class="text-btn" data-go="archive">存档明细 →</button>
    </div>
  </section>
  ${renderSegmentCompletionPanel()}
  ${renderClueHitRatePanel()}
  ${renderCreatorAnalyticsPanel()}`;
}

export const creatorWorkspacesApi = {
  production,
  structure,
  truth,
  publishLab,
  insights,
  creatorWorkspaceHub,
  refreshStructureSegments,
  selectStructureSegment,
  createStructureSegment,
  saveStructureSegment,
  syncStructureSegmentsFromGraph,
  addSegmentRef,
  removeSegmentRef,
  bindSegmentRefTypeSelect,
  refreshTruthWorkspace,
  addTruthClaimInline,
  addRelationshipInline,
  loadCreatorAnalytics,
  loadQualityReports,
  recordQualityReportSnapshot
};

registerView("creatorWorkspaces", creatorWorkspacesApi);
