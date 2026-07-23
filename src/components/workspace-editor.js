import { escapeHtml } from "../utils/format.js";
import { formValues } from "./form-fields.js";

export function renderWorkspaceEditor({
  title,
  kicker = "EDITOR",
  intro = "",
  body = "",
  submitLabel = "保存",
  submitAction,
  cancelAction,
  cancelLabel = "取消",
  dangerAction = "",
  dangerLabel = "",
  className = "",
  status = ""
}) {
  const safeClassName = String(className || "").replace(/[^a-zA-Z0-9_-]/g, "");
  return `<aside class="workspace-editor-panel ${safeClassName}" data-workspace-editor aria-label="${escapeHtml(title)}">
    <header class="workspace-editor-head">
      <div>
        <p class="section-kicker">${escapeHtml(kicker)}</p>
        <h2>${escapeHtml(title)}</h2>
        ${intro ? `<p>${escapeHtml(intro)}</p>` : ""}
      </div>
      <button type="button" class="workspace-editor-close" data-action="${escapeHtml(cancelAction)}" aria-label="关闭编辑器">×</button>
    </header>
    <div class="workspace-editor-scroll">
      ${status ? `<div class="workspace-editor-status">${status}</div>` : ""}
      <div class="form-group workspace-editor-form">${body}</div>
      <div class="workspace-editor-errors" data-workspace-editor-errors role="alert"></div>
    </div>
    <footer class="workspace-editor-actions">
      ${dangerAction && dangerLabel ? `<button type="button" class="danger-btn workspace-editor-danger" data-action="${escapeHtml(dangerAction)}">${escapeHtml(dangerLabel)}</button>` : ""}
      <div class="workspace-editor-primary-actions">
        <button type="button" class="secondary-btn" data-action="${escapeHtml(cancelAction)}">${escapeHtml(cancelLabel)}</button>
        ${submitAction ? `<button type="button" class="primary-btn" data-action="${escapeHtml(submitAction)}">${escapeHtml(submitLabel)}</button>` : ""}
      </div>
    </footer>
  </aside>`;
}

export function workspaceValues(root = document.querySelector("[data-workspace-editor]")) {
  return formValues(root);
}

export function bindWorkspaceDraft(root, draft, { checkboxMap = {} } = {}) {
  if (!root || !draft || root.dataset.draftBound) return;
  root.dataset.draftBound = "1";
  const update = (target) => {
    const key = target?.dataset?.studioField;
    if (key) draft[key] = target.value;
    const checkboxKey = checkboxMap[target?.dataset?.editorCheckbox];
    if (checkboxKey) draft[checkboxKey] = Boolean(target.checked);
  };
  root.addEventListener("input", (event) => update(event.target));
  root.addEventListener("change", (event) => update(event.target));
}

export function showWorkspaceErrors(root, errors = []) {
  const box = root?.querySelector("[data-workspace-editor-errors]");
  if (!box) return;
  const messages = errors.map((item) => String(item?.message || item || "").trim()).filter(Boolean);
  box.textContent = messages.join("；");
  box.classList.toggle("show", messages.length > 0);
}

export function setWorkspaceSaving(root, saving) {
  if (!root) return;
  root.setAttribute("aria-busy", saving ? "true" : "false");
  root.querySelectorAll("button, input, textarea, select").forEach((element) => {
    element.disabled = Boolean(saving);
  });
}
