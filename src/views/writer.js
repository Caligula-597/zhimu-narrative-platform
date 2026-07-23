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
import { handleApiErrorToast } from "../utils/user-messages.js";
import { renderRoleArchiveFields, archiveMapFromList } from "./role-archive-panel.js";
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
  closeWriterToolWorkspace,
  importDocumentWorkspace,
  nextExportWorkspaceStep,
  openDocumentWorkspace,
  openExportWorkspace,
  openImpactWorkspace,
  openImportWorkspace,
  openManuscriptWorkspace,
  parseDocumentWorkspace,
  previousExportWorkspaceStep,
  previewImportWorkspace,
  runExportWorkspace,
  runImportWorkspace,
  saveManuscriptWorkspace,
  syncManuscriptFromGraphWorkspace,
  syncManuscriptToGraphWorkspace,
  writerToolWorkspaceHtml
} from "./writer-tool-workspace.js";
import { htmlFragment, setHtml } from "../../shared/safe-dom.js";
import { creatorTerms } from "../../shared/creator-terminology.js";
import {
  creatorPreviewModalHtml as renderCreatorPreviewModalHtml,
  creatorPreviewBodyHtml as renderCreatorPreviewBodyHtml,
  storyAssistantModalHtml,
  collaborationModalHtml as renderCollaborationModalHtml,
  worldLogModalHtml
} from "./writer-modal-templates.js";

// Fragment-taking template boundaries are centralized here so raw application
// strings cannot call the lower-level template contract directly.
const creatorPreviewModalHtml = (controlsHtml) => renderCreatorPreviewModalHtml(htmlFragment(controlsHtml));
const collaborationModalHtml = ({ memberRowsHtml, pendingRowsHtml }) => renderCollaborationModalHtml({
  memberRowsHtml: htmlFragment(memberRowsHtml),
  pendingRowsHtml: htmlFragment(pendingRowsHtml)
});
const creatorPreviewBodyHtml = ({ roleNameHtml, privateProfileHtml, sectionRowsHtml }) => renderCreatorPreviewBodyHtml({
  roleNameHtml: htmlFragment(roleNameHtml),
  privateProfileHtml: htmlFragment(privateProfileHtml),
  sectionRowsHtml: htmlFragment(sectionRowsHtml)
});
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
  const voiceOption = U.voiceOption || (() => "");
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

function writerRoleRailHtml(roles, sections, selectedRoleId) {
  return roles.map((role) => {
    const roleSections = sections.filter((section) => section.role_slot_id === role.id);
    const status = roleSectionStatus(roleSections);
    const active = role.id === selectedRoleId;
    return `<button type="button" class="writer-role-tab${active ? " active" : ""}" data-action="writer-select-role" data-role="${escapeHtml(role.id)}" role="tab" aria-selected="${active}">
      <span class="writer-role-tab-name">${escapeHtml(role.name)}</span>
      <span class="writer-role-tab-summary">${roleSections.length} 幕 · ${status.published} 已发布</span>
    </button>`;
  }).join("");
}

function writerRoleWorkspaceHtml(data, selectedRole, archive, statusName) {
  const terms = creatorTerms(data.world?.settings?.creationType);
  const canEdit = Boolean(U.canEditWorldContent?.(data.world));
  if (!selectedRole) return `<div class="empty-state">尚无角色席位。${canEdit ? "新增角色后即可建立档案和私人剧本。" : "当前没有可供审阅的角色内容。"}</div>`;
  const sections = data.sections
    .filter((section) => section.role_slot_id === selectedRole.id)
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const status = roleSectionStatus(sections);
  const archiveBody = renderRoleArchiveFields(selectedRole, archive, { readOnly: !canEdit });
  const sectionRows = sections.map((section) => {
    const meta = typeof section.metadata === "object" ? section.metadata : {};
    const summary = meta.contentMode === "pages"
      ? `图片分幕 · ${meta.pageCount || meta.pageAssetIds?.length || "?"} 页`
      : `${section.body.slice(0, 100)}${section.body.length > 100 ? "..." : ""}`;
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
        <button class="secondary-btn" data-action="creator-preview" data-role="${escapeHtml(selectedRole.id)}">玩家视角预览</button>
        ${canEdit ? `<button class="secondary-btn" data-action="creator-edit-role" data-role="${escapeHtml(selectedRole.id)}">编辑基础信息</button><button class="primary-btn" data-action="creator-add-section" data-role="${escapeHtml(selectedRole.id)}">＋ 新增一幕</button>` : ""}
      </div>
    </header>
    <div class="writer-role-status" aria-label="私人分幕发布概况">
      <span><b>${sections.length}</b>全部分幕</span>
      <span><b>${status.draft}</b>草稿</span>
      <span><b>${status.testing}</b>测试中</span>
      <span><b>${status.published}</b>已发布</span>
    </div>
    ${collapsibleCard({ id: `writer:archive:${selectedRole.id}`, title: "角色档案", subtitle: "创作侧人物动机、秘密与弧光；保存后供创作工作台复用", body: archiveBody, defaultOpen: false, className: "writer-role-module", nested: true })}
    ${collapsibleCard({ id: `writer:role:${selectedRole.id}`, title: "私人分幕", subtitle: "玩家只会读取被分配角色且符合房间发布状态的内容", headerExtra: canEdit ? `<button class="primary-btn" data-action="creator-add-section" data-role="${escapeHtml(selectedRole.id)}">＋ 新增一幕</button>` : "", body: `<div class="manuscript-list">${sectionRows || `<div class="empty-state">尚无正文。${canEdit ? "先新增角色序章或第一幕。" : ""}</div>`}</div>`, defaultOpen: true, className: "writer-role-module", nested: true })}
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
 if(!data)return U.creatorWorkspaceEmpty?.({title:"剧本杀创作中心",kicker:"SCRIPTED MYSTERY CREATOR",intro:"为每位玩家编写私人分幕，并控制公共章节的发布节奏。尚未选择剧本时，可先浏览公开库或创建新世界。",guideTitle:"开始创作",guideItems:[{label:"角色稿",title:"私人分幕正文",text:"每位玩家只看到自己的章节与秘密。",bullets:["按角色席位管理分幕","支持 Markdown","草稿 / 测试中 / 已发布"]},{label:"章节",title:"公共章节",text:"控制玩家何时能看到下一章信息。",bullets:["主持人确认或自动解锁","与规则引擎联动"]},{label:"工具",title:"导入导出与 AI",text:"备份、迁移与辅助生成剧情结构。",bullets:["内容包导入导出","AI 剧本创作向导"]}]})||`<section class="card"><h3>尚未选择剧本</h3><p><button class="primary-btn" data-action="open-catalog">浏览公开剧本库</button></p></section>`;
 const editorContext=activeWriterEditorContext();
 if(editorContext&&U.canEditWorldContent?.(data.world))return writerSectionEditorHtml({data:editorContext.data,role:editorContext.role,section:editorContext.section,draft:editorContext.session.draft,saveState:editorContext.session.saveState});
 const metadataWorkspace=writerMetadataWorkspaceHtml();
 if(metadataWorkspace)return metadataWorkspace;
 const toolWorkspace=writerToolWorkspaceHtml(data);
 if(toolWorkspace)return toolWorkspace;
 const terms=creatorTerms(data.world?.settings?.creationType);
 const membershipRole=data.world?.membership_role;
 const canEdit=Boolean(U.canEditWorldContent?.(data.world));
 const isReviewer=membershipRole==="reviewer";
 const statusName={draft:"草稿",testing:"测试中",published:"已发布"};
 const checks=worldStore.get().cloudCreatorChecks||[];
 const quickActions=canEdit?`<div class="row writer-hero-actions"><button class="primary-btn" data-action="deepseek-pipeline">AI 剧本创作</button><button class="secondary-btn" data-action="story-manuscript">完整剧情</button><button class="secondary-btn" data-action="story-assistant">规则分类器</button><button class="secondary-btn" data-action="creator-import">导入内容</button><button class="secondary-btn" data-action="creator-export">导出备份</button><button class="secondary-btn" data-action="publish-impact-preview">发布影响预览</button><button class="secondary-btn" data-action="creator-preview">玩家视角模拟</button><button class="secondary-btn" data-action="creator-check">运行发布检查</button><button class="primary-btn" data-action="creator-snapshot">＋ 保存创作版本</button></div>`:`<div class="row writer-hero-actions">${isReviewer?'<button class="primary-btn" data-action="creator-review">打开协作者审稿</button><button class="secondary-btn" data-action="story-manuscript">只读完整母稿</button>':""}<button class="secondary-btn" data-action="creator-preview">玩家视角模拟</button></div>`;
 const archiveMap=archiveMapFromList(worldStore.get().cloudRoleArchives||[]);
 const selectedRoleId=data.roles.some((role)=>role.id===uiStore.get().writerSelectedRoleId)?uiStore.get().writerSelectedRoleId:data.roles[0]?.id||null;
 const selectedRole=data.roles.find((role)=>role.id===selectedRoleId)||null;
 const roleRail=writerRoleRailHtml(data.roles,data.sections,selectedRoleId);
 const roleWorkspace=writerRoleWorkspaceHtml(data,selectedRole,archiveMap[selectedRoleId],statusName);
 const chapterBody=data.chapters.map((chapter,index)=>`<div class="chapter-control"><div><strong>${chapter.sequence ?? index + 1}. ${chapter.title}</strong><p>${chapter.summary||"尚未补充章节摘要"}</p></div><span class="status-chip ${chapter.publication_status}">${statusName[chapter.publication_status]}</span>${canEdit?`<div class="row"><button class="text-btn" data-action="creator-edit-chapter" data-chapter="${chapter.id}">设置</button><button class="text-btn danger-text" data-action="creator-delete-chapter" data-chapter="${chapter.id}">删除</button></div>`:""}</div>`).join("")||`<div class="empty-state">${canEdit?"请先在剧情编排中新增章节。":"当前没有可供审阅的章节。"}</div>`;
 const testBody=`${checks.length?checks.map(check=>`<div class="check-result ${check.level}"><b>${check.title}</b><span>${check.detail}</span></div>`).join(""):`<div class="empty-state">点击“运行发布检查”生成真实云端报告。</div>`}<button class="secondary-btn full-btn" data-go="player">打开独立玩家端</button><button class="text-btn full-btn" style="margin-top:8px" data-action="creator-preview"${selectedRoleId?` data-role="${escapeHtml(selectedRoleId)}"`:""}>预览当前角色私人剧本（无需运行房）</button>`;
 const versionBody=data.versions.map(version=>`<div class="version-row"><div><strong>${version.label}</strong><p>${formatTime(version.created_at)}</p></div>${canEdit?`<div class="row"><button class="text-btn" data-action="creator-restore" data-version="${version.id}">恢复</button><button class="text-btn" data-action="creator-delete-version" data-version="${version.id}">删除</button></div>`:""}</div>`).join("")||`<div class="empty-state">尚未保存创作快照。</div>`;
 const accessBanner=isReviewer?`<section class="demo-strip catalog-experience-strip"><div><span class="cloud-pill">受邀审稿 · 只读</span><strong style="margin-top:7px">你可以查看私有草稿并提交审稿意见</strong><p>正文、角色档案和版本内容不可由此身份修改或导出；审稿意见仅作者、编辑和受邀审稿人可见。</p></div></section>`:catalogExperienceBanner(data.world);
 const toolboxItems=[membershipRole==="owner"?creatorTool("协作权限","邀请成员并分配编辑、审稿、主持或玩家权限","creator-collaboration","管理成员 →"):"",["owner","editor","reviewer"].includes(membershipRole)?creatorTool("协作者审稿","批注、修改建议、版本对比与影响范围检查","creator-review","打开审稿台 →"):"",["owner","editor","host"].includes(membershipRole)?creatorTool("运行日志","筛选阅读、调查、规则触发与主持操作记录","creator-logs","查看日志 →"):"",canEdit?creatorTool("文档解析","解析 TXT、Markdown、DOCX、PDF 或飞书稿件，预览后结构化写入","creator-document-parser","解析文档 →"):""].join("");
 return `${accessBanner}<section class="writer-hero"><div><p class="section-kicker">SCRIPTED NARRATIVE CREATOR</p><h2>${escapeHtml(terms.work)}${isReviewer?"审稿":"创作"}中心</h2><p>${isReviewer?"逐项查看角色档案、私人分幕和版本差异，并把问题记录为可追踪的审稿意见。":`<strong>AI ${escapeHtml(terms.work)}创作</strong>为八层生成流程：立项 → 真相 → ${escapeHtml(terms.roleShort)} → 信息矩阵 → ${escapeHtml(terms.host)}手册 → 逐幕正文 → 评判 → 入库。可分步中断与锁定复用；草稿仅存本机，确认后再上传云端。`}</p></div>${collapsibleCard({ id: "writer:quick-actions", title: "快捷操作", subtitle: canEdit?"AI 创作、导入导出、检查与版本":"只读预览与审稿", body: quickActions, defaultOpen: true, className: "collapse-panel-bare", nested: true })}</section>
 ${isReviewer?"":contentLayerMapHtml({ open: false })}
 <section class="writer-grid">
  <article class="card writer-main"><div class="section-head"><div><h3>${escapeHtml(terms.roleShort)}工作台</h3><p>选择一个${escapeHtml(terms.roleShort)}，在同一上下文中维护基础信息、创作档案、私人分幕和玩家预览。</p></div><button class="secondary-btn" data-action="load-writer-archives">刷新档案</button></div>
   <div class="writer-role-workbench">
    <aside class="writer-role-rail"><div class="writer-role-rail-head"><strong>${escapeHtml(terms.roleShort)}列表</strong>${canEdit?'<button class="text-btn" data-action="creator-add-role">＋ 新增</button>':""}</div><div class="writer-role-tabs" role="tablist">${roleRail||`<div class="empty-state">尚无${escapeHtml(terms.roleShort)}</div>`}</div></aside>
    ${roleWorkspace}
   </div>
  </article>
  <aside class="writer-side">
   ${collapsibleCard({ id: "writer:chapters", title: `${terms.act}发布控制`, subtitle: `草稿不会进入玩家房间。删除${terms.act}会重排序号，并移除绑定内容与相关自动化规则。`, body: chapterBody, defaultOpen: true })}
   ${collapsibleCard({ id: "writer:player-test", title: "玩家视角测试", subtitle: "发布前检查缺失内容与孤立节点。", body: testBody, defaultOpen: false, style: "margin-top:14px" })}
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

export async function openCollaboration(){
 try{
  const members=await zhimuApi.getWorldMembers();
  const pending=await zhimuApi.getWorldMemberInvites();
  const roleName={owner:"主创作者",editor:"协作者",reviewer:"只读审稿人",host:"主持人",viewer:"只读玩家"};
  const pendingRows=pending.map(invite=>`<div class="collab-row pending"><div><b>${escapeHtml(invite.email)}</b><p>待接受 · ${roleName[invite.role]} · 过期 ${formatTime(invite.expires_at)}</p></div><div class="row"><button class="text-btn" data-resend-invite="${invite.id}">重发邮件</button><button class="text-btn danger-text" data-revoke-invite="${invite.id}">撤销</button></div></div>`).join("");
  modal.className="modal creator-tool-modal";
  const memberRows=members.map(member=>`<div class="collab-row"><div><b>${escapeHtml(member.display_name)}</b><p>${escapeHtml(member.email||"—")} · ${roleName[member.role]}</p></div>${member.role==="owner"?`<span class="cloud-pill">OWNER</span>`:`<div class="row"><select class="field compact-field" data-member-role="${member.user_id}">${["editor","reviewer","host","viewer"].map(role=>`<option value="${role}" ${role===member.role?"selected":""}>${roleName[role]}</option>`).join("")}</select><button class="text-btn danger-text" data-remove-member="${member.user_id}">移除</button></div>`}</div>`).join("");
  setHtml(modal,collaborationModalHtml({memberRowsHtml:memberRows,pendingRowsHtml:pendingRows}));
  modalBackdrop.classList.add("show");
  modal.querySelector("[data-close]").onclick=closeModal;
  const handleErr=(error)=>handleApiErrorToast(error, showToast);
  modal.querySelector("[data-add-member]").onclick=async()=>{try{const result=await zhimuApi.addWorldMember({email:modal.querySelector("[data-member-email]").value,role:modal.querySelector("[data-member-new-role]").value});closeModal();if(result?.pendingInvite){showToast(result.emailSent?"邀请邮件已发送":result.inviteToken?"邀请已创建（邮件未配置，请手动分享链接）":"邀请已创建");if(result.inviteToken&&navigator.clipboard)try{await navigator.clipboard.writeText(`${location.origin}${location.pathname}?invite=${encodeURIComponent(result.inviteToken)}`);showToast("邀请链接已复制")}catch{}}else showToast("协作成员已加入");openCollaboration()}catch(error){handleErr(error)}};
  modal.querySelectorAll("[data-member-role]").forEach(select=>select.onchange=async()=>{try{await zhimuApi.updateWorldMember(select.dataset.memberRole,select.value);showToast("成员权限已更新")}catch(error){handleErr(error)}});
  modal.querySelectorAll("[data-remove-member]").forEach(button=>button.onclick=async()=>{try{await zhimuApi.deleteWorldMember(button.dataset.removeMember);closeModal();showToast("协作成员已移除");openCollaboration()}catch(error){handleErr(error)}});
  modal.querySelectorAll("[data-resend-invite]").forEach(button=>button.onclick=async()=>{try{const result=await zhimuApi.resendWorldInvite(button.dataset.resendInvite);showToast(result.emailSent?"邀请邮件已重发":"已刷新邀请（请手动分享链接）");openCollaboration()}catch(error){handleErr(error)}});
  modal.querySelectorAll("[data-revoke-invite]").forEach(button=>button.onclick=async()=>{try{await zhimuApi.revokeWorldInvite(button.dataset.revokeInvite);showToast("待接受邀请已撤销");openCollaboration()}catch(error){handleErr(error)}});
 }catch(error){showError(error)}
}

function creatorReviewTargetOptions(studio = {}, { truthClaims = [], segments = [] } = {}) {
 const groups = [
  ["world", [{ id: "", label: "整个剧本" }]],
  ["manuscript", [{ id: "", label: "完整剧情母稿" }]],
  ["role", (studio.roles || []).map((item) => ({ id: item.id, label: `角色 · ${item.name}` }))],
  ["chapter", (studio.chapters || []).map((item) => ({ id: item.id, label: `章节 · ${item.title}` }))],
  ["script_section", (studio.sections || []).map((item) => ({ id: item.id, label: `私人分幕 · ${item.title}` }))],
  ["scene", (studio.scenes || []).map((item) => ({ id: item.id, label: `场景 · ${item.name}` }))],
  ["clue", (studio.clues || []).map((item) => ({ id: item.id, label: `线索 · ${item.name}` }))],
  ["rule", (studio.rules || []).map((item) => ({ id: item.id, label: `规则 · ${item.name}` }))],
  ["truth_claim", truthClaims.map((item) => ({ id: item.id, label: `真相 · ${item.title || item.claim_key}` }))],
  ["segment", segments.map((item) => ({ id: item.id, label: `运行段落 · ${item.title || item.segment_key}` }))]
 ];
 return groups.flatMap(([type, rows]) => rows.map((item) => ({ type, ...item })));
}

function creatorReviewImpactText(impact) {
 const counts = impact?.counts || {};
 const entries = Object.entries(counts).filter(([, value]) => Number(value) > 0);
 return entries.length ? entries.map(([key, value]) => `${key} ${value}`).join(" · ") : "未发现直接结构引用";
}

function creatorReviewRowsHtml(reviews, canResolve) {
 const repliesByParent = new Map();
 for (const review of reviews.filter((item) => item.parent_id)) {
  if (!repliesByParent.has(review.parent_id)) repliesByParent.set(review.parent_id, []);
  repliesByParent.get(review.parent_id).push(review);
 }
 const statusLabel = { open: "待处理", resolved: "已解决", dismissed: "已驳回" };
 const severityLabel = { note: "备注", minor: "轻微", major: "重要", blocking: "阻塞" };
 const roots = reviews.filter((item) => !item.parent_id);
 if (!roots.length) return `<div class="empty-state">当前筛选下还没有审稿意见。</div>`;
 return roots.map((review) => {
  const replies = (repliesByParent.get(review.id) || []).map((reply) => `<div class="log-row"><div><b>${escapeHtml(reply.created_by_name)}</b><span>${formatTime(reply.created_at)}</span></div><p>${escapeHtml(reply.body)}</p></div>`).join("");
  const actions = canResolve
   ? review.status === "open"
    ? `<button class="text-btn" data-review-status="resolved" data-review-id="${escapeHtml(review.id)}">标记解决</button><button class="text-btn danger-text" data-review-status="dismissed" data-review-id="${escapeHtml(review.id)}">驳回</button>`
    : `<button class="text-btn" data-review-status="open" data-review-id="${escapeHtml(review.id)}">重新打开</button>`
   : "";
  const suggestion = Object.keys(review.suggested_patch || {}).length
   ? `<details><summary>结构化修改建议</summary><pre>${escapeHtml(JSON.stringify(review.suggested_patch, null, 2))}</pre></details>` : "";
  return `<article class="card-lite review-thread"><div class="section-head"><div><p class="section-kicker">${escapeHtml(review.target_label || review.target_type)} · ${severityLabel[review.severity] || review.severity}</p><h4>${escapeHtml(review.title || "未命名审稿意见")}</h4></div><span class="status-chip ${review.status === "open" ? "testing" : "published"}">${statusLabel[review.status] || review.status}</span></div><p>${escapeHtml(review.body)}</p><p class="muted-note">${escapeHtml(review.created_by_name)} · ${formatTime(review.created_at)} · 影响范围：${escapeHtml(creatorReviewImpactText(review.impact_scope))}</p>${suggestion}${replies}<label>回复</label><textarea class="field" rows="2" data-review-reply-body="${escapeHtml(review.id)}" placeholder="补充讨论或确认修改结果"></textarea><div class="row"><button class="text-btn" data-review-reply="${escapeHtml(review.id)}">发送回复</button>${actions}</div></article>`;
 }).join("");
}

function creatorVersionDiffHtml(payload) {
 const summary = payload?.comparison?.summary || {};
 const changedDomains = Object.entries(payload?.comparison?.domains || {})
  .filter(([, value]) => value.counts.added || value.counts.removed || value.counts.changed)
  .map(([key, value]) => `<li><strong>${escapeHtml(key)}</strong>：新增 ${value.counts.added} · 删除 ${value.counts.removed} · 修改 ${value.counts.changed}${value.truncated ? " · 仅显示前 100 项" : ""}</li>`)
  .join("");
 return `<div class="assistant-preview"><h4>${escapeHtml(payload.base.label)} → ${escapeHtml(payload.head.label)}</h4><div class="proposal-stats"><span>新增 ${summary.added || 0}</span><span>删除 ${summary.removed || 0}</span><span>修改 ${summary.changed || 0}</span></div>${payload.comparison.world.changed ? `<p>剧本级字段：${escapeHtml(payload.comparison.world.fields.join("、"))}</p>` : ""}<ul>${changedDomains || "<li>两个版本没有结构差异。</li>"}</ul><p class="muted-note">为降低泄稿风险，这里只显示对象和字段级变化，不直接展开私人正文。</p></div>`;
}

export async function openCreatorReview() {
 try {
  const studio = studioStore.get().cloudStudio;
  const [truthPayload, segmentPayload] = await Promise.all([
   zhimuApi.getTruthClaims(),
   zhimuApi.getWorldSegments()
  ]);
  const targets = creatorReviewTargetOptions(studio, {
   truthClaims: truthPayload?.claims || [],
   segments: segmentPayload?.segments || []
  });
  const membershipRole = studio?.world?.membership_role;
  const canResolve = ["owner", "editor"].includes(membershipRole);
  const versions = studio?.versions || [];
  const targetOptions = targets.map((item) => `<option value="${escapeHtml(`${item.type}:${item.id}`)}">${escapeHtml(item.label)}</option>`).join("");
  const versionOptions = versions.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)} · ${formatTime(item.created_at)}</option>`).join("");
  modal.className = "modal creator-tool-modal creator-review-modal";
  setHtml(modal, `<h2>协作者审稿</h2><p class="wizard-intro">发行编辑、共同作者和只读审稿人可提交批注或修改建议；系统会检查目标归属并计算影响范围。只有主创作者或编辑者能将意见标记为解决/驳回。</p><div class="form-group"><label>审稿对象</label><select class="field" data-review-target>${targetOptions}</select><div class="row"><select class="field compact-field" data-review-kind><option value="comment">批注</option><option value="suggestion">修改建议</option><option value="change_request">必须修改</option></select><select class="field compact-field" data-review-severity><option value="note">备注</option><option value="minor">轻微</option><option value="major">重要</option><option value="blocking">阻塞交付</option></select></div><input class="field" data-review-title placeholder="意见标题"><textarea class="field" rows="3" data-review-body placeholder="说明问题、修改理由和验收标准"></textarea><textarea class="field" rows="2" data-review-suggestion placeholder='结构化建议 JSON（选填，如 {"publicationStatus":"draft"}）'></textarea><button class="primary-btn" data-review-create>提交审稿意见</button></div><section style="margin-top:16px"><div class="section-head"><div><h3>意见列表</h3><p>默认显示待处理意见及其讨论。</p></div><select class="field compact-field" data-review-filter><option value="open">待处理</option><option value="">全部</option><option value="resolved">已解决</option><option value="dismissed">已驳回</option></select></div><div class="host-detail-list" data-review-list><div class="empty-state">正在加载…</div></div></section><section style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line,#ece7df)"><h3>版本影响对比</h3><p class="muted-note">选择一个基准快照，对比当前内容或另一个快照。</p><div class="row"><select class="field" data-review-base-version ${versions.length ? "" : "disabled"}>${versionOptions || '<option value="">尚无版本快照</option>'}</select><select class="field" data-review-head-version ${versions.length ? "" : "disabled"}><option value="">当前内容</option>${versionOptions}</select><button class="secondary-btn" data-review-compare ${versions.length ? "" : "disabled"}>开始对比</button></div><div data-review-diff></div></section><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`);
  modalBackdrop.classList.add("show");
  modal.querySelector("[data-close]").onclick = closeModal;
  const draw = async () => {
   const payload = await zhimuApi.getCreatorReviews({ status: modal.querySelector("[data-review-filter]").value });
   setHtml(modal.querySelector("[data-review-list]"), creatorReviewRowsHtml(payload.reviews || [], canResolve));
   modal.querySelectorAll("[data-review-reply]").forEach((button) => button.onclick = async () => {
    const body = modal.querySelector(`[data-review-reply-body="${button.dataset.reviewReply}"]`)?.value?.trim();
    if (!body) return showToast("请填写回复内容");
    button.disabled = true;
    try { await zhimuApi.replyCreatorReview(button.dataset.reviewReply, body); await draw(); showToast("回复已提交"); } catch (error) { showError(error); } finally { if (button.isConnected) button.disabled = false; }
   });
   modal.querySelectorAll("[data-review-status]").forEach((button) => button.onclick = async () => {
    button.disabled = true;
    try { await zhimuApi.patchCreatorReview(button.dataset.reviewId, { status: button.dataset.reviewStatus }); await draw(); showToast("审稿状态已更新"); } catch (error) { showError(error); } finally { if (button.isConnected) button.disabled = false; }
   });
  };
  modal.querySelector("[data-review-filter]").onchange = () => draw().catch(showError);
  modal.querySelector("[data-review-create]").onclick = async () => {
   const [targetType, targetId = ""] = modal.querySelector("[data-review-target]").value.split(":");
   const selected = targets.find((item) => item.type === targetType && item.id === targetId);
   const body = modal.querySelector("[data-review-body]").value.trim();
   if (!body) return showToast("请填写审稿意见");
   let suggestedPatch = {};
   const rawSuggestion = modal.querySelector("[data-review-suggestion]").value.trim();
   if (rawSuggestion) {
    try { suggestedPatch = JSON.parse(rawSuggestion); } catch { return showToast("结构化建议必须是有效 JSON 对象"); }
    if (!suggestedPatch || Array.isArray(suggestedPatch) || typeof suggestedPatch !== "object") return showToast("结构化建议必须是 JSON 对象");
   }
  const payload = { targetType, targetLabel: selected?.label || targetType, kind: modal.querySelector("[data-review-kind]").value, severity: modal.querySelector("[data-review-severity]").value, title: modal.querySelector("[data-review-title]").value.trim(), body, suggestedPatch };
  if (targetId) payload.targetId = targetId;
   const createButton = modal.querySelector("[data-review-create]");
   createButton.disabled = true;
   try { await zhimuApi.createCreatorReview(payload); modal.querySelector("[data-review-title]").value = ""; modal.querySelector("[data-review-body]").value = ""; modal.querySelector("[data-review-suggestion]").value = ""; modal.querySelector("[data-review-filter]").value = "open"; await draw(); showToast("审稿意见已提交"); } catch (error) { showError(error); } finally { if (createButton.isConnected) createButton.disabled = false; }
  };
  modal.querySelector("[data-review-compare]").onclick = async () => {
   const base = modal.querySelector("[data-review-base-version]").value;
   const head = modal.querySelector("[data-review-head-version]").value;
   if (!base) return showToast("请先保存至少一个创作版本");
   try { const payload = await zhimuApi.compareCreatorVersions(base, head); setHtml(modal.querySelector("[data-review-diff]"), creatorVersionDiffHtml(payload)); } catch (error) { showError(error); }
  };
  await draw();
 } catch (error) { showError(error); }
}

export async function openWorldLogs(){
 try{
  const draw=async()=>{const params={limit:"100"},eventType=modal.querySelector("[data-log-event]")?.value,keyword=modal.querySelector("[data-log-keyword]")?.value;if(eventType)params.eventType=eventType;if(keyword)params.keyword=keyword;const logs=await zhimuApi.getWorldLogs(params);setHtml(modal.querySelector("[data-log-list]"),logs.map(log=>`<div class="log-row"><div><b>${escapeHtml(log.event_type)}</b><span>${escapeHtml(log.room_name)}</span></div><p>${escapeHtml(log.message)}</p><small>${escapeHtml(log.actor_name||"系统")} · ${formatTime(log.created_at)}</small></div>`).join("")||`<div class="empty-state">没有匹配的运行日志。</div>`)};
  modal.className="modal creator-tool-modal";setHtml(modal,worldLogModalHtml());
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-log-refresh]").onclick=draw;await draw();
 }catch(error){showError(error)}
}

export function openDocumentParser(){return openDocumentWorkspace()}

const AiDraft=()=>window.zhimuAiDraft;
function aiDraftWorldId(){return zhimuApi.context?.worldId||""}
function collectAiFormFields(){const v=studioValues();return {aiTitle:v.aiTitle,aiPremise:v.aiPremise,aiChapterCount:v.aiChapterCount,aiWordsPerChapter:v.aiWordsPerChapter,aiConflicts:v.aiConflicts}}
function restoreAiFormFields(form){if(!form||!modal)return;for(const [field,value] of Object.entries(form)){const el=modal.querySelector(`[data-studio-field="${field}"]`);if(el&&value!=null&&value!=="")el.value=value}}
function saveLocalAiDraft(kind,payload,{silent=false}={}){const worldId=aiDraftWorldId();if(!worldId)return null;const result=AiDraft()?.save(worldId,kind,payload);if(!result?.ok&&!silent)showToast(result?.error==="DRAFT_TOO_LARGE"?"本地草稿过大，请精简分幕后再保存":"无法写入浏览器本地存储");return result}
function loadLocalAiDraft(kind){return AiDraft()?.load(aiDraftWorldId(),kind)||null}
function clearLocalAiDraft(kind){AiDraft()?.clear(aiDraftWorldId(),kind)}
function aiLocalDraftNote(savedAt){return savedAt?`<p class="muted-note local-draft-note">已保存到本机浏览器，尚未上传云端 · ${formatRelativeTime(savedAt)||formatTime(savedAt)}</p>`:""}
function aiLocalDraftActions(kind){return `<button class="text-btn" type="button" data-ai-draft-clear>清除本地草稿</button>`}
function bindAiDraftClear(kind,onClear){const btn=modal.querySelector("[data-ai-draft-clear]");if(!btn)return;btn.onclick=()=>{clearLocalAiDraft(kind);onClear?.();showToast("已清除本地 AI 草稿")}}


export async function openDeepseekAssistant(){
 return openDeepseekPipeline({focusLayer:"structure",mode:"interactive"});
}

export async function openDeepseekFullMystery(){
 return openDeepseekPipeline({mode:"auto"});
}

export function deepseekProposalPreview(result){const proposal=result.proposal,plan=proposal.writingPlan||{};return `<section class="assistant-preview deepseek-preview"><div class="section-head"><div><p class="section-kicker">${escapeHtml(result.model)}</p><h3>${escapeHtml(proposal.title||"未命名提案")}</h3><p>${escapeHtml(proposal.logline||"")}</p></div><span class="cloud-pill local">本地草稿 · 未上传云端</span></div><div class="proposal-stats"><span>${proposal.chapters.length} 章</span><span>${proposal.scenes.length} 场景</span><span>${proposal.investigationPoints.length} 调查点</span><span>${proposal.clues.length} 线索</span><span>${proposal.edges.length} 连线</span><span>${Number(plan.targetWordCount||result.brief?.targetWordCount||0)} 字建议</span></div><div class="proposal-chapters">${proposal.chapters.map(chapter=>`<article><b>${chapter.sequence}. ${escapeHtml(chapter.title)}</b><p>${escapeHtml(chapter.summary||"")}</p><small>建议字数：${Number((plan.chapterWordBudgets||[]).find(item=>item.chapterKey===chapter.key)?.targetWordCount||0)} 字</small></article>`).join("")}</div><div class="assistant-suggestions"><b>AI 写作建议</b>${proposal.suggestions.map(item=>`<p>· ${escapeHtml(item)}</p>`).join("")}</div></section>`}

function deepseekMysteryPreview(result){const pkg=result.package||{},roles=pkg.roles||[];return `<section class="assistant-preview deepseek-preview"><div class="section-head"><div><p class="section-kicker">${escapeHtml(result.model||"DeepSeek")} · 整本悬疑包</p><h3>${escapeHtml(pkg.title||"未命名剧本")}</h3><p>${escapeHtml(pkg.summary||"")}</p></div><span class="cloud-pill local">本地草稿 · 未上传云端</span></div><div class="proposal-stats"><span>${roles.length} 角色</span><span>${(result.proposal?.chapters||[]).length} 章结构</span><span>${(result.proposal?.scenes||[]).length} 场景</span><span>${(pkg.overallManuscript||"").length} 字母稿</span></div><div class="proposal-chapters">${roles.slice(0,6).map((role)=>`<article><b>${escapeHtml(role.name)}</b><p>${escapeHtml((role.publicProfile||"").slice(0,120))}</p><small>${(role.sections||[]).length} 段私人正文</small></article>`).join("")}</div><div class="assistant-suggestions"><b>逻辑线说明</b>${(pkg.logicNotes||[]).slice(0,6).map((item)=>`<p>· ${escapeHtml(item)}</p>`).join("")||"<p>· 无</p>"}</div></section>`}

const PipelineWizard=()=>window.zhimuPipelineWizard;
export async function openDeepseekPipeline(options){return PipelineWizard()?.openDeepseekPipeline(options)}
function pipelineEvaluationPreview(evaluation){return PipelineWizard()?.pipelineEvaluationPreview(evaluation)||""}
function pipelineStepLabel(step){return PipelineWizard()?.pipelineStepLabel(step)||step}
function pipelinePreviewHtml(session){return PipelineWizard()?.pipelinePreviewHtml(session)||""}

export function openStoryAssistant(){
 modal.className="modal story-assistant-modal";setHtml(modal,storyAssistantModalHtml());
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;const text=()=>modal.querySelector("[data-story-draft]").value.trim(),preview=modal.querySelector("[data-assistant-preview]"),commit=modal.querySelector("[data-assistant-import]");
 modal.querySelector("[data-assistant-analyze]").onclick=async()=>{try{const result=await zhimuApi.analyzeStoryDraft(text());setHtml(preview,storyAssistantPreview(result));commit.disabled=!result.nodes.length;showToast(`已识别 ${result.nodes.length} 个剧情节点`)}catch(error){showError(error)}};
 commit.onclick=async()=>{try{commit.disabled=true;const result=await zhimuApi.importStoryDraft(text());closeModal();await loadCloudData();go("studio");showToast(`已生成 ${result.nodes.length} 个节点和 ${result.edges.length} 条连线`)}catch(error){commit.disabled=false;showError(error)}};
}

export function storyAssistantPreview(result){const typeName={scene:"场景",clue:"线索",investigation_point:"调查点"};return `<section class="assistant-preview"><div class="section-head"><div><h3>分类预览</h3><p>${result.nodes.length} 个节点 · ${result.edges.length} 条建议连线</p></div></div><div class="assistant-node-grid">${result.nodes.map(node=>`<article><span>${typeName[node.type]}</span><b>${escapeHtml(node.name)}</b><p>${escapeHtml(node.text)}</p></article>`).join("")}</div><div class="assistant-suggestions"><b>写作建议</b>${result.suggestions.map(item=>`<p>· ${escapeHtml(item)}</p>`).join("")}</div></section>`}

export function openCreatorPreview(roleId=""){
 const data=studioStore.get().cloudStudio,roles=data.roles;if(!roles.length)return showToast("请先创建角色");
 const defaultRoleId=roles.some((role)=>role.id===roleId)?roleId:(roles.some((role)=>role.id===uiStore.get().writerSelectedRoleId)?uiStore.get().writerSelectedRoleId:roles[0]?.id||"");
 modal.className="modal preview-modal";setHtml(modal,creatorPreviewModalHtml(`${studioSelect("模拟角色","previewRole",roles,defaultRoleId)}${studioSelect("公共章节","previewChapter",[{id:"",name:"全部章节"},...data.chapters],"")}`));
 const statusName={draft:"草稿",testing:"测试中",published:"已发布"};
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;const draw=()=>{const roleId=modal.querySelector('[data-studio-field="previewRole"]').value,chapterId=modal.querySelector('[data-studio-field="previewChapter"]').value,role=roles.find(item=>item.id===roleId),sections=data.sections.filter(section=>section.role_slot_id===roleId&&(!chapterId||section.chapter_id===chapterId));const sectionRows=sections.map(section=>`<article class="preview-section"><span class="status-chip ${section.publication_status}">${statusName[section.publication_status]||"草稿"}</span><h3>${escapeHtml(section.title)}</h3><div>${escapeHtml(section.body).replace(/\n/g,"<br>")}</div></article>`).join("");setHtml(modal.querySelector("[data-preview-body]"),creatorPreviewBodyHtml({roleNameHtml:escapeHtml(role.name),privateProfileHtml:escapeHtml(role.private_profile||"尚未补充角色秘密"),sectionRowsHtml:sectionRows}))};modal.querySelectorAll("select").forEach(select=>select.onchange=draw);draw();
}

export function openPublishImpactPreview(){return openImpactWorkspace()}

export async function openCreatorExport(){return openExportWorkspace()}
export async function exportCreatorPackage(){return openCreatorExport()}

export function openCreatorImport(){return openImportWorkspace()}
export async function importCreatorPackage(){return runImportWorkspace()}

export function createCreatorSnapshot(){studioModal("保存创作版本",studioField("版本名称","label","input",`创作快照 ${new Date().toLocaleString("zh-CN")}`),"保存快照",async()=>{try{await zhimuApi.createContentVersion(studioValues());closeModal();await loadCloudData();showToast("创作版本已保存")}catch(error){showError(error)}})}
export async function restoreCreatorSnapshot(versionId){try{await zhimuApi.restoreContentVersion(versionId);await loadCloudData();showToast("已恢复该版本的正文与发布状态")}catch(error){showError(error)}}
export async function deleteCreatorSnapshot(versionId){try{await zhimuApi.deleteContentVersion(versionId);await loadCloudData();showToast("创作版本记录已删除")}catch(error){showError(error)}}

export const writerViewApi = { writer, loadWriterRoleArchives, selectWriterRole, createCreatorSnapshot, restoreCreatorSnapshot, deleteCreatorSnapshot, creatorTool, openCreatorSection, closeWriterSectionEditor, saveWriterSectionEditor, deleteWriterSectionEditor, discardWriterSectionDraft, replaceWriterSectionText, formatWriterSectionText, switchWriterSection, bindWriterSectionEditor, bindWriterMetadataEditor, closeWriterMetadataEditor, saveWriterMetadataEditor, deleteWriterRoleEditor, bindWriterToolWorkspace, closeWriterToolWorkspace, saveManuscriptWorkspace, syncManuscriptFromGraphWorkspace, syncManuscriptToGraphWorkspace, parseDocumentWorkspace, importDocumentWorkspace, nextExportWorkspaceStep, previousExportWorkspaceStep, runExportWorkspace, previewImportWorkspace, runImportWorkspace, openCreatorRole, openCreatorChapter, deleteCreatorChapter, runCreatorChecks, openStoryManuscript, openCollaboration, openCreatorReview, openWorldLogs, openDocumentParser, openDeepseekAssistant, openDeepseekPipeline, openDeepseekFullMystery, deepseekProposalPreview, openStoryAssistant, storyAssistantPreview, openCreatorPreview, openPublishImpactPreview, openCreatorExport, exportCreatorPackage, openCreatorImport, importCreatorPackage };
registerView("writer", writerViewApi);
