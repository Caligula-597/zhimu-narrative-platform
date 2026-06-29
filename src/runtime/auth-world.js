/* Auto-split from app.js — auth-world.js */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { uiStore, userStore, worldStore, studioStore } from "../state/index.js";
  const { content, toast, modal, modalBackdrop } = window.zhimuDom;
  const F = window.zhimuFormat || {};
  const U = window.zhimuUi || {};
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
  const isWorldOwner = U.isWorldOwner || (() => false);
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
  const showError = (error, fallback = "操作失败，请稍后重试") => showToast(window.zhimuStatus?.normalizeError?.(error, fallback) || error?.message || fallback);
  const closeModal = M.closeModal || (() => {});
  const openModal = M.openModal || (() => {});
  const studioModal = M.studioModal || (() => {});
  const studioField = M.studioField || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioSelect = M.studioSelect || (() => "");
  const go = (view) => window.zhimuRuntime?.go?.(view);
  function render() { window.zhimuRuntime?.render?.(); }
  function loadCloudData(...args) { return window.zhimuRuntime?.loadCloudData?.(...args); }
  function handle(action, el) { return window.zhimuRuntime?.handle?.(action, el); }
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  window.zhimuViews = window.zhimuViews || {};
export function openForgotPassword(prefillEmail=""){
 modal.className="modal auth-modal";
 modal.innerHTML=`<h2>找回密码</h2><p class="wizard-intro">输入注册邮箱，我们会发送重置链接（1 小时内有效）。</p>${studioField("邮箱","forgotEmail","input",prefillEmail)}<div class="modal-actions"><button class="secondary-btn" data-auth-back-login>返回登录</button><button class="primary-btn" data-auth-forgot-submit>发送重置邮件</button></div>`;
 modalBackdrop.classList.add("show");
 modal.querySelector("[data-auth-back-login]").onclick=()=>openAuth();
 modal.querySelector("[data-auth-forgot-submit]").onclick=async()=>{try{const email=modal.querySelector('[data-studio-field="forgotEmail"]').value.trim();if(!email)return showToast("请填写邮箱");await zhimuApi.requestPasswordReset({email});closeModal();showToast("若该邮箱已注册，请查收重置邮件（含垃圾箱）")}catch(error){showError(error)}};
 modal.querySelector("[data-close]")?.remove();
}

export function openVerifyPending(prefillEmail=""){
 modal.className="modal auth-modal";
 modal.innerHTML=`<h2>验证邮箱</h2><p class="wizard-intro">我们已向 ${escapeHtml(prefillEmail||"你的邮箱")} 发送验证链接（24 小时内有效）。验证通过后即可创建剧本。</p><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="primary-btn" data-auth-resend-verify>重新发送验证邮件</button></div>`;
 modalBackdrop.classList.add("show");
 modal.querySelector("[data-close]").onclick=closeModal;
 modal.querySelector("[data-auth-resend-verify]").onclick=async()=>{try{if(!window.zhimuSessionAuth?.isAuthenticated?.())return showToast("请先登录后再重发验证邮件");await zhimuApi.resendVerification();showToast("验证邮件已发送（含垃圾箱）")}catch(error){showError(error)}};
}

export function openVerifyEmail(verifyToken){
 if(!verifyToken)return;
 modal.className="modal auth-modal";
 modal.innerHTML=`<h2>正在验证邮箱…</h2><p class="wizard-intro">请稍候。</p>`;
 modalBackdrop.classList.add("show");
 (async()=>{try{const result=await zhimuApi.verifyEmail({token:verifyToken});window.zhimuSessionAuth?.markAuthenticated?.();closeModal();showToast("邮箱已验证，已自动登录");await window.zhimuAuthSession?.syncProfile?.();window.zhimuAuthSession?.syncAuthBanner?.();try{await loadCloudData(true,true);render()}catch(error){showError(error)}}catch(error){modal.innerHTML=`<h2>验证失败</h2><p class="wizard-intro">${escapeHtml(error.message||"链接无效或已过期")}</p><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="primary-btn" data-auth-open-login>去登录</button></div>`;modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-auth-open-login]").onclick=()=>openAuth()}})();
}

export function openResetPassword(resetToken){
 if(!resetToken)return;
 modal.className="modal auth-modal";
 modal.innerHTML=`<h2>设置新密码</h2><p class="wizard-intro">请为账号设置新的登录密码（至少 8 位）。设置成功后需重新登录。</p>${studioField("新密码 · 至少 8 位","resetPassword","input","")}${studioField("确认新密码","resetPasswordConfirm","input","")}<div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-auth-reset-submit>更新密码</button></div>`;
 modalBackdrop.classList.add("show");
 modal.querySelectorAll('[data-studio-field$="Password"],[data-studio-field$="Confirm"]').forEach(input=>input.type="password");
 modal.querySelector("[data-close]").onclick=closeModal;
 modal.querySelector("[data-auth-reset-submit]").onclick=async()=>{try{const password=modal.querySelector('[data-studio-field="resetPassword"]').value;const confirm=modal.querySelector('[data-studio-field="resetPasswordConfirm"]').value;if(password.length<8)return showToast("密码至少 8 位");if(password!==confirm)return showToast("两次输入的密码不一致");await zhimuApi.resetPassword({token:resetToken,password});closeModal();window.zhimuSessionAuth?.markLoggedOut?.();showToast("密码已更新，请使用新密码登录");openAuth()}catch(error){showError(error)}};
}

export function openAuth(){
 const loggedIn=Boolean(window.zhimuSessionAuth?.isAuthenticated?.());
 if(loggedIn){window.zhimuRuntime?.go?.("account");return}
 openAuthForm();
}

export async function openAccountPanel(){
 window.zhimuRuntime?.go?.("account");
}

export function openAuthForm(){
 const requireAuth=Boolean(window.zhimuConfig?.requireAuth);
 const guestIntro="注册或登录后，可创建剧本、邀请协作者并保存运行数据。";
 modal.className="modal auth-modal";
 modal.innerHTML=`<h2>注册或登录</h2><p class="wizard-intro">${guestIntro}</p><div data-oauth-bar class="row" style="margin-bottom:12px"></div><div class="auth-grid"><div class="form-group"><h3>注册</h3>${studioField("昵称","registerName","input","")}${studioField("邮箱","registerEmail","input","")}${studioField("密码 · 至少 8 位","registerPassword","input","")}<p class="muted-note auth-legal-note">注册即表示你已阅读并同意 <a href="#" data-legal-doc="legal/USER_TERMS_ZH.md" data-legal-title="用户协议">用户协议</a> 与 <a href="#" data-legal-doc="legal/PRIVACY_ZH.md" data-legal-title="隐私政策">隐私政策</a>。</p><button class="primary-btn" data-auth-register>创建账号</button></div><div class="form-group"><h3>登录</h3>${studioField("邮箱","loginEmail","input","")}${studioField("密码","loginPassword","input","")}<button class="secondary-btn" data-auth-login>登录</button><button type="button" class="text-btn" data-auth-forgot style="margin-top:8px">忘记密码？</button><p class="muted-note auth-legal-note"><a href="#" data-legal-doc="legal/USER_TERMS_ZH.md" data-legal-title="用户协议">用户协议</a> · <a href="#" data-legal-doc="legal/PRIVACY_ZH.md" data-legal-title="隐私政策">隐私政策</a></p></div></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelectorAll('[data-studio-field$="Password"]').forEach(input=>input.type="password");
 const resetAccountContext=()=>window.zhimuContext?.resetAccountContext?.();
 const finishAuth=async(label)=>{resetAccountContext();sessionStorage.removeItem("zhimuAuthPrompted");closeModal();showToast(label);await window.zhimuAuthSession?.syncProfile?.();window.zhimuAuthSession?.syncAuthBanner?.();try{await loadCloudData(true,true)}catch(error){showError(error)}render();window.zhimuRuntime?.drainPendingInviteAfterAuth?.();if(!zhimuApi.context.worldId){const hasWorlds=(worldStore.get().cloudWorlds||[]).length>0;setTimeout(()=>hasWorlds?openWorldLibrary("mine"):openWorldLibrary("catalog"),400)}};
 modal.querySelector("[data-auth-register]").onclick=async()=>{try{const result=await zhimuApi.register({displayName:modal.querySelector('[data-studio-field="registerName"]').value,email:modal.querySelector('[data-studio-field="registerEmail"]').value,password:modal.querySelector('[data-studio-field="registerPassword"]').value});if(result.pendingEmailVerification){closeModal();showToast("注册成功，请查收验证邮件");openVerifyPending(modal.querySelector('[data-studio-field="registerEmail"]').value.trim());return}window.zhimuSessionAuth?.markAuthenticated?.();await finishAuth("注册成功，已经登录")}catch(error){showError(error)}};
 modal.querySelector("[data-auth-login]").onclick=async()=>{try{const result=await zhimuApi.login({email:modal.querySelector('[data-studio-field="loginEmail"]').value,password:modal.querySelector('[data-studio-field="loginPassword"]').value});window.zhimuSessionAuth?.markAuthenticated?.();if(result.pendingEmailVerification){closeModal();showToast("登录成功，请先验证邮箱");openVerifyPending(modal.querySelector('[data-studio-field="loginEmail"]').value.trim());return}await finishAuth("登录成功")}catch(error){showError(error)}};
 modal.querySelector("[data-auth-forgot]")?.addEventListener("click",()=>openForgotPassword(modal.querySelector('[data-studio-field="loginEmail"]')?.value||""));
 modal.querySelectorAll("[data-legal-doc]").forEach((link)=>{link.addEventListener("click",(event)=>{event.preventDefault();window.zhimuGuide?.openLegalDoc?.(link.dataset.legalDoc,link.dataset.legalTitle||"法律文档")})});
 (async()=>{try{const config=await zhimuApi.getAuthConfig();const bar=modal.querySelector("[data-oauth-bar]");if(!bar||!config.oauth?.length)return;bar.innerHTML=config.oauth.map(p=>`<button class="secondary-btn" data-oauth-start="${p.id}">${escapeHtml(p.label)} 登录</button>`).join("");bar.querySelectorAll("[data-oauth-start]").forEach(btn=>btn.onclick=async()=>{try{const {url}=await zhimuApi.oauthStartUrl(btn.dataset.oauthStart);window.location.href=url}catch(error){showError(error)}})}catch{}})();
}

function applyWorldRename(worldId,name,summary){
 const cloudStudio = studioStore.get().cloudStudio;
 if(cloudStudio?.world?.id===worldId){
  studioStore.set({ cloudStudio: {...cloudStudio, world: {...cloudStudio.world, name, summary}} });
 }
 worldStore.set({ cloudWorlds: (worldStore.get().cloudWorlds||[]).map((w)=>w.id===worldId?{...w,name,summary}:w) });
 if(worldId===zhimuApi.context.worldId){
  window.zhimuNavShell?.syncWorldSwitcher?.();
  render();
 }
}

export function openRenameWorldModal(worldId,worldName="",worldSummary="",reopenLibrary=false){
 if(!worldId)return showToast("未找到目标剧本");
 modal.className="modal";
 modal.innerHTML=`<h2>重命名剧本</h2><p class="wizard-intro">名称与简介会显示在侧栏、总览与玩家入口。</p><div class="form-group">${studioField("剧本名称","renameWorldName","input",worldName)}<label>剧本简介</label><textarea class="field" data-studio-field="renameWorldSummary" rows="3">${escapeHtml(worldSummary)}</textarea></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-rename-world-submit>保存</button></div>`;
 modalBackdrop.classList.add("show");
 modal.querySelector("[data-close]").onclick=closeModal;
 modal.querySelector("[data-rename-world-submit]").onclick=async()=>{
  const name=modal.querySelector('[data-studio-field="renameWorldName"]')?.value?.trim();
  const summary=modal.querySelector('[data-studio-field="renameWorldSummary"]')?.value?.trim()||"";
  if(!name)return showToast("请填写剧本名称");
  try{
   await zhimuApi.patchWorld({name,summary},worldId);
   applyWorldRename(worldId,name,summary);
   closeModal();
   showToast("剧本已重命名");
   if(reopenLibrary)openWorldLibrary("mine");
  }catch(error){showError(error)}
 };
}

export async function joinCatalogWorld(worldId){
 if(!worldId)return showToast("未找到目标剧本");
 try{
  const result=await zhimuApi.joinWorldCatalog(worldId);
  zhimuApi.selectWorld(result.worldId);
  zhimuApi.selectRoom(result.room.id);
  closeModal();
  await loadCloudData(true,true);
  const roles=studioStore.get().cloudStudio?.roles?.length||0;
  const sections=studioStore.get().cloudStudio?.sections?.length||0;
  if(!roles){
   showToast("已加入剧本，但正文尚未加载完成，请稍后刷新");
  }else{
   showToast(`已加入「${result.worldName}」：${roles} 个角色、${sections} 段分幕。邀请码 ${result.room.invite_code}`);
  }
  go(uiStore.get().view==="writer"||uiStore.get().view==="studio"?uiStore.get().view:"overview");
 }catch(error){showError(error)}
}

export async function openWorldLibrary(defaultTab="mine"){
 modal.className="modal world-library-modal";
 modal.innerHTML=`<h2>选择剧本</h2><p class="wizard-intro">「我的剧本」是你创建或被邀请协作的世界；「公开剧本库」可体验主创作者已发布的完整剧本（每人一个自己的运行房，不会重复创建）。</p><div class="world-library-tabs"><button type="button" class="secondary-btn" data-library-tab="mine">我的剧本</button><button type="button" class="secondary-btn" data-library-tab="catalog">公开剧本库</button></div><div data-library-panel="mine"><label class="check-label" style="margin-bottom:12px"><input type="checkbox" id="world-library-archived"><span>显示已归档剧本</span></label></div><div class="world-library-list"><div class="empty-state">正在加载…</div></div><div class="world-library-danger hidden" data-world-library-danger></div><div class="modal-actions"><button class="secondary-btn" data-close disabled>关闭</button><button class="primary-btn" data-open-create-world disabled>＋ 创建新世界</button></div>`;
 modalBackdrop.classList.add("show");
 modal.querySelector("[data-close]").onclick=closeModal;
 let activeTab=defaultTab;
 const setTab=tab=>{
  activeTab=tab;
  modal.querySelectorAll("[data-library-tab]").forEach(btn=>{btn.classList.toggle("primary-btn",btn.dataset.libraryTab===tab);btn.classList.toggle("secondary-btn",btn.dataset.libraryTab!==tab)});
  modal.querySelector("[data-library-panel='mine']")?.classList.toggle("hidden",tab!=="mine");
 };
 modal.querySelectorAll("[data-library-tab]").forEach(btn=>btn.onclick=()=>{setTab(btn.dataset.libraryTab);draw()});
 const drawMine=async()=>{
  const includeArchived=Boolean(modal.querySelector("#world-library-archived")?.checked);
  const worlds=await zhimuApi.getWorlds(includeArchived);
  worldStore.set({ cloudWorlds: worlds });
  const statusLabel={draft:"草稿",testing:"测试中",published:"已发布",archived:"已归档"};
  const roomCounts=await Promise.allSettled(worlds.map((world)=>zhimuApi.getWorldRooms(world.id).then((rooms)=>rooms.length)));
  return {html:worlds.map((world,index)=>{const count=roomCounts[index].status==="fulfilled"?roomCounts[index].value:"?";const isCurrent=world.id===zhimuApi.context.worldId;const owner=world.membership_role==="owner";const editor=world.membership_role==="editor";const canRename=owner||editor;const roomHint=owner||editor?`${count} 个运行房（全剧本）`:count?`我的运行房 · ${count}`:"尚未建立运行房";return `<article class="world-library-card ${isCurrent?"active":""}"><div><span class="cloud-pill">${escapeHtml(world.membership_role||"member")}</span><span class="status-chip ${world.status||"draft"}">${escapeHtml(statusLabel[world.status]||world.status||"草稿")}</span>${world.catalog_public?`<span class="status-chip published">已公开</span>`:""}<h3>${escapeHtml(world.name)}</h3><p>${escapeHtml(world.summary||"尚未补充剧本简介")}</p><small>${roomHint}</small></div><div class="row">${canRename?`<button class="text-btn" data-action="world-rename" data-world-id="${world.id}" data-world-name="${escapeHtml(world.name)}" data-world-summary="${escapeHtml(world.summary||"")}">重命名</button>`:""}${owner?`<button class="text-btn danger-text" data-action="world-delete" data-world-id="${world.id}" data-world-name="${escapeHtml(world.name)}">${isCurrent?"删除当前剧本":"删除"}</button>`:""}<button class="${isCurrent?"secondary-btn":"primary-btn"}" data-action="world-select" data-world-id="${world.id}">${isCurrent?"当前剧本":"切换剧本"}</button></div></article>`}).join("")||`<div class="empty-state">当前账号还没有可访问的剧本。可点下方「＋ 创建新世界」，或浏览公开剧本库。</div>`,worlds};
 };
 const drawCatalog=async()=>{
  const worlds=await zhimuApi.getWorldCatalog();
  const err=worldStore.get().cloudCatalogError;
  if(err)return `<div class="empty-state">公开库加载失败：${escapeHtml(err)}</div>`;
  return worlds.map(world=>`<article class="world-library-card"><div><span class="cloud-pill">公开</span><span class="status-chip testing">${world.role_count||0} 个角色席</span><h3>${escapeHtml(world.name)}</h3><p>${escapeHtml(world.summary||"尚未补充剧本简介")}</p><small>创作者：${escapeHtml(world.owner_display_name||"未知")}</small></div><div class="row"><button class="primary-btn" data-action="catalog-join" data-world-id="${world.id}">开始体验</button></div></article>`).join("")||`<div class="empty-state">暂无公开剧本。主创作者可在「世界设置」提交公开库审核申请。</div>`;
 };
 const draw=async()=>{
  const list=modal.querySelector(".world-library-list");
  list.innerHTML=`<div class="empty-state">正在加载…</div>`;
  try{
   const danger=modal.querySelector("[data-world-library-danger]");
   if(activeTab==="catalog"){
    list.innerHTML=await drawCatalog();
    danger?.classList.add("hidden");
    danger&&(danger.innerHTML="");
   }else{
    const mine=await drawMine();
    list.innerHTML=mine.html;
    const current=mine.worlds?.find((w)=>w.id===zhimuApi.context.worldId);
    if(danger){
     if(current&&isWorldOwner(current.id)){
      danger.classList.remove("hidden");
      danger.innerHTML=`<button type="button" class="danger-btn full-btn" data-action="world-delete" data-world-id="${current.id}" data-world-name="${escapeHtml(current.name)}">删除当前剧本「${escapeHtml(current.name)}」</button><p class="muted-note">删除后不可恢复。若只想换剧本，可点上方「切换剧本」。</p>`;
     }else{
      danger.classList.add("hidden");
      danger.innerHTML="";
     }
    }
   }
   modal.querySelector("[data-close]").disabled=false;
   modal.querySelector("[data-open-create-world]").disabled=false;
   modal.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=()=>handle(btn.dataset.action,btn));
   danger?.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=()=>handle(btn.dataset.action,btn));
   modal.querySelector("[data-open-create-world]").onclick=()=>{closeModal();openWizard()};
  }catch(error){
   list.innerHTML=`<div class="empty-state">${escapeHtml(error.message)}</div>`;
   modal.querySelector("[data-close]").disabled=false;
   showError(error);
  }
 };
 modal.querySelector("#world-library-archived")?.addEventListener("change",draw);
 setTab(defaultTab);
 await draw();
}

export async function deleteWorld(worldId,worldName){
 if(!worldId)return showToast("未找到要删除的剧本");
 const isCurrent=worldId===zhimuApi.context.worldId;
 const intro=isCurrent?`<p>你正在删除<strong>当前正在使用的剧本</strong>。删除后界面会清空，可再从公开库体验或创建新世界。</p>`:`<p>将永久删除该剧本的角色、章节、平行房与规则数据，且不可恢复。</p>`;
 studioModal(`删除剧本「${worldName}」`,`${intro}<p class="muted-note">仅主创作者（owner）可删除自己创建的剧本。</p>`,"确认删除",async()=>{
  try{
   await zhimuApi.deleteWorld(worldId);
   closeModal();
   if(isCurrent)window.zhimuContext?.onCurrentWorldDeleted?.();
   await loadCloudData(true,true);
   showToast(`已删除「${worldName}」`);
   render();
   if(!isCurrent)openWorldLibrary();
  }catch(error){showError(error)}
 });
}

export async function selectWorld(worldId){
 if(!worldId)return showToast("未找到目标剧本");
 if(worldId===zhimuApi.context.worldId){closeModal();return showToast("已经是当前剧本")}
 window.zhimuContext?.prepareWorldSwitch?.(worldId);
 closeModal();
 studioStore.set({ cloudLoading: true });
 render();
 try{
  await loadCloudData(true,true);
  const name=studioStore.get().cloudStudio?.world?.name||(worldStore.get().cloudWorlds||[]).find((world)=>world.id===worldId)?.name||"新剧本";
  showToast(`已切换到「${name}」`);
 }catch(error){
  studioStore.set({ cloudLoading: false });
  userStore.set({ apiError: error.message||String(error) });
  render();
  showToast(error.message||"切换剧本失败");
 }
}

export async function openWorldRooms(){
 try{
  const rooms=await zhimuApi.getWorldRooms(),world=studioStore.get().cloudStudio?.world;
  const roomRows=rooms.map(room=>{
    const listingLabel=room.public_listing?`<span class="status-chip published">公开大厅</span>`:`<span class="status-chip draft">仅邀请码</span>`;
    const listingAction=room.public_listing
      ? `<button class="text-btn" data-action="room-listing-off" data-room-id="${room.id}">取消公开</button>`
      : `<button class="text-btn" data-action="room-listing-on" data-room-id="${room.id}">公开到大厅</button>`;
    const seatHint=room.role_slot_count!=null?` · ${room.role_slot_count} 个席位`:"";
    return `<article class="parallel-room-row ${room.id===zhimuApi.context.roomId?"active":""}"><div><div class="row" style="gap:8px;align-items:center"><h3>${escapeHtml(room.name)}</h3>${listingLabel}</div><p>邀请码：${escapeHtml(room.invite_code)} · ${room.member_count} 名玩家已选角${seatHint} · ${escapeHtml(room.status)}</p><p class="muted-note">${room.public_listing?"陌生人可在 play.getzhimu.com「找人一起玩」发现并入房。":"仅持有邀请码的玩家可加入，不会出现在公开大厅。"}</p></div><div class="row"><button class="secondary-btn" data-action="room-invite" data-room-id="${room.id}" data-room-name="${escapeHtml(room.name)}" data-invite-code="${escapeHtml(room.invite_code)}">邀请玩家</button>${listingAction}<button class="${room.id===zhimuApi.context.roomId?"secondary-btn":"primary-btn"}" data-action="room-select" data-room-id="${room.id}">${room.id===zhimuApi.context.roomId?"当前房间":"进入房间"}</button></div></article>`;
  }).join("");
  modal.className="modal world-library-modal";modal.innerHTML=`<h2>${escapeHtml(world?.name||"当前剧本")} · 平行房</h2><p class="wizard-intro">平行房彼此独立。<strong>仅邀请码</strong>适合熟人局；<strong>公开到大厅</strong>会出现在玩家端「找人一起玩」，方便陌生人在线凑局（与「公开剧本库」审核上架是两套机制）。</p><div class="parallel-room-create"><input class="field" data-room-name placeholder="例如：周末测试组 A"><label class="check-row"><input type="checkbox" data-room-public-listing> 创建后公开到玩家大厅</label><button class="primary-btn" data-action="room-create">＋ 开放新平行房</button></div><div class="parallel-room-list">${roomRows||`<div class="empty-state">尚未开放平行房。创建后会生成独立邀请码和公共讨论房。</div>`}</div><div class="modal-actions"><button class="secondary-btn" data-action="room-join">使用邀请码加入房间</button><button class="secondary-btn" data-close>关闭</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=()=>handle(btn.dataset.action,btn));
 }catch(error){showError(error)}
}

export async function createParallelRoom(){
 const input=modal.querySelector("[data-room-name]"),name=input.value.trim();if(!name)return showToast("请填写平行房名称");
 const publicListing=Boolean(modal.querySelector("[data-room-public-listing]")?.checked);
 try{const room=await zhimuApi.createRoom(zhimuApi.context.worldId,{name,inviteCode:`ROOM-${Date.now().toString(36).toUpperCase()}`,publicListing});zhimuApi.selectRoom(room.id);closeModal();await loadCloudData(true,true);showToast(publicListing?`平行房已开放并公开到大厅：${room.invite_code}`:`平行房已开放：${room.invite_code}`);openWorldRooms()}catch(error){showError(error)}
}

export async function setRoomPublicListing(roomId,publicListing){
 if(!roomId)return;
 try{
  await zhimuApi.updateRoomPublicListing(zhimuApi.context.worldId,roomId,publicListing);
  await loadCloudData(true,true);
  showToast(publicListing?"已公开到玩家大厅":"已改为仅邀请码入房");
  openWorldRooms();
 }catch(error){showError(error)}
}

export async function selectParallelRoom(roomId){
 let roomName="";
 try{roomName=(await zhimuApi.getWorldRooms()).find((room)=>room.id===roomId)?.name||""}catch{/* best-effort */}
 window.zhimuContext?.prepareRoomSwitch?.(roomId);closeModal();await loadCloudData(true,true);
 showToast(roomName?`已切换到「${roomName}」`:"已切换到独立平行房");
}

export function openCurrentRoomInvite(){
 const room=activeRuntimeRoom();
 if(!room?.invite_code)return showToast("请先选择运行房");
 openRoomInvite(room.id,room.invite_code,room.name);
}

export function openRoomInvite(roomId,inviteCode,roomName){
 const roles=studioStore.get().cloudStudio?.roles||[];
 const playUrl=window.zhimuInviteLinks?.playerJoinUrl?.(inviteCode)||`https://play.getzhimu.com/?join=${encodeURIComponent(inviteCode)}`;
 modal.className="modal";modal.innerHTML=`<h2>邀请玩家 · ${escapeHtml(roomName)}</h2><p class="wizard-intro">把<strong>邀请码</strong>或<strong>玩家链接</strong>发给参与者。玩家在 <a href="${escapeHtml(playUrl)}" target="_blank" rel="noopener">play.getzhimu.com</a> 输入码并选择角色席位即可入房。</p><div class="tutorial-tip"><b>房间邀请码</b><span class="invite-code">${escapeHtml(inviteCode)}</span></div><div class="tutorial-tip"><b>玩家链接</b><span class="invite-link">${escapeHtml(playUrl)}</span></div><div class="checklist">${roles.map(role=>check(escapeHtml(role.name),"玩家加入时选择这个角色席位")).join("")||`<div class="empty-state">当前剧本尚未建立角色席位。</div>`}</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="secondary-btn" data-copy-invite-code data-invite-code="${escapeHtml(inviteCode)}">复制邀请码</button><button class="secondary-btn" data-copy-play-link data-invite-code="${escapeHtml(inviteCode)}">复制玩家链接</button><button class="primary-btn" data-action="room-join" data-invite-code="${escapeHtml(inviteCode)}">自测加入</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-copy-invite-code]").onclick=()=>window.zhimuInviteLinks?.copyText?.(inviteCode,"邀请码");modal.querySelector("[data-copy-play-link]").onclick=()=>window.zhimuInviteLinks?.copyText?.(playUrl,"玩家链接");modal.querySelector("[data-action]").onclick=()=>openJoinRoom(inviteCode);
}

export function openJoinRoom(inviteCode=""){
 let invite=null;
 const draw=()=>{const roles=invite?.roles||[],boundRoleId=invite?.current_role_slot_id||"",available=boundRoleId?roles.filter(role=>role.id===boundRoleId):roles.filter(role=>!role.occupied||role.occupied_by_current);modal.className="modal";modal.innerHTML=`<h2>使用邀请码加入房间</h2><p class="wizard-intro">玩家只需要输入主持人发送的邀请码。系统会读取对应剧本的角色席位，再将玩家加入正确的独立平行房。</p><div class="form-group"><label>房间邀请码</label><div class="row"><input class="field" data-join-code value="${escapeHtml(inviteCode)}" placeholder="输入主持人发送的邀请码"><button class="secondary-btn" data-join-lookup>读取角色席位</button></div>${invite?`<div class="tutorial-tip"><b>${escapeHtml(invite.room.name)}</b><span>${escapeHtml(invite.world.name)} · ${boundRoleId?"你已绑定角色，仅可回到原席位":"选择你的角色后进入房间。"}</span></div>`:""}<label>选择角色席位</label><select class="field" data-join-role ${available.length?"":"disabled"}>${roles.map(role=>{const disabled=boundRoleId?role.id!==boundRoleId:role.occupied&&!role.occupied_by_current;return `<option value="${role.id}" ${disabled?"disabled":""}>${escapeHtml(role.name)}${boundRoleId&&role.id===boundRoleId?" · 你已绑定":role.occupied_by_current?" · 当前角色":role.occupied?" · 已被选择":""}</option>`}).join("")||`<option>请先读取角色席位</option>`}</select></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-join-submit ${available.length?"":"disabled"}>加入并进入玩家视角</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-join-lookup]").onclick=lookup;modal.querySelector("[data-join-submit]").onclick=submit;
 };
 const lookup=async()=>{const code=modal.querySelector("[data-join-code]").value.trim();if(!code)return showToast("请填写房间邀请码");try{await zhimuApi.ensurePlayerSession();inviteCode=code;invite=await zhimuApi.getRoomInvite(code);draw();showToast("已读取可选角色席位")}catch(error){showError(error)}};
 const submit=async()=>{const roleSlotId=modal.querySelector("[data-join-role]").value;if(!inviteCode||!roleSlotId)return showToast("请先读取角色席位");try{await zhimuApi.ensurePlayerSession();const result=await zhimuApi.joinRoom(inviteCode,roleSlotId);zhimuApi.selectWorld(invite.world.id);zhimuApi.selectRoom(result.roomId);closeModal();await loadCloudData(true,true);go("player");showToast("已加入房间，可以继续创建临时密谈")}catch(error){showError(error)}};
 draw();if(inviteCode)lookup();
}

export async function acceptWorldInviteFromUrl(token){
 if(!token)return;
 const finish=async()=>{
  try{
   await zhimuApi.acceptWorldInvite(token);
   showToast("协作邀请已接受");
   await loadCloudData(true,true);
   render();
  }catch(error){
   window.zhimuUserMessages?.handleApiErrorToast?.(error, showToast) || showError(error);
  }
 };
 if(!window.zhimuSessionAuth?.isAuthenticated?.()){
  sessionStorage.setItem("zhimuPendingInviteToken", token);
  showToast("请先登录以接受协作邀请");
  openAuthForm();
  return;
 }
 await finish();
}

export function drainPendingInviteAfterAuth(){
 const token=sessionStorage.getItem("zhimuPendingInviteToken");
 if(!token||!window.zhimuSessionAuth?.isAuthenticated?.())return;
 sessionStorage.removeItem("zhimuPendingInviteToken");
 void acceptWorldInviteFromUrl(token);
}

async function finishOAuthSession(result){
 window.zhimuSessionAuth?.markAuthenticated?.();
 window.zhimuContext?.resetAccountContext?.();
 sessionStorage.removeItem("zhimuAuthPrompted");
 closeModal();
 await window.zhimuAuthSession?.syncProfile?.();
 window.zhimuAuthSession?.syncAuthBanner?.();
 showToast("OAuth 登录成功");
 await loadCloudData(true,true);
 drainPendingInviteAfterAuth();
 render();
 if(!zhimuApi.context.worldId){
  const hasWorlds=(worldStore.get().cloudWorlds||[]).length>0;
  setTimeout(()=>hasWorlds?openWorldLibrary("mine"):openWorldLibrary("catalog"),400);
 }
}

function clearStartupSearchParams(keys){
 const params=new URLSearchParams(window.location.search);
 keys.forEach((key)=>params.delete(key));
 const qs=params.toString();
 window.history.replaceState({},"",`${window.location.pathname}${window.location.hash||""}${qs?`?${qs}`:""}`);
}

export function handleStartupAuthParams(){
 const params=new URLSearchParams(window.location.search);
 const resetToken=params.get("reset");
 const verifyToken=params.get("verify");
 const oauthCode=params.get("oauth_code");
 const oauthError=params.get("oauth_error");
 const inviteToken=params.get("invite");
 const authMode=params.get("auth");
 if(!resetToken&&!verifyToken&&!oauthCode&&!oauthError&&!inviteToken&&!authMode)return;
 const pending=[];
 if(resetToken){
  clearStartupSearchParams(["reset"]);
  openResetPassword(resetToken);
 }
 if(verifyToken){
  clearStartupSearchParams(["verify"]);
  pending.push((async()=>{await openVerifyEmail(verifyToken)})());
 }
 if(oauthError){
  clearStartupSearchParams(["oauth_error"]);
  const friendly=window.zhimuUserMessages?.friendlyApiError?.({ code: oauthError, error: oauthError }, oauthError);
  showToast(friendly||`OAuth 登录失败：${oauthError}`);
 }
 if(authMode==="login"||authMode==="register"){
  clearStartupSearchParams(["auth"]);
  setTimeout(()=>openAuth(),300);
 }
 if(inviteToken){
  clearStartupSearchParams(["invite"]);
  acceptWorldInviteFromUrl(inviteToken);
 }
 if(oauthCode){
  pending.push((async()=>{
   try{
    const result=await zhimuApi.completeOAuth(oauthCode);
    clearStartupSearchParams(["oauth_code"]);
    await finishOAuthSession(result);
   }catch(error){
    clearStartupSearchParams(["oauth_code"]);
    showToast(error.message||"OAuth 登录失败");
   }
  })());
 }
 if(pending.length)return Promise.all(pending);
}
// Bridge: window.zhimuRuntime populated from real exports.
// Will be removed in Phase 4 when consumers migrate to direct imports.
window.zhimuRuntime = Object.assign(window.zhimuRuntime || {}, { openAuth, openAccountPanel, openAuthForm, openForgotPassword, openResetPassword, openVerifyEmail, openVerifyPending, openWorldLibrary, openRenameWorldModal, joinCatalogWorld, selectWorld, deleteWorld, openWorldRooms, createParallelRoom, setRoomPublicListing, selectParallelRoom, openRoomInvite, openCurrentRoomInvite, openJoinRoom, acceptWorldInviteFromUrl, drainPendingInviteAfterAuth, handleStartupAuthParams });
