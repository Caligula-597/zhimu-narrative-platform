/* Auto-split from app.js — rules.js */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { content, toast, modal, modalBackdrop } from "../dom.js";
import { getRuntime, go, loadCloudData, render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { uiStore, studioStore, worldStore, roomStore } from "../state/index.js";
import * as F from "../utils/format.js";
  const U = window.zhimuUi || {};
  const M = window.zhimuModal || {};
  const R = getRuntime();
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
  const showError = (error, fallback = "操作失败，请稍后重试") => showToast(window.zhimuStatus?.normalizeError?.(error, fallback) || error?.message || fallback);
  const closeModal = M.closeModal || (() => {});
  const openModal = M.openModal || (() => {});
  const studioModal = M.studioModal || (() => {});
  const studioField = M.studioField || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioSelect = M.studioSelect || (() => "");
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});

function canEditRules(){
 const world=studioStore.get().cloudStudio?.world;
 const role=world?.membership_role;
 return role==="owner"||role==="editor";
}

function rulesEmptyState(studio){
 const editable=canEditRules();
 return `<div class="empty-state enriched-empty"><p><strong>尚未建立自动化规则</strong></p><p>规则会在玩家读完分幕、获得线索或完成调查后自动推进剧情。空列表不代表功能未完成——你可以一键载入示例模板，或从零新建。</p><ul class="empty-hints"><li>示例含：读完记录、主持确认节点、线索/场景占位规则</li><li>载入后可在可视化编辑器里改成真实引用</li></ul><div class="row">${editable?`<button class="primary-btn" data-action="rule-seed-examples">载入示例规则</button>`:""}<button class="secondary-btn" data-action="rule-new">＋ 新建规则</button><button class="text-btn" data-action="open-creator-guide">阅读规则说明</button></div>${!editable?`<p class="muted-note">当前为只读体验；登录并拥有编辑权限后可写入规则。</p>`:""}</div>`;
}

export function rules() {
 const data=worldStore.get().cloudRules||[],modeName={automatic:"自动执行",host_confirm:"主持确认",manual:"仅手动"},studio=studioStore.get().cloudStudio;
 return `<section class="rules-layout"><div><div class="section-head"><div><h3>规则列表</h3><p>规则已经连接云端数据库。条件满足后，系统执行动作或提交主持人确认。</p></div><div class="row"><button class="secondary-btn" data-action="open-creator-guide">创作指引</button><button class="primary-btn" data-action="rule-new">＋ 新建规则</button></div></div>
 ${data.map(rule=>{const summary=window.zhimuRuleVisual?.summarizeRule(rule.conditions,rule.actions)||{when:JSON.stringify(rule.conditions),then:JSON.stringify(rule.actions)};return `<article class="rule-card"><div class="rule-card-top"><button class="toggle ${rule.enabled?"on":""}" data-action="rule-toggle" data-rule="${rule.id}" title="启用或暂停规则"><i></i></button><h3>${escapeHtml(rule.name)}</h3><span class="mode ${rule.mode==="host_confirm"?"confirm":""}">${modeName[rule.mode]}</span></div><p class="rule-text"><b>当</b> ${escapeHtml(summary.when)}<br><b>则</b> ${escapeHtml(summary.then)}</p><div class="rule-stats"><span>● ${rule.enabled?"已启用":"已暂停"}</span><span>优先级 ${rule.priority}</span><span>${escapeHtml(rule.room_name||"世界模板")}</span></div><div class="row rule-actions"><button class="text-btn" data-action="rule-edit" data-rule="${rule.id}">编辑</button><button class="text-btn danger-text" data-action="rule-delete" data-rule="${rule.id}">删除</button></div></article>`}).join("")||rulesEmptyState(studio)}</div>
 <aside class="card"><div class="section-head"><div><h3>自动化概览</h3><p>创作阶段规则检查</p></div></div>
 ${stat("⌘",String(data.length),"条云端规则","支持世界模板与测试房")}${stat("✓",String(data.filter(rule=>rule.enabled).length),"条已启用","暂停规则不会触发")}${stat("◷",String(data.filter(rule=>rule.mode==="host_confirm").length),"项主持确认","关键转折保留人工判断")}
 <button class="secondary-btn full-btn" data-action="rule-validate">运行规则检查</button></aside></section>`;
}

export function rulePayload(rule={}){return {roomId:rule.room_id||"",name:rule.name||"",mode:rule.mode||"automatic",priority:String(rule.priority??100),enabled:rule.enabled!==false,conditions:JSON.stringify(rule.conditions||{all:[{type:"reading_completed",roleSlotId:"",scriptSectionId:""}]},null,2),actions:JSON.stringify(rule.actions||[{type:"unlock_script_section",scriptSectionId:""}],null,2)}}

export function openRuleEditor(ruleId=""){
 const rule=worldStore.get().cloudRules.find(item=>item.id===ruleId),value=rulePayload(rule),rooms=studioStore.get().cloudStudio?.rooms||[],studio=studioStore.get().cloudStudio;
 const parsed=window.zhimuRuleVisual.ruleJsonToVisual(rule?.conditions,rule?.actions);
 let editorTab=parsed.compatible===false?"json":"visual";
 let visualModel=parsed.compatible?parsed.visual:window.zhimuRuleVisual.defaultVisual();
 const renderVisual=()=>{modal.querySelector("[data-rule-visual-panel]").innerHTML=window.zhimuRuleVisual.renderVisualPanel(visualModel,studio,escapeHtml);wireRuleVisualPanel()};
 const syncJsonFromVisual=()=>{const built=window.zhimuRuleVisual.visualToRuleJson(visualModel);modal.querySelector('[data-studio-field="conditions"]').value=JSON.stringify(built.conditions,null,2);modal.querySelector('[data-studio-field="actions"]').value=JSON.stringify(built.actions,null,2)};
 const showRuleErrors=(errors=[])=>{const box=modal.querySelector("[data-rule-errors]");if(!errors.length){box.innerHTML="";box.classList.remove("show");return}box.classList.add("show");box.innerHTML=`<strong>请修正以下问题：</strong><ul>${errors.map(item=>`<li>${escapeHtml(item.message)}</li>`).join("")}</ul>`};
 const wireRuleVisualPanel=()=>{
  modal.querySelectorAll("[data-rule-condition-type]").forEach(select=>select.onchange=()=>{const index=Number(select.dataset.ruleConditionType);visualModel.conditions[index]=window.zhimuRuleVisual.emptyCondition(select.value);renderVisual()});
  modal.querySelectorAll("[data-rule-condition-field]").forEach(el=>{const handler=()=>{const field=el.dataset.ruleConditionField;let val=el.value;if(field==="value")val=Number(el.value);visualModel.conditions[Number(el.dataset.ruleConditionIndex)][field]=val;if(field==="roleSlotId")renderVisual()};el.onchange=handler;el.oninput=handler});
  modal.querySelectorAll("[data-rule-action-type]").forEach(select=>select.onchange=()=>{const index=Number(select.dataset.ruleActionType);visualModel.actions[index]=window.zhimuRuleVisual.emptyAction(select.value);renderVisual()});
  modal.querySelectorAll("[data-rule-action-field]").forEach(field=>{const handler=()=>{const val=field.type==="number"?Number(field.value):field.value;visualModel.actions[Number(field.dataset.ruleActionIndex)][field.dataset.ruleActionField]=val};field.onchange=handler;field.oninput=handler});
  const logicSelect=modal.querySelector("[data-rule-condition-logic]");
  if(logicSelect)logicSelect.onchange=()=>{visualModel.conditionLogic=logicSelect.value;renderVisual()};
  modal.querySelector("[data-rule-add-condition]")&&(modal.querySelector("[data-rule-add-condition]").onclick=()=>{visualModel.conditions.push(window.zhimuRuleVisual.emptyCondition());renderVisual()});
  modal.querySelector("[data-rule-add-action]")&&(modal.querySelector("[data-rule-add-action]").onclick=()=>{visualModel.actions.push(window.zhimuRuleVisual.emptyAction());renderVisual()});
  modal.querySelectorAll("[data-rule-remove-condition]").forEach(button=>button.onclick=()=>{visualModel.conditions.splice(Number(button.dataset.ruleRemoveCondition),1);if(!visualModel.conditions.length)visualModel.conditions.push(window.zhimuRuleVisual.emptyCondition());renderVisual()});
  modal.querySelectorAll("[data-rule-remove-action]").forEach(button=>button.onclick=()=>{visualModel.actions.splice(Number(button.dataset.ruleRemoveAction),1);if(!visualModel.actions.length)visualModel.actions.push(window.zhimuRuleVisual.emptyAction());renderVisual()});
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
    if(next.compatible){visualModel=next.visual}else showToast(next.reason);
   }catch(error){/* keep current visualModel on first open */}
   renderVisual();
  }
  showRuleErrors([]);
 };
 modal.className="modal rule-editor-modal";
 modal.innerHTML=`<h2>${rule?"编辑自动化规则":"新建自动化规则"}</h2><p class="wizard-intro">用可视化表单描述「当…则…」。支持全部满足或任一满足；复杂结构（如取反）请用 JSON 模式。</p><div class="rule-editor-tabs"><button type="button" class="rule-tab active" data-rule-tab="visual">可视化编辑</button><button type="button" class="rule-tab" data-rule-tab="json">JSON 编辑</button></div><div class="form-group">${studioField("规则名称","name","input",value.name)}${studioSelect("绑定范围","roomId",[{id:"",name:"世界模板 · 可复用于新房间"},...rooms],value.roomId)}${studioSelect("触发模式","mode",[{id:"automatic",name:"自动执行"},{id:"host_confirm",name:"主持确认"},{id:"manual",name:"手动触发"}],value.mode)}${studioField("优先级","priority","input",value.priority)}<label class="check-label"><input type="checkbox" data-rule-enabled ${value.enabled?"checked":""}> 启用规则</label></div><div data-rule-errors class="rule-error-box"></div><div data-rule-visual-wrap><div data-rule-visual-panel></div></div><div data-rule-json-wrap style="display:none"><div class="form-group">${studioField("检测条件 JSON","conditions","textarea",value.conditions)}${studioField("执行动作 JSON","actions","textarea",value.actions)}</div><p class="wizard-intro">JSON 模式面向高级用户。保存前仍会校验结构与引用。</p></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-rule-submit>写入云端</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;
 modal.querySelectorAll("[data-rule-tab]").forEach(button=>button.onclick=()=>setRuleTab(button.dataset.ruleTab));
 if(parsed.compatible===false&&rule)showToast(parsed.reason);
 setRuleTab(editorTab);
 modal.querySelector("[data-rule-submit]").onclick=async()=>{
  try{
   showRuleErrors([]);
   const values=studioValues();
   let conditions,actions;
   if(editorTab==="visual"){({conditions,actions}=window.zhimuRuleVisual.visualToRuleJson(visualModel))}else{
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

export async function toggleCloudRule(ruleId){const rule=worldStore.get().cloudRules.find(item=>item.id===ruleId);if(!rule)return;try{await zhimuApi.updateRule(rule.id,{roomId:rule.room_id,name:rule.name,mode:rule.mode,priority:rule.priority,enabled:!rule.enabled,conditions:rule.conditions,actions:rule.actions});await loadCloudData();showToast(rule.enabled?"规则已暂停":"规则已启用")}catch(error){showError(error)}}

export async function deleteCloudRule(ruleId){try{await zhimuApi.deleteRule(ruleId);await loadCloudData();showToast("规则已删除")}catch(error){showError(error)}}

export async function validateCloudRules(){try{const result=await zhimuApi.validateRules();openModal("规则检查完成",result.checks.length?result.checks.map(check=>`<b>${escapeHtml(check.title)}</b><br><span>${escapeHtml(check.detail)}</span>`).join("<br><br>"):`已检查 ${result.totalRules} 条规则，没有发现结构问题。`,"知道了")}catch(error){showError(error)}}

export async function seedExampleRules(){
 if(!canEditRules())return showToast("当前为只读体验，登录并拥有编辑权限后可载入示例");
 const studio=studioStore.get().cloudStudio;
 const roles=studio?.roles||[];
 const sections=studio?.sections||[];
 if(!roles.length||!sections.length)return showToast("请先确保当前世界已有角色与分幕");
 const primary=roles[0];
 const section=sections.find(item=>item.role_slot_id===primary.id);
 if(!section?.id)return showToast("未找到可用于示例规则的角色分幕");
 const templates={reading:true,chapter:true,clue:true,hint:true};
 const bodies=window.zhimuWizardAutomation?.buildWizardAutomationRules?.({roles:[{id:primary.id,name:primary.name,sectionId:section.id}],templates})||[];
 if(!bodies.length)return showToast("无法生成示例规则");
 let created=0;
 for(const body of bodies){
  try{await zhimuApi.createRule(body);created+=1}catch(error){console.warn("seed rule skipped",error)}
 }
 await loadCloudData();
 showToast(created?`已载入 ${created} 条示例规则，可在列表中编辑引用`:"示例规则载入失败，请稍后重试");
 render();
}

export const rulesViewApi = { rules, rulePayload, openRuleEditor, toggleCloudRule, deleteCloudRule, validateCloudRules, seedExampleRules };
registerView("rules", rulesViewApi);
