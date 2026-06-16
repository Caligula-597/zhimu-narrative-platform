/* Auto-split from app.js — archive.js */
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
  const checkpointRestoreStatusLabel = F.checkpointRestoreStatusLabel || ((s) => s);
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
  const go = window.zhimuGo;
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
  window.zhimuViews = window.zhimuViews || {};
  const viewExports = window.zhimuViews.archive = window.zhimuViews.archive || {};
  const RESTORE_SCOPE_OPTIONS = window.zhimuUserMessages?.RESTORE_SCOPE_OPTIONS || [];

function archive(){
 const room=activeRuntimeRoom(),checkpoints=state.cloudCheckpoints||[],recaps=state.cloudRecaps||[];
 if(!room)return `${cloudStatus()}<article class="card runtime-empty"><p class="eyebrow">RUNTIME REQUIRED</p><h2>存档与复盘需要运行房</h2><p>请先建立或选择一个平行房。运行房存档与创作版本快照是两套独立数据。</p><button class="primary-btn" data-action="world-rooms">管理平行房</button></article>`;
 if(state.activeRecapId)return recapDetailView();
 const isPlayer=state.view==="player";
 return `${cloudStatus()}
 <article class="card"><div class="section-head"><div><h3>房间复盘 · ${escapeHtml(room.name)}</h3><p>基于真实日志、线索流转、调查记录与规则触发，生成可分享的跑团回顾（非 AI 版）。</p></div>${isPlayer?"":`<button class="primary-btn" data-action="create-recap">生成复盘</button>`}</div>
 ${recapListSection(recaps,isPlayer)}
 <div class="tutorial-tip"><b>视角说明</b><span>主持人可查看全局复盘；玩家只能看到自己视角下的时间线、笔记与错过的线索。</span></div></article>
 <article class="card" style="margin-top:14px"><div class="section-head"><div><h3>运行房存档</h3><p>保存当前平行房的玩家进度、线索与开放场景；可将存档恢复到本房或其它平行房（同一世界内）。</p></div>${isPlayer?"":`<button class="primary-btn" data-action="create-checkpoint">＋ 创建存档点</button>`}</div>
 ${checkpoints.length?`<div class="checkpoint-list">${checkpoints.map(item=>`<article class="checkpoint-card"><div class="checkpoint-head"><div><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.description||"无主持备注")}</p></div><span class="status-chip published">可恢复</span></div><div class="checkpoint-meta"><span>创建于 ${formatTime(item.created_at)}</span><span>${escapeHtml(item.created_by_name||"主持人")}</span><span>${item.summary?.joinedPlayers||0} 人已加入 · ${item.summary?.clueCount||0} 条线索 · ${item.summary?.unlockedSceneCount||0} 个开放场景</span></div><div class="row"><button class="secondary-btn" data-action="checkpoint-detail" data-checkpoint="${item.id}">查看详情</button>${isPlayer?"":`<button class="primary-btn" data-action="restore-checkpoint" data-checkpoint="${item.id}">恢复到此状态</button>`}</div></article>`).join("")}</div>`:`<div class="empty-state">${isPlayer?"暂无存档点。":"暂无存档点。主持人可在主持监控台或本页创建第一个运行房快照。"}</div>`}
 <div class="tutorial-tip"><b>与创作版本区分</b><span>checkpoint 只记录运行房状态，不会覆盖编排台中的章节、场景或规则内容。</span></div></article>`;
}

function recapListSection(recaps,isPlayer){
 if(isPlayer){
  const latest=state.cloudRecapLatest;
  if(!latest)return `<div class="empty-state">主持人尚未生成本房间的复盘报告。跑团结束后，请让主持人在「存档与复盘」页生成。</div>`;
  return `<article class="recap-card"><div class="recap-head"><div><strong>${escapeHtml(latest.label)}</strong><p>${escapeHtml(latest.description||"无备注")}</p></div><span class="status-chip published">我的视角</span></div><div class="checkpoint-meta"><span>生成于 ${formatTime(latest.created_at)}</span><span>${escapeHtml(latest.created_by_name||"主持人")}</span><span>${latest.summary?.cluesDiscovered||0} 条线索流转 · ${latest.summary?.investigationsCompleted||0} 次调查</span></div><button class="secondary-btn" data-action="recap-detail" data-recap="${latest.id}" data-player="1">查看我的复盘</button></article>`;
 }
 if(!recaps.length)return `<div class="empty-state">尚未生成复盘。跑团结束后点击「生成复盘」，系统会从时间线、线索流转、调查记录与规则执行汇总。</div>`;
 return `<div class="recap-list">${recaps.map(item=>`<article class="recap-card"><div class="recap-head"><div><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.description||"无备注")}</p></div><span class="status-chip published">全局复盘</span></div><div class="checkpoint-meta"><span>生成于 ${formatTime(item.created_at)}</span><span>${escapeHtml(item.created_by_name||"主持人")}</span><span>${item.summary?.joinedPlayers||0} 人 · ${item.summary?.cluesDiscovered||0} 条线索 · ${item.summary?.rulesTriggered||0} 条规则触发</span></div><button class="secondary-btn" data-action="recap-detail" data-recap="${item.id}">查看全局复盘</button></article>`).join("")}</div>`;
}

function recapDetailView(){
 const detail=state.cloudRecapDetail;
 if(!detail)return `<article class="card"><div class="empty-state">正在加载复盘…</div><button class="secondary-btn" data-action="recap-back">返回列表</button></article>`;
 const snapshot=detail.snapshot||{},perspective=detail.perspective||snapshot.perspective||"host";
 return `<article class="card recap-detail"><div class="section-head"><div><p class="eyebrow">${perspective==="player"?"MY RECAP":"FULL RECAP"}</p><h3>${escapeHtml(detail.label)}</h3><p>${escapeHtml(detail.description||"")} · 生成于 ${formatTime(detail.created_at)} · ${escapeHtml(detail.created_by_name||"主持人")}</p></div><button class="secondary-btn" data-action="recap-back">返回</button></div>
 ${recapRoomSummary(snapshot,perspective)}
 ${recapPlayers(snapshot)}
 ${recapTimeline(snapshot)}
 ${recapClueSection(snapshot,perspective)}
 ${recapHostEvents(snapshot)}
 ${recapEndingTriggers(snapshot)}
 ${recapNotes(snapshot,perspective)}
 <div class="tutorial-tip"><b>非 AI 版</b><span>以上内容直接来自数据库日志与流转记录。后续可接入 AI 总结「真相与结局解读」。</span></div></article>`;
}

function recapRoomSummary(snapshot){
 const room=snapshot.room||{},truth=snapshot.truth||{};
 return `<section class="recap-section"><h4>房间与真相</h4><div class="recap-grid"><div class="recap-stat"><strong>${escapeHtml(room.worldName||"当前世界")}</strong><span>${escapeHtml(room.name||"")} · ${escapeHtml(room.status||"")}</span></div><div class="recap-stat"><strong>${snapshot.stats?.cluesDiscovered||0} / ${(snapshot.stats?.cluesDiscovered||0)+(snapshot.stats?.cluesUndiscovered||0)}</strong><span>线索已发现 / 世界总量</span></div><div class="recap-stat"><strong>${snapshot.stats?.investigationsCompleted||0}</strong><span>调查完成次数</span></div></div>${truth.worldSummary?`<div class="rule-block"><b>世界简介 / 真相背景</b><p>${escapeHtml(truth.worldSummary)}</p>${truth.finalChapter?`<small>最近推进章节：第 ${truth.finalChapter.sequence} 章 · ${escapeHtml(truth.finalChapter.title)}</small>`:""}</div>`:""}</section>`;
}

function recapPlayers(snapshot){
 const players=snapshot.players||[];
 if(!players.length)return "";
 return `<section class="recap-section"><h4>玩家角色</h4><div class="host-detail-list">${players.map(player=>`<div class="checkpoint-row"><strong>${escapeHtml(player.playerDisplayName||"席位空置")} · ${escapeHtml(player.roleName)}</strong><p>阅读 ${player.completedSections}/${player.totalSections} · 线索 ${player.ownedClues}（已读 ${player.readClues}） · 笔记 ${player.noteCount||0}</p></div>`).join("")}</div></section>`;
}

function recapTimeline(snapshot){
 const events=snapshot.keyTimeline||[];
 if(!events.length)return `<section class="recap-section"><h4>关键时间线</h4><div class="empty-state">尚无时间线事件。</div></section>`;
 return `<section class="recap-section"><h4>关键时间线</h4><div class="recap-timeline">${events.map(event=>`<div class="recap-timeline-row"><span>${formatTime(event.at)}</span><p>${escapeHtml(event.label||event.message||event.title||"")}</p></div>`).join("")}</div></section>`;
}

function recapClueSection(snapshot,perspective){
 const discovered=snapshot.clueDiscovery||[];
 const missed=perspective==="player"?(snapshot.missedClues||[]):(snapshot.undiscoveredClues||[]).map(row=>({...row,clueName:row.clueName,masked:false}));
 return `<section class="recap-section"><h4>线索发现顺序</h4><div class="host-detail-list">${discovered.length?discovered.map(row=>`<div class="checkpoint-row"><strong>${row.masked?"【未公开线索】":escapeHtml(row.clueName||"未命名线索")}</strong><p>${escapeHtml(row.roleName||"")}${row.playerDisplayName?` · ${escapeHtml(row.playerDisplayName)}`:""} · ${formatTime(row.acquiredAt)}${row.readAt?` · 已读 ${formatTime(row.readAt)}`:""}${row.sharedWithRoom?" · 已公开":""}</p></div>`).join(""):`<div class="empty-state">本局尚无已发放线索。</div>`}</div>
 <h4 style="margin-top:18px">${perspective==="player"?"我错过的线索":"未发现线索"}</h4><div class="host-detail-list">${missed.length?missed.map(row=>`<div class="checkpoint-row"><strong>${row.masked?"某角色持有的未公开线索":escapeHtml(row.clueName||"未命名线索")}</strong><p>${row.acquiredByRoleName?`${escapeHtml(row.acquiredByRoleName)} 已获得 · ${formatTime(row.acquiredAt)}`:"全房间无人获得"}</p></div>`).join(""):`<div class="empty-state">${perspective==="player"?"你没有明显错过的已知线索。":"所有世界线索均已被某角色获得。"}</div>`}</div></section>`;
}

function recapHostEvents(snapshot){
 const events=snapshot.hostConfirmedEvents||[];
 if(!events.length)return `<section class="recap-section"><h4>主持确认事件</h4><div class="empty-state">本局没有已处理的主持确认事件。</div></section>`;
 return `<section class="recap-section"><h4>主持确认事件</h4><div class="host-detail-list">${events.map(event=>`<div class="checkpoint-row"><strong>${escapeHtml(event.title)}</strong><p>${event.status==="executed"?"已确认执行":"已驳回"}${event.ruleName?` · 规则 ${escapeHtml(event.ruleName)}`:""} · ${formatTime(event.resolvedAt||event.createdAt)}</p>${event.description?`<small>${escapeHtml(event.description)}</small>`:""}${event.actionsSummary?`<small>动作：${escapeHtml(event.actionsSummary)}</small>`:""}</div>`).join("")}</div></section>`;
}

function recapEndingTriggers(snapshot){
 const rules=snapshot.endingTriggers||[];
 if(!rules.length)return `<section class="recap-section"><h4>结局触发条件</h4><div class="empty-state">本局尚无已触发的自动化规则。</div></section>`;
 return `<section class="recap-section"><h4>结局触发条件</h4><div class="host-detail-list">${rules.map(rule=>`<div class="checkpoint-row"><strong>${escapeHtml(rule.ruleName)}</strong><p>${formatTime(rule.executedAt)} · ${escapeHtml(rule.mode||"")}</p><small>当 ${escapeHtml(rule.conditionsSummary||"")} → ${escapeHtml(rule.actionsSummary||"")}</small></div>`).join("")}</div></section>`;
}

function recapNotes(snapshot,perspective){
 const notes=snapshot.notes||[];
 const title=perspective==="player"?"我的笔记精选":"玩家笔记精选";
 if(!notes.length)return `<section class="recap-section"><h4>${title}</h4><div class="empty-state">尚无笔记记录。</div></section>`;
 return `<section class="recap-section"><h4>${title}</h4><div class="host-detail-list">${notes.slice(0,12).map(note=>`<div class="checkpoint-row"><strong>${escapeHtml(note.title)}</strong><p>${perspective==="host"?`${escapeHtml(note.roleName||"")} · `:""}${formatTime(note.createdAt)}</p><small>${escapeHtml((note.body||"").slice(0,160))}${(note.body||"").length>160?"…":""}</small></div>`).join("")}</div></section>`;
}

function checkpointPlayerSummary(snapshot={}){
 const players=snapshot.players||[];
 if(!players.length)return `<div class="empty-state">快照中尚无角色席位数据。</div>`;
 return players.map(player=>`<div class="checkpoint-row"><strong>${escapeHtml(player.playerDisplayName||"席位空置")} · ${escapeHtml(player.roleName)}</strong><p>阅读 ${player.completedSections}/${player.totalSections} · 线索 ${player.ownedClues}（已读 ${player.readClues}）</p></div>`).join("");
}

function checkpointClueSummary(snapshot={}){
 const clues=snapshot.clueOwnership||[];
 if(!clues.length)return `<div class="empty-state">快照中尚无已发放线索。</div>`;
 return clues.map(clue=>`<div class="checkpoint-row"><strong>${escapeHtml(clue.clueName)}</strong><p>${escapeHtml(clue.roleName)}${clue.playerDisplayName?` · ${escapeHtml(clue.playerDisplayName)}`:""} · ${formatTime(clue.acquiredAt)}</p></div>`).join("");
}

function openCreateRecapModal(){
 if(!activeRuntimeRoom())return showToast("请先选择运行房");
 modal.className="modal";modal.innerHTML=`<h2>生成房间复盘</h2><p class="wizard-intro">系统会从时间线、线索流转、调查记录、主持确认事件与自动化规则执行汇总生成结构化复盘。玩家只能查看自己视角。</p><div class="form-group">${studioField("复盘标题","recapTitle","input","例如：第一夜 · 完整复盘")}${studioField("主持备注","recapDescription","textarea","记录本局结局、未解之谜或下次补充说明")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-recap-submit>确认生成</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-recap-submit]").onclick=async()=>{try{const values=studioValues();if(!values.recapTitle)return showToast("请填写复盘标题");const created=await zhimuApi.createRecap({title:values.recapTitle,description:values.recapDescription});closeModal();await loadCloudData();showToast("房间复盘已生成");state.activeRecapId=created.id;state.cloudRecapDetail=created;render()}catch(error){showToast(error.message)}};
}

function openCreateCheckpointModal(){
 if(!activeRuntimeRoom())return showToast("请先选择运行房");
 modal.className="modal";modal.innerHTML=`<h2>创建运行房存档点</h2><p class="wizard-intro">保存当前玩家进度、线索归属、开放场景与待确认事件。之后可在本页选择要恢复的内容，恢复到当前或其它平行房。</p><div class="form-group">${studioField("存档名称","checkpointTitle","input","例如：第一夜收工")}${studioField("主持备注","checkpointDescription","textarea","记录今晚推进到了哪里、下次从哪里继续")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-checkpoint-submit>确认创建</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-checkpoint-submit]").onclick=async()=>{try{const values=studioValues();if(!values.checkpointTitle)return showToast("请填写存档名称");await zhimuApi.createCheckpoint({title:values.checkpointTitle,description:values.checkpointDescription});closeModal();await loadCloudData();showToast("运行房存档点已创建")}catch(error){showToast(error.message)}};
}

async function openRecapDetail(recapId,asPlayer=false){
 if(!activeRuntimeRoom())return showToast("请先选择运行房");
 try{
  const detail=await zhimuApi.getRecap(recapId,asPlayer);
  state.activeRecapId=recapId;
  state.cloudRecapDetail=detail;
  render();
 }catch(error){showToast(error.message)}
}

function closeRecapDetail(){
 state.activeRecapId=null;
 state.cloudRecapDetail=null;
 render();
}

function checkpointRestoreHistoryRows(restores = []) {
 if(!restores.length)return `<div class="empty-state">此存档点尚未被恢复过。</div>`;
 return restores.map((row)=>{
  const scopeKeys=row.restore_scope&&typeof row.restore_scope==="object"?Object.entries(row.restore_scope).filter(([,v])=>v).map(([k])=>k):[];
  const scopeHint=scopeKeys.length?` · 域：${scopeKeys.join("、")}`:"";
  const err=row.error_message?` · ${row.error_message}`:"";
  return `<div class="checkpoint-row"><strong>${escapeHtml(checkpointRestoreStatusLabel(row.status))}</strong><p>${escapeHtml(row.requested_by_name||"主持人")} · ${formatTime(row.applied_at||row.created_at)}${scopeHint}${err?escapeHtml(err):""}</p></div>`;
 }).join("");
}

async function openCheckpointDetail(checkpointId){
 if(!activeRuntimeRoom())return showToast("请先选择运行房");
 try{
  const [detail,restores]=await Promise.all([
   zhimuApi.getCheckpoint(checkpointId),
   zhimuApi.getCheckpointRestores(checkpointId).catch(()=>[])
  ]);
  const snapshot=detail.snapshot||{};
  modal.className="modal host-detail-modal";modal.innerHTML=`<h2>${escapeHtml(detail.label)}</h2><p class="wizard-intro">${escapeHtml(detail.description||"无主持备注")} · 创建于 ${formatTime(detail.created_at)} · ${escapeHtml(detail.created_by_name||"主持人")}</p>${snapshot.phase?`<div class="rule-block"><b>最近推进章节</b> · 第 ${snapshot.phase.sequence} 章 · ${escapeHtml(snapshot.phase.chapterTitle||"未命名章节")}</div>`:""}<div class="host-detail-grid"><section><h3>玩家进度摘要</h3><div class="host-detail-list">${checkpointPlayerSummary(snapshot)}</div></section><section><h3>线索摘要</h3><div class="host-detail-list">${checkpointClueSummary(snapshot)}</div></section><section><h3>开放场景 · ${(snapshot.unlockedScenes||[]).length}</h3><div class="host-detail-list">${(snapshot.unlockedScenes||[]).map(scene=>`<div class="checkpoint-row"><strong>${escapeHtml(scene.name)}</strong><p>${formatTime(scene.unlockedAt)}</p></div>`).join("")||`<div class="empty-state">尚无开放场景。</div>`}</div></section><section><h3>待确认事件 · ${(snapshot.pendingEvents||[]).length}</h3><div class="host-detail-list">${(snapshot.pendingEvents||[]).map(event=>`<div class="checkpoint-row"><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.description||"")}</p></div>`).join("")||`<div class="empty-state">快照时没有待确认事件。</div>`}</div></section><section><h3>恢复历史 · ${restores.length}</h3><div class="host-detail-list">${checkpointRestoreHistoryRows(restores)}</div></section></div><div class="tutorial-tip"><b>恢复说明</b><span>恢复只会影响运行进度，不会修改剧本编排或规则内容。建议在恢复前先创建一个新存档点。</span></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="primary-btn" data-action="restore-checkpoint" data-checkpoint="${checkpointId}">恢复到此状态</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;
  modal.querySelector("[data-action=restore-checkpoint]").onclick=()=>{closeModal();openRestoreCheckpointModal(checkpointId,detail.label)};
 }catch(error){showToast(error.message)}
}

function roomNameById(roomId){
 const rooms=state.cloudStudio?.rooms||[];
 return rooms.find((row)=>row.id===roomId)?.name||"所选平行房";
}

function openRestoreCheckpointModal(checkpointId,checkpointLabel){
 if(!activeRuntimeRoom())return showToast("请先选择运行房");
 const fromList=state.cloudCheckpoints?.find((row)=>row.id===checkpointId);
 const label=checkpointLabel||fromList?.label||"存档点";
 const rooms=(state.cloudStudio?.rooms||[]).filter((row)=>row.id);
 const currentRoomId=zhimuApi.context.roomId;
 const scopeRows=RESTORE_SCOPE_OPTIONS.map((opt)=>`<label class="check-label restore-scope-row"><input type="checkbox" data-restore-scope="${opt.key}" ${opt.default?"checked":""}><span><strong>${escapeHtml(opt.label)}</strong><small>${escapeHtml(opt.hint||"")}</small></span></label>`).join("");
 const targetOptions=rooms.map((row)=>`<option value="${row.id}" ${row.id===currentRoomId?"selected":""}>${escapeHtml(row.name)}${row.id===currentRoomId?"（当前）":""}</option>`).join("");
 modal.className="modal";
 modal.innerHTML=`<h2>恢复存档</h2><p class="wizard-intro">将「${escapeHtml(label)}」中的运行状态写入选定平行房。此操作不可撤销，建议恢复前先保存当前状态。</p><div class="form-group"><label>恢复到哪个平行房</label><select class="field" id="restore-target-room">${targetOptions}</select></div><div class="form-group"><label>要恢复的内容</label><div class="restore-scope-list">${scopeRows}</div></div><div class="tutorial-tip"><b>注意</b><span>未勾选的项目将保持目标房间当前状态不变。</span></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" id="restore-checkpoint-confirm">确认恢复</button></div>`;
 modalBackdrop.classList.add("show");
 modal.querySelector("[data-close]").onclick=closeModal;
 modal.querySelector("#restore-checkpoint-confirm").onclick=async()=>{
  const button=modal.querySelector("#restore-checkpoint-confirm");
  button.disabled=true;button.textContent="正在恢复…";
  try{
   const scope={};
   modal.querySelectorAll("[data-restore-scope]").forEach((input)=>{scope[input.dataset.restoreScope]=input.checked});
   const targetRoomId=modal.querySelector("#restore-target-room").value;
   await zhimuApi.restoreCheckpoint(checkpointId,{scope,targetRoomId});
   closeModal();
   if(targetRoomId!==currentRoomId)zhimuApi.selectRoom(targetRoomId);
   await loadCloudData(true);
   const targetName=roomNameById(targetRoomId);
   showToast(`已恢复到「${targetName}」的存档状态`);
  }catch(error){
   button.disabled=false;button.textContent="确认恢复";
   showToast(error.message);
  }
 };
}
  viewExports.archive = archive;
  viewExports.recapDetailView = recapDetailView;
  viewExports.checkpointPlayerSummary = checkpointPlayerSummary;
  viewExports.checkpointClueSummary = checkpointClueSummary;
  viewExports.openCreateRecapModal = openCreateRecapModal;
  viewExports.openCreateCheckpointModal = openCreateCheckpointModal;
  viewExports.openRecapDetail = openRecapDetail;
  viewExports.closeRecapDetail = closeRecapDetail;
  viewExports.checkpointRestoreHistoryRows = checkpointRestoreHistoryRows;
  viewExports.openCheckpointDetail = openCheckpointDetail;
  viewExports.openRestoreCheckpointModal = openRestoreCheckpointModal;
})(window);
export {};
