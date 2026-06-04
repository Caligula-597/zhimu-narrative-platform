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
  function closeModal(){modalBackdrop.classList.remove("show");modal.className="modal"}

function openModal(title,text,confirm){
 modal.className="modal";
 modal.innerHTML=`<h2>${title}</h2><p>${text}</p><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-close>${confirm}</button></div>`;
 modalBackdrop.classList.add("show"); modal.querySelectorAll("[data-close]").forEach(b=>b.onclick=closeModal);
}

function studioModal(title,fields,confirm,submit){
 modal.className="modal";modal.innerHTML=`<h2>${title}</h2><div class="form-group">${fields}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-studio-submit>${confirm}</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-studio-submit]").onclick=submit;
}

function studioField(label,key,type="input",value=""){return `<label>${label}</label>${type==="textarea"?`<textarea class="field" data-studio-field="${key}" rows="4">${value}</textarea>`:`<input class="field" data-studio-field="${key}" value="${value}">`}`}

function studioValues(){return Object.fromEntries(Array.from(modal.querySelectorAll("[data-studio-field]")).map(input=>[input.dataset.studioField,input.value.trim()]))}

function studioSelect(label,key,options){return `<label>${label}</label><select class="field" data-studio-field="${key}">${options.map(option=>`<option value="${option.id}">${option.name||option.title}</option>`).join("")}</select>`}
  window.zhimuModal = { closeModal, openModal, studioModal, studioField, studioValues, studioSelect };
})(window);
export {};
