/* Auto-split from app.js — assets.js */
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
  const viewExports = window.zhimuViews.assets = window.zhimuViews.assets || {};
function assets(){
  const usage=state.storageUsage; const pct=usage?Math.min(100,Math.round(usage.usedBytes/usage.maxBytes*100)):0;
  const assets=state.cloudAssets||[];
  return `<div class="asset-toolbar"><div class="search-box disabled-hint" title="Alpha 尚未接入">⌕<input placeholder="搜索线索、角色、场景或标签（Alpha 尚未接入）" disabled></div><div class="row"><button class="secondary-btn" data-action="upload-asset">↑ 上传云端附件</button><button class="secondary-btn" data-action="unavailable" data-feature="内容资产新建 API">＋ 新建内容 · 待接入</button></div></div>
  <article class="card" style="margin-bottom:14px"><div class="section-head"><div><h3>云端附件空间</h3><p>真实连接 Cloudflare R2 私有 Bucket，附件通过短期签名地址上传下载</p></div><span class="cloud-pill">R2 · PRIVATE</span></div><div class="usage-bar"><i style="width:${pct}%"></i></div><div class="status-meta"><span>${usage?formatBytes(usage.usedBytes):"读取中"} / ${usage?formatBytes(usage.maxBytes):"500 MB"}</span><span>${pct}%</span></div>${assets.length?`<div class="cloud-asset-list">${assets.map(a=>`<div class="cloud-asset-row"><div><strong>${escapeHtml(a.original_filename)}</strong><p>${escapeHtml(a.asset_kind)} · ${formatBytes(a.byte_size)} · ${escapeHtml(a.visibility)}</p></div><button class="danger-btn" data-action="delete-asset" data-asset="${a.id}">移入回收站</button></div>`).join("")}</div>`:`<div class="empty-state">当前世界还没有上传资产。你可以上传线索图、音频、角色图或文档。</div>`}</article>
  <div class="tabs"><button class="tab active" disabled>全部 ${assets.length}</button><button class="tab" disabled title="Alpha 尚未接入">线索 · 待接入</button><button class="tab" disabled title="Alpha 尚未接入">角色 · 待接入</button><button class="tab" disabled title="Alpha 尚未接入">场景 · 待接入</button><button class="tab" disabled title="Alpha 尚未接入">事件 · 待接入</button></div>`;
}

async function deleteCloudAsset(assetId){try{await zhimuApi.deleteAsset(assetId);await loadCloudData();showToast("附件已移入 14 天回收站")}catch(error){showToast(error.message)}}

function openAssetUpload(){
 modal.className="modal";modal.innerHTML=`<h2>上传云端附件</h2><p>文件将直接上传至 Cloudflare R2 私有 Bucket。浏览器只会获得短期上传地址，不会接触永久密钥。</p><div class="upload-zone"><strong>选择线索图片、音频、PDF 或 Word 文档</strong><p>图片 ≤ 10 MB，音频 ≤ 30 MB，文档 ≤ 20 MB</p><input type="file" id="cloud-file-input" accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/ogg,audio/wav,application/pdf,.docx"></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" id="cloud-upload-confirm">开始上传</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("#cloud-upload-confirm").onclick=uploadSelectedAsset;
}

async function uploadSelectedAsset(){
 const input=modal.querySelector("#cloud-file-input");const file=input.files[0];if(!file)return showToast("请先选择文件");
 const button=modal.querySelector("#cloud-upload-confirm");button.disabled=true;button.textContent="上传中...";
 try{await zhimuApi.uploadAsset(file);closeModal();await loadCloudData();showToast("附件已安全上传到 R2 云端")}catch(error){button.disabled=false;button.textContent="重新上传";showToast(error.message)}
}
  viewExports.assets = assets;
  viewExports.deleteCloudAsset = deleteCloudAsset;
  viewExports.openAssetUpload = openAssetUpload;
  viewExports.uploadSelectedAsset = uploadSelectedAsset;
})(window);
