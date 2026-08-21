/* Auto-split from app.js — emptyState.js */
import * as zhimuApi from "../api/index.js";
import { content, toast, modal, modalBackdrop } from "../dom.js";
import { go, loadCloudData, render } from "../runtime/runtime-facade.js";
import { showToast } from "./toast.js";
import { userStore, studioStore, worldStore, uiStore } from "../state/index.js";
import { activeRuntimeRoom as workspaceActiveRuntimeRoom, isWorldOwner as workspaceIsWorldOwner } from "../runtime/workspace-store.js";
import * as F from "../utils/format.js";
import * as M from "./modal.js";
import { formatCloudPanelError } from "../utils/user-messages.js";
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
  const closeModal = M.closeModal || (() => {});
  const openModal = M.openModal || (() => {});
  const studioModal = M.studioModal || (() => {});
  const studioField = M.studioField || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioSelect = M.studioSelect || (() => "");
export function activeRuntimeRoom() {
    return workspaceActiveRuntimeRoom();
  }
export function canEditWorldContent(world){
 const role=world?.membership_role;
 return role==="owner"||role==="editor";
}
export function catalogExperienceBanner(world){
 if(!world?.id||canEditWorldContent(world))return "";
 if(world.membership_role==="reviewer")return `<section class="demo-strip catalog-experience-strip"><div><span class="cloud-pill">受邀审稿 · 只读</span><strong style="margin-top:7px">正在查看主创作者的私有审稿材料</strong><p>可以阅读草稿并提交审稿意见，不能修改、主持或导出内容；请遵守团队保密约定。</p></div></section>`;
 if(world.membership_role==="host")return `<section class="demo-strip catalog-experience-strip"><div><span class="cloud-pill">主持协作 · 只读创作内容</span><strong style="margin-top:7px">当前身份用于运行房主持</strong><p>创作正文不可由主持身份修改；请前往独立 Host 端执行场次操作。</p></div></section>`;
 return `<section class="demo-strip catalog-experience-strip"><div><span class="cloud-pill">公开剧本 · 体验</span><strong style="margin-top:7px">正在浏览主创作者发布的完整剧本</strong><p>可阅读角色分幕与剧情编排；运行数据只显示<strong>你自己的运行房</strong>（重复点「开始体验」不会刷出一堆空房间）。改正文需主创作者授权。</p></div></section>`;
}
export function isWorldOwner(worldId) {
 return workspaceIsWorldOwner(worldId);
}
export function deleteWorldPanel(world){
 if(!world?.id||!isWorldOwner(world.id))return "";
 return `<article class="card danger-zone-card"><div class="section-head"><div><h3>删除剧本</h3><p>永久删除「${escapeHtml(world.name)}」及其角色、章节、平行房、规则与附件引用，且<strong>不可恢复</strong>。仅主创作者（owner）可见此操作。</p></div><span class="cloud-pill">危险操作</span></div><button type="button" class="danger-btn full-btn" data-action="world-delete" data-world-id="${world.id}" data-world-name="${escapeHtml(world.name)}">删除当前剧本</button></article>`;
}
export function runtimeEmpty(title,description){
 const world=studioStore.get().cloudStudio?.world;
 return `${cloudStatus()}<article class="card runtime-empty"><p class="eyebrow">RUNTIME REQUIRED</p><h2>${title}尚未连接运行房</h2><p>${description}</p><div class="tutorial-tip"><b>${escapeHtml(world?.name||"当前世界")}</b><span>创作内容仍然保留在云端。建立或选择一个平行房后，这里才会显示该房间自己的玩家状态、章节进度和互动数据。</span></div><button class="primary-btn" data-action="world-rooms">管理平行房</button></article>`;
}

function demoIdentityBanner(){
 return window.zhimuSessionMode?.sessionStripHtml?.() || "";
}
export function cloudStatus(){
 const sessionMode=window.zhimuSessionMode?.getSessionMode?.();
 const apiError=userStore.get().apiError;
 const cloudStudio=studioStore.get().cloudStudio;
 const cloudLoading=studioStore.get().cloudLoading;
 if(sessionMode&&sessionMode!=="authenticated"&&!apiError){
  const sessionStrip=demoIdentityBanner();
  if(sessionMode==="demo_browse"&&!cloudStudio)return sessionStrip;
 }
 const rooms=cloudStudio?.rooms||[];
 const panelMsg=formatCloudPanelError(apiError,{hasStudio:Boolean(cloudStudio)})||apiError||"正在读取云端…";
 const isOutage=apiError&&/无法连接|API_UNAVAILABLE|ECONNREFUSED/i.test(apiError);
 const isEmptyAccount=apiError&&/还没有可访问的(剧本|项目)/.test(apiError);
 const pill=isOutage?"部分运行模块尚未连接":isEmptyAccount?"● 已连接 · 尚无项目":apiError?"部分提示":"● 云端已连接";
 const emptyHint=isEmptyAccount&&!isOutage?"创建或选择一个项目后，对应产品模块才会载入。":"";
 return `${sessionMode!=="authenticated"?demoIdentityBanner():""}<section class="demo-strip cloud-status-strip"><div><span class="cloud-pill ${isOutage?"offline":""}">${pill}</span><strong style="margin-top:7px">${escapeHtml(panelMsg)}</strong><p>${cloudStudio?(rooms.length?`当前世界已建立 ${rooms.length} 个运行房间。`:"当前世界尚未建立测试房，运行状态为空。"):cloudLoading?"正在连接…":emptyHint}</p></div><button class="secondary-btn" data-action="refresh-cloud">刷新云端数据</button></section>`}
export function stat(icon,num,label,sub){return `<article class="stat-card"><div class="stat-icon">${icon}</div><strong>${num}</strong><span>${label} · ${sub}</span></article>`}
export function flow(kicker,title,status,cls){return `<div class="flow-node ${cls}"><small>${kicker}</small><strong>${title}</strong><span>${status}</span></div>`}
export function activity(text,time,type){return `<div class="activity ${type}"><i class="dot"></i><div><p>${text}</p><small>${time}</small></div></div>`}
export function readingRow(initial,name,text,status,cls,color){return `<div class="reading-row"><div class="avatar small" style="background:${color}">${initial}</div><div><strong>${name}</strong><p>${text}</p></div><span class="reading-status ${cls}">${status}</span></div>`}
export function task(icon,title,text,view,action){return `<div class="task-row"><span class="task-icon">${icon}</span><div><strong>${title}</strong><p>${text}</p></div><button data-go="${view}">${action} →</button></div>`}
export function taskAction(icon,title,text,action,label,hubTab=""){const hubAttr=hubTab?` data-hub-tab="${escapeHtml(hubTab)}"`:"";return `<div class="task-row"><span class="task-icon">${icon}</span><div><strong>${title}</strong><p>${text}</p></div><button data-action="${action}"${hubAttr}>${label} →</button></div>`}
export function capability(icon,title,text,view){return `<article class="capability-card"><i>${icon}</i><h3>${title}</h3><p>${text}</p><button ${view==="wizard"?'data-action="open-wizard"':`data-go="${view}"`}>打开功能 →</button></article>`}

export function creatorWorkspaceEmpty({title,kicker,intro,guideTitle,guideItems=[]}){
 const apiError=userStore.get().apiError;
 const cloudLoading=studioStore.get().cloudLoading;
 if(cloudLoading)return `${cloudStatus()}<section class="card creator-empty-loading"><p class="section-kicker">${escapeHtml(kicker||"WORKSPACE")}</p><h3>正在连接云端…</h3><p>已登录时会同时读取项目列表。</p></section>`;
 const noWorld=!zhimuApi.context.worldId;
 const firstRunChooser=noWorld&&uiStore.get().view==="creatorCockpit"?(window.zhimuFirstRun?.renderFirstRunChooser?.()||""):"";
 if(firstRunChooser)return firstRunChooser;
 const panelMsg=formatCloudPanelError(apiError,{hasStudio:false})||apiError||"";
 return `${cloudStatus()}
 <section class="creator-empty-hero card"><p class="section-kicker">${escapeHtml(kicker||"CREATOR WORKSPACE")}</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(intro)}</p>${panelMsg?`<p class="muted-note">${escapeHtml(panelMsg)}</p>`:""}<div class="row creator-empty-actions"><button class="primary-btn" data-action="open-wizard">＋ 创建我的项目</button><button class="secondary-btn" data-action="world-library">我的项目</button></div></section>
 <section class="creator-empty-guide card"><div class="section-head"><div><h3>${escapeHtml(guideTitle||"进入创作前")}</h3><p>${noWorld?"先创建或选择项目后，对应产品工具才会载入数据。":"当前项目数据尚未加载，请刷新或重新选择项目。"}</p></div></div>
 <div class="creator-empty-guide">${guideItems.map(item=>`<article class="creator-guide-block"><span class="asset-type">${escapeHtml(item.label)}</span><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.text)}</p><ul>${(item.bullets||[]).map(b=>`<li>${escapeHtml(b)}</li>`).join("")}</ul></article>`).join("")}</div></section>`;
}
export function check(title,status){return `<div class="check-item"><i>✓</i><div><strong>${title}</strong><p>${status}</p></div></div>`}
