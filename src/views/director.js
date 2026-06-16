/* Auto-split from app.js — director.js */
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
  const hostAuditActionLabel = F.hostAuditActionLabel || ((a) => a);
  const hostAuditDetail = F.hostAuditDetail || (() => "");
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
  const studioOptionsHtml = M.studioOptionsHtml || (() => "");
  const go = window.zhimuGo;
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
  const collapsibleCard = window.zhimuCollapsePanel?.collapsibleCard || ((opts) => `<article class="card">${opts.body || ""}</article>`);
  window.zhimuViews = window.zhimuViews || {};
  const viewExports = window.zhimuViews.director = window.zhimuViews.director || {};
function director(){
 const room=activeRuntimeRoom(),world=state.cloudStudio?.world;
 if(!room)return runtimeEmpty("主持监控台","请先在总览中选择或创建一个平行运行房。");
 const players=state.cloudHostPlayers||[],rules=(state.cloudRules||[]).filter(rule=>rule.enabled&&(!rule.room_id||rule.room_id===room.id)),events=state.cloudHostEvents||[];
 const pendingEvents=events.filter(e=>e.status!=="delayed");
 const joinedCount=players.filter(player=>player.joined).length,stuckCount=state.cloudHostStuckCount||0;
 const noPlayerProgressHint=players.length&&!joinedCount?`<section class="demo-strip" style="margin-bottom:14px"><div><span class="cloud-pill">等待玩家入房</span><strong style="margin-top:7px">尚无阅读进度</strong><p>分享运行房邀请码，或顶栏点「玩家入口」自测：读完一幕后本页玩家表会自动更新（SSE 已连接时无需手动刷新）。</p></div><button class="secondary-btn" data-action="onboarding-go-player">进入玩家视角</button></section>`:"";
 return `${cloudStatus()}<div class="director-head"><div><span class="live-label">● LIVE</span><strong>　${escapeHtml(world?.name||"当前世界")} · ${escapeHtml(room.name)}</strong><small class="director-poll-hint">${state.roomEventsConnected?"实时推送已连接 · 待确认事件与玩家进度会自动更新":"打开本页时每 15 秒自动刷新待确认事件与玩家进度"}</small></div><div class="row director-refresh-row"><button class="secondary-btn" data-action="refresh-host-room">刷新房间状态</button><button class="secondary-btn" data-action="refresh-host-events">刷新待确认事件</button><button class="secondary-btn" data-action="refresh-host-players">刷新玩家进度</button><button class="secondary-btn" data-action="create-recap">生成复盘</button><button class="secondary-btn" data-action="host-manual-log">＋ 主持日志</button><button class="primary-btn" data-action="create-checkpoint">＋ 创建存档点</button></div></div>
 <section class="stats-grid">${stat("♙",String(joinedCount),"已加入玩家",players.length+" 个角色席位")}${stat("⚑",String(stuckCount),"疑似卡关",stuckCount?"超过阈值未推进":"当前无卡关预警")}${stat("◷",String(pendingEvents.length),"待确认事件",pendingEvents.length?"需要主持人判断":events.length?"均已延迟":"当前无需人工介入")}${stat("⌘",String(rules.length),"运行中规则","仅统计当前房和世界模板")}</section>
 ${noPlayerProgressHint}
 ${collapsibleCard({ id: "director:host-events", title: "待确认事件", subtitle: "规则或调查触发的关键节点，确认后立即写入当前房间状态", headerExtra: hostEventBatchToolbar(), body: hostEventRows(), defaultOpen: true, className: "card host-events-card", style: "margin-top:14px" })}
 ${hostClueMatrixCard()}
 ${hostAuditCard()}
 ${collapsibleCard({ id: "director:rules-preview", title: "规则运行预览", subtitle: "查看当前平行房中各条规则的实时状态（不会修改任何数据）", headerExtra: `<button class="secondary-btn" data-action="rules-preview">刷新预览</button>`, body: directorRulesPreview(), defaultOpen: false, style: "margin-top:14px" })}
 ${collapsibleCard({ id: "director:players", title: "玩家运行状态", subtitle: "点击行查看分幕、线索、调查与最近日志；支持手动干预", headerExtra: `<div class="row host-manual-actions"><button class="secondary-btn" data-action="host-manual-grant-clue">手动发线索</button><button class="secondary-btn" data-action="host-manual-grant-item">手动发物品</button><button class="secondary-btn" data-action="host-manual-unlock-section">解锁分幕</button><button class="secondary-btn" data-action="host-manual-unlock-scene">开放场景</button></div>`, body: `<div class="host-runtime-table-wrap"><table class="host-runtime-table"><thead><tr><th>玩家 / 角色</th><th>入房</th><th>阅读进度</th><th>线索</th><th>最近操作</th><th>状态</th><th></th></tr></thead><tbody>${hostPlayerTableRows(players)}</tbody></table></div>`, defaultOpen: true, style: "margin-top:14px" })}`;
}

function hostPlayerTableRows(players){
 if(!players.length)return `<tr><td colspan="7"><div class="empty-state enriched-empty"><p><strong>当前运行房尚无角色席位</strong></p><p>请先在「剧本杀创作」或创建向导中配置角色，再建立平行房。</p><div class="row"><button class="text-btn" data-go="writer">前往剧本创作</button><button class="text-btn" data-action="world-rooms">管理平行房</button></div></div></td></tr>`;
 return players.map((player,index)=>`<tr class="${player.maybe_stuck?"host-row-warn":""}"><td><div class="host-player-cell"><div class="avatar small" style="background:${hostPlayerColor(index)}">${(player.player_display_name||player.role_name||"?")[0]}</div><div><strong>${escapeHtml(player.player_display_name||"席位空置")}</strong><p>${escapeHtml(player.role_name)}</p></div></div></td><td>${player.joined?`<span class="status-chip published">已加入</span><small>${player.last_activity_at?formatRelativeTime(player.last_activity_at):"刚刚"}</small>`:`<span class="status-chip draft">未加入</span>`}</td><td><strong>${player.completed_sections}/${player.total_sections}</strong><small>${escapeHtml(player.last_completed_section_title||"尚无完成分幕")}</small></td><td><strong>${player.clue_count}</strong><small>已读 ${player.read_clue_count}</small></td><td><strong>${escapeHtml(hostOperationLabel(player.last_operation_type,player.last_operation_message))}</strong><small>${player.last_activity_at?formatRelativeTime(player.last_activity_at):"—"}</small></td><td><span class="status-chip ${player.maybe_stuck?"testing":"published"}">${escapeHtml(player.stuck_label)}</span></td><td><button class="text-btn" data-action="host-player-detail" data-role="${player.role_slot_id}">详情</button></td></tr>`).join("");
}

function directorPlayers(){return (state.cloudHostPlayers||[]).map((item,index)=>{const parts=roleParts(item.role_name||item.name||""),pct=item.total_sections?Math.round(item.completed_sections/item.total_sections*100):0;return {...parts,progress:pct,caption:`云端阅读 ${item.completed_sections} / ${item.total_sections}`,scene:item.current_scene_id?"已记录当前场景":"尚未记录当前位置",color:hostPlayerColor(index)}})}

function hostEventBatchToolbar(){
 const events=state.cloudHostEvents||[];
 if(!events.length)return "";
 const selected=state.hostEventSelection||[];
 const allSelected=events.length>0&&selected.length===events.length;
 return `<div class="row host-event-batch-toolbar"><label class="check-label"><input type="checkbox" data-action="host-event-select-all" ${allSelected?"checked":""}><span>全选 (${events.length})</span></label><button class="primary-btn" data-action="batch-execute-host-events" ${selected.length?"":"disabled"}>批量确认 (${selected.length||0})</button><button class="secondary-btn" data-action="batch-dismiss-host-events" ${selected.length?"":"disabled"}>批量拒绝</button></div>`;
}

function toggleHostEventSelection(eventId,checked){
 const set=new Set(state.hostEventSelection||[]);
 if(checked)set.add(eventId);else set.delete(eventId);
 state.hostEventSelection=[...set];
 render();
}

function syncHostEventSelectAll(checked){
 const events=state.cloudHostEvents||[];
 state.hostEventSelection=checked?events.map((row)=>row.id):[];
 render();
}

async function batchHostEventsAction(action){
 const ids=state.hostEventSelection||[];
 if(!ids.length)return showToast("请先勾选待处理事件");
 try{
  const result=await zhimuApi.batchHostEvents(action,ids);
  state.hostEventSelection=[];
  await loadCloudData(true);
  render();
  const label=action==="execute"?"确认":"拒绝";
  showToast(`已${label} ${result.processed} 条${result.skipped?`，${result.skipped} 条已跳过`:""}`);
 }catch(error){showToast(error.message)}
}

function hostEventRows(){
 const events=state.cloudHostEvents||[];
 if(!events.length){state.hostEventSelection=[];return `<div class="empty-state">当前无需人工介入。普通动作由系统自动执行，关键转折会进入这里等待主持人判断。</div>`;}
 const selected=new Set(state.hostEventSelection||[]);
 const pending=events.filter(e=>e.status!=="delayed");
 const delayed=events.filter(e=>e.status==="delayed");
 const renderCard=(event,delayedCard=false)=>`<article class="host-event-card ${delayedCard?"host-event-delayed":""}"><label class="host-event-select check-label"><input type="checkbox" data-action="host-event-toggle" data-event="${event.id}" ${selected.has(event.id)?"checked":""} ${delayedCard?"disabled":""}></label><div class="host-event-body"><div class="host-event-head"><span class="cloud-pill">${escapeHtml(event.source_label||"系统")}</span>${delayedCard?`<span class="status-chip testing">已延迟</span>`:""}<strong>${escapeHtml(event.title)}</strong><small>${delayedCard&&event.delay_until?`将于 ${formatTime(event.delay_until)} 再次提醒 · `:``}${formatRelativeTime(event.created_at)}</small></div><p>${escapeHtml(event.description)}</p>${event.rule_name?`<div class="rule-block"><b>来源规则</b> · ${escapeHtml(event.rule_name)}</div>`:""}${event.action_summaries?.length?`<div class="host-event-actions-preview"><b>将执行</b>${event.action_summaries.map(item=>`<span>${escapeHtml(item)}</span>`).join("")}</div>`:""}<div class="event-actions"><button class="primary-btn" data-action="execute-host-event" data-event="${event.id}">确认并执行</button><button class="secondary-btn" data-action="dismiss-host-event" data-event="${event.id}">拒绝</button>${delayedCard?"":`<button class="secondary-btn" data-action="delay-host-event" data-event="${event.id}">延迟</button>`}<button class="text-btn" data-action="host-event-context" data-event="${event.id}">查看上下文</button></div></div></article>`;
 return `${pending.map(event=>renderCard(event,false)).join("")}${delayed.length?`<div class="host-events-delayed-block"><p class="section-kicker">已延迟 · ${delayed.length}</p>${delayed.map(event=>renderCard(event,true)).join("")}</div>`:""}`;
}

function hostActionSummary(actions=[]){
 return actions.map(action=>{
  if(action.type==="grant_clue")return `发放线索给角色席位`;
  if(action.type==="unlock_script_section")return `解锁分幕`;
  if(action.type==="unlock_scene")return `开放场景`;
  if(action.type==="timeline_log")return action.message||"写入日志";
  return action.type;
 }).join("；");
}

function hostClueMatrixLabel(cell={}){
 if(!cell.owned&&!cell.visible)return "未拥有";
 const parts=[];
 if(cell.owned)parts.push("已拥有");
 if(cell.read)parts.push("已读");
 if(cell.sharedWithRoom)parts.push("已公开");
 if(cell.sharedWithRoles)parts.push("已私享");
 if(!cell.owned&&cell.visible)parts.push(cell.read?"已读(分享)":"可见");
 return parts.join("·")||"—";
}

function hostClueMatrixCard(){
 const matrix=state.cloudHostClueMatrix,clues=matrix?.clues||[],players=(matrix?.players||[]).filter(player=>player.joined);
 if(!clues.length)return collapsibleCard({ id: "director:clue-matrix", title: "线索掌握矩阵", subtitle: "当前世界尚无线索节点，请先在编排台创建。", body: "", defaultOpen: false, className: "card host-clue-matrix-card", style: "margin-top:14px" });
 const head=players.map(player=>`<th>${escapeHtml(player.player_display_name||player.role_name)}</th>`).join("");
 const body=clues.map(clue=>{
  const cells=players.map(player=>{const cell=matrix.cells?.[clue.id]?.[player.role_slot_id]||{};const owned=cell.owned;return `<td>${owned?`<button type="button" class="clue-matrix-cell-btn ${cell.sharedWithRoom?"public":""}" data-action="host-clue-note" data-clue="${clue.id}" data-role="${player.role_slot_id}" title="点击编辑主持备注">${hostClueMatrixLabel(cell)}</button>`:`<span class="clue-matrix-cell">${hostClueMatrixLabel(cell)}</span>`}</td>`}).join("");
  return `<tr><th class="clue-matrix-clue">${escapeHtml(clue.name)}</th>${cells}</tr>`;
 }).join("");
 const summaries=(matrix.summaries||[]).map(item=>`<div class="clue-matrix-summary"><strong>${escapeHtml(item.clueName)}</strong><p>${escapeHtml(item.summary)}</p></div>`).join("");
 return collapsibleCard({ id: "director:clue-matrix", title: "线索掌握矩阵", subtitle: "查看谁拥有、读过或公开过每条线索", headerExtra: `<button class="secondary-btn" data-action="refresh-host-clue-matrix">刷新矩阵</button>`, body: `<div class="host-clue-matrix-wrap"><table class="host-clue-matrix"><thead><tr><th>线索 \\ 玩家</th>${head}</tr></thead><tbody>${body}</tbody></table></div><div class="clue-matrix-summaries">${summaries}</div>`, defaultOpen: false, className: "card host-clue-matrix-card", style: "margin-top:14px" });
}

function hostAuditCard(){
 const rows=state.cloudHostAuditLog||[];
 const body=rows.length?rows.map(entry=>{
  const actor=entry.actor_name?`${escapeHtml(entry.actor_name)} · `:"";
  const detail=hostAuditDetail(entry);
  const text=`${actor}<strong>${escapeHtml(hostAuditActionLabel(entry.action))}</strong>${detail?` · ${escapeHtml(detail)}`:""}`;
  return activity(text,formatRelativeTime(entry.created_at),"ok");
 }).join(""):`<div class="empty-state">暂无主持审计记录。手动发线索、延迟事件、存档恢复等操作会写入此处。</div>`;
 return collapsibleCard({ id: "director:audit", title: "主持审计", subtitle: "记录主持侧敏感操作，便于复盘与协作 accountability", headerExtra: `<button class="secondary-btn" data-action="refresh-host-audit">刷新审计</button>`, body: `<div class="host-audit-list">${body}</div>`, defaultOpen: false, style: "margin-top:14px" });
}

async function openHostPlayerDetail(roleSlotId){
 try{
  const detail=await zhimuApi.getHostPlayerDetail(roleSlotId),role=detail.role;
  modal.className="modal host-detail-modal";modal.innerHTML=`<h2>${escapeHtml(role.player_display_name||role.name)} · ${escapeHtml(role.name)}</h2><p class="wizard-intro">${escapeHtml(role.public_profile||"尚未补充公开身份")}</p><div class="host-detail-grid"><section><h3>分幕进度</h3><div class="host-detail-list">${detail.sections.map(section=>`<div class="host-detail-row"><div><strong>${section.sequence}. ${escapeHtml(section.title)}</strong><p>${section.completed?"已完成":section.unlocked||section.sequence===1?"可阅读":"未解锁"} · ${section.publication_status}</p></div>${section.completed?`<span class="status-chip published">完成</span>`:`<button class="text-btn" data-unlock-section="${section.id}" data-role="${roleSlotId}">手动解锁</button>`}</div>`).join("")||`<div class="empty-state">尚无分幕。</div>`}</div></section><section><h3>线索 · ${detail.clues.length}</h3><div class="host-detail-list">${detail.clues.map(clue=>`<div class="host-detail-row"><div><strong>${escapeHtml(clue.name)}</strong><p>${clue.read_at?"已阅读":"未阅读"}${clue.shared_with_room?" · 已公开":""} · ${formatTime(clue.acquired_at)}</p>${clue.player_note?`<small>玩家解读：${escapeHtml(clue.player_note)}</small>`:""}${clue.host_note?`<small>主持备注：${escapeHtml(clue.host_note)}</small>`:""}</div></div>`).join("")||`<div class="empty-state">尚未获得线索。</div>`}</div></section><section><h3>调查记录 · ${detail.investigations.length}</h3><div class="host-detail-list">${detail.investigations.map(item=>`<div class="host-detail-row"><strong>${escapeHtml(item.point_name)}</strong><p>${escapeHtml(item.scene_name)} · ${formatTime(item.investigated_at)}</p></div>`).join("")||`<div class="empty-state">尚无调查记录。</div>`}</div></section><section><h3>笔记 · ${detail.notes.length}</h3><div class="host-detail-list">${detail.notes.slice(0,6).map(note=>`<div class="host-detail-row"><strong>${escapeHtml(note.title)}</strong><p>${escapeHtml(note.body.slice(0,80))}</p></div>`).join("")||`<div class="empty-state">尚无笔记。</div>`}</div></section><section><h3>最近日志</h3><div class="host-detail-list">${detail.recentLogs.slice(0,8).map(log=>`<div class="host-detail-row"><strong>${escapeHtml(hostOperationLabel(log.event_type,log.message))}</strong><p>${escapeHtml(log.message)} · ${formatTime(log.created_at)}</p></div>`).join("")||`<div class="empty-state">尚无相关日志。</div>`}</div></section></div><label>主持备注</label><textarea class="field" rows="3" data-host-notes>${escapeHtml(role.host_notes||"")}</textarea><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="primary-btn" data-save-host-notes data-role="${roleSlotId}">保存备注</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-save-host-notes]").onclick=async()=>{try{await zhimuApi.hostSaveNotes(roleSlotId,modal.querySelector("[data-host-notes]").value);closeModal();await loadCloudData();showToast("主持备注已保存")}catch(error){showToast(error.message)}};
  modal.querySelectorAll("[data-unlock-section]").forEach(button=>button.onclick=async()=>{try{await zhimuApi.hostUnlockSection({roleSlotId:button.dataset.role,scriptSectionId:button.dataset.unlockSection});closeModal();await loadCloudData();showToast("分幕已手动解锁")}catch(error){showToast(error.message)}});
 }catch(error){showToast(error.message)}
}

async function openHostClueNote(clueId,roleSlotId){
 const matrix=state.cloudHostClueMatrix,clue=(matrix?.clues||[]).find((row)=>row.id===clueId),player=(matrix?.players||[]).find((row)=>row.role_slot_id===roleSlotId);
 if(!clue||!player)return showToast("找不到线索或玩家席位");
 const existing=matrix?.cells?.[clueId]?.[roleSlotId]?.hostNote||"";
 modal.className="modal";modal.innerHTML=`<h2>线索主持备注</h2><p class="wizard-intro">${escapeHtml(player.player_display_name||player.role_name)} · ${escapeHtml(clue.name)}</p><textarea class="field" rows="4" data-host-clue-note>${escapeHtml(existing)}</textarea><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-save-host-clue-note>保存备注</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-save-host-clue-note]").onclick=async()=>{try{await zhimuApi.hostClueNote(clueId,{roleSlotId,hostNote:modal.querySelector("[data-host-clue-note]").value});closeModal();await loadCloudData();showToast("线索主持备注已保存")}catch(error){showToast(error.message)}};
}

function openHostEventContext(eventId){
 const event=(state.cloudHostEvents||[]).find(item=>item.id===eventId);if(!event)return;
 openModal("待确认事件上下文",`<div class="rule-block"><b>来源</b> · ${escapeHtml(event.source_label||"系统")}<br><b>规则</b> · ${escapeHtml(event.rule_name||"—")}<br><b>触发条件</b><br>${escapeHtml(JSON.stringify(event.rule_conditions||{},null,2))}<br><br><b>将执行动作</b><br>${escapeHtml(JSON.stringify(event.actions||[],null,2))}</div>`,"关闭");
}

function openHostGrantClueModal(){
 const players=(state.cloudHostPlayers||[]).filter(player=>player.joined),clues=state.cloudStudio?.clues||[];
 if(!players.length)return showToast("当前没有已加入的玩家");
 if(!clues.length)return showToast("当前世界尚未创建线索");
 modal.className="modal";modal.innerHTML=`<h2>手动发放线索</h2><p class="wizard-intro">可一次发给多名玩家；每人独立获得 clue_ownership，不会默认公开给全房间。</p><div class="form-group">${studioSelect("线索","grantClue",clues.map(clue=>({id:clue.id,name:clue.name})))}<label>目标角色（可多选）</label><div class="member-picker">${players.map(player=>`<label><input type="checkbox" data-grant-role value="${player.role_slot_id}"> <span><b>${escapeHtml(player.player_display_name||"玩家")}</b> · ${escapeHtml(player.role_name)}</span></label>`).join("")}</div>${studioField("日志说明","grantMessage","input","主持人手动发放线索")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-grant-submit>确认发放</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-host-grant-submit]").onclick=async()=>{try{const values=studioValues();const roleSlotIds=[...modal.querySelectorAll("[data-grant-role]:checked")].map(el=>el.value);if(!roleSlotIds.length)return showToast("请至少选择一名玩家");await zhimuApi.hostGrantClue({roleSlotIds,clueId:values.grantClue,message:values.grantMessage});closeModal();await loadCloudData();showToast(`线索已发放给 ${roleSlotIds.length} 名玩家`)}catch(error){showToast(error.message)}};
}

function openDelayHostEventModal(eventId){
 const event=(state.cloudHostEvents||[]).find(item=>item.id===eventId);
 if(!event)return showToast("找不到待确认事件");
 modal.className="modal";modal.innerHTML=`<h2>延迟待确认事件</h2><p class="wizard-intro">「${escapeHtml(event.title)}」将从待办列表移出，到期后自动回到待确认队列。</p><div class="form-group"><label>延迟时长</label><select class="field" data-delay-minutes><option value="5">5 分钟</option><option value="15" selected>15 分钟</option><option value="30">30 分钟</option><option value="60">1 小时</option><option value="120">2 小时</option></select></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-delay-submit>确认延迟</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-delay-submit]").onclick=async()=>{try{const delayMinutes=Number(modal.querySelector("[data-delay-minutes]").value)||15;await zhimuApi.delayHostEvent(eventId,delayMinutes);closeModal();await loadCloudData();showToast(`已延迟 ${delayMinutes} 分钟`)}catch(error){showToast(error.message)}};
}

function openHostGrantItemModal(){
 const players=(state.cloudHostPlayers||[]).filter(player=>player.joined),items=state.cloudStudio?.items||[];
 if(!players.length)return showToast("当前没有已加入的玩家");
 if(!items.length)return showToast("当前世界尚未创建物品");
 modal.className="modal";modal.innerHTML=`<h2>手动发放物品</h2><p class="wizard-intro">物品会写入指定角色的背包（inventory），并可能触发 item_owned 规则。</p><div class="form-group">${studioSelect("目标角色","grantRole",players.map(player=>({id:player.role_slot_id,name:`${player.player_display_name||"玩家"} · ${player.role_name}`})))}${studioSelect("物品","grantItem",items.map(item=>({id:item.id,name:item.name})))}${studioField("数量","grantQuantity","input","1")}${studioField("日志说明","grantMessage","input","主持人手动发放物品")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-grant-item-submit>确认发放</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-host-grant-item-submit]").onclick=async()=>{try{const values=studioValues();await zhimuApi.hostGrantItem({roleSlotId:values.grantRole,itemId:values.grantItem,quantity:Math.max(1,Number(values.grantQuantity)||1),message:values.grantMessage});closeModal();await loadCloudData();showToast("物品已发放")}catch(error){showToast(error.message)}};
}

function openHostUnlockSectionModal(){
 const players=(state.cloudHostPlayers||[]).filter(player=>player.joined);if(!players.length)return showToast("当前没有已加入的玩家");
 const sections=(state.cloudStudio?.sections||[]);
 modal.className="modal";modal.innerHTML=`<h2>手动解锁分幕</h2><p class="wizard-intro">解锁后，对应玩家即可阅读该私人分幕。</p><div class="form-group">${studioSelect("目标角色","unlockRole",players.map(player=>({id:player.role_slot_id,name:`${player.player_display_name||"玩家"} · ${player.role_name}`})))}${studioSelect("分幕","unlockSection",sections.filter(section=>section.role_slot_id===players[0].role_slot_id).map(section=>({id:section.id,name:`${section.sequence}. ${section.title}`})))}${studioField("日志说明","unlockMessage","input","主持人手动解锁分幕")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-unlock-submit>确认解锁</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;const roleSelect=modal.querySelector('[data-studio-field="unlockRole"]'),sectionSelect=modal.querySelector('[data-studio-field="unlockSection"]');const refreshSections=()=>{const roleId=roleSelect.value;const options=sections.filter(section=>section.role_slot_id===roleId).map(section=>({id:section.id,name:`${section.sequence}. ${section.title}`}));sectionSelect.innerHTML=options.length?studioOptionsHtml(options,""):'<option value="">该角色尚无分幕</option>'};roleSelect.onchange=refreshSections;refreshSections();modal.querySelector("[data-host-unlock-submit]").onclick=async()=>{try{const values=studioValues();await zhimuApi.hostUnlockSection({roleSlotId:values.unlockRole,scriptSectionId:values.unlockSection,message:values.unlockMessage});closeModal();await loadCloudData();showToast("分幕已解锁")}catch(error){showToast(error.message)}};
}

function openHostUnlockSceneModal(){
 const scenes=state.cloudStudio?.scenes||[];if(!scenes.length)return showToast("当前世界尚未创建场景");
 modal.className="modal";modal.innerHTML=`<h2>手动开放场景</h2><p class="wizard-intro">开放后所有已入房玩家可在探索页看到该场景。</p><div class="form-group">${studioSelect("场景","unlockScene",scenes.map(scene=>({id:scene.id,name:scene.name})))}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-scene-submit>确认开放</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-host-scene-submit]").onclick=async()=>{try{await zhimuApi.hostUnlockScene(modal.querySelector('[data-studio-field="unlockScene"]').value);closeModal();await loadCloudData();showToast("场景已开放")}catch(error){showToast(error.message)}};
}

function openHostLogModal(){
 modal.className="modal";modal.innerHTML=`<h2>添加主持日志</h2><p class="wizard-intro">记录会写入本房间的时间线，可在世界运行日志中查看。</p><div class="form-group">${studioSelect("关联角色","logRole",[{id:"",name:"不指定角色"},...(state.cloudHostPlayers||[]).filter(player=>player.joined).map(player=>({id:player.role_slot_id,name:`${player.player_display_name||"玩家"} · ${player.role_name}`}))])}${studioField("日志内容","logMessage","textarea","例如：提醒林夏继续阅读序章")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-log-submit>写入日志</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-host-log-submit]").onclick=async()=>{try{const values=studioValues(),payload={message:values.logMessage,eventType:"host_note"};if(values.logRole)payload.roleSlotId=values.logRole;await zhimuApi.hostAddLog(payload);closeModal();await loadCloudData();showToast("主持日志已写入")}catch(error){showToast(error.message)}};
}
  viewExports.director = director;
  viewExports.hostPlayerTableRows = hostPlayerTableRows;
  viewExports.directorPlayers = directorPlayers;
  viewExports.hostEventRows = hostEventRows;
  viewExports.hostActionSummary = hostActionSummary;
function directorRulesPreview(){
 const preview=state.cloudRulesPreview;
 if(!preview)return `<div class="empty-state">点击「刷新预览」查看当前房间中启用规则的条件评估结果。</div>`;
 if(!preview.length)return `<div class="empty-state">当前平行房没有启用的运行规则。</div>`;
 const statusLabel=window.zhimuUserMessages?.rulePreviewStatusLabel||((s)=>s);
 return `<div class="host-detail-list">${preview.map((row)=>`<div class="checkpoint-row"><strong>${escapeHtml(row.name)}</strong><p>${escapeHtml(statusLabel(row.status))}${row.conditionsMet===false?" · 条件未满足":""}</p>${row.status==="manual_ready"?`<button class="text-btn" data-action="rule-manual-trigger" data-rule="${row.id}">立即触发</button>`:""}</div>`).join("")}</div>`;
}

async function refreshRulesPreview(){
 if(!activeRuntimeRoom())return showToast("请先选择运行房");
 try{
  const result=await zhimuApi.previewRoomRules();
  state.cloudRulesPreview=result.rules||[];
  render();
  showToast("规则预览已更新");
 }catch(error){showToast(error.message)}
}

async function triggerManualRuleFromDirector(ruleId){
 if(!activeRuntimeRoom())return showToast("请先选择运行房");
 try{
  await zhimuApi.triggerManualRule(ruleId);
  await refreshRulesPreview();
  await loadCloudData();
  showToast("手动规则已执行");
 }catch(error){showToast(error.message)}
}

  viewExports.directorRulesPreview = directorRulesPreview;
  viewExports.refreshRulesPreview = refreshRulesPreview;
  viewExports.triggerManualRuleFromDirector = triggerManualRuleFromDirector;
  viewExports.hostEventBatchToolbar = hostEventBatchToolbar;
  viewExports.toggleHostEventSelection = toggleHostEventSelection;
  viewExports.syncHostEventSelectAll = syncHostEventSelectAll;
  viewExports.batchHostEventsAction = batchHostEventsAction;
  viewExports.hostClueMatrixLabel = hostClueMatrixLabel;
  viewExports.hostClueMatrixCard = hostClueMatrixCard;
  viewExports.hostAuditCard = hostAuditCard;
  viewExports.openHostPlayerDetail = openHostPlayerDetail;
  viewExports.openHostClueNote = openHostClueNote;
  viewExports.openHostEventContext = openHostEventContext;
  viewExports.openHostGrantClueModal = openHostGrantClueModal;
  viewExports.openDelayHostEventModal = openDelayHostEventModal;
  viewExports.openHostGrantItemModal = openHostGrantItemModal;
  viewExports.openHostUnlockSectionModal = openHostUnlockSectionModal;
  viewExports.openHostUnlockSceneModal = openHostUnlockSceneModal;
  viewExports.openHostLogModal = openHostLogModal;
})(window);
export {};
