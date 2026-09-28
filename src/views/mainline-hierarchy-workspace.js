import * as zhimuApi from "../api/index.js";
import { canEditWorldContent } from "../components/emptyState.js";
import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import { setWorkspaceSaving } from "../components/workspace-editor.js";
import {
  beginWriterToolSession,
  clearWriterToolSession,
  getWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";
import "./mainline-hierarchy-workspace.css";

const STORAGE_PREFIX = "zhimu-mainline-hierarchy-v1:";

const STAGES = Object.freeze([
  {
    id: "scene-selection",
    label: "地点与场合",
    short: "L1",
    title: "地点与公共场合选择",
    summary: "先确定故事发生在哪里、在什么持续性场合中发生。",
    dependsOn: [],
    required: ["locationName", "occasionName", "sceneCombinations"],
    fields: [
      ["locationName", "地点名称", "例如：北方遗址研究中心", "input"],
      ["locationNature", "地点客观性质", "它是什么性质的地点？只写客观属性。", "textarea"],
      ["occasionName", "持续性场合名称", "例如：年度联合修复会议", "input"],
      ["occasionNature", "持续性场合客观性质", "为什么这个场合会持续存在？", "textarea"],
      ["sceneCombinations", "待展开场景组合", "每行一个“地点 + 场合”的场景组合。", "textarea"]
    ],
    forbidden: "不在本层生成房间、线索、事件、机制或移动关系。"
  },
  {
    id: "location-expansion",
    label: "场景地点",
    short: "L2",
    title: "场景地点展开",
    summary: "只为已选中的场景建立角色房间、特殊多人场所和基础公共地点。",
    dependsOn: ["scene-selection"],
    required: ["characterSpaces", "publicSpaces"],
    fields: [
      ["characterSpaces", "角色房间", "每行：角色｜地点｜一句客观说明。", "textarea"],
      ["sharedSpaces", "特殊多人场所", "没有天然多人场所时可以留空。", "textarea"],
      ["publicSpaces", "基础公共地点", "每行一个地点，建议 4—5 个，不写搜证功能。", "textarea"]
    ],
    forbidden: "不在本层生成剧情事件、线索、解锁条件、玩家移动或机制。"
  },
  {
    id: "story-public-copy",
    label: "公开文面",
    short: "L3",
    title: "故事公开文面",
    summary: "只回答：这个世界里，客观发生了一个什么故事？",
    dependsOn: ["location-expansion"],
    required: ["text"],
    fields: [["text", "公开故事文面", "只写客观故事母题、背景和当前事件，不写角色秘密。", "textarea"]],
    forbidden: "不写机制、线索卡、角色剧本、主持流程或玩家行动。"
  },
  {
    id: "story-full-expansion",
    label: "完整故事",
    short: "L4",
    title: "完整故事展开",
    summary: "以已锁定的公开文面为主干，把同一个故事讲完整。",
    dependsOn: ["story-public-copy"],
    required: ["text"],
    fields: [["text", "作者内部完整故事", "补齐历史因果、地点来源、角色客观交集和当前事件。", "textarea"]],
    forbidden: "不在本层制作玩家私人剧本、线索卡、搜证轮次、机制或主持流程。"
  },
  {
    id: "conflict-source",
    label: "对抗来源",
    short: "L5",
    title: "主要对抗来源决策",
    summary: "根据完整故事判断主要强对抗来自外部、内部还是内外混合。",
    dependsOn: ["story-full-expansion"],
    required: ["mode", "rationale"],
    fields: [
      ["mode", "主要对抗来源", "选择一个模式。", "select", [
        ["EXTERNAL_CONFLICT", "外部对抗"],
        ["INTERNAL_CONFLICT", "内部对抗"],
        ["HYBRID_CONFLICT", "内外混合"]
      ]],
      ["rationale", "判断依据", "用 2—4 句话说明为什么现有故事适合该模式。", "textarea"]
    ],
    forbidden: "不在本层分配角色阵营、秘密、个人任务或具体机制。"
  },
  {
    id: "late-conflict",
    label: "后期对抗",
    short: "L6",
    title: "后期对抗结构决策",
    summary: "决定立场如何形成、结果如何达成、最终如何结算。",
    dependsOn: ["conflict-source"],
    required: ["stance", "outcomes", "settlement"],
    fields: [
      ["stance", "立场形成方式", "选择一种。", "select", [["FIXED", "提前固定"], ["OPEN", "开放形成"], ["SEEDED", "少量倡议者"], ["DYNAMIC", "动态变化"]]],
      ["outcomes", "结果结构与达成条件", "例如：两个互斥结果 + 信息条件 / 世界状态条件。", "textarea"],
      ["advocacy", "结果倡议方式", "无预设、单一倡议者、多人倡议或不平衡倡议。", "textarea"],
      ["settlement", "最终结算结构", "例如：投票、关键物件控制、条件满足或组合结算。", "textarea"]
    ],
    forbidden: "不在本层指定谁支持谁，也不强行制造阵营或背叛。"
  },
  {
    id: "key-content-map",
    label: "重点绑定",
    short: "L7",
    title: "故事重点内容与来源绑定",
    summary: "把完整故事拆成重点、载体、来源地点和解释关系，供后续内容层使用。",
    dependsOn: ["story-full-expansion"],
    required: ["rows"],
    fields: [["rows", "重点内容绑定表", "每行：重点｜类型｜载体｜来源地点｜解释 / 铺垫 / 回收。", "textarea"]],
    forbidden: "绑定地点不等于设计玩家探索；本层不生成搜证流程、交付流程或玩家视角信息差。"
  }
]);

function storageKey(worldId) {
  return `${STORAGE_PREFIX}${worldId}`;
}

function emptyStage() {
  return { status: "UNSET", data: {}, lockedAt: null };
}

function defaultDraft() {
  return {
    version: 1,
    activeStage: STAGES[0].id,
    stages: Object.fromEntries(STAGES.map((stage) => [stage.id, emptyStage()]))
  };
}

function normalizeDraft(candidate) {
  const draft = defaultDraft();
  if (!candidate || typeof candidate !== "object") return draft;
  draft.activeStage = STAGES.some((stage) => stage.id === candidate.activeStage) ? candidate.activeStage : draft.activeStage;
  for (const stage of STAGES) {
    const saved = candidate.stages?.[stage.id];
    if (!saved || typeof saved !== "object") continue;
    draft.stages[stage.id] = {
      status: ["UNSET", "DRAFT", "LOCKED", "HOLD"].includes(saved.status) ? saved.status : "UNSET",
      data: saved.data && typeof saved.data === "object" ? saved.data : {},
      lockedAt: saved.lockedAt || null
    };
  }
  return draft;
}

function loadDraft(worldId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(worldId)) || "null");
    return parsed?.version === 1 ? normalizeDraft(parsed) : defaultDraft();
  } catch {
    return defaultDraft();
  }
}

function saveDraft(session, { clearDirty = false } = {}) {
  if (!session?.worldId) return;
  localStorage.setItem(storageKey(session.worldId), JSON.stringify({ version: 1, ...session.draft }));
  if (clearDirty) session.dirty = false;
}

function draftHasContent(draft) {
  return STAGES.some((stage) => {
    const data = draft?.stages?.[stage.id]?.data || {};
    return Object.values(data).some((value) => String(value || "").trim());
  });
}

function currentSession() {
  const data = studioStore.get().cloudStudio;
  const session = getWriterToolSession(data);
  return session?.type === "mainline-hierarchy" ? session : null;
}

function stageById(id) {
  return STAGES.find((stage) => stage.id === id) || STAGES[0];
}

function hasStageContent(stageState) {
  return Object.values(stageState?.data || {}).some((value) => String(value || "").trim());
}

function stageReady(session, stage) {
  return stage.required.every((field) => {
    const value = session.draft.stages[stage.id]?.data?.[field];
    return field === "rows" ? String(value || "").trim().split("\n").filter(Boolean).length > 0 : String(value || "").trim().length > 0;
  });
}

function dependenciesLocked(session, stage) {
  return stage.dependsOn.every((id) => session.draft.stages[id]?.status === "LOCKED");
}

function statusLabel(status) {
  return ({ UNSET: "未开始", DRAFT: "草稿", LOCKED: "已锁定", HOLD: "待补前置" })[status] || "未开始";
}

function statusTone(status) {
  return ({ UNSET: "neutral", DRAFT: "warning", LOCKED: "success", HOLD: "danger" })[status] || "neutral";
}

function renderField(field, value, editable = true) {
  const [key, label, hint, type, options] = field;
  const disabled = editable ? "" : " disabled";
  if (type === "select") {
    return `<label class="mainline-field"><span>${escapeHtml(label)}</span><select data-mainline-field="${key}"${disabled}><option value="">请选择</option>${options.map(([option, text]) => `<option value="${option}" ${value === option ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select><small>${escapeHtml(hint)}</small></label>`;
  }
  const tag = type === "textarea" ? "textarea" : "input";
  const attrs = type === "textarea" ? `rows="${key === "text" ? 14 : 6}"` : "";
  const control = type === "textarea"
    ? `<textarea data-mainline-field="${key}" ${attrs}${disabled} placeholder="${escapeHtml(hint)}">${escapeHtml(value || "")}</textarea>`
    : `<input data-mainline-field="${key}"${disabled} placeholder="${escapeHtml(hint)}" value="${escapeHtml(value || "")}">`;
  return `<label class="mainline-field"><span>${escapeHtml(label)}</span>${control}${type === "input" && value ? "" : `<small>${escapeHtml(hint)}</small>`}</label>`;
}

function renderStageRail(session) {
  return STAGES.map((stage, index) => {
    const state = session.draft.stages[stage.id];
    const active = session.draft.activeStage === stage.id;
    const blocked = session.status === "loading" || (!dependenciesLocked(session, stage) && state.status !== "LOCKED");
    return `<button type="button" class="mainline-stage-item ${active ? "is-active" : ""} ${blocked ? "is-blocked" : ""}" data-action="mainline-select-stage" data-stage="${stage.id}" ${blocked ? "disabled" : ""}>
      <span class="mainline-stage-index">${index + 1}</span><span class="mainline-stage-copy"><b>${escapeHtml(stage.label)}</b><small>${escapeHtml(stage.short)} · ${escapeHtml(statusLabel(state.status))}</small></span><i class="status-dot status-dot-${statusTone(state.status)}"></i>
    </button>`;
  }).join("");
}

function renderDependencyNote(session, stage) {
  if (!stage.dependsOn.length) return `<div class="mainline-dependency is-ready"><b>入口层</b><span>可以从地点与持续性场合开始。</span></div>`;
  const names = stage.dependsOn.map((id) => stageById(id).label).join("、");
  const ready = dependenciesLocked(session, stage);
  return `<div class="mainline-dependency ${ready ? "is-ready" : "is-blocked"}"><b>${ready ? "前置已满足" : "等待前置"}</b><span>${escapeHtml(names)}${ready ? "已锁定，可以进入本层。" : "需要先锁定后再进入本层。"}</span></div>`;
}

function renderStage(session, stage) {
  const state = session.draft.stages[stage.id];
  const locked = state.status === "LOCKED";
  const blocked = !dependenciesLocked(session, stage);
  const canEdit = session.status !== "loading" && !locked && !blocked;
  const fields = stage.fields.map((field) => renderField(field, state.data[field[0]], canEdit)).join("");
  const action = locked
    ? `<button type="button" class="secondary-btn" data-action="mainline-unlock" ${session.status === "loading" ? "disabled" : ""}>解锁本层</button>`
    : `<button type="button" class="secondary-btn" data-action="mainline-save" ${canEdit ? "" : "disabled"}>保存草稿</button><button type="button" class="primary-btn" data-action="mainline-lock" ${canEdit ? "" : "disabled"}>锁定本层并进入下一层</button>`;
  const remoteNote = session.status === "loading"
    ? "正在读取云端草稿…"
    : session.remoteStatus === "local-only"
      ? "检测到本机草稿，保存后会同步到云端"
      : session.remoteStatus === "error"
        ? "云端暂不可用，当前仍保留本机草稿"
        : session.dirty
          ? "有未保存修改"
          : "已同步到当前项目";
  return `<section class="mainline-stage-panel">
    <div class="mainline-panel-header"><div><p class="section-kicker">${escapeHtml(stage.short)} · MAINLINE LAYER</p><h3>${escapeHtml(stage.title)}</h3><p>${escapeHtml(stage.summary)}</p></div><span class="mainline-status-chip status-chip-${statusTone(state.status)}">${escapeHtml(statusLabel(state.status))}</span></div>
    ${renderDependencyNote(session, stage)}
    <div class="mainline-fields ${stage.id === "story-public-copy" || stage.id === "story-full-expansion" ? "mainline-fields-single" : ""}" ${canEdit ? "" : "data-readonly=true"}>${fields}</div>
    <div class="mainline-boundary"><b>本层边界</b><span>${escapeHtml(stage.forbidden)}</span></div>
    <div class="mainline-panel-actions"><button type="button" class="text-btn" data-action="mainline-back-stage" ${STAGES.findIndex((item) => item.id === stage.id) === 0 || session.status === "loading" ? "disabled" : ""}>上一层</button><span class="mainline-local-note">${remoteNote}</span><div class="row">${action}</div></div>
  </section>`;
}

function progress(session) {
  const locked = STAGES.filter((stage) => session.draft.stages[stage.id]?.status === "LOCKED").length;
  return { locked, total: STAGES.length, percent: Math.round((locked / STAGES.length) * 100) };
}

export function mainlineHierarchyWorkspaceHtml(data, session) {
  if (!session || session.type !== "mainline-hierarchy") return "";
  const stage = stageById(session.draft.activeStage);
  const stats = progress(session);
  return `<div class="workspace-editor-panel mainline-hierarchy-workspace" data-workspace-editor data-writer-tool="mainline-hierarchy">
    <header class="mainline-workspace-header"><div><p class="section-kicker">MAINLINE GENERATION</p><h2>新主线生成层级</h2><p>地点与场合先于故事。每一层只读取已锁定的上游内容，不跨层替作者决定后续答案。</p>${session.status === "loading" ? `<span class="mainline-loading-note">正在从云端加载当前项目草稿…</span>` : session.error ? `<span class="mainline-error-note">${escapeHtml(session.error)}</span>` : ""}</div><button type="button" class="text-btn" data-action="writer-tool-close">返回剧本创作</button></header>
    <div class="mainline-progress"><div><b>主线完成度</b><span>${stats.locked} / ${stats.total} 层已锁定</span></div><div class="mainline-progress-track"><i style="width:${stats.percent}%"></i></div></div>
    <div class="mainline-layout"><aside class="mainline-stage-rail"><div class="mainline-rail-title"><b>生成层级</b><small>按顺序锁定</small></div>${renderStageRail(session)}</aside><main class="mainline-stage-main">${renderStage(session, stage)}</main></div>
  </div>`;
}

function editableSession() {
  const session = currentSession();
  if (!session) return null;
  const data = studioStore.get().cloudStudio;
  if (!canEditWorldContent(data?.world)) {
    showToast("当前身份不能编辑主线层级");
    return null;
  }
  return session;
}

export function openMainlineHierarchyWorkspace() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能编辑主线层级");
  const session = beginWriterToolSession("mainline-hierarchy", data, {
    status: "loading",
    remoteStatus: "loading",
    draft: loadDraft(data.world.id)
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  void hydrateMainlineDraft(session);
}

async function hydrateMainlineDraft(session) {
  try {
    const result = await zhimuApi.getMainlineHierarchyDraft(session.worldId);
    if (!writerToolSessionIsCurrent(session)) return;
    const remoteDraft = normalizeDraft(result?.draft);
    if (draftHasContent(session.draft) && !draftHasContent(remoteDraft)) {
      session.remoteStatus = "local-only";
      session.dirty = true;
    } else {
      session.draft = remoteDraft;
      saveDraft(session);
      session.dirty = false;
      session.remoteStatus = "ready";
    }
    session.status = "ready";
    session.error = "";
    render();
  } catch (error) {
    if (!writerToolSessionIsCurrent(session)) return;
    session.status = "ready";
    session.remoteStatus = "error";
    session.error = String(error?.message || "云端主线草稿加载失败");
    render();
  }
}

export function bindMainlineHierarchyWorkspace(data, session) {
  const root = document.querySelector('[data-writer-tool="mainline-hierarchy"]');
  if (!root || root.dataset.bound || !session || !writerToolSessionIsCurrent(session)) return;
  root.dataset.bound = "1";
  root.addEventListener("input", (event) => {
    const field = event.target.closest("[data-mainline-field]");
    if (!field) return;
    const stage = stageById(session.draft.activeStage);
    session.draft.stages[stage.id].data[field.dataset.mainlineField] = field.value;
    if (session.draft.stages[stage.id].status !== "LOCKED") session.draft.stages[stage.id].status = "DRAFT";
    session.dirty = true;
  });
  root.addEventListener("change", (event) => {
    const field = event.target.closest("[data-mainline-field]");
    if (!field) return;
    const stage = stageById(session.draft.activeStage);
    session.draft.stages[stage.id].data[field.dataset.mainlineField] = field.value;
    if (session.draft.stages[stage.id].status !== "LOCKED") session.draft.stages[stage.id].status = "DRAFT";
    session.dirty = true;
    render();
  });
  if (session.savingAction) setWorkspaceSaving(root, true);
}

export function selectMainlineStage(stageId) {
  const session = editableSession();
  const stage = stageById(stageId);
  if (!session || !stage) return;
  if (!dependenciesLocked(session, stage) && session.draft.stages[stage.id].status !== "LOCKED") {
    showToast("请先锁定前置层级");
    return;
  }
  session.draft.activeStage = stage.id;
  session.dirty = true;
  render();
}

export async function saveMainlineDraft() {
  const session = editableSession();
  if (!session || session.savingAction) return;
  session.savingAction = "save";
  session.error = "";
  saveDraft(session);
  render();
  try {
    const result = await zhimuApi.saveMainlineHierarchyDraft(session.draft, session.worldId);
    if (!writerToolSessionIsCurrent(session)) return;
    if (result?.draft) session.draft = normalizeDraft(result.draft);
    saveDraft(session, { clearDirty: true });
    session.remoteStatus = "ready";
    showToast("主线层级草稿已同步到云端");
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.remoteStatus = "error";
      session.error = String(error?.message || "主线层级草稿保存失败");
    }
  } finally {
    if (writerToolSessionIsCurrent(session)) {
      session.savingAction = "";
      render();
    }
  }
}

export async function lockMainlineStage() {
  const session = editableSession();
  if (!session) return;
  const stage = stageById(session.draft.activeStage);
  const state = session.draft.stages[stage.id];
  if (!dependenciesLocked(session, stage)) return showToast("前置层级尚未锁定");
  if (!stageReady(session, stage)) return showToast("请先补齐本层必填内容");
  state.status = "LOCKED";
  state.lockedAt = new Date().toISOString();
  const index = STAGES.findIndex((item) => item.id === stage.id);
  const next = STAGES[index + 1];
  if (next) session.draft.activeStage = next.id;
  session.dirty = true;
  await saveMainlineDraft();
  if (writerToolSessionIsCurrent(session) && session.remoteStatus === "ready") {
    showToast(next ? `已锁定“${stage.label}”，进入下一层` : "新主线层级已全部锁定");
  }
}

export async function unlockMainlineStage() {
  const session = editableSession();
  if (!session) return;
  const stage = stageById(session.draft.activeStage);
  const index = STAGES.findIndex((item) => item.id === stage.id);
  session.draft.stages[stage.id].status = "DRAFT";
  session.draft.stages[stage.id].lockedAt = null;
  for (const downstream of STAGES.slice(index + 1)) {
    if (session.draft.stages[downstream.id].status === "LOCKED") session.draft.stages[downstream.id].status = "HOLD";
  }
  session.dirty = true;
  await saveMainlineDraft();
  if (writerToolSessionIsCurrent(session) && session.remoteStatus === "ready") showToast("本层已解锁，下游层级需要重新确认");
}

export function backMainlineStage() {
  const session = editableSession();
  if (!session) return;
  const index = STAGES.findIndex((stage) => stage.id === session.draft.activeStage);
  if (index > 0) {
    session.draft.activeStage = STAGES[index - 1].id;
    session.dirty = true;
    render();
  }
}

export function closeMainlineHierarchyWorkspace() {
  const session = currentSession();
  if (!session) return;
  if (session.dirty) {
    saveDraft(session);
    showToast("主线层级草稿已自动保存");
  }
  clearWriterToolSession(session);
  render();
}

