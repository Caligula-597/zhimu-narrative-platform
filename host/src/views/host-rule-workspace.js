import { state } from "../state.js";
import { getWorldId } from "../session.js";
import {
  HOST_RULE_LIMITS,
  HOST_RULE_MODES,
  hostRuleWorkspaceContextIsCurrent,
  hostRuleWorkspaceIsPending
} from "../runtime/host-rule-workspace-model.js";
import { escapeHtml } from "../utils/format.js";

function selectOptions(items, selected) {
  return items.map((item) =>
    `<option value="${escapeHtml(item.id)}"${String(item.id) === String(selected) ? " selected" : ""}>${escapeHtml(item.name)}</option>`
  ).join("");
}

function statusHtml(workspace) {
  if (!workspace.message && !workspace.errors.length) return "";
  const tone = workspace.status === "error"
    ? "error"
    : workspace.status === "uncertain"
      ? "warning"
      : workspace.status === "success"
        ? "success"
        : "pending";
  return `<section class="host-rule-workspace-status ${tone}" role="${tone === "error" ? "alert" : "status"}">
    ${workspace.message ? `<p>${escapeHtml(workspace.message)}</p>` : ""}
    ${workspace.errors.length ? `<ul>${workspace.errors.map((item) => `<li>${escapeHtml(item.path ? `${item.path}：${item.message}` : item.message || String(item))}</li>`).join("")}</ul>` : ""}
  </section>`;
}

function confirmationHtml(workspace) {
  if (!workspace.confirm) return "";
  const replacing = workspace.confirm.type === "replace";
  return `<section class="host-rule-workspace-confirm" aria-label="未保存草稿确认">
    <div><p class="section-kicker">UNSAVED DRAFT</p><strong>${replacing ? "放弃当前草稿并打开另一条规则？" : "放弃当前未保存草稿？"}</strong><p>关闭或切换后无法恢复本次未保存修改；已经提交到服务器的规则不会被撤销。</p></div>
    <div class="row">
      <button type="button" class="secondary-btn" data-action="host-rule-confirm-cancel">继续编辑</button>
      <button type="button" class="primary-btn danger-btn" data-action="${replacing ? "host-rule-replace-confirm" : "host-rule-discard-confirm"}">确认放弃</button>
    </div>
  </section>`;
}

function referenceRows(items = []) {
  return items.slice(0, 12).map((item) => {
    const label = item.name || item.title || item.role_name || "未命名";
    return `<button type="button" class="host-rule-reference" data-action="host-rule-copy-reference" data-value="${escapeHtml(item.id)}" title="复制 ID">
      <span>${escapeHtml(label)}</span><code>${escapeHtml(String(item.id || "").slice(0, 8))}…</code>
    </button>`;
  }).join("") || `<p class="muted-note">暂无可引用内容。</p>`;
}

function referenceGroup(title, items) {
  return `<details class="host-rule-reference-group">
    <summary><span>${escapeHtml(title)}</span><b>${items.length}</b></summary>
    <div>${referenceRows(items)}</div>
  </details>`;
}

function referencesHtml() {
  const studio = state.studio || {};
  return `<aside class="host-rule-reference-panel">
    <div><p class="section-kicker">REFERENCE ASSISTANT</p><h3>引用助手</h3><p>点击条目复制完整 ID。保存前服务端会确认这些对象仍属于当前剧本。</p></div>
    ${referenceGroup("角色", studio.roles || [])}
    ${referenceGroup("私人分幕", studio.sections || [])}
    ${referenceGroup("场景", studio.scenes || [])}
    ${referenceGroup("线索", studio.clues || [])}
    ${referenceGroup("物品", studio.items || [])}
    <section class="host-rule-type-help">
      <strong>可用动作</strong>
      <code>unlock_script_section</code>
      <code>unlock_scene</code>
      <code>grant_clue</code>
      <code>grant_item</code>
      <code>timeline_log</code>
    </section>
  </aside>`;
}

function editorHtml(workspace) {
  const draft = workspace.draft;
  const pending = hostRuleWorkspaceIsPending(workspace);
  const locked = pending || workspace.status === "uncertain";
  const rooms = [
    { id: "", name: "世界模板 · 可复用于新房间" },
    ...(state.rooms || []).map((room) => ({ id: room.id, name: room.name }))
  ];
  return `<div class="host-rule-editor">
    <section class="host-rule-editor-meta">
      <label>规则名称
        <input class="field" maxlength="${HOST_RULE_LIMITS.NAME}" data-host-rule-field="name" value="${escapeHtml(draft.name)}" ${locked ? "disabled" : ""}>
      </label>
      <label>绑定范围
        <select class="field" data-host-rule-field="roomId" ${locked ? "disabled" : ""}>${selectOptions(rooms, draft.roomId)}</select>
      </label>
      <label>触发模式
        <select class="field" data-host-rule-field="mode" ${locked ? "disabled" : ""}>${selectOptions(HOST_RULE_MODES, draft.mode)}</select>
      </label>
      <label>优先级
        <input class="field" type="number" min="${HOST_RULE_LIMITS.PRIORITY_MIN}" max="${HOST_RULE_LIMITS.PRIORITY_MAX}" step="1" data-host-rule-field="priority" value="${escapeHtml(draft.priority)}" ${locked ? "disabled" : ""}>
      </label>
      <label class="check-label host-rule-enabled"><input type="checkbox" data-host-rule-field="enabled"${draft.enabled ? " checked" : ""} ${locked ? "disabled" : ""}> 启用规则</label>
    </section>
    <section class="host-rule-json-grid">
      <label><span><b>检测条件 JSON</b><small>对象；支持 all / any / not 组合</small></span>
        <textarea class="field" rows="18" maxlength="${HOST_RULE_LIMITS.JSON_TEXT}" spellcheck="false" data-host-rule-field="conditionsText" ${locked ? "disabled" : ""}>${escapeHtml(draft.conditionsText)}</textarea>
      </label>
      <label><span><b>执行动作 JSON</b><small>数组；最多 ${HOST_RULE_LIMITS.ACTIONS} 个动作</small></span>
        <textarea class="field" rows="18" maxlength="${HOST_RULE_LIMITS.JSON_TEXT}" spellcheck="false" data-host-rule-field="actionsText" ${locked ? "disabled" : ""}>${escapeHtml(draft.actionsText)}</textarea>
      </label>
    </section>
    <footer class="host-rule-editor-actions">
      <div>
        <span class="status-chip ${workspace.dirty ? "testing" : "published"}">${workspace.dirty ? "有未保存修改" : "草稿已同步"}</span>
        ${workspace.validatedFingerprint ? `<span class="status-chip published">当前草稿已检查</span>` : ""}
      </div>
      <div class="row">
        ${workspace.status === "uncertain" ? `<button type="button" class="secondary-btn" data-action="host-rule-reconcile">重新核对</button>` : ""}
        <button type="button" class="secondary-btn" data-action="host-rule-validate-current" ${locked ? "disabled" : ""}>检查当前草稿</button>
        <button type="button" class="primary-btn" data-action="host-rule-save" ${locked ? "disabled" : ""}>${workspace.status === "submitting" ? "正在保存…" : "检查并保存"}</button>
      </div>
    </footer>
  </div>`;
}

export function renderHostRuleWorkspace() {
  const workspace = state.hostRuleWorkspace;
  const worldId = getWorldId();
  if (!workspace || !hostRuleWorkspaceContextIsCurrent(workspace, worldId)) return "";
  const pending = hostRuleWorkspaceIsPending(workspace);
  return `<section class="host-rule-workspace" data-host-rule-workspace aria-labelledby="host-rule-workspace-title">
    <header class="host-rule-workspace-head">
      <div><p class="section-kicker">AUTOMATION WORKSPACE</p><h2 id="host-rule-workspace-title">${workspace.ruleId ? "编辑自动化规则" : "新建自动化规则"}</h2><p>适合主持现场调整轻量规则；复杂流程仍建议在创作者端编排并完成发布影响检查。</p></div>
      <button type="button" class="secondary-btn" data-action="host-rule-workspace-close" ${pending ? "disabled" : ""}>返回规则列表</button>
    </header>
    ${statusHtml(workspace)}
    <div class="host-rule-workspace-grid">${editorHtml(workspace)}${referencesHtml()}</div>
    ${confirmationHtml(workspace)}
  </section>`;
}
