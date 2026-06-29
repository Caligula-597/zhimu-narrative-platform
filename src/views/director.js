/* Auto-split from app.js — director.js */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";

  const state = window.zhimuState;
  const { content, toast, modal, modalBackdrop } = window.zhimuDom;
  const F = window.zhimuFormat || {};
  const U = window.zhimuUi || {};
  const M = window.zhimuModal || {};
  const R = window.zhimuRuntime || {};
  const V = window.zhimuViews || {};
  const S = window.zhimuUiSemantics || {};
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
  const showError = S.showError || ((error, fallback = "操作失败，请稍后重试") => showToast(window.zhimuStatus?.normalizeError?.(error, fallback) || error?.message || fallback));
  const closeModal = M.closeModal || (() => {});
  const openModal = M.openModal || (() => {});
  const studioModal = M.studioModal || (() => {});
  const studioField = M.studioField || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioSelect = M.studioSelect || (() => "");
  const studioOptionsHtml = M.studioOptionsHtml || (() => "");
  const go = (view) => window.zhimuRuntime?.go?.(view);
  function render() { window.zhimuRuntime?.render?.(); }
  function loadCloudData(...args) { return window.zhimuRuntime?.loadCloudData?.(...args); }
  function refreshHostRoom(...args) { return R.refreshHostRoom?.(...args) || loadCloudData(...args); }
  function refreshHostPlayers(...args) { return R.refreshHostPlayers?.(...args) || refreshHostRoom(...args); }
  function refreshHostClueMatrix(...args) { return R.refreshHostClueMatrix?.(...args) || refreshHostRoom(...args); }
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
  const collapsibleCard = window.zhimuCollapsePanel?.collapsibleCard || ((opts) => `<article class="card">${opts.body || ""}</article>`);

function directorConsoleCard(card){
 return `<div class="director-console-card ${card.hot ? "is-hot" : ""}"><span>${escapeHtml(card.kicker)}</span><strong>${escapeHtml(card.value)}</strong><p>${escapeHtml(card.label)}</p></div>`;
}

function directorPriorityAction(action){
 return `<div class="director-priority-action"><span>${escapeHtml(action.index)}</span><div><b>${escapeHtml(action.title)}</b><p>${escapeHtml(action.detail)}</p></div><button type="button" data-action="${escapeHtml(action.action)}"${action.extra || ""}>${escapeHtml(action.button)}</button></div>`;
}

export function director(){
 const room=activeRuntimeRoom(),world=state.cloudStudio?.world;
 if(!room)return runtimeEmpty("主持监控台","请先在总览中选择或创建一个平行运行房。");
 const players=state.cloudHostPlayers||[],rules=(state.cloudRules||[]).filter(rule=>rule.enabled&&(!rule.room_id||rule.room_id===room.id)),events=state.cloudHostEvents||[];
 const pendingEvents=events.filter(e=>e.status!=="delayed");
 const joinedCount=players.filter(player=>player.joined).length,stuckCount=state.cloudHostStuckCount||0;
 const hostPlayersError=state.cloudHostPlayersError||"";
 const hostPlayersErrorBanner=hostPlayersError?`<section class="demo-strip" style="margin-bottom:14px;border-color:rgba(167,120,61,0.45);background:var(--brass-soft)"><div><span class="cloud-pill">玩家进度</span><strong style="margin-top:7px">未能加载玩家运行状态</strong><p>${escapeHtml(hostPlayersError)}</p></div><button class="secondary-btn" type="button" data-action="refresh-host-players">重试</button></section>`:"";
 const inviteCode=room.invite_code||"";
 const noPlayerProgressHint=players.length&&!joinedCount?`<section class="demo-strip" style="margin-bottom:14px"><div><span class="cloud-pill">等待玩家入房</span><strong style="margin-top:7px">尚无阅读进度</strong><p>${inviteCode?`邀请码 <code class="invite-code-inline">${escapeHtml(inviteCode)}</code> · 复制后发给玩家，或让他们打开 play.getzhimu.com 输入码。`:"分享运行房邀请码"}读完一幕后本页玩家表会自动更新。</p>${inviteCode?`<div class="row" style="margin-top:8px"><button class="secondary-btn" data-action="copy-invite-code" data-invite-code="${escapeHtml(inviteCode)}">复制邀请码</button><button class="secondary-btn" data-action="copy-play-link" data-invite-code="${escapeHtml(inviteCode)}">复制玩家链接</button><button class="secondary-btn" data-action="room-invite-current">邀请详情</button></div>`:""}</div><button class="secondary-btn" data-action="onboarding-go-player">进入玩家视角</button></section>`:"";
 const completedSections=players.reduce((sum,player)=>sum+(player.completed_sections||0),0);
 const totalSections=players.reduce((sum,player)=>sum+(player.total_sections||0),0);
 const progressPct=totalSections?Math.round(completedSections/totalSections*100):0;
 const consoleCards=[
  {kicker:"ROOM",value:S.status?.("room", state.roomEventsConnected?"connected":"polling")?.label || (state.roomEventsConnected?"实时连接":"轮询中"),label:state.roomEventsConnected?"待确认事件与玩家进度会自动推送":"页面会定时刷新房间状态",hot:state.roomEventsConnected},
  {kicker:"PLAYERS",value:`${joinedCount}/${players.length}`,label:"已加入玩家 / 总席位",hot:joinedCount>0},
  {kicker:"PROGRESS",value:`${progressPct}%`,label:totalSections?`${completedSections}/${totalSections} 段私人剧情完成`:"暂无可统计分幕",hot:progressPct>=60},
  {kicker:"PENDING",value:String(pendingEvents.length),label:pendingEvents.length?"需要主持人判断":"暂无人工待办",hot:pendingEvents.length>0}
 ];
 const priorityActions=[
  pendingEvents.length?{title:"先处理待确认事件",detail:`${pendingEvents.length} 条规则或调查触发正在等待确认。`,action:"refresh-host-events",button:"查看待办"}:null,
  stuckCount?{title:"查看疑似卡关玩家",detail:`${stuckCount} 个席位长时间没有推进，建议查看详情或手动发线索。`,action:"host-nudge-waiting",button:"提醒玩家"}:null,
  inviteCode&&!joinedCount?{title:"邀请玩家入房",detail:`邀请码 ${inviteCode}，复制后发给玩家开始阅读。`,action:"room-invite-current",button:"邀请详情"}:null,
  {title:"创建现场存档点",detail:"关键推进后保存房间状态，方便复盘和回滚分析。",action:"create-checkpoint",button:"创建存档"},
  {title:"记录主持日志",detail:"把线下判断、玩家口述和临时裁定写入运行记录。",action:"host-manual-log",button:"写日志"},
  {title:"启动数字锁测试",detail:"使用创作者端小游戏模板，给当前房间发一个可验证机关。",action:"host-mini-game",button:"启动机关"}
 ].filter(Boolean).slice(0,5).map((item,index)=>({...item,index:String(index+1).padStart(2,"0")}));
 return `${cloudStatus()}<div class="director-head"><div><span class="live-label">● LIVE</span><strong>　${escapeHtml(world?.name||"当前世界")} · ${escapeHtml(room.name)}</strong>${inviteCode?`<small class="director-invite-hint">邀请码 ${escapeHtml(inviteCode)}</small>`:""}<small class="director-poll-hint">${state.roomEventsConnected?"实时推送已连接 · 待确认事件与玩家进度会自动更新":"打开本页时每 15 秒自动刷新待确认事件与玩家进度"}</small></div><div class="row director-refresh-row">${inviteCode?`<button class="secondary-btn" data-action="room-invite-current">邀请玩家</button>`:""}<button class="secondary-btn" data-action="refresh-host-room">刷新房间状态</button><button class="secondary-btn" data-action="refresh-host-events">刷新待确认事件</button><button class="secondary-btn" data-action="refresh-host-players">刷新玩家进度</button><button class="secondary-btn" data-action="create-recap">生成复盘</button><button class="secondary-btn" data-action="host-manual-log">＋ 主持日志</button><button class="primary-btn" data-action="create-checkpoint">＋ 创建存档点</button></div></div>
 <section class="director-console ${escapeHtml(S.surface?.("host")?.className || "")}">
  <article class="director-console-main">
   <div class="section-head"><div><p class="section-kicker">RUN CONTROL</p><h3>运行控制台</h3><p>先看房间状态、玩家推进和人工待办，再处理下方细表。</p></div><button class="secondary-btn" data-action="refresh-host-room">刷新现场</button></div>
   <div class="director-console-grid">${consoleCards.map(directorConsoleCard).join("")}</div>
  </article>
  <article class="director-console-main director-priority-panel">
   <div class="section-head"><div><p class="section-kicker">HOST PRIORITY</p><h3>主持优先动作</h3><p>按当前房间状态给出可直接执行的主持操作。</p></div></div>
   <div class="director-priority-list">${priorityActions.map(directorPriorityAction).join("")}</div>
  </article>
 </section>
 <section class="stats-grid">${stat("♙",String(joinedCount),"已加入玩家",players.length+" 个角色席位")}${stat("⚑",String(stuckCount),"疑似卡关",stuckCount?"超过阈值未推进":"当前无卡关预警")}${stat("◷",String(pendingEvents.length),"待确认事件",pendingEvents.length?"需要主持人判断":events.length?"均已延迟":"当前无需人工介入")}${stat("⌘",String(rules.length),"运行中规则","仅统计当前房和世界模板")}</section>
 ${noPlayerProgressHint}
 ${hostPlayersErrorBanner}
 ${hostPlayerWaitStrip()}
 ${collapsibleCard({ id: "director:host-events", title: "待确认事件", subtitle: "规则或调查触发的关键节点，确认后立即写入当前房间状态", headerExtra: hostEventBatchToolbar(), body: hostEventRows(), defaultOpen: true, className: "card host-events-card", style: "margin-top:14px" })}
 ${hostLiveFeed()}
 ${hostClueMatrixCard()}
 ${hostAuditCard()}
 ${collapsibleCard({ id: "director:rules-preview", title: "规则运行预览", subtitle: "查看当前平行房中各条规则的实时状态（不会修改任何数据）", headerExtra: `<button class="secondary-btn" data-action="rules-preview">刷新预览</button>`, body: directorRulesPreview(), defaultOpen: false, style: "margin-top:14px" })}
 ${collapsibleCard({ id: "director:players", title: "玩家运行状态", subtitle: "点击行查看分幕、线索、调查与最近日志；支持手动干预", headerExtra: `<div class="row host-manual-actions"><button class="secondary-btn" data-action="host-manual-grant-clue">手动发线索</button><button class="secondary-btn" data-action="host-manual-grant-item">手动发物品</button><button class="secondary-btn" data-action="host-manual-unlock-section">解锁分幕</button><button class="secondary-btn" data-action="host-manual-unlock-scene">开放场景</button><button class="secondary-btn" data-action="host-mini-game">启动数字锁</button></div>`, body: `<div class="host-runtime-table-wrap"><table class="host-runtime-table"><thead><tr><th>玩家 / 角色</th><th>入房</th><th>阅读进度</th><th>线索</th><th>最近操作</th><th>状态</th><th></th></tr></thead><tbody>${hostPlayerTableRows(players)}</tbody></table></div>`, defaultOpen: true, style: "margin-top:14px" })}`;
}

export function hostPlayerTableRows(players){
 if(!players.length)return `<tr><td colspan="7"><div class="empty-state enriched-empty"><p><strong>当前运行房尚无角色席位</strong></p><p>请先在「剧本杀创作」或创建向导中配置角色，再建立平行房。</p><div class="row"><button class="text-btn" data-go="writer">前往剧本创作</button><button class="text-btn" data-action="world-rooms">管理平行房</button></div></div></td></tr>`;
 const waitingIds=pendingEventRoleIds();
 return players.map((player,index)=>{const waiting=waitingIds.has(String(player.role_slot_id));const joinChip=player.joined?(S.chip?.("player","joined")||`<span class="status-chip published">已加入</span>`):(S.chip?.("player","offline")||`<span class="status-chip draft">未加入</span>`);const stateChip=player.maybe_stuck?(S.chip?.("player","stuck")||`<span class="status-chip testing">疑似卡关</span>`):(S.chip?.("player","complete",{label:player.stuck_label,tone:"published"})||`<span class="status-chip published">${escapeHtml(player.stuck_label)}</span>`);return `<tr class="${player.maybe_stuck?"host-row-warn":""}${waiting?" host-row-waiting":""}"><td><div class="host-player-cell"><div class="avatar small" style="background:${hostPlayerColor(index)}">${(player.player_display_name||player.role_name||"?")[0]}</div><div><strong>${escapeHtml(player.player_display_name||"席位空置")}</strong><p>${escapeHtml(player.role_name)}${waiting?` · <span class="host-wait-tag">待你确认</span>`:""}</p></div></div></td><td>${joinChip}<small>${player.joined?(player.last_activity_at?formatRelativeTime(player.last_activity_at):"刚刚"):""}</small></td><td><strong>${player.completed_sections}/${player.total_sections}</strong><small>${escapeHtml(player.last_completed_section_title||"尚无完成分幕")}</small></td><td><strong>${player.clue_count}</strong><small>已读 ${player.read_clue_count}</small></td><td><strong>${escapeHtml(hostOperationLabel(player.last_operation_type,player.last_operation_message))}</strong><small>${player.last_activity_at?formatRelativeTime(player.last_activity_at):"—"}</small></td><td>${stateChip}</td><td><button class="text-btn" data-action="host-player-detail" data-role="${player.role_slot_id}">详情</button>${player.joined?` <button class="text-btn host-kick-btn" data-action="host-kick-player" data-role="${player.role_slot_id}" title="内测：移出房间；同账号重进可继承进度">踢出</button>`:""}</td></tr>`}).join("");
}

export function directorPlayers(){return (state.cloudHostPlayers||[]).map((item,index)=>{const parts=roleParts(item.role_name||item.name||""),pct=item.total_sections?Math.round(item.completed_sections/item.total_sections*100):0;return {...parts,progress:pct,caption:`云端阅读 ${item.completed_sections} / ${item.total_sections}`,scene:item.current_scene_id?"已记录当前场景":"尚未记录当前位置",color:hostPlayerColor(index)}})}

export function hostEventBatchToolbar(){
 const events=state.cloudHostEvents||[];
 if(!events.length)return "";
 const selected=state.hostEventSelection||[];
 const allSelected=events.length>0&&selected.length===events.length;
 return `<div class="row host-event-batch-toolbar"><label class="check-label"><input type="checkbox" data-action="host-event-select-all" ${allSelected?"checked":""}><span>全选 (${events.length})</span></label><button class="primary-btn" data-action="batch-execute-host-events" ${selected.length?"":"disabled"}>批量确认 (${selected.length||0})</button><button class="secondary-btn" data-action="batch-dismiss-host-events" ${selected.length?"":"disabled"}>批量拒绝</button></div>`;
}

function eventRelatedRoleIds(event){
 const ids=new Set((event.trigger_players||[]).map(String));
 for(const action of event.actions||[]){
  const rid=action.roleSlotId??action.role_slot_id;
  if(rid)ids.add(String(rid));
  for(const r of action.roleSlotIds||action.role_slot_ids||[])ids.add(String(r));
 }
 return [...ids];
}

function hostPlayerByRoleId(roleSlotId){
 return (state.cloudHostPlayers||[]).find((player)=>String(player.role_slot_id)===String(roleSlotId));
}

function pendingEventRoleIds(){
 const ids=new Set();
 for(const event of (state.cloudHostEvents||[]).filter((row)=>row.status!=="delayed")){
  eventRelatedRoleIds(event).forEach((id)=>ids.add(id));
 }
 return ids;
}

function hostEventPlayerChips(event){
 const ids=eventRelatedRoleIds(event);
 if(!ids.length)return `<div class="host-event-players"><b>关联玩家</b><span class="status-chip draft">全房间 · 确认后全员可见</span></div>`;
 const chips=ids.map((id)=>{
  const player=hostPlayerByRoleId(id);
  const label=player?`${player.player_display_name||"玩家"} · ${player.role_name}`:`席位 ${String(id).slice(0,8)}…`;
  return `<button type="button" class="host-player-chip text-btn" data-action="host-player-detail" data-role="${id}">${escapeHtml(label)}</button>`;
 }).join("");
 return `<div class="host-event-players"><b>关联玩家</b>${chips}</div>`;
}

export function hostPlayerWaitStrip(){
 const events=(state.cloudHostEvents||[]).filter((event)=>event.status==="pending");
 if(!events.length)return "";
 const waitingIds=pendingEventRoleIds();
 const players=(state.cloudHostPlayers||[]).filter((player)=>player.joined&&waitingIds.has(String(player.role_slot_id)));
 const playerLine=players.length?`${players.map((player)=>escapeHtml(player.player_display_name||player.role_name)).join("、")} 可能在等待你确认`:"确认后玩家端会实时收到分幕/场景解锁通知";
 return `<section class="demo-strip host-wait-strip"><div><span class="cloud-pill">主持 ↔ 玩家</span><strong>${events.length} 条待确认 · 关联 ${waitingIds.size||"全"} 个角色席位</strong><p>${playerLine}。优先处理与卡关玩家相关的事件。</p></div><div class="row host-wait-actions"><button class="primary-btn" data-action="host-nudge-waiting">提醒等待中的玩家</button><button class="secondary-btn" data-action="refresh-host-events">刷新待办</button></div></section>`;
}

export function hostLiveFeed(){
 const logs=(state.cloudWorldLogs||[]).slice(0,6);
 if(!logs.length)return "";
 const body=logs.map((log)=>activity(`${escapeHtml(hostOperationLabel(log.event_type,log.message))}${log.message?` · ${escapeHtml(log.message)}`:""}`,formatRelativeTime(log.created_at),logActivityType(log.event_type))).join("");
 return collapsibleCard({ id: "director:live-feed", title: "玩家实时动态", subtitle: "最近房间时间线 — 与玩家阅读、调查操作同步", headerExtra: `<button class="secondary-btn" data-action="refresh-host-room">刷新</button>`, body: `<div class="host-audit-list">${body}</div>`, defaultOpen: true, style: "margin-top:14px" });
}

export function toggleHostEventSelection(eventId,checked){
 const set=new Set(state.hostEventSelection||[]);
 if(checked)set.add(eventId);else set.delete(eventId);
 state.hostEventSelection=[...set];
 render();
}

export function syncHostEventSelectAll(checked){
 const events=state.cloudHostEvents||[];
 state.hostEventSelection=checked?events.map((row)=>row.id):[];
 render();
}

export async function batchHostEventsAction(action){
 const ids=state.hostEventSelection||[];
 if(!ids.length)return showToast("请先勾选待处理事件");
 try{
  const result=await zhimuApi.batchHostEvents(action,ids);
  state.hostEventSelection=[];
  await refreshHostRoom(true);
  render();
  const label=action==="execute"?"确认":"拒绝";
  showToast(`已${label} ${result.processed} 条${result.skipped?`，${result.skipped} 条已跳过`:""}`);
 }catch(error){showError(error)}
}

export function hostEventRows(){
 const events=state.cloudHostEvents||[];
 if(!events.length){state.hostEventSelection=[];return `<div class="empty-state">当前无需人工介入。普通动作由系统自动执行，关键转折会进入这里等待主持人判断。</div>`;}
 const selected=new Set(state.hostEventSelection||[]);
 const pending=events.filter(e=>e.status!=="delayed");
 const delayed=events.filter(e=>e.status==="delayed");
 const renderCard=(event,delayedCard=false)=>`<article class="host-event-card ${delayedCard?"host-event-delayed":""}"><label class="host-event-select check-label"><input type="checkbox" data-action="host-event-toggle" data-event="${event.id}" ${selected.has(event.id)?"checked":""} ${delayedCard?"disabled":""}></label><div class="host-event-body"><div class="host-event-head"><span class="cloud-pill">${escapeHtml(event.source_label||"系统")}</span>${delayedCard?`<span class="status-chip testing">已延迟</span>`:""}<strong>${escapeHtml(event.title)}</strong><small>${delayedCard&&event.delay_until?`将于 ${formatTime(event.delay_until)} 再次提醒 · `:``}${formatRelativeTime(event.created_at)}</small></div><p>${escapeHtml(event.description)}</p>${event.rule_name?`<div class="rule-block"><b>来源规则</b> · ${escapeHtml(event.rule_name)}</div>`:""}${hostEventPlayerChips(event)}${event.action_summaries?.length?`<div class="host-event-actions-preview"><b>确认后将执行</b>${event.action_summaries.map(item=>`<span>${escapeHtml(item)}</span>`).join("")}</div>`:""}<div class="event-actions"><button class="primary-btn" data-action="execute-host-event" data-event="${event.id}">确认并执行</button><button class="secondary-btn" data-action="dismiss-host-event" data-event="${event.id}">拒绝</button>${delayedCard?"":`<button class="secondary-btn" data-action="delay-host-event" data-event="${event.id}">延迟</button>`}<button class="text-btn" data-action="host-event-context" data-event="${event.id}">查看上下文</button></div></div></article>`;
 return `${pending.map(event=>renderCard(event,false)).join("")}${delayed.length?`<div class="host-events-delayed-block"><p class="section-kicker">已延迟 · ${delayed.length}</p>${delayed.map(event=>renderCard(event,true)).join("")}</div>`:""}`;
}

export function hostActionSummary(actions=[]){
 return actions.map(action=>{
  if(action.type==="grant_clue")return `发放线索给角色席位`;
  if(action.type==="unlock_script_section")return `解锁分幕`;
  if(action.type==="unlock_scene")return `开放场景`;
  if(action.type==="timeline_log")return action.message||"写入日志";
  return action.type;
 }).join("；");
}

export function hostClueMatrixLabel(cell={}){
 if(!cell.owned&&!cell.visible)return "未拥有";
 const parts=[];
 if(cell.owned)parts.push("已拥有");
 if(cell.read)parts.push("已读");
 if(cell.sharedWithRoom)parts.push("已公开");
 if(cell.sharedWithRoles)parts.push("已私享");
 if(!cell.owned&&cell.visible)parts.push(cell.read?"已读(分享)":"可见");
 return parts.join("·")||"—";
}

export function hostClueMatrixCard(){
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

export function hostAuditCard(){
 const rows=state.cloudHostAuditLog||[];
 const body=rows.length?rows.map(entry=>{
  const actor=entry.actor_name?`${escapeHtml(entry.actor_name)} · `:"";
  const detail=hostAuditDetail(entry);
  const text=`${actor}<strong>${escapeHtml(hostAuditActionLabel(entry.action))}</strong>${detail?` · ${escapeHtml(detail)}`:""}`;
  return activity(text,formatRelativeTime(entry.created_at),"ok");
 }).join(""):`<div class="empty-state">暂无主持审计记录。手动发线索、延迟事件、存档恢复等操作会写入此处。</div>`;
 return collapsibleCard({ id: "director:audit", title: "主持审计", subtitle: "记录主持侧敏感操作，便于复盘与协作 accountability", headerExtra: `<button class="secondary-btn" data-action="refresh-host-audit">刷新审计</button>`, body: `<div class="host-audit-list">${body}</div>`, defaultOpen: false, className: "card host-audit-card", style: "margin-top:14px" });
}

export async function kickHostPlayer(roleSlotId){
 const player=hostPlayerByRoleId(roleSlotId);
 if(!player?.joined)return showToast("该席位尚无玩家");
 const name=player.player_display_name||"玩家";
 if(!window.confirm(`确定将「${name}」移出角色「${player.role_name}」？\n\n同账号重新选角可继承进度；其他账号接席将从零开始。`))return;
 try{
  await zhimuApi.hostKickPlayer(roleSlotId);
  closeModal();
  await refreshHostRoom();
  showToast(`已移出 ${name}`);
 }catch(error){showError(error)}
}

export async function openHostPlayerDetail(roleSlotId){
 try{
  const detail=await zhimuApi.getHostPlayerDetail(roleSlotId),role=detail.role;
  modal.className="modal host-detail-modal";modal.innerHTML=`<h2>${escapeHtml(role.player_display_name||role.name)} · ${escapeHtml(role.name)}</h2><p class="wizard-intro">${escapeHtml(role.public_profile||"尚未补充公开身份")}</p><div class="host-detail-grid"><section><h3>分幕进度</h3><div class="host-detail-list">${detail.sections.map(section=>`<div class="host-detail-row"><div><strong>${section.sequence}. ${escapeHtml(section.title)}</strong><p>${section.completed?"已完成":section.unlocked||section.sequence===1?"可阅读":"未解锁"} · ${section.publication_status}</p></div>${section.completed?`<span class="status-chip published">完成</span>`:`<button class="text-btn" data-unlock-section="${section.id}" data-role="${roleSlotId}">手动解锁</button>`}</div>`).join("")||`<div class="empty-state">尚无分幕。</div>`}</div></section><section><h3>线索 · ${detail.clues.length}</h3><div class="host-detail-list">${detail.clues.map(clue=>`<div class="host-detail-row"><div><strong>${escapeHtml(clue.name)}</strong><p>${clue.read_at?"已阅读":"未阅读"}${clue.shared_with_room?" · 已公开":""} · ${formatTime(clue.acquired_at)}</p>${clue.player_note?`<small>玩家解读：${escapeHtml(clue.player_note)}</small>`:""}${clue.host_note?`<small>主持备注：${escapeHtml(clue.host_note)}</small>`:""}</div></div>`).join("")||`<div class="empty-state">尚未获得线索。</div>`}</div></section><section><h3>调查记录 · ${detail.investigations.length}</h3><div class="host-detail-list">${detail.investigations.map(item=>`<div class="host-detail-row"><strong>${escapeHtml(item.point_name)}</strong><p>${escapeHtml(item.scene_name)} · ${formatTime(item.investigated_at)}</p></div>`).join("")||`<div class="empty-state">尚无调查记录。</div>`}</div></section><section><h3>笔记 · ${detail.notes.length}</h3><div class="host-detail-list">${detail.notes.slice(0,6).map(note=>`<div class="host-detail-row"><strong>${escapeHtml(note.title)}</strong><p>${escapeHtml(note.body.slice(0,80))}</p></div>`).join("")||`<div class="empty-state">尚无笔记。</div>`}</div></section><section><h3>最近日志</h3><div class="host-detail-list">${detail.recentLogs.slice(0,8).map(log=>`<div class="host-detail-row"><strong>${escapeHtml(hostOperationLabel(log.event_type,log.message))}</strong><p>${escapeHtml(log.message)} · ${formatTime(log.created_at)}</p></div>`).join("")||`<div class="empty-state">尚无相关日志。</div>`}</div></section></div><label>主持备注</label><textarea class="field" rows="3" data-host-notes>${escapeHtml(role.host_notes||"")}</textarea><div class="modal-actions">${role.player_display_name?`<button class="secondary-btn host-kick-btn" data-kick-player="${roleSlotId}">踢出玩家</button>`:""}<button class="secondary-btn" data-close>关闭</button><button class="primary-btn" data-save-host-notes data-role="${roleSlotId}">保存备注</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;const kickBtn=modal.querySelector("[data-kick-player]");if(kickBtn)kickBtn.onclick=()=>kickHostPlayer(kickBtn.dataset.kickPlayer);modal.querySelector("[data-save-host-notes]").onclick=async()=>{try{await zhimuApi.hostSaveNotes(roleSlotId,modal.querySelector("[data-host-notes]").value);closeModal();await refreshHostPlayers();showToast("主持备注已保存")}catch(error){showError(error)}};
  modal.querySelectorAll("[data-unlock-section]").forEach(button=>button.onclick=async()=>{try{await zhimuApi.hostUnlockSection({roleSlotId:button.dataset.role,scriptSectionId:button.dataset.unlockSection});closeModal();await refreshHostRoom();showToast("分幕已手动解锁")}catch(error){showError(error)}});
 }catch(error){showError(error)}
}

export async function openHostClueNote(clueId,roleSlotId){
 const matrix=state.cloudHostClueMatrix,clue=(matrix?.clues||[]).find((row)=>row.id===clueId),player=(matrix?.players||[]).find((row)=>row.role_slot_id===roleSlotId);
 if(!clue||!player)return showToast("找不到线索或玩家席位");
 const existing=matrix?.cells?.[clueId]?.[roleSlotId]?.hostNote||"";
 modal.className="modal";modal.innerHTML=`<h2>线索主持备注</h2><p class="wizard-intro">${escapeHtml(player.player_display_name||player.role_name)} · ${escapeHtml(clue.name)}</p><textarea class="field" rows="4" data-host-clue-note>${escapeHtml(existing)}</textarea><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-save-host-clue-note>保存备注</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-save-host-clue-note]").onclick=async()=>{try{await zhimuApi.hostClueNote(clueId,{roleSlotId,hostNote:modal.querySelector("[data-host-clue-note]").value});closeModal();await refreshHostClueMatrix();showToast("线索主持备注已保存")}catch(error){showError(error)}};
}

export function openHostEventContext(eventId){
 const event=(state.cloudHostEvents||[]).find(item=>item.id===eventId);if(!event)return;
 openModal("待确认事件上下文",`<div class="rule-block"><b>来源</b> · ${escapeHtml(event.source_label||"系统")}<br><b>规则</b> · ${escapeHtml(event.rule_name||"—")}<br><b>触发条件</b><br>${escapeHtml(JSON.stringify(event.rule_conditions||{},null,2))}<br><br><b>将执行动作</b><br>${escapeHtml(JSON.stringify(event.actions||[],null,2))}</div>`,"关闭");
}

export function openHostGrantClueModal(){
 const players=(state.cloudHostPlayers||[]).filter(player=>player.joined),clues=state.cloudStudio?.clues||[];
 if(!players.length)return showToast("当前没有已加入的玩家");
 if(!clues.length)return showToast("当前世界尚未创建线索");
 modal.className="modal";modal.innerHTML=`<h2>手动发放线索</h2><p class="wizard-intro">可一次发给多名玩家；每人独立获得 clue_ownership，不会默认公开给全房间。</p><div class="form-group">${studioSelect("线索","grantClue",clues.map(clue=>({id:clue.id,name:clue.name})))}<label>目标角色（可多选）</label><div class="member-picker">${players.map(player=>`<label><input type="checkbox" data-grant-role value="${player.role_slot_id}"> <span><b>${escapeHtml(player.player_display_name||"玩家")}</b> · ${escapeHtml(player.role_name)}</span></label>`).join("")}</div>${studioField("日志说明","grantMessage","input","主持人手动发放线索")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-grant-submit>确认发放</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-host-grant-submit]").onclick=async()=>{try{const values=studioValues();const roleSlotIds=[...modal.querySelectorAll("[data-grant-role]:checked")].map(el=>el.value);if(!roleSlotIds.length)return showToast("请至少选择一名玩家");await zhimuApi.hostGrantClue({roleSlotIds,clueId:values.grantClue,message:values.grantMessage});closeModal();await refreshHostRoom();showToast(`线索已发放给 ${roleSlotIds.length} 名玩家`)}catch(error){showError(error)}};
}

export function openDelayHostEventModal(eventId){
 const event=(state.cloudHostEvents||[]).find(item=>item.id===eventId);
 if(!event)return showToast("找不到待确认事件");
 modal.className="modal";modal.innerHTML=`<h2>延迟待确认事件</h2><p class="wizard-intro">「${escapeHtml(event.title)}」将从待办列表移出，到期后自动回到待确认队列。</p><div class="form-group"><label>延迟时长</label><select class="field" data-delay-minutes><option value="5">5 分钟</option><option value="15" selected>15 分钟</option><option value="30">30 分钟</option><option value="60">1 小时</option><option value="120">2 小时</option></select></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-delay-submit>确认延迟</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-delay-submit]").onclick=async()=>{try{const delayMinutes=Number(modal.querySelector("[data-delay-minutes]").value)||15;await zhimuApi.delayHostEvent(eventId,delayMinutes);closeModal();await refreshHostRoom();showToast(`已延迟 ${delayMinutes} 分钟`)}catch(error){showError(error)}};
}

export function openHostGrantItemModal(){
 const players=(state.cloudHostPlayers||[]).filter(player=>player.joined),items=state.cloudStudio?.items||[];
 if(!players.length)return showToast("当前没有已加入的玩家");
 if(!items.length)return showToast("当前世界尚未创建物品");
 modal.className="modal";modal.innerHTML=`<h2>手动发放物品</h2><p class="wizard-intro">物品会写入指定角色的背包（inventory），并可能触发 item_owned 规则。</p><div class="form-group">${studioSelect("目标角色","grantRole",players.map(player=>({id:player.role_slot_id,name:`${player.player_display_name||"玩家"} · ${player.role_name}`})))}${studioSelect("物品","grantItem",items.map(item=>({id:item.id,name:item.name})))}${studioField("数量","grantQuantity","input","1")}${studioField("日志说明","grantMessage","input","主持人手动发放物品")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-grant-item-submit>确认发放</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-host-grant-item-submit]").onclick=async()=>{try{const values=studioValues();await zhimuApi.hostGrantItem({roleSlotId:values.grantRole,itemId:values.grantItem,quantity:Math.max(1,Number(values.grantQuantity)||1),message:values.grantMessage});closeModal();await refreshHostRoom();showToast("物品已发放")}catch(error){showError(error)}};
}

export function openHostUnlockSectionModal(){
 const players=(state.cloudHostPlayers||[]).filter(player=>player.joined);if(!players.length)return showToast("当前没有已加入的玩家");
 const sections=(state.cloudStudio?.sections||[]);
 modal.className="modal";modal.innerHTML=`<h2>手动解锁分幕</h2><p class="wizard-intro">解锁后，对应玩家即可阅读该私人分幕。</p><div class="form-group">${studioSelect("目标角色","unlockRole",players.map(player=>({id:player.role_slot_id,name:`${player.player_display_name||"玩家"} · ${player.role_name}`})))}${studioSelect("分幕","unlockSection",sections.filter(section=>section.role_slot_id===players[0].role_slot_id).map(section=>({id:section.id,name:`${section.sequence}. ${section.title}`})))}${studioField("日志说明","unlockMessage","input","主持人手动解锁分幕")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-unlock-submit>确认解锁</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;const roleSelect=modal.querySelector('[data-studio-field="unlockRole"]'),sectionSelect=modal.querySelector('[data-studio-field="unlockSection"]');const refreshSections=()=>{const roleId=roleSelect.value;const options=sections.filter(section=>section.role_slot_id===roleId).map(section=>({id:section.id,name:`${section.sequence}. ${section.title}`}));sectionSelect.innerHTML=options.length?studioOptionsHtml(options,""):'<option value="">该角色尚无分幕</option>'};roleSelect.onchange=refreshSections;refreshSections();modal.querySelector("[data-host-unlock-submit]").onclick=async()=>{try{const values=studioValues();await zhimuApi.hostUnlockSection({roleSlotId:values.unlockRole,scriptSectionId:values.unlockSection,message:values.unlockMessage});closeModal();await refreshHostRoom();showToast("分幕已解锁")}catch(error){showError(error)}};
}

export function openHostUnlockSceneModal(){
 const scenes=state.cloudStudio?.scenes||[];if(!scenes.length)return showToast("当前世界尚未创建场景");
 modal.className="modal";modal.innerHTML=`<h2>手动开放场景</h2><p class="wizard-intro">开放后所有已入房玩家可在探索页看到该场景。</p><div class="form-group">${studioSelect("场景","unlockScene",scenes.map(scene=>({id:scene.id,name:scene.name})))}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-scene-submit>确认开放</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-host-scene-submit]").onclick=async()=>{try{await zhimuApi.hostUnlockScene(modal.querySelector('[data-studio-field="unlockScene"]').value);closeModal();await refreshHostRoom();showToast("场景已开放")}catch(error){showError(error)}};
}

export function openHostLogModal(){
 modal.className="modal";modal.innerHTML=`<h2>添加主持日志</h2><p class="wizard-intro">记录会写入本房间的时间线，可在世界运行日志中查看。</p><div class="form-group">${studioSelect("关联角色","logRole",[{id:"",name:"不指定角色"},...(state.cloudHostPlayers||[]).filter(player=>player.joined).map(player=>({id:player.role_slot_id,name:`${player.player_display_name||"玩家"} · ${player.role_name}`}))])}${studioField("日志内容","logMessage","textarea","例如：提醒林夏继续阅读序章")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-log-submit>写入日志</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-host-log-submit]").onclick=async()=>{try{const values=studioValues(),payload={message:values.logMessage,eventType:"host_note"};if(values.logRole)payload.roleSlotId=values.logRole;await zhimuApi.hostAddLog(payload);closeModal();await refreshHostRoom();showToast("主持日志已写入")}catch(error){showError(error)}};
}

export async function dismissHostEvent(eventId){
 const event=(state.cloudHostEvents||[]).find((item)=>item.id===eventId);
 try{
  await zhimuApi.dismissHostEvent(eventId);
  state.hostEventSelection=(state.hostEventSelection||[]).filter((id)=>id!==eventId);
  await refreshHostRoom(true);
  render();
  showToast(`已拒绝「${event?.title||"待确认事件"}」`);
 }catch(error){showError(error)}
}

export async function executeHostEvent(eventId){
 const event=(state.cloudHostEvents||[]).find((item)=>item.id===eventId);
 try{
  await zhimuApi.executeHostEvent(eventId);
  state.hostEventSelection=(state.hostEventSelection||[]).filter((id)=>id!==eventId);
  await refreshHostRoom(true);
  render();
  const preview=event?.action_summaries?.slice(0,2).join("；")||"规则动作已写入房间";
  showToast(`已确认「${event?.title||"事件"}」· ${preview}`);
 }catch(error){showError(error)}
}

export function openHostNudgeWaitingModal(){
 const waitingIds=pendingEventRoleIds();
 const players=(state.cloudHostPlayers||[]).filter((player)=>player.joined&&(!waitingIds.size||waitingIds.has(String(player.role_slot_id))));
 if(!players.length)return showToast("当前没有已入房且可能在等待的玩家");
 modal.className="modal";modal.innerHTML=`<h2>提醒等待中的玩家</h2><p class="wizard-intro">消息会通过实时推送送达 play 端与玩家视角，不会发送站外私信。</p><div class="form-group"><label>提醒内容</label><textarea class="field" rows="3" data-nudge-message>主持人正在处理待确认事件，请稍候 — 确认后新内容会自动解锁。</textarea><label>通知对象（默认已选可能在等待的玩家）</label><div class="member-picker">${players.map((player)=>`<label><input type="checkbox" data-nudge-role value="${player.role_slot_id}" checked> <span><b>${escapeHtml(player.player_display_name||"玩家")}</b> · ${escapeHtml(player.role_name)}</span></label>`).join("")}</div></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-nudge-submit>发送提醒</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-nudge-submit]").onclick=async()=>{try{const message=modal.querySelector("[data-nudge-message]").value;const roleSlotIds=[...modal.querySelectorAll("[data-nudge-role]:checked")].map((el)=>el.value);if(!roleSlotIds.length)return showToast("请至少选择一名玩家");const result=await zhimuApi.hostNudgeWaiting({message,roleSlotIds});closeModal();showToast(`已提醒 ${result.notifiedCount} 名玩家`)}catch(error){showError(error)}};
}

export function directorRulesPreview(){
 const preview=state.cloudRulesPreview;
 if(!preview)return `<div class="empty-state">点击「刷新预览」查看当前房间中启用规则的条件评估结果。</div>`;
 if(!preview.length)return `<div class="empty-state">当前平行房没有启用的运行规则。</div>`;
 const statusLabel=window.zhimuUserMessages?.rulePreviewStatusLabel||((s)=>s);
 return `<div class="host-detail-list">${preview.map((row)=>`<div class="checkpoint-row"><strong>${escapeHtml(row.name)}</strong><p>${escapeHtml(statusLabel(row.status))}${row.conditionsMet===false?" · 条件未满足":""}</p>${row.status==="manual_ready"?`<button class="text-btn" data-action="rule-manual-trigger" data-rule="${row.id}">立即触发</button>`:""}</div>`).join("")}</div>`;
}

export async function refreshRulesPreview(){
 if(!activeRuntimeRoom())return showToast("请先选择运行房");
 try{
  const result=await zhimuApi.previewRoomRules();
  state.cloudRulesPreview=result.rules||[];
  render();
  showToast("规则预览已更新");
 }catch(error){showError(error)}
}

export async function triggerManualRuleFromDirector(ruleId){
 if(!activeRuntimeRoom())return showToast("请先选择运行房");
 try{
  await zhimuApi.triggerManualRule(ruleId);
  await refreshRulesPreview();
  await refreshHostRoom();
  showToast("手动规则已执行");
 }catch(error){showError(error)}
}

export function openHostMiniGameModal(){
 if(!activeRuntimeRoom())return showToast("请先选择运行房");
 modal.className="modal";
 modal.innerHTML=`<h2>启动数字锁小游戏</h2><p class="wizard-intro">玩家端会实时看到机关卡片；答对后自动广播完成事件。</p><div class="form-group"><label>标题</label><input class="field" data-mini-title value="数字密码锁"><label>提示语</label><textarea class="field" rows="2" data-mini-prompt>输入线索中得到的密码。</textarea><label>答案</label><input class="field" data-mini-answer inputmode="numeric" placeholder="例如：2468"><label>尝试次数</label><input class="field" data-mini-attempts type="number" min="1" max="12" value="3"></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-mini-start>启动机关</button></div>`;
 modalBackdrop.classList.add("show");
 modal.querySelector("[data-close]").onclick=closeModal;
 modal.querySelector("[data-mini-start]").onclick=async()=>{
  const title=modal.querySelector("[data-mini-title]")?.value?.trim()||"数字密码锁";
  const prompt=modal.querySelector("[data-mini-prompt]")?.value?.trim()||"输入线索中得到的密码。";
  const answer=modal.querySelector("[data-mini-answer]")?.value?.trim()||"";
  const maxAttempts=Math.max(1,Math.min(12,Number(modal.querySelector("[data-mini-attempts]")?.value)||3));
  if(!answer)return showToast("请填写数字锁答案");
  try{
   await zhimuApi.hostStartMiniGame({gameType:"zhimu_lock",title,prompt,answer,length:answer.length,maxAttempts});
   closeModal();
   await refreshHostRoom(true);
   showToast("小游戏已启动，玩家端会实时显示");
  }catch(error){showError(error)}
 };
}

// Bridge: window.zhimuViews.director populated from real exports.
// Will be removed in Phase 4 when consumers migrate to direct imports.
window.zhimuViews = window.zhimuViews || {};
window.zhimuViews.director = { director, hostPlayerTableRows, directorPlayers, hostEventRows, hostActionSummary, directorRulesPreview, refreshRulesPreview, triggerManualRuleFromDirector, hostEventBatchToolbar, toggleHostEventSelection, syncHostEventSelectAll, batchHostEventsAction, hostClueMatrixLabel, hostClueMatrixCard, hostAuditCard, openHostPlayerDetail, kickHostPlayer, openHostClueNote, openHostEventContext, openHostGrantClueModal, openDelayHostEventModal, openHostGrantItemModal, openHostUnlockSectionModal, openHostUnlockSceneModal, openHostMiniGameModal, openHostLogModal, dismissHostEvent, executeHostEvent, openHostNudgeWaitingModal, hostPlayerWaitStrip, hostLiveFeed };
