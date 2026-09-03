/* Auto-split from app.js — writer.js */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { content, toast, modal, modalBackdrop } from "../dom.js";
import { getRuntime, go, loadCloudData, render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { uiStore, studioStore, worldStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as M from "../components/modal.js";
import * as U from "../components/emptyState.js";
import { collapsibleCard } from "../components/collapse-panel.js";
import { contentLayerMapHtml } from "../components/content-layer-map.js";
import { normalizeError } from "../components/status-ui.js";
import { renderRoleArchiveFields, archiveMapFromList } from "./role-archive-panel.js";
import { normalizeWriterCollections, writerRoleSectionSummary } from "./writer-role-model.js";
import { writerSectionEditorHtml } from "./writer-section-editor.js";
import {
  bindWriterMetadataEditor,
  closeWriterMetadataEditor,
  deleteWriterRoleEditor,
  openWriterChapterEditor,
  openWriterRoleEditor,
  saveWriterMetadataEditor,
  writerMetadataWorkspaceHtml
} from "./writer-metadata-editor.js";
import {
  bindWriterToolWorkspace,
  applyWorldLogFilters,
  clearWorldLogFilters,
  closeWriterToolWorkspace,
  compareReviewVersions,
  copyCollaborationInviteLink,
  createReviewFromWorkspace,
  dismissCollaborationInviteLink,
  importDocumentWorkspace,
  importStoryAssistantWorkspace,
  inviteCollaboratorFromWorkspace,
  nextExportWorkspaceStep,
  openCollaborationWorkspace,
  openDocumentWorkspace,
  openExportWorkspace,
  openImpactWorkspace,
  openImportWorkspace,
  openManuscriptWorkspace,
  openReviewWorkspace,
  openSnapshotWorkspace,
  openStoryAssistantWorkspace,
  warmWriterToolModules,
  openOpeningPackageWorkspace,
  nextOpeningPackageStep,
  backOpeningPackageStep,
  skipOpeningPackageStep,
  previewOpeningPackageWorkspace,
  commitOpeningPackageWorkspace,
  confirmOpeningPackageStageSchema,
  rejectOpeningPackageStageSchema,
  editOpeningPackageStageSchema,
  saveOpeningPackageStageSchemaManual,
  cancelOpeningPackageStageSchemaManual,
  openWorldEngineWorkspace,
  seedWorldEngineWorkspace,
  searchWorldEngineWorkspace,
  openMisidentificationWorkspace,
  closeMisidentificationWorkspace,
  openRelationshipArcWorkspace,
  closeRelationshipArcWorkspace,
  openKnowledgeMatrixWorkspace,
  closeKnowledgeMatrixWorkspace,
  openEndingWorkspace,
  closeEndingWorkspace,
  openHostManualCompilerWorkspace,
  closeHostManualCompilerWorkspace,
  openObjectLifecycleWorkspace,
  closeObjectLifecycleWorkspace,
  openTimelineWorkspace,
  closeTimelineWorkspace,
  openHistoryCausalWorkspace,
  closeHistoryCausalWorkspace,
  openRuntimeStateMachineWorkspace,
  closeRuntimeStateMachineWorkspace,
  openValConsistencyWorkspace,
  closeValConsistencyWorkspace,
  openEconSystemWorkspace,
  closeEconSystemWorkspace,
  openNpcScriptWorkspace,
  closeNpcScriptWorkspace,
  openLocationStateWorkspace,
  closeLocationStateWorkspace,
  commitWorldEngineWorkspace,
  lowerWorldEngineWorkspace,
  searchWorldEngineEpistemicWorkspace,
  renderWorldEngineWorkspace,
  openWorldLogsWorkspace,
  parseDocumentWorkspace,
  previousExportWorkspaceStep,
  previewImportWorkspace,
  refreshCollaborationWorkspace,
  refreshReviewList,
  refreshWorldLogs,
  removeCollaboratorFromWorkspace,
  replyReviewFromWorkspace,
  resendCollaboratorInviteFromWorkspace,
  revokeCollaboratorInviteFromWorkspace,
  runExportWorkspace,
  runImportWorkspace,
  saveCollaboratorRoleFromWorkspace,
  saveManuscriptWorkspace,
  saveSnapshotWorkspace,
  analyzeStoryAssistantWorkspace,
  setReviewFilter,
  setReviewWorkspaceMode,
  setWorldLogFilter,
  syncManuscriptFromGraphWorkspace,
  syncManuscriptToGraphWorkspace,
  updateReviewStatusFromWorkspace,
  loadMoreWorldLogs,
  writerToolWorkspaceHtml
} from "./writer-tool-workspace.js";
import { setHtml } from "../../shared/safe-dom.js";
import { creatorTerms } from "../../shared/creator-terminology.js";
import { narrativeProfileFromSettings } from "../../shared/narrative-profile.js";
  const R = getRuntime();
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatTime = F.formatTime || (() => "");
  const formatBytes = F.formatBytes || (() => "");
  const roleParts = F.roleParts || (() => ({ name: "", role: "" }));
  const hostOperationLabel = F.hostOperationLabel || ((t, m) => m || t);
  const hostPlayerColor = F.hostPlayerColor || (() => "#666");
  const logActivityType = F.logActivityType || (() => "ok");
  const chapterPublicationLabel = F.chapterPublicationLabel || ((s) => s);
  const chapterFlowClass = F.chapterFlowClass || (() => "");
  const activeRuntimeRoom = U.activeRuntimeRoom || (() => null);
  const catalogExperienceBanner = U.catalogExperienceBanner || (() => "");
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
  const showError = (error, fallback = "操作失败，请稍后重试") => showToast(normalizeError(error, fallback));
  const closeModal = M.closeModal || (() => {});
  const openModal = M.openModal || (() => {});
  const studioModal = M.studioModal || (() => {});
  const studioField = M.studioField || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioSelect = M.studioSelect || (() => "");
  const studioOptionsHtml = M.studioOptionsHtml || (() => "");
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});

let roleArchivesRequest = null;
let writerEditorSession = null;

function editorDraft(section) {
  return {
    title: section?.title || "",
    body: section?.body || "",
    chapterId: section?.chapter_id || "",
    publicationStatus: section?.publication_status || "draft"
  };
}

function ensureWriterEditorSession(data, role, section) {
  const worldId = data.world?.id || zhimuApi.context.worldId || "";
  const sectionId = section?.id || "";
  if (
    writerEditorSession?.worldId === worldId &&
    writerEditorSession?.roleId === role.id &&
    writerEditorSession?.sectionId === sectionId
  ) return writerEditorSession;
  if (writerEditorSession?.dirty && !writerEditorSession.sectionId) return null;
  writerEditorSession = {
    worldId,
    roleId: role.id,
    sectionId,
    draft: editorDraft(section),
    dirty: false,
    revision: 0,
    saveState: section ? "已加载云端版本" : "新分幕尚未写入",
    autosaveTimer: null,
    deleteArmed: false,
    deleteResetTimer: null
  };
  return writerEditorSession;
}

function activeWriterEditorContext() {
  const data = studioStore.get().cloudStudio;
  const state = uiStore.get();
  if (!data || !state.writerEditorOpen) return null;
  const role = data.roles.find((item) => item.id === state.writerEditorRoleId);
  if (!role) return null;
  const section = state.writerEditorSectionId
    ? data.sections.find((item) => item.id === state.writerEditorSectionId && item.role_slot_id === role.id)
    : null;
  if (state.writerEditorSectionId && !section) return null;
  const session = ensureWriterEditorSession(data, role, section);
  return session ? { data, role, section, session } : null;
}

function roleSectionStatus(sections = []) {
  return sections.reduce((counts, section) => {
    const status = section.publication_status || "draft";
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, { draft: 0, testing: 0, published: 0 });
}

function writerRoleRailHtml(roles, sections, selectedRoleId, actLabel = "幕") {
  return roles.map((role) => {
    const roleSections = sections.filter((section) => section.role_slot_id === role.id);
    const status = roleSectionStatus(roleSections);
    const active = role.id === selectedRoleId;
    return `<button type="button" class="writer-role-tab${active ? " active" : ""}" data-action="writer-select-role" data-role="${escapeHtml(role.id)}" role="tab" aria-selected="${active}">
      <span class="writer-role-tab-name">${escapeHtml(role.name)}</span>
      <span class="writer-role-tab-summary">${roleSections.length} ${escapeHtml(actLabel)} · ${status.published} 已发布</span>
    </button>`;
  }).join("");
}

function writerRoleWorkspaceHtml(data, selectedRole, archive, statusName) {
  const terms = creatorTerms("murder_mystery");
  const canEdit = Boolean(U.canEditWorldContent?.(data.world));
  if (!selectedRole) return `<div class="empty-state">尚无${escapeHtml(terms.role)}。${canEdit ? `新增后即可维护${escapeHtml(terms.secret)}和分阶段内容。` : "当前没有可供审阅的内容。"}</div>`;
  const { sections } = normalizeWriterCollections(data);
  const roleSections = sections
    .filter((section) => section.role_slot_id === selectedRole.id)
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const status = roleSectionStatus(roleSections);
  const archiveBody = renderRoleArchiveFields(selectedRole, archive, { readOnly: !canEdit });
  const sectionRows = roleSections.map((section) => {
    const summary = writerRoleSectionSummary(section);
    const statusKey = section.publication_status || "draft";
    return `<div class="manuscript-row"><div><strong>${section.sequence}. ${escapeHtml(section.title)}</strong><p>${escapeHtml(summary || "尚未填写正文")}</p></div><span class="status-chip ${escapeHtml(statusKey)}">${statusName[statusKey] || "草稿"}</span>${canEdit ? `<button class="secondary-btn" data-action="creator-edit-section" data-role="${escapeHtml(selectedRole.id)}" data-section="${escapeHtml(section.id)}">编辑</button>` : ""}</div>`;
  }).join("");
  return `<section class="writer-role-editor" aria-label="${escapeHtml(selectedRole.name)}${escapeHtml(terms.roleShort)}工作台">
    <header class="writer-role-head">
      <div>
        <p class="section-kicker">当前${escapeHtml(terms.roleShort)}</p>
        <h3>${escapeHtml(selectedRole.name)}</h3>
        <p>${escapeHtml(selectedRole.public_profile || "尚未补充公开身份")}</p>
      </div>
      <div class="row writer-role-actions">
        ${canEdit ? `<button class="secondary-btn" data-action="creator-edit-role" data-role="${escapeHtml(selectedRole.id)}">编辑基础信息</button><button class="primary-btn" data-action="creator-add-section" data-role="${escapeHtml(selectedRole.id)}">＋ 新增${escapeHtml(terms.act)}</button>` : ""}
      </div>
    </header>
    <div class="writer-role-status" aria-label="${escapeHtml(terms.role)}内容发布概况">
      <span><b>${roleSections.length}</b>全部${escapeHtml(terms.act)}</span>
      <span><b>${status.draft}</b>草稿</span>
      <span><b>${status.testing}</b>测试中</span>
      <span><b>${status.published}</b>已发布</span>
    </div>
    ${collapsibleCard({ id: `writer:archive:${selectedRole.id}`, title: `${terms.roleShort}档案`, subtitle: `维护公开身份、${terms.secret}与个人目标；保存后供本产品工作区复用`, body: archiveBody, defaultOpen: false, className: "writer-role-module", nested: true })}
    ${collapsibleCard({ id: `writer:role:${selectedRole.id}`, title: `私人${terms.act}`, subtitle: `${terms.roleShort}只会读取被分配席位且符合发布状态的内容`, headerExtra: canEdit ? `<button class="primary-btn" data-action="creator-add-section" data-role="${escapeHtml(selectedRole.id)}">＋ 新增${escapeHtml(terms.act)}</button>` : "", body: `<div class="manuscript-list">${sectionRows || `<div class="empty-state">尚无内容。${canEdit ? `先新增第一个${escapeHtml(terms.act)}。` : ""}</div>`}</div>`, defaultOpen: true, className: "writer-role-module", nested: true })}
  </section>`;
}

export async function loadWriterRoleArchives({ force = false } = {}) {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return;
  const cached = worldStore.get();
  if (!force && cached.cloudRoleArchivesWorldId === worldId && Array.isArray(cached.cloudRoleArchives)) return;
  if (roleArchivesRequest?.worldId === worldId) return roleArchivesRequest.promise;
  const promise = (async () => {
    try {
      const payload = await zhimuApi.getRoleArchives(worldId);
      if (zhimuApi.context.worldId !== worldId) return;
      worldStore.set({
        cloudRoleArchives: payload?.archives || [],
        cloudRoleArchivesWorldId: worldId,
        cloudRoleArchivesError: ""
      });
      if (uiStore.get().view === "writer") render();
    } catch (error) {
      worldStore.set({
        cloudRoleArchives: [],
        cloudRoleArchivesWorldId: worldId,
        cloudRoleArchivesError: normalizeError(error, "角色档案加载失败")
      });
      showError(error);
    }
  })().finally(() => {
    if (roleArchivesRequest?.promise === promise) roleArchivesRequest = null;
  });
  roleArchivesRequest = { worldId, promise };
  return promise;
}

export function writer(){
 const data=studioStore.get().cloudStudio;
 if(!data)return U.creatorWorkspaceEmpty?.({title:"剧本杀创作中心",kicker:"SCRIPTED MYSTERY CREATOR",intro:"为每位玩家编写私人分幕，并控制公共章节的发布节奏。尚未选择项目时，可以创建空白世界或导入已有文稿。",guideTitle:"开始创作",guideItems:[{label:"完整剧情",title:"母稿与公共内容",text:"记录所有人共同经历的剧情与章节内容。",bullets:["按自己的顺序创作","支持持续修订"]},{label:"角色稿",title:"私人分幕正文",text:"只为真正需要私人信息的角色编写内容。",bullets:["不要求人人一个秘密","支持 Markdown"]},{label:"工具",title:"导入与结构提取",text:"整理已有文稿，不替作者决定故事。",bullets:["内容包导入导出","从现有文本提取结构"]}]})||`<section class="card"><h3>尚未选择剧本</h3><p><button class="primary-btn" data-action="open-catalog">浏览公开剧本库</button></p></section>`;
 if(narrativeProfileFromSettings(data.world?.settings||{}).creationType!=="murder_mystery")return `<section class="card"><h3>工作区不匹配</h3><p>角色本编辑器只属于剧本杀项目。请返回当前产品自己的创作中心。</p></section>`;
 const editorContext=activeWriterEditorContext();
 if(editorContext&&U.canEditWorldContent?.(data.world))return writerSectionEditorHtml({data:editorContext.data,role:editorContext.role,section:editorContext.section,draft:editorContext.session.draft,saveState:editorContext.session.saveState});
 const metadataWorkspace=writerMetadataWorkspaceHtml();
 if(metadataWorkspace)return metadataWorkspace;
 const toolWorkspace=writerToolWorkspaceHtml(data);
 if(toolWorkspace)return toolWorkspace;
 const terms=creatorTerms("murder_mystery");
 const {roles,sections,chapters,versions}=normalizeWriterCollections(data);
 const membershipRole=data.world?.membership_role;
 const canEdit=Boolean(U.canEditWorldContent?.(data.world));
 const isReviewer=membershipRole==="reviewer";
 const statusName={draft:"草稿",testing:"测试中",published:"已发布"};
 const checks=worldStore.get().cloudCreatorChecks||[];
 const quickActions=canEdit?`<div class="row writer-hero-actions"><button class="primary-btn" data-action="world-engine">世界引擎</button><button class="primary-btn" data-action="story-manuscript">完整内容</button><button class="primary-btn" data-action="opening-package">上传开本包</button><button class="secondary-btn" data-action="story-assistant">结构提取</button><button class="secondary-btn" data-action="creator-import">导入备份</button><button class="secondary-btn" data-action="creator-export">导出备份</button><button class="secondary-btn" data-action="publish-impact-preview">发布影响预览</button><button class="secondary-btn" data-action="creator-check">运行发布检查</button><button class="secondary-btn" data-action="creator-snapshot">＋ 保存创作版本</button></div>`:isReviewer?`<div class="row writer-hero-actions"><button class="primary-btn" data-action="creator-review">打开协作者审稿</button></div>`:`<div class="empty-state">当前身份不开放内容预览。</div>`;
 const archiveMap=archiveMapFromList(worldStore.get().cloudRoleArchives||[]);
 const selectedRoleId=roles.some((role)=>role.id===uiStore.get().writerSelectedRoleId)?uiStore.get().writerSelectedRoleId:roles[0]?.id||null;
 const selectedRole=roles.find((role)=>role.id===selectedRoleId)||null;
 const roleRail=writerRoleRailHtml(roles,sections,selectedRoleId,terms.act);
 const roleWorkspace=writerRoleWorkspaceHtml(data,selectedRole,archiveMap[selectedRoleId],statusName);
 const chapterBody=chapters.map((chapter,index)=>`<div class="chapter-control"><div><strong>${chapter.sequence ?? index + 1}. ${chapter.title}</strong><p>${chapter.summary||`尚未补充${terms.act}摘要`}</p></div><span class="status-chip ${chapter.publication_status}">${statusName[chapter.publication_status]}</span>${canEdit?`<div class="row"><button class="text-btn" data-action="creator-edit-chapter" data-chapter="${chapter.id}">设置</button><button class="text-btn danger-text" data-action="creator-delete-chapter" data-chapter="${chapter.id}">删除</button></div>`:""}</div>`).join("")||`<div class="empty-state">${canEdit?`请先在剧情编排中新增${terms.act}。`:`当前没有可供审阅的${terms.act}。`}</div>`;
 const testBody=`${checks.length?checks.map(check=>`<div class="check-result ${check.level}"><b>${check.title}</b><span>${check.detail}</span></div>`).join(""):`<div class="empty-state">点击“运行发布检查”生成真实云端报告。</div>`}<button class="secondary-btn full-btn" data-go="player">打开独立玩家端</button>`;
 const versionBody=versions.map(version=>`<div class="version-row"><div><strong>${escapeHtml(version.label)}</strong><p>${escapeHtml(formatTime(version.created_at))}</p></div>${canEdit?`<div class="row"><button class="text-btn" data-action="creator-restore" data-version="${escapeHtml(version.id)}">恢复</button><button class="text-btn" data-action="creator-delete-version" data-version="${escapeHtml(version.id)}">删除</button></div>`:""}</div>`).join("")||`<div class="empty-state">尚未保存创作快照。</div>`;
 const accessBanner=isReviewer?`<section class="demo-strip catalog-experience-strip"><div><span class="cloud-pill">受邀审稿 · 只读</span><strong style="margin-top:7px">你可以查看私有草稿并提交审稿意见</strong><p>正文、角色档案和版本内容不可由此身份修改或导出；审稿意见仅作者、编辑和受邀审稿人可见。</p></div></section>`:catalogExperienceBanner(data.world);
 const toolboxItems=[membershipRole==="owner"?creatorTool("协作权限","邀请成员并分配编辑、审稿、主持或玩家权限","creator-collaboration","管理成员 →"):"",["owner","editor","reviewer"].includes(membershipRole)?creatorTool("协作者审稿","批注、修改建议、版本对比与影响范围检查","creator-review","打开审稿台 →"):"",["owner","editor","host"].includes(membershipRole)?creatorTool("运行日志","筛选阅读、调查、规则触发与主持操作记录","creator-logs","查看日志 →"):"",canEdit?creatorTool("文档解析","解析 TXT、Markdown、DOCX、PDF 或飞书稿件，预览后结构化写入","creator-document-parser","解析文档 →"):""].join("");
 const heroKicker="MURDER MYSTERY CREATOR";
 const heroIntro=isReviewer?`逐项查看${escapeHtml(terms.roleShort)}档案、私人${escapeHtml(terms.act)}和版本差异，并把问题记录为可追踪的审稿意见。`:`从完整剧情、${escapeHtml(terms.roleShort)}档案或私人${escapeHtml(terms.act)}任一处开始，系统不会强迫固定顺序。`;
 return `${accessBanner}<section class="writer-hero"><div><p class="section-kicker">${heroKicker}</p><h2>${escapeHtml(terms.work)}${isReviewer?"审稿":"创作"}中心</h2><p>${heroIntro}</p></div>${collapsibleCard({ id: "writer:quick-actions", title: "快捷操作", subtitle: canEdit?"完整内容、导入导出、检查与版本":"只读预览与审稿", body: quickActions, defaultOpen: true, className: "collapse-panel-bare", nested: true })}</section>
 ${isReviewer?"":contentLayerMapHtml({ open: false })}
 <section class="writer-grid">
  <article class="card writer-main"><div class="section-head"><div><h3>${escapeHtml(terms.roleShort)}工作台</h3><p>选择一个${escapeHtml(terms.roleShort)}，在同一上下文中维护基础信息、${escapeHtml(terms.secret)}和私人${escapeHtml(terms.act)}。</p></div><button class="secondary-btn" data-action="load-writer-archives">刷新档案</button></div>
   <div class="writer-role-workbench">
    <aside class="writer-role-rail"><div class="writer-role-rail-head"><strong>${escapeHtml(terms.roleShort)}列表</strong>${canEdit?'<button class="text-btn" data-action="creator-add-role">＋ 新增</button>':""}</div><div class="writer-role-tabs" role="tablist">${roleRail||`<div class="empty-state">尚无${escapeHtml(terms.roleShort)}</div>`}</div></aside>
    ${roleWorkspace}
   </div>
  </article>
  <aside class="writer-side">
   ${collapsibleCard({ id: "writer:chapters", title: `${terms.act}发布控制`, subtitle: `草稿不会进入玩家房间。删除${terms.act}会重排序号，并移除绑定内容与相关自动化规则。`, body: chapterBody, defaultOpen: true })}
   ${collapsibleCard({ id: "writer:release-test", title: "发布检查与真实端测试", subtitle: "检查缺失内容后进入独立玩家端测试。", body: testBody, defaultOpen: false, style: "margin-top:14px" })}
   ${collapsibleCard({ id: "writer:versions", title: "创作版本历史", subtitle: "保存关键节点，需要时恢复正文与发布状态。", body: versionBody, defaultOpen: false, style: "margin-top:14px" })}
  </aside>
 </section>
 ${toolboxItems?collapsibleCard({ id: "writer:toolbox", title: "创作者工具箱", subtitle: "按当前成员权限显示可用工具", body: `<div class="placeholder-grid">${toolboxItems}</div>`, defaultOpen: false, className: "card placeholder-hub" }):""}`;
}

export function creatorTool(title,text,action,label){return `<article class="placeholder-module connected"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p><button class="text-btn" data-action="${escapeHtml(action)}">${escapeHtml(label)}</button></article>`}

export function openCreatorSection(roleId,sectionId=""){
 const data=studioStore.get().cloudStudio,role=data?.roles.find(item=>item.id===roleId),section=sectionId?data?.sections.find(item=>item.id===sectionId&&item.role_slot_id===roleId):null;
 if(!data||!role||!U.canEditWorldContent?.(data.world))return showToast("当前身份不能编辑角色分幕");
 if(sectionId&&!section)return showToast("没有找到要编辑的角色分幕");
 const sameTarget=writerEditorSession?.worldId===(data.world?.id||zhimuApi.context.worldId||"")&&writerEditorSession?.roleId===roleId&&writerEditorSession?.sectionId===(sectionId||"");
 if(writerEditorSession?.dirty&&!writerEditorSession.sectionId&&!sameTarget)return showToast("请先保存当前新增分幕，再切换到其他内容");
 if(!sameTarget)writerEditorSession=null;
 ensureWriterEditorSession(data,role,section);
 uiStore.set({writerSelectedRoleId:roleId,writerEditorOpen:true,writerEditorRoleId:roleId,writerEditorSectionId:sectionId||null});
 render();
}

function collectWriterEditorDraft(root,session){
 root.querySelectorAll("[data-studio-field]").forEach((field)=>{session.draft[field.dataset.studioField]=field.value});
 return {...session.draft,title:session.draft.title.trim(),chapterId:session.draft.chapterId||null};
}

function setWriterEditorState(message,session=writerEditorSession){
 if(!session)return;
 session.saveState=message;
 if(writerEditorSession!==session)return;
 const status=content.querySelector("[data-writer-section-editor] [data-editor-state]");
 if(status)status.textContent=message;
}

async function persistWriterEditor({close=false,quiet=false}={}){
 const context=activeWriterEditorContext(),root=content.querySelector("[data-writer-section-editor]");
 if(!context||!root)return false;
 const {data,role,section,session}=context;
 const values=collectWriterEditorDraft(root,session);
 if(!values.title){showToast("请先填写分幕标题");root.querySelector('[data-studio-field="title"]')?.focus();return false;}
 clearTimeout(session.autosaveTimer);
 const revision=session.revision;
 setWriterEditorState("正在写入云端…",session);
 try{
  if(section)await zhimuApi.updateSection(role.id,section.id,values);
  else await zhimuApi.createSection(zhimuApi.context.worldId,role.id,{...values,sequence:data.sections.filter(item=>item.role_slot_id===role.id).length+1});
  if(session.revision===revision){session.dirty=false;setWriterEditorState(`已保存 · ${new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}`,session)}
  else setWriterEditorState("有未保存修改",session);
  if(close){writerEditorSession=null;uiStore.set({writerEditorOpen:false,writerEditorRoleId:null,writerEditorSectionId:null});await loadCloudData();render();if(!quiet)showToast("角色分幕已保存");}
  return true;
 }catch(error){setWriterEditorState(`保存失败 · ${error.message}`,session);if(!quiet)showError(error);return false;}
}

export function bindWriterSectionEditor(){
 const root=content.querySelector("[data-writer-section-editor]");
 const context=activeWriterEditorContext();
 if(!root||!context||root.dataset.bound==="1")return;
 root.dataset.bound="1";
 const {section,session}=context;
 const body=root.querySelector('[data-studio-field="body"]'),count=root.querySelector("[data-word-count]");
 const markChanged=()=>{
  collectWriterEditorDraft(root,session);
  session.dirty=true;session.revision+=1;session.deleteArmed=false;
  if(count)count.textContent=`${body.value.length} 字`;
  setWriterEditorState(section?"有未保存修改":"新分幕尚未写入",session);
  if(!section)return;
  clearTimeout(session.autosaveTimer);
  session.autosaveTimer=setTimeout(()=>void persistWriterEditor({quiet:true}),900);
 };
 root.querySelectorAll("[data-studio-field]").forEach((field)=>{
  field.addEventListener("input",markChanged);
  if(field.tagName==="SELECT")field.addEventListener("change",markChanged);
 });
 setTimeout(()=>body?.focus(),60);
}

export async function saveWriterSectionEditor(){await persistWriterEditor({close:true})}

export async function closeWriterSectionEditor(){
 const context=activeWriterEditorContext();
 if(context?.section&&context.session.dirty){const saved=await persistWriterEditor({quiet:true});if(!saved)return;}
 if(context?.session){clearTimeout(context.session.autosaveTimer);clearTimeout(context.session.deleteResetTimer)}
 uiStore.set({writerEditorOpen:false,writerEditorRoleId:null,writerEditorSectionId:null});
 render();
 if(context?.session.dirty&&!context.section)showToast("未提交的新分幕暂时保留；再次点击新增分幕可继续编辑");
}

export async function switchWriterSection(roleId,sectionId){
 const context=activeWriterEditorContext();
 if(context?.session.sectionId===sectionId)return;
 if(context?.session.dirty&&!context.section)return showToast("请先保存当前新增分幕，再切换其他分幕");
 if(context?.session.dirty){const saved=await persistWriterEditor({quiet:true});if(!saved)return;}
 writerEditorSession=null;openCreatorSection(roleId,sectionId);
}

export function replaceWriterSectionText(){
 const root=content.querySelector("[data-writer-section-editor]"),body=root?.querySelector('[data-studio-field="body"]');
 const from=root?.querySelector("[data-editor-search]")?.value||"",to=root?.querySelector("[data-editor-replace]")?.value||"";
 if(!from)return showToast("请先填写搜索关键词");
 body.value=body.value.split(from).join(to);body.dispatchEvent(new Event("input"));showToast("当前分幕已完成替换");
}

export function formatWriterSectionText(format){
 const body=content.querySelector('[data-writer-section-editor] [data-studio-field="body"]');
 if(!body)return;
 const start=body.selectionStart,end=body.selectionEnd,value=body.value,selected=value.slice(start,end);
 let replacement=selected,nextStart=start,nextEnd=end;
 if(format==="bold"){replacement=`**${selected||"加粗文字"}**`;nextStart=start+2;nextEnd=start+replacement.length-2;}
 else if(format==="italic"){replacement=`_${selected||"斜体文字"}_`;nextStart=start+1;nextEnd=start+replacement.length-1;}
 else if(format==="heading"){const lineStart=value.lastIndexOf("\n",Math.max(0,start-1))+1;body.setSelectionRange(lineStart,end);replacement=`## ${value.slice(lineStart,end)||"小标题"}`;nextStart=lineStart+3;nextEnd=lineStart+replacement.length;body.setRangeText(replacement,lineStart,end,"end");body.dispatchEvent(new Event("input"));body.setSelectionRange(nextStart,nextEnd);body.focus();return;}
 else if(format==="list"){replacement=(selected||"列表内容").split("\n").map(line=>`- ${line.replace(/^[-*]\s+/,"")}`).join("\n");nextEnd=start+replacement.length;}
 else return;
 body.setRangeText(replacement,start,end,"end");body.dispatchEvent(new Event("input"));body.setSelectionRange(nextStart,nextEnd);body.focus();
}

export async function deleteWriterSectionEditor(){
 const context=activeWriterEditorContext();
 if(!context?.section)return;
 const button=content.querySelector('[data-action="writer-editor-delete"]');
 if(!context.session.deleteArmed){
  context.session.deleteArmed=true;if(button)button.textContent="再次点击确认删除";
  clearTimeout(context.session.deleteResetTimer);context.session.deleteResetTimer=setTimeout(()=>{context.session.deleteArmed=false;if(button)button.textContent="删除这一幕"},5000);
  return showToast("删除后不可恢复，请再次点击确认");
 }
 if(button)button.disabled=true;clearTimeout(context.session.autosaveTimer);
 try{await zhimuApi.deleteSection(context.role.id,context.section.id);writerEditorSession=null;uiStore.set({writerEditorOpen:false,writerEditorRoleId:null,writerEditorSectionId:null});await loadCloudData();render();showToast("角色分幕已删除")}catch(error){if(button)button.disabled=false;showError(error)}
}

export function discardWriterSectionDraft(){
 const context=activeWriterEditorContext();
 if(!context||context.section)return;
 clearTimeout(context.session.autosaveTimer);clearTimeout(context.session.deleteResetTimer);
 writerEditorSession=null;uiStore.set({writerEditorOpen:false,writerEditorRoleId:null,writerEditorSectionId:null});render();showToast("未提交的新分幕草稿已放弃");
}

export function selectWriterRole(roleId){
 const roles=studioStore.get().cloudStudio?.roles||[];
 if(!roles.some((role)=>role.id===roleId))return;
 uiStore.set({writerSelectedRoleId:roleId});
 render();
}

export function openCreatorRole(roleId=""){
 openWriterRoleEditor(roleId);
}

export function openCreatorChapter(chapterId){
 openWriterChapterEditor(chapterId);
}

function chapterDeleteReferenceHint(refs){
 const parts=[];
 if(refs.sceneCount)parts.push(`${refs.sceneCount} 个场景将解除章节绑定`);
 if(refs.sectionCount)parts.push(`${refs.sectionCount} 段私人分幕将解除章节绑定`);
 if(refs.edgeCount)parts.push(`${refs.edgeCount} 条剧情连线`);
 if(refs.investigationPointCount)parts.push(`${refs.investigationPointCount} 个调查点`);
 if(refs.clueGrantCount)parts.push(`${refs.clueGrantCount} 个调查点引用此线索`);
 if(refs.requiredItemCount)parts.push(`${refs.requiredItemCount} 个调查点需要此物品`);
 if(refs.ruleReferenceCount)parts.push(`${refs.ruleReferenceCount} 条规则引用`);
 return parts.length?`<p>删除前提示：${parts.join("；")}。</p>`:"";
}

export async function deleteCreatorChapter(chapterId){
 const chapter=studioStore.get().cloudStudio?.chapters?.find(item=>item.id===chapterId);
 if(!chapter)return showToast("未找到章节");
 try{
  const refs=await zhimuApi.getStudioNodeReferences("chapter",chapterId);
  studioModal("确认删除章节",`${chapterDeleteReferenceHint(refs)}<p>将永久删除「${escapeHtml(chapter.title)}」。</p><p class="muted-note">绑定本章的<strong>私人分幕</strong>与引用这些分幕的<strong>自动化规则</strong>（如「序章读完」）会一并删除；关联场景保留并解除章节绑定。删除后剩余章节序号会自动重排为 1、2、3…</p>`,"确认删除",async()=>{try{await zhimuApi.deleteStudioNode("chapter",chapterId);closeModal();await loadCloudData();showToast(`已删除章节「${chapter.title}」`)}catch(error){showError(error)}});
 }catch(error){showError(error)}
}

export async function runCreatorChecks(){try{const roomId=zhimuApi.context.roomId||null;const dash=await zhimuApi.getCreatorDashboard({roomId,force:true});worldStore.set({cloudCreatorDashboard:dash,cloudCreatorChecks:dash.checks||[]});render();showToast("发布检查已完成")}catch(error){showError(error)}}

export async function openStoryManuscript(){return openManuscriptWorkspace()}

export function openCollaboration(){return openCollaborationWorkspace()}

export function openCreatorReview(){return openReviewWorkspace()}

export async function openWorldLogs(){
 return openWorldLogsWorkspace();
}

export function openDocumentParser(){return openDocumentWorkspace()}

export function openOpeningPackage() {
  const open = async () => {
    try {
      await window.zhimuViewLoader?.ensureViewModules?.("writer");
      if (uiStore.get().view !== "writer") go("writer");
      return await openOpeningPackageWorkspace();
    } catch (error) {
      console.error("[writer] openOpeningPackage failed", error);
      showToast(`无法打开开本包向导：${String(error?.message || error).slice(0, 120)}`);
      return undefined;
    }
  };
  return open();
}

export function openStoryAssistant() {
  const open = async () => {
    try {
      await window.zhimuViewLoader?.ensureViewModules?.("writer");
      if (uiStore.get().view !== "writer") go("writer");
      return await openStoryAssistantWorkspace();
    } catch (error) {
      console.error("[writer] openStoryAssistant failed", error);
      showToast(`无法打开结构提取：${String(error?.message || error).slice(0, 120)}`);
      return undefined;
    }
  };
  return open();
}

export function openWorldEngine(){
 return openWorldEngineWorkspace();
}

export function openMisidentification(){
 return openMisidentificationWorkspace();
}

export function openRelationshipArc(){
 return openRelationshipArcWorkspace();
}

export function openKnowledgeMatrix(){
 return openKnowledgeMatrixWorkspace();
}

export function openEnding(){
 return openEndingWorkspace();
}

export function openHostManualCompiler(){
 return openHostManualCompilerWorkspace();
}

export function closeHostManualCompiler(){
 return closeHostManualCompilerWorkspace();
}

export function openObjectLifecycle(){
 return openObjectLifecycleWorkspace();
}

export function closeObjectLifecycle(){
 return closeObjectLifecycleWorkspace();
}

export function openTimeline(){
 return openTimelineWorkspace();
}

export function closeTimeline(){
 return closeTimelineWorkspace();
}

export function openHistoryCausal(){
 return openHistoryCausalWorkspace();
}

export function closeHistoryCausal(){
 return closeHistoryCausalWorkspace();
}

export function openRuntimeStateMachine(){
 return openRuntimeStateMachineWorkspace();
}

export function closeRuntimeStateMachine(){
 return closeRuntimeStateMachineWorkspace();
}

export function openValConsistency(){
 return openValConsistencyWorkspace();
}

export function closeValConsistency(){
 return closeValConsistencyWorkspace();
}

export function openEconSystem(){
 return openEconSystemWorkspace();
}

export function closeEconSystem(){
 return closeEconSystemWorkspace();
}

export function openNpcScript(){
 return openNpcScriptWorkspace();
}

export function closeNpcScript(){
 return closeNpcScriptWorkspace();
}

export function openLocationState(){
 return openLocationStateWorkspace();
}

export function closeLocationState(){
 return closeLocationStateWorkspace();
}

export function openPublishImpactPreview(){return openImpactWorkspace()}

export async function openCreatorExport(){return openExportWorkspace()}
export async function exportCreatorPackage(){return openCreatorExport()}

export function openCreatorImport(){return openImportWorkspace()}
export async function importCreatorPackage(){return runImportWorkspace()}

export function createCreatorSnapshot(){return openSnapshotWorkspace()}
export async function restoreCreatorSnapshot(versionId){try{await zhimuApi.restoreContentVersion(versionId);await loadCloudData();showToast("已恢复该版本的正文与发布状态")}catch(error){showError(error)}}
export async function deleteCreatorSnapshot(versionId){try{await zhimuApi.deleteContentVersion(versionId);await loadCloudData();showToast("创作版本记录已删除")}catch(error){showError(error)}}

export const writerViewApi = { writer, loadWriterRoleArchives, selectWriterRole, createCreatorSnapshot, restoreCreatorSnapshot, deleteCreatorSnapshot, creatorTool, openCreatorSection, closeWriterSectionEditor, saveWriterSectionEditor, deleteWriterSectionEditor, discardWriterSectionDraft, replaceWriterSectionText, formatWriterSectionText, switchWriterSection, bindWriterSectionEditor, bindWriterMetadataEditor, closeWriterMetadataEditor, saveWriterMetadataEditor, deleteWriterRoleEditor, bindWriterToolWorkspace, closeWriterToolWorkspace, warmWriterToolModules, saveManuscriptWorkspace, syncManuscriptFromGraphWorkspace, syncManuscriptToGraphWorkspace, analyzeStoryAssistantWorkspace, importStoryAssistantWorkspace, parseDocumentWorkspace, importDocumentWorkspace, openDocumentWorkspace, nextOpeningPackageStep, backOpeningPackageStep, skipOpeningPackageStep, previewOpeningPackageWorkspace, commitOpeningPackageWorkspace, confirmOpeningPackageStageSchema, rejectOpeningPackageStageSchema, editOpeningPackageStageSchema, saveOpeningPackageStageSchemaManual, cancelOpeningPackageStageSchemaManual, openOpeningPackage, nextExportWorkspaceStep, previousExportWorkspaceStep, runExportWorkspace, previewImportWorkspace, runImportWorkspace, saveSnapshotWorkspace, setReviewWorkspaceMode, setReviewFilter, refreshReviewList, createReviewFromWorkspace, replyReviewFromWorkspace, updateReviewStatusFromWorkspace, compareReviewVersions, refreshCollaborationWorkspace, inviteCollaboratorFromWorkspace, saveCollaboratorRoleFromWorkspace, removeCollaboratorFromWorkspace, resendCollaboratorInviteFromWorkspace, revokeCollaboratorInviteFromWorkspace, copyCollaborationInviteLink, dismissCollaborationInviteLink, setWorldLogFilter, applyWorldLogFilters, clearWorldLogFilters, refreshWorldLogs, loadMoreWorldLogs, openCreatorRole, openCreatorChapter, deleteCreatorChapter, runCreatorChecks, openStoryManuscript, openCollaboration, openCreatorReview, openWorldLogs, openDocumentParser, openDocumentWorkspace, openStoryAssistant, openWorldEngine, seedWorldEngineWorkspace, searchWorldEngineWorkspace, commitWorldEngineWorkspace, lowerWorldEngineWorkspace, searchWorldEngineEpistemicWorkspace, renderWorldEngineWorkspace, openPublishImpactPreview, openCreatorExport, exportCreatorPackage, openCreatorImport, importCreatorPackage, openObjectLifecycle, closeObjectLifecycle, openTimeline, closeTimeline, openHistoryCausal, closeHistoryCausal, openRuntimeStateMachine, closeRuntimeStateMachine };
registerView("writer", writerViewApi);
