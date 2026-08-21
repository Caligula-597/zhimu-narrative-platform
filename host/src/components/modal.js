import { escapeHtml } from "../../../shared/security.js";
import { setHtml } from "../../../shared/safe-dom.js";
import { createModalFocusController } from "../../../shared/modal-focus.js";

export const modalEl = { root: null, backdrop: null };
let modalFocus = null;

export function mountModal() {
  if (modalEl.root) return;
  modalEl.backdrop = document.createElement("div");
  modalEl.backdrop.className = "modal-backdrop host-utility-modal";
  modalEl.root = document.createElement("div");
  modalEl.root.className = "modal";
  modalEl.root.setAttribute("role", "dialog");
  modalEl.root.setAttribute("aria-modal", "true");
  modalEl.root.setAttribute("tabindex", "-1");
  modalEl.backdrop.appendChild(modalEl.root);
  document.body.appendChild(modalEl.backdrop);
  modalFocus = createModalFocusController({
    backdropSelector: ".host-utility-modal.show",
    closeSelector: "[data-close]",
    titleIdPrefix: "host-utility-modal-title",
    onEscape: closeModal
  });
}

export function closeModal() {
  modalEl.backdrop?.classList.remove("show");
  modalFocus?.sync();
  if (modalEl.root) setHtml(modalEl.root, "");
}

export function openModal(title, bodyHtml, closeLabel = "关闭") {
  mountModal();
  modalEl.root.className = "modal";
  setHtml(modalEl.root, `<h2 id="host-utility-modal-title">${escapeHtml(title)}</h2>${bodyHtml}<div class="modal-actions"><button class="secondary-btn" data-close>${escapeHtml(closeLabel)}</button></div>`);
  modalEl.root.setAttribute("aria-labelledby", "host-utility-modal-title");
  modalEl.backdrop.classList.add("show");
  modalFocus?.sync();
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
}

export function studioField(label, key, type = "input", placeholder = "") {
  if (type === "textarea") {
    return `<label>${escapeHtml(label)}<textarea class="field" rows="3" data-studio-field="${escapeHtml(key)}" placeholder="${escapeHtml(placeholder)}"></textarea></label>`;
  }
  return `<label>${escapeHtml(label)}<input class="field" data-studio-field="${escapeHtml(key)}" placeholder="${escapeHtml(placeholder)}"></label>`;
}

export function studioSelect(label, key, options = [], selected = "") {
  return `<label>${escapeHtml(label)}<select class="field" data-studio-field="${escapeHtml(key)}">${studioOptionsHtml(options, selected)}</select></label>`;
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
