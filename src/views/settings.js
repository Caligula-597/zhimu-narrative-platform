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
  const showToast = T.showToast || (() => {});
  const activeRuntimeRoom = U.activeRuntimeRoom || (() => null);
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  window.zhimuViews = window.zhimuViews || {};
  const viewExports = window.zhimuViews.settings = window.zhimuViews.settings || {};

function settings(){
 const world=state.cloudStudio?.world;
 const room=activeRuntimeRoom();
 const roomSettings=state.cloudRoomSettings||{};
 const canEditWorld=Boolean(world);
 return `<section class="rules-layout"><article class="card"><div class="section-head"><div><h3>世界信息</h3><p>名称与简介会展示在总览与玩家入口</p></div></div><div class="form-group"><label>世界名称</label><input class="field" id="settings-world-name" value="${escapeHtml(world?.name||"")}" ${canEditWorld?"":"readonly"}><label>世界简介</label><textarea class="field" id="settings-world-summary" rows="3" ${canEditWorld?"":"readonly"}>${escapeHtml(world?.summary||"")}</textarea><label>角色席位数</label><input class="field" value="${String(state.cloudStudio?.roles?.length||0)}" readonly><button class="primary-btn" style="margin-top:14px" data-action="save-world-settings" ${canEditWorld?"":"disabled"}>保存世界信息</button></div></article>
 <article class="card"><div class="section-head"><div><h3>运行房选项</h3><p>${room?`当前平行房：${escapeHtml(room.name)}`:"请先在总览中选择平行运行房"}</p></div></div><div class="form-group"><label class="check-label"><input type="checkbox" id="settings-host-voice-listen" ${roomSettings.hostVoiceListen?"checked":""} ${room?"":"disabled"}><span><strong>主持人可旁听私密语音房</strong><small>开启后，主持人在未受邀的情况下仍可进入私密语音房旁听（不可发言）。</small></span></label><button class="primary-btn" style="margin-top:14px" data-action="save-room-settings" ${room?"":"disabled"}>保存运行房选项</button></div></article>
 <aside class="card"><div class="section-head"><div><h3>帮助与数据</h3><p>步骤说明与错误排查</p></div></div><button class="secondary-btn full-btn" data-action="open-creator-guide">创作步骤指引</button><button class="secondary-btn full-btn" data-action="open-error-guide">错误提示与排查</button><button class="secondary-btn full-btn" style="margin-top:10px" data-action="go-writer-export">前往剧本创作 · 导出/导入</button><p class="muted-note" style="margin-top:10px">实体卡绑定将在 Beta 阶段开放，当前版本不影响线上运行。</p></aside></section>`;
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

  viewExports.settings = settings;
  viewExports.saveWorldSettings = saveWorldSettings;
  viewExports.saveRoomSettings = saveRoomSettings;
  viewExports.goWriterExport = goWriterExport;
})(window);
export {};
