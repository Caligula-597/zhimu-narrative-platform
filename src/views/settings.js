/* Auto-split from app.js — settings.js */
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
  const closeModal = M.closeModal || (() => {});
  const openModal = M.openModal || (() => {});
  const studioModal = M.studioModal || (() => {});
  const studioField = M.studioField || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioSelect = M.studioSelect || (() => "");
  const go = R.go || (() => {});
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
  window.zhimuViews = window.zhimuViews || {};
  const viewExports = window.zhimuViews.settings = window.zhimuViews.settings || {};
function settings(){
 const world=state.cloudStudio?.world;
 return `<section class="rules-layout"><article class="card"><div class="section-head"><div><h3>基础信息</h3><p>世界的公开信息和运行参数</p></div></div><div class="form-group"><label>世界名称</label><input class="field" value="${escapeHtml(world?.name||"")}" readonly><label>世界简介</label><input class="field" value="${escapeHtml(world?.summary||"")}" readonly><label>默认运行方式</label><select class="field" disabled><option>自动推进为主，主持人确认关键节点</option></select><label>玩家人数</label><input class="field" value="${String(state.cloudStudio?.roles?.length||0)}" readonly><button class="primary-btn" style="margin-top:14px" data-action="unavailable" data-feature="世界设置写入 API">保存设置 · 待接入</button></div></article>
 <aside class="card"><div class="section-head"><div><h3>数据管理</h3><p>以下接口仍在开发队列中</p></div></div><button class="secondary-btn full-btn" data-action="unavailable" data-feature="世界导出 API">导出世界 JSON · 待接入</button><button class="secondary-btn full-btn" data-action="unavailable" data-feature="内容包导入 API">导入内容包 · 待接入</button><button class="secondary-btn full-btn" data-action="unavailable" data-feature="实体卡绑定 API">实体卡绑定接口 · 待接入</button></aside></section>`;
}

  viewExports.settings = settings;
})(window);
