/* Auto-split from app.js — modal.js */
import * as zhimuApi from "../api/index.js";
import { content, toast, modal, modalBackdrop } from "../dom.js";
import { go, loadCloudData, render } from "../runtime/runtime-facade.js";
import { showToast } from "./toast.js";
(function (window) {
  const F = window.zhimuFormat || {};
  const U = window.zhimuUi || {};
  const M = window.zhimuModal || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatTime = F.formatTime || (() => "");
  const formatBytes = F.formatBytes || (() => "");
  const formatRelativeTime = F.formatRelativeTime || (() => "");
  const roleParts = F.roleParts || (() => ({ name: "", role: "" }));
  const hostOperationLabel = F.hostOperationLabel || ((t, m) => m || t);
  const hostPlayerColor = F.hostPlayerColor || (() => "#666");
  const logActivityType = F.logActivityType || (() => "ok");
  const chapterPublicationLabel = F.chapterPublicationLabel || ((s) => s);
  const chapterFlowClass = F.chapterFlowClass || (() => "");
  const activeRuntimeRoom = U.activeRuntimeRoom || (() => null);
  const cloudStatus = U.cloudStatus || (() => "");
  const runtimeEmpty = U.runtimeEmpty || (() => "");
  const stat = U.stat || (() => "");
  const flow = U.flow || (() => "");
  const activity = U.activity || (() => "");
  const readingRow = U.readingRow || (() => "");
  const task = U.task || (() => "");
  const taskAction = U.taskAction || (() => "");
  const capability = U.capability || (() => "");
  const check = U.check || (() => "");
  const voiceOption = U.voiceOption || (() => "");
  let modalScrollY = 0;

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
  }
  if (modalBackdrop) {
    new MutationObserver(syncModalScrollLock).observe(modalBackdrop, { attributes: true, attributeFilter: ["class"] });
    modalBackdrop.addEventListener("wheel", (event) => {
      if (!modalBackdrop.classList.contains("show")) return;
      const scrollable = findModalScrollTarget(event.target, modalBackdrop);
      if (scrollable) return;
      event.preventDefault();
    }, { passive: false });
  }

  function closeModal() {
    modalBackdrop.classList.remove("show");
    modal.className = "modal";
    unlockPageScroll();
  }

function openModal(title, text, confirm) {
  modal.className = "modal";
  modal.innerHTML = `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-close>${escapeHtml(confirm)}</button></div>`;
  modalBackdrop.classList.add("show");
  modal.querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeModal));
}

function studioModal(title, fields, confirm, submit) {
  modal.className = "modal";
  modal.innerHTML = `<h2>${escapeHtml(title)}</h2><div class="form-group">${fields}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-studio-submit>${escapeHtml(confirm)}</button></div>`;
  modalBackdrop.classList.add("show");
  modal.querySelector("[data-close]").onclick = closeModal;
  modal.querySelector("[data-studio-submit]").onclick = submit;
}

function studioField(label, key, type = "input", value = "") {
  const safeValue = escapeHtml(value ?? "");
  const safeLabel = escapeHtml(label);
  const safeKey = escapeHtml(key);
  const id = `studio-field-${safeKey}`;
  return type === "textarea"
    ? `<label for="${id}">${safeLabel}</label><textarea class="field" id="${id}" name="${safeKey}" data-studio-field="${safeKey}" rows="4">${safeValue}</textarea>`
    : `<label for="${id}">${safeLabel}</label><input class="field" id="${id}" name="${safeKey}" data-studio-field="${safeKey}" value="${safeValue}">`;
}

function studioValues() {
  return Object.fromEntries(Array.from(modal.querySelectorAll("[data-studio-field]")).map((input) => [input.dataset.studioField, input.value.trim()]));
}

function studioSelect(label, key, options, selectedId = "") {
  const safeLabel = escapeHtml(label);
  const safeKey = escapeHtml(key);
  const id = `studio-field-${safeKey}`;
  return `<label for="${id}">${safeLabel}</label><select class="field" id="${id}" name="${safeKey}" data-studio-field="${safeKey}">${studioOptionsHtml(options, selectedId)}</select>`;
}

function studioOptionsHtml(options, selectedId = "") {
  const selected = selectedId == null ? "" : String(selectedId);
  return options
    .map((option) => {
      const id = String(option.id ?? "");
      const name = option.name || option.title || "";
      const sel = id === selected ? " selected" : "";
      return `<option value="${escapeHtml(id)}"${sel}>${escapeHtml(name)}</option>`;
    })
    .join("");
}

  window.zhimuModal = { closeModal, openModal, studioModal, studioField, studioValues, studioSelect, studioOptionsHtml };
})(window);
export {};
