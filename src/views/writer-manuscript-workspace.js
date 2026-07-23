import * as zhimuApi from "../api/index.js";
import { renderWorkspaceEditor, setWorkspaceSaving } from "../components/workspace-editor.js";
import { showToast } from "../components/toast.js";
import { canEditWorldContent } from "../components/emptyState.js";
import { go, loadCloudData, render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import { escapeHtml, formatTime } from "../utils/format.js";
import { normalizeError } from "../components/status-ui.js";
import {
  beginWriterToolSession,
  clearWriterToolSession,
  getWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";
import {
  writerToolContextPanelHtml,
  writerToolGridPageHtml,
  writerToolGuidanceHtml
} from "./writer-tool-layout.js";

function manuscriptDirectionLabel(manuscript = {}) {
  const direction = manuscript.lastSyncDirection || manuscript.last_sync_direction;
  return {
    manual: "手动保存",
    graph_to_manuscript: "剧情编排 → 完整母稿",
    manuscript_to_graph: "完整母稿 → 剧情编排"
  }[direction] || "尚未同步";
}

export function storyManuscriptStatus(manuscript = {}) {
  const updatedAt = manuscript.updatedAt || manuscript.updated_at;
  return `<span>最近同步：${escapeHtml(manuscriptDirectionLabel(manuscript))}</span>${updatedAt ? `<span>${escapeHtml(formatTime(updatedAt))}</span>` : ""}`;
}

function manuscriptContextHtml(session, readOnly) {
  const manuscript = session.manuscript || {};
  const length = String(session.draft?.body || "").length;
  return writerToolContextPanelHtml({
    kicker: "MASTER MANUSCRIPT",
    title: "完整剧情母稿",
    intro: "母稿适合连续阅读和集中修订；剧情编排图适合维护结构。二者的覆盖同步都需要显式确认，避免未保存文本被替换。",
    facts: [
      { label: "当前字数", value: length },
      { label: "权限", value: readOnly ? "只读" : "可编辑" },
      { label: "状态", value: session.dirty ? "有草稿" : "已同步" }
    ],
    bodyHtml: `<div class="writer-tool-sync-status">${storyManuscriptStatus(manuscript)}</div>
    ${readOnly ? writerToolGuidanceHtml({
      title: "只读审阅",
      text: "你可以阅读完整母稿，但不能保存或执行双向覆盖。"
    }) : `<div class="writer-tool-actions">
      <button type="button" class="secondary-btn full-btn" data-action="writer-manuscript-from-graph">${session.replaceArmed ? "再次点击：用编排图覆盖母稿" : "从剧情编排生成母稿"}</button>
      <button type="button" class="secondary-btn full-btn" data-action="writer-manuscript-to-graph">${session.graphImportArmed ? "再次点击：用母稿重建编排图" : "将母稿拆分到剧情编排"}</button>
    </div>
    ${writerToolGuidanceHtml({
      title: "覆盖边界",
      text: "“从编排生成”会替换云端母稿；“拆分到编排”会重建图谱节点与连线。执行前请先保存版本快照。"
    })}`}`
  });
}

function manuscriptEditorHtml(session, readOnly) {
  const body = `<label class="workspace-longform-field"><span>连续母稿正文</span><textarea data-studio-field="body" data-manuscript-body rows="30" placeholder="在这里维护完整剧情母稿，支持 Markdown…" ${readOnly ? "disabled" : ""}>${escapeHtml(session.draft?.body || "")}</textarea><small>输入内容先保留在当前工作区草稿中，只有点击保存才会写入云端。</small></label>`;
  const status = session.status === "loading"
    ? "<strong>正在读取完整母稿…</strong><p>加载完成前不会覆盖当前页面状态。</p>"
    : session.error
      ? `<strong>操作未完成</strong><p>${escapeHtml(session.error)}</p>`
      : "";
  return renderWorkspaceEditor({
    title: readOnly ? "阅读完整母稿" : "编辑完整母稿",
    kicker: "LONGFORM EDITOR",
    intro: "完整母稿与结构图是同一故事的两种编辑视图，保存与覆盖同步相互独立。",
    body,
    submitLabel: session.savingAction === "save" ? "正在保存…" : "保存母稿",
    submitAction: readOnly || session.status !== "ready" ? "" : "writer-manuscript-save",
    cancelAction: "writer-tool-close",
    cancelLabel: session.discardArmed ? "再次点击放弃草稿" : "返回创作中心",
    className: "writer-manuscript-editor",
    status
  });
}

export function manuscriptWorkspaceHtml(data, session) {
  const readOnly = !canEditWorldContent(data?.world);
  return writerToolGridPageHtml({
    type: "manuscript",
    contextHtml: manuscriptContextHtml(session, readOnly),
    contentHtml: manuscriptEditorHtml(session, readOnly)
  });
}

export async function openManuscriptWorkspace() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  const session = beginWriterToolSession("manuscript", data, {
    status: "loading",
    manuscript: {},
    draft: { body: "" },
    replaceArmed: false,
    graphImportArmed: false
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    const manuscript = await zhimuApi.getStoryManuscript();
    if (!writerToolSessionIsCurrent(session)) return;
    session.manuscript = manuscript || {};
    session.draft.body = manuscript?.body || "";
    session.status = "ready";
    session.error = "";
    render();
  } catch (error) {
    if (!writerToolSessionIsCurrent(session)) return;
    session.status = "error";
    session.error = normalizeError(error, "完整母稿加载失败");
    render();
  }
}

export function bindManuscriptWorkspace(data, session) {
  const root = document.querySelector('[data-writer-tool="manuscript"]');
  if (!root || root.dataset.bound || !session || !canEditWorldContent(data?.world)) return;
  root.dataset.bound = "1";
  const textarea = root.querySelector("[data-manuscript-body]");
  textarea?.addEventListener("input", () => {
    session.draft.body = textarea.value;
    session.dirty = true;
    session.discardArmed = false;
    session.replaceArmed = false;
    session.graphImportArmed = false;
    session.error = "";
  });
  if (session.savingAction) setWorkspaceSaving(root.querySelector("[data-workspace-editor]"), true);
}

function editableManuscriptSession() {
  const data = studioStore.get().cloudStudio;
  const session = getWriterToolSession(data);
  if (!session || session.type !== "manuscript") return null;
  if (!canEditWorldContent(data?.world)) {
    showToast("当前身份不能修改完整母稿");
    return null;
  }
  return session;
}

export async function saveManuscriptWorkspace() {
  const session = editableManuscriptSession();
  if (!session || session.savingAction || session.status !== "ready") return;
  session.savingAction = "save";
  session.error = "";
  render();
  try {
    const manuscript = await zhimuApi.saveStoryManuscript(String(session.draft.body || "").trim());
    if (!writerToolSessionIsCurrent(session)) return;
    session.manuscript = manuscript || {};
    session.draft.body = manuscript?.body ?? session.draft.body;
    session.dirty = false;
    session.discardArmed = false;
    showToast("完整剧情母稿已保存");
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) session.error = normalizeError(error, "完整母稿保存失败");
  } finally {
    if (writerToolSessionIsCurrent(session)) {
      session.savingAction = "";
      render();
    }
  }
}

export async function syncManuscriptFromGraphWorkspace() {
  const session = editableManuscriptSession();
  if (!session || session.savingAction || session.status !== "ready") return;
  if (!session.replaceArmed) {
    session.replaceArmed = true;
    session.graphImportArmed = false;
    render();
    showToast("此操作会覆盖云端母稿，再次点击才会执行");
    return;
  }
  session.savingAction = "from-graph";
  session.error = "";
  render();
  try {
    const manuscript = await zhimuApi.syncStoryManuscriptFromGraph();
    if (!writerToolSessionIsCurrent(session)) return;
    session.manuscript = manuscript || {};
    session.draft.body = manuscript?.body || "";
    session.dirty = false;
    session.replaceArmed = false;
    showToast("已从剧情编排生成完整母稿");
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) session.error = normalizeError(error, "从剧情编排生成母稿失败");
  } finally {
    if (writerToolSessionIsCurrent(session)) {
      session.savingAction = "";
      render();
    }
  }
}

export async function syncManuscriptToGraphWorkspace() {
  const session = editableManuscriptSession();
  if (!session || session.savingAction || session.status !== "ready") return;
  if (!session.graphImportArmed) {
    session.graphImportArmed = true;
    session.replaceArmed = false;
    render();
    showToast("此操作会重建剧情编排，再次点击才会执行");
    return;
  }
  session.savingAction = "to-graph";
  session.error = "";
  render();
  try {
    const result = await zhimuApi.syncStoryManuscriptToGraph(String(session.draft.body || "").trim());
    if (!writerToolSessionIsCurrent(session)) return;
    clearWriterToolSession(session);
    await loadCloudData();
    go("studio");
    showToast(`母稿已拆分为 ${result.nodes} 个节点和 ${result.edges} 条连线`);
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.error = normalizeError(error, "母稿拆分到剧情编排失败");
      session.savingAction = "";
      render();
    }
  }
}
