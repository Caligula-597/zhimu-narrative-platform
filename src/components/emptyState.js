/* Auto-split from app.js — emptyState.js */
import * as zhimuApi from "../api/index.js";
import { content, toast, modal, modalBackdrop } from "../dom.js";
import { go, loadCloudData, render } from "../runtime/runtime-facade.js";
import { showToast } from "./toast.js";
import { userStore, studioStore, worldStore, voiceStore } from "../state/index.js";
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
  const closeModal = M.closeModal || (() => {});
  const openModal = M.openModal || (() => {});
  const studioModal = M.studioModal || (() => {});
  const studioField = M.studioField || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioSelect = M.studioSelect || (() => "");
  function activeRuntimeRoom() {
    return window.zhimuWorkspace?.activeRuntimeRoom?.() ?? null;
  }

function canEditWorldContent(world){
 const role=world?.membership_role;
 return role==="owner"||role==="editor";
}

function catalogExperienceBanner(world){
 if(!world?.id||canEditWorldContent(world))return "";
 return `<section class="demo-strip catalog-experience-strip"><div><span class="cloud-pill">公开剧本 · 体验</span><strong style="margin-top:7px">正在浏览主创作者发布的完整剧本</strong><p>可阅读角色分幕与剧情编排；运行数据只显示<strong>你自己的运行房</strong>（重复点「开始体验」不会刷出一堆空房间）。改正文需主创作者授权。</p></div></section>`;
}

function isWorldOwner(worldId) {
 return window.zhimuWorkspace?.isWorldOwner?.(worldId) ?? false;
}

function deleteWorldPanel(world){
 if(!world?.id||!isWorldOwner(world.id))return "";
 return `<article class="card danger-zone-card"><div class="section-head"><div><h3>删除剧本</h3><p>永久删除「${escapeHtml(world.name)}」及其角色、章节、平行房、规则与附件引用，且<strong>不可恢复</strong>。仅主创作者（owner）可见此操作。</p></div><span class="cloud-pill">危险操作</span></div><button type="button" class="danger-btn full-btn" data-action="world-delete" data-world-id="${world.id}" data-world-name="${escapeHtml(world.name)}">删除当前剧本</button></article>`;
}

function runtimeEmpty(title,description){
 const world=studioStore.get().cloudStudio?.world;
 return `${cloudStatus()}<article class="card runtime-empty"><p class="eyebrow">RUNTIME REQUIRED</p><h2>${title}尚未连接运行房</h2><p>${description}</p><div class="tutorial-tip"><b>${escapeHtml(world?.name||"当前世界")}</b><span>创作内容仍然保留在云端。建立或选择一个平行房后，这里才会显示该房间自己的玩家状态、章节进度和互动数据。</span></div><button class="primary-btn" data-action="world-rooms">管理平行房</button></article>`;
}

function demoIdentityBanner(){
 return window.zhimuSessionMode?.sessionStripHtml?.() || "";
}

function cloudStatus(){
 const sessionMode=window.zhimuSessionMode?.getSessionMode?.();
 const apiError=userStore.get().apiError;
 const cloudStudio=studioStore.get().cloudStudio;
 const cloudLoading=studioStore.get().cloudLoading;
 if(sessionMode&&sessionMode!=="authenticated"&&!apiError){
  const sessionStrip=demoIdentityBanner();
  if(sessionMode==="demo_browse"&&!cloudStudio)return sessionStrip;
 }
 const rooms=cloudStudio?.rooms||[];
 const panelMsg=window.zhimuUserMessages?.formatCloudPanelError?.(apiError,{hasStudio:Boolean(cloudStudio)})||apiError||"正在读取云端…";
 const isOutage=apiError&&/无法连接|API_UNAVAILABLE|ECONNREFUSED/i.test(apiError);
 const isEmptyAccount=apiError&&/还没有可访问的剧本/.test(apiError);
 const pill=isOutage?"部分运行模块尚未连接":isEmptyAccount?"● 已连接 · 尚无剧本":apiError?"部分提示":"● 云端已连接";
 const catalogHint=isEmptyAccount&&!isOutage?"可点「公开剧本库」体验示例剧本，或创建你自己的世界。":"";
 return `${sessionMode!=="authenticated"?demoIdentityBanner():""}<section class="demo-strip cloud-status-strip"><div><span class="cloud-pill ${isOutage?"offline":""}">${pill}</span><strong style="margin-top:7px">${escapeHtml(panelMsg)}</strong><p>${cloudStudio?(rooms.length?`当前世界已建立 ${rooms.length} 个运行房间。`:"当前世界尚未建立测试房，运行状态为空。"):cloudLoading?"正在连接…":catalogHint}</p></div><button class="secondary-btn" data-action="refresh-cloud">刷新云端数据</button></section>`}

function stat(icon,num,label,sub){return `<article class="stat-card"><div class="stat-icon">${icon}</div><strong>${num}</strong><span>${label} · ${sub}</span></article>`}

function flow(kicker,title,status,cls){return `<div class="flow-node ${cls}"><small>${kicker}</small><strong>${title}</strong><span>${status}</span></div>`}

function activity(text,time,type){return `<div class="activity ${type}"><i class="dot"></i><div><p>${text}</p><small>${time}</small></div></div>`}

function readingRow(initial,name,text,status,cls,color){return `<div class="reading-row"><div class="avatar small" style="background:${color}">${initial}</div><div><strong>${name}</strong><p>${text}</p></div><span class="reading-status ${cls}">${status}</span></div>`}

function task(icon,title,text,view,action){return `<div class="task-row"><span class="task-icon">${icon}</span><div><strong>${title}</strong><p>${text}</p></div><button data-go="${view}">${action} →</button></div>`}

function taskAction(icon,title,text,action,label,hubTab=""){const hubAttr=hubTab?` data-hub-tab="${escapeHtml(hubTab)}"`:"";return `<div class="task-row"><span class="task-icon">${icon}</span><div><strong>${title}</strong><p>${text}</p></div><button data-action="${action}"${hubAttr}>${label} →</button></div>`}

function capability(icon,title,text,view){return `<article class="capability-card"><i>${icon}</i><h3>${title}</h3><p>${text}</p><button ${view==="wizard"?'data-action="open-wizard"':`data-go="${view}"`}>打开功能 →</button></article>`}

function catalogCardsHtml(){
 const cloudCatalogError=worldStore.get().cloudCatalogError;
 const cloudCatalog=worldStore.get().cloudCatalog;
 if(cloudCatalogError)return `<div class="empty-state">公开库加载失败：${escapeHtml(cloudCatalogError)}</div>`;
 if(!cloudCatalog.length)return `<div class="empty-state">公开库暂无剧本。主创作者可在「世界设置」提交公开库审核申请。</div>`;
 return `<div class="catalog-inline-grid">${cloudCatalog.map(world=>`<article class="catalog-inline-card"><div><span class="cloud-pill">公开</span><h3>${escapeHtml(world.name)}</h3><p>${escapeHtml(world.summary||"暂无简介")}</p><small>创作者：${escapeHtml(world.owner_display_name||"未知")} · ${world.role_count||0} 个角色席</small></div><button class="primary-btn" data-action="catalog-join" data-world-id="${world.id}">开始体验</button></article>`).join("")}</div>`;
}

function catalogPromoSection(){
 return `<section class="catalog-promo card"><div class="section-head"><div><h3>公开剧本库</h3><p>浏览已发布的完整剧本，加入后会为你开启独立的体验运行房。</p></div><button class="secondary-btn" data-action="open-catalog">浏览全部 →</button></div>${catalogCardsHtml()}</section>`;
}

function creatorWorkspaceEmpty({title,kicker,intro,guideTitle,guideItems=[]}){
 const apiError=userStore.get().apiError;
 const cloudLoading=studioStore.get().cloudLoading;
 if(cloudLoading)return `${cloudStatus()}<section class="card creator-empty-loading"><p class="section-kicker">${escapeHtml(kicker||"WORKSPACE")}</p><h3>正在连接云端…</h3><p>已登录时会同时读取公开剧本库列表。</p></section>`;
 const noWorld=!zhimuApi.context.worldId;
 const panelMsg=window.zhimuUserMessages?.formatCloudPanelError?.(apiError,{hasStudio:false})||apiError||"";
 return `${cloudStatus()}
 <section class="creator-empty-hero card"><p class="section-kicker">${escapeHtml(kicker||"CREATOR WORKSPACE")}</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(intro)}</p>${panelMsg?`<p class="muted-note">${escapeHtml(panelMsg)}</p>`:""}<div class="row creator-empty-actions"><button class="primary-btn" data-action="open-wizard">＋ 创建我的世界</button><button class="secondary-btn" data-action="world-library">我的剧本</button><button class="secondary-btn" data-action="open-catalog">浏览公开剧本库</button></div></section>
 ${noWorld?catalogPromoSection():""}
 <section class="creator-empty-guide card"><div class="section-head"><div><h3>${escapeHtml(guideTitle||"进入创作前")}</h3><p>${noWorld?"先创建或选择剧本后，下列工具才会载入你的剧本数据。":"当前世界数据尚未加载，请刷新或重新选择剧本。"}</p></div></div>
 <div class="creator-empty-preview">${guideItems.map(item=>`<article class="creator-preview-block"><span class="asset-type">${escapeHtml(item.label)}</span><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.text)}</p><ul>${(item.bullets||[]).map(b=>`<li>${escapeHtml(b)}</li>`).join("")}</ul></article>`).join("")}</div></section>`;
}

function check(title,status){return `<div class="check-item"><i>✓</i><div><strong>${title}</strong><p>${status}</p></div></div>`}

function voiceOption(icon,title,text,roomId,cls){return `<div class="voice-option ${cls}"><i>${icon}</i><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div><div class="row">${cls==="invite_private"?`<button class="secondary-btn" data-action="voice-room-invite" data-room-id="${roomId}" data-room="${escapeHtml(title)}">邀请成员</button>`:""}<button data-action="join-room" data-room-id="${roomId}" data-room="${escapeHtml(title)}">${voiceStore.get().voiceRoomId===roomId?"当前房间":"加入"}</button></div></div>`}
  window.zhimuUi = { activeRuntimeRoom, runtimeEmpty, cloudStatus, catalogPromoSection, creatorWorkspaceEmpty, canEditWorldContent, catalogExperienceBanner, isWorldOwner, deleteWorldPanel, stat, flow, activity, readingRow, task, taskAction, capability, check, voiceOption };
})(window);
export {};
