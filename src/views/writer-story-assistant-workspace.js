import * as zhimuApi from "../api/index.js";
import { canEditWorldContent } from "../components/emptyState.js";
import { normalizeError } from "../components/status-ui.js";
import { showToast } from "../components/toast.js";
import { setWorkspaceSaving } from "../components/workspace-editor.js";
import { go, loadCloudData, render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import {
  normalizeStoryAssistantResult,
  storyAnalysisIsCurrent,
  storySourceFingerprint,
  validateStoryAssistantSource
} from "./writer-story-assistant-model.js";
import { storyAssistantWorkspaceHtml } from "./writer-story-assistant-view.js";
import {
  beginWriterToolSession,
  clearWriterToolSession,
  getWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";
import "./writer-story-assistant-workspace.css";

export { storyAssistantWorkspaceHtml } from "./writer-story-assistant-view.js";

function editableStoryAssistantSession() {
  const data = studioStore.get().cloudStudio;
  const session = getWriterToolSession(data);
  if (!session || session.type !== "story-assistant") return null;
  if (!canEditWorldContent(data?.world)) {
    showToast("当前身份不能向剧情编排写入内容");
    return null;
  }
  return session;
}

export function openStoryAssistantWorkspace() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能使用剧情结构提取");
  const session = beginWriterToolSession("story-assistant", data, {
    draft: { text: "" },
    analysis: null,
    analysisFingerprint: "",
    requestSequence: 0,
    importArmed: false,
    requestId: ""
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
}

export function bindStoryAssistantWorkspace(data, session) {
  const root = document.querySelector('[data-writer-tool="story-assistant"]');
  if (!root || root.dataset.bound || !session || !canEditWorldContent(data?.world)) return;
  root.dataset.bound = "1";
  const source = root.querySelector("[data-story-source]");
  source?.addEventListener("input", () => {
    session.draft.text = source.value;
    session.dirty = Boolean(source.value.trim());
    session.discardArmed = false;
    session.importArmed = false;
    session.requestId = "";
    session.error = "";
    const count = String(source.value.length);
    root.querySelectorAll("[data-story-source-count], [data-story-character-count]").forEach((element) => {
      element.textContent = count;
    });
    const preview = root.querySelector("[data-story-preview]");
    const isCurrent = storyAnalysisIsCurrent(session);
    preview?.classList.toggle("is-stale", Boolean(session.analysis) && !isCurrent);
    const previewState = root.querySelector("[data-story-preview-state]");
    if (previewState && !isCurrent) previewState.textContent = "输入已修改，请重新提取后再写入";
    const submit = root.querySelector('[data-action="writer-story-import"]');
    if (submit) submit.disabled = !isCurrent;
  });
  if (session.savingAction) setWorkspaceSaving(root.querySelector("[data-workspace-editor]"), true);
}

export async function analyzeStoryAssistantWorkspace() {
  const session = editableStoryAssistantSession();
  if (!session || session.savingAction) return;
  const validation = validateStoryAssistantSource(session.draft.text);
  if (validation.errors.length) return showToast(validation.errors[0]);
  const requestFingerprint = storySourceFingerprint(validation.source);
  const requestSequence = ++session.requestSequence;
  session.savingAction = "analyze";
  session.error = "";
  session.importArmed = false;
  render();
  try {
    const result = await zhimuApi.analyzeStoryDraft(validation.source, { worldId: session.worldId });
    if (
      !writerToolSessionIsCurrent(session)
      || requestSequence !== session.requestSequence
      || requestFingerprint !== storySourceFingerprint(String(session.draft.text || "").trim())
    ) return;
    session.analysis = normalizeStoryAssistantResult(result);
    session.analysisFingerprint = requestFingerprint;
    session.requestId = zhimuApi.createIdempotencyKey();
    showToast(`结构提取完成 · ${session.analysis.nodes.length} 个节点`);
  } catch (error) {
    if (writerToolSessionIsCurrent(session) && requestSequence === session.requestSequence) {
      session.error = normalizeError(error, "剧情结构提取失败");
    }
  } finally {
    if (writerToolSessionIsCurrent(session) && requestSequence === session.requestSequence) {
      session.savingAction = "";
      render();
    }
  }
}

export async function importStoryAssistantWorkspace() {
  const session = editableStoryAssistantSession();
  if (!session || session.savingAction || !storyAnalysisIsCurrent(session) || !session.analysis?.nodes?.length) return;
  if (!session.importArmed) {
    session.importArmed = true;
    render();
    showToast("写入会追加节点和连线；请再次点击确认");
    return;
  }
  const validation = validateStoryAssistantSource(session.draft.text);
  if (validation.errors.length) return showToast(validation.errors[0]);
  session.savingAction = "import";
  session.error = "";
  render();
  try {
    const result = await zhimuApi.importStoryDraft(validation.source, {
      worldId: session.worldId,
      idempotencyKey: session.requestId || (session.requestId = zhimuApi.createIdempotencyKey())
    });
    if (!writerToolSessionIsCurrent(session)) return;
    const nodeCount = Array.isArray(result?.nodes) ? result.nodes.length : Number(result?.nodes || 0);
    const edgeCount = Array.isArray(result?.edges) ? result.edges.length : Number(result?.edges || 0);
    clearWriterToolSession(session);
    try {
      await loadCloudData(true, true);
      go("studio");
      showToast(`已追加 ${nodeCount} 个节点和 ${edgeCount} 条连线`);
    } catch {
      render();
      showToast(`节点已经写入，但页面刷新失败；请手动刷新，切勿重复导入`);
    }
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.error = `${normalizeError(error, "写入剧情编排失败")}；若请求中途断开，请先刷新剧情编排确认结果，避免重复导入`;
      session.savingAction = "";
      session.importArmed = false;
      render();
    }
  }
}
