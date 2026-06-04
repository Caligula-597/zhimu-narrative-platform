/* Auto-split from app.js — emptyState.js */
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
  const showToast = T.showToast || (() => {});
  const closeModal = M.closeModal || (() => {});
  const openModal = M.openModal || (() => {});
  const studioModal = M.studioModal || (() => {});
  const studioField = M.studioField || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioSelect = M.studioSelect || (() => "");
  const go = window.zhimuGo;
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
  window.zhimuViews = window.zhimuViews || {};
  function activeRuntimeRoom(){return (state.cloudStudio?.rooms||[]).find(room=>room.id===zhimuApi.context.roomId)||null}

function runtimeEmpty(title,description){
 const world=state.cloudStudio?.world;
 return `${cloudStatus()}<article class="card runtime-empty"><p class="eyebrow">RUNTIME REQUIRED</p><h2>${title}尚未连接运行房</h2><p>${description}</p><div class="tutorial-tip"><b>${escapeHtml(world?.name||"当前世界")}</b><span>创作内容仍然保留在云端。建立或选择一个平行房后，这里才会显示该房间自己的玩家状态、章节进度和互动数据。</span></div><button class="primary-btn" data-action="world-rooms">管理平行房</button></article>`;
}

function cloudStatus(){const rooms=state.cloudStudio?.rooms||[];return `<section class="demo-strip"><div><span class="cloud-pill ${state.apiError?"offline":""}">${state.apiError?"部分运行模块尚未连接":"● 云端 Alpha 已连接"}</span><strong style="margin-top:7px">${state.apiError||"当前世界的创作数据已经从 Supabase PostgreSQL 读取"}</strong><p>${state.cloudStudio?(rooms.length?`当前世界已建立 ${rooms.length} 个运行房间。`:"当前世界尚未建立测试房，运行状态为空。"):"正在读取 Supabase PostgreSQL..."}</p></div><button class="secondary-btn" data-action="refresh-cloud">刷新云端数据</button></section>`}

function stat(icon,num,label,sub){return `<article class="stat-card"><div class="stat-icon">${icon}</div><strong>${num}</strong><span>${label} · ${sub}</span></article>`}

function flow(kicker,title,status,cls){return `<div class="flow-node ${cls}"><small>${kicker}</small><strong>${title}</strong><span>${status}</span></div>`}

function activity(text,time,type){return `<div class="activity ${type}"><i class="dot"></i><div><p>${text}</p><small>${time}</small></div></div>`}

function readingRow(initial,name,text,status,cls,color){return `<div class="reading-row"><div class="avatar small" style="background:${color}">${initial}</div><div><strong>${name}</strong><p>${text}</p></div><span class="reading-status ${cls}">${status}</span></div>`}

function task(icon,title,text,view,action){return `<div class="task-row"><span class="task-icon">${icon}</span><div><strong>${title}</strong><p>${text}</p></div><button data-go="${view}">${action} →</button></div>`}

function taskAction(icon,title,text,action,label){return `<div class="task-row"><span class="task-icon">${icon}</span><div><strong>${title}</strong><p>${text}</p></div><button data-action="${action}">${label} →</button></div>`}

function capability(icon,title,text,view){return `<article class="capability-card"><i>${icon}</i><h3>${title}</h3><p>${text}</p><button ${view==="wizard"?'data-action="open-wizard"':`data-go="${view}"`}>打开功能 →</button></article>`}


function check(title,status){return `<div class="check-item"><i>✓</i><div><strong>${title}</strong><p>${status}</p></div></div>`}

function voiceOption(icon,title,text,roomId,cls){return `<div class="voice-option ${cls}"><i>${icon}</i><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div><div class="row">${cls==="invite_private"?`<button class="secondary-btn" data-action="voice-room-invite" data-room-id="${roomId}" data-room="${escapeHtml(title)}">邀请成员</button>`:""}<button data-action="join-room" data-room-id="${roomId}" data-room="${escapeHtml(title)}">${state.voiceRoomId===roomId?"当前房间":"加入"}</button></div></div>`}
  window.zhimuUi = { activeRuntimeRoom, runtimeEmpty, cloudStatus, stat, flow, activity, readingRow, task, taskAction, capability, check, voiceOption };
})(window);
export {};
