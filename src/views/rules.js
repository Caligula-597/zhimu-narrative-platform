/* Auto-split from app.js — rules.js */
import * as zhimuApi from "../api/index.js";
import { formField, formSelect } from "../components/form-fields.js";
import { showToast } from "../components/toast.js";
import {
  bindWorkspaceDraft,
  setWorkspaceSaving,
  showWorkspaceErrors,
  workspaceValues
} from "../components/workspace-editor.js";
import { getRuntime, loadCloudData, render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { uiStore, studioStore, worldStore, roomStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as M from "../components/modal.js";
import * as U from "../components/emptyState.js";
import { normalizeError } from "../components/status-ui.js";
import { htmlFragment, setHtml } from "../../shared/safe-dom.js";
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
  const showError = (error, fallback = "操作失败，请稍后重试") => showToast(normalizeError(error, fallback));
  const openRichModal = M.openRichModal || (() => {});
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
  let ruleEditorState = null;

function canEditRules(){
 const world=studioStore.get().cloudStudio?.world;
 const role=world?.membership_role;
 return role==="owner"||role==="editor";
}

function rulesEmptyState(studio){
 const editable=canEditRules();
 return `<div class="empty-state enriched-empty"><p><strong>尚未建立自动化规则</strong></p><p>规则会在玩家读完分幕、获得线索或完成调查后自动推进剧情。空列表不代表功能未完成——你可以一键载入示例模板，或从零新建。</p><ul class="empty-hints"><li>示例含：读完记录、主持确认节点、线索/场景占位规则</li><li>载入后可在可视化编辑器里改成真实引用</li></ul><div class="row">${editable?`<button class="primary-btn" data-action="rule-seed-examples">载入示例规则</button>`:""}<button class="secondary-btn" data-action="rule-new">＋ 新建规则</button><button class="text-btn" data-action="open-creator-guide">阅读规则说明</button></div>${!editable?`<p class="muted-note">当前为只读体验；登录并拥有编辑权限后可写入规则。</p>`:""}</div>`;
}

function ruleGrantModeHint(rule, studio) {
 for (const action of rule.actions || []) {
  if (action.type !== "grant_clue" || !action.clueId) continue;
  const clue = (studio?.clues || []).find((item) => item.id === action.clueId);
  if (!clue?.metadata?.grantMode || clue.metadata.grantMode === "auto") continue;
  const label = { host_confirm: "主持确认", explore: "探索获得" }[clue.metadata.grantMode] || clue.metadata.grantMode;
  return `线索「${clue.name}」· ${label}`;
 }
 return "";
}

export function rules() {
 if(ruleEditorState)return renderRuleEditorWorkspace();
 const data=worldStore.get().cloudRules||[],modeName={automatic:"自动执行",host_confirm:"主持确认",manual:"仅手动"},studio=studioStore.get().cloudStudio;
 return `<section class="rules-layout"><div><div class="section-head"><div><h3>规则列表</h3><p>规则已经连接云端数据库。条件满足后，系统执行动作或提交主持人确认。</p></div><div class="row"><button class="secondary-btn" data-action="open-creator-guide">创作指引</button><button class="primary-btn" data-action="rule-new">＋ 新建规则</button></div></div>
 ${data.map(rule=>{const summary=window.zhimuRuleVisual?.summarizeRule(rule.conditions,rule.actions)||{when:JSON.stringify(rule.conditions),then:JSON.stringify(rule.actions)};const grantHint=ruleGrantModeHint(rule,studio);const purpose=rule.metadata?.storyPurpose?STORY_PURPOSE_LABELS[rule.metadata.storyPurpose]||rule.metadata.storyPurpose:"";return `<article class="rule-card"><div class="rule-card-top"><button class="toggle ${rule.enabled?"on":""}" data-action="rule-toggle" data-rule="${rule.id}" title="启用或暂停规则"><i></i></button><h3>${escapeHtml(rule.name)}</h3><span class="mode ${rule.mode==="host_confirm"?"confirm":""}">${modeName[rule.mode]}</span></div><p class="rule-text"><b>当</b> ${escapeHtml(summary.when)}<br><b>则</b> ${escapeHtml(summary.then)}</p>${purpose?`<p class="muted-note">剧情目的：${escapeHtml(purpose)}</p>`:""}${grantHint?`<p class="muted-note">${escapeHtml(grantHint)}</p>`:""}<div class="rule-stats"><span>● ${rule.enabled?"已启用":"已暂停"}</span><span>优先级 ${rule.priority}</span><span>${escapeHtml(rule.room_name||"世界模板")}</span></div><div class="row rule-actions"><button class="text-btn" data-action="rule-edit" data-rule="${rule.id}">编辑</button><button class="text-btn danger-text" data-action="rule-delete" data-rule="${rule.id}">删除</button></div></article>`}).join("")||rulesEmptyState(studio)}</div>
 <aside class="card"><div class="section-head"><div><h3>自动化概览</h3><p>创作阶段规则检查</p></div></div>
 ${stat("⌘",String(data.length),"条云端规则","支持世界模板与测试房")}${stat("✓",String(data.filter(rule=>rule.enabled).length),"条已启用","暂停规则不会触发")}${stat("◷",String(data.filter(rule=>rule.mode==="host_confirm").length),"项主持确认","关键转折保留人工判断")}
 <p class="muted-note" style="margin-top:12px">玩家入房后，主持端「规则运行与管理 → 刷新预览」可查看每条规则为何未触发；复杂本建议开房前先跑一遍规则检查。</p>
 <button class="secondary-btn full-btn" data-action="rule-validate">运行规则检查</button></aside></section>`;
}

const STORY_PURPOSE_LABELS = {
  advance_trick: "推进诡计",
  enhance_immersion: "增强沉浸",
  create_conflict: "制造冲突",
  control_pace: "控制节奏",
  other: "其他"
};
const STORY_PURPOSE_OPTIONS = Object.entries(STORY_PURPOSE_LABELS).map(([id, name]) => ({ id, name }));

export function rulePayload(rule={}){return {roomId:rule.room_id||"",name:rule.name||"",mode:rule.mode||"automatic",priority:String(rule.priority??100),enabled:rule.enabled!==false,storyPurpose:rule.metadata?.storyPurpose||"",conditions:JSON.stringify(rule.conditions||{all:[{type:"reading_completed",roleSlotId:"",scriptSectionId:""}]},null,2),actions:JSON.stringify(rule.actions||[{type:"unlock_script_section",scriptSectionId:""}],null,2)}}

export function openRuleEditor(ruleId=""){
 const rule=(worldStore.get().cloudRules||[]).find(item=>item.id===ruleId);
 if(ruleId&&!rule)return showToast("规则不存在或已被删除");
 const value=rulePayload(rule);
 const parsed=window.zhimuRuleVisual.ruleJsonToVisual(rule?.conditions,rule?.actions);
 if(parsed.compatible===false&&rule)showToast(parsed.reason);
 ruleEditorState={
  ruleId:rule?.id||"",
  editorTab:parsed.compatible===false?"json":"visual",
  visualModel:parsed.compatible?parsed.visual:window.zhimuRuleVisual.defaultVisual(),
  draft:value
 };
 render();
}

function activeRule(){
 return ruleEditorState?.ruleId?(worldStore.get().cloudRules||[]).find(item=>item.id===ruleEditorState.ruleId)||null:null;
}

function ruleEditorRoot(){
 return document.querySelector(".rule-workspace-page[data-workspace-editor]");
}

function renderRuleEditorWorkspace(){
 const state=ruleEditorState;
 const value=state.draft;
 const rule=activeRule();
 const rooms=studioStore.get().cloudStudio?.rooms||[];
 const studio=studioStore.get().cloudStudio;
 const visualHtml=window.zhimuRuleVisual.renderVisualPanel(state.visualModel,studio,escapeHtml);
 return `<section class="rule-workspace-page" data-workspace-editor aria-label="${rule?"编辑自动化规则":"新建自动化规则"}">
  <header class="rule-workspace-head">
    <div><button type="button" class="workspace-back-btn" data-action="rule-editor-close">← 返回规则列表</button><p class="section-kicker">AUTOMATION WORKSPACE</p><h2>${rule?`编辑 · ${escapeHtml(rule.name)}`:"新建自动化规则"}</h2><p>用「当…则…」描述触发链；保存前会校验 JSON 结构和剧本引用。</p></div>
    <div class="rule-workspace-head-actions"><button type="button" class="secondary-btn" data-action="rule-editor-close">取消</button><button type="button" class="primary-btn" data-action="rule-editor-save">写入云端</button></div>
  </header>
  <div class="rule-workspace-grid">
    <main class="rule-workspace-canvas">
      <div class="rule-editor-tabs"><button type="button" class="rule-tab ${state.editorTab==="visual"?"active":""}" data-action="rule-editor-tab" data-rule-tab="visual">可视化编辑</button><button type="button" class="rule-tab ${state.editorTab==="json"?"active":""}" data-action="rule-editor-tab" data-rule-tab="json">JSON 编辑</button></div>
      <div class="workspace-editor-errors" data-workspace-editor-errors role="alert"></div>
      <div data-rule-visual-wrap ${state.editorTab==="visual"?"":"hidden"}><div data-rule-visual-panel>${visualHtml}</div></div>
      <div data-rule-json-wrap ${state.editorTab==="json"?"":"hidden"}><div class="form-group rule-json-fields">${formField("检测条件 JSON","conditions","textarea",value.conditions,{rows:14})}${formField("执行动作 JSON","actions","textarea",value.actions,{rows:14})}</div><p class="wizard-intro">JSON 模式面向高级用户；切回可视化模式时会尝试重新解析。</p></div>
    </main>
    <aside class="rule-workspace-settings">
      <div><p class="section-kicker">RULE SETTINGS</p><h3>规则设置</h3><p>模板范围会应用到新房间；绑定测试房只影响当前运行环境。</p></div>
      <div class="form-group">${formField("规则名称","name","input",value.name)}${formSelect("绑定范围","roomId",[{id:"",name:"世界模板 · 可复用于新房间"},...rooms],value.roomId)}${formSelect("触发模式","mode",[{id:"automatic",name:"自动执行"},{id:"host_confirm",name:"主持确认"},{id:"manual",name:"手动触发"}],value.mode)}${formSelect("剧情目的","storyPurpose",[{id:"",name:"未标注"},...STORY_PURPOSE_OPTIONS],value.storyPurpose)}${formField("优先级","priority","input",value.priority,{inputType:"number",inputMode:"numeric"})}<label class="check-label"><input type="checkbox" data-editor-checkbox="enabled" ${value.enabled?"checked":""}> 启用规则</label></div>
      <div class="rule-workspace-note"><strong>上线前检查</strong><p>先运行规则检查，再从主持端预览未触发原因；关键转折建议使用“主持确认”。</p></div>
      <div class="workspace-editor-actions"><button type="button" class="secondary-btn" data-action="rule-editor-close">取消</button><button type="button" class="primary-btn" data-action="rule-editor-save">写入云端</button></div>
    </aside>
  </div>
 </section>`;
}

function renderRuleVisual(){
 const root=ruleEditorRoot();
 const panel=root?.querySelector("[data-rule-visual-panel]");
 if(!panel||!ruleEditorState)return;
 setHtml(panel,window.zhimuRuleVisual.renderVisualPanel(ruleEditorState.visualModel,studioStore.get().cloudStudio,escapeHtml));
 wireRuleVisualPanel();
}

function wireRuleVisualPanel(){
 const root=ruleEditorRoot(),state=ruleEditorState;
 if(!root||!state)return;
 const visualModel=state.visualModel;
 root.querySelectorAll("[data-rule-condition-type]").forEach(select=>select.onchange=()=>{const index=Number(select.dataset.ruleConditionType);visualModel.conditions[index]=window.zhimuRuleVisual.emptyCondition(select.value);renderRuleVisual()});
 root.querySelectorAll("[data-rule-condition-field]").forEach(el=>{const handler=()=>{const field=el.dataset.ruleConditionField;let val=el.value;if(field==="value")val=Number(el.value);visualModel.conditions[Number(el.dataset.ruleConditionIndex)][field]=val;if(field==="roleSlotId")renderRuleVisual()};el.onchange=handler;el.oninput=handler});
 root.querySelectorAll("[data-rule-action-type]").forEach(select=>select.onchange=()=>{const index=Number(select.dataset.ruleActionType);visualModel.actions[index]=window.zhimuRuleVisual.emptyAction(select.value);renderRuleVisual()});
 root.querySelectorAll("[data-rule-action-field]").forEach(field=>{const handler=()=>{const val=field.type==="number"?Number(field.value):field.value;visualModel.actions[Number(field.dataset.ruleActionIndex)][field.dataset.ruleActionField]=val};field.onchange=handler;field.oninput=handler});
 const logicSelect=root.querySelector("[data-rule-condition-logic]");
 if(logicSelect)logicSelect.onchange=()=>{visualModel.conditionLogic=logicSelect.value;renderRuleVisual()};
 root.querySelector("[data-rule-add-condition]")&&(root.querySelector("[data-rule-add-condition]").onclick=()=>{visualModel.conditions.push(window.zhimuRuleVisual.emptyCondition());renderRuleVisual()});
 root.querySelector("[data-rule-add-action]")&&(root.querySelector("[data-rule-add-action]").onclick=()=>{visualModel.actions.push(window.zhimuRuleVisual.emptyAction());renderRuleVisual()});
 root.querySelectorAll("[data-rule-remove-condition]").forEach(button=>button.onclick=()=>{visualModel.conditions.splice(Number(button.dataset.ruleRemoveCondition),1);if(!visualModel.conditions.length)visualModel.conditions.push(window.zhimuRuleVisual.emptyCondition());renderRuleVisual()});
 root.querySelectorAll("[data-rule-remove-action]").forEach(button=>button.onclick=()=>{visualModel.actions.splice(Number(button.dataset.ruleRemoveAction),1);if(!visualModel.actions.length)visualModel.actions.push(window.zhimuRuleVisual.emptyAction());renderRuleVisual()});
}

export function bindRuleEditor(){
 const root=ruleEditorRoot();
 if(!root||!ruleEditorState)return;
 bindWorkspaceDraft(root,ruleEditorState.draft,{checkboxMap:{enabled:"enabled"}});
 wireRuleVisualPanel();
}

export function closeRuleEditor(){
 ruleEditorState=null;
 render();
}

export function setRuleEditorTab(tab){
 const root=ruleEditorRoot(),state=ruleEditorState;
 if(!root||!state||!["visual","json"].includes(tab))return;
 if(tab==="json"){
  const built=window.zhimuRuleVisual.visualToRuleJson(state.visualModel);
  state.draft.conditions=JSON.stringify(built.conditions,null,2);
  state.draft.actions=JSON.stringify(built.actions,null,2);
  root.querySelector('[data-studio-field="conditions"]').value=state.draft.conditions;
  root.querySelector('[data-studio-field="actions"]').value=state.draft.actions;
 }else{
  const values=workspaceValues(root);
  state.draft={...state.draft,...values};
  try{
   const next=window.zhimuRuleVisual.ruleJsonToVisual(JSON.parse(state.draft.conditions),JSON.parse(state.draft.actions));
   if(next.compatible)state.visualModel=next.visual;else showToast(next.reason);
  }catch(error){
   showWorkspaceErrors(root,[`JSON 格式错误：${error.message}`]);
   return;
  }
  renderRuleVisual();
 }
 state.editorTab=tab;
 root.querySelectorAll("[data-rule-tab]").forEach(button=>button.classList.toggle("active",button.dataset.ruleTab===tab));
 root.querySelector("[data-rule-visual-wrap]").hidden=tab!=="visual";
 root.querySelector("[data-rule-json-wrap]").hidden=tab!=="json";
 showWorkspaceErrors(root,[]);
}

export async function saveRuleEditor(){
 const root=ruleEditorRoot(),state=ruleEditorState;
 if(!root||!state)return;
 const values=workspaceValues(root);
 state.draft={...state.draft,...values};
 if(!values.name){
  showWorkspaceErrors(root,["请填写规则名称"]);
  root.querySelector('[data-studio-field="name"]')?.focus();
  return;
 }
 let conditions,actions;
 if(state.editorTab==="visual"){
  ({conditions,actions}=window.zhimuRuleVisual.visualToRuleJson(state.visualModel));
 }else{
  try{conditions=JSON.parse(values.conditions);actions=JSON.parse(values.actions)}
  catch(error){showWorkspaceErrors(root,[`JSON 格式错误：${error.message}`]);return}
 }
 setWorkspaceSaving(root,true);
 showWorkspaceErrors(root,[]);
 try{
  const validation=await zhimuApi.validateRuleBody({conditions,actions});
  if(!validation.ok){setWorkspaceSaving(root,false);showWorkspaceErrors(root,validation.errors);return}
  const rule=activeRule();
  const payload={roomId:values.roomId||null,name:values.name,mode:values.mode,priority:Number(values.priority)||100,enabled:state.draft.enabled!==false,conditions,actions,metadata:{...(rule?.metadata||{}),storyPurpose:values.storyPurpose||null}};
  if(rule)await zhimuApi.updateRule(rule.id,payload);else await zhimuApi.createRule(payload);
  ruleEditorState=null;
  await loadCloudData();
  render();
  showToast("自动化规则已写入云端");
 }catch(error){
  setWorkspaceSaving(root,false);
  showWorkspaceErrors(root,[error?.message||"规则保存失败"]);
  showError(error,"规则保存失败");
 }
}

export async function toggleCloudRule(ruleId){const rule=worldStore.get().cloudRules.find(item=>item.id===ruleId);if(!rule)return;try{await zhimuApi.updateRule(rule.id,{roomId:rule.room_id,name:rule.name,mode:rule.mode,priority:rule.priority,enabled:!rule.enabled,conditions:rule.conditions,actions:rule.actions,metadata:rule.metadata||{}});await loadCloudData();showToast(rule.enabled?"规则已暂停":"规则已启用")}catch(error){showError(error)}}

export async function deleteCloudRule(ruleId){try{await zhimuApi.deleteRule(ruleId);await loadCloudData();showToast("规则已删除")}catch(error){showError(error)}}

export async function validateCloudRules(){try{const result=await zhimuApi.validateRules();openRichModal("规则检查完成",htmlFragment(result.checks.length?result.checks.map(check=>`<b>${escapeHtml(check.title)}</b><br><span>${escapeHtml(check.detail)}</span>`).join("<br><br>"):`已检查 ${Number(result.totalRules) || 0} 条规则，没有发现结构问题。`),"知道了")}catch(error){showError(error)}}

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

export const rulesViewApi = { rules, rulePayload, openRuleEditor, closeRuleEditor, setRuleEditorTab, saveRuleEditor, bindRuleEditor, toggleCloudRule, deleteCloudRule, validateCloudRules, seedExampleRules };
registerView("rules", rulesViewApi);
