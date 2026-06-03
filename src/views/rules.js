/* Auto-split from app.js — rules.js */
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
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
  window.zhimuViews = window.zhimuViews || {};
  const viewExports = window.zhimuViews.rules = window.zhimuViews.rules || {};
function rules() {
 const data=state.cloudRules||[],modeName={automatic:"自动执行",host_confirm:"主持确认",manual:"仅手动"};
 return `<section class="rules-layout"><div><div class="section-head"><div><h3>规则列表</h3><p>规则已经连接云端数据库。条件满足后，系统执行动作或提交主持人确认。</p></div><button class="primary-btn" data-action="rule-new">＋ 新建规则</button></div>
 ${data.map(rule=>{const summary=window.zhimuRuleVisual?.summarizeRule(rule.conditions,rule.actions)||{when:JSON.stringify(rule.conditions),then:JSON.stringify(rule.actions)};return `<article class="rule-card"><div class="rule-card-top"><button class="toggle ${rule.enabled?"on":""}" data-action="rule-toggle" data-rule="${rule.id}" title="启用或暂停规则"><i></i></button><h3>${rule.name}</h3><span class="mode ${rule.mode==="host_confirm"?"confirm":""}">${modeName[rule.mode]}</span></div><p class="rule-text"><b>当</b> ${escapeHtml(summary.when)}<br><b>则</b> ${escapeHtml(summary.then)}</p><div class="rule-stats"><span>● ${rule.enabled?"已启用":"已暂停"}</span><span>优先级 ${rule.priority}</span><span>${rule.room_name||"世界模板"}</span></div><div class="row rule-actions"><button class="text-btn" data-action="rule-edit" data-rule="${rule.id}">编辑</button><button class="text-btn danger-text" data-action="rule-delete" data-rule="${rule.id}">删除</button></div></article>`}).join("")||`<div class="empty-state">尚未建立自动化规则。先创建一条阅读完成或调查点完成规则。</div>`}</div>
 <aside class="card"><div class="section-head"><div><h3>自动化概览</h3><p>创作阶段规则检查</p></div></div>
 ${stat("⌘",String(data.length),"条云端规则","支持世界模板与测试房")}${stat("✓",String(data.filter(rule=>rule.enabled).length),"条已启用","暂停规则不会触发")}${stat("◷",String(data.filter(rule=>rule.mode==="host_confirm").length),"项主持确认","关键转折保留人工判断")}
 <button class="secondary-btn full-btn" data-action="rule-validate">运行规则检查</button></aside></section>`;
}

function rulePayload(rule={}){return {roomId:rule.room_id||"",name:rule.name||"",mode:rule.mode||"automatic",priority:String(rule.priority??100),enabled:rule.enabled!==false,conditions:JSON.stringify(rule.conditions||{all:[{type:"reading_completed",roleSlotId:"",scriptSectionId:""}]},null,2),actions:JSON.stringify(rule.actions||[{type:"unlock_script_section",scriptSectionId:""}],null,2)}}

function openRuleEditor(ruleId=""){
 const rule=state.cloudRules.find(item=>item.id===ruleId),value=rulePayload(rule),rooms=state.cloudStudio?.rooms||[],studio=state.cloudStudio;
 const parsed=window.zhimuRuleVisual.ruleJsonToVisual(rule?.conditions,rule?.actions);
 let editorTab=parsed.compatible===false?"json":"visual";
 let visualState=parsed.compatible?parsed.visual:window.zhimuRuleVisual.defaultVisual();
 const renderVisual=()=>{modal.querySelector("[data-rule-visual-panel]").innerHTML=window.zhimuRuleVisual.renderVisualPanel(visualState,studio,escapeHtml);wireRuleVisualPanel()};
 const syncJsonFromVisual=()=>{const built=window.zhimuRuleVisual.visualToRuleJson(visualState);modal.querySelector('[data-studio-field="conditions"]').value=JSON.stringify(built.conditions,null,2);modal.querySelector('[data-studio-field="actions"]').value=JSON.stringify(built.actions,null,2)};
 const showRuleErrors=(errors=[])=>{const box=modal.querySelector("[data-rule-errors]");if(!errors.length){box.innerHTML="";box.classList.remove("show");return}box.classList.add("show");box.innerHTML=`<strong>请修正以下问题：</strong><ul>${errors.map(item=>`<li>${escapeHtml(item.message)}</li>`).join("")}</ul>`};
 const wireRuleVisualPanel=()=>{
  modal.querySelectorAll("[data-rule-condition-type]").forEach(select=>select.onchange=()=>{const index=Number(select.dataset.ruleConditionType);visualState.conditions[index]=window.zhimuRuleVisual.emptyCondition(select.value);renderVisual()});
  modal.querySelectorAll("[data-rule-condition-field]").forEach(select=>select.onchange=()=>{visualState.conditions[Number(select.dataset.ruleConditionIndex)][select.dataset.ruleConditionField]=select.value;if(select.dataset.ruleConditionField==="roleSlotId")renderVisual()});
  modal.querySelectorAll("[data-rule-action-type]").forEach(select=>select.onchange=()=>{const index=Number(select.dataset.ruleActionType);visualState.actions[index]=window.zhimuRuleVisual.emptyAction(select.value);renderVisual()});
  modal.querySelectorAll("[data-rule-action-field]").forEach(field=>{const handler=()=>{visualState.actions[Number(field.dataset.ruleActionIndex)][field.dataset.ruleActionField]=field.value};field.onchange=handler;field.oninput=handler});
  modal.querySelector("[data-rule-add-condition]")&&(modal.querySelector("[data-rule-add-condition]").onclick=()=>{visualState.conditions.push(window.zhimuRuleVisual.emptyCondition());renderVisual()});
  modal.querySelector("[data-rule-add-action]")&&(modal.querySelector("[data-rule-add-action]").onclick=()=>{visualState.actions.push(window.zhimuRuleVisual.emptyAction());renderVisual()});
  modal.querySelectorAll("[data-rule-remove-condition]").forEach(button=>button.onclick=()=>{visualState.conditions.splice(Number(button.dataset.ruleRemoveCondition),1);if(!visualState.conditions.length)visualState.conditions.push(window.zhimuRuleVisual.emptyCondition());renderVisual()});
  modal.querySelectorAll("[data-rule-remove-action]").forEach(button=>button.onclick=()=>{visualState.actions.splice(Number(button.dataset.ruleRemoveAction),1);if(!visualState.actions.length)visualState.actions.push(window.zhimuRuleVisual.emptyAction());renderVisual()});
 };
 const setRuleTab=(tab)=>{
  editorTab=tab;
  modal.querySelectorAll("[data-rule-tab]").forEach(button=>button.classList.toggle("active",button.dataset.ruleTab===tab));
  modal.querySelector("[data-rule-visual-wrap]").style.display=tab==="visual"?"block":"none";
  modal.querySelector("[data-rule-json-wrap]").style.display=tab==="json"?"block":"none";
  if(tab==="json")syncJsonFromVisual();
  if(tab==="visual"){
   try{
    const conditions=JSON.parse(modal.querySelector('[data-studio-field="conditions"]').value);
    const actions=JSON.parse(modal.querySelector('[data-studio-field="actions"]').value);
    const next=window.zhimuRuleVisual.ruleJsonToVisual(conditions,actions);
    if(next.compatible){visualState=next.visual}else showToast(next.reason);
   }catch(error){/* keep current visualState on first open */}
   renderVisual();
  }
  showRuleErrors([]);
 };
 modal.className="modal rule-editor-modal";
 modal.innerHTML=`<h2>${rule?"编辑自动化规则":"新建自动化规则"}</h2><p class="wizard-intro">用可视化表单描述「当…则…」。所有条件必须同时满足（AND）。高级用户可切换到 JSON 模式。</p><div class="rule-editor-tabs"><button type="button" class="rule-tab active" data-rule-tab="visual">可视化编辑</button><button type="button" class="rule-tab" data-rule-tab="json">JSON 编辑</button></div><div class="form-group">${studioField("规则名称","name","input",value.name)}${studioSelect("绑定范围","roomId",[{id:"",name:"世界模板 · 可复用于新房间"},...rooms])}${studioSelect("触发模式","mode",[{id:"automatic",name:"自动执行"},{id:"host_confirm",name:"主持确认"},{id:"manual",name:"手动触发"}])}${studioField("优先级","priority","input",value.priority)}<label class="check-label"><input type="checkbox" data-rule-enabled ${value.enabled?"checked":""}> 启用规则</label></div><div data-rule-errors class="rule-error-box"></div><div data-rule-visual-wrap><div data-rule-visual-panel></div></div><div data-rule-json-wrap style="display:none"><div class="form-group">${studioField("检测条件 JSON","conditions","textarea",value.conditions)}${studioField("执行动作 JSON","actions","textarea",value.actions)}</div><p class="wizard-intro">JSON 模式面向高级用户。保存前仍会校验结构与引用。</p></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-rule-submit>写入云端</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector('[data-studio-field="roomId"]').value=value.roomId;modal.querySelector('[data-studio-field="mode"]').value=value.mode;
 modal.querySelectorAll("[data-rule-tab]").forEach(button=>button.onclick=()=>setRuleTab(button.dataset.ruleTab));
 if(parsed.compatible===false&&rule)showToast(parsed.reason);
 setRuleTab(editorTab);
 modal.querySelector("[data-rule-submit]").onclick=async()=>{
  try{
   showRuleErrors([]);
   const values=studioValues();
   let conditions,actions;
   if(editorTab==="visual"){({conditions,actions}=window.zhimuRuleVisual.visualToRuleJson(visualState))}else{
    try{conditions=JSON.parse(values.conditions);actions=JSON.parse(values.actions)}catch(error){showRuleErrors([{message:`JSON 格式错误：${error.message}`}]);return}
   }
   const validation=await zhimuApi.validateRuleBody({conditions,actions});
   if(!validation.ok){showRuleErrors(validation.errors);return}
   const payload={roomId:values.roomId||null,name:values.name,mode:values.mode,priority:Number(values.priority)||100,enabled:modal.querySelector("[data-rule-enabled]").checked,conditions,actions};
   if(rule)await zhimuApi.updateRule(rule.id,payload);else await zhimuApi.createRule(payload);
   closeModal();await loadCloudData();showToast("自动化规则已写入云端");
  }catch(error){showToast(`规则保存失败：${error.message}`)}
 };
}

async function toggleCloudRule(ruleId){const rule=state.cloudRules.find(item=>item.id===ruleId);if(!rule)return;try{await zhimuApi.updateRule(rule.id,{roomId:rule.room_id,name:rule.name,mode:rule.mode,priority:rule.priority,enabled:!rule.enabled,conditions:rule.conditions,actions:rule.actions});await loadCloudData();showToast(rule.enabled?"规则已暂停":"规则已启用")}catch(error){showToast(error.message)}}

async function deleteCloudRule(ruleId){try{await zhimuApi.deleteRule(ruleId);await loadCloudData();showToast("规则已删除")}catch(error){showToast(error.message)}}

async function validateCloudRules(){try{const result=await zhimuApi.validateRules();openModal("规则检查完成",result.checks.length?result.checks.map(check=>`<b>${escapeHtml(check.title)}</b><br><span>${escapeHtml(check.detail)}</span>`).join("<br><br>"):`已检查 ${result.totalRules} 条规则，没有发现结构问题。`,"知道了")}catch(error){showToast(error.message)}}
  viewExports.rules = rules;
  viewExports.rulePayload = rulePayload;
  viewExports.openRuleEditor = openRuleEditor;
  viewExports.toggleCloudRule = toggleCloudRule;
  viewExports.deleteCloudRule = deleteCloudRule;
  viewExports.validateCloudRules = validateCloudRules;
})(window);
