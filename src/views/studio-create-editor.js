import * as zhimuApi from "../api/index.js";
import { formField, formSelect } from "../components/form-fields.js";
import { normalizeError } from "../components/status-ui.js";
import { showToast } from "../components/toast.js";
import {
  bindWorkspaceDraft,
  renderWorkspaceEditor,
  setWorkspaceSaving,
  showWorkspaceErrors,
  workspaceValues
} from "../components/workspace-editor.js";
import { loadCloudData, render } from "../runtime/runtime-facade.js";
import { assetStore, studioStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import { canEditWorldContent } from "../components/emptyState.js";

const RELATION_TYPES = [
  { id: "mainline", name: "主线 · 核心推进路径" },
  { id: "parallel", name: "并列 · 同阶段可同时发生" },
  { id: "extension", name: "延伸 · 支线或后续补充" }
];

const TYPE_META = {
  chapter: { title: "新增公共章节", kicker: "CHAPTER", required: "title", success: "公共章节已写入剧情线" },
  scene: { title: "新增公共场景", kicker: "SCENE", required: "name", success: "公共场景已加入剧情线" },
  clue: { title: "新增剧本杀线索", kicker: "CLUE", required: "name", success: "线索已加入剧情线" },
  item: { title: "新增物品", kicker: "ITEM", required: "name", success: "物品已加入剧情线" },
  point: { title: "新增场景调查点", kicker: "INVESTIGATION", required: "name", success: "调查点已加入公共场景" },
  connection: { title: "创建剧情连线", kicker: "RELATION", required: "target", success: "剧情连线已写入云端" }
};

let createSession = null;

function sessionKey(type, options = {}) {
  const from = options.from ? `${options.from.type}:${options.from.id}` : "";
  const to = options.to ? `${options.to.type}:${options.to.id}` : "";
  return `${type}:${from}:${to}`;
}

function currentData() {
  return studioStore.get().cloudStudio;
}

function worldIdOf(data) {
  return data?.world?.id || zhimuApi.context.worldId || "";
}

function nodeList(data) {
  return [
    ...(data.chapters || []).map((node) => ({ type: "chapter", id: node.id, name: `章节 · ${node.title}` })),
    ...(data.scenes || []).map((node) => ({ type: "scene", id: node.id, name: `场景 · ${node.name}` })),
    ...(data.clues || []).map((node) => ({ type: "clue", id: node.id, name: `线索 · ${node.name}` })),
    ...(data.items || []).map((node) => ({ type: "item", id: node.id, name: `物品 · ${node.name}` })),
    ...(data.investigationPoints || []).map((node) => ({ type: "investigation_point", id: node.id, name: `调查点 · ${node.name}` }))
  ];
}

function findNode(data, reference) {
  if (!reference?.type || !reference?.id) return null;
  return nodeList(data).find((node) => node.type === reference.type && node.id === reference.id) || null;
}

function defaultDraft(type, data, options) {
  if (type === "chapter") return { title: "", summary: "" };
  if (type === "scene") return { chapterId: data.chapters?.[0]?.id || "", name: "", publicText: "", hostText: "" };
  if (type === "clue") return { name: "", publicText: "", hostText: "" };
  if (type === "item") return { name: "", publicText: "", hostText: "", unique: false, consumable: false, assetId: "" };
  if (type === "point") return { sceneId: data.scenes?.[0]?.id || "", name: "", description: "", resultText: "", clueId: "", requiredItemId: "" };
  if (type === "connection") {
    const targets = nodeList(data).filter((node) => !(node.type === options.from?.type && node.id === options.from?.id));
    return { target: options.to ? `${options.to.type}:${options.to.id}` : targets[0] ? `${targets[0].type}:${targets[0].id}` : "", relationType: "mainline", label: "" };
  }
  return {};
}

function activeContext() {
  const data = currentData();
  if (!createSession?.open || !data) return null;
  if (!canEditWorldContent(data.world)) {
    createSession = null;
    return null;
  }
  if (createSession.worldId !== worldIdOf(data)) {
    createSession = null;
    return null;
  }
  if (createSession.type === "point" && !data.scenes?.some((scene) => scene.id === createSession.draft.sceneId)) {
    createSession.error = "原先选择的场景已不存在，请重新选择场景";
    createSession.draft.sceneId = data.scenes?.[0]?.id || "";
  }
  if (createSession.type === "connection") {
    const from = findNode(data, createSession.from);
    const to = createSession.to ? findNode(data, createSession.to) : null;
    if (!from || (createSession.to && !to)) {
      createSession = null;
      return null;
    }
    if (!createSession.to) {
      const [targetType, targetId] = String(createSession.draft.target || "").split(":");
      if (!findNode(data, { type: targetType, id: targetId })) {
        const replacement = nodeList(data).find((node) => !(node.type === createSession.from.type && node.id === createSession.from.id));
        createSession.draft.target = replacement ? `${replacement.type}:${replacement.id}` : "";
        createSession.error = "原先选择的目标节点已不存在，请重新确认连线目标";
      }
    }
  }
  return { data, session: createSession };
}

export function openStudioCreateEditor(type = "menu", options = {}) {
  const data = currentData();
  if (!data) return showToast("请先选择剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份只能查看剧情编排，不能修改节点");
  if (type === "point" && !data.scenes?.length) return showToast("请先创建一个公共场景");
  if (type === "connection") {
    const from = options.from || studioStore.get().studioSelectedNode;
    if (!findNode(data, from)) return showToast("请先选择一个有效节点");
    const targets = nodeList(data).filter((node) => !(node.type === from.type && node.id === from.id));
    if (!targets.length) return showToast("请先创建另一个场景、线索或调查点");
    options = { ...options, from };
  }
  const key = sessionKey(type, options);
  if (createSession?.worldId === worldIdOf(data) && createSession.key === key) {
    createSession.open = true;
    createSession.discardArmed = false;
    render();
    return;
  }
  if (createSession?.worldId === worldIdOf(data) && createSession.dirty) {
    showToast("当前新增草稿尚未处理，请先保存或放弃修改");
    createSession.open = true;
    render();
    return;
  }
  createSession = {
    key,
    worldId: worldIdOf(data),
    type,
    from: options.from || null,
    to: options.to || null,
    open: true,
    dirty: false,
    saving: false,
    discardArmed: false,
    error: "",
    draft: defaultDraft(type, data, options)
  };
  render();
}

function paletteHtml() {
  const types = [
    ["scene", "场景节点", "公开地点、房间或可进入区域"],
    ["clue", "线索节点", "玩家获得后可阅读的证据"],
    ["item", "物品节点", "钥匙、证件与可发放道具"],
    ["point", "调查点节点", "场景内可以点击搜证的位置"],
    ["chapter", "公共章节", "公共剧情阶段与发布单位"]
  ];
  return `<div class="studio-create-palette">${types.map(([type, title, detail]) => `<button type="button" data-action="studio-create-type" data-node-type="${type}"><b>${title}</b><span>${detail}</span></button>`).join("")}</div>`;
}

function fieldBody(context) {
  const { data, session } = context;
  const draft = session.draft;
  if (session.type === "chapter") return formField("章节名称", "title", "input", draft.title) + formField("章节摘要", "summary", "textarea", draft.summary, { rows: 7 });
  if (session.type === "scene") return formSelect("所属章节", "chapterId", [{ id: "", name: "暂不绑定章节" }, ...(data.chapters || [])], draft.chapterId) + formField("场景名称", "name", "input", draft.name) + formField("玩家可见说明", "publicText", "textarea", draft.publicText, { rows: 7 }) + formField("主持人备注", "hostText", "textarea", draft.hostText, { rows: 7 });
  if (session.type === "clue") return formField("线索名称", "name", "input", draft.name) + formField("获得后可见内容", "publicText", "textarea", draft.publicText, { rows: 8 }) + formField("主持人解释", "hostText", "textarea", draft.hostText, { rows: 7 });
  if (session.type === "item") {
    const assets = assetStore.get().cloudAssets || [];
    return formField("物品名称", "name", "input", draft.name)
      + formField("物品描述", "publicText", "textarea", draft.publicText, { rows: 7 })
      + `<label class="studio-check-row"><input type="checkbox" data-editor-checkbox="unique" ${draft.unique ? "checked" : ""}> 是否唯一（同一角色不可重复获得）</label>`
      + `<label class="studio-check-row"><input type="checkbox" data-editor-checkbox="consumable" ${draft.consumable ? "checked" : ""}> 是否可消耗（使用后消失）</label>`
      + (assets.length ? formSelect("关联资产", "assetId", [{ id: "", name: "不关联附件" }, ...assets.map((asset) => ({ id: asset.id, name: asset.original_filename }))], draft.assetId) : "")
      + formField("主持备注", "hostText", "textarea", draft.hostText, { rows: 6 });
  }
  if (session.type === "point") return formSelect("所属场景", "sceneId", data.scenes || [], draft.sceneId) + formField("调查点名称", "name", "input", draft.name) + formField("玩家看到的描述", "description", "textarea", draft.description, { rows: 6 }) + formField("调查结果", "resultText", "textarea", draft.resultText, { rows: 7 }) + formSelect("发现线索", "clueId", [{ id: "", name: "不发放线索" }, ...(data.clues || [])], draft.clueId) + formSelect("需要物品", "requiredItemId", [{ id: "", name: "不需要物品" }, ...(data.items || [])], draft.requiredItemId);
  if (session.type === "connection") {
    const from = findNode(data, session.from);
    const to = session.to ? findNode(data, session.to) : null;
    const targets = nodeList(data).filter((node) => !(node.type === session.from.type && node.id === session.from.id));
    const route = `<div class="workspace-editor-route"><strong>${escapeHtml(from?.name || "起点失效")}</strong><span>→</span><strong>${escapeHtml(to?.name || "选择目标节点")}</strong></div>`;
    return route + (to ? "" : formSelect("目标节点", "target", targets.map((node) => ({ id: `${node.type}:${node.id}`, name: node.name })), draft.target)) + formSelect("关系类型", "relationType", RELATION_TYPES, draft.relationType) + formField("连线备注", "label", "input", draft.label);
  }
  return "";
}

export function studioCreateEditorHtml() {
  const context = activeContext();
  if (!context) return "";
  const { session } = context;
  const menu = session.type === "menu";
  const meta = TYPE_META[session.type] || { title: "新增画布节点", kicker: "NODE" };
  return `<div class="studio-create-editor-shell" data-studio-create-editor>${renderWorkspaceEditor({
    title: menu ? "在画布中新增节点" : meta.title,
    kicker: menu ? "NODE PALETTE" : meta.kicker,
    intro: menu ? "选择节点类型后，编辑器会保留画布上下文并在右侧展开。" : "保存后节点直接进入当前剧情画布；接口失败时草稿不会丢失。",
    body: menu ? paletteHtml() : fieldBody(context),
    submitLabel: session.saving ? "正在写入…" : "写入云端",
    submitAction: menu ? "" : "studio-create-save",
    cancelAction: "studio-create-close",
    cancelLabel: session.discardArmed ? "再次点击放弃草稿" : "取消",
    className: "studio-create-workspace-editor",
    status: session.error ? `<strong>操作未完成</strong><p>${escapeHtml(session.error)}</p>` : ""
  })}</div>`;
}

export function bindStudioCreateEditor() {
  const root = document.querySelector("[data-studio-create-editor]");
  const context = activeContext();
  if (!root || !context || root.dataset.bound) return;
  root.dataset.bound = "1";
  const panel = root.querySelector("[data-workspace-editor]");
  bindWorkspaceDraft(panel, context.session.draft, { checkboxMap: { unique: "unique", consumable: "consumable" } });
  const changed = () => {
    context.session.dirty = true;
    context.session.discardArmed = false;
    context.session.error = "";
    showWorkspaceErrors(panel, []);
  };
  panel?.addEventListener("input", changed);
  panel?.addEventListener("change", changed);
  if (context.session.saving) setWorkspaceSaving(panel, true);
  if (context.session.type !== "menu") queueMicrotask(() => panel?.querySelector("[data-studio-field]")?.focus());
}

export function closeStudioCreateEditor() {
  const context = activeContext();
  if (!context || context.session.saving) return;
  if (context.session.dirty && !context.session.discardArmed) {
    context.session.discardArmed = true;
    render();
    showToast("当前新增草稿尚未保存，再次点击取消将放弃草稿");
    return;
  }
  createSession = null;
  render();
}

function validationErrors(context, values) {
  const { session } = context;
  const meta = TYPE_META[session.type];
  if (meta?.required && !values[meta.required] && !(session.type === "connection" && session.to)) return [{ field: meta.required, message: session.type === "connection" ? "请选择目标节点" : "请填写名称" }];
  if (session.type === "point" && !values.sceneId) return [{ field: "sceneId", message: "请选择所属场景" }];
  return [];
}

async function persistCreate(context, values) {
  const { data, session } = context;
  if (session.type === "chapter") return { type: "chapter", saved: await zhimuApi.createStudioChapter({ ...values, sequence: (data.chapters?.length || 0) + 1 }) };
  if (session.type === "scene") return { type: "scene", saved: await zhimuApi.createScene({ ...values, chapterId: values.chapterId || null }) };
  if (session.type === "clue") return { type: "clue", saved: await zhimuApi.createClue({ ...values, visibility: "role" }) };
  if (session.type === "item") return { type: "item", saved: await zhimuApi.createItem({ name: values.name, publicText: values.publicText, hostText: values.hostText, unique: Boolean(session.draft.unique), consumable: Boolean(session.draft.consumable), assetId: values.assetId || null }) };
  if (session.type === "point") {
    const payload = { ...values };
    const sceneId = payload.sceneId;
    delete payload.sceneId;
    payload.clueId = payload.clueId || null;
    payload.requiredItemId = payload.requiredItemId || null;
    return { type: "investigation_point", saved: await zhimuApi.createInvestigationPoint(sceneId, payload) };
  }
  const target = session.to ? `${session.to.type}:${session.to.id}` : values.target;
  const [toType, toId] = target.split(":");
  return { type: "connection", saved: await zhimuApi.createStoryEdge({ fromType: session.from.type, fromId: session.from.id, toType, toId, relationType: values.relationType, label: values.label }) };
}

export async function saveStudioCreateEditor() {
  const context = activeContext();
  const root = document.querySelector("[data-studio-create-editor]");
  const panel = root?.querySelector("[data-workspace-editor]");
  if (!context || !panel || context.session.saving || context.session.type === "menu") return;
  const values = workspaceValues(panel);
  Object.assign(context.session.draft, values);
  const errors = validationErrors(context, values);
  if (errors.length) {
    showWorkspaceErrors(panel, errors);
    panel.querySelector(`[data-studio-field="${errors[0].field}"]`)?.focus();
    return;
  }
  const activeSession = context.session;
  activeSession.saving = true;
  activeSession.error = "";
  setWorkspaceSaving(panel, true);
  try {
    const result = await persistCreate(context, values);
    if (createSession !== activeSession || zhimuApi.context.worldId !== activeSession.worldId) return;
    createSession = null;
    if (result.type !== "connection" && result.saved?.id) studioStore.set({ studioSelectedNode: { type: result.type, id: result.saved.id } });
    await loadCloudData();
    showToast(TYPE_META[activeSession.type].success);
  } catch (error) {
    if (createSession !== activeSession) return;
    activeSession.saving = false;
    activeSession.error = normalizeError(error, "节点写入失败");
    render();
  }
}
