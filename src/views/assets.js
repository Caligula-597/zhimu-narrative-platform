/* Auto-split from app.js — assets.js */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { modal, modalBackdrop } from "../dom.js";
import { loadCloudData, render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { uiStore, assetStore, studioStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as M from "../components/modal.js";
import * as U from "../components/emptyState.js";
import { normalizeError } from "../components/status-ui.js";
import { ASSET_KIND_TABS, assetKindLabel } from "../utils/user-messages.js";
import { setHtml } from "../../shared/safe-dom.js";
  const canEditWorldContent = U.canEditWorldContent || (() => false);
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatBytes = F.formatBytes || (() => "");
  const formatTime = F.formatTime || (() => "");
  const showError = (error, fallback = "操作失败，请稍后重试") => showToast(normalizeError(error, fallback));
  const closeModal = M.closeModal || (() => {});
function refreshAssetsIfVisible() {
    const ui = uiStore.get();
    if ((ui.view === "account" && ui.accountHubTab === "assets") || ui.view === "settings") render();
  }

export function assetsPanelHtml(){
  const asset = assetStore.get();
  const usage=asset.storageUsage;
  const pct=usage?Math.min(100,Math.round(usage.usedBytes/usage.maxBytes*100)):0;
  const assets=asset.cloudAssets||[];
  const total=asset.assetTotal||assets.length;
  const kind=asset.assetKindFilter||"";
  const q=asset.assetSearchQuery||"";
  const recycle=Boolean(asset.assetShowRecycle);
  const tabs=ASSET_KIND_TABS.map((tab)=>`<button class="tab ${!recycle&&kind===tab.id?"active":""}" data-action="asset-filter" data-kind="${tab.id}">${escapeHtml(tab.label)}${tab.id===""&&!recycle?` ${total}`:""}</button>`).join("");
  const recycleBtn=`<button class="tab ${recycle?"active":""}" data-action="asset-recycle-toggle">${recycle?"← 返回附件":"🗑 回收站"}</button>`;
  const listTitle=recycle?"回收站（14 天内可恢复）":"云端附件空间";
  const listHint=recycle?"已删除的附件仍占用配额，恢复后重新出现在列表中。":"图片、音频与文档附件，可在剧情编排中关联到场景或线索";
  const rows=assets.length?assets.map((a)=>{
   const studio = studioStore.get().cloudStudio;
   const world=studio?.world;
   const coverId=world?.settings?.coverAssetId||"";
   const isCover=Boolean(coverId&&a.id===coverId);
   const canEdit=canEditWorldContent(world);
   if(recycle){
    const purge=a.purge_after?` · 将于 ${formatTime(a.purge_after)} 永久删除`:"";
    return `<div class="cloud-asset-row"><div><strong>${escapeHtml(a.original_filename)}</strong><p>${escapeHtml(assetKindLabel(a.asset_kind))} · ${formatBytes(a.byte_size)}${purge}</p></div><div class="row"><button class="primary-btn" data-action="restore-asset" data-asset="${a.id}">恢复</button></div></div>`;
   }
   const coverBadge=isCover?`<span class="cloud-pill" style="margin-left:8px">封面</span>`:"";
   const coverActions=canEdit&&a.asset_kind==="image"?`${isCover?`<button class="secondary-btn" data-action="clear-world-cover">取消封面</button>`:`<button class="secondary-btn" data-action="set-world-cover" data-asset="${a.id}">设为封面</button>`}`:"";
   return `<div class="cloud-asset-row"><div><strong>${escapeHtml(a.original_filename)}${coverBadge}</strong><p>${escapeHtml(assetKindLabel(a.asset_kind))} · ${formatBytes(a.byte_size)}</p></div><div class="row">${coverActions}<button class="secondary-btn" data-action="download-asset" data-asset="${a.id}">下载</button><button class="danger-btn" data-action="delete-asset" data-asset="${a.id}">移入回收站</button></div></div>`;
  }).join(""):`<div class="empty-state enriched-empty">${recycle?"回收站为空。":q||kind?"没有匹配的附件。":"<p><strong>当前世界还没有上传附件</strong></p><p>附件会存储在 Cloudflare R2，可在剧情编排中关联到场景或线索。</p><ul class=\"empty-hints\"><li>支持图片、音频与 Word（.docx）</li><li>上传后在编排台节点面板中关联</li><li>删除后进入 14 天回收站，可恢复</li></ul><div class=\"row\"><button class=\"primary-btn\" data-action=\"upload-asset\">↑ 上传首个附件</button><button class=\"secondary-btn\" data-action=\"open-creator-guide\">查看上传说明</button></div>"}</div>`;
  return `<div class="asset-toolbar"><div class="search-box"><span>⌕</span><input id="asset-search-input" placeholder="搜索文件名…" value="${escapeHtml(q)}"></div><div class="row"><button class="secondary-btn" data-action="upload-asset" ${recycle?"disabled":""}>↑ 上传云端附件</button></div></div>
  <article class="card" style="margin-bottom:14px"><div class="section-head"><div><h3>${listTitle}</h3><p>${listHint}</p></div><span class="cloud-pill">R2 · PRIVATE</span></div>${!recycle?`<div class="usage-bar"><i style="width:${pct}%"></i></div><div class="status-meta"><span>${usage?formatBytes(usage.usedBytes):"读取中"} / ${usage?formatBytes(usage.maxBytes):"500 MB"}</span><span>${pct}%</span></div>`:""}<div class="cloud-asset-list">${rows}</div></article>
  <div class="tabs">${tabs}${recycleBtn}</div>`;
}

export function bindAssetsPanel(root=document){
 const input=root.querySelector("#asset-search-input");
 if(!input||input.dataset.bound)return;
 input.dataset.bound="1";
 let timer=null;
 input.addEventListener("input",()=>{
  clearTimeout(timer);
  timer=setTimeout(async()=>{
   assetStore.set({ assetSearchQuery: input.value.trim() });
   await reloadAssets();
   refreshAssetsIfVisible();
  },300);
 });
}

export function bindAssetSearch(){
 bindAssetsPanel(document);
}

export async function reloadAssets(){
 try{
  const asset = assetStore.get();
  const params={};
  if(asset.assetKindFilter)params.kind=asset.assetKindFilter;
  if(asset.assetSearchQuery)params.q=asset.assetSearchQuery;
  if(asset.assetShowRecycle)params.recycled=true;
  const result=await zhimuApi.getAssets(params);
  if(Array.isArray(result)){
   assetStore.set({ cloudAssets: result, assetTotal: result.length });
  }else{
   const cloudAssets=result.assets||[];
   assetStore.set({ cloudAssets, assetTotal: result.total??cloudAssets.length });
  }
 }catch(error){showError(error)}
}

export async function setAssetFilter(kind){
 assetStore.set({ assetShowRecycle: false, assetKindFilter: kind||"" });
 await reloadAssets();
 refreshAssetsIfVisible();
}

export async function toggleAssetRecycle(){
 const asset = assetStore.get();
 assetStore.set({ assetShowRecycle: !asset.assetShowRecycle });
 await reloadAssets();
 refreshAssetsIfVisible();
}

export async function restoreCloudAsset(assetId){
 try{
  await zhimuApi.restoreAsset(assetId);
  await reloadAssets();
  await loadCloudData();
  refreshAssetsIfVisible();
  showToast("附件已从回收站恢复");
 }catch(error){showError(error)}
}

export async function setWorldCoverAsset(assetId){
 const worldId=zhimuApi.context.worldId;
 if(!worldId||!assetId)return showToast("请先选择图片附件");
 try{
  const updated=await zhimuApi.patchWorld({settings:{coverAssetId:assetId}},worldId);
  const studio = studioStore.get().cloudStudio;
  if(studio?.world?.id===worldId){
   studioStore.set({ cloudStudio: { ...studio, world: { ...studio.world, settings: updated.settings||{coverAssetId:assetId} } } });
  }
  refreshAssetsIfVisible();
  showToast("封面已更新，公开大厅与剧本库将展示此图");
 }catch(error){showError(error)}
}

export async function clearWorldCover(){
 const worldId=zhimuApi.context.worldId;
 if(!worldId)return;
 try{
  const updated=await zhimuApi.patchWorld({settings:{coverAssetId:""}},worldId);
  const studio = studioStore.get().cloudStudio;
  if(studio?.world?.id===worldId){
   studioStore.set({ cloudStudio: { ...studio, world: { ...studio.world, settings: updated.settings||{} } } });
  }
  refreshAssetsIfVisible();
  showToast("已取消指定封面，将使用默认图片");
 }catch(error){showError(error)}
}

export async function deleteCloudAsset(assetId){try{await zhimuApi.deleteAsset(assetId);await reloadAssets();await loadCloudData();refreshAssetsIfVisible();showToast("附件已移入 14 天回收站")}catch(error){showError(error)}}

export async function downloadCloudAsset(assetId){
 try{
  const ticket=await zhimuApi.getAssetDownloadUrl(assetId);
  const asset=(assetStore.get().cloudAssets||[]).find((row)=>row.id===assetId);
  const link=document.createElement("a");
  link.href=ticket.downloadUrl;
  link.target="_blank";
  link.rel="noopener noreferrer";
  if(asset?.original_filename)link.download=asset.original_filename;
  link.click();
  showToast("已打开短期下载链接");
 }catch(error){showError(error)}
}

export function openAssetUpload(options = {}){
 const coverMode=Boolean(options.setAsCover);
 const title=coverMode?"上传剧本封面":"上传云端附件";
 const desc=coverMode?"上传成功后会自动设为当前剧本封面。":"浏览器只会获得短期上传地址，不会接触永久密钥。";
 const strong=coverMode?"选择一张封面图片":"选择线索图片、音频或 Word 文档";
 const hint=coverMode?"支持 PNG / JPG / WebP，建议横图。":"图片 ≤ 10 MB，音频 ≤ 30 MB，Word ≤ 20 MB";
 const accept=coverMode?"image/png,image/jpeg,image/webp":"image/png,image/jpeg,image/webp,audio/mpeg,audio/ogg,audio/wav,audio/mp4,.docx";
 const cta=coverMode?"上传并设为封面":"开始上传";
 modal.className="modal";
 modal.dataset.setAsCover=coverMode?"1":"";
 setHtml(modal, `<h2>${title}</h2><p>文件将直接上传至 Cloudflare R2 私有 Bucket。${desc}</p><div class="upload-zone"><strong>${strong}</strong><p>${hint}</p><input type="file" id="cloud-file-input" accept="${accept}"></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" id="cloud-upload-confirm">${cta}</button></div>`);
 modalBackdrop.classList.add("show");
 modal.querySelector("[data-close]").onclick=closeModal;
 modal.querySelector("#cloud-upload-confirm").onclick=uploadSelectedAsset;
}

export async function uploadSelectedAsset(){
 const setAsCover=modal.dataset.setAsCover==="1";
 const input=modal.querySelector("#cloud-file-input");const file=input.files[0];if(!file)return showToast("请选择文件");
 if(setAsCover&&!/^image\//.test(file.type||""))return showToast("封面只能选择图片文件");
 const button=modal.querySelector("#cloud-upload-confirm");button.disabled=true;button.textContent=setAsCover?"上传封面中...":"上传中...";
 try{const asset=await zhimuApi.uploadAsset(file);if(setAsCover&&asset?.id)await setWorldCoverAsset(asset.id);closeModal();await reloadAssets();refreshAssetsIfVisible();showToast(setAsCover?"封面已上传并设置":"附件已安全上传到云端")}catch(error){button.disabled=false;button.textContent=setAsCover?"重新上传封面":"重新上传";showError(error)}
}


export const assetsViewApi = { assetsPanelHtml, bindAssetSearch, bindAssetsPanel, reloadAssets, setAssetFilter, toggleAssetRecycle, restoreCloudAsset, setWorldCoverAsset, clearWorldCover, deleteCloudAsset, downloadCloudAsset, openAssetUpload, uploadSelectedAsset };
registerView("assets", assetsViewApi);
