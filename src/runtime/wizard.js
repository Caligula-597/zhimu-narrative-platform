/* Auto-split from app.js — wizard.js */
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
  const go = R.go || (() => {});
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  const bindDynamic = R.bindDynamic || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
  window.zhimuViews = window.zhimuViews || {};
  const wizardSteps = ["创建方式","角色与席位","章节与内容","自动化规则","测试并发布"];

function openWizard(step=0){
  state.wizardStep=Math.max(0,Math.min(step,wizardSteps.length-1));
  modal.className="modal wizard-modal";
  modal.innerHTML=`<div class="wizard-shell"><aside class="wizard-side"><p class="eyebrow">CREATOR GUIDE</p><h2>创建你的世界</h2><p>用一套标准流程，把已有剧本整理成可以自动运行的线上房间。</p><div class="wizard-steps">${wizardSteps.map((s,i)=>`<div class="wizard-step ${i===state.wizardStep?"active":i<state.wizardStep?"done":""}"><i>${i<state.wizardStep?"✓":i+1}</i><span>${s}</span></div>`).join("")}</div></aside><main class="wizard-main">${wizardContent(state.wizardStep)}${state.wizardRoleEditor?"":`<footer class="wizard-footer"><span>第 ${state.wizardStep+1} 步，共 ${wizardSteps.length} 步</span><div class="wizard-actions">${state.wizardStep?`<button class="secondary-btn" data-wizard-back>上一步</button>`:`<button class="secondary-btn" data-wizard-close>暂时退出</button>`}<button class="primary-btn" data-wizard-next>${state.wizardStep===wizardSteps.length-1?"创建测试房间":"保存并继续"}</button></div></footer>`}</main></div>`;
  modalBackdrop.classList.add("show");
  modal.querySelector("[data-wizard-next]")?.addEventListener("click",()=>{collectWizardDraft();return state.wizardStep===wizardSteps.length-1?finishWizard():openWizard(state.wizardStep+1)});
  modal.querySelector("[data-wizard-back]")?.addEventListener("click",()=>{collectWizardDraft();openWizard(state.wizardStep-1)});
  modal.querySelector("[data-wizard-close]")?.addEventListener("click",closeModal);
  modal.querySelectorAll("[data-wizard-choice]").forEach(button=>button.addEventListener("click",()=>{
    collectWizardDraft();
    state.wizardDraft[button.dataset.wizardChoice]=button.dataset.choiceValue;
    state.wizardRoleEditor=null;
    openWizard(state.wizardStep);
  }));
  modal.querySelectorAll("[data-automation-template]").forEach(button=>button.addEventListener("click",()=>{
    const key=button.dataset.automationTemplate;
    state.wizardDraft.automationTemplates[key]=!state.wizardDraft.automationTemplates[key];
    openWizard(3);
  }));
  modal.querySelectorAll("[data-role-edit]").forEach(button=>button.addEventListener("click",()=>openRoleEditor(Number(button.dataset.roleEdit))));
  modal.querySelector("[data-role-add]")?.addEventListener("click",()=>openRoleEditor(-1));
  modal.querySelector("[data-role-save]")?.addEventListener("click",saveRoleEditor);
  modal.querySelector("[data-role-cancel]")?.addEventListener("click",()=>{state.wizardRoleEditor=null;openWizard(1)});
  modal.querySelector("[data-role-delete]")?.addEventListener("click",deleteRoleEditor);
  modal.querySelector("[data-role-document]")?.addEventListener("change",importRoleDocument);
}

function wizardContent(step){
 const pages=[
 `<p class="section-kicker">STEP 01 · START</p><h2>先决定这个世界如何运行</h2><p class="wizard-intro">不需要一次填完所有内容。向导会先搭起房间骨架，你可以随时回到创作台继续完善。</p><div class="choice-grid">${choice("◇","剧本杀房间","角色剧本、搜证轮次和集中复盘","worldMode","scripted")}${choice("⌘","跑团房间","开放探索、状态变化和骰点流程","worldMode","campaign")}${choice("∞","混合长线房间","用自动化连接章节与开放探索","worldMode","hybrid")}</div><div class="tutorial-tip"><b>建议</b><span>第一次创建时选择混合长线房间也没问题。每个事件都可以单独设置自动、主持确认或手动推进。</span></div>`,
 roleStepContent(),
 contentStepContent(),
 automationStepContent(),
 `<p class="section-kicker">STEP 05 · TEST ROOM</p><h2>创建测试房间，先自己跑一遍</h2><p class="wizard-intro">发布前使用不同玩家视角检查专属剧情、线索权限和自动规则。测试房间中的操作不会影响正式存档。</p><div class="checklist">${check("角色席位与私人序章",`将写入 ${currentRoles().length} 个席位与 ${currentRoles().length} 段私人剧情`)}${check("起始章节","将写入 1 个序章")}${check("自动化规则","创建后在创作台按需配置")}${check("语音空间","将自动建立公共讨论房")}</div><div class="tutorial-tip"><b>下一步</b><span>创建测试房间后，你会进入创作台。可以继续补充角色、场景、调查点和关键规则，再邀请协作主持人或切换玩家视角检查体验。</span></div>`
 ];
 return `${wizardForm(step)}${pages[step]}`;
}

function wizardForm(step){
 const d=state.wizardDraft;
 if(step===0)return `<div class="form-group"><label>世界名称</label><input class="field" data-draft="worldName" value="${d.worldName}"><label>一句话简介</label><input class="field" data-draft="summary" value="${d.summary}"></div>`;
 if(step===2){
  const content=currentContent(), labels=contentModeMeta();
  return `<div class="form-group"><label>${labels[0]}</label><input class="field" data-content-field="chapterTitle" value="${content.chapterTitle}"><label>${labels[1]}</label><input class="field" data-content-field="sectionTitle" value="${content.sectionTitle}"><label>${labels[2]}</label><textarea class="field" rows="5" data-content-field="sectionBody">${content.sectionBody}</textarea></div>`;
 }
 if(step===4)return `<div class="tutorial-tip"><b>即将写入云端</b><span>系统将创建 1 个世界、${currentRoles().length} 个角色席位、1 个章节、${currentRoles().length} 段私人剧情和 1 个带公共语音空间的测试房间。之后可在创作台继续扩充。</span></div>`;
 return "";
}

function automationStepContent(){
 const templates=[
  ["reading","阅读完成后解锁下一幕","当玩家主动点击“我已读完”时","开放该角色下一段私人剧情","自动执行"],
  ["clue","核心线索满足后开放新场景","当指定线索已被获得或解读时","开放对应公共场景并记录日志","自动执行"],
  ["chapter","章节结束与终幕开启","当本章关键节点全部完成时","提交给主持人确认，再进入下一章","主持确认"],
  ["hint","卡关时发送弱提示","当玩家长时间没有获得新信息时","发送与当前位置有关的轻量提示","自动执行"]
 ];
 return `<p class="section-kicker">STEP 04 · AUTOMATION</p><h2>选择这个房间需要的自动推进模板</h2><p class="wizard-intro">自动化不是替主持人做决定，而是持续检测玩家状态。普通解锁交给系统，重要转折仍由主持人确认。点击卡片即可启用或关闭，创建后还能继续细化条件。</p><div class="automation-guide"><b>推荐做法</b><span>第一次创建剧本杀房间时，保留前三项即可。弱提示适合长线测试阶段，正式发布前再决定是否开启。</span></div><div class="automation-template-grid">${templates.map(([key,title,when,action,mode])=>automationTemplate(key,title,when,action,mode)).join("")}</div>`;
}

function automationTemplate(key,title,when,action,mode){
 const enabled=state.wizardDraft.automationTemplates[key];
 return `<button type="button" class="automation-template ${enabled?"enabled":""}" data-automation-template="${key}"><span class="template-switch">${enabled?"✓ 已启用":"＋ 点击启用"}</span><h3>${title}</h3><p><b>检测：</b>${when}</p><p><b>执行：</b>${action}</p><small>${mode}</small></button>`;
}

function collectWizardDraft(){
 modal.querySelectorAll("[data-draft]").forEach(input=>state.wizardDraft[input.dataset.draft]=input.value.trim());
 modal.querySelectorAll("[data-content-field]").forEach(input=>currentContent()[input.dataset.contentField]=input.value.trim());
}

function choice(icon,title,text,draftKey,value){return `<button type="button" class="choice ${state.wizardDraft[draftKey]===value?"selected":""}" data-wizard-choice="${draftKey}" data-choice-value="${value}"><span class="choice-icon">${icon}</span><strong>${title}</strong><p>${text}</p></button>`}

function currentRoles(){return state.wizardDraft.roleSets[state.wizardDraft.worldMode]}

function currentContent(){return state.wizardDraft.contentSets[state.wizardDraft.worldMode]}

function roleModeMeta(){
 const modes={
  scripted:["剧本杀席位模板","角色身份、秘密与个人任务会进入专属剧本。","个人任务","角色秘密"],
  campaign:["跑团角色模板","角色更偏向自由探索，席位用于区分能力方向与个人背景。","探索方向","背景钩子"],
  hybrid:["混合长线模板","角色既有私人剧本，也保留开放探索中的长期身份。","长期目标","隐藏支线"]
 };
 return modes[state.wizardDraft.worldMode];
}

function roleStepContent(){
 if(state.wizardRoleEditor)return roleEditorContent();
 const [title,intro]=roleModeMeta();
 return `<p class="section-kicker">STEP 02 · CAST</p><h2>${title}</h2><p class="wizard-intro">${intro}</p><div class="seat-grid">${currentRoles().map((role,index)=>seat(role,index)).join("")}<div class="seat"><div class="avatar">＋</div><div><strong>新增角色席位</strong><p>自定义身份 · 添加新角色</p></div><button type="button" data-role-add>添加</button></div></div><div class="tutorial-tip"><b>权限提示</b><span>公共剧情、角色私密剧情和主持人秘密会严格分开。发布前可以用玩家视角逐一检查。</span></div>`;
}

function contentModeMeta(){
 const modes={
  scripted:["首章名称","角色序章标题","角色序章正文"],
  campaign:["首场冒险名称","开场钩子名称","开放探索引导"],
  hybrid:["首个阶段名称","个人节点标题","阶段私人剧情"]
 };
 return modes[state.wizardDraft.worldMode];
}

function contentStepContent(){
 const modeCopy={
  scripted:["整理已有剧本，再拆分成章节","先导入剧本内容，再把公开剧情、角色私密段落和搜证轮次分开。"],
  campaign:["建立第一场冒险与开放探索钩子","先明确冒险开场，再补充可探索场景、状态变化、道具与骰点节点。"],
  hybrid:["连接私人剧情与开放探索阶段","先建立阶段节点，再把角色专属内容与公共探索场景连接起来。"]
 }[state.wizardDraft.worldMode];
 const sourceCopy={
  document:"从已有文档开始，后续可继续拆分内容。",
  template:"使用当前模式的标准骨架，适合第一次建立世界。",
  blank:"只保留必要字段，后续完全自由扩展。"
 }[state.wizardDraft.contentSource];
 const scriptDocuments=state.wizardDraft.worldMode==="scripted"?`<div class="checklist">${currentRoles().map(role=>check(`${role.name} · 专属剧本`,role.scriptFilename?`已导入 ${role.scriptFilename}`:"尚未导入，可返回角色席位逐一上传")).join("")}</div>`:"";
 return `<p class="section-kicker">STEP 03 · CONTENT</p><h2>${modeCopy[0]}</h2><p class="wizard-intro">${modeCopy[1]}</p><div class="choice-grid">${choice("▤","导入剧情文档","从 Markdown 或 TXT 文档开始","contentSource","document")}${choice("◇","使用标准模板","从当前模式的标准骨架开始","contentSource","template")}${choice("＋","从空白世界开始","完全自由地创建内容","contentSource","blank")}</div><div class="tutorial-tip"><b>当前方案</b><span>${sourceCopy}</span></div>${scriptDocuments}`;
}

function seat(role,index){return `<div class="seat"><div class="avatar">${role.name[0]||"角"}</div><div><strong>${role.name}</strong><p>${role.goal} · 已配置私人序章</p></div><button type="button" data-role-edit="${index}">编辑</button></div>`}

function openRoleEditor(index){
 const source=index<0?{name:"新角色",goal:"待补充",publicProfile:"",privateProfile:""}:currentRoles()[index];
 state.wizardRoleEditor={index,role:{...source}};openWizard(1);
}

function roleEditorContent(){
 const editor=state.wizardRoleEditor, role=editor.role, [,intro,goalLabel,secretLabel]=roleModeMeta();
 const scriptedDocument=state.wizardDraft.worldMode==="scripted"?`<label>该角色的专属剧本文档</label><input class="field" type="file" accept=".txt,.md,text/plain,text/markdown" data-role-document><div class="tutorial-tip"><b>${role.scriptFilename||"尚未导入文档"}</b><span>支持 TXT 与 Markdown。导入后仍可在下方继续修订角色正文。</span></div><label>角色剧本正文</label><textarea class="field" rows="7" data-role-field="scriptBody">${role.scriptBody||""}</textarea>`:"";
 return `<p class="section-kicker">STEP 02 · ROLE EDITOR</p><h2>${editor.index<0?"新增角色席位":`编辑「${role.name}」`}</h2><p class="wizard-intro">${intro}</p><div class="form-group"><label>角色名称</label><input class="field" data-role-field="name" value="${role.name}"><label>${goalLabel}</label><input class="field" data-role-field="goal" value="${role.goal}"><label>公开身份</label><textarea class="field" data-role-field="publicProfile">${role.publicProfile}</textarea><label>${secretLabel}</label><textarea class="field" data-role-field="privateProfile">${role.privateProfile}</textarea>${scriptedDocument}</div><div class="modal-actions">${editor.index>=0?`<button class="secondary-btn" type="button" data-role-delete>删除席位</button>`:""}<button class="secondary-btn" type="button" data-role-cancel>取消</button><button class="primary-btn" type="button" data-role-save>保存席位</button></div>`;
}

async function importRoleDocument(event){
 const file=event.target.files[0];if(!file)return;
 if(!/\.(txt|md)$/i.test(file.name))return showToast("当前支持 TXT 或 Markdown 剧本文档");
 state.wizardRoleEditor.role.scriptFilename=file.name;
 state.wizardRoleEditor.role.scriptBody=await file.text();
 openWizard(1);showToast("角色剧本文档已导入");
}

function saveRoleEditor(){
 const editor=state.wizardRoleEditor;
 modal.querySelectorAll("[data-role-field]").forEach(input=>editor.role[input.dataset.roleField]=input.value.trim());
 if(!editor.role.name)return showToast("请填写角色名称");
 if(editor.index<0)currentRoles().push(editor.role);else currentRoles()[editor.index]=editor.role;
 state.wizardRoleEditor=null;openWizard(1);showToast("角色席位已保存");
}

function deleteRoleEditor(){
 if(currentRoles().length<=1)return showToast("至少需要保留一个角色席位");
 currentRoles().splice(state.wizardRoleEditor.index,1);state.wizardRoleEditor=null;openWizard(1);showToast("角色席位已删除");
}

async function finishWizard(){
 const button=modal.querySelector("[data-wizard-next]");button.disabled=true;button.textContent="正在写入云端...";
 try{
  const d=state.wizardDraft;
  const content=currentContent();
  const world=await zhimuApi.createWorld({name:d.worldName,summary:d.summary,settings:{worldMode:d.worldMode,contentSource:d.contentSource,automationTemplates:d.automationTemplates}});
  const chapter=await zhimuApi.createChapter(world.id,{title:content.chapterTitle,summary:d.summary,sequence:1});
  for(const [index,roleDraft] of currentRoles().entries()){
   const role=await zhimuApi.createRole(world.id,{name:roleDraft.name,publicProfile:roleDraft.publicProfile,privateProfile:roleDraft.privateProfile,sequence:index+1});
   await zhimuApi.createSection(world.id,role.id,{chapterId:chapter.id,title:content.sectionTitle,body:roleDraft.scriptBody||`${roleDraft.privateProfile}\n\n${content.sectionBody}`,sequence:1});
  }
  const inviteCode=`TEST-${Date.now().toString(36).toUpperCase()}`;
  const room=await zhimuApi.createRoom(world.id,{name:`${d.worldName} · 测试房`,inviteCode});
  closeModal();go("studio");
  openModal("测试房间已创建",`世界、角色、章节和序章已经真实写入云端。<br><br><strong>邀请码：${inviteCode}</strong><br><small>房间 ID：${room.id}</small>`,"开始继续编排");
 }catch(error){button.disabled=false;button.textContent="重新创建测试房间";showToast(error.message)}
}
  window.zhimuRuntime = Object.assign(window.zhimuRuntime || {}, { openWizard, finishWizard });
})(window);
