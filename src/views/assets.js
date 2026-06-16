/* Auto-split from app.js — assets.js */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const { modal, modalBackdrop } = window.zhimuDom;
  const F = window.zhimuFormat || {};
  const T = window.zhimuToast || {};
  const M = window.zhimuModal || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatBytes = F.formatBytes || (() => "");
  const formatTime = F.formatTime || (() => "");
  const showToast = T.showToast || (() => {});
  const closeModal = M.closeModal || (() => {});
  const ASSET_KIND_TABS = window.zhimuUserMessages?.ASSET_KIND_TABS || [{ id: "", label: "全部" }];
  const assetKindLabel = window.zhimuUserMessages?.assetKindLabel || ((k) => k);
  function refreshAssetsIfVisible() {
    if (state.view === "account" && state.accountHubTab === "assets") window.zhimuRender?.();
  }
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  window.zhimuViews = window.zhimuViews || {};
  const viewExports = window.zhimuViews.assets = window.zhimuViews.assets || {};

function assetsPanelHtml(){
  const usage=state.storageUsage;
  const pct=usage?Math.min(100,Math.round(usage.usedBytes/usage.maxBytes*100)):0;
  const assets=state.cloudAssets||[];
  const total=state.assetTotal||assets.length;
  const kind=state.assetKindFilter||"";
  const q=state.assetSearchQuery||"";
  const recycle=Boolean(state.assetShowRecycle);
  const tabs=ASSET_KIND_TABS.map((tab)=>`<button class="tab ${!recycle&&kind===tab.id?"active":""}" data-action="asset-filter" data-kind="${tab.id}">${escapeHtml(tab.label)}${tab.id===""&&!recycle?` ${total}`:""}</button>`).join("");
  const recycleBtn=`<button class="tab ${recycle?"active":""}" data-action="asset-recycle-toggle">${recycle?"← 返回附件":"🗑 回收站"}</button>`;
  const listTitle=recycle?"回收站（14 天内可恢复）":"云端附件空间";
  const listHint=recycle?"已删除的附件仍占用配额，恢复后重新出现在列表中。":"图片、音频与文档附件，可在剧情编排中关联到场景或线索";
  const rows=assets.length?assets.map((a)=>{
   if(recycle){
    const purge=a.purge_after?` · 将于 ${formatTime(a.purge_after)} 永久删除`:"";
    return `<div class="cloud-asset-row"><div><strong>${escapeHtml(a.original_filename)}</strong><p>${escapeHtml(assetKindLabel(a.asset_kind))} · ${formatBytes(a.byte_size)}${purge}</p></div><div class="row"><button class="primary-btn" data-action="restore-asset" data-asset="${a.id}">恢复</button></div></div>`;
   }
   return `<div class="cloud-asset-row"><div><strong>${escapeHtml(a.original_filename)}</strong><p>${escapeHtml(assetKindLabel(a.asset_kind))} · ${formatBytes(a.byte_size)}</p></div><div class="row"><button class="secondary-btn" data-action="download-asset" data-asset="${a.id}">下载</button><button class="danger-btn" data-action="delete-asset" data-asset="${a.id}">移入回收站</button></div></div>`;
  }).join(""):`<div class="empty-state enriched-empty">${recycle?"回收站为空。":q||kind?"没有匹配的附件。":"<p><strong>当前世界还没有上传附件</strong></p><p>附件会存储在 Cloudflare R2，可在剧情编排中关联到场景或线索。</p><ul class=\"empty-hints\"><li>支持图片、音频、PDF 等格式</li><li>上传后在编排台节点面板中关联</li><li>删除后进入 14 天回收站，可恢复</li></ul><div class=\"row\"><button class=\"primary-btn\" data-action=\"upload-asset\">↑ 上传首个附件</button><button class=\"secondary-btn\" data-action=\"open-creator-guide\">查看上传说明</button></div>"}</div>`;
  return `<div class="asset-toolbar"><div class="search-box"><span>⌕</span><input id="asset-search-input" placeholder="搜索文件名…" value="${escapeHtml(q)}"></div><div class="row"><button class="secondary-btn" data-action="upload-asset" ${recycle?"disabled":""}>↑ 上传云端附件</button></div></div>
  <article class="card" style="margin-bottom:14px"><div class="section-head"><div><h3>${listTitle}</h3><p>${listHint}</p></div><span class="cloud-pill">R2 · PRIVATE</span></div>${!recycle?`<div class="usage-bar"><i style="width:${pct}%"></i></div><div class="status-meta"><span>${usage?formatBytes(usage.usedBytes):"读取中"} / ${usage?formatBytes(usage.maxBytes):"500 MB"}</span><span>${pct}%</span></div>`:""}<div class="cloud-asset-list">${rows}</div></article>
  <div class="tabs">${tabs}${recycleBtn}</div>`;
}

function bindAssetsPanel(root=document){
 const input=root.querySelector("#asset-search-input");
 if(!input||input.dataset.bound)return;
 input.dataset.bound="1";
 let timer=null;
 input.addEventListener("input",()=>{
  clearTimeout(timer);
  timer=setTimeout(async()=>{
   state.assetSearchQuery=input.value.trim();
   await reloadAssets();
   refreshAssetsIfVisible();
  },300);
 });
}

function bindAssetSearch(){
 bindAssetsPanel(document);
}

async function reloadAssets(){
 try{
  const params={};
  if(state.assetKindFilter)params.kind=state.assetKindFilter;
  if(state.assetSearchQuery)params.q=state.assetSearchQuery;
  if(state.assetShowRecycle)params.recycled=true;
  const result=await zhimuApi.getAssets(params);
  if(Array.isArray(result)){
   state.cloudAssets=result;
   state.assetTotal=result.length;
  }else{
   state.cloudAssets=result.assets||[];
   state.assetTotal=result.total??state.cloudAssets.length;
  }
 }catch(error){showToast(error.message)}
}

async function setAssetFilter(kind){
 state.assetShowRecycle=false;
 state.assetKindFilter=kind||"";
 await reloadAssets();
 refreshAssetsIfVisible();
}

async function toggleAssetRecycle(){
 state.assetShowRecycle=!state.assetShowRecycle;
 await reloadAssets();
 refreshAssetsIfVisible();
}

async function restoreCloudAsset(assetId){
 try{
  await zhimuApi.restoreAsset(assetId);
  await reloadAssets();
  await loadCloudData();
  refreshAssetsIfVisible();
  showToast("附件已从回收站恢复");
 }catch(error){showToast(error.message)}
}

async function deleteCloudAsset(assetId){try{await zhimuApi.deleteAsset(assetId);await reloadAssets();await loadCloudData();refreshAssetsIfVisible();showToast("附件已移入 14 天回收站")}catch(error){showToast(error.message)}}

async function downloadCloudAsset(assetId){
 try{
  const ticket=await zhimuApi.getAssetDownloadUrl(assetId);
  const asset=(state.cloudAssets||[]).find((row)=>row.id===assetId);
  const link=document.createElement("a");
  link.href=ticket.downloadUrl;
  link.target="_blank";
  link.rel="noopener noreferrer";
  if(asset?.original_filename)link.download=asset.original_filename;
  link.click();
  showToast("已打开短期下载链接");
 }catch(error){showToast(error.message)}
}

function openAssetUpload(){
 modal.className="modal";modal.innerHTML=`<h2>上传云端附件</h2><p>文件将直接上传至 Cloudflare R2 私有 Bucket。浏览器只会获得短期上传地址，不会接触永久密钥。</p><div class="upload-zone"><strong>选择线索图片、音频、PDF 或 Word 文档</strong><p>图片 ≤ 10 MB，音频 ≤ 30 MB，文档 ≤ 20 MB</p><input type="file" id="cloud-file-input" accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/ogg,audio/wav,application/pdf,.docx"></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" id="cloud-upload-confirm">开始上传</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("#cloud-upload-confirm").onclick=uploadSelectedAsset;
}

async function uploadSelectedAsset(){
 const input=modal.querySelector("#cloud-file-input");const file=input.files[0];if(!file)return showToast("请先选择文件");
 const button=modal.querySelector("#cloud-upload-confirm");button.disabled=true;button.textContent="上传中...";
 try{await zhimuApi.uploadAsset(file);closeModal();await reloadAssets();refreshAssetsIfVisible();showToast("附件已安全上传到云端")}catch(error){button.disabled=false;button.textContent="重新上传";showToast(error.message)}
}

  viewExports.assetsPanelHtml = assetsPanelHtml;
  viewExports.bindAssetSearch = bindAssetSearch;
  viewExports.bindAssetsPanel = bindAssetsPanel;
  viewExports.reloadAssets = reloadAssets;
  viewExports.setAssetFilter = setAssetFilter;
  viewExports.toggleAssetRecycle = toggleAssetRecycle;
  viewExports.restoreCloudAsset = restoreCloudAsset;
  viewExports.deleteCloudAsset = deleteCloudAsset;
  viewExports.downloadCloudAsset = downloadCloudAsset;
  viewExports.openAssetUpload = openAssetUpload;
  viewExports.uploadSelectedAsset = uploadSelectedAsset;
})(window);
export {};
