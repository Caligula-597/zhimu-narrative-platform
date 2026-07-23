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
import { studioStore, uiStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import { canEditWorldContent } from "../components/emptyState.js";

let metadataSession = null;

function entityKey(type, entityId = "") {
  return `${type}:${entityId || "new"}`;
}

function roleDraft(role, roleCount) {
  return {
    name: role?.name || "",
    publicProfile: role?.public_profile || "",
    privateProfile: role?.private_profile || "",
    sequence: String(role?.sequence || roleCount + 1)
  };
}

function chapterDraft(chapter) {
  return {
    title: chapter?.title || "",
    summary: chapter?.summary || "",
    publicationStatus: chapter?.publication_status || "draft",
    unlockMode: chapter?.unlock_rules?.mode || "host_confirm"
  };
}

function editorContext() {
  const data = studioStore.get().cloudStudio;
  if (!metadataSession?.open || !data) return null;
  const worldId = data.world?.id || zhimuApi.context.worldId || "";
  if (!worldId || metadataSession.worldId !== worldId) {
    metadataSession = null;
    return null;
  }
  const collection = metadataSession.type === "role" ? data.roles : data.chapters;
  const entity = metadataSession.entityId
    ? collection.find((item) => item.id === metadataSession.entityId)
    : null;
  if (metadataSession.entityId && !entity) {
    metadataSession = null;
    return null;
  }
  return { data, entity, session: metadataSession };
}

function openMetadataEditor(type, entityId = "") {
  const data = studioStore.get().cloudStudio;
  if (!data || !canEditWorldContent(data.world)) {
    showToast("当前身份不能编辑剧本内容");
    return;
  }
  const collection = type === "role" ? data.roles : data.chapters;
  const entity = entityId ? collection.find((item) => item.id === entityId) : null;
  if (entityId && !entity) {
    showToast(type === "role" ? "没有找到要编辑的角色" : "没有找到要编辑的章节");
    return;
  }
  const worldId = data.world?.id || zhimuApi.context.worldId || "";
  const key = entityKey(type, entityId);
  if (metadataSession?.worldId === worldId && metadataSession.key === key) {
    metadataSession.open = true;
    metadataSession.discardArmed = false;
    render();
    return;
  }
  if (metadataSession?.worldId === worldId && metadataSession.dirty) {
    showToast("另一个编辑草稿尚未处理，请先返回原编辑页保存或放弃修改");
    metadataSession.open = true;
    render();
    return;
  }
  metadataSession = {
    key,
    worldId,
    type,
    entityId,
    open: true,
    dirty: false,
    saving: false,
    error: "",
    discardArmed: false,
    deleteArmed: false,
    draft: type === "role" ? roleDraft(entity, data.roles.length) : chapterDraft(entity)
  };
  render();
}

export function openWriterRoleEditor(roleId = "") {
  openMetadataEditor("role", roleId);
}

export function openWriterChapterEditor(chapterId) {
  if (!chapterId) return showToast("没有找到要编辑的章节");
  openMetadataEditor("chapter", chapterId);
}

function roleContextHtml(data, role) {
  const sections = role ? data.sections.filter((item) => item.role_slot_id === role.id) : [];
  const published = sections.filter((item) => item.publication_status === "published").length;
  return `<aside class="writer-metadata-context">
    <p class="section-kicker">ROLE CONTRACT</p>
    <h2>${role ? escapeHtml(role.name) : "新角色席位"}</h2>
    <p>基础信息决定玩家选角时看到的身份，以及进入房间后读取的私人背景。正文仍在角色分幕工作区维护。</p>
    <dl class="writer-metadata-facts"><div><dt>私人分幕</dt><dd>${sections.length}</dd></div><div><dt>已发布</dt><dd>${published}</dd></div><div><dt>席位状态</dt><dd>${role ? "已存在" : "待创建"}</dd></div></dl>
    <div class="writer-metadata-guidance"><strong>可见性边界</strong><p>公开身份用于选角与大厅展示；角色秘密只应发送给获得该角色的玩家。保存前请避免把主持人答案写入公开身份。</p></div>
  </aside>`;
}

function chapterContextHtml(data, chapter) {
  const sections = chapter ? data.sections.filter((item) => item.chapter_id === chapter.id) : [];
  const currentStatus = chapter?.publication_status || "draft";
  return `<aside class="writer-metadata-context">
    <p class="section-kicker">CHAPTER DELIVERY</p>
    <h2>${escapeHtml(chapter?.title || "章节发布设置")}</h2>
    <p>发布阶段决定章节能否进入测试房或正式房；解锁方式决定主持端与自动化规则谁拥有放行权。</p>
    <dl class="writer-metadata-facts"><div><dt>关联私人分幕</dt><dd>${sections.length}</dd></div><div><dt>当前阶段</dt><dd>${escapeHtml(currentStatus)}</dd></div><div><dt>章节序号</dt><dd>${Number(chapter?.sequence) || "—"}</dd></div></dl>
    <div class="writer-metadata-guidance"><strong>上线检查</strong><p>从草稿切到测试中或已发布前，应确认玩家视角、主持人覆盖路径和自动解锁条件都已验收。</p></div>
  </aside>`;
}

function roleEditorHtml(context) {
  const { data, entity: role, session } = context;
  const body = formField("角色名称", "name", "input", session.draft.name)
    + formField("玩家可见的公开身份", "publicProfile", "textarea", session.draft.publicProfile, { rows: 6 })
    + formField("进入游戏后仅该玩家可见的角色秘密", "privateProfile", "textarea", session.draft.privateProfile, { rows: 10 })
    + formField("席位顺序", "sequence", "input", session.draft.sequence, { inputType: "number", inputMode: "numeric" });
  return `<section class="writer-metadata-workspace" data-writer-metadata-workspace>
    <button class="workspace-back-btn" data-action="writer-metadata-close">← 返回角色工作台</button>
    <div class="writer-metadata-grid">
      ${roleContextHtml(data, role)}
      ${renderWorkspaceEditor({
        title: role ? "编辑角色基础信息" : "新增角色",
        kicker: "ROLE PROFILE",
        intro: "维护选角展示、私人身份与席位顺序；草稿在当前页面内保留。",
        body,
        submitLabel: session.saving ? "正在保存…" : role ? "保存角色修改" : "写入云端",
        submitAction: "writer-metadata-save",
        cancelAction: "writer-metadata-close",
        cancelLabel: session.discardArmed ? "再次点击放弃修改" : "取消",
        dangerAction: role ? "writer-metadata-delete-role" : "",
        dangerLabel: session.deleteArmed ? "再次点击永久删除" : "删除角色",
        className: "writer-metadata-editor",
        status: session.error ? `<strong>保存未完成</strong><p>${escapeHtml(session.error)}</p>` : ""
      })}
    </div>
  </section>`;
}

function chapterEditorHtml(context) {
  const { data, entity: chapter, session } = context;
  const body = formField("章节名称", "title", "input", session.draft.title)
    + formField("章节摘要", "summary", "textarea", session.draft.summary, { rows: 8 })
    + formSelect("发布阶段", "publicationStatus", [
      { id: "draft", name: "草稿 · 不对玩家开放" },
      { id: "testing", name: "测试中 · 用于测试房" },
      { id: "published", name: "已发布 · 可进入正式房" }
    ], session.draft.publicationStatus)
    + formSelect("解锁方式", "unlockMode", [
      { id: "host_confirm", name: "主持人确认后开放" },
      { id: "automatic", name: "满足规则后自动开放" },
      { id: "manual", name: "仅手动开放" }
    ], session.draft.unlockMode);
  return `<section class="writer-metadata-workspace" data-writer-metadata-workspace>
    <button class="workspace-back-btn" data-action="writer-metadata-close">← 返回章节列表</button>
    <div class="writer-metadata-grid">
      ${chapterContextHtml(data, chapter)}
      ${renderWorkspaceEditor({
        title: "章节发布控制",
        kicker: "DELIVERY POLICY",
        intro: "把内容阶段和运行时解锁权分开配置，避免草稿误入玩家房间。",
        body,
        submitLabel: session.saving ? "正在保存…" : "保存章节设置",
        submitAction: "writer-metadata-save",
        cancelAction: "writer-metadata-close",
        cancelLabel: session.discardArmed ? "再次点击放弃修改" : "取消",
        className: "writer-metadata-editor",
        status: session.error ? `<strong>保存未完成</strong><p>${escapeHtml(session.error)}</p>` : ""
      })}
    </div>
  </section>`;
}

export function writerMetadataWorkspaceHtml() {
  const context = editorContext();
  if (!context || !canEditWorldContent(context.data.world)) return "";
  return context.session.type === "role" ? roleEditorHtml(context) : chapterEditorHtml(context);
}

export function bindWriterMetadataEditor() {
  const root = document.querySelector("[data-writer-metadata-workspace]");
  const context = editorContext();
  if (!root || !context || root.dataset.bound) return;
  root.dataset.bound = "1";
  const panel = root.querySelector("[data-workspace-editor]");
  bindWorkspaceDraft(panel, context.session.draft);
  panel?.addEventListener("input", () => {
    context.session.dirty = true;
    context.session.discardArmed = false;
    context.session.deleteArmed = false;
    context.session.error = "";
    showWorkspaceErrors(panel, []);
  });
  panel?.addEventListener("change", () => {
    context.session.dirty = true;
    context.session.discardArmed = false;
    context.session.deleteArmed = false;
    context.session.error = "";
    showWorkspaceErrors(panel, []);
  });
  if (context.session.saving) setWorkspaceSaving(panel, true);
  queueMicrotask(() => panel?.querySelector("[data-studio-field]")?.focus());
}

export function closeWriterMetadataEditor() {
  const context = editorContext();
  if (!context) return;
  if (context.session.saving) return;
  if (context.session.dirty && !context.session.discardArmed) {
    context.session.discardArmed = true;
    render();
    showToast("当前修改尚未保存，再次点击取消将放弃这些修改");
    return;
  }
  metadataSession = null;
  render();
}

function validateEditor(context, values) {
  if (context.session.type === "role" && !values.name) return [{ field: "name", message: "请填写角色名称" }];
  if (context.session.type === "chapter" && !values.title) return [{ field: "title", message: "请填写章节名称" }];
  return [];
}

export async function saveWriterMetadataEditor() {
  const context = editorContext();
  const root = document.querySelector("[data-writer-metadata-workspace]");
  const panel = root?.querySelector("[data-workspace-editor]");
  if (!context || !panel || context.session.saving) return;
  const values = workspaceValues(panel);
  Object.assign(context.session.draft, values);
  const errors = validateEditor(context, values);
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
    if (activeSession.type === "role") {
      const payload = {
        name: values.name,
        publicProfile: values.publicProfile,
        privateProfile: values.privateProfile,
        sequence: Math.max(1, Number(values.sequence) || context.data.roles.length + 1)
      };
      const saved = context.entity
        ? await zhimuApi.updateRole(context.entity.id, payload)
        : await zhimuApi.createRole(activeSession.worldId, payload);
      if (metadataSession !== activeSession || zhimuApi.context.worldId !== activeSession.worldId) return;
      uiStore.set({ writerSelectedRoleId: saved?.id || context.entity?.id || uiStore.get().writerSelectedRoleId });
    } else {
      await zhimuApi.updateChapter(context.entity.id, {
        title: values.title,
        summary: values.summary,
        publicationStatus: values.publicationStatus,
        unlockRules: { mode: values.unlockMode }
      });
      if (metadataSession !== activeSession || zhimuApi.context.worldId !== activeSession.worldId) return;
    }
    metadataSession = null;
    await loadCloudData();
    showToast(activeSession.type === "role" ? "角色基础信息已保存" : "章节发布规则已保存");
  } catch (error) {
    if (metadataSession !== activeSession) return;
    activeSession.saving = false;
    activeSession.error = normalizeError(error, activeSession.type === "role" ? "角色保存失败" : "章节保存失败");
    render();
  }
}

export async function deleteWriterRoleEditor() {
  const context = editorContext();
  if (!context?.entity || context.session.type !== "role" || context.session.saving) return;
  if (context.data.roles.length <= 1) return showToast("至少需要保留一个角色席位");
  if (!context.session.deleteArmed) {
    context.session.deleteArmed = true;
    context.session.discardArmed = false;
    render();
    showToast(`将删除角色及其 ${context.data.sections.filter((item) => item.role_slot_id === context.entity.id).length} 段私人分幕，请再次点击确认`);
    return;
  }
  const activeSession = context.session;
  const fallbackRoleId = context.data.roles.find((item) => item.id !== context.entity.id)?.id || null;
  activeSession.saving = true;
  render();
  try {
    await zhimuApi.deleteRole(context.entity.id);
    if (metadataSession !== activeSession || zhimuApi.context.worldId !== activeSession.worldId) return;
    metadataSession = null;
    uiStore.set({ writerSelectedRoleId: fallbackRoleId });
    await loadCloudData();
    showToast("角色及其私人正文已删除");
  } catch (error) {
    if (metadataSession !== activeSession) return;
    activeSession.saving = false;
    activeSession.deleteArmed = false;
    activeSession.error = normalizeError(error, "角色删除失败");
    render();
  }
}
