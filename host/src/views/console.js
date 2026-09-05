import "../styles/host-archive-workspace.css";
import "../styles/host-event-workspace.css";
import "../styles/host-operation-workspace.css";
import "../styles/host-rule-workspace.css";
import "../styles/host-vote-workspace.css";
import "../styles/host-mechanism-workspace.css";
import "../styles/host-mechanism-prospects.css";
import { state } from "../state.js";
import { collapsibleCard } from "../components/collapse.js";
import { activeRuntimeRoom, cloudStatus, runtimeEmpty, activity } from "../components/ui.js";
import {
  escapeHtml,
  formatRelativeTime,
  hostAuditActionLabel,
  hostAuditDetail,
  hostOperationLabel,
  hostPlayerColor,
  logActivityType
} from "../utils/format.js";
import { bindHostPaceTimerContext, hostPaceTimerCard } from "../runtime/host-pace-timer.js";
import {
  bindHostEventQueueContext,
  hostEventBatchToolbar,
  hostEventRows,
  hostPlayerWaitStrip,
  pendingEventRoleIds
} from "../runtime/host-event-queue.js";
import {
  bindHostRulesContext,
  directorRulesPreview,
  hostRuleManagerHeaderActions,
  hostRulesManager
} from "../runtime/host-rules-controller.js";
import { grantModeLabel } from "../runtime/host-operation-model.js";
import { bindHostMiniGameContext, hostMiniGameCard } from "../runtime/host-mini-game-controller.js";
import { renderHostCommandCenter } from "./host-layout.js";
import { renderHostArchiveWorkspace } from "./host-archive-workspace.js";
import { renderHostEventWorkspace } from "./host-event-workspace.js";
import { renderHostOperationWorkspace } from "./host-operation-workspace.js";
import { renderHostRuleWorkspace } from "./host-rule-workspace.js";
import { renderHostVoteWorkspace } from "./host-vote-workspace.js";
import { renderHostMechanismWorkspace } from "./host-mechanism-workspace.js";
import { renderHostPlayableWorkspace } from "./host-playable-workspace.js";
import { normalizeRuntimeCurrentState } from "../../../shared/runtime-current-state.js";
import { roomContentBindingPresentation } from "../../../shared/room-content-binding.js";
import "../styles/host-playable-workspace.css";

export function bindConsoleContext({ render, showToast }) {
  bindHostPaceTimerContext({ render, showToast });
  bindHostEventQueueContext({ render, showToast });
  bindHostRulesContext({ render, showToast });
  bindHostMiniGameContext({ render, showToast });
}

export function renderConsole(){
 const room=activeRuntimeRoom(),world=state.studio?.world;
 if(!room)return runtimeEmpty("主持监控台","请先在下方选择平行运行房，或通过 ?room= 链接直接进入。");
 const players=state.cloudHostPlayers||[],rules=(state.rules||[]).filter(rule=>rule.enabled&&(!rule.room_id||rule.room_id===room.id)),events=state.cloudHostEvents||[];
 const pendingEvents=events.filter(e=>e.status!=="delayed");
 const joinedCount=players.filter(player=>player.joined).length,stuckCount=state.cloudHostStuckCount||0;
 const hostPlayersError=state.cloudHostPlayersError||"";
 const hostPlayersErrorBanner=hostPlayersError?`<section class="demo-strip" style="margin-bottom:14px;border-color:rgba(167,120,61,0.45);background:var(--brass-soft)"><div><span class="cloud-pill">玩家进度</span><strong style="margin-top:7px">未能加载玩家运行状态</strong><p>${escapeHtml(hostPlayersError)}</p></div><button class="secondary-btn" type="button" data-action="refresh-host-players">重试</button></section>`:"";
 const inviteCode=room.invite_code||"";
 const runtimeState=normalizeRuntimeCurrentState(state.currentState,{audience:"host",connected:state.roomEventsConnected});
 const runtimeBinding=roomContentBindingPresentation(runtimeState.contentBinding||room.contentBinding);
 const currentBeat=runtimeState.currentBeat;
 const currentBeatDetail=currentBeat?.host?.dmTasks||currentBeat?.host?.goal||currentBeat?.player?.content||runtimeState.phase.detail;
 const currentBeatGoal=currentBeat?.host?.goal||"";
 const currentBeatAdvance=currentBeat?.host?.advanceCondition||"";
 const currentBeatMinutes=currentBeat?.host?.estimatedMinutes;
 const runtimeStatePanel=`<section class="demo-strip host-runtime-state" style="margin-bottom:14px">
  <div>
   <span class="cloud-pill">${escapeHtml(runtimeState.syncState.status==="synced"?"三端已同步":"正在恢复同步")}</span>
   <strong style="margin-top:7px">${escapeHtml(currentBeat?`第 ${currentBeat.position}/${currentBeat.total} 段 · ${currentBeat.title}`:runtimeState.phase.label)}</strong>
   <p>${escapeHtml(currentBeatDetail)}</p>
   ${currentBeatGoal&&currentBeatGoal!==currentBeatDetail?`<p><b>本幕目标：</b>${escapeHtml(currentBeatGoal)}</p>`:""}
   ${currentBeatAdvance?`<p><b>推进条件：</b>${escapeHtml(currentBeatAdvance)}</p>`:""}
   <p class="muted-note">${escapeHtml(runtimeState.phase.label)} · 游标 ${runtimeState.syncState.serverCursor} · ${escapeHtml(runtimeBinding.label)}</p>
  </div>
  <div class="row">${currentBeatMinutes!=null?`<span class="status-chip draft">预计 ${Number(currentBeatMinutes)} 分钟</span>`:""}${runtimeState.suggestedActions.slice(0,2).map(item=>`<span class="status-chip testing">${escapeHtml(item.label)}</span>`).join("")}</div>
 </section>`;
 const noPlayerProgressHint=players.length&&!joinedCount?`<section class="demo-strip" style="margin-bottom:14px"><div><span class="cloud-pill">等待玩家入房</span><strong style="margin-top:7px">尚无阅读进度</strong><p>${inviteCode?`邀请码 <code class="invite-code-inline">${escapeHtml(inviteCode)}</code> · 复制后发给玩家，或让他们打开 play.getzhimu.com 输入码。`:"分享运行房邀请码"}读完一幕后本页玩家表会自动更新。</p>${inviteCode?`<div class="row" style="margin-top:8px"><button class="secondary-btn" data-action="copy-invite-code" data-invite-code="${escapeHtml(inviteCode)}">复制邀请码</button><button class="secondary-btn" data-action="copy-play-link" data-invite-code="${escapeHtml(inviteCode)}">复制玩家链接</button><button class="secondary-btn" data-action="room-invite-current">邀请详情</button></div>`:""}</div><button class="secondary-btn" data-action="onboarding-go-player">进入玩家视角</button></section>`:"";
 const hostRisks=[];
 if(hostPlayersError){hostRisks.push({level:"error",title:"玩家运行状态加载失败",detail:hostPlayersError,action:"refresh-host-players",button:"重试"});}
 if(!state.roomEventsConnected){hostRisks.push({level:"warning",title:"实时推送未连接",detail:"当前依赖定时轮询，待确认事件与玩家进度可能有延迟。",action:"refresh-host-room",button:"刷新连接"});}
 if(pendingEvents.length>5){hostRisks.push({level:"warning",title:"待确认事件积压",detail:`${pendingEvents.length} 条事件等待处理，可能影响玩家体验。`,action:"refresh-host-events",button:"查看待办"});}
 if(stuckCount>0){hostRisks.push({level:"warning",title:`${stuckCount} 名玩家疑似卡关`,detail:"已识别具体停滞原因，可逐人查看并发送针对性提醒。",action:"host-stuck-intervene",button:"处理卡点"});}
 if(!rules.length){hostRisks.push({level:"warning",title:"当前房间无启用规则",detail:"自动化规则尚未配置，全部依赖手动操作。",action:"rules-preview",button:"查看规则"});}
 const hostRiskErrorCount=hostRisks.filter(r=>r.level==="error").length;
 const hostRiskWarningCount=hostRisks.filter(r=>r.level==="warning").length;
 const hostHasRisks=hostRisks.length>0;
 const hostPriorityActions=[
  pendingEvents.length?{title:"先处理待确认事件",detail:`${pendingEvents.length} 条规则或调查触发正在等待确认。`,action:"refresh-host-events",button:"查看待办"}:null,
  stuckCount?{title:"处理疑似卡关玩家",detail:`${stuckCount} 个席位需要干预，已按卡点原因生成建议。`,action:"host-stuck-intervene",button:"处理卡点"}:null,
  inviteCode&&!joinedCount?{title:"邀请玩家入房",detail:`邀请码 ${inviteCode}，复制后发给玩家开始阅读。`,action:"room-invite-current",button:"邀请详情"}:null,
  {title:"创建现场存档点",detail:"关键推进后保存房间状态，方便复盘和回滚分析。",action:"create-checkpoint",button:"创建存档"}
 ].filter(Boolean).slice(0,4).map((item,index)=>({...item,index:String(index+1).padStart(2,"0")}));
 const hostRiskPanel=`<section class="risk-console">
  <div class="section-head">
   <div><p class="section-kicker">RISKS &amp; ALERTS</p><h3>风险与问题</h3><p>开场前 30 秒检查：连接状态、玩家加载、事件积压、卡关和规则配置。阻塞项必须先处理。</p></div>
   <div class="risk-summary">
    ${hostRiskErrorCount?`<span class="risk-count risk-error">${hostRiskErrorCount} 阻塞</span>`:""}
    ${hostRiskWarningCount?`<span class="risk-count risk-warning">${hostRiskWarningCount} 警告</span>`:""}
    ${!hostHasRisks?`<span class="risk-count risk-ok">✓ 无风险</span>`:""}
   </div>
  </div>
  <div class="risk-list">${hostHasRisks?hostRisks.map(item=>{const cls=item.level==="error"?"risk-error":"risk-warning";const icon=item.level==="error"?"✕":"!";return `<div class="risk-item ${cls}"><span class="risk-icon">${icon}</span><div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.detail)}</p></div>${item.action?`<button type="button" data-action="${escapeHtml(item.action)}">${escapeHtml(item.button||"处理")} →</button>`:""}</div>`}).join(""):`<div class="empty-state">房间运行正常，无阻塞或警告项。</div>`}</div>
  ${hostPriorityActions.length?`<div class="host-priority-list">${hostPriorityActions.map(action=>`<div class="host-priority-action"><span>${escapeHtml(action.index)}</span><div><b>${escapeHtml(action.title)}</b><p>${escapeHtml(action.detail)}</p></div><button type="button" data-action="${escapeHtml(action.action)}">${escapeHtml(action.button)}</button></div>`).join("")}</div>`:""}
 </section>`;
 return `<section class="host-console">
  <div class="host-console-status">${cloudStatus()}</div>
  ${runtimeStatePanel}
  ${renderHostCommandCenter({ room, world, playersTableRows: hostPlayerTableRows, currentBeatKey: currentBeat?.key, presentation: runtimeState.presentation })}
  ${renderHostMechanismWorkspace()}
  ${renderHostPlayableWorkspace()}
  ${renderHostEventWorkspace()}
  ${renderHostVoteWorkspace()}
  ${renderHostOperationWorkspace()}
  ${renderHostArchiveWorkspace()}
  ${renderHostRuleWorkspace()}
  ${hostRiskPanel}
  ${noPlayerProgressHint}
  ${hostPlayersErrorBanner}
  ${hostCohostPanel(room)}
  ${hostSessionToolbar(inviteCode)}
  ${hostSupportPanels(events)}
 </section>`;
}

function hostCohostPanel(room) {
  const cohosts = state.cloudHostCohosts || [];
  const canManage = Boolean(state.cloudHostCohostCanManage)
    || String(state.user?.id || "") === String(room?.host_user_id || "");
  const rows = cohosts.length
    ? cohosts.map((item) => `<div class="checkpoint-row" style="display:flex;justify-content:space-between;gap:12px;align-items:center">
        <div><strong>${escapeHtml(item.displayName || "协主持")}</strong>
          <p class="muted-note">${escapeHtml(item.email || item.userId || "")}</p></div>
        ${canManage ? `<button type="button" class="secondary-btn" data-action="host-remove-cohost" data-user-id="${escapeHtml(item.userId)}">移除</button>` : ""}
      </div>`).join("")
    : `<div class="empty-state">尚未任命协主持。主主持可填写已注册用户的邮箱或用户 ID 进行任命。</div>`;
  const manageBlock = canManage
    ? `<div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">
        <input class="field" type="text" data-cohost-target placeholder="邮箱或用户 ID" style="min-width:220px;flex:1">
        <button type="button" class="primary-btn" data-action="host-appoint-cohost">任命协主持</button>
      </div>`
    : `<p class="muted-note" style="margin-top:8px">仅主主持可任命或移除协主持；协主持可共同操作监控台。</p>`;
  const caseNotes = state?.studio?.world?.settings?.caseHostNotes
    || state?.studio?.experienceConfiguration?.caseHostNotes
    || null;
  const dualHostTip = caseNotes?.dualHost
    ? `<p class="muted-note" style="margin-top:8px"><strong>本局分工：</strong>${escapeHtml(String(caseNotes.dualHost))}</p>`
    : "";
  const openingTip = caseNotes?.opening
    ? `<p class="muted-note"><strong>开场：</strong>${escapeHtml(String(caseNotes.opening))}</p>`
    : "";
  return `<section class="card host-cohost-panel" data-host-cohost-panel style="margin-bottom:14px">
    <div class="section-head compact"><div><p class="section-kicker">DUAL HOST</p><h3>双主持</h3>
      <p>主主持可任命协主持共同操作本房；主主持身份仍唯一，不可转让。</p></div></div>
    ${dualHostTip}${openingTip}
    ${rows}
    ${manageBlock}
  </section>`;
}

function hostSessionToolbar(inviteCode) {
  return `<section class="host-session-toolbar card">
    <div class="section-head compact"><div><p class="section-kicker">SESSION</p><h3>房间操作</h3></div></div>
    <div class="row host-session-actions">
      ${inviteCode ? `<button type="button" class="secondary-btn" data-action="room-invite-current">邀请玩家</button><button type="button" class="secondary-btn" data-action="copy-invite-code" data-invite-code="${escapeHtml(inviteCode)}">复制邀请码</button><button type="button" class="secondary-btn" data-action="copy-play-link" data-invite-code="${escapeHtml(inviteCode)}">复制玩家链接</button>` : ""}
      <button type="button" class="secondary-btn" data-action="refresh-host-room">刷新状态</button>
      <button type="button" class="secondary-btn" data-action="create-recap">生成复盘</button>
      <button type="button" class="secondary-btn" data-action="host-manual-log">主持日志</button>
      <button type="button" class="primary-btn" data-action="create-checkpoint">创建存档点</button>
      <button type="button" class="secondary-btn" data-action="host-create-vote">开启投票</button>
      <button type="button" class="secondary-btn" data-action="host-manual-unlock-scene">开放本幕场景</button>
      <button type="button" class="secondary-btn" data-action="host-nudge-waiting">提醒卡关玩家</button>
      <button type="button" class="secondary-btn" data-action="onboarding-go-player">进入玩家视角</button>
    </div>
  </section>`;
}

function hostSupportPanels(events) {
  return `<section class="host-support-grid">
    ${hostPlayerWaitStrip()}
    ${hostMiniGameCard()}
    ${collapsibleCard({ id: "director:host-events", title: "待确认事件（批量）", subtitle: "完整列表与批量确认/延后", headerExtra: hostEventBatchToolbar(), body: hostEventRows(), defaultOpen: Boolean(events.filter((e) => e.status !== "delayed").length), className: "card host-events-card" })}
    ${collapsibleCard({ id: "director:rules-preview", title: "规则运行与管理", subtitle: "当前房间的条件评估与自动化规则", headerExtra: hostRuleManagerHeaderActions(), body: `${directorRulesPreview()}${hostRulesManager()}`, defaultOpen: false })}
    <div class="host-support-dual">
      ${hostLiveFeed()}
      ${hostAuditCard()}
    </div>
    ${hostPaceTimerCard()}
    ${hostPublicEnvironmentCard()}
    ${hostClueMatrixCard()}
    ${hostRunReportCard()}
  </section>`;
}

function hostRunReportCard() {
  const report = state.cloudRunReport;
  const body = report
    ? `<div class="host-run-report">
        <p class="muted-note">分幕 ${(report.reading || []).length} 条 · 线索 ${(report.clues || []).length} 条 · 建议 ${(report.suggestions || []).length} 条</p>
        ${(report.suggestions || [])
          .slice(0, 5)
          .map((s) => `<div class="checkpoint-row"><strong>${escapeHtml(s.title)}</strong><p>${escapeHtml(s.detail || "")}</p></div>`)
          .join("")}
      </div>`
    : `<div class="empty-state">点击「生成本场报告」汇总阅读、线索与投票数据，用于复盘与改本。</div>`;
  return collapsibleCard({
    id: "director:run-report",
    title: "本场运行报告",
    subtitle: "单房 playtest 数据与改进建议",
    headerExtra: `<button class="secondary-btn" data-action="host-load-run-report">${report ? "刷新报告" : "生成报告"}</button>`,
    body,
    defaultOpen: false,
    style: "margin-top:14px"
  });
}

function studioClueGrantHint(clueId) {
  const clue = (state.studio?.clues || []).find((item) => item.id === clueId);
  const mode = clue?.metadata?.grantMode;
  if (!mode || mode === "auto") return "";
  return grantModeLabel(mode);
}

function hostPublicEnvironmentCard() {
  const chapters = (state.studio?.chapters || []).slice().sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const rows = chapters
    .map((chapter) => {
      const env = String(chapter.metadata?.publicEnvironment || "").trim();
      if (!env) return "";
      const actKey = chapter.metadata?.matrixActKey;
      return `<article class="host-env-row"><div class="row" style="align-items:center;gap:8px;margin-bottom:6px"><h4 style="margin:0">${escapeHtml(chapter.title)}</h4>${actKey ? `<span class="cloud-pill">${escapeHtml(actKey)}</span>` : ""}</div><p class="wizard-intro">${escapeHtml(env)}</p></article>`;
    })
    .filter(Boolean)
    .join("");
  const matrixSync = state.studio?.world?.settings?.matrixSync;
  const triggers = (matrixSync?.mechanicalTriggers || [])
    .map(
      (trigger) =>
        `<li><b>${escapeHtml(trigger.actKey || "—")}</b> · ${escapeHtml(trigger.if || "—")} → ${escapeHtml(trigger.then || "—")}${trigger.hostNote ? ` <span class="muted-note">（${escapeHtml(trigger.hostNote)}）</span>` : ""}</li>`
    )
    .join("");
  const triggerBlock = triggers
    ? `<div class="host-mechanical-triggers" style="margin-top:12px"><p class="section-kicker">L4 变格触发（设计参考）</p><ul class="wizard-intro">${triggers}</ul></div>`
    : "";
  const body =
    rows || triggerBlock
      ? `${rows || `<div class="empty-state">章节尚未填写 publicEnvironment，可在编排台章节节点编辑。</div>`}${triggerBlock}`
      : `<div class="empty-state">当前世界章节未配置公共环境文案。Matrix 导入或编排台「编辑公共章节 → 公共环境（L2）」可补充。</div>`;
  return collapsibleCard({
    id: "director:public-env",
    title: "公共环境与分幕",
    subtitle: "与 Matrix L2 publicEnvironment 一致 · 可向玩家口头播报",
    body,
    defaultOpen: true,
    className: "card host-public-env-card",
    style: "margin-top:14px"
  });
}

export function hostPlayerTableRows(players){
 if(!players.length)return `<tr><td colspan="7"><div class="empty-state enriched-empty"><p><strong>当前运行房尚无角色席位</strong></p><p>请先在「剧本杀创作」或创建向导中配置角色，再建立平行房。</p><div class="row"><button class="text-btn" data-action="open-creator">前往创作者端</button><button class="text-btn" data-action="go-pick-room">选择平行房</button></div></div></td></tr>`;
 const waitingIds=pendingEventRoleIds();
 return players.map((player,index)=>{const waiting=waitingIds.has(String(player.role_slot_id));return `<tr class="${player.maybe_stuck?"host-row-warn":""}${waiting?" host-row-waiting":""}"><td><div class="host-player-cell"><div class="avatar small" style="background:${hostPlayerColor(index)}">${(player.player_display_name||player.role_name||"?")[0]}</div><div><strong>${escapeHtml(player.player_display_name||"席位空置")}</strong><p>${escapeHtml(player.role_name)}${waiting?` · <span class="host-wait-tag">待你确认</span>`:""}</p></div></div></td><td>${player.joined?`<span class="status-chip published">已加入</span><small>${player.last_activity_at?formatRelativeTime(player.last_activity_at):"刚刚"}</small>`:`<span class="status-chip draft">未加入</span>`}</td><td><strong>${player.completed_sections}/${player.total_sections}</strong><small>${escapeHtml(player.last_completed_section_title||"尚无完成分幕")}</small></td><td><strong>${player.clue_count}</strong><small>已读 ${player.read_clue_count}</small></td><td><strong>${escapeHtml(hostOperationLabel(player.last_operation_type,player.last_operation_message))}</strong><small>${player.last_activity_at?formatRelativeTime(player.last_activity_at):"—"}</small></td><td><span class="status-chip ${player.maybe_stuck?"testing":"published"}">${escapeHtml(player.stuck_label)}</span><small>${escapeHtml(player.stuck_detail||"")}</small></td><td>${player.maybe_stuck?`<button class="text-btn" data-action="host-stuck-intervene" data-role="${player.role_slot_id}">处理</button> `:""}<button class="text-btn" data-action="host-player-detail" data-role="${player.role_slot_id}">详情</button>${player.joined?` <button class="text-btn host-kick-btn" data-action="host-kick-player" data-role="${player.role_slot_id}" title="内测：移出房间；同账号重进可继承进度">踢出</button>`:""}</td></tr>`}).join("");
}

function hostLiveFeed(){
 const logs=(state.cloudWorldLogs||[]).slice(0,6);
 const body=logs.length
  ?logs.map((log)=>activity(`${escapeHtml(hostOperationLabel(log.event_type,log.message))}${log.message?` · ${escapeHtml(log.message)}`:""}`,formatRelativeTime(log.created_at),logActivityType(log.event_type))).join("")
  :`<div class="empty-state">尚无玩家动态；玩家阅读、调查或主持操作后会自动显示。</div>`;
 return collapsibleCard({ id: "director:live-feed", title: "玩家实时动态", subtitle: "最近房间时间线 — 与玩家阅读、调查操作同步", headerExtra: `<button class="secondary-btn" data-action="refresh-host-room">刷新</button>`, body: `<div class="host-audit-list">${body}</div>`, defaultOpen: true, style: "margin-top:14px" });
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
  const grantHint=studioClueGrantHint(clue.id);
  const cells=players.map(player=>{const cell=matrix.cells?.[clue.id]?.[player.role_slot_id]||{};const owned=cell.owned;return `<td>${owned?`<button type="button" class="clue-matrix-cell-btn ${cell.sharedWithRoom?"public":""}" data-action="host-clue-note" data-clue="${clue.id}" data-role="${player.role_slot_id}" title="点击编辑主持备注">${hostClueMatrixLabel(cell)}</button>`:`<span class="clue-matrix-cell">${hostClueMatrixLabel(cell)}</span>`}</td>`}).join("");
  return `<tr><th class="clue-matrix-clue">${escapeHtml(clue.name)}${grantHint?` <span class="cloud-pill">${escapeHtml(grantHint)}</span>`:""}</th>${cells}</tr>`;
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
 return collapsibleCard({ id: "director:audit", title: "主持审计", subtitle: "记录主持侧敏感操作，便于复盘与协作追踪", headerExtra: `<button class="secondary-btn" data-action="refresh-host-audit">刷新审计</button>`, body: `<div class="host-audit-list">${body}</div>`, defaultOpen: false, className: "card host-audit-card", style: "margin-top:14px" });
}
