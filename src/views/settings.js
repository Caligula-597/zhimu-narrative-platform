/* Auto-split from app.js — settings.js */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const { modal, modalBackdrop } = window.zhimuDom;
  const F = window.zhimuFormat || {};
  const U = window.zhimuUi || {};
  const T = window.zhimuToast || {};
  const R = window.zhimuRuntime || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatTime = F.formatTime || (() => "");
  const formatRelativeTime = F.formatRelativeTime || (() => "");
  const hostAuditActionLabel = F.hostAuditActionLabel || ((a) => a);
  const hostAuditDetail = F.hostAuditDetail || (() => "");
  const showToast = T.showToast || (() => {});
  const activeRuntimeRoom = U.activeRuntimeRoom || (() => null);
  const isWorldOwner = U.isWorldOwner || (() => false);
  const deleteWorldPanel = U.deleteWorldPanel || (() => "");
  const closeModal = window.zhimuModal?.closeModal || (() => {});
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  window.zhimuViews = window.zhimuViews || {};
  const viewExports = window.zhimuViews.settings = window.zhimuViews.settings || {};

function settings(){
 const worldId=zhimuApi.context.worldId;
 const studioWorld=state.cloudStudio?.world;
 const listed=(state.cloudWorlds||[]).find((w)=>w.id===worldId);
 const world=studioWorld?.id===worldId?studioWorld:listed||studioWorld;
 const room=activeRuntimeRoom();
 const roomSettings=state.cloudRoomSettings||{};
 const canEditWorld=Boolean(world?.id);
 const owner=isWorldOwner(worldId);
 const catalogPublic=Boolean(world?.catalog_public);
 const roleLabel=world?.membership_role==="owner"?"主创作者":world?.membership_role?`协作 · ${world.membership_role}`:"";
 const canAudit=["owner","editor","host"].includes(world?.membership_role);
 return `${deleteWorldPanel(world)}
 <section class="rules-layout"><article class="card"><div class="section-head"><div><h3>世界信息</h3><p>名称与简介会展示在总览与玩家入口${roleLabel?` · 你在本剧本的身份：<strong>${escapeHtml(roleLabel)}</strong>`:""}</p></div></div><div class="form-group"><label>世界名称</label><input class="field" id="settings-world-name" value="${escapeHtml(world?.name||"")}" ${canEditWorld?"":"readonly"}><label>世界简介</label><textarea class="field" id="settings-world-summary" rows="3" ${canEditWorld?"":"readonly"}>${escapeHtml(world?.summary||"")}</textarea><label>角色席位数</label><input class="field" value="${String(state.cloudStudio?.roles?.length||0)}" readonly>${owner?`<label class="check-label" style="margin-top:14px"><input type="checkbox" id="settings-catalog-public" ${catalogPublic?"checked":""}><span><strong>公开到剧本库</strong><small>开启后，其他登录用户可在侧栏「公开剧本库」发现并开自己的体验平行房。</small></span></label>`:""}<button class="primary-btn" style="margin-top:14px" data-action="save-world-settings" ${canEditWorld?"":"disabled"}>保存世界信息</button></div></article>
 <article class="card"><div class="section-head"><div><h3>运行房选项</h3><p>${room?`当前平行房：${escapeHtml(room.name)}`:"请先在总览中选择平行运行房"}</p></div></div><div class="form-group"><label class="check-label"><input type="checkbox" id="settings-host-voice-listen" ${roomSettings.hostVoiceListen?"checked":""} ${room?"":"disabled"}><span><strong>主持人可旁听私密语音房</strong><small>开启后，主持人在未受邀的情况下仍可进入私密语音房旁听（不可发言）。</small></span></label><button class="primary-btn" style="margin-top:14px" data-action="save-room-settings" ${room?"":"disabled"}>保存运行房选项</button></div></article>
 ${canAudit?`<article class="card"><div class="section-head"><div><h3>世界主持审计</h3><p>汇总本剧本所有平行房的主持敏感操作（发线索、延迟事件、存档恢复等）。单房明细见主持监控台。</p></div><button class="secondary-btn" data-action="world-audit">查看审计</button></div></article>`:""}
 <aside class="card"><div class="section-head"><div><h3>账号与配额</h3><p>登录、套餐配额、OAuth 与多设备</p></div></div><button class="secondary-btn full-btn" data-action="go-account">打开账号设置</button></aside>
 <aside class="card"><div class="section-head"><div><h3>剧本管理</h3><p>切换、创建或删除剧本</p></div></div><button class="secondary-btn full-btn" data-action="world-library">我的剧本 / 切换剧本</button><button class="secondary-btn full-btn" style="margin-top:10px" data-action="open-catalog">打开公开剧本库</button><button class="secondary-btn full-btn" style="margin-top:10px" data-action="open-wizard">＋ 创建新世界</button>${!owner&&canEditWorld?`<p class="muted-note" style="margin-top:12px">你不是主创作者，无法删除此剧本。若需退出协作，请联系剧本 owner 将你移出协作者列表。</p>`:""}</aside>
 <aside class="card"><div class="section-head"><div><h3>帮助与数据</h3><p>步骤说明与错误排查</p></div></div><button class="secondary-btn full-btn" data-action="open-creator-guide">创作步骤指引</button><button class="secondary-btn full-btn" data-action="open-error-guide">错误提示与排查</button><button class="secondary-btn full-btn" style="margin-top:10px" data-action="go-writer-export">前往剧本创作 · 导出/导入</button></aside></section>`;
}

async function saveWorldSettings(){
 const name=document.getElementById("settings-world-name")?.value?.trim();
 const summary=document.getElementById("settings-world-summary")?.value?.trim()||"";
 const catalogToggle=document.getElementById("settings-catalog-public");
 if(!name)return showToast("请填写世界名称");
 try{
  await zhimuApi.patchWorld({name,summary});
  if(catalogToggle)await zhimuApi.patchWorldCatalog(Boolean(catalogToggle.checked));
  await loadCloudData();
  showToast("世界信息已保存");
 }catch(error){showToast(error.message)}
}

async function saveRoomSettings(){
 const room=activeRuntimeRoom();
 if(!room)return showToast("请先选择平行运行房");
 const hostVoiceListen=Boolean(document.getElementById("settings-host-voice-listen")?.checked);
 try{
  await zhimuApi.patchRoomSettings({hostVoiceListen});
  state.cloudRoomSettings={hostVoiceListen};
  showToast("运行房选项已保存");
 }catch(error){showToast(error.message)}
}

function goWriterExport(){
 window.zhimuGo?.("writer");
 showToast("请在剧本创作页使用「导出内容包 / 导入内容包」");
}

async function openWorldAuditModal(){
 if(!zhimuApi.context.worldId)return showToast("请先选择剧本");
 try{
  const payload=await zhimuApi.getWorldHostAuditLog(50);
  const rows=payload?.entries||[];
  const body=rows.length?rows.map((entry)=>{
   const actor=entry.actor_name?`${escapeHtml(entry.actor_name)} · `:"";
   const room=entry.room_name?`${escapeHtml(entry.room_name)} · `:"";
   const detail=hostAuditDetail(entry);
   return `<div class="checkpoint-row"><strong>${room}${actor}${escapeHtml(hostAuditActionLabel(entry.action))}</strong><p>${detail?`${escapeHtml(detail)} · `:""}${formatRelativeTime(entry.created_at)}</p></div>`;
  }).join(""):`<div class="empty-state">本剧本尚无主持审计记录。</div>`;
  modal.className="modal host-detail-modal";
  modal.innerHTML=`<h2>世界主持审计</h2><p class="wizard-intro">汇总所有平行房的主持敏感操作，最近 ${rows.length} 条。</p><div class="host-detail-list host-audit-list">${body}</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
  modalBackdrop.classList.add("show");
  modal.querySelector("[data-close]").onclick=closeModal;
 }catch(error){showToast(error.message)}
}

  viewExports.settings = settings;
  viewExports.saveWorldSettings = saveWorldSettings;
  viewExports.saveRoomSettings = saveRoomSettings;
  viewExports.goWriterExport = goWriterExport;
  viewExports.openWorldAuditModal = openWorldAuditModal;
})(window);
export {};
