/* Auto-split from app.js — settings.js */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const { modal, modalBackdrop } = window.zhimuDom;
  const F = window.zhimuFormat || {};
  const U = window.zhimuUi || {};
  const T = window.zhimuToast || {};
  const R = window.zhimuRuntime || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatTime = F.formatTime || (() => "");
  const formatRelativeTime = F.formatRelativeTime || (() => "");
  const hostAuditActionLabel = F.hostAuditActionLabel || ((a) => a);
  const hostAuditDetail = F.hostAuditDetail || (() => "");
  const showToast = T.showToast || (() => "");
  const activeRuntimeRoom = U.activeRuntimeRoom || (() => null);
  const isWorldOwner = U.isWorldOwner || (() => false);
  const deleteWorldPanel = U.deleteWorldPanel || (() => "");
  const closeModal = window.zhimuModal?.closeModal || (() => {});
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  window.zhimuViews = window.zhimuViews || {};
  const viewExports = window.zhimuViews.settings = window.zhimuViews.settings || {};

  function catalogReviewPanel(world) {
    const status = world?.catalog_review_status || (world?.catalog_public ? "approved" : "none");
    const labels = {
      none: ["未申请", "muted"],
      pending: ["审核中", "testing"],
      approved: ["已上架", "published"],
      rejected: ["未通过", "draft"]
    };
    const [label, chip] = labels[status] || labels.none;
    const submitted = world?.catalog_review_submitted_at
      ? `<p class="muted-note">提交时间：${escapeHtml(formatTime(world.catalog_review_submitted_at))}</p>`
      : "";
    const rejectNote = status === "rejected" && world?.catalog_review_note
      ? `<p class="muted-note" style="color:#b42318">审核意见：${escapeHtml(world.catalog_review_note)}</p>`
      : "";
    let actions = "";
    if (status === "approved" || world?.catalog_public) {
      actions = `<p class="muted-note">剧本已在「公开剧本库」展示。如需下架请联系 support@getzhimu.com，或使用下方撤回（仅隐藏，不删剧本）。</p><button type="button" class="secondary-btn" data-action="catalog-withdraw">撤回公开库展示</button>`;
    } else if (status === "pending") {
      actions = `<p class="muted-note">我们已收到申请，通常在 <strong>3～5 个工作日</strong> 内邮件回复。请勿重复提交。</p>`;
    } else {
      actions = `<p class="muted-note">公开库对所有登录用户可见，须人工审核。提交后我们会邮件通知 <strong>support@getzhimu.com</strong> 处理。</p><button type="button" class="primary-btn" data-action="open-catalog-review">提交公开库审核申请</button>`;
    }
    return `<section class="form-group" style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line, #ece7df)"><div class="section-head" style="margin-bottom:10px"><div><h4 style="margin:0">公开剧本库</h4><p class="muted-note" style="margin:4px 0 0">世界 ID：<code>${escapeHtml(world?.id || "")}</code></p></div><span class="status-chip ${chip}">${label}</span></div>${submitted}${rejectNote}${actions}</section>`;
  }

function settings(){
 const worldId=zhimuApi.context.worldId;
 const studioWorld=state.cloudStudio?.world;
 const listed=(state.cloudWorlds||[]).find((w)=>w.id===worldId);
 const world=studioWorld?.id===worldId?{...listed,...studioWorld}:listed||studioWorld;
 const room=activeRuntimeRoom();
 const roomSettings=state.cloudRoomSettings||{};
 const canEditWorld=Boolean(world?.id);
 const owner=isWorldOwner(worldId);
 const roleLabel=world?.membership_role==="owner"?"主创作者":world?.membership_role?`协作 · ${world.membership_role}`:"";
 const canAudit=["owner","editor","host"].includes(world?.membership_role);
 return `${deleteWorldPanel(world)}
 <section class="rules-layout"><article class="card"><div class="section-head"><div><h3>世界信息</h3><p>名称与简介会展示在总览与玩家入口${roleLabel?` · 你在本剧本的身份：<strong>${escapeHtml(roleLabel)}</strong>`:""}</p></div></div><div class="form-group"><label>世界名称</label><input class="field" id="settings-world-name" value="${escapeHtml(world?.name||"")}" ${canEditWorld?"":"readonly"}><label>世界简介</label><textarea class="field" id="settings-world-summary" rows="3" ${canEditWorld?"":"readonly"}>${escapeHtml(world?.summary||"")}</textarea><label>角色席位数</label><input class="field" value="${String(state.cloudStudio?.roles?.length||0)}" readonly>${owner?catalogReviewPanel(world):""}<button class="primary-btn" style="margin-top:14px" data-action="save-world-settings" ${canEditWorld?"":"disabled"}>保存世界信息</button></div></article>
 <article class="card"><div class="section-head"><div><h3>运行房选项</h3><p>${room?`当前平行房：${escapeHtml(room.name)}`:"请先在总览中选择平行运行房"}</p></div></div><div class="form-group"><label class="check-label"><input type="checkbox" id="settings-host-voice-listen" ${roomSettings.hostVoiceListen?"checked":""} ${room?"":"disabled"}><span><strong>主持人可旁听私密语音房</strong><small>开启后，主持人在未受邀的情况下仍可进入私密语音房旁听（不可发言）。</small></span></label><button class="primary-btn" style="margin-top:14px" data-action="save-room-settings" ${room?"":"disabled"}>保存运行房选项</button></div></article>
 ${canAudit?`<article class="card"><div class="section-head"><div><h3>世界主持审计</h3><p>汇总本剧本所有平行房的主持敏感操作（发线索、延迟事件、存档恢复等）。单房明细见主持监控台。</p></div><button class="secondary-btn" data-action="world-audit">查看审计</button></div></article>`:""}
 <aside class="card"><div class="section-head"><div><h3>账号与内容资产</h3><p>登录、配额、云端附件与会话管理</p></div></div><button class="secondary-btn full-btn" data-go="account">打开账号与资产</button><button class="secondary-btn full-btn" style="margin-top:10px" data-action="go-account" data-hub-tab="assets">管理云端附件</button></aside>
 <aside class="card"><div class="section-head"><div><h3>剧本管理</h3><p>切换、创建或删除剧本</p></div></div><button class="secondary-btn full-btn" data-action="world-library">我的剧本 / 切换剧本</button><button class="secondary-btn full-btn" style="margin-top:10px" data-action="open-catalog">打开公开剧本库</button><button class="secondary-btn full-btn" style="margin-top:10px" data-action="open-wizard">＋ 创建新世界</button>${!owner&&canEditWorld?`<p class="muted-note" style="margin-top:12px">你不是主创作者，无法删除此剧本。若需退出协作，请联系剧本 owner 将你移出协作者列表。</p>`:""}</aside>
 <aside class="card"><div class="section-head"><div><h3>帮助与数据</h3><p>步骤说明与错误排查</p></div></div><button class="secondary-btn full-btn" data-action="open-creator-guide">创作步骤指引</button><button class="secondary-btn full-btn" data-action="open-error-guide">错误提示与排查</button><button class="secondary-btn full-btn" style="margin-top:10px" data-action="go-writer-export">前往剧本创作 · 导出/导入</button></aside></section>`;
}

async function saveWorldSettings(){
 const name=document.getElementById("settings-world-name")?.value?.trim();
 const summary=document.getElementById("settings-world-summary")?.value?.trim()||"";
 if(!name)return showToast("请填写世界名称");
 try{
  await zhimuApi.patchWorld({name,summary});
  await loadCloudData();
  showToast("世界信息已保存");
 }catch(error){showToast(error.message)}
}

async function withdrawCatalogListing(){
 if(!confirm("确定从公开剧本库撤回？已体验用户的运行房不会删除，但新用户将无法从公开库加入。"))return;
 try{
  await zhimuApi.patchWorldCatalog(false);
  await loadCloudData(true,true);
  render();
  showToast("已从公开库撤回");
 }catch(error){showToast(error.message)}
}

function openCatalogReviewModal(){
 const worldId=zhimuApi.context.worldId;
 if(!worldId)return showToast("请先选择剧本");
 const studioWorld=state.cloudStudio?.world;
 const listed=(state.cloudWorlds||[]).find((w)=>w.id===worldId);
 const world=studioWorld?.id===worldId?{...listed,...studioWorld}:listed||studioWorld;
 modal.className="modal catalog-review-modal";
 modal.innerHTML=`<h2>公开剧本库 · 审核申请</h2><p class="wizard-intro">提交后将邮件通知运营团队（<strong>support@getzhimu.com</strong>），审核通过后剧本会出现在公开库。</p><div class="form-group"><p class="muted-note"><strong>${escapeHtml(world?.name||"当前剧本")}</strong><br>世界 ID：<code>${escapeHtml(worldId)}</code></p><label>自测情况（必填）</label><textarea class="field" data-review-field="playtestNotes" rows="3" placeholder="几人测过、能否「开始体验」跑通、有无阻塞 bug…"></textarea><label>题材与合规说明（必填）</label><textarea class="field" data-review-field="themeNotes" rows="3" placeholder="题材类型；是否含暴力/色情/真实人物/政治等；你认为需要审核员重点看的部分…"></textarea><label>审核备注（选填）</label><textarea class="field" data-review-field="sampleNotes" rows="2" placeholder="例如：请重点看角色 A 的第一幕"></textarea><label>联系方式（选填）</label><input class="field" data-review-field="contact" placeholder="微信 / 手机，仅审核联系用"><label class="check-label" style="margin-top:12px"><input type="checkbox" data-review-field="agreed"><span>我确认内容合法、不侵犯他人权益，同意公开库展示规则。</span></label></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-submit-catalog-review>提交申请</button></div>`;
 modalBackdrop.classList.add("show");
 modal.querySelector("[data-close]").onclick=closeModal;
 modal.querySelector("[data-submit-catalog-review]").onclick=async()=>{
  const val=(key)=>modal.querySelector(`[data-review-field="${key}"]`)?.value?.trim()||"";
  const agreed=Boolean(modal.querySelector('[data-review-field="agreed"]')?.checked);
  try{
   await zhimuApi.requestCatalogReview({
    playtestNotes:val("playtestNotes"),
    themeNotes:val("themeNotes"),
    sampleNotes:val("sampleNotes"),
    contact:val("contact"),
    agreed
   });
   closeModal();
   await loadCloudData(true,true);
   render();
   showToast("申请已提交，请留意注册邮箱");
  }catch(error){showToast(error.message)}
 };
}

async function saveRoomSettings(){
 const room=activeRuntimeRoom();
 if(!room)return showToast("请先选择平行运行房");
 const hostVoiceListen=Boolean(document.getElementById("settings-host-voice-listen")?.checked);
 try{
  await zhimuApi.patchRoomSettings({hostVoiceListen});
  state.cloudRoomSettings={hostVoiceListen};
  showToast("运行房选项已保存");
 }catch(error){showToast(error.message)}
}

function goWriterExport(){
 window.zhimuGo?.("writer");
 showToast("请在剧本创作页使用「导出内容包 / 导入内容包」");
}

async function openWorldAuditModal(){
 if(!zhimuApi.context.worldId)return showToast("请先选择剧本");
 try{
  const payload=await zhimuApi.getWorldHostAuditLog(50);
  const rows=payload?.entries||[];
  const body=rows.length?rows.map((entry)=>{
   const actor=entry.actor_name?`${escapeHtml(entry.actor_name)} · `:"";
   const room=entry.room_name?`${escapeHtml(entry.room_name)} · `:"";
   const detail=hostAuditDetail(entry);
   return `<div class="checkpoint-row"><strong>${room}${actor}${escapeHtml(hostAuditActionLabel(entry.action))}</strong><p>${detail?`${escapeHtml(detail)} · `:""}${formatRelativeTime(entry.created_at)}</p></div>`;
  }).join(""):`<div class="empty-state">本剧本尚无主持审计记录。</div>`;
  modal.className="modal host-detail-modal";
  modal.innerHTML=`<h2>世界主持审计</h2><p class="wizard-intro">汇总所有平行房的主持敏感操作，最近 ${rows.length} 条。</p><div class="host-detail-list host-audit-list">${body}</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
  modalBackdrop.classList.add("show");
  modal.querySelector("[data-close]").onclick=closeModal;
 }catch(error){showToast(error.message)}
}

  viewExports.settings = settings;
  viewExports.saveWorldSettings = saveWorldSettings;
  viewExports.saveRoomSettings = saveRoomSettings;
  viewExports.goWriterExport = goWriterExport;
  viewExports.openWorldAuditModal = openWorldAuditModal;
  viewExports.openCatalogReviewModal = openCatalogReviewModal;
  viewExports.withdrawCatalogListing = withdrawCatalogListing;
})(window);
export {};
