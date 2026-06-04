/* Auto-split from app.js — auth-world.js */
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
  const go = window.zhimuGo;
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  function handle(action, el) { return window.zhimuHandle(action, el); }
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  window.zhimuViews = window.zhimuViews || {};
  function openAuth(){
 const loggedIn=Boolean(localStorage.getItem("zhimuSessionToken"));
 const requireAuth=Boolean(window.zhimuConfig?.requireAuth);
 const loggedInIntro=requireAuth?"当前浏览器已保存内测账号会话。退出后需重新登录才能访问你的剧本与世界。":"当前浏览器已经保存正式登录会话。退出后仍可继续查看演示世界，但账号专属世界需要重新登录。";
 const guestIntro=requireAuth?"内测环境使用正式账号登录。注册后可创建剧本、邀请协作者并保存运行数据。":"建立创作者账号后，可以被邀请为协作者、保存自己的世界，并逐步接入正式多人协作。";
 modal.className="modal auth-modal";modal.innerHTML=loggedIn?`<h2>账号与会话</h2><p class="wizard-intro">${loggedInIntro}</p><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="danger-btn" data-auth-logout>退出登录</button></div>`:`<h2>注册或登录</h2><p class="wizard-intro">${guestIntro}</p><div class="auth-grid"><div class="form-group"><h3>注册</h3>${studioField("昵称","registerName","input","")}${studioField("邮箱","registerEmail","input","")}${studioField("密码 · 至少 8 位","registerPassword","input","")}<button class="primary-btn" data-auth-register>创建账号</button></div><div class="form-group"><h3>登录</h3>${studioField("邮箱","loginEmail","input","")}${studioField("密码","loginPassword","input","")}<button class="secondary-btn" data-auth-login>登录</button></div></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;if(!loggedIn)modal.querySelectorAll('[data-studio-field$="Password"]').forEach(input=>input.type="password");
 const finishAuth=async(label)=>{sessionStorage.removeItem("zhimuAuthPrompted");closeModal();showToast(label);await window.zhimuAuthSession?.syncProfile?.();window.zhimuAuthSession?.syncAuthBanner?.();try{await loadCloudData()}catch(error){showToast(error.message)}render()};
 if(loggedIn)modal.querySelector("[data-auth-logout]").onclick=async()=>{await zhimuApi.logout();localStorage.removeItem("zhimuSessionToken");sessionStorage.removeItem("zhimuAuthPrompted");closeModal();showToast("已退出登录");await window.zhimuAuthSession?.syncProfile?.();window.zhimuAuthSession?.syncAuthBanner?.();if(requireAuth)window.zhimuAuthSession?.promptAuthIfNeeded?.(true);else render()};
 else{modal.querySelector("[data-auth-register]").onclick=async()=>{try{const result=await zhimuApi.register({displayName:modal.querySelector('[data-studio-field="registerName"]').value,email:modal.querySelector('[data-studio-field="registerEmail"]').value,password:modal.querySelector('[data-studio-field="registerPassword"]').value});localStorage.setItem("zhimuSessionToken",result.token);await finishAuth("注册成功，已经登录")}catch(error){showToast(error.message)}};modal.querySelector("[data-auth-login]").onclick=async()=>{try{const result=await zhimuApi.login({email:modal.querySelector('[data-studio-field="loginEmail"]').value,password:modal.querySelector('[data-studio-field="loginPassword"]').value});localStorage.setItem("zhimuSessionToken",result.token);await finishAuth("登录成功")}catch(error){showToast(error.message)}}}
}

async function openWorldLibrary(){
 modal.className="modal world-library-modal";
 modal.innerHTML=`<h2>选择已有剧本</h2><p class="wizard-intro">列表来自当前账号的云端数据库。不需要且你是 owner 的可以删除。</p><label class="check-label" style="margin-bottom:12px"><input type="checkbox" id="world-library-archived"><span>显示已归档剧本</span></label><div class="world-library-list"><div class="empty-state">正在读取你的剧本列表…</div></div><div class="modal-actions"><button class="secondary-btn" data-close disabled>关闭</button><button class="primary-btn" data-open-create-world disabled>＋ 创建新世界</button></div>`;
 modalBackdrop.classList.add("show");
 modal.querySelector("[data-close]").onclick=closeModal;
 const draw=async()=>{const includeArchived=Boolean(modal.querySelector("#world-library-archived")?.checked);try{const worlds=await zhimuApi.getWorlds(includeArchived);state.cloudWorlds=worlds;const statusLabel={draft:"草稿",testing:"测试中",published:"已发布",archived:"已归档"};const roomCounts=await Promise.allSettled(worlds.map((world)=>zhimuApi.getWorldRooms(world.id).then((rooms)=>rooms.length)));modal.querySelector(".world-library-list").innerHTML=worlds.map((world,index)=>{const count=roomCounts[index].status==="fulfilled"?roomCounts[index].value:"?";const isCurrent=world.id===zhimuApi.context.worldId;const canDelete=world.membership_role==="owner"&&!isCurrent;return `<article class="world-library-card ${isCurrent?"active":""}"><div><span class="cloud-pill">${escapeHtml(world.membership_role||"member")}</span><span class="status-chip ${world.status||"draft"}">${escapeHtml(statusLabel[world.status]||world.status||"草稿")}</span><h3>${escapeHtml(world.name)}</h3><p>${escapeHtml(world.summary||"尚未补充世界简介")}</p><small>${count} 个平行房</small></div><div class="row">${canDelete?`<button class="text-btn danger-text" data-action="world-delete" data-world-id="${world.id}" data-world-name="${escapeHtml(world.name)}">删除</button>`:""}<button class="${isCurrent?"secondary-btn":"primary-btn"}" data-action="world-select" data-world-id="${world.id}">${isCurrent?"当前剧本":"切换剧本"}</button></div></article>`}).join("")||`<div class="empty-state">当前账号还没有可访问的剧本。你可以创建新世界，或请协作者邀请你加入。</div>`;modal.querySelector("[data-close]").disabled=false;modal.querySelector("[data-open-create-world]").disabled=false;modal.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=()=>handle(btn.dataset.action,btn));modal.querySelector("[data-open-create-world]").onclick=()=>{closeModal();openWizard()}}catch(error){modal.querySelector(".world-library-list").innerHTML=`<div class="empty-state">${escapeHtml(error.message)}</div>`;modal.querySelector("[data-close]").disabled=false;showToast(error.message)}};
 modal.querySelector("#world-library-archived")?.addEventListener("change",draw);
 await draw();
}

async function deleteWorld(worldId,worldName){
 if(worldId===zhimuApi.context.worldId)return showToast("请先切换到其他剧本，再删除当前剧本");
 studioModal(`删除剧本「${worldName}」`,`<p>将永久删除该剧本的角色、章节、平行房与规则数据，且不可恢复。</p>`,"确认删除",async()=>{
  try{
   await zhimuApi.deleteWorld(worldId);
   closeModal();
   if(zhimuApi.context.worldId===worldId){zhimuApi.clearWorld();state.cloudStudio=null}
   await loadCloudData(true,true);
   showToast(`已删除「${worldName}」`);
   openWorldLibrary();
  }catch(error){showToast(error.message)}
 });
}

async function selectWorld(worldId){
 if(!worldId)return showToast("未找到目标剧本");
 if(worldId===zhimuApi.context.worldId){closeModal();return showToast("已经是当前剧本")}
 zhimuApi.selectWorld(worldId);
 zhimuApi.clearRoom();
 state.cloudStudio=null;
 state.cloudRules=[];
 state.cloudCreatorChecks=[];
 state.cloudHost=[];
 state.cloudHostPlayers=[];
 state.cloudHostStuckCount=0;
 state.cloudHostEvents=[];
 state.cloudCheckpoints=[];
 state.cloudRecaps=[];
 state.cloudRecapLatest=null;
 state.cloudRecapDetail=null;
 state.activeRecapId=null;
 state.cloudWorldLogs=[];
 state.cloudPlayer=null;
 state.cloudExploration=null;
 state.cloudAssets=[];
 state.storageUsage=null;
 state.apiError="";
 closeModal();
 state.cloudLoading=true;
 render();
 try{
  await loadCloudData(true,true);
  const name=state.cloudStudio?.world?.name||(state.cloudWorlds||[]).find((world)=>world.id===worldId)?.name||"新剧本";
  showToast(`已切换到「${name}」`);
 }catch(error){
  state.cloudLoading=false;
  state.apiError=error.message||String(error);
  render();
  showToast(error.message||"切换剧本失败");
 }
}

async function openWorldRooms(){
 try{
  const rooms=await zhimuApi.getWorldRooms(),world=state.cloudStudio?.world;
  modal.className="modal world-library-modal";modal.innerHTML=`<h2>${escapeHtml(world?.name||"当前剧本")} · 平行房</h2><p class="wizard-intro">每个平行房拥有自己的邀请码、玩家成员、阅读进度、日志、规则执行记录和语音空间。房间之间不会互相推进。</p><div class="parallel-room-create"><input class="field" data-room-name placeholder="例如：周末测试组 A"><button class="primary-btn" data-action="room-create">＋ 开放新平行房</button></div><div class="parallel-room-list">${rooms.map(room=>`<article class="parallel-room-row ${room.id===zhimuApi.context.roomId?"active":""}"><div><h3>${escapeHtml(room.name)}</h3><p>邀请码：${escapeHtml(room.invite_code)} · ${room.member_count} 名成员 · ${escapeHtml(room.status)}</p></div><div class="row"><button class="secondary-btn" data-action="room-invite" data-room-id="${room.id}" data-room-name="${escapeHtml(room.name)}" data-invite-code="${escapeHtml(room.invite_code)}">邀请玩家</button><button class="${room.id===zhimuApi.context.roomId?"secondary-btn":"primary-btn"}" data-action="room-select" data-room-id="${room.id}">${room.id===zhimuApi.context.roomId?"当前房间":"进入房间"}</button></div></article>`).join("")||`<div class="empty-state">尚未开放平行房。创建后会生成独立邀请码和公共讨论房。</div>`}</div><div class="modal-actions"><button class="secondary-btn" data-action="room-join">使用邀请码加入房间</button><button class="secondary-btn" data-close>关闭</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=()=>handle(btn.dataset.action,btn));
 }catch(error){showToast(error.message)}
}

async function createParallelRoom(){
 const input=modal.querySelector("[data-room-name]"),name=input.value.trim();if(!name)return showToast("请填写平行房名称");
 try{const room=await zhimuApi.createRoom(zhimuApi.context.worldId,{name,inviteCode:`ROOM-${Date.now().toString(36).toUpperCase()}`});zhimuApi.selectRoom(room.id);closeModal();await loadCloudData(true,true);showToast(`平行房已开放：${room.invite_code}`);openWorldRooms()}catch(error){showToast(error.message)}
}

async function selectParallelRoom(roomId){
 zhimuApi.selectRoom(roomId);window.zhimuClearRuntimeState();closeModal();await loadCloudData(true,true);showToast("已切换到独立平行房");
}

function openRoomInvite(roomId,inviteCode,roomName){
 const roles=state.cloudStudio?.roles||[];
 modal.className="modal";modal.innerHTML=`<h2>邀请玩家 · ${escapeHtml(roomName)}</h2><p class="wizard-intro">把邀请码发送给玩家。玩家打开织幕并选择“使用邀请码加入房间”，再从空闲角色中选择自己的席位。</p><div class="tutorial-tip"><b>房间邀请码</b><span class="invite-code">${escapeHtml(inviteCode)}</span></div><div class="checklist">${roles.map(role=>check(escapeHtml(role.name),"玩家加入时选择这个角色席位")).join("")||`<div class="empty-state">当前剧本尚未建立角色席位。</div>`}</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="secondary-btn" data-copy-invite>复制邀请码</button><button class="primary-btn" data-action="room-join" data-invite-code="${escapeHtml(inviteCode)}">用当前预览玩家测试加入</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-copy-invite]").onclick=async()=>{try{await navigator.clipboard.writeText(inviteCode);showToast("邀请码已复制")}catch{showToast(`邀请码：${inviteCode}`)}};modal.querySelector("[data-action]").onclick=()=>openJoinRoom(inviteCode);
}

function openJoinRoom(inviteCode=""){
 let invite=null;
 const draw=()=>{const roles=invite?.roles||[],available=roles.filter(role=>!role.occupied||role.occupied_by_current);modal.className="modal";modal.innerHTML=`<h2>使用邀请码加入房间</h2><p class="wizard-intro">玩家只需要输入主持人发送的邀请码。系统会读取对应剧本的角色席位，再将玩家加入正确的独立平行房。</p><div class="form-group"><label>房间邀请码</label><div class="row"><input class="field" data-join-code value="${escapeHtml(inviteCode)}" placeholder="输入主持人发送的邀请码"><button class="secondary-btn" data-join-lookup>读取角色席位</button></div>${invite?`<div class="tutorial-tip"><b>${escapeHtml(invite.room.name)}</b><span>${escapeHtml(invite.world.name)} · 选择你的角色后进入房间。</span></div>`:""}<label>选择角色席位</label><select class="field" data-join-role ${available.length?"":"disabled"}>${roles.map(role=>`<option value="${role.id}" ${role.occupied&&!role.occupied_by_current?"disabled":""}>${escapeHtml(role.name)}${role.occupied_by_current?" · 当前角色":role.occupied?" · 已被选择":""}</option>`).join("")||`<option>请先读取角色席位</option>`}</select></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-join-submit ${available.length?"":"disabled"}>加入并进入玩家视角</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-join-lookup]").onclick=lookup;modal.querySelector("[data-join-submit]").onclick=submit;
 };
 const lookup=async()=>{const code=modal.querySelector("[data-join-code]").value.trim();if(!code)return showToast("请填写房间邀请码");try{inviteCode=code;invite=await zhimuApi.getRoomInvite(code);draw();showToast("已读取可选角色席位")}catch(error){showToast(error.message)}};
 const submit=async()=>{const roleSlotId=modal.querySelector("[data-join-role]").value;if(!inviteCode||!roleSlotId)return showToast("请先读取角色席位");try{const result=await zhimuApi.joinRoom(inviteCode,roleSlotId);zhimuApi.selectWorld(invite.world.id);zhimuApi.selectRoom(result.roomId);closeModal();await loadCloudData(true,true);go("player");showToast("已加入房间，可以继续创建临时密谈")}catch(error){showToast(error.message)}};
 draw();if(inviteCode)lookup();
}
  window.zhimuRuntime = Object.assign(window.zhimuRuntime || {}, { openAuth, openWorldLibrary, selectWorld, deleteWorld, openWorldRooms, createParallelRoom, selectParallelRoom, openRoomInvite, openJoinRoom });
})(window);
export {};
