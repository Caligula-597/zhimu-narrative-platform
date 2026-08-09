/* Modal helpers shared by creator views and runtime actions. */
import { modal, modalBackdrop } from "../dom.js";
import { escapeHtml } from "../utils/format.js";
import { setHtml, unwrapHtmlFragment } from "../../shared/safe-dom.js";
import { createModalFocusController } from "../../shared/modal-focus.js";
import { formField, formOptionsHtml, formSelect, formValues } from "./form-fields.js";

let modalScrollY = 0;
const modalFocus = modalBackdrop
  ? createModalFocusController({
      backdropSelector: "#modal-backdrop.show",
      closeSelector: "[data-close]",
      titleIdPrefix: "creator-modal-title",
      onEscape: closeModal
    })
  : null;

function elementCanScrollVertically(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
    return el.scrollHeight > el.clientHeight + 1;
  }
  const oy = getComputedStyle(el).overflowY;
  if (oy !== "auto" && oy !== "scroll" && oy !== "overlay") return false;
  return el.scrollHeight > el.clientHeight + 1;
}

function findModalScrollTarget(from, boundary) {
  let el = from instanceof Element ? from : from?.parentElement;
  while (el) {
    if (elementCanScrollVertically(el)) return el;
    if (el === boundary) break;
    el = el.parentElement;
  }
  return null;
}

function lockPageScroll() {
  if (document.body.classList.contains("modal-scroll-lock")) return;
  modalScrollY = window.scrollY;
  document.documentElement.classList.add("modal-scroll-lock");
  document.body.classList.add("modal-scroll-lock");
  document.body.style.top = `-${modalScrollY}px`;
}

function unlockPageScroll() {
  if (!document.body.classList.contains("modal-scroll-lock")) return;
  document.documentElement.classList.remove("modal-scroll-lock");
  document.body.classList.remove("modal-scroll-lock");
  document.body.style.top = "";
  window.scrollTo(0, modalScrollY);
}

function syncModalScrollLock() {
  if (modalBackdrop.classList.contains("show")) lockPageScroll();
  else unlockPageScroll();
  modalFocus?.sync();
}

if (modalBackdrop) {
  new MutationObserver(syncModalScrollLock).observe(modalBackdrop, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(() => modalFocus?.sync()).observe(modal, { childList: true });
  modalBackdrop.addEventListener("wheel", (event) => {
    if (!modalBackdrop.classList.contains("show")) return;
    const scrollable = findModalScrollTarget(event.target, modalBackdrop);
    if (scrollable) return;
    event.preventDefault();
  }, { passive: false });
}

export function closeModal() {
  modalBackdrop.classList.remove("show");
  modal.className = "modal";
  modal.removeAttribute("aria-label");
  modal.removeAttribute("aria-labelledby");
  unlockPageScroll();
  modalFocus?.sync();
}

export function openModal(title, text, confirm) {
  modal.className = "modal";
  setHtml(modal, `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-close>${escapeHtml(confirm)}</button></div>`);
  modalBackdrop.classList.add("show");
  modal.querySelectorAll("[data-close]").forEach((button) => (button.onclick = closeModal));
}

/** Render audited rich content. Raw strings are rejected at this boundary. */
export function openRichModal(title, bodyFragment, confirm) {
  const bodyHtml = unwrapHtmlFragment(bodyFragment, "modal body");
  modal.className = "modal";
  setHtml(modal, `<h2>${escapeHtml(title)}</h2><div class="modal-copy">${bodyHtml}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-close>${escapeHtml(confirm)}</button></div>`);
  modalBackdrop.classList.add("show");
  modal.querySelectorAll("[data-close]").forEach((button) => (button.onclick = closeModal));
}

export function studioModal(title, fields, confirm, submit) {
  modal.className = "modal";
  setHtml(modal, `<h2>${escapeHtml(title)}</h2><div class="form-group">${fields}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-studio-submit>${escapeHtml(confirm)}</button></div>`);
  modalBackdrop.classList.add("show");
  modal.querySelector("[data-close]").onclick = closeModal;
  modal.querySelector("[data-studio-submit]").onclick = submit;
}

export function studioField(label, key, type = "input", value = "") {
  return formField(label, key, type, value);
}

export function studioValues() {
  return formValues(modal);
}

export function studioSelect(label, key, options, selectedId = "") {
  return formSelect(label, key, options, selectedId);
}

export function studioOptionsHtml(options, selectedId = "") {
  return formOptionsHtml(options, selectedId);
}
