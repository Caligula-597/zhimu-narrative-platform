import * as zhimuApi from "../api/index.js";
import { formField, formSelect } from "../components/form-fields.js";
import { showToast } from "../components/toast.js";
import {
  bindWorkspaceDraft,
  renderWorkspaceEditor,
  setWorkspaceSaving,
  showWorkspaceErrors,
  workspaceValues
} from "../components/workspace-editor.js";
import { go, loadCloudData, render } from "../runtime/runtime-facade.js";
import { assetStore, studioStore, uiStore, worldStore } from "../state/index.js";
import * as S from "../components/ui-semantics.js";
import { CLUE_IMPORTANCE_OPTIONS, CLUE_KIND_OPTIONS, CLUE_TYPE_OPTIONS } from "./clues-catalog.js";

const showError = S.showError;
let clueEditorState = null;

function clueDraft(clue = null) {
  const meta = clue?.metadata || {};
  return {
    name: clue?.name || "",
    publicText: clue?.public_text || "",
    hostText: clue?.host_text || "",
    visibility: clue?.visibility || "role",
    grantMode: meta.grantMode || "auto",
    clueType: meta.clueType || "text",
    clueKind: clue?.clue_kind || clue?.clueKind || "general",
    locationId: meta.locationId || meta.location_id || "",
    segmentKey: meta.segmentKey || meta.segment_key || "",
    allowUnbound: meta.allowUnbound === true,
    assetId: meta.assetId || "",
    importance: meta.importance || "normal",
    triggerNote: meta.triggerNote || ""
  };
}

function currentClue() {
  const id = clueEditorState?.clueId;
  return id ? studioStore.get().cloudStudio?.clues?.find((item) => item.id === id) || null : null;
}

export function isClueEditorOpen() {
  return Boolean(clueEditorState);
}

export function openClueInStudio(clueId) {
  uiStore.set({ searchFocus: { view: "studio", type: "clue", id: clueId, nodeType: "clue" } });
  go("studio");
}

export function openCluesEditor(clueId = "") {
  const data = studioStore.get().cloudStudio;
  if (!data) return showToast("请先选择剧本世界");
  const clue = clueId ? data.clues.find((item) => item.id === clueId) : null;
  if (clueId && !clue) return showToast("线索不存在或已被删除");
  clueEditorState = { clueId: clue?.id || "", draft: clueDraft(clue) };
  if (clue?.id) uiStore.set({ cluesSelectedId: clue.id });
  render();
}

export function closeCluesEditor() {
  clueEditorState = null;
  render();
}

export function renderClueEditorPanel() {
  if (!clueEditorState) return "";
  const clue = currentClue();
  const value = clueEditorState.draft;
  const assets = [
    { id: "", name: "不关联附件" },
    ...(assetStore.get().cloudAssets || []).map((asset) => ({ id: asset.id, name: asset.original_filename }))
  ];
  const segments = [
    { id: "", name: "不绑定剧情段" },
    ...(worldStore.get().cloudSegments || []).map((segment) => ({
      id: segment.segmentKey || segment.segment_key || "",
      name: `${segment.segmentKey || segment.segment_key || "未命名"} · ${segment.title || "未命名段落"}`
    }))
  ];
  const mapLocations = studioStore.get().cloudStudio?.world?.settings?.tabletopMapDesign?.locations || [];
  const locations = [
    { id: "", name: "不绑定具体地图地点" },
    ...mapLocations.map((location) => ({
      id: location.id || "",
      name: `${location.name || "未命名地点"}${location.segmentKey ? ` · ${location.segmentKey}` : ""}`
    }))
  ];
  const body =
    formField("线索名称", "name", "input", value.name) +
    formField("获得后可见内容", "publicText", "textarea", value.publicText, { rows: 7 }) +
    formField("主持解释", "hostText", "textarea", value.hostText, { rows: 5 }) +
    formSelect("默认可见性", "visibility", [
      { id: "role", name: "私密 · 仅获得角色可见" },
      { id: "public", name: "房间公开" },
      { id: "host", name: "主持可见" }
    ], value.visibility) +
    formSelect("发放模式", "grantMode", [
      { id: "auto", name: "自动发放" },
      { id: "host_confirm", name: "主持确认后发放" },
      { id: "explore", name: "探索调查获得" }
    ], value.grantMode) +
    `<label class="check-label clue-path-decision"><input type="checkbox" data-editor-checkbox="allowUnbound"${value.allowUnbound ? " checked" : ""}><span>允许游离：这条普通线索刻意不绑定地点、调查点或段落</span></label>` +
    formSelect("归属地图地点", "locationId", locations, value.locationId) +
    formSelect("剧情段定位", "segmentKey", segments, value.segmentKey) +
    formSelect("线索形态", "clueType", CLUE_TYPE_OPTIONS, value.clueType) +
    formSelect("线索类型", "clueKind", CLUE_KIND_OPTIONS, value.clueKind) +
    formSelect("关联资产", "assetId", assets, value.assetId) +
    formSelect("重要程度", "importance", CLUE_IMPORTANCE_OPTIONS, value.importance) +
    formField("触发条件说明", "triggerNote", "textarea", value.triggerNote, { rows: 4 });
  return renderWorkspaceEditor({
    title: clue ? `编辑线索 · ${clue.name}` : "新建线索",
    kicker: "CLUE EDITOR",
    intro: "正文、主持备注与发放条件在同一上下文中编辑，保存后同步刷新线索图谱。",
    body,
    submitLabel: clue ? "保存修改" : "创建线索",
    submitAction: "clue-editor-save",
    cancelAction: "clue-editor-close",
    className: "clue-workspace-editor"
  });
}

export function bindClueEditor() {
  if (!clueEditorState) return;
  const root = document.querySelector(".clue-workspace-editor[data-workspace-editor]");
  bindWorkspaceDraft(root, clueEditorState.draft, {
    checkboxMap: { allowUnbound: "allowUnbound" }
  });
}

export async function saveCluesEditor() {
  if (!clueEditorState) return;
  const root = document.querySelector(".clue-workspace-editor[data-workspace-editor]");
  const values = workspaceValues(root);
  clueEditorState.draft = { ...clueEditorState.draft, ...values };
  if (!values.name) {
    showWorkspaceErrors(root, ["请填写线索名称"]);
    root?.querySelector('[data-studio-field="name"]')?.focus();
    return;
  }
  const clue = currentClue();
  const mapLocations = studioStore.get().cloudStudio?.world?.settings?.tabletopMapDesign?.locations || [];
  const selectedLocation = mapLocations.find((location) => location.id === values.locationId);
  const resolvedSegmentKey = values.segmentKey || selectedLocation?.segmentKey || null;
  const allowUnbound = !values.locationId && !resolvedSegmentKey && clueEditorState.draft.allowUnbound === true;
  setWorkspaceSaving(root, true);
  showWorkspaceErrors(root, []);
  try {
    const payload = {
      name: values.name,
      publicText: values.publicText,
      hostText: values.hostText,
      visibility: values.visibility || "role",
      clueKind: values.clueKind || "general",
      metadata: {
        ...(clue?.metadata || {}),
        clueType: values.clueType || "text",
        assetId: values.assetId || null,
        importance: values.importance || "normal",
        grantMode: values.grantMode || "auto",
        locationId: values.locationId || null,
        segmentKey: resolvedSegmentKey,
        allowUnbound,
        triggerNote: values.triggerNote || ""
      }
    };
    const saved = clue
      ? await zhimuApi.updateClue(clue.id, payload)
      : await zhimuApi.createClue(payload);
    clueEditorState = null;
    if (saved?.id) uiStore.set({ cluesSelectedId: saved.id });
    await loadCloudData();
    render();
    showToast(clue ? "线索已更新" : "线索已创建");
  } catch (error) {
    setWorkspaceSaving(root, false);
    showWorkspaceErrors(root, [error?.message || "线索保存失败"]);
    showError(error);
  }
}
