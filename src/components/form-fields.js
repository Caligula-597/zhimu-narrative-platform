import { escapeHtml } from "../utils/format.js";

export function formField(label, key, type = "input", value = "", options = {}) {
  const safeValue = escapeHtml(value ?? "");
  const safeLabel = escapeHtml(label);
  const safeKey = escapeHtml(key);
  const id = `studio-field-${safeKey}`;
  if (type === "textarea") {
    const rows = Math.max(2, Math.min(24, Number(options.rows) || 4));
    return `<label for="${id}">${safeLabel}</label><textarea class="field" id="${id}" name="${safeKey}" data-studio-field="${safeKey}" rows="${rows}">${safeValue}</textarea>`;
  }
  const inputType = options.inputType ? ` type="${escapeHtml(options.inputType)}"` : "";
  const inputMode = options.inputMode ? ` inputmode="${escapeHtml(options.inputMode)}"` : "";
  return `<label for="${id}">${safeLabel}</label><input class="field" id="${id}" name="${safeKey}" data-studio-field="${safeKey}"${inputType}${inputMode} value="${safeValue}">`;
}

export function formValues(root) {
  if (!root) return {};
  return Object.fromEntries(
    Array.from(root.querySelectorAll("[data-studio-field]")).map((input) => [
      input.dataset.studioField,
      typeof input.value === "string" ? input.value.trim() : input.value
    ])
  );
}

export function formSelect(label, key, options, selectedId = "") {
  const safeLabel = escapeHtml(label);
  const safeKey = escapeHtml(key);
  const id = `studio-field-${safeKey}`;
  return `<label for="${id}">${safeLabel}</label><select class="field" id="${id}" name="${safeKey}" data-studio-field="${safeKey}">${formOptionsHtml(options, selectedId)}</select>`;
}

export function formOptionsHtml(options, selectedId = "") {
  const selected = selectedId == null ? "" : String(selectedId);
  return (options || [])
    .map((option) => {
      const id = String(option.id ?? "");
      const name = option.name || option.title || "";
      const sel = id === selected ? " selected" : "";
      return `<option value="${escapeHtml(id)}"${sel}>${escapeHtml(name)}</option>`;
    })
    .join("");
}
