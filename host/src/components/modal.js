import { escapeHtml } from "../../../shared/security.js";
import { setHtml } from "../../../shared/safe-dom.js";

export const modalEl = { root: null, backdrop: null };

export function mountModal() {
  if (modalEl.root) return;
  modalEl.backdrop = document.createElement("div");
  modalEl.backdrop.className = "modal-backdrop";
  modalEl.root = document.createElement("div");
  modalEl.root.className = "modal";
  modalEl.backdrop.appendChild(modalEl.root);
  document.body.appendChild(modalEl.backdrop);
}

export function closeModal() {
  modalEl.backdrop?.classList.remove("show");
  if (modalEl.root) setHtml(modalEl.root, "");
}

export function openModal(title, bodyHtml, closeLabel = "关闭") {
  mountModal();
  modalEl.root.className = "modal";
  setHtml(modalEl.root, `<h2>${escapeHtml(title)}</h2>${bodyHtml}<div class="modal-actions"><button class="secondary-btn" data-close>${escapeHtml(closeLabel)}</button></div>`);
  modalEl.backdrop.classList.add("show");
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
}

export function studioField(label, key, type = "input", placeholder = "") {
  if (type === "textarea") {
    return `<label>${escapeHtml(label)}<textarea class="field" rows="3" data-studio-field="${escapeHtml(key)}" placeholder="${escapeHtml(placeholder)}"></textarea></label>`;
  }
  return `<label>${escapeHtml(label)}<input class="field" data-studio-field="${escapeHtml(key)}" placeholder="${escapeHtml(placeholder)}"></label>`;
}

export function studioSelect(label, key, options = []) {
  return `<label>${escapeHtml(label)}<select class="field" data-studio-field="${escapeHtml(key)}">${studioOptionsHtml(options)}</select></label>`;
}

export function studioOptionsHtml(options, selected = "") {
  return options
    .map((opt) => `<option value="${escapeHtml(opt.id)}" ${opt.id === selected ? "selected" : ""}>${escapeHtml(opt.name)}</option>`)
    .join("");
}

export function studioValues() {
  const values = {};
  document.querySelectorAll("[data-studio-field]").forEach((el) => {
    values[el.dataset.studioField] = el.value;
  });
  return values;
}
