/* Auto-split from app.js — writer.js */
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
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
  window.zhimuViews = window.zhimuViews || {};
  const viewExports = window.zhimuViews.writer = window.zhimuViews.writer || {};
function writer(){
 const data=state.cloudStudio;
 if(!data)return U.creatorWorkspaceEmpty?.({title:"剧本杀创作中心",kicker:"SCRIPTED MYSTERY CREATOR",intro:"为每位玩家编写私人分幕，并控制公共章节的发布节奏。尚未选择剧本时，可先浏览公开库或创建新世界。",guideTitle:"开始创作",guideItems:[{label:"角色稿",title:"私人分幕正文",text:"每位玩家只看到自己的章节与秘密。",bullets:["按角色席位管理分幕","支持 Markdown","草稿 / 测试中 / 已发布"]},{label:"章节",title:"公共章节",text:"控制玩家何时能看到下一章信息。",bullets:["主持人确认或自动解锁","与规则引擎联动"]},{label:"工具",title:"导入导出与 AI",text:"备份、迁移与辅助生成剧情结构。",bullets:["内容包导入导出","AI 悬疑创作向导"]}]})||`<section class="card"><h3>尚未选择剧本</h3><p><button class="primary-btn" data-action="open-catalog">浏览公开剧本库</button></p></section>`;
 const statusName={draft:"草稿",testing:"测试中",published:"已发布"};
 const checks=state.cloudCreatorChecks||[];
 return `${catalogExperienceBanner(data.world)}<section class="writer-hero"><div><p class="section-kicker">SCRIPTED MYSTERY CREATOR</p><h2>剧本杀创作中心</h2><p>AI 悬疑创作已合并为<strong>一个入口</strong>：可选「分步参与」（每层改完再进下一步）或「一键串行」（自动生成全部层级，生成完再改）。内容仅存本机，点上传才写入云端。</p></div><div class="row"><button class="primary-btn" data-action="deepseek-pipeline">AI 悬疑创作</button><button class="secondary-btn" data-action="story-manuscript">完整剧情</button><button class="secondary-btn" data-action="story-assistant">规则分类器</button><button class="secondary-btn" data-action="creator-import">导入内容</button><button class="secondary-btn" data-action="creator-export">导出备份</button><button class="secondary-btn" data-action="creator-preview">玩家视角模拟</button><button class="secondary-btn" data-action="creator-check">运行发布检查</button><button class="primary-btn" data-action="creator-snapshot">＋ 保存创作版本</button></div></section>
 <section class="writer-grid">
  <article class="card writer-main"><div class="section-head"><div><h3>角色私人剧本</h3><p>每个角色拥有独立分幕正文，玩家进入房间后只会读取自己的内容。</p></div><button class="secondary-btn" data-action="creator-add-role">＋ 新增角色</button></div>
   ${data.roles.map(role=>`<section class="role-manuscript"><div class="role-manuscript-head"><div><span class="asset-type">角色席位</span><h3>${role.name}</h3><p>${role.public_profile||"尚未补充公开身份"}</p></div><div class="row"><button class="secondary-btn" data-action="creator-edit-role" data-role="${role.id}">编辑席位</button><button class="primary-btn" data-action="creator-add-section" data-role="${role.id}">＋ 新增一幕</button></div></div>
   <div class="manuscript-list">${data.sections.filter(section=>section.role_slot_id===role.id).map(section=>`<div class="manuscript-row"><div><strong>${section.sequence}. ${section.title}</strong><p>${section.body.slice(0,86)}${section.body.length>86?"...":""}</p></div><span class="status-chip ${section.publication_status}">${statusName[section.publication_status]}</span><button class="secondary-btn" data-action="creator-edit-section" data-role="${role.id}" data-section="${section.id}">编辑</button></div>`).join("")||`<div class="empty-state">尚无正文。先新增角色序章或第一幕。</div>`}</div></section>`).join("")}
  </article>
  <aside class="writer-side">
   <article class="card"><div class="section-head"><div><h3>章节发布控制</h3><p>草稿不会进入玩家房间。</p></div></div>${data.chapters.map(chapter=>`<div class="chapter-control"><div><strong>${chapter.sequence}. ${chapter.title}</strong><p>${chapter.summary||"尚未补充章节摘要"}</p></div><span class="status-chip ${chapter.publication_status}">${statusName[chapter.publication_status]}</span><button class="text-btn" data-action="creator-edit-chapter" data-chapter="${chapter.id}">设置</button></div>`).join("")||`<div class="empty-state">请先在剧情编排中新增章节。</div>`}</article>
   <article class="card" style="margin-top:14px"><div class="section-head"><div><h3>玩家视角测试</h3><p>发布前检查缺失内容与孤立节点。</p></div></div>${checks.length?checks.map(check=>`<div class="check-result ${check.level}"><b>${check.title}</b><span>${check.detail}</span></div>`).join(""):`<div class="empty-state">点击“运行发布检查”生成真实云端报告。</div>`}<button class="secondary-btn full-btn" data-go="player">进入运行房 · 玩家视角</button><button class="text-btn full-btn" style="margin-top:8px" data-action="creator-preview">仅预览私人剧本（无需运行房）</button></article>
   <article class="card" style="margin-top:14px"><div class="section-head"><div><h3>创作版本历史</h3><p>保存关键节点，需要时恢复正文与发布状态。</p></div></div>${data.versions.map(version=>`<div class="version-row"><div><strong>${version.label}</strong><p>${formatTime(version.created_at)}</p></div><div class="row"><button class="text-btn" data-action="creator-restore" data-version="${version.id}">恢复</button><button class="text-btn" data-action="creator-delete-version" data-version="${version.id}">删除</button></div></div>`).join("")||`<div class="empty-state">尚未保存创作快照。</div>`}</article>
  </aside>
 </section>
 <section class="card placeholder-hub"><div class="section-head"><div><h3>创作者工具箱</h3><p>协作、日志与文档解析</p></div></div><div class="placeholder-grid">
 ${creatorTool("协作权限","邀请已注册成员，分配协作者、主持人或只读观察者权限","creator-collaboration","管理成员 →")}
 ${creatorTool("运行日志","筛选阅读、调查、规则触发与主持操作记录","creator-logs","查看日志 →")}
 ${creatorTool("文档解析","解析 TXT、Markdown 或 DOCX，预览后写入母稿或角色私人剧本","creator-document-parser","解析文档 →")}
 </div></section>`;
}

function creatorTool(title,text,action,label){return `<article class="placeholder-module connected"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p><button class="text-btn" data-action="${escapeHtml(action)}">${escapeHtml(label)}</button></article>`}

function openCreatorSection(roleId,sectionId=""){
 const data=state.cloudStudio,sections=data.sections.filter(section=>section.role_slot_id===roleId),section=sections.find(item=>item.id===sectionId);
 modal.className="modal manuscript-editor-modal";modal.innerHTML=`<div class="editor-head"><div><p class="section-kicker">LONGFORM SCRIPT EDITOR</p><h2>${section?"编辑角色分幕":"新增角色分幕"}</h2></div><span class="editor-save-state" data-editor-state>${section?"已加载云端版本":"新分幕尚未写入"}</span></div><div class="editor-grid"><div class="form-group">${studioSelect("所属公共章节","chapterId",[{id:"",name:"暂不绑定章节"},...data.chapters],section?.chapter_id||"")}${studioField("分幕标题","title","input",section?.title||"")}<label>角色正文 · 支持 Markdown</label><textarea class="field manuscript-body" data-studio-field="body" rows="18">${escapeHtml(section?.body||"")}</textarea>${studioSelect("发布状态","publicationStatus",[{id:"draft",name:"草稿 · 仅创作者可见"},{id:"testing",name:"测试中 · 测试房可见"},{id:"published",name:"已发布 · 正式房可见"}],section?.publication_status||"draft")}</div><aside class="editor-side"><h3>当前分幕工具</h3><div class="editor-stats"><b data-word-count>0</b><span>字符</span></div><label>搜索</label><input class="field" data-editor-search placeholder="输入关键词"><label>替换为</label><input class="field" data-editor-replace placeholder="新的文本"><button class="secondary-btn full-btn" data-editor-replace-btn>全部替换</button><div class="tutorial-tip"><b>自动保存</b><span>${section?"停止输入约 0.9 秒后写入云端。":"新分幕首次需要点击保存，之后可继续自动保存。"}</span></div></aside></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-studio-submit>${section?"保存并关闭":"写入云端"}</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;
 const body=modal.querySelector('[data-studio-field="body"]'),count=modal.querySelector("[data-word-count]"),status=modal.querySelector("[data-editor-state]");let timer;
 const refreshCount=()=>count.textContent=String(body.value.length);refreshCount();body.addEventListener("input",()=>{refreshCount();status.textContent="有未保存修改";if(section){clearTimeout(timer);timer=setTimeout(async()=>{try{const values=studioValues();if(!values.chapterId)values.chapterId=null;await zhimuApi.updateSection(roleId,section.id,values);section.title=values.title;section.body=values.body;section.chapter_id=values.chapterId;section.publication_status=values.publicationStatus;status.textContent=`已自动保存 · ${new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}`}catch(error){status.textContent=`保存失败 · ${error.message}`}},900)}});modal.querySelector("[data-editor-replace-btn]").onclick=()=>{const from=modal.querySelector("[data-editor-search]").value,to=modal.querySelector("[data-editor-replace]").value;if(!from)return showToast("请先填写搜索关键词");body.value=body.value.split(from).join(to);body.dispatchEvent(new Event("input"));showToast("当前分幕已完成替换")};
 modal.querySelector("[data-studio-submit]").onclick=async()=>{try{const values=studioValues();if(!values.chapterId)values.chapterId=null;if(section)await zhimuApi.updateSection(roleId,section.id,values);else await zhimuApi.createSection(zhimuApi.context.worldId,roleId,{...values,sequence:sections.length+1});closeModal();await loadCloudData();showToast("角色分幕已保存")}catch(error){showToast(error.message)}};
 if(section)modal.querySelector(".modal-actions").insertAdjacentHTML("afterbegin",`<button class="danger-btn" data-delete-section>删除这一幕</button>`),modal.querySelector("[data-delete-section]").onclick=async()=>{try{await zhimuApi.deleteSection(roleId,section.id);closeModal();await loadCloudData();showToast("角色分幕已删除")}catch(error){showToast(error.message)}};
}

function openCreatorRole(roleId=""){
 const data=state.cloudStudio,role=data.roles.find(item=>item.id===roleId);
 studioModal(role?"编辑角色席位":"新增角色席位",studioField("角色名称","name","input",role?.name||"")+studioField("公开身份","publicProfile","textarea",role?.public_profile||"")+studioField("角色秘密","privateProfile","textarea",role?.private_profile||"")+studioField("席位顺序","sequence","input",String(role?.sequence||data.roles.length+1)),role?"保存角色修改":"写入云端",async()=>{try{const values=studioValues(),payload={name:values.name,publicProfile:values.publicProfile,privateProfile:values.privateProfile,sequence:Number(values.sequence)||data.roles.length+1};if(role)await zhimuApi.updateRole(role.id,payload);else await zhimuApi.createRole(zhimuApi.context.worldId,payload);closeModal();await loadCloudData();showToast("角色席位已保存")}catch(error){showToast(error.message)}});
 if(role)modal.querySelector(".modal-actions").insertAdjacentHTML("afterbegin",`<button class="danger-btn" data-delete-role>删除角色</button>`),modal.querySelector("[data-delete-role]").onclick=async()=>{if(data.roles.length<=1)return showToast("至少需要保留一个角色席位");try{await zhimuApi.deleteRole(role.id);closeModal();await loadCloudData();showToast("角色席位及其私人正文已删除")}catch(error){showToast(error.message)}};
}

function openCreatorChapter(chapterId){
 const chapter=state.cloudStudio.chapters.find(item=>item.id===chapterId);
 studioModal("章节发布控制",studioField("章节名称","title","input",chapter.title)+studioField("章节摘要","summary","textarea",chapter.summary||"")+studioSelect("发布阶段","publicationStatus",[{id:"draft",name:"草稿 · 不对玩家开放"},{id:"testing",name:"测试中 · 用于测试房"},{id:"published",name:"已发布 · 可进入正式房"}],chapter.publication_status||"draft")+studioSelect("解锁方式","unlockMode",[{id:"host_confirm",name:"主持人确认后开放"},{id:"automatic",name:"满足规则后自动开放"},{id:"manual",name:"仅手动开放"}],chapter.unlock_rules?.mode||"host_confirm"),"保存章节设置",async()=>{try{const values=studioValues();await zhimuApi.updateChapter(chapter.id,{title:values.title,summary:values.summary,publicationStatus:values.publicationStatus,unlockRules:{mode:values.unlockMode}});closeModal();await loadCloudData();showToast("章节发布规则已保存")}catch(error){showToast(error.message)}});
}

async function runCreatorChecks(){try{state.cloudCreatorChecks=(await zhimuApi.getCreatorChecks()).checks;render();showToast("发布检查已完成")}catch(error){showToast(error.message)}}

async function openStoryManuscript(){
 try{
  const manuscript=await zhimuApi.getStoryManuscript();
  modal.className="modal story-manuscript-modal";modal.innerHTML=`<h2>完整剧情母稿</h2><p class="wizard-intro">这是创作者维护的全局剧情文稿，不会替代每位角色的私人剧本。你可以从剧情编排生成一份规范化母稿，也可以把编辑后的母稿拆分成场景、调查点、线索与连接线。</p><div class="assistant-guide"><b>双向同步边界</b><span>“从编排台生成母稿”会覆盖下方文本；“拆分母稿写回编排台”会重建此前由母稿生成的节点，不会删除你手工建立的节点。</span></div><textarea class="field manuscript-draft" rows="20" data-story-manuscript>${escapeHtml(manuscript.body)}</textarea><div class="manuscript-meta" data-manuscript-meta>${storyManuscriptStatus(manuscript)}</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="secondary-btn" data-manuscript-save>仅保存母稿</button><button class="secondary-btn" data-manuscript-from-graph>从编排台生成母稿</button><button class="primary-btn" data-manuscript-to-graph>拆分母稿写回编排台</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;const body=()=>modal.querySelector("[data-story-manuscript]").value.trim(),meta=modal.querySelector("[data-manuscript-meta]");
  modal.querySelector("[data-manuscript-save]").onclick=async()=>{try{const result=await zhimuApi.saveStoryManuscript(body());meta.innerHTML=storyManuscriptStatus(result);showToast("完整剧情母稿已保存")}catch(error){showToast(error.message)}};
  modal.querySelector("[data-manuscript-from-graph]").onclick=async()=>{try{const result=await zhimuApi.syncStoryManuscriptFromGraph();modal.querySelector("[data-story-manuscript]").value=result.body;meta.innerHTML=storyManuscriptStatus(result);showToast("已经从剧情编排生成完整母稿")}catch(error){showToast(error.message)}};
  modal.querySelector("[data-manuscript-to-graph]").onclick=async()=>{try{const result=await zhimuApi.syncStoryManuscriptToGraph(body());closeModal();await loadCloudData();go("studio");showToast(`母稿已拆分为 ${result.nodes} 个节点和 ${result.edges} 条连线`)}catch(error){showToast(error.message)}};
 }catch(error){showToast(error.message)}
}

function storyManuscriptStatus(manuscript){const label={manual:"手动保存",graph_to_manuscript:"剧情编排 → 完整母稿",manuscript_to_graph:"完整母稿 → 剧情编排"}[manuscript.lastSyncDirection||manuscript.last_sync_direction]||"尚未同步";return `<span>最近同步：${label}</span>${manuscript.updatedAt||manuscript.updated_at?`<span>${formatTime(manuscript.updatedAt||manuscript.updated_at)}</span>`:""}`}

async function openCollaboration(){
 try{
  const members=await zhimuApi.getWorldMembers(),roleName={owner:"主创作者",editor:"协作者",host:"主持人",viewer:"只读观察者"};
  modal.className="modal creator-tool-modal";modal.innerHTML=`<h2>协作权限</h2><p class="wizard-intro">邀请已注册账号加入当前世界。主创可以调整成员权限；主创本人不会被误删或降权。</p><div class="collab-list">${members.map(member=>`<div class="collab-row"><div><b>${escapeHtml(member.display_name)}</b><p>${escapeHtml(member.email||"—")} · ${roleName[member.role]}</p></div>${member.role==="owner"?`<span class="cloud-pill">OWNER</span>`:`<div class="row"><select class="field compact-field" data-member-role="${member.user_id}">${["editor","host","viewer"].map(role=>`<option value="${role}" ${role===member.role?"selected":""}>${roleName[role]}</option>`).join("")}</select><button class="text-btn danger-text" data-remove-member="${member.user_id}">移除</button></div>`}</div>`).join("")}</div><div class="collab-invite"><h3>邀请协作者</h3><div class="row"><input class="field" data-member-email placeholder="已注册成员邮箱"><select class="field compact-field" data-member-new-role><option value="editor">协作者</option><option value="host">主持人</option><option value="viewer">只读观察者</option></select><button class="primary-btn" data-add-member>加入世界</button></div></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-add-member]").onclick=async()=>{try{await zhimuApi.addWorldMember({email:modal.querySelector("[data-member-email]").value,role:modal.querySelector("[data-member-new-role]").value});closeModal();showToast("协作成员已加入");openCollaboration()}catch(error){showToast(error.message)}};modal.querySelectorAll("[data-member-role]").forEach(select=>select.onchange=async()=>{try{await zhimuApi.updateWorldMember(select.dataset.memberRole,select.value);showToast("成员权限已更新")}catch(error){showToast(error.message)}});modal.querySelectorAll("[data-remove-member]").forEach(button=>button.onclick=async()=>{try{await zhimuApi.deleteWorldMember(button.dataset.removeMember);closeModal();showToast("协作成员已移除");openCollaboration()}catch(error){showToast(error.message)}});
 }catch(error){showToast(error.message)}
}

async function openWorldLogs(){
 try{
  const draw=async()=>{const params={limit:"100"},eventType=modal.querySelector("[data-log-event]")?.value,keyword=modal.querySelector("[data-log-keyword]")?.value;if(eventType)params.eventType=eventType;if(keyword)params.keyword=keyword;const logs=await zhimuApi.getWorldLogs(params);modal.querySelector("[data-log-list]").innerHTML=logs.map(log=>`<div class="log-row"><div><b>${escapeHtml(log.event_type)}</b><span>${escapeHtml(log.room_name)}</span></div><p>${escapeHtml(log.message)}</p><small>${escapeHtml(log.actor_name||"系统")} · ${formatTime(log.created_at)}</small></div>`).join("")||`<div class="empty-state">没有匹配的运行日志。</div>`};
  modal.className="modal creator-tool-modal";modal.innerHTML=`<h2>世界运行日志</h2><p class="wizard-intro">查看玩家阅读、调查、规则触发与主持操作。筛选只影响当前查看，不会修改历史记录。</p><div class="log-toolbar"><select class="field compact-field" data-log-event><option value="">全部事件</option><option value="reading_completed">阅读完成</option><option value="investigation_completed">调查完成</option><option value="scene_unlocked">场景解锁</option></select><input class="field" data-log-keyword placeholder="搜索日志内容"><button class="secondary-btn" data-log-refresh>筛选</button></div><div class="log-list" data-log-list></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-log-refresh]").onclick=draw;await draw();
 }catch(error){showToast(error.message)}
}

async function openDocumentParser(){
 const roles=state.cloudStudio?.roles||[];let parsed=null;
 modal.className="modal creator-tool-modal";modal.innerHTML=`<h2>文档解析与导入</h2><p class="wizard-intro">支持 TXT、Markdown 和 DOCX。系统会先提取正文并按标题拆分，确认后才写入完整剧情母稿或指定角色私人剧本。</p><div class="form-group"><label>选择文档</label><input class="field" type="file" accept=".txt,.md,.markdown,.docx" data-document-file><label>写入目标</label><select class="field" data-document-target><option value="manuscript">完整剧情母稿</option>${roles.map(role=>`<option value="${role.id}">角色私人剧本 · ${escapeHtml(role.name)}</option>`).join("")}</select></div><div data-document-preview></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="secondary-btn" data-document-parse>解析预览</button><button class="primary-btn" data-document-import disabled>确认导入</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;const commit=modal.querySelector("[data-document-import]");modal.querySelector("[data-document-parse]").onclick=async()=>{const file=modal.querySelector("[data-document-file]").files[0];if(!file)return showToast("请先选择文档");try{parsed=await zhimuApi.parseDocument({filename:file.name,contentBase64:await fileToBase64(file)});modal.querySelector("[data-document-preview]").innerHTML=`<section class="document-preview"><b>${escapeHtml(parsed.filename)}</b><p>${parsed.characterCount} 字符 · ${parsed.sectionCount} 个分段</p>${parsed.sections.slice(0,8).map(section=>`<article><strong>${escapeHtml(section.title)}</strong><span>${escapeHtml(section.body.slice(0,120))}${section.body.length>120?"...":""}</span></article>`).join("")}</section>`;commit.disabled=false;showToast("文档解析完成，请复核分段")}catch(error){showToast(error.message)}};commit.onclick=async()=>{if(!parsed)return;try{const target=modal.querySelector("[data-document-target]").value;await zhimuApi.importParsedDocument({target:target==="manuscript"?"manuscript":"role_script",roleSlotId:target==="manuscript"?null:target,document:parsed});closeModal();await loadCloudData();showToast("文档内容已写入云端")}catch(error){showToast(error.message)}};
}

function fileToBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file)})}

const AiDraft=()=>window.zhimuAiDraft;
function aiDraftWorldId(){return zhimuApi.context?.worldId||""}
function collectAiFormFields(){const v=studioValues();return {aiTitle:v.aiTitle,aiPremise:v.aiPremise,aiStyle:v.aiStyle,aiRequirements:v.aiRequirements,aiRoleRequirements:v.aiRoleRequirements,aiEvalFocus:v.aiEvalFocus,aiPlayerCount:v.aiPlayerCount,aiTargetWordCount:v.aiTargetWordCount,aiChapterCount:v.aiChapterCount,aiSceneCount:v.aiSceneCount,aiPointCount:v.aiPointCount,aiClueCount:v.aiClueCount}}
function restoreAiFormFields(form){if(!form||!modal)return;for(const [field,value] of Object.entries(form)){const el=modal.querySelector(`[data-studio-field="${field}"]`);if(el&&value!=null&&value!=="")el.value=value}}
function saveLocalAiDraft(kind,payload,{silent=false}={}){const worldId=aiDraftWorldId();if(!worldId)return null;const result=AiDraft()?.save(worldId,kind,payload);if(!result?.ok&&!silent)showToast(result?.error==="DRAFT_TOO_LARGE"?"本地草稿过大，请精简分幕后再保存":"无法写入浏览器本地存储");return result}
function loadLocalAiDraft(kind){return AiDraft()?.load(aiDraftWorldId(),kind)||null}
function clearLocalAiDraft(kind){AiDraft()?.clear(aiDraftWorldId(),kind)}
function aiLocalDraftNote(savedAt){return savedAt?`<p class="muted-note local-draft-note">已保存到本机浏览器，尚未上传云端 · ${formatRelativeTime(savedAt)||formatTime(savedAt)}</p>`:""}
function aiLocalDraftActions(kind){return `<button class="text-btn" type="button" data-ai-draft-clear>清除本地草稿</button>`}
function bindAiDraftClear(kind,onClear){const btn=modal.querySelector("[data-ai-draft-clear]");if(!btn)return;btn.onclick=()=>{clearLocalAiDraft(kind);onClear?.();showToast("已清除本地 AI 草稿")}}


async function openDeepseekAssistant(){
 return openDeepseekPipeline({focusLayer:"structure",mode:"interactive"});
}

async function openDeepseekFullMystery(){
 return openDeepseekPipeline({mode:"auto"});
}

function deepseekProposalPreview(result){const proposal=result.proposal,plan=proposal.writingPlan||{};return `<section class="assistant-preview deepseek-preview"><div class="section-head"><div><p class="section-kicker">${escapeHtml(result.model)}</p><h3>${escapeHtml(proposal.title||"未命名提案")}</h3><p>${escapeHtml(proposal.logline||"")}</p></div><span class="cloud-pill local">本地草稿 · 未上传云端</span></div><div class="proposal-stats"><span>${proposal.chapters.length} 章</span><span>${proposal.scenes.length} 场景</span><span>${proposal.investigationPoints.length} 调查点</span><span>${proposal.clues.length} 线索</span><span>${proposal.edges.length} 连线</span><span>${Number(plan.targetWordCount||result.brief?.targetWordCount||0)} 字建议</span></div><div class="proposal-chapters">${proposal.chapters.map(chapter=>`<article><b>${chapter.sequence}. ${escapeHtml(chapter.title)}</b><p>${escapeHtml(chapter.summary||"")}</p><small>建议字数：${Number((plan.chapterWordBudgets||[]).find(item=>item.chapterKey===chapter.key)?.targetWordCount||0)} 字</small></article>`).join("")}</div><div class="assistant-suggestions"><b>AI 写作建议</b>${proposal.suggestions.map(item=>`<p>· ${escapeHtml(item)}</p>`).join("")}</div></section>`}

function deepseekMysteryPreview(result){const pkg=result.package||{},roles=pkg.roles||[];return `<section class="assistant-preview deepseek-preview"><div class="section-head"><div><p class="section-kicker">${escapeHtml(result.model||"DeepSeek")} · 整本悬疑包</p><h3>${escapeHtml(pkg.title||"未命名剧本")}</h3><p>${escapeHtml(pkg.summary||"")}</p></div><span class="cloud-pill local">本地草稿 · 未上传云端</span></div><div class="proposal-stats"><span>${roles.length} 角色</span><span>${(result.proposal?.chapters||[]).length} 章结构</span><span>${(result.proposal?.scenes||[]).length} 场景</span><span>${(pkg.overallManuscript||"").length} 字母稿</span></div><div class="proposal-chapters">${roles.slice(0,6).map((role)=>`<article><b>${escapeHtml(role.name)}</b><p>${escapeHtml((role.publicProfile||"").slice(0,120))}</p><small>${(role.sections||[]).length} 段私人正文</small></article>`).join("")}</div><div class="assistant-suggestions"><b>逻辑线说明</b>${(pkg.logicNotes||[]).slice(0,6).map((item)=>`<p>· ${escapeHtml(item)}</p>`).join("")||"<p>· 无</p>"}</div></section>`}

const PipelineWizard=()=>window.zhimuPipelineWizard;
async function openDeepseekPipeline(options){return PipelineWizard()?.openDeepseekPipeline(options)}
function pipelineEvaluationPreview(evaluation){return PipelineWizard()?.pipelineEvaluationPreview(evaluation)||""}
function pipelineStepLabel(step){return PipelineWizard()?.pipelineStepLabel(step)||step}
function pipelinePreviewHtml(session){return PipelineWizard()?.pipelinePreviewHtml(session)||""}

function openStoryAssistant(){
 modal.className="modal story-assistant-modal";modal.innerHTML=`<h2>剧情助手</h2><p class="wizard-intro">粘贴剧情梗概或逐段素材。系统会先识别场景、线索和调查点，再生成建议连线。确认后才会写入剧情编排。</p><div class="assistant-guide"><b>推荐格式</b><span>每段用空行分隔。也可以使用“场景：”“线索：”“调查点：”开头提高识别准确度。</span></div><textarea class="field assistant-draft" rows="14" data-story-draft placeholder="场景：旧灯塔。潮水退去后，塔门露出一枚生锈的锁。&#10;&#10;调查点：检查塔门锁孔，发现内部残留蓝色蜡屑。&#10;&#10;线索：蓝色火漆碎片。它与匿名信上的封蜡一致。"></textarea><div data-assistant-preview></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="secondary-btn" data-assistant-analyze>分析分类</button><button class="primary-btn" data-assistant-import disabled>确认写入剧情编排</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;const text=()=>modal.querySelector("[data-story-draft]").value.trim(),preview=modal.querySelector("[data-assistant-preview]"),commit=modal.querySelector("[data-assistant-import]");
 modal.querySelector("[data-assistant-analyze]").onclick=async()=>{try{const result=await zhimuApi.analyzeStoryDraft(text());preview.innerHTML=storyAssistantPreview(result);commit.disabled=!result.nodes.length;showToast(`已识别 ${result.nodes.length} 个剧情节点`)}catch(error){showToast(error.message)}};
 commit.onclick=async()=>{try{commit.disabled=true;const result=await zhimuApi.importStoryDraft(text());closeModal();await loadCloudData();go("studio");showToast(`已生成 ${result.nodes.length} 个节点和 ${result.edges.length} 条连线`)}catch(error){commit.disabled=false;showToast(error.message)}};
}

function storyAssistantPreview(result){const typeName={scene:"场景",clue:"线索",investigation_point:"调查点"};return `<section class="assistant-preview"><div class="section-head"><div><h3>分类预览</h3><p>${result.nodes.length} 个节点 · ${result.edges.length} 条建议连线</p></div></div><div class="assistant-node-grid">${result.nodes.map(node=>`<article><span>${typeName[node.type]}</span><b>${escapeHtml(node.name)}</b><p>${escapeHtml(node.text)}</p></article>`).join("")}</div><div class="assistant-suggestions"><b>写作建议</b>${result.suggestions.map(item=>`<p>· ${escapeHtml(item)}</p>`).join("")}</div></section>`}

function openCreatorPreview(){
 const data=state.cloudStudio,roles=data.roles;if(!roles.length)return showToast("请先创建角色");
 modal.className="modal preview-modal";modal.innerHTML=`<h2>玩家视角模拟器</h2><p class="wizard-intro">切换角色和章节，核对玩家能读到的私人文本。草稿、测试中和已发布状态会明确标记。</p><div class="preview-controls">${studioSelect("模拟角色","previewRole",roles,roles[0]?.id||"")}${studioSelect("公共章节","previewChapter",[{id:"",name:"全部章节"},...data.chapters],"")}</div><div data-preview-body></div><div class="modal-actions"><button class="primary-btn" data-close>结束模拟</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;const draw=()=>{const roleId=modal.querySelector('[data-studio-field="previewRole"]').value,chapterId=modal.querySelector('[data-studio-field="previewChapter"]').value,role=roles.find(item=>item.id===roleId),sections=data.sections.filter(section=>section.role_slot_id===roleId&&(!chapterId||section.chapter_id===chapterId));modal.querySelector("[data-preview-body]").innerHTML=`<article class="preview-role-card"><p class="section-kicker">仅此角色可见</p><h3>${escapeHtml(role.name)}</h3><p>${escapeHtml(role.private_profile||"尚未补充角色秘密")}</p></article>${sections.map(section=>`<article class="preview-section"><span class="status-chip ${section.publication_status}">${section.publication_status}</span><h3>${escapeHtml(section.title)}</h3><div>${escapeHtml(section.body).replace(/\n/g,"<br>")}</div></article>`).join("")||`<div class="empty-state">该筛选条件下没有私人剧情。</div>`}`};modal.querySelectorAll("select").forEach(select=>select.onchange=draw);draw();
}

function contentPackageSummaryHtml(summary){
 return `<section class="assistant-preview package-summary"><div class="proposal-stats"><span>${summary.roles} 角色</span><span>${summary.chapters} 章节</span><span>${summary.sections} 分幕</span><span>${summary.scenes} 场景</span><span>${summary.clues} 线索</span><span>${summary.investigationPoints} 调查点</span><span>${summary.rules} 规则</span><span>${summary.assetCount} 资产</span></div><div class="assistant-guide"><b>${summary.hasAttachments?"包含附件引用":"不含附件文件"}</b><span>JSON 内容包导出角色、章节、分幕、场景、线索、调查点、规则与剧情连线。资产文件本体需单独在内容资产页管理；导出包不会嵌入二进制附件。</span></div></section>`;
}

function contentPackagePreviewHtml(preview){
 const warningRows=preview.warnings.length?preview.warnings.map(item=>`<div class="check-result ${item.level}"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.detail)}</span></div>`).join(""):`<div class="empty-state">未发现缺失引用或重名冲突。</div>`;
 const roleRows=preview.roles.map(item=>`<li>${escapeHtml(item.name)}</li>`).join("")||`<li>无角色</li>`;
 const chapterRows=preview.chapters.map(item=>`<li>${escapeHtml(String(item.sequence))}. ${escapeHtml(item.title)}</li>`).join("")||`<li>无章节</li>`;
 const clueRows=preview.clues.map(item=>`<li>${escapeHtml(item.name)}</li>`).join("")||`<li>无线索</li>`;
 return `<section class="assistant-preview package-preview"><div class="section-head"><div><p class="section-kicker">${preview.mode==="new_world"?"创建新世界":"追加到当前世界"}</p><h3>${escapeHtml(preview.sourceWorldName)}</h3><p>${escapeHtml(preview.sourceWorldSummary||"无摘要")}</p></div><span class="cloud-pill">仅预览 · 尚未写入</span></div><div class="proposal-stats"><span>${preview.summary.roles} 角色</span><span>${preview.summary.chapters} 章节</span><span>${preview.summary.sections} 分幕</span><span>${preview.summary.scenes} 场景</span><span>${preview.summary.clues} 线索</span><span>${preview.summary.investigationPoints} 调查点</span><span>${preview.summary.rules} 规则</span></div><div class="preview-grid"><article><h4>即将导入的角色</h4><ul>${roleRows}</ul></article><article><h4>即将导入的章节</h4><ul>${chapterRows}</ul></article><article><h4>即将导入的线索</h4><ul>${clueRows}</ul></article></div><div class="section-head" style="margin-top:14px"><div><h4>引用检查与重名提示</h4><p>${preview.targetWorldName?`目标世界：${escapeHtml(preview.targetWorldName)} · `:''}导入不会覆盖已有内容，只会追加新记录。</p></div></div>${warningRows}</section>`;
}

async function openCreatorExport(){
 try{
  const summary=await zhimuApi.getContentPackageSummary();
  modal.className="modal creator-tool-modal";modal.innerHTML=`<h2>导出内容包</h2><p class="wizard-intro">确认摘要后再下载 JSON 备份。可用于备份剧本、复制世界结构或分享给协作者。</p>${contentPackageSummaryHtml(summary)}<div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-export-confirm>确认导出 JSON</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-export-confirm]").onclick=async()=>{try{const payload=await zhimuApi.exportContentPackage(),url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"})),link=document.createElement("a");link.href=url;link.download=`${state.cloudStudio.world.name}-zhimu-backup.json`;link.click();URL.revokeObjectURL(url);closeModal();showToast("内容包已导出")}catch(error){showToast(error.message)}};
 }catch(error){showToast(error.message)}
}

async function exportCreatorPackage(){return openCreatorExport()}

function openCreatorImport(){
 const roles=state.cloudStudio?.roles||[];
 modal.className="modal creator-tool-modal";
 modal.innerHTML=`<h2>导入创作内容</h2><p class="wizard-intro">JSON 内容包会先预览再写入。可选择追加到当前世界，或创建一个新世界。现有内容不会被覆盖。</p><div class="form-group"><label>导入模式</label><select class="field" data-import-mode><option value="append">追加到当前世界</option><option value="new_world">创建新世界并导入</option></select>${roles.length?"":`<div class="tutorial-tip"><b>当前世界尚无角色</b><span>追加模式仍可导入完整内容包；Markdown/TXT 导入需先创建角色席位。</span></div>`}<div data-new-world-fields style="display:none;margin-top:10px">${studioField("新世界名称","newWorldName","input",state.cloudStudio?.world?.name?`${state.cloudStudio.world.name} · 导入副本`:"导入的世界")}${studioField("世界摘要","newWorldSummary","textarea",state.cloudStudio?.world?.summary||"")}</div><label>选择文件</label><input class="field" type="file" accept=".json,.md,.txt" data-creator-import-file>${roles.length?studioSelect("文档写入角色","importRole",roles):""}</div><div data-import-preview></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="secondary-btn" data-import-preview-btn>解析预览</button><button class="primary-btn" data-import-submit disabled>确认导入</button></div>`;
 modalBackdrop.classList.add("show");
 modal.querySelector("[data-close]").onclick=closeModal;
 let parsedJson=null, previewResult=null;
 const modeSelect=modal.querySelector("[data-import-mode]");
 const newWorldFields=modal.querySelector("[data-new-world-fields]");
 const previewBtn=modal.querySelector("[data-import-preview-btn]");
 const commitBtn=modal.querySelector("[data-import-submit]");
 const redrawMode=()=>{newWorldFields.style.display=modeSelect.value==="new_world"?"block":"none";parsedJson=null;previewResult=null;commitBtn.disabled=true;modal.querySelector("[data-import-preview]").innerHTML=""};
 modeSelect.onchange=redrawMode; redrawMode();
 previewBtn.onclick=async()=>{
  const file=modal.querySelector("[data-creator-import-file]").files[0];
  if(!file)return showToast("请选择导入文件");
  try{
   if(!/\.json$/i.test(file.name)){
    parsedJson=null;previewResult=null;commitBtn.disabled=false;
    modal.querySelector("[data-import-preview]").innerHTML=`<section class="assistant-preview"><p>Markdown / TXT 将直接写入指定角色的新分幕，无需 JSON 预览。</p></section>`;
    return;
   }
   parsedJson=JSON.parse(await file.text());
   previewResult=modeSelect.value==="new_world"?await zhimuApi.previewNewWorldContentPackage(parsedJson):await zhimuApi.previewContentPackageImport(parsedJson);
   modal.querySelector("[data-import-preview]").innerHTML=contentPackagePreviewHtml(previewResult);
   commitBtn.disabled=false;
   showToast("内容包预览已生成，请确认后导入");
  }catch(error){showToast(`预览失败：${error.message}`)}
 };
 modal.querySelector("[data-import-submit]").onclick=()=>importCreatorPackage(parsedJson, previewResult);
}

async function importCreatorPackage(parsedJson=null, previewResult=null){
 const file=modal.querySelector("[data-creator-import-file]").files[0];
 if(!file)return showToast("请选择导入文件");
 const mode=modal.querySelector("[data-import-mode]")?.value||"append";
 try{
  if(/\.json$/i.test(file.name)){
   const payload=parsedJson||JSON.parse(await file.text());
   if(mode==="new_world"){
    const values=studioValues();
    const result=await zhimuApi.importContentPackageAsNewWorld({name:values.newWorldName,summary:values.newWorldSummary,data:payload.data??payload});
    closeModal();await loadCloudData(true,true);zhimuApi.selectWorld(result.world.id);await loadCloudData(true,true);showToast(`已创建新世界并导入 ${result.imported.roles} 个角色、${result.imported.chapters} 个章节`);
   }else{
    const result=await zhimuApi.importContentPackage(payload);
    closeModal();await loadCloudData();
    const warnCount=(result.warnings||[]).length;
    showToast(warnCount?`导入完成：${result.imported.roles} 角色 · ${warnCount} 条提示`:`导入完成：追加 ${result.imported.roles} 角色、${result.imported.sections} 分幕`);
   }
  }else{
   const roleId=modal.querySelector('[data-studio-field="importRole"]')?.value;
   if(!roleId)throw new Error("请先创建角色席位");
   const sections=state.cloudStudio.sections.filter(section=>section.role_slot_id===roleId);
   await zhimuApi.createSection(zhimuApi.context.worldId,roleId,{title:file.name.replace(/\.(md|txt)$/i,""),body:await file.text(),sequence:sections.length+1,publicationStatus:"draft"});
   closeModal();await loadCloudData();showToast("文档内容已写入角色分幕");
  }
 }catch(error){showToast(`导入失败：${error.message}`)}
}

function createCreatorSnapshot(){studioModal("保存创作版本",studioField("版本名称","label","input",`创作快照 ${new Date().toLocaleString("zh-CN")}`),"保存快照",async()=>{try{await zhimuApi.createContentVersion(studioValues());closeModal();await loadCloudData();showToast("创作版本已保存")}catch(error){showToast(error.message)}})}
async function restoreCreatorSnapshot(versionId){try{await zhimuApi.restoreContentVersion(versionId);await loadCloudData();showToast("已恢复该版本的正文与发布状态")}catch(error){showToast(error.message)}}
async function deleteCreatorSnapshot(versionId){try{await zhimuApi.deleteContentVersion(versionId);await loadCloudData();showToast("创作版本记录已删除")}catch(error){showToast(error.message)}}
  viewExports.writer = writer;
  viewExports.createCreatorSnapshot = createCreatorSnapshot;
  viewExports.restoreCreatorSnapshot = restoreCreatorSnapshot;
  viewExports.deleteCreatorSnapshot = deleteCreatorSnapshot;
  viewExports.creatorTool = creatorTool;
  viewExports.openCreatorSection = openCreatorSection;
  viewExports.openCreatorRole = openCreatorRole;
  viewExports.openCreatorChapter = openCreatorChapter;
  viewExports.runCreatorChecks = runCreatorChecks;
  viewExports.openStoryManuscript = openStoryManuscript;
  viewExports.storyManuscriptStatus = storyManuscriptStatus;
  viewExports.openCollaboration = openCollaboration;
  viewExports.openWorldLogs = openWorldLogs;
  viewExports.openDocumentParser = openDocumentParser;
  viewExports.fileToBase64 = fileToBase64;
  viewExports.openDeepseekAssistant = openDeepseekAssistant;
  viewExports.openDeepseekPipeline = openDeepseekPipeline;
  viewExports.openDeepseekFullMystery = openDeepseekFullMystery;
  viewExports.deepseekProposalPreview = deepseekProposalPreview;
  viewExports.openStoryAssistant = openStoryAssistant;
  viewExports.storyAssistantPreview = storyAssistantPreview;
  viewExports.openCreatorPreview = openCreatorPreview;
  viewExports.openCreatorExport = openCreatorExport;
  viewExports.exportCreatorPackage = exportCreatorPackage;
  viewExports.openCreatorImport = openCreatorImport;
  viewExports.importCreatorPackage = importCreatorPackage;
})(window);
export {};
