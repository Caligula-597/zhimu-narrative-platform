import * as zhimuApi from "../api/index.js";
import { canEditWorldContent } from "../components/emptyState.js";
import { formField } from "../components/form-fields.js";
import { normalizeError } from "../components/status-ui.js";
import { showToast } from "../components/toast.js";
import {
  renderWorkspaceEditor,
  setWorkspaceSaving,
  showWorkspaceErrors,
  workspaceValues
} from "../components/workspace-editor.js";
import { loadCloudData, render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import { escapeHtml, formatTime } from "../utils/format.js";
import {
  beginWriterToolSession,
  clearWriterToolSession,
  getWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";

const MAX_VERSION_LABEL_LENGTH = 120;
const MAX_VERSIONS_PER_WORLD = 50;

function defaultVersionLabel() {
  return `创作快照 ${new Date().toLocaleString("zh-CN", { hour12: false })}`;
}

function recentVersionsHtml(versions = []) {
  const rows = versions.slice(0, 6);
  if (!rows.length) {
    return `<div class="writer-tool-empty-preview"><strong>尚无历史版本</strong><p>保存后会在这里和创作中心的版本历史中出现。</p></div>`;
  }
  return `<div class="writer-snapshot-history">${rows.map((version) => `
    <article>
      <strong>${escapeHtml(version.label || "未命名版本")}</strong>
      <span>${escapeHtml(formatTime(version.created_at))}</span>
    </article>`).join("")}</div>`;
}

function snapshotContextHtml(data, session) {
  const versions = data?.versions || [];
  return `<aside class="writer-tool-context">
    <p class="section-kicker">CONTENT VERSION</p>
    <h2>保存创作版本</h2>
    <p>在大幅改写或发布前留下可恢复节点。保存动作只创建版本，不会改变当前正文或发布状态。</p>
    <dl class="writer-metadata-facts">
      <div><dt>公共章节</dt><dd>${data?.chapters?.length || 0}</dd></div>
      <div><dt>私人分幕</dt><dd>${data?.sections?.length || 0}</dd></div>
      <div><dt>版本数量</dt><dd>${versions.length}/${MAX_VERSIONS_PER_WORLD}</dd></div>
    </dl>
    <div class="writer-metadata-guidance">
      <strong>当前恢复边界</strong>
      <p>版本恢复覆盖公共章节与角色私人分幕的正文、归属和发布状态；线索、规则、图谱节点及运行房进度不会随此版本回滚。</p>
    </div>
    <div class="writer-snapshot-recent">
      <strong>最近保存</strong>
      ${recentVersionsHtml(versions)}
    </div>
    ${session.dirty ? `<div class="writer-tool-sync-status"><span>名称尚未保存</span></div>` : ""}
  </aside>`;
}

function snapshotEditorHtml(session) {
  const body = `${formField("版本名称", "label", "input", session.draft.label)}
    <small class="writer-snapshot-label-hint">最多 ${MAX_VERSION_LABEL_LENGTH} 个字符。建议写明阶段和目的，例如“第一幕锁稿前”。</small>
    <div class="writer-metadata-guidance">
      <strong>保存后仍可继续创作</strong>
      <p>需要回退时，请在创作中心的“创作版本历史”中选择恢复。恢复属于高风险操作，会继续使用独立确认流程。</p>
    </div>`;
  const status = session.error
    ? `<strong>版本未保存</strong><p>${escapeHtml(session.error)}</p>`
    : "";
  return renderWorkspaceEditor({
    title: "为当前内容命名",
    kicker: "VERSION CHECKPOINT",
    intro: "名称用于作者和协作者识别版本，不会展示给玩家。",
    body,
    submitLabel: session.savingAction ? "正在保存…" : "保存创作版本",
    submitAction: "writer-snapshot-save",
    cancelAction: "writer-tool-close",
    cancelLabel: session.discardArmed ? "再次点击放弃名称" : "返回创作中心",
    className: "writer-snapshot-editor",
    status
  });
}

export function snapshotWorkspaceHtml(data, session) {
  return `<section class="writer-tool-workspace" data-writer-tool-workspace data-writer-tool="snapshot">
    <button type="button" class="workspace-back-btn" data-action="writer-tool-close">← 返回创作中心</button>
    <div class="writer-tool-grid">
      ${snapshotContextHtml(data, session)}
      ${snapshotEditorHtml(session)}
    </div>
  </section>`;
}

export function openSnapshotWorkspace() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能保存创作版本");
  if ((data.versions || []).length >= MAX_VERSIONS_PER_WORLD) {
    return showToast("当前剧本已达到 50 个版本上限，请先清理不再需要的版本");
  }
  const session = beginWriterToolSession("snapshot", data, {
    draft: { label: defaultVersionLabel() }
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
}

export function bindSnapshotWorkspace(data, session) {
  const root = document.querySelector('[data-writer-tool="snapshot"]');
  if (!root || root.dataset.bound || !session || !canEditWorldContent(data?.world)) return;
  root.dataset.bound = "1";
  const input = root.querySelector('[data-studio-field="label"]');
  if (input) {
    input.maxLength = MAX_VERSION_LABEL_LENGTH;
    input.required = true;
    input.addEventListener("input", () => {
      session.draft.label = input.value;
      session.dirty = input.value.trim() !== "";
      session.discardArmed = false;
      session.error = "";
      showWorkspaceErrors(root, []);
    });
  }
  if (session.savingAction) setWorkspaceSaving(root.querySelector("[data-workspace-editor]"), true);
}

function editableSnapshotSession() {
  const data = studioStore.get().cloudStudio;
  const session = getWriterToolSession(data);
  if (!session || session.type !== "snapshot") return null;
  if (!canEditWorldContent(data?.world)) {
    showToast("当前身份不能保存创作版本");
    return null;
  }
  return session;
}

export async function saveSnapshotWorkspace() {
  const session = editableSnapshotSession();
  if (!session || session.savingAction) return;
  const root = document.querySelector('[data-writer-tool="snapshot"]');
  const label = String(workspaceValues(root).label || "").trim();
  const errors = [];
  if (!label) errors.push("请填写版本名称");
  if (label.length > MAX_VERSION_LABEL_LENGTH) errors.push(`版本名称不能超过 ${MAX_VERSION_LABEL_LENGTH} 个字符`);
  if (errors.length) {
    showWorkspaceErrors(root, errors);
    return;
  }
  session.draft.label = label;
  session.savingAction = "save";
  session.error = "";
  render();
  try {
    await zhimuApi.createContentVersion({ label });
    if (!writerToolSessionIsCurrent(session)) return;
    clearWriterToolSession(session);
    try {
      await loadCloudData();
      showToast("创作版本已保存");
    } catch {
      render();
      showToast("创作版本已保存，但版本列表刷新失败；重新进入页面即可恢复");
    }
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.savingAction = "";
      session.error = normalizeError(error, "创作版本保存失败");
      render();
    }
  }
}
