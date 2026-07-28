/* Auto-split from app.js — auth-world.js */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { content, toast, modal, modalBackdrop } from "../dom.js";
import { uiStore, userStore, worldStore, studioStore } from "../state/index.js";
import { callRuntime, go, loadCloudData, registerRuntime, render } from "./runtime-facade.js";
import * as F from "../utils/format.js";
import * as M from "../components/modal.js";
import * as U from "../components/emptyState.js";
import { normalizeError } from "../components/status-ui.js";
import { setHtml } from "../../shared/safe-dom.js";
import { handleApiErrorToast, friendlyApiError } from "../utils/user-messages.js";
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
  const showError = (error, fallback = "操作失败，请稍后重试") => showToast(normalizeError(error, fallback));
  const closeModal = M.closeModal || (() => {});
  const openModal = M.openModal || (() => {});
  const studioModal = M.studioModal || (() => {});
  const studioField = M.studioField || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioSelect = M.studioSelect || (() => "");
  function handle(action, el) { return callRuntime("handle", action, el); }
  const openWizard = () => callRuntime("openWizard");
export function openForgotPassword(prefillEmail=""){
 modal.className="modal auth-modal";
 setHtml(modal, `<h2>找回密码</h2><p class="wizard-intro">输入注册邮箱，我们会发送重置链接（1 小时内有效）。</p>${studioField("邮箱","forgotEmail","input",prefillEmail)}<div class="modal-actions"><button class="secondary-btn" data-auth-back-login>返回登录</button><button class="primary-btn" data-auth-forgot-submit>发送重置邮件</button></div>`);
 modalBackdrop.classList.add("show");
 modal.querySelector("[data-auth-back-login]").onclick=()=>openAuth();
 modal.querySelector("[data-auth-forgot-submit]").onclick=async()=>{try{const email=modal.querySelector('[data-studio-field="forgotEmail"]').value.trim();if(!email)return showToast("请填写邮箱");await zhimuApi.requestPasswordReset({email});closeModal();showToast("若该邮箱已注册，请查收重置邮件（含垃圾箱）")}catch(error){showError(error)}};
 modal.querySelector("[data-close]")?.remove();
}

async function finishAuthenticatedEntry(label){
 if(!window.zhimuSessionAuth?.isAuthenticated?.()){
  window.zhimuSessionAuth?.markAuthenticated?.();
 }
 window.zhimuContext?.resetAccountContext?.();
 sessionStorage.removeItem("zhimuAuthPrompted");
 closeModal();
 showToast(label);
 const profileResult=await window.zhimuAuthSession?.syncProfile?.({force:true});
 window.zhimuAuthSession?.syncAuthBanner?.();
 if(profileResult?.error){
  showToast("登录已完成，但账户信息暂时未加载，请刷新页面重试");
  render();
  return;
 }
 try{await loadCloudData(false,true)}catch{
  showToast("登录已完成，但工作区暂时未加载，请刷新页面重试");
 }
 render();
 callRuntime("drainPendingInviteAfterAuth");
 if(!zhimuApi.context.worldId){
  const hasWorlds=(worldStore.get().cloudWorlds||[]).length>0;
  setTimeout(()=>hasWorlds?openWorldLibrary("mine"):openWorldLibrary("catalog"),400);
 }
}

async function finishEmailVerification(label="邮箱已验证，已自动登录"){
 await finishAuthenticatedEntry(label);
}

function armVerificationResend(button, seconds=0,readyLabel="重新发送验证码"){
 if(!button)return;
 const readyAt=Date.now()+Math.max(0,Number(seconds)||0)*1000;
 const update=()=>{
  const remaining=Math.max(0,Math.ceil((readyAt-Date.now())/1000));
  button.disabled=remaining>0;
  button.textContent=remaining>0?`${remaining} 秒后可重发`:readyLabel;
  if(!remaining)clearInterval(timer);
 };
 const timer=setInterval(update,1000);
 update();
}

export function openVerifyPending(prefillEmail="",verificationEmailSent=true,initialChallenge=null){
 let challenge=initialChallenge;
 const renderVerification=()=>{
   const masked=challenge?.maskedEmail||prefillEmail||"你的邮箱";
   const deliveryCopy=challenge?.id&&verificationEmailSent
    ? `6 位邮箱验证码已发送至 ${escapeHtml(masked)}。`
    : `当前没有可用的验证码，请点击“发送新验证码”。`;
   modal.className="modal auth-modal";
   setHtml(modal, `<h2>验证你的邮箱</h2><p class="wizard-intro">${deliveryCopy} 验证码 10 分钟内有效，请同时检查垃圾箱。</p><div class="form-group verification-code-group"><label for="creator-verification-code">邮箱验证码</label><input id="creator-verification-code" class="field verification-code-input" data-auth-verification-code type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="请输入邮件中的 6 位验证码" aria-label="6 位邮箱验证码" /></div><p class="muted-note">也可以点击邮件中的“一键验证并登录”链接。邮箱验证码、内测邀请码和房间邀请码互不通用。</p><div class="verification-code-actions"><button class="text-btn" type="button" data-auth-resend-code>${challenge?.id?"重新发送验证码":"发送新验证码"}</button><button class="text-btn" type="button" data-auth-change-email>更换邮箱 / 返回登录</button></div><div class="modal-actions"><button class="secondary-btn" data-close>稍后验证</button><button class="primary-btn" data-auth-verify-code ${challenge?.id?"":"disabled"}>验证并进入织幕</button></div>`);
  modalBackdrop.classList.add("show");
  const input=modal.querySelector("[data-auth-verification-code]");
  input?.focus();
  input?.addEventListener("input",()=>{input.value=input.value.replace(/\D/g,"").slice(0,6)});
  modal.querySelector("[data-close]").onclick=closeModal;
  modal.querySelector("[data-auth-change-email]").onclick=()=>openAuthForm();
  const resend=modal.querySelector("[data-auth-resend-code]");
  armVerificationResend(resend,challenge?.resendAfterSeconds||0,challenge?.id?"重新发送验证码":"发送新验证码");
  resend.onclick=async()=>{try{const result=await zhimuApi.resendVerificationCode(challenge?.id?{challengeId:challenge.id}:{});challenge=result.verificationChallenge||challenge;verificationEmailSent=true;showToast("新的邮箱验证码已发送");renderVerification()}catch(error){showError(error)}};
  modal.querySelector("[data-auth-verify-code]").onclick=async()=>{const code=input?.value?.trim()||"";if(!/^\d{6}$/.test(code))return showToast("请输入 6 位邮箱验证码");try{const result=await zhimuApi.verifyEmailCode({challengeId:challenge.id,code});await finishEmailVerification("邮箱验证成功，已自动登录")}catch(error){showError(error)}};
 };
 renderVerification();
}

export async function openVerifyEmail(verifyToken){
 if(!verifyToken)return;
 sessionStorage.setItem("zhimuAuthPrompted","1");
 modal.className="modal auth-modal";
 setHtml(modal, `<h2>正在验证邮箱…</h2><p class="wizard-intro">请稍候。</p>`);
 modalBackdrop.classList.add("show");
 try{
  await zhimuApi.verifyEmail({token:verifyToken});
  await finishEmailVerification();
 }catch(error){
  setHtml(modal, `<h2>验证失败</h2><p class="wizard-intro">${escapeHtml(error.message||"链接无效或已过期")}</p><p class="muted-note">你仍可使用邮箱和密码登录，然后点击“已有验证码？验证邮箱”。</p><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="primary-btn" data-auth-open-login>去登录并输入验证码</button></div>`);
  modal.querySelector("[data-close]").onclick=closeModal;
  modal.querySelector("[data-auth-open-login]").onclick=()=>openAuthForm();
 }
}

export function openResetPassword(resetToken){
 if(!resetToken)return;
 modal.className="modal auth-modal";
 setHtml(modal, `<h2>设置新密码</h2><p class="wizard-intro">请为账号设置新的登录密码（至少 8 位）。设置成功后需重新登录。</p>${studioField("新密码 · 至少 8 位","resetPassword","input","")}${studioField("确认新密码","resetPasswordConfirm","input","")}<div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-auth-reset-submit>更新密码</button></div>`);
 modalBackdrop.classList.add("show");
 modal.querySelectorAll('[data-studio-field$="Password"],[data-studio-field$="Confirm"]').forEach(input=>input.type="password");
 modal.querySelector("[data-close]").onclick=closeModal;
 modal.querySelector("[data-auth-reset-submit]").onclick=async()=>{try{const password=modal.querySelector('[data-studio-field="resetPassword"]').value;const confirm=modal.querySelector('[data-studio-field="resetPasswordConfirm"]').value;if(password.length<8)return showToast("密码至少 8 位");if(password!==confirm)return showToast("两次输入的密码不一致");await zhimuApi.resetPassword({token:resetToken,password});closeModal();window.zhimuSessionAuth?.markLoggedOut?.();showToast("密码已更新，请使用新密码登录");openAuth()}catch(error){showError(error)}};
}

export function openAuth(){
 const loggedIn=Boolean(window.zhimuSessionAuth?.isAuthenticated?.());
 if(loggedIn){go("account");return}
 openAuthForm();
}

export async function openAccountPanel(){
 go("account");
}

export function openAuthForm(){
 const requireAuth=Boolean(window.zhimuConfig?.requireAuth);
 const guestIntro="注册或登录后，可创建剧本、邀请协作者并保存运行数据。";
 modal.className="modal auth-modal";
 setHtml(modal, `<h2>注册或登录</h2><p class="wizard-intro">${guestIntro}</p><div data-oauth-bar class="row" style="margin-bottom:12px"></div><div class="auth-grid"><div class="form-group"><h3>注册</h3>${studioField("昵称","registerName","input","")}${studioField("邮箱","registerEmail","input","")}${studioField("密码 · 至少 8 位","registerPassword","input","")}<p class="muted-note">注册后会收到织幕发送的 6 位邮箱验证码；输入后即可自动登录，也可使用邮件内的一键验证链接。</p><p class="muted-note auth-legal-note">注册即表示你已阅读并同意 <a href="#" data-legal-doc="legal/USER_TERMS_ZH.md" data-legal-title="用户协议">用户协议</a> 与 <a href="#" data-legal-doc="legal/PRIVACY_ZH.md" data-legal-title="隐私政策">隐私政策</a>。</p><button class="primary-btn" data-auth-register>创建账号并发送验证码</button></div><div class="form-group"><h3>登录</h3>${studioField("邮箱","loginEmail","input","")}${studioField("密码","loginPassword","input","")}<button class="secondary-btn" data-auth-login>登录</button><button type="button" class="text-btn" data-auth-verify-entry style="margin-top:8px">已有验证码？验证邮箱</button><button type="button" class="text-btn" data-auth-forgot style="margin-top:8px">忘记密码？</button><p class="muted-note">如果账号尚未验证，登录后会直接显示 6 位验证码输入框。</p><p class="muted-note auth-legal-note"><a href="#" data-legal-doc="legal/USER_TERMS_ZH.md" data-legal-title="用户协议">用户协议</a> · <a href="#" data-legal-doc="legal/PRIVACY_ZH.md" data-legal-title="隐私政策">隐私政策</a></p></div></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`);
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelectorAll('[data-studio-field$="Password"]').forEach(input=>input.type="password");
 const loginAndContinue=async(verificationOnly=false)=>{try{const email=modal.querySelector('[data-studio-field="loginEmail"]').value.trim();const password=modal.querySelector('[data-studio-field="loginPassword"]').value;if(!email||!password)return showToast("请先填写登录邮箱和密码");const result=await zhimuApi.login({email,password});if(result.pendingEmailVerification){showToast(result.verificationChallenge?"请输入邮件中的 6 位验证码":"请先发送新的邮箱验证码");openVerifyPending(email,Boolean(result.verificationChallenge),result.verificationChallenge);return}await finishAuthenticatedEntry(verificationOnly?"邮箱已验证，登录成功":"登录成功")}catch(error){showError(error)}};
 modal.querySelector("[data-auth-register]").onclick=async()=>{try{const email=modal.querySelector('[data-studio-field="registerEmail"]').value.trim();const result=await zhimuApi.register({displayName:modal.querySelector('[data-studio-field="registerName"]').value,email,password:modal.querySelector('[data-studio-field="registerPassword"]').value});if(result.pendingEmailVerification){showToast(result.verificationEmailSent?"验证码已发送":"账号已创建，可尝试重新发送验证码");openVerifyPending(email,result.verificationEmailSent,result.verificationChallenge);return}await finishAuthenticatedEntry("注册成功，已经登录")}catch(error){showError(error)}};
 modal.querySelector("[data-auth-login]").onclick=()=>loginAndContinue(false);
 modal.querySelector("[data-auth-verify-entry]").onclick=()=>loginAndContinue(true);
 modal.querySelector("[data-auth-forgot]")?.addEventListener("click",()=>openForgotPassword(modal.querySelector('[data-studio-field="loginEmail"]')?.value||""));
 modal.querySelectorAll("[data-legal-doc]").forEach((link)=>{link.addEventListener("click",(event)=>{event.preventDefault();window.zhimuGuide?.openLegalDoc?.(link.dataset.legalDoc,link.dataset.legalTitle||"法律文档")})});
 (async()=>{try{const config=await zhimuApi.getAuthConfig();const bar=modal.querySelector("[data-oauth-bar]");if(!bar||!config.oauth?.length)return;setHtml(bar, config.oauth.map(p=>`<button class="secondary-btn" data-oauth-start="${p.id}">${escapeHtml(p.label)} 登录</button>`).join(""));bar.querySelectorAll("[data-oauth-start]").forEach(btn=>btn.onclick=async()=>{try{const {url}=await zhimuApi.oauthStartUrl(btn.dataset.oauthStart);window.location.href=url}catch(error){showError(error)}})}catch{}})();
}

function applyWorldRename(worldId,name,summary){
 const cloudStudio = studioStore.get().cloudStudio;
 if(cloudStudio?.world?.id===worldId){
  studioStore.set({ cloudStudio: {...cloudStudio, world: {...cloudStudio.world, name, summary}} });
 }
 const preview=worldStore.get().cloudWorkspacePreview;
 if(preview?.world?.id===worldId){
  worldStore.set({cloudWorkspacePreview:{...preview,world:{...preview.world,name,summary}}});
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
 setHtml(modal, `<h2>重命名剧本</h2><p class="wizard-intro">名称与简介会显示在侧栏、总览与玩家入口。</p><div class="form-group">${studioField("剧本名称","renameWorldName","input",worldName)}<label>剧本简介</label><textarea class="field" data-studio-field="renameWorldSummary" rows="3">${escapeHtml(worldSummary)}</textarea></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-rename-world-submit>保存</button></div>`);
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
  const roles=worldStore.get().cloudWorkspacePreview?.roles?.length||0;
  const sections=worldStore.get().cloudWorkspacePreview?.sections?.length||0;
  if(!roles){
   showToast("已加入剧本，但正文尚未加载完成，请稍后刷新");
  }else{
   showToast(`已加入「${result.worldName}」：${roles} 个角色、${sections} 段分幕。邀请码 ${result.room.invite_code}`);
  }
  go(uiStore.get().view==="writer"||uiStore.get().view==="studio"?uiStore.get().view:"creatorCockpit");
 }catch(error){showError(error)}
}

export async function openWorldLibrary(defaultTab="mine"){
 modal.className="modal world-library-modal";
 setHtml(modal, `<h2>选择剧本</h2><p class="wizard-intro">「我的剧本」是你创建或被邀请协作的世界；「公开剧本库」可体验主创作者已发布的完整剧本（每人一个自己的运行房，不会重复创建）。</p><div class="world-library-tabs"><button type="button" class="secondary-btn" data-library-tab="mine">我的剧本</button><button type="button" class="secondary-btn" data-library-tab="catalog">公开剧本库</button></div><div data-library-panel="mine"><label class="check-label" style="margin-bottom:12px"><input type="checkbox" id="world-library-archived"><span>显示已归档剧本</span></label></div><div data-library-panel="catalog" class="hidden" data-catalog-filters></div><div class="world-library-list"><div class="empty-state">正在加载…</div></div><div class="world-library-danger hidden" data-world-library-danger></div><div class="modal-actions"><button class="secondary-btn" data-close disabled>关闭</button><button class="primary-btn" data-open-create-world disabled>＋ 创建新世界</button></div>`);
 modalBackdrop.classList.add("show");
 modal.querySelector("[data-close]").onclick=closeModal;
 let activeTab=defaultTab;
 const catalogTagFilters={};
 const setTab=tab=>{
  activeTab=tab;
  modal.querySelectorAll("[data-library-tab]").forEach(btn=>{btn.classList.toggle("primary-btn",btn.dataset.libraryTab===tab);btn.classList.toggle("secondary-btn",btn.dataset.libraryTab!==tab)});
  modal.querySelector("[data-library-panel='mine']")?.classList.toggle("hidden",tab!=="mine");
  modal.querySelector("[data-library-panel='catalog']")?.classList.toggle("hidden",tab!=="catalog");
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
  const qs=Object.entries(catalogTagFilters).filter(([,v])=>v).map(([k,v])=>`tag_${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const worlds=await zhimuApi.getWorldCatalog(qs);
  const err=worldStore.get().cloudCatalogError;
  if(err)return `<div class="empty-state">公开库加载失败：${escapeHtml(err)}</div>`;
  const tagBits=(world)=>Array.isArray(world.tags)&&world.tags.length?`<small>${world.tags.map((t)=>`${escapeHtml(t.tagKey||t.tag_key)}:${escapeHtml(t.tagValue||t.tag_value)}`).join(" · ")}</small>`:"";
  return worlds.map(world=>`<article class="world-library-card"><div><span class="cloud-pill">公开</span><span class="status-chip testing">${world.role_count||0} 个角色席</span><h3>${escapeHtml(world.name)}</h3><p>${escapeHtml(world.summary||"尚未补充剧本简介")}</p>${tagBits(world)}<small>创作者：${escapeHtml(world.owner_display_name||"未知")}</small></div><div class="row"><button class="primary-btn" data-action="catalog-join" data-world-id="${world.id}">开始体验</button></div></article>`).join("")||`<div class="empty-state">暂无符合筛选的公开剧本。主创作者可在「世界设置」提交公开库审核申请。</div>`;
 };
 const renderCatalogFilters=async()=>{
  const panel=modal.querySelector("[data-catalog-filters]");
  if(!panel)return;
  try{
   const payload=await zhimuApi.getCatalogTagFacets();
   const facets=payload?.facets||{};
   const keys=Object.keys(facets);
   if(!keys.length){setHtml(panel, "");return;}
   const chips=keys.flatMap((key)=>facets[key].map((row)=>{
    const active=catalogTagFilters[key]===row.value;
    return `<button type="button" class="${active?"primary-btn":"secondary-btn"}" style="margin:0 6px 6px 0" data-catalog-tag="${key}" data-catalog-value="${escapeHtml(row.value)}">${escapeHtml(key)}:${escapeHtml(row.value)} (${row.worldCount})</button>`;
   })).join("");
   setHtml(panel, `<p class="muted-note" style="margin:0 0 8px">按标签筛选（再点取消）</p><div class="row" style="flex-wrap:wrap">${chips}<button type="button" class="text-btn" data-catalog-clear>清除筛选</button></div>`);
   panel.querySelectorAll("[data-catalog-tag]").forEach((btn)=>{
    btn.onclick=()=>{
     const key=btn.dataset.catalogTag;
     const value=btn.dataset.catalogValue;
     if(catalogTagFilters[key]===value)delete catalogTagFilters[key];
     else catalogTagFilters[key]=value;
     draw();
    };
   });
   panel.querySelector("[data-catalog-clear]")?.addEventListener("click",()=>{Object.keys(catalogTagFilters).forEach((k)=>delete catalogTagFilters[k]);draw()});
  }catch(_){setHtml(panel, "");}
 };
 const draw=async()=>{
  const list=modal.querySelector(".world-library-list");
  setHtml(list, `<div class="empty-state">正在加载…</div>`);
  try{
   const danger=modal.querySelector("[data-world-library-danger]");
   if(activeTab==="catalog"){
    await renderCatalogFilters();
    setHtml(list, await drawCatalog());
    danger?.classList.add("hidden");
    danger&&(setHtml(danger, ""));
   }else{
    const mine=await drawMine();
    setHtml(list, mine.html);
    const current=mine.worlds?.find((w)=>w.id===zhimuApi.context.worldId);
    if(danger){
     if(current&&isWorldOwner(current.id)){
      danger.classList.remove("hidden");
      setHtml(danger, `<button type="button" class="danger-btn full-btn" data-action="world-delete" data-world-id="${current.id}" data-world-name="${escapeHtml(current.name)}">删除当前剧本「${escapeHtml(current.name)}」</button><p class="muted-note">删除后不可恢复。若只想换剧本，可点上方「切换剧本」。</p>`);
     }else{
      danger.classList.add("hidden");
      setHtml(danger, "");
     }
    }
   }
   modal.querySelector("[data-close]").disabled=false;
   modal.querySelector("[data-open-create-world]").disabled=false;
   modal.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=()=>handle(btn.dataset.action,btn));
   danger?.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=()=>handle(btn.dataset.action,btn));
   modal.querySelector("[data-open-create-world]").onclick=()=>{closeModal();openWizard()};
  }catch(error){
   setHtml(list, `<div class="empty-state">${escapeHtml(error.message)}</div>`);
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
  const name=studioStore.get().cloudStudio?.world?.name||worldStore.get().cloudWorkspacePreview?.world?.name||(worldStore.get().cloudWorlds||[]).find((world)=>world.id===worldId)?.name||"新剧本";
  showToast(`已切换到「${name}」`);
 }catch(error){
  studioStore.set({ cloudLoading: false });
  userStore.set({ apiError: error.message||String(error) });
  render();
  showToast(error.message||"切换剧本失败");
 }
}

export function openWorldRooms(){go("rooms")}

export function openCurrentRoomInvite(){
 const room=activeRuntimeRoom();
 if(!room?.invite_code)return showToast("请先选择运行房");
 openRoomInvite(room.id,room.invite_code,room.name);
}

export function openRoomInvite(roomId,inviteCode,roomName){
 const roles=studioStore.get().cloudStudio?.roles||worldStore.get().cloudWorkspacePreview?.roles||[];
 const playUrl=window.zhimuInviteLinks?.playerJoinUrl?.(inviteCode)||`https://play.getzhimu.com/?join=${encodeURIComponent(inviteCode)}`;
 modal.className="modal";setHtml(modal, `<h2>邀请玩家 · ${escapeHtml(roomName)}</h2><p class="wizard-intro">把<strong>邀请码</strong>或<strong>玩家链接</strong>发给参与者。玩家在 <a href="${escapeHtml(playUrl)}" target="_blank" rel="noopener">play.getzhimu.com</a> 输入码并选择角色席位即可入房。</p><div class="tutorial-tip"><b>房间邀请码</b><span class="invite-code">${escapeHtml(inviteCode)}</span></div><div class="tutorial-tip"><b>玩家链接</b><span class="invite-link">${escapeHtml(playUrl)}</span></div><div class="checklist">${roles.map(role=>check(escapeHtml(role.name),"玩家加入时选择这个角色席位")).join("")||`<div class="empty-state">当前剧本尚未建立角色席位。</div>`}</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="secondary-btn" data-copy-invite-code data-invite-code="${escapeHtml(inviteCode)}">复制邀请码</button><button class="secondary-btn" data-copy-play-link data-invite-code="${escapeHtml(inviteCode)}">复制玩家链接</button><button class="primary-btn" data-action="room-join" data-invite-code="${escapeHtml(inviteCode)}">自测加入</button></div>`);
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-copy-invite-code]").onclick=()=>window.zhimuInviteLinks?.copyText?.(inviteCode,"邀请码");modal.querySelector("[data-copy-play-link]").onclick=()=>window.zhimuInviteLinks?.copyText?.(playUrl,"玩家链接");modal.querySelector("[data-action]").onclick=()=>openJoinRoom(inviteCode);
}

export function openJoinRoom(inviteCode=""){
 let invite=null;
 const draw=()=>{const roles=invite?.roles||[],boundRoleId=invite?.current_role_slot_id||"",available=boundRoleId?roles.filter(role=>role.id===boundRoleId):roles.filter(role=>!role.occupied||role.occupied_by_current);modal.className="modal";setHtml(modal, `<h2>使用邀请码加入房间</h2><p class="wizard-intro">玩家只需要输入主持人发送的邀请码。系统会读取对应剧本的角色席位，再将玩家加入正确的独立平行房。</p><div class="form-group"><label>房间邀请码</label><div class="row"><input class="field" data-join-code value="${escapeHtml(inviteCode)}" placeholder="输入主持人发送的邀请码"><button class="secondary-btn" data-join-lookup>读取角色席位</button></div>${invite?`<div class="tutorial-tip"><b>${escapeHtml(invite.room.name)}</b><span>${escapeHtml(invite.world.name)} · ${boundRoleId?"你已绑定角色，仅可回到原席位":"选择你的角色后进入房间。"}</span></div>`:""}<label>选择角色席位</label><select class="field" data-join-role ${available.length?"":"disabled"}>${roles.map(role=>{const disabled=boundRoleId?role.id!==boundRoleId:role.occupied&&!role.occupied_by_current;return `<option value="${role.id}" ${disabled?"disabled":""}>${escapeHtml(role.name)}${boundRoleId&&role.id===boundRoleId?" · 你已绑定":role.occupied_by_current?" · 当前角色":role.occupied?" · 已被选择":""}</option>`}).join("")||`<option>请先读取角色席位</option>`}</select></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-join-submit ${available.length?"":"disabled"}>加入并进入玩家视角</button></div>`);
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
   handleApiErrorToast(error, showToast);
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
 window.history.replaceState({},"",`${window.location.pathname}${qs?`?${qs}`:""}${window.location.hash||""}`);
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
  pending.push(openVerifyEmail(verifyToken));
 }
 if(oauthError){
  clearStartupSearchParams(["oauth_error"]);
  const friendly=friendlyApiError({ code: oauthError, error: oauthError }, oauthError);
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
registerRuntime({ openAuth, openAccountPanel, openAuthForm, openForgotPassword, openResetPassword, openVerifyEmail, openVerifyPending, openWorldLibrary, openRenameWorldModal, joinCatalogWorld, selectWorld, deleteWorld, openWorldRooms, openRoomInvite, openCurrentRoomInvite, openJoinRoom, acceptWorldInviteFromUrl, drainPendingInviteAfterAuth, handleStartupAuthParams });
