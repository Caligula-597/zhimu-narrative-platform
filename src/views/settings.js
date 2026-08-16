/* Auto-split from app.js — settings.js */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { modal, modalBackdrop } from "../dom.js";
import { go, loadCloudData, render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { uiStore, userStore, worldStore, studioStore, roomStore, assetStore } from "../state/index.js";
import * as F from "../utils/format.js";
import { closeModal } from "../components/modal.js";
import * as U from "../components/emptyState.js";
import { normalizeError } from "../components/status-ui.js";
import { setHtml } from "../../shared/safe-dom.js";
import {
  legacyWorldModeForNarrativeProfile,
  narrativeProfileFromSettings,
  normalizeCreationType,
  normalizeNarrativeProfile
} from "../../shared/narrative-profile.js";
import { normalizeCommunicationTemplates } from "../../shared/communication-templates.js";
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatTime = F.formatTime || (() => "");
  const formatRelativeTime = F.formatRelativeTime || (() => "");
  const hostAuditActionLabel = F.hostAuditActionLabel || ((a) => a);
  const hostAuditDetail = F.hostAuditDetail || (() => "");
  const showError = (error, fallback = "操作失败，请稍后重试") => showToast(normalizeError(error, fallback));
  const activeRuntimeRoom = U.activeRuntimeRoom || (() => null);
  const isWorldOwner = U.isWorldOwner || (() => false);
  const canEditWorldContent = U.canEditWorldContent || (() => false);
  const deleteWorldPanel = U.deleteWorldPanel || (() => "");


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

  function worldCoverPanel(world, canEdit) {
    const coverId = world?.settings?.coverAssetId || "";
    const images = (assetStore.get().cloudAssets || []).filter((asset) => asset.asset_kind === "image" && !asset.deleted_at);
    const current = images.find((asset) => asset.id === coverId);
    const options = images.map((asset) => `<option value="${escapeHtml(asset.id)}" ${asset.id === coverId ? "selected" : ""}>${escapeHtml(asset.original_filename || asset.id)}</option>`).join("");
    const preview = current?.download_url || current?.url || current?.public_url || "";
    return `<div class="form-group" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line, #ece7df)"><label>剧本封面</label><p class="muted-note">公开大厅、公开剧本库和玩家入口会优先展示这里指定的图片；未指定时使用本世界最早上传的图片。</p>${preview ? `<figure class="cover-preview"><img src="${escapeHtml(preview)}" alt="剧本封面预览" loading="lazy"></figure>` : ""}<div class="row" style="align-items:center;gap:10px"><select class="field" style="min-width:240px" data-action="set-world-cover" data-asset-select ${canEdit && images.length ? "" : "disabled"}><option value="">${images.length ? "选择已有图片" : "暂无图片资产"}</option>${options}</select><button type="button" class="secondary-btn" data-action="upload-world-cover" ${canEdit ? "" : "disabled"}>上传封面</button>${coverId ? `<button type="button" class="text-btn" data-action="clear-world-cover" ${canEdit ? "" : "disabled"}>清除封面</button>` : ""}</div><p class="muted-note">仍可在「内容资产」管理附件下载、回收站与其它文件类型。</p></div>`;
  }

  function commercialProfilePanel(world, canEdit) {
    const settings = world?.settings || {};
    const profile = settings.commercialProfile || {};
    const narrativeProfile = narrativeProfileFromSettings(settings);
    const disabled = canEdit ? "" : "disabled";
    const selected = (value, expected) => value === expected ? "selected" : "";
    const longFields = new Set(["copyrightSource"]);
    const field = (key, label, placeholder = "", type = "text") => `<label>${escapeHtml(label)}</label><input class="field" type="${type}" data-commercial-field="${key}" value="${escapeHtml(profile[key] || "")}" placeholder="${escapeHtml(placeholder)}" maxlength="${longFields.has(key) ? 2000 : 300}" ${disabled}>`;
    return `<section class="form-group" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line, #ece7df)">
      <div class="section-head"><div><h4 style="margin:0">创作类型与商业备案资料</h4><p class="muted-note" style="margin:4px 0 0">用于术语切换、交付归档和线下备案准备；不会自动向主管部门提交。</p></div></div>
      <label>创作类型</label>
      <select class="field" id="settings-creation-type" ${disabled}>
        <option value="murder_mystery" ${selected(narrativeProfile.creationType, "murder_mystery")}>剧本杀（角色本 / 公共幕 / 线索 / 主持人）</option>
        <option value="tabletop_rpg" ${selected(narrativeProfile.creationType, "tabletop_rpg")}>桌面角色扮演（HO / 模组 / KP）</option>
        <option value="board_game" ${selected(narrativeProfile.creationType, "board_game")}>桌游（棋盘 / 卡牌 / 资源 / 阶段）</option>
        <option value="interactive_story" ${selected(narrativeProfile.creationType, "interactive_story")}>互动叙事（角色 / 章节 / 场景）</option>
      </select>
      <label>运行形态</label>
      <select class="field" id="settings-run-format" ${disabled}>
        <option value="single_session" ${selected(narrativeProfile.runFormat, "single_session")}>单局 / One-shot</option>
        <option value="campaign" ${selected(narrativeProfile.runFormat, "campaign")}>长线 / 多场次战役</option>
      </select>
      <label>角色加入方式</label>
      <select class="field" id="settings-role-mode" ${disabled}>
        <option value="fixed" ${selected(narrativeProfile.roleMode, "fixed")}>作者预设固定角色</option>
        <option value="player_created" ${selected(narrativeProfile.roleMode, "player_created")}>玩家创建，主持审核</option>
        <option value="mixed" ${selected(narrativeProfile.roleMode, "mixed")}>预设与玩家创建并存</option>
      </select>
      <p class="muted-note">这三项共同决定后续角色、发布版本和运行房能力；旧世界的运行模式会自动兼容，不会因保存设置丢失内容。</p>
      ${field("authorName", "作者 / 编剧", "作者实名或笔名")}
      ${field("copyrightSource", "著作权来源", "原创、授权改编或版权方及授权范围")}
      ${field("registrationNumber", "备案编号 / 剧本编号（选填）", "尚未备案可留空")}
      ${field("theme", "主题", "如悬疑、情感、历史")}
      ${field("category", "类型 / 品类", "如本格、还原、阵营、跑团模组")}
      ${field("versionLabel", "对外版本", "如 1.0、发行修订版")}
      <label>建议适龄范围</label>
      <select class="field" data-commercial-field="ageRating" ${disabled}>
        <option value="" ${selected(profile.ageRating || "", "")}>未评定</option>
        <option value="12+" ${selected(profile.ageRating, "12+")}>12+</option>
        <option value="16+" ${selected(profile.ageRating, "16+")}>16+</option>
        <option value="18+" ${selected(profile.ageRating, "18+")}>18+</option>
      </select>
      <label>内容自审状态</label>
      <select class="field" data-commercial-field="selfReviewStatus" ${disabled}>
        <option value="not_started" ${selected(profile.selfReviewStatus || "not_started", "not_started")}>未开始</option>
        <option value="in_review" ${selected(profile.selfReviewStatus, "in_review")}>自审中</option>
        <option value="passed" ${selected(profile.selfReviewStatus, "passed")}>已通过自审</option>
        <option value="needs_changes" ${selected(profile.selfReviewStatus, "needs_changes")}>需修改</option>
      </select>
      <label>内容自审说明</label><textarea class="field" data-commercial-field="selfReviewNotes" rows="3" maxlength="4000" placeholder="记录敏感内容、处理结论、审稿责任人和依据" ${disabled}>${escapeHtml(profile.selfReviewNotes || "")}</textarea>
      ${field("materialChangeDate", "最近实质修改日期", "", "date")}
      ${field("filingUpdatedDate", "最近备案更新日期", "", "date")}
      <p class="muted-note">这些字段用于归档和提醒，不构成法律意见，也不能替代属地主管部门要求的备案、自审或更新流程。</p>
    </section>`;
  }

  function communicationTemplatesPanel(world, canEdit) {
    const templates = normalizeCommunicationTemplates(world?.settings?.communicationTemplates);
    const disabled = canEdit ? "" : "disabled";
    return `<section class="form-group communication-template-settings" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line, #ece7df)">
      <div class="section-head"><div><h4 style="margin:0">玩家交流动作</h4><p class="muted-note" style="margin:4px 0 0">统一配置玩家看到的入口名称、隐私提示和正式开场后的截止时间。0 表示不设截止。</p></div></div>
      <div class="communication-template-grid">${templates.map((template) => `<article class="communication-template-editor" data-communication-template="${escapeHtml(template.kind)}">
        <label class="check-label"><input type="checkbox" data-communication-field="enabled" ${template.enabled ? "checked" : ""} ${disabled}><span><strong>${escapeHtml(template.kind)}</strong><small>启用这个玩家入口</small></span></label>
        <label>玩家端标题</label><input class="field" data-communication-field="title" maxlength="120" value="${escapeHtml(template.title)}" ${disabled}>
        <label>隐私说明</label><textarea class="field" data-communication-field="privacyNotice" rows="2" maxlength="500" ${disabled}>${escapeHtml(template.privacyNotice)}</textarea>
        <label>输入提示</label><input class="field" data-communication-field="placeholder" maxlength="300" value="${escapeHtml(template.placeholder)}" ${disabled}>
        <label>开场后截止（分钟）</label><input class="field" type="number" min="0" max="1440" data-communication-field="deadlineMinutes" value="${template.deadlineMinutes}" ${disabled}>
      </article>`).join("")}</div>
    </section>`;
  }

export function settings(){
 const worldId=zhimuApi.context.worldId;
 const studioWorld=studioStore.get().cloudStudio?.world;
 const listed=(worldStore.get().cloudWorlds||[]).find((w)=>w.id===worldId);
 const world=studioWorld?.id===worldId?{...listed,...studioWorld}:listed||studioWorld;
 const room=activeRuntimeRoom();
 const roomSettings=roomStore.get().cloudRoomSettings||{};
 const canEditWorld=canEditWorldContent(world);
 const owner=isWorldOwner(worldId);
 const roleLabel=world?.membership_role==="owner"?"主创作者":world?.membership_role?`协作 · ${world.membership_role}`:"";
 const canAudit=["owner","editor","host"].includes(world?.membership_role);
 const editHint=canEditWorld?"":"<p class=\"muted-note\">仅主创作者或编辑协作者可修改剧本名称与简介。</p>";
 return `${deleteWorldPanel(world)}
 <section class="rules-layout"><article class="card"><div class="section-head"><div><h3>剧本信息</h3><p>名称与简介会展示在侧栏、总览与玩家入口${roleLabel?` · 你在本剧本的身份：<strong>${escapeHtml(roleLabel)}</strong>`:""}</p></div></div><div class="form-group"><label>剧本名称</label><input class="field" id="settings-world-name" value="${escapeHtml(world?.name||"")}" ${canEditWorld?"":"readonly"} placeholder="例如：午夜列车"><label>剧本简介</label><textarea class="field" id="settings-world-summary" rows="3" ${canEditWorld?"":"readonly"} placeholder="一句话介绍题材与氛围">${escapeHtml(world?.summary||"")}</textarea><label>真相结论（局后复盘）</label><textarea class="field" id="settings-recap-truth" rows="4" ${canEditWorld?"":"readonly"} placeholder="本局结束后向玩家展示的真相总结；留空则根据结局规则与推进记录自动生成">${escapeHtml(world?.settings?.recapTruthSummary||"")}</textarea><p class="muted-note">章节与场景的「复盘公开摘要」请在剧情编排台选中节点编辑。</p><label>角色席位数</label><input class="field" value="${String(studioStore.get().cloudStudio?.roles?.length||0)}" readonly>${commercialProfilePanel(world, canEditWorld)}${communicationTemplatesPanel(world, canEditWorld)}${worldCoverPanel(world, canEditWorld)}${editHint}${owner?catalogReviewPanel(world):""}<button class="primary-btn" style="margin-top:14px" data-action="save-world-settings" ${canEditWorld?"":"disabled"}>保存剧本信息</button></div></article>
 <article class="card"><div class="section-head"><div><h3>运行房选项</h3><p>${room?`当前平行房：${escapeHtml(room.name)}`:"请先在总览中选择平行运行房"}</p></div></div><div class="form-group"><label class="check-label"><input type="checkbox" id="settings-host-voice-listen" ${roomSettings.hostVoiceListen?"checked":""} ${room?"":"disabled"}><span><strong>主持人可旁听私密语音房</strong><small>开启后，主持人在未受邀的情况下仍可进入私密语音房旁听（不可发言）。</small></span></label><button class="primary-btn" style="margin-top:14px" data-action="save-room-settings" ${room?"":"disabled"}>保存运行房选项</button></div></article>
 ${canEditWorld?`<article class="card"><div class="section-head"><div><h3>内容标签</h3><p>公开剧本库 faceted 筛选（人数、难度等），上架后玩家可按标签浏览。</p></div><button class="secondary-btn" data-action="open-world-tags">编辑标签</button></div></article>
 <article class="card"><div class="section-head"><div><h3>主持运行段落</h3><p>把章节、核心事实与人物关系整理成主持人可执行的一幕，不替换角色私人剧情。</p></div><div class="row"><button class="secondary-btn" data-go="structure">运行段落工作台</button><button class="secondary-btn" data-go="truth">谜底与关系</button></div></div></article>
 <article class="card"><div class="section-head"><div><h3>段落补救模板</h3><p>主持人在玩家卡关时可一键播报预设话术（按章节/段落）。</p></div><button class="secondary-btn" data-action="open-segment-remedies">管理模板</button></div></article>`:""}
 ${canAudit?`<article class="card"><div class="section-head"><div><h3>世界主持审计</h3><p>汇总本剧本所有平行房的主持敏感操作（发线索、延迟事件、存档恢复等）。单房明细见独立主持端。</p></div><button class="secondary-btn" data-action="world-audit">查看审计</button></div></article>`:""}
 <aside class="card"><div class="section-head"><div><h3>账号与内容资产</h3><p>登录、配额、云端附件与会话管理</p></div></div><button class="secondary-btn full-btn" data-action="go-account" data-hub-tab="assets">打开内容资产</button></aside>
 <aside class="card"><div class="section-head"><div><h3>剧本管理</h3><p>切换、创建或删除剧本</p></div></div><button class="secondary-btn full-btn" data-action="world-library">我的剧本 / 切换剧本</button><button class="secondary-btn full-btn" style="margin-top:10px" data-action="open-catalog">打开公开剧本库</button><button class="secondary-btn full-btn" style="margin-top:10px" data-action="open-wizard">＋ 创建新世界</button>${!owner&&canEditWorld?`<p class="muted-note" style="margin-top:12px">你不是主创作者，无法删除此剧本。若需退出协作，请联系剧本 owner 将你移出协作者列表。</p>`:""}</aside>
 <aside class="card"><div class="section-head"><div><h3>帮助与数据</h3><p>步骤说明与错误排查</p></div></div><button class="secondary-btn full-btn" data-action="open-creator-guide">创作步骤指引</button><button class="secondary-btn full-btn" data-action="open-error-guide">错误提示与排查</button><button class="secondary-btn full-btn" style="margin-top:10px" data-action="go-writer-export">前往剧本创作 · 导出/导入</button></aside></section>`;
}

 export async function saveWorldSettings(){
 const worldId=zhimuApi.context.worldId;
 const name=document.getElementById("settings-world-name")?.value?.trim();
 const summary=document.getElementById("settings-world-summary")?.value?.trim()||"";
 const recapTruthSummary=document.getElementById("settings-recap-truth")?.value?.trim()||"";
 const creationType=normalizeCreationType(document.getElementById("settings-creation-type")?.value);
 const studioWorld=studioStore.get().cloudStudio?.world;
 const listedWorld=(worldStore.get().cloudWorlds||[]).find((world)=>world.id===worldId);
 const currentSettings=(studioWorld?.id===worldId?studioWorld:listedWorld)?.settings||{};
 const existingProfile=narrativeProfileFromSettings(currentSettings);
 const ruleset=creationType===existingProfile.creationType?existingProfile.ruleset:undefined;
 const narrativeProfile=normalizeNarrativeProfile({
  ...existingProfile,
  creationType,
  runFormat:document.getElementById("settings-run-format")?.value||existingProfile.runFormat,
  roleMode:document.getElementById("settings-role-mode")?.value||existingProfile.roleMode,
  ruleset
 });
 const commercialProfile={};
 document.querySelectorAll("[data-commercial-field]").forEach((input)=>{
  commercialProfile[input.dataset.commercialField]=input.value?.trim?.()||"";
 });
 const communicationTemplates=normalizeCommunicationTemplates(
  [...document.querySelectorAll("[data-communication-template]")].map((editor)=>({
   kind:editor.dataset.communicationTemplate,
   enabled:Boolean(editor.querySelector('[data-communication-field="enabled"]')?.checked),
   title:editor.querySelector('[data-communication-field="title"]')?.value,
   privacyNotice:editor.querySelector('[data-communication-field="privacyNotice"]')?.value,
   placeholder:editor.querySelector('[data-communication-field="placeholder"]')?.value,
   deadlineMinutes:Number(editor.querySelector('[data-communication-field="deadlineMinutes"]')?.value||0)
  }))
 );
 if(!name)return showToast("请填写剧本名称");
 const revision=window.zhimuWorldRevision?.currentRevision?.(worldId);
 try{
  const nextSettings={
   recapTruthSummary,
   creationType:narrativeProfile.creationType,
   worldMode:legacyWorldModeForNarrativeProfile(narrativeProfile),
   narrativeProfile,
   commercialProfile,
   communicationTemplates
  };
  const updated=await zhimuApi.patchWorld({name,summary,settings:nextSettings},worldId,{revision});
  const cloudStudio=studioStore.get().cloudStudio;
  if(cloudStudio?.world?.id===worldId){
   studioStore.set({
    cloudStudio:{
     ...cloudStudio,
     world:{
      ...cloudStudio.world,
      name,
      summary,
      settings:{...(cloudStudio.world.settings||{}),...nextSettings},
      content_revision:updated.content_revision??cloudStudio.world.content_revision
     }
    }
   });
  }
  worldStore.set({
   cloudWorlds:(worldStore.get().cloudWorlds||[]).map((w)=>w.id===worldId?{...w,name,summary,settings:{...(w.settings||{}),...nextSettings}}:w)
  });
  window.zhimuNavShell?.syncWorldSwitcher?.();
  await loadCloudData();
  render();
  showToast("剧本信息已保存");
  window.zhimuWorldRevision?.clearEditorDirty?.();
  window.zhimuWorldRevision?.clearDraft?.("settings");
 }catch(error){showError(error)}
}

export async function withdrawCatalogListing(){
 if(!confirm("确定从公开剧本库撤回？已体验用户的运行房不会删除，但新用户将无法从公开库加入。"))return;
 try{
  await zhimuApi.patchWorldCatalog(false);
  await loadCloudData(true,true);
  render();
  showToast("已从公开库撤回");
 }catch(error){showError(error)}
}

export function openCatalogReviewModal(){
 const worldId=zhimuApi.context.worldId;
 if(!worldId)return showToast("请先选择剧本");
 const studioWorld=studioStore.get().cloudStudio?.world;
 const listed=(worldStore.get().cloudWorlds||[]).find((w)=>w.id===worldId);
 const world=studioWorld?.id===worldId?{...listed,...studioWorld}:listed||studioWorld;
 modal.className="modal catalog-review-modal";
 setHtml(modal, `<h2>公开剧本库 · 审核申请</h2><p class="wizard-intro">提交后将邮件通知运营团队（<strong>support@getzhimu.com</strong>），审核通过后剧本会出现在公开库。</p><div class="form-group"><p class="muted-note"><strong>${escapeHtml(world?.name||"当前剧本")}</strong><br>世界 ID：<code>${escapeHtml(worldId)}</code></p><label>自测情况（必填）</label><textarea class="field" data-review-field="playtestNotes" rows="3" placeholder="几人测过、能否「开始体验」跑通、有无阻塞 bug…"></textarea><label>题材与合规说明（必填）</label><textarea class="field" data-review-field="themeNotes" rows="3" placeholder="题材类型；是否含暴力/色情/真实人物/政治等；你认为需要审核员重点看的部分…"></textarea><label>审核备注（选填）</label><textarea class="field" data-review-field="sampleNotes" rows="2" placeholder="例如：请重点看角色 A 的第一幕"></textarea><label>联系方式（选填）</label><input class="field" data-review-field="contact" placeholder="微信 / 手机，仅审核联系用"><label class="check-label" style="margin-top:12px"><input type="checkbox" data-review-field="agreed"><span>我确认内容合法、不侵犯他人权益，同意公开库展示规则。</span></label></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-submit-catalog-review>提交申请</button></div>`);
 modalBackdrop.classList.add("show");
 modal.querySelector("[data-close]").onclick=closeModal;
 modal.querySelector("[data-submit-catalog-review]").onclick=async()=>{
  const val=(key)=>modal.querySelector(`[data-review-field="${key}"]`)?.value?.trim()||"";
  const playtestNotes=val("playtestNotes");
  const themeNotes=val("themeNotes");
  const agreed=Boolean(modal.querySelector('[data-review-field="agreed"]')?.checked);
  if(!agreed)return showToast("请勾选内容合规确认后再提交");
  if(playtestNotes.length<8)return showToast("自测情况请至少填写 8 个字");
  if(themeNotes.length<8)return showToast("题材与合规说明请至少填写 8 个字");
  const payload={playtestNotes,themeNotes,agreed};
  const sampleNotes=val("sampleNotes");
  const contact=val("contact");
  if(sampleNotes)payload.sampleNotes=sampleNotes;
  if(contact)payload.contact=contact;
  try{
   await zhimuApi.requestCatalogReview(payload);
   closeModal();
   await loadCloudData(true,true);
   render();
   showToast("申请已提交，请留意注册邮箱");
  }catch(error){showError(error)}
 };
}

export async function saveRoomSettings(){
 const room=activeRuntimeRoom();
 if(!room)return showToast("请先选择平行运行房");
 const hostVoiceListen=Boolean(document.getElementById("settings-host-voice-listen")?.checked);
 try{
  await zhimuApi.patchRoomSettings({hostVoiceListen});
  roomStore.set({cloudRoomSettings:{hostVoiceListen}});
  showToast("运行房选项已保存");
 }catch(error){showError(error)}
}

export function goWriterExport(){
 go("writer");
 showToast("请在剧本创作页使用「导出内容包 / 导入内容包」");
}

export async function openWorldAuditModal(){
 if(!zhimuApi.context.worldId)return showToast("请先选择剧本");
 try{
  const payload=await zhimuApi.getWorldHostAuditLog(200);
  const rows=payload?.entries||[];
  const uniqueRooms=new Set(rows.map((entry)=>entry.room_id).filter(Boolean));
  const uniqueActions=new Set(rows.map((entry)=>entry.action).filter(Boolean));
  const latest=rows[0]?.created_at?formatRelativeTime(rows[0].created_at):"暂无";
  const summary=`<div class="stat-grid" style="margin-bottom:12px"><article class="stat-card"><span>审计记录</span><strong>${rows.length}</strong></article><article class="stat-card"><span>涉及房间</span><strong>${uniqueRooms.size}</strong></article><article class="stat-card"><span>操作类型</span><strong>${uniqueActions.size}</strong></article><article class="stat-card"><span>最近操作</span><strong>${escapeHtml(latest)}</strong></article></div>`;
  const body=rows.length?rows.map((entry)=>{
   const actor=entry.actor_name?`${escapeHtml(entry.actor_name)} · `:"";
   const room=entry.room_name?`${escapeHtml(entry.room_name)} · `:"";
   const detail=hostAuditDetail(entry);
   return `<div class="checkpoint-row"><strong>${room}${actor}${escapeHtml(hostAuditActionLabel(entry.action))}</strong><p>${detail?`${escapeHtml(detail)} · `:""}${formatRelativeTime(entry.created_at)}</p></div>`;
  }).join(""):`<div class="empty-state">本剧本尚无主持审计记录。</div>`;
  modal.className="modal host-detail-modal";
  setHtml(modal, `<h2>世界主持审计</h2><p class="wizard-intro">汇总所有平行房的主持敏感操作，最近 ${rows.length} 条。</p><div class="host-detail-list host-audit-list">${body}</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`);
  modalBackdrop.classList.add("show");
  modal.querySelector("[data-close]").onclick=closeModal;
 }catch(error){showError(error)}
}

const TAG_PRESETS = [
  { key: "players", label: "人数", placeholder: "例如 6" },
  { key: "difficulty", label: "难度", placeholder: "easy / medium / hard" },
  { key: "duration", label: "时长", placeholder: "例如 3h" },
  { key: "theme", label: "题材", placeholder: "例如 民国悬疑" }
];

function renderTagRows(tags = []) {
  const byKey = new Map((tags || []).map((t) => [t.tag_key || t.tagKey, t.tag_value || t.tagValue]));
  return TAG_PRESETS.map((preset) => {
    const value = byKey.get(preset.key) || "";
    return `<div class="form-group" style="margin-bottom:10px"><label>${escapeHtml(preset.label)} <code>${preset.key}</code></label><input class="field" data-tag-key="${preset.key}" value="${escapeHtml(value)}" placeholder="${escapeHtml(preset.placeholder)}"></div>`;
  }).join("");
}

export async function openWorldTagsModal() {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return showToast("请先选择剧本");
  try {
    const payload = await zhimuApi.getWorldTags(worldId);
    const tags = payload?.tags || [];
    modal.className = "modal world-tags-modal";
    setHtml(modal, `<h2>内容标签</h2><p class="wizard-intro">用于公开剧本库筛选。仅对已上架（catalog_public）的剧本计入 facet 统计。</p><div class="form-group">${renderTagRows(tags)}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-save-world-tags>保存标签</button></div>`);
    modalBackdrop.classList.add("show");
    modal.querySelector("[data-close]").onclick = closeModal;
    modal.querySelector("[data-save-world-tags]").onclick = async () => {
      const nextTags = TAG_PRESETS.map((preset) => {
        const value = modal.querySelector(`[data-tag-key="${preset.key}"]`)?.value?.trim() || "";
        return value ? { tagKey: preset.key, tagValue: value } : null;
      }).filter(Boolean);
      try {
        await zhimuApi.putWorldTags(nextTags, worldId);
        closeModal();
        showToast("标签已保存");
      } catch (error) {
        showError(error);
      }
    };
  } catch (error) {
    showError(error);
  }
}

function renderRemedyRow(item) {
  return `<article class="checkpoint-row" data-remedy-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.segment_key)} · ${escapeHtml(item.title)}</strong><p>${escapeHtml(item.trigger_hint || "无触发提示")}</p><p class="muted-note">${escapeHtml((item.host_script || "").slice(0, 120))}${(item.host_script || "").length > 120 ? "…" : ""}</p><button type="button" class="text-btn danger-text" data-delete-remedy="${escapeHtml(item.id)}">删除</button></article>`;
}

export async function openSegmentRemediesModal() {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return showToast("请先选择剧本");
  const draw = async () => {
    const payload = await zhimuApi.getSegmentRemedies(worldId);
    const items = payload?.items || [];
    const list = items.length ? items.map(renderRemedyRow).join("") : `<div class="empty-state">尚无补救模板，可在下方添加。</div>`;
    setHtml(modal.querySelector("[data-remedy-list]"), list);
    modal.querySelectorAll("[data-delete-remedy]").forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm("确定删除该补救模板？")) return;
        try {
          await zhimuApi.deleteSegmentRemedy(btn.dataset.deleteRemedy, worldId);
          showToast("已删除");
          await draw();
        } catch (error) {
          showError(error);
        }
      };
    });
  };
  try {
    modal.className = "modal segment-remedies-modal";
    setHtml(modal, `<h2>段落补救模板</h2><p class="wizard-intro">主持人在独立主持端可对卡关段落一键执行话术。segment_key 通常与章节键一致（如 ch1）。</p><div class="host-detail-list" data-remedy-list><div class="empty-state">正在加载…</div></div><div class="form-group" style="margin-top:14px;border-top:1px solid var(--line,#ece7df);padding-top:14px"><label>新增模板</label><input class="field" data-remedy-field="segmentKey" placeholder="段落键 ch1"><input class="field" data-remedy-field="title" placeholder="标题（主持端显示）"><textarea class="field" data-remedy-field="hostScript" rows="3" placeholder="主持播报话术"></textarea><input class="field" data-remedy-field="triggerHint" placeholder="触发提示（选填）"></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="primary-btn" data-add-remedy>添加模板</button></div>`);
    modalBackdrop.classList.add("show");
    modal.querySelector("[data-close]").onclick = closeModal;
    modal.querySelector("[data-add-remedy]").onclick = async () => {
      const val = (key) => modal.querySelector(`[data-remedy-field="${key}"]`)?.value?.trim() || "";
      const segmentKey = val("segmentKey");
      const title = val("title");
      const hostScript = val("hostScript");
      if (!segmentKey || !title || !hostScript) return showToast("请填写段落键、标题与话术");
      try {
        await zhimuApi.createSegmentRemedy({ segmentKey, title, hostScript, triggerHint: val("triggerHint") || undefined }, worldId);
        ["segmentKey", "title", "hostScript", "triggerHint"].forEach((key) => {
          const el = modal.querySelector(`[data-remedy-field="${key}"]`);
          if (el) el.value = "";
        });
        showToast("模板已添加");
        await draw();
      } catch (error) {
        showError(error);
      }
    };
    await draw();
  } catch (error) {
    showError(error);
  }
}


export const settingsViewApi = { settings, saveWorldSettings, saveRoomSettings, goWriterExport, openWorldAuditModal, openCatalogReviewModal, withdrawCatalogListing, openWorldTagsModal, openSegmentRemediesModal };
registerView("settings", settingsViewApi);
