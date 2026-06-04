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
  const showToast = T.showToast || (() => {});
  const closeModal = M.closeModal || (() => {});
  const ASSET_KIND_TABS = window.zhimuUserMessages?.ASSET_KIND_TABS || [{ id: "", label: "全部" }];
  const assetKindLabel = window.zhimuUserMessages?.assetKindLabel || ((k) => k);
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  window.zhimuViews = window.zhimuViews || {};
  const viewExports = window.zhimuViews.assets = window.zhimuViews.assets || {};

function assets(){
  const usage=state.storageUsage;
  const pct=usage?Math.min(100,Math.round(usage.usedBytes/usage.maxBytes*100)):0;
  const assets=state.cloudAssets||[];
  const total=state.assetTotal||assets.length;
  const kind=state.assetKindFilter||"";
  const q=state.assetSearchQuery||"";
  const tabs=ASSET_KIND_TABS.map((tab)=>`<button class="tab ${kind===tab.id?"active":""}" data-action="asset-filter" data-kind="${tab.id}">${escapeHtml(tab.label)}${tab.id===""?` ${total}`:""}</button>`).join("");
  return `<div class="asset-toolbar"><div class="search-box"><span>⌕</span><input id="asset-search-input" placeholder="搜索文件名…" value="${escapeHtml(q)}"></div><div class="row"><button class="secondary-btn" data-action="upload-asset">↑ 上传云端附件</button></div></div>
  <article class="card" style="margin-bottom:14px"><div class="section-head"><div><h3>云端附件空间</h3><p>图片、音频与文档附件，可在剧情编排中关联到场景或线索</p></div><span class="cloud-pill">R2 · PRIVATE</span></div><div class="usage-bar"><i style="width:${pct}%"></i></div><div class="status-meta"><span>${usage?formatBytes(usage.usedBytes):"读取中"} / ${usage?formatBytes(usage.maxBytes):"500 MB"}</span><span>${pct}%</span></div>${assets.length?`<div class="cloud-asset-list">${assets.map((a)=>`<div class="cloud-asset-row"><div><strong>${escapeHtml(a.original_filename)}</strong><p>${escapeHtml(assetKindLabel(a.asset_kind))} · ${formatBytes(a.byte_size)}</p></div><div class="row"><button class="secondary-btn" data-action="download-asset" data-asset="${a.id}">下载</button><button class="danger-btn" data-action="delete-asset" data-asset="${a.id}">移入回收站</button></div></div>`).join("")}</div>`:`<div class="empty-state">${q||kind?"没有匹配的附件。":"当前世界还没有上传附件。你可以上传线索图、音频、角色图或文档。"}</div>`}</article>
  <div class="tabs">${tabs}</div>`;
}

function bindAssetSearch(){
 const input=document.getElementById("asset-search-input");
 if(!input||input.dataset.bound)return;
 input.dataset.bound="1";
 let timer=null;
 input.addEventListener("input",()=>{
  clearTimeout(timer);
  timer=setTimeout(async()=>{
   state.assetSearchQuery=input.value.trim();
   await reloadAssets();
   render();
   bindAssetSearch();
  },300);
 });
}

async function reloadAssets(){
 try{
  const params={};
  if(state.assetKindFilter)params.kind=state.assetKindFilter;
  if(state.assetSearchQuery)params.q=state.assetSearchQuery;
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
 state.assetKindFilter=kind||"";
 await reloadAssets();
 render();
 bindAssetSearch();
}

async function deleteCloudAsset(assetId){try{await zhimuApi.deleteAsset(assetId);await reloadAssets();await loadCloudData();showToast("附件已移入 14 天回收站")}catch(error){showToast(error.message)}}

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
 try{await zhimuApi.uploadAsset(file);closeModal();await reloadAssets();showToast("附件已安全上传到云端")}catch(error){button.disabled=false;button.textContent="重新上传";showToast(error.message)}
}

  viewExports.assets = assets;
  viewExports.bindAssetSearch = bindAssetSearch;
  viewExports.reloadAssets = reloadAssets;
  viewExports.setAssetFilter = setAssetFilter;
  viewExports.deleteCloudAsset = deleteCloudAsset;
  viewExports.downloadCloudAsset = downloadCloudAsset;
  viewExports.openAssetUpload = openAssetUpload;
  viewExports.uploadSelectedAsset = uploadSelectedAsset;
})(window);
export {};
