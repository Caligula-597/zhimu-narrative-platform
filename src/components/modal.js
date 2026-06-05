/* Auto-split from app.js — modal.js */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const { content, toast, modal, modalBackdrop } = window.zhimuDom;
  const F = window.zhimuFormat || {};
  const U = window.zhimuUi || {};
  const T = window.zhimuToast || {};
  const M = window.zhimuModal || {};
  const R = window.zhimuRuntime || {};
  const V = window.zhimuViews || {};
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
  const showToast = T.showToast || (() => {});
  const go = window.zhimuGo;
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
  window.zhimuViews = window.zhimuViews || {};

  let modalScrollY = 0;
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
      const scrollable = event.target.closest(".pipeline-layer-editor, .pipeline-ladder, .pipeline-brief-fold[open] .pipeline-brief-grid, .creator-guide-body, .collab-list, .log-list, .note-list");
      if (scrollable && scrollable.scrollHeight > scrollable.clientHeight) return;
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
  return type === "textarea"
    ? `<label>${safeLabel}</label><textarea class="field" data-studio-field="${safeKey}" rows="4">${safeValue}</textarea>`
    : `<label>${safeLabel}</label><input class="field" data-studio-field="${safeKey}" value="${safeValue}">`;
}

function studioValues() {
  return Object.fromEntries(Array.from(modal.querySelectorAll("[data-studio-field]")).map((input) => [input.dataset.studioField, input.value.trim()]));
}

function studioSelect(label, key, options, selectedId = "") {
  const safeLabel = escapeHtml(label);
  const safeKey = escapeHtml(key);
  return `<label>${safeLabel}</label><select class="field" data-studio-field="${safeKey}">${studioOptionsHtml(options, selectedId)}</select>`;
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
