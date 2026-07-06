import { api } from "../api.js";
import { state } from "../state.js";
import { collapsibleCard } from "../components/collapse.js";
import { activeRuntimeRoom, cloudStatus, runtimeEmpty, stat, activity } from "../components/ui.js";
import {
  closeModal,
  modalEl,
  mountModal,
  openModal,
  studioField,
  studioSelect,
  studioOptionsHtml,
  studioValues
} from "../components/modal.js";
import {
  escapeHtml,
  formatRelativeTime,
  formatTime,
  hostAuditActionLabel,
  hostAuditDetail,
  hostOperationLabel,
  hostPlayerColor,
  logActivityType,
  rulePreviewStatusLabel
} from "../utils/format.js";
import {
  refreshHostClueMatrix,
  refreshHostPlayers,
  refreshHostRoom
} from "../runtime/data.js";

let renderRef = () => {};
let showToastRef = (_msg) => {};

export function bindConsoleContext({ render, showToast }) {
  renderRef = render;
  showToastRef = showToast;
}

function render() { renderRef(); }
function showToast(msg) { showToastRef(msg); }

export function renderConsole(){
 const room=activeRuntimeRoom(),world=state.studio?.world;
 if(!room)return runtimeEmpty("主持监控台","请先在下方选择平行运行房，或通过 ?room= 链接直接进入。");
 const players=state.cloudHostPlayers||[],rules=(state.rules||[]).filter(rule=>rule.enabled&&(!rule.room_id||rule.room_id===room.id)),events=state.cloudHostEvents||[];
 const pendingEvents=events.filter(e=>e.status!=="delayed");
 const joinedCount=players.filter(player=>player.joined).length,stuckCount=state.cloudHostStuckCount||0;
 const hostPlayersError=state.cloudHostPlayersError||"";
 const hostPlayersErrorBanner=hostPlayersError?`<section class="demo-strip" style="margin-bottom:14px;border-color:rgba(167,120,61,0.45);background:var(--brass-soft)"><div><span class="cloud-pill">玩家进度</span><strong style="margin-top:7px">未能加载玩家运行状态</strong><p>${escapeHtml(hostPlayersError)}</p></div><button class="secondary-btn" type="button" data-action="refresh-host-players">重试</button></section>`:"";
 const inviteCode=room.invite_code||"";
 const noPlayerProgressHint=players.length&&!joinedCount?`<section class="demo-strip" style="margin-bottom:14px"><div><span class="cloud-pill">等待玩家入房</span><strong style="margin-top:7px">尚无阅读进度</strong><p>${inviteCode?`邀请码 <code class="invite-code-inline">${escapeHtml(inviteCode)}</code> · 复制后发给玩家，或让他们打开 play.getzhimu.com 输入码。`:"分享运行房邀请码"}读完一幕后本页玩家表会自动更新。</p>${inviteCode?`<div class="row" style="margin-top:8px"><button class="secondary-btn" data-action="copy-invite-code" data-invite-code="${escapeHtml(inviteCode)}">复制邀请码</button><button class="secondary-btn" data-action="copy-play-link" data-invite-code="${escapeHtml(inviteCode)}">复制玩家链接</button><button class="secondary-btn" data-action="room-invite-current">邀请详情</button></div>`:""}</div><button class="secondary-btn" data-action="onboarding-go-player">进入玩家视角</button></section>`:"";
 const hostRisks=[];
 if(hostPlayersError){hostRisks.push({level:"error",title:"玩家运行状态加载失败",detail:hostPlayersError,action:"refresh-host-players",button:"重试"});}
 if(!state.roomEventsConnected){hostRisks.push({level:"warning",title:"实时推送未连接",detail:"当前依赖定时轮询，待确认事件与玩家进度可能有延迟。",action:"refresh-host-room",button:"刷新连接"});}
 if(pendingEvents.length>5){hostRisks.push({level:"warning",title:"待确认事件积压",detail:`${pendingEvents.length} 条事件等待处理，可能影响玩家体验。`,action:"refresh-host-events",button:"查看待办"});}
 if(stuckCount>0){hostRisks.push({level:"warning",title:`${stuckCount} 名玩家疑似卡关`,detail:"玩家长时间未推进剧情，建议主动干预或发放线索。",action:"host-nudge-waiting",button:"提醒玩家"});}
 if(!rules.length){hostRisks.push({level:"warning",title:"当前房间无启用规则",detail:"自动化规则尚未配置，全部依赖手动操作。",action:"rules-preview",button:"查看规则"});}
 const hostRiskErrorCount=hostRisks.filter(r=>r.level==="error").length;
 const hostRiskWarningCount=hostRisks.filter(r=>r.level==="warning").length;
 const hostHasRisks=hostRisks.length>0;
 const roomReady=!hostPlayersError&&state.roomEventsConnected&&joinedCount>0;
 const roomReadyLabel=roomReady?"运行就绪":!joinedCount?"等待玩家入房":!state.roomEventsConnected?"连接中":"初始化中";
 const roomReadyTone=roomReady?"published":!joinedCount?"draft":"testing";
 const hostPriorityActions=[
  pendingEvents.length?{title:"先处理待确认事件",detail:`${pendingEvents.length} 条规则或调查触发正在等待确认。`,action:"refresh-host-events",button:"查看待办"}:null,
  stuckCount?{title:"查看疑似卡关玩家",detail:`${stuckCount} 个席位长时间没有推进，建议查看详情或手动发线索。`,action:"host-nudge-waiting",button:"提醒玩家"}:null,
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
  <section class="director-head">
    <div class="director-room-copy"><span class="live-label"><i></i>LIVE</span><div><p class="eyebrow">${escapeHtml(world?.name||"当前世界")}</p><h1>${escapeHtml(room.name)}</h1><div class="director-room-meta">${inviteCode?`<span>邀请码 <code class="invite-code-inline">${escapeHtml(inviteCode)}</code></span>`:""}<span>${state.roomEventsConnected?"实时推送已连接":"每 15 秒自动刷新"}</span></div></div></div>
    <div class="director-command-groups">
      <div class="director-command-group"><span>房间</span>${inviteCode?`<button class="secondary-btn" data-action="room-invite-current">邀请玩家</button>`:""}<button class="secondary-btn" data-action="refresh-host-room">刷新状态</button></div>
      <div class="director-command-group"><span>记录</span><button class="secondary-btn" data-action="create-recap">生成复盘</button><button class="secondary-btn" data-action="host-manual-log">主持日志</button><button class="primary-btn" data-action="create-checkpoint">创建存档点</button></div>
    </div>
  </section>
  <section class="stats-grid">${stat("♙",String(joinedCount),"已加入玩家",players.length+" 个角色席位")}${stat("⚑",String(stuckCount),"疑似卡关",stuckCount?"超过阈值未推进":"当前无卡关预警")}${stat("◷",String(pendingEvents.length),"待确认事件",pendingEvents.length?"需要主持人判断":events.length?"均已延迟":"当前无需人工介入")}${stat("⌘",String(rules.length),"运行中规则","当前房与世界模板")}<div class="stat-card stat-ready"><span>房间状态</span><strong><span class="status-chip ${roomReadyTone}">${roomReadyLabel}</span></strong></div></section>
  ${hostRiskPanel}
  ${noPlayerProgressHint}
  ${hostPlayersErrorBanner}
  <div class="host-console-grid">
    <div class="host-console-primary">
      ${hostPlayerWaitStrip()}
      ${collapsibleCard({ id: "director:host-events", title: "待确认事件", subtitle: "规则或调查触发的关键节点，确认后立即写入当前房间状态", headerExtra: hostEventBatchToolbar(), body: hostEventRows(), defaultOpen: true, className: "card host-events-card" })}
      ${collapsibleCard({ id: "director:players", title: "玩家运行状态", subtitle: "查看阅读、线索与最近操作，并进行手动干预", headerExtra: `<div class="row host-manual-actions"><button class="secondary-btn" data-action="host-manual-grant-clue">发线索</button><button class="secondary-btn" data-action="host-manual-grant-item">发物品</button><button class="secondary-btn" data-action="host-manual-unlock-section">解锁分幕</button><button class="secondary-btn" data-action="host-manual-unlock-scene">开放场景</button></div>`, body: `<div class="host-runtime-table-wrap"><table class="host-runtime-table"><thead><tr><th>玩家 / 角色</th><th>入房</th><th>阅读进度</th><th>线索</th><th>最近操作</th><th>状态</th><th></th></tr></thead><tbody>${hostPlayerTableRows(players)}</tbody></table></div>`, defaultOpen: true })}
    </div>
    <aside class="host-console-side">
      ${hostPaceTimerCard()}
      ${hostLiveFeed()}
      ${hostAuditCard()}
      ${collapsibleCard({ id: "director:rules-preview", title: "规则运行与管理", subtitle: "当前房间的条件评估与自动化规则管理", headerExtra: `<button class="secondary-btn" data-action="rules-preview">刷新预览</button><button class="secondary-btn" data-action="host-rule-new">新建</button><button class="secondary-btn" data-action="host-rule-validate">检查</button>`, body: `${directorRulesPreview()}${hostRulesManager()}`, defaultOpen: false })}
    </aside>
  </div>
  ${hostPublicEnvironmentCard()}
  ${hostRunbookCard()}
  ${hostClueMatrixCard()}
  ${hostTestimoniesCard()}
  ${hostVotesCard()}
  ${hostPrivateActionsCard()}
  ${hostRunReportCard()}
  ${hostSegmentRemediesCard()}
 </section>`;
}

function hostTestimoniesCard() {
  const items = state.cloudHostTestimonies || [];
  const body = items.length
    ? items
        .map(
          (row) => `<article class="host-testimony-row">
        <div><strong>${escapeHtml(row.role_name)}</strong> · ${escapeHtml(row.act_key || "—")} · <time>${formatRelativeTime(row.submitted_at)}</time></div>
        <p>${escapeHtml(row.body)}</p>
        ${row.host_flag ? `<span class="status-chip ${row.host_flag === "contradiction" ? "draft" : "published"}">${row.host_flag === "contradiction" ? "矛盾" : "已阅"}</span>` : ""}
        <div class="row">
          <button class="text-btn" type="button" data-action="host-review-testimony" data-testimony="${row.id}" data-flag="noted">标记已阅</button>
          <button class="text-btn danger-text" type="button" data-action="host-review-testimony" data-testimony="${row.id}" data-flag="contradiction">标记矛盾</button>
        </div>
      </article>`
        )
        .join("")
    : `<div class="empty-state">暂无玩家口供。玩家在「任务」Tab 提交后会出现在这里。</div>`;
  return collapsibleCard({
    id: "director:testimonies",
    title: "玩家口供",
    subtitle: "审查陈述并标记矛盾点",
    headerExtra: `<button class="secondary-btn" data-action="refresh-host-room">刷新</button>`,
    body,
    defaultOpen: false,
    style: "margin-top:14px"
  });
}

function hostVotesCard() {
  const votes = state.cloudHostVotes || [];
  const body = votes.length
    ? votes
        .map((vote) => {
          const ballots = vote.ballots || [];
          const tally = ballots.length ? `${ballots.length} 票已投` : "尚无选票";
          return `<article class="host-vote-row">
        <div><strong>${escapeHtml(vote.title)}</strong> · <span class="status-chip ${vote.status === "open" ? "testing" : vote.status === "published" ? "published" : "draft"}">${escapeHtml(vote.status)}</span> · ${escapeHtml(tally)}</div>
        ${vote.prompt ? `<p class="muted-note">${escapeHtml(vote.prompt)}</p>` : ""}
        <div class="row">
          ${vote.status === "open" ? `<button class="text-btn" type="button" data-action="host-vote-status" data-vote-id="${vote.id}" data-status="closed">关闭投票</button>` : ""}
          ${vote.status === "closed" ? `<button class="text-btn" type="button" data-action="host-vote-status" data-vote-id="${vote.id}" data-status="published">公布结果</button>` : ""}
        </div>
      </article>`;
        })
        .join("")
    : `<div class="empty-state">暂无投票。点击下方开启指认/投票。</div>`;
  return collapsibleCard({
    id: "director:votes",
    title: "投票 / 指认",
    subtitle: "开启投票、关闭并公布结果",
    headerExtra: `<button class="secondary-btn" data-action="host-create-vote">开启投票</button>`,
    body,
    defaultOpen: false,
    style: "margin-top:14px"
  });
}

function hostPrivateActionsCard() {
  const items = state.cloudHostPrivateActions || [];
  const body = items.length
    ? items
        .map(
          (row) => `<article class="host-private-action-row">
        <div><strong>${escapeHtml(row.actor_role_name || "玩家")}</strong> · ${escapeHtml(row.action_type || "")} · <time>${formatRelativeTime(row.created_at)}</time></div>
        <p><strong>${escapeHtml(row.title)}</strong></p>
        <p>${escapeHtml(row.body || "")}</p>
        <div class="row">
          <button class="text-btn" type="button" data-action="host-review-private-action" data-action-id="${row.id}" data-status="seen">已阅</button>
          <button class="text-btn" type="button" data-action="host-review-private-action" data-action-id="${row.id}" data-status="accepted">接受</button>
          <button class="text-btn danger-text" type="button" data-action="host-review-private-action" data-action-id="${row.id}" data-status="rejected">拒绝</button>
        </div>
      </article>`
        )
        .join("")
    : `<div class="empty-state">暂无秘密行动。玩家在「博弈」Tab 提交后会出现在这里。</div>`;
  return collapsibleCard({
    id: "director:private-actions",
    title: "秘密行动",
    subtitle: "处理玩家的询问、交易与秘密行动",
    headerExtra: `<button class="secondary-btn" data-action="refresh-host-room">刷新</button>`,
    body,
    defaultOpen: false,
    style: "margin-top:14px"
  });
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

function hostSegmentRemediesCard() {
  const items = state.cloudHostSegmentRemedies || [];
  const body = items.length
    ? items
        .map(
          (row) => `<article class="host-remedy-row">
        <div><strong>${escapeHtml(row.title)}</strong> · ${escapeHtml(row.segment_key)}</div>
        <p>${escapeHtml(row.host_script)}</p>
        ${row.trigger_hint ? `<small>${escapeHtml(row.trigger_hint)}</small>` : ""}
        <button class="secondary-btn" type="button" data-action="host-apply-remedy" data-remedy="${row.id}">执行补救</button>
      </article>`
        )
        .join("")
    : `<div class="empty-state">暂无段落补救模板。在创作者端「世界设置」中配置 segment remedies。</div>`;
  return collapsibleCard({
    id: "director:segment-remedies",
    title: "段落补救包",
    subtitle: "一键播报主持话术并写入时间线",
    headerExtra: `<button class="secondary-btn" data-action="refresh-host-room">刷新</button>`,
    body,
    defaultOpen: false,
    style: "margin-top:14px"
  });
}

function grantModeLabel(mode) {
  return { auto: "自动发放", host_confirm: "主持确认", explore: "探索获得" }[mode] || "";
}

function studioClueGrantHint(clueId) {
  const clue = (state.studio?.clues || []).find((item) => item.id === clueId);
  const mode = clue?.metadata?.grantMode;
  if (!mode || mode === "auto") return "";
  return grantModeLabel(mode);
}

function hostRunbookCard() {
  const matrixSync = state.studio?.world?.settings?.matrixSync;
  const worldSettings = state.studio?.world?.settings || {};
  const runbooks = matrixSync?.hostRunbooks || worldSettings.hostRunbooks || null;
  const chapters = (state.studio?.chapters || []).slice().sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const chapterByActKey = new Map();
  for (const chapter of chapters) {
    const actKey = chapter.metadata?.matrixActKey;
    if (actKey) chapterByActKey.set(actKey, chapter);
  }
  let body;
  if (Array.isArray(runbooks) && runbooks.length) {
    body = runbooks
      .map((book) => {
        const actKey = book.actKey || "";
        const chapter = actKey ? chapterByActKey.get(actKey) : null;
        const title = book.title || chapter?.title || actKey || "未命名分幕";
        const flow = String(book.flow || "").trim();
        const hostTruth = String(book.hostTruth || "").trim();
        const grants = Array.isArray(book.clueGrants) ? book.clueGrants : [];
        const fallbacks = Array.isArray(book.fallbacks) ? book.fallbacks : [];
        const grantList = grants.length
          ? `<ul class="host-runbook-grants">${grants.map((g) => `<li><code>${escapeHtml(g.clueId || "—")}</code><span>${escapeHtml(g.when || "")}</span></li>`).join("")}</ul>`
          : "";
        const fallbackList = fallbacks.length
          ? `<ul class="host-runbook-fallbacks">${fallbacks.map((f) => `<li>${escapeHtml(String(f))}</li>`).join("")}</ul>`
          : "";
        return `<article class="host-runbook-act">
          <div class="row" style="align-items:center;gap:8px;margin-bottom:6px">
            <h4 style="margin:0">${escapeHtml(title)}</h4>
            ${actKey ? `<span class="cloud-pill">${escapeHtml(actKey)}</span>` : ""}
          </div>
          ${flow ? `<div class="host-runbook-block"><p class="section-kicker">流程</p><p class="wizard-intro">${escapeHtml(flow)}</p></div>` : ""}
          ${hostTruth ? `<div class="host-runbook-block host-runbook-truth"><p class="section-kicker">本幕上帝视角</p><p class="wizard-intro">${escapeHtml(hostTruth)}</p></div>` : ""}
          ${grantList ? `<div class="host-runbook-block"><p class="section-kicker">线索发放</p>${grantList}</div>` : ""}
          ${fallbackList ? `<div class="host-runbook-block"><p class="section-kicker">冷场兜底</p>${fallbackList}</div>` : ""}
        </article>`;
      })
      .join("");
  } else {
    body = `<div class="empty-state">当前世界尚未生成主持手册。Matrix 流水线导入或在创作者端「DeepSeek 流水线 → 主持手册层」生成后会自动展示在这里。每幕包含流程、上帝视角、线索发放时机和冷场兜底话术。</div>`;
  }
  return collapsibleCard({
    id: "director:host-runbook",
    title: "主持手册（Runbook）",
    subtitle: "Matrix L5 hostRunbook · 每幕流程、真相、线索发放与兜底话术",
    body,
    defaultOpen: false,
    className: "card host-runbook-card",
    style: "margin-top:14px"
  });
}

function hostPaceTimerCard() {
  const pace = state.paceTimer || { mode: "count-up", running: false, startedAt: null, elapsedMs: 0, targetMs: 0 };
  const modes = [
    { id: "count-up", label: "正计时" },
    { id: "countdown-30", label: "30 分钟", ms: 30 * 60 * 1000 },
    { id: "countdown-45", label: "45 分钟", ms: 45 * 60 * 1000 },
    { id: "countdown-60", label: "60 分钟", ms: 60 * 60 * 1000 }
  ];
  const modeButtons = modes
    .map((m) => {
      const active = pace.mode === m.id ? " is-active" : "";
      return `<button type="button" class="host-pace-mode-btn${active}" data-action="host-pace-switch-mode" data-mode="${m.id}" data-target-ms="${m.ms || 0}">${escapeHtml(m.label)}</button>`;
    })
    .join("");
  const running = Boolean(pace.running);
  const primaryLabel = running ? "暂停" : pace.elapsedMs > 0 || pace.startedAt ? "继续" : "开始";
  const body = `<div class="host-pace-timer" data-host-pace-timer>
    <div class="host-pace-clock-row">
      <div class="host-pace-clock" data-host-pace-clock>${formatPaceClock(pace)}</div>
      <div class="host-pace-clock-meta">
        <span class="status-chip ${running ? "published" : "draft"}">${running ? "运行中" : "已暂停"}</span>
        <span class="muted-note">${pace.mode === "count-up" ? "正计时模式" : "倒计时模式"}</span>
      </div>
    </div>
    <div class="host-pace-modes">${modeButtons}</div>
    <div class="host-pace-actions">
      <button type="button" class="primary-btn" data-action="host-pace-toggle" data-running="${running ? "1" : "0"}">${primaryLabel}</button>
      <button type="button" class="secondary-btn" data-action="host-pace-reset">重置</button>
    </div>
    <p class="muted-note host-pace-hint">用于把控每幕节奏：开场播报、调查、公聊、复盘。计时器状态保存在本地，不会同步给玩家。</p>
  </div>`;
  return collapsibleCard({
    id: "director:pace-timer",
    title: "节奏计时器",
    subtitle: "把控每幕时长 · 仅供主持人本地使用",
    body,
    defaultOpen: false,
    className: "card host-pace-timer-card",
    style: "margin-top:14px"
  });
}

function formatPaceClock(pace) {
  let elapsed = pace.elapsedMs || 0;
  if (pace.running && pace.startedAt) {
    elapsed += Date.now() - pace.startedAt;
  }
  if (pace.mode === "count-up") {
    return formatPaceDuration(elapsed);
  }
  const target = pace.targetMs || 0;
  const remaining = Math.max(0, target - elapsed);
  return formatPaceDuration(remaining);
}

function formatPaceDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const PACE_TIMER_KEY = "zhimuHostPaceTimerState";

function loadPaceState() {
  try {
    const raw = localStorage.getItem(PACE_TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      // 跨页面加载时如果之前在运行，把 startedAt 之前累积到 elapsedMs，避免时间错乱
      if (parsed.running && parsed.startedAt) {
        parsed.elapsedMs = (parsed.elapsedMs || 0) + (Date.now() - parsed.startedAt);
        parsed.startedAt = Date.now();
      }
      return parsed;
    }
  } catch (_) {}
  return null;
}

function savePaceState(pace) {
  try {
    localStorage.setItem(PACE_TIMER_KEY, JSON.stringify(pace));
  } catch (_) {}
}

function initPaceState() {
  const stored = loadPaceState();
  if (stored) {
    state.paceTimer = stored;
    return stored;
  }
  const fresh = { mode: "count-up", running: false, startedAt: null, elapsedMs: 0, targetMs: 0 };
  state.paceTimer = fresh;
  savePaceState(fresh);
  return fresh;
}

export function bootstrapPaceTimer() {
  initPaceState();
}

export function togglePaceTimer() {
  const pace = state.paceTimer || initPaceState();
  if (pace.running) {
    // 暂停：把已运行时间累积到 elapsedMs
    if (pace.startedAt) {
      pace.elapsedMs = (pace.elapsedMs || 0) + (Date.now() - pace.startedAt);
      pace.startedAt = null;
    }
    pace.running = false;
  } else {
    // 开始/继续
    pace.startedAt = Date.now();
    pace.running = true;
  }
  state.paceTimer = { ...pace };
  savePaceState(state.paceTimer);
  render();
}

export function resetPaceTimer() {
  const fresh = { mode: state.paceTimer?.mode || "count-up", running: false, startedAt: null, elapsedMs: 0, targetMs: state.paceTimer?.targetMs || 0 };
  state.paceTimer = fresh;
  savePaceState(fresh);
  render();
}

export function switchPaceMode(modeId, targetMs = 0) {
  const pace = state.paceTimer || initPaceState();
  pace.mode = modeId;
  pace.targetMs = targetMs;
  pace.running = false;
  pace.startedAt = null;
  pace.elapsedMs = 0;
  state.paceTimer = { ...pace };
  savePaceState(state.paceTimer);
  render();
}

/** 每秒由 main.js 的 setInterval 调用：直接更新 DOM 避免触发全量 render */
export function tickPaceTimer() {
  const pace = state.paceTimer;
  if (!pace) return;
  const el = document.querySelector("[data-host-pace-clock]");
  if (!el) return;
  el.textContent = formatPaceClock(pace);
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
 return players.map((player,index)=>{const waiting=waitingIds.has(String(player.role_slot_id));return `<tr class="${player.maybe_stuck?"host-row-warn":""}${waiting?" host-row-waiting":""}"><td><div class="host-player-cell"><div class="avatar small" style="background:${hostPlayerColor(index)}">${(player.player_display_name||player.role_name||"?")[0]}</div><div><strong>${escapeHtml(player.player_display_name||"席位空置")}</strong><p>${escapeHtml(player.role_name)}${waiting?` · <span class="host-wait-tag">待你确认</span>`:""}</p></div></div></td><td>${player.joined?`<span class="status-chip published">已加入</span><small>${player.last_activity_at?formatRelativeTime(player.last_activity_at):"刚刚"}</small>`:`<span class="status-chip draft">未加入</span>`}</td><td><strong>${player.completed_sections}/${player.total_sections}</strong><small>${escapeHtml(player.last_completed_section_title||"尚无完成分幕")}</small></td><td><strong>${player.clue_count}</strong><small>已读 ${player.read_clue_count}</small></td><td><strong>${escapeHtml(hostOperationLabel(player.last_operation_type,player.last_operation_message))}</strong><small>${player.last_activity_at?formatRelativeTime(player.last_activity_at):"—"}</small></td><td><span class="status-chip ${player.maybe_stuck?"testing":"published"}">${escapeHtml(player.stuck_label)}</span></td><td><button class="text-btn" data-action="host-player-detail" data-role="${player.role_slot_id}">详情</button>${player.joined?` <button class="text-btn host-kick-btn" data-action="host-kick-player" data-role="${player.role_slot_id}" title="内测：移出房间；同账号重进可继承进度">踢出</button>`:""}</td></tr>`}).join("");
}

function hostEventBatchToolbar(){
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

function hostPlayerWaitStrip(){
 const events=(state.cloudHostEvents||[]).filter((event)=>event.status==="pending");
 if(!events.length)return "";
 const waitingIds=pendingEventRoleIds();
 const players=(state.cloudHostPlayers||[]).filter((player)=>player.joined&&waitingIds.has(String(player.role_slot_id)));
 const playerLine=players.length?`${players.map((player)=>escapeHtml(player.player_display_name||player.role_name)).join("、")} 可能在等待你确认`:"确认后玩家端会实时收到分幕/场景解锁通知";
 return `<section class="demo-strip host-wait-strip"><div><span class="cloud-pill">主持 ↔ 玩家</span><strong>${events.length} 条待确认 · 关联 ${waitingIds.size||"全"} 个角色席位</strong><p>${playerLine}。优先处理与卡关玩家相关的事件。</p></div><div class="row host-wait-actions"><button class="primary-btn" data-action="host-nudge-waiting">提醒等待中的玩家</button><button class="secondary-btn" data-action="refresh-host-events">刷新待办</button></div></section>`;
}

function hostLiveFeed(){
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
  const result=await api.batchHostEvents(action,ids);
  state.hostEventSelection=[];
  await refreshHostRoom(true);
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
 const renderCard=(event,delayedCard=false)=>`<article class="host-event-card ${delayedCard?"host-event-delayed":""}"><label class="host-event-select check-label"><input type="checkbox" data-action="host-event-toggle" data-event="${event.id}" ${selected.has(event.id)?"checked":""} ${delayedCard?"disabled":""}></label><div class="host-event-body"><div class="host-event-head"><span class="cloud-pill">${escapeHtml(event.source_label||"系统")}</span>${delayedCard?`<span class="status-chip testing">已延迟</span>`:""}<strong>${escapeHtml(event.title)}</strong><small>${delayedCard&&event.delay_until?`将于 ${formatTime(event.delay_until)} 再次提醒 · `:``}${formatRelativeTime(event.created_at)}</small></div><p>${escapeHtml(event.description)}</p>${event.rule_name?`<div class="rule-block"><b>来源规则</b> · ${escapeHtml(event.rule_name)}</div>`:""}${hostEventPlayerChips(event)}${event.action_summaries?.length?`<div class="host-event-actions-preview"><b>确认后将执行</b>${event.action_summaries.map(item=>`<span>${escapeHtml(item)}</span>`).join("")}</div>`:""}<div class="event-actions"><button class="primary-btn" data-action="execute-host-event" data-event="${event.id}">确认并执行</button><button class="secondary-btn" data-action="dismiss-host-event" data-event="${event.id}">拒绝</button>${delayedCard?"":`<button class="secondary-btn" data-action="delay-host-event" data-event="${event.id}">延迟</button>`}<button class="text-btn" data-action="host-event-context" data-event="${event.id}">查看上下文</button></div></div></article>`;
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

function ruleModeLabel(mode){
 return {automatic:"自动执行",host_confirm:"主持确认",manual:"仅手动"}[mode]||mode||"自动执行";
}

function ruleSummary(rule){
 const conditions=JSON.stringify(rule.conditions||{},null,0);
 const actions=JSON.stringify(rule.actions||[],null,0);
 return `<small>当 ${escapeHtml(conditions.slice(0,90))}${conditions.length>90?"…":""}</small><small>则 ${escapeHtml(actions.slice(0,90))}${actions.length>90?"…":""}</small>`;
}

function hostRulesManager(){
 const room=activeRuntimeRoom(),rules=state.rules||[];
 const currentRules=rules.filter(rule=>!rule.room_id||rule.room_id===room?.id);
 const rows=currentRules.length?currentRules.map(rule=>`<div class="checkpoint-row"><div><strong>${escapeHtml(rule.name)}</strong><p>${escapeHtml(ruleModeLabel(rule.mode))} · ${rule.enabled?"已启用":"已暂停"} · ${escapeHtml(rule.room_name||"世界模板")} · 优先级 ${Number(rule.priority)||100}</p>${ruleSummary(rule)}</div><div class="row"><button class="text-btn" data-action="host-rule-toggle" data-rule="${rule.id}">${rule.enabled?"暂停":"启用"}</button><button class="text-btn" data-action="host-rule-edit" data-rule="${rule.id}">编辑</button><button class="text-btn danger-text" data-action="host-rule-delete" data-rule="${rule.id}">删除</button></div></div>`).join(""):`<div class="empty-state">当前房间没有可用规则。可以新建世界模板规则，或绑定到当前房间。</div>`;
 return `<div class="host-detail-list" style="margin-top:12px"><p class="section-kicker">规则管理</p>${rows}</div>`;
}

function ruleEditorValue(rule={}){
 return {
  roomId:rule.room_id||"",
  name:rule.name||"",
  mode:rule.mode||"automatic",
  priority:String(rule.priority??100),
  enabled:rule.enabled!==false,
  conditions:JSON.stringify(rule.conditions||{all:[{type:"reading_completed",roleSlotId:"",scriptSectionId:""}]},null,2),
  actions:JSON.stringify(rule.actions||[{type:"timeline_log",message:"主持端新建规则"}],null,2)
 };
}

async function refreshHostRules(){
 state.rules=await api.getRules();
 render();
}

function showRuleEditorErrors(errors=[]){
 const box=modalEl.root.querySelector("[data-host-rule-errors]");
 if(!box)return;
 if(!errors.length){box.innerHTML="";box.classList.remove("show");return}
 box.classList.add("show");
 box.innerHTML=`<strong>请修正以下问题：</strong><ul>${errors.map(item=>`<li>${escapeHtml(item.message||String(item))}</li>`).join("")}</ul>`;
}

export function openHostRuleEditor(ruleId=""){
 const rule=(state.rules||[]).find(item=>item.id===ruleId);
 const value=ruleEditorValue(rule);
 const rooms=state.rooms||[];
 mountModal();
 modalEl.root.className="modal rule-editor-modal";
 modalEl.root.innerHTML=`<h2>${rule?"编辑自动化规则":"新建自动化规则"}</h2><p class="wizard-intro">主持端提供轻量 JSON 管理；复杂可视化编排仍可回到创作者端处理。</p><div class="form-group">${studioField("规则名称","ruleName","input",value.name)}${studioSelect("绑定范围","ruleRoomId",[{id:"",name:"世界模板 · 可复用于新房间"},...rooms.map(room=>({id:room.id,name:room.name}))],value.roomId)}${studioSelect("触发模式","ruleMode",[{id:"automatic",name:"自动执行"},{id:"host_confirm",name:"主持确认"},{id:"manual",name:"仅手动触发"}],value.mode)}${studioField("优先级","rulePriority","input",value.priority)}<label class="check-label"><input type="checkbox" data-host-rule-enabled ${value.enabled?"checked":""}> 启用规则</label>${studioField("检测条件 JSON","ruleConditions","textarea",value.conditions)}${studioField("执行动作 JSON","ruleActions","textarea",value.actions)}</div><div data-host-rule-errors class="rule-error-box"></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-rule-submit>保存规则</button></div>`;
 modalEl.backdrop.classList.add("show");
 modalEl.root.querySelector("[data-close]").onclick=closeModal;
 modalEl.root.querySelector("[data-host-rule-submit]").onclick=async()=>{
  try{
   showRuleEditorErrors([]);
   const values=studioValues();
   let conditions,actions;
   try{
    conditions=JSON.parse(values.ruleConditions);
    actions=JSON.parse(values.ruleActions);
   }catch(error){
    showRuleEditorErrors([{message:`JSON 格式错误：${error.message}`}]);
    return;
   }
   const validation=await api.validateRuleBody({conditions,actions});
   if(!validation.ok){showRuleEditorErrors(validation.errors||[]);return}
   const payload={roomId:values.ruleRoomId||null,name:values.ruleName,mode:values.ruleMode,priority:Number(values.rulePriority)||100,enabled:modalEl.root.querySelector("[data-host-rule-enabled]").checked,conditions,actions};
   if(rule)await api.updateRule(rule.id,payload);else await api.createRule(payload);
   closeModal();
   await refreshHostRules();
   showToast("规则已保存");
  }catch(error){showToast(error.message)}
 };
}

export async function toggleHostRule(ruleId){
 const rule=(state.rules||[]).find(item=>item.id===ruleId);
 if(!rule)return showToast("找不到规则");
 try{
  await api.updateRule(rule.id,{roomId:rule.room_id||null,name:rule.name,mode:rule.mode,priority:rule.priority,enabled:!rule.enabled,conditions:rule.conditions,actions:rule.actions});
  await refreshHostRules();
  showToast(rule.enabled?"规则已暂停":"规则已启用");
 }catch(error){showToast(error.message)}
}

export async function deleteHostRule(ruleId){
 const rule=(state.rules||[]).find(item=>item.id===ruleId);
 if(!rule)return showToast("找不到规则");
 if(!window.confirm(`确定删除规则“${rule.name}”？`))return;
 try{
  await api.deleteRule(ruleId);
  await refreshHostRules();
  showToast("规则已删除");
 }catch(error){showToast(error.message)}
}

export async function validateHostRules(){
 try{
  const result=await api.validateRules();
  openModal("规则检查完成",result.checks?.length?result.checks.map(check=>`<b>${escapeHtml(check.title)}</b><br><span>${escapeHtml(check.detail)}</span>`).join("<br><br>"):`已检查 ${result.totalRules||0} 条规则，没有发现结构问题。`,"知道了");
 }catch(error){showToast(error.message)}
}

export async function kickHostPlayer(roleSlotId){
 const player=hostPlayerByRoleId(roleSlotId);
 if(!player?.joined)return showToast("该席位尚无玩家");
 const name=player.player_display_name||"玩家";
 if(!window.confirm(`确定将「${name}」移出角色「${player.role_name}」？\n\n同账号重新选角可继承进度；其他账号接席将从零开始。`))return;
 try{
  await api.hostKickPlayer(roleSlotId);
  closeModal();
   await refreshHostRoom();
  showToast(`已移出 ${name}`);
 }catch(error){showToast(error.message)}
}

export async function openHostPlayerDetail(roleSlotId){
 try{
  const detail=await api.getHostPlayerDetail(roleSlotId),role=detail.role;
  mountModal(); modalEl.root.className="modal host-detail-modal";modalEl.root.innerHTML=`<h2>${escapeHtml(role.player_display_name||role.name)} · ${escapeHtml(role.name)}</h2><p class="wizard-intro">${escapeHtml(role.public_profile||"尚未补充公开身份")}</p><div class="host-detail-grid"><section><h3>分幕进度</h3><div class="host-detail-list">${detail.sections.map(section=>`<div class="host-detail-row"><div><strong>${section.sequence}. ${escapeHtml(section.title)}</strong><p>${section.completed?"已完成":section.unlocked||section.sequence===1?"可阅读":"未解锁"} · ${section.publication_status}</p></div>${section.completed?`<span class="status-chip published">完成</span>`:`<button class="text-btn" data-unlock-section="${section.id}" data-role="${roleSlotId}">手动解锁</button>`}</div>`).join("")||`<div class="empty-state">尚无分幕。</div>`}</div></section><section><h3>线索 · ${detail.clues.length}</h3><div class="host-detail-list">${detail.clues.map(clue=>`<div class="host-detail-row"><div><strong>${escapeHtml(clue.name)}</strong><p>${clue.read_at?"已阅读":"未阅读"}${clue.shared_with_room?" · 已公开":""} · ${formatTime(clue.acquired_at)}</p>${clue.player_note?`<small>玩家解读：${escapeHtml(clue.player_note)}</small>`:""}${clue.host_note?`<small>主持备注：${escapeHtml(clue.host_note)}</small>`:""}</div></div>`).join("")||`<div class="empty-state">尚未获得线索。</div>`}</div></section><section><h3>调查记录 · ${detail.investigations.length}</h3><div class="host-detail-list">${detail.investigations.map(item=>`<div class="host-detail-row"><strong>${escapeHtml(item.point_name)}</strong><p>${escapeHtml(item.scene_name)} · ${formatTime(item.investigated_at)}</p></div>`).join("")||`<div class="empty-state">尚无调查记录。</div>`}</div></section><section><h3>笔记 · ${detail.notes.length}</h3><div class="host-detail-list">${detail.notes.slice(0,6).map(note=>`<div class="host-detail-row"><strong>${escapeHtml(note.title)}</strong><p>${escapeHtml(note.body.slice(0,80))}</p></div>`).join("")||`<div class="empty-state">尚无笔记。</div>`}</div></section><section><h3>最近日志</h3><div class="host-detail-list">${detail.recentLogs.slice(0,8).map(log=>`<div class="host-detail-row"><strong>${escapeHtml(hostOperationLabel(log.event_type,log.message))}</strong><p>${escapeHtml(log.message)} · ${formatTime(log.created_at)}</p></div>`).join("")||`<div class="empty-state">尚无相关日志。</div>`}</div></section></div><label>主持备注</label><textarea class="field" rows="3" data-host-notes>${escapeHtml(role.host_notes||"")}</textarea><div class="modal-actions">${role.player_display_name?`<button class="secondary-btn host-kick-btn" data-kick-player="${roleSlotId}">踢出玩家</button>`:""}<button class="secondary-btn" data-close>关闭</button><button class="primary-btn" data-save-host-notes data-role="${roleSlotId}">保存备注</button></div>`;
  modalEl.backdrop.classList.add("show");modalEl.root.querySelector("[data-close]").onclick=closeModal;const kickBtn=modalEl.root.querySelector("[data-kick-player]");if(kickBtn)kickBtn.onclick=()=>kickHostPlayer(kickBtn.dataset.kickPlayer);modalEl.root.querySelector("[data-save-host-notes]").onclick=async()=>{try{await api.hostSaveNotes(roleSlotId,modalEl.root.querySelector("[data-host-notes]").value);closeModal();await refreshHostPlayers();showToast("主持备注已保存")}catch(error){showToast(error.message)}};
  modalEl.root.querySelectorAll("[data-unlock-section]").forEach(button=>button.onclick=async()=>{try{await api.hostUnlockSection({roleSlotId:button.dataset.role,scriptSectionId:button.dataset.unlockSection});closeModal();await refreshHostRoom();showToast("分幕已手动解锁")}catch(error){showToast(error.message)}});
 }catch(error){showToast(error.message)}
}

export async function openHostClueNote(clueId,roleSlotId){
 const matrix=state.cloudHostClueMatrix,clue=(matrix?.clues||[]).find((row)=>row.id===clueId),player=(matrix?.players||[]).find((row)=>row.role_slot_id===roleSlotId);
 if(!clue||!player)return showToast("找不到线索或玩家席位");
 const existing=matrix?.cells?.[clueId]?.[roleSlotId]?.hostNote||"";
 mountModal(); modalEl.root.className="modal";modalEl.root.innerHTML=`<h2>线索主持备注</h2><p class="wizard-intro">${escapeHtml(player.player_display_name||player.role_name)} · ${escapeHtml(clue.name)}</p><textarea class="field" rows="4" data-host-clue-note>${escapeHtml(existing)}</textarea><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-save-host-clue-note>保存备注</button></div>`;
 modalEl.backdrop.classList.add("show");modalEl.root.querySelector("[data-close]").onclick=closeModal;modalEl.root.querySelector("[data-save-host-clue-note]").onclick=async()=>{try{await api.hostClueNote(clueId,{roleSlotId,hostNote:modalEl.root.querySelector("[data-host-clue-note]").value});closeModal();await refreshHostClueMatrix();showToast("线索主持备注已保存")}catch(error){showToast(error.message)}};
}

export function openHostEventContext(eventId){
 const event=(state.cloudHostEvents||[]).find(item=>item.id===eventId);if(!event)return;
 openModal("待确认事件上下文",`<div class="rule-block"><b>来源</b> · ${escapeHtml(event.source_label||"系统")}<br><b>规则</b> · ${escapeHtml(event.rule_name||"—")}<br><b>触发条件</b><br>${escapeHtml(JSON.stringify(event.rule_conditions||{},null,2))}<br><br><b>将执行动作</b><br>${escapeHtml(JSON.stringify(event.actions||[],null,2))}</div>`,"关闭");
}

export function openHostGrantClueModal(){
 const players=(state.cloudHostPlayers||[]).filter(player=>player.joined),clues=state.studio?.clues||[];
 if(!players.length)return showToast("当前没有已加入的玩家");
 if(!clues.length)return showToast("当前世界尚未创建线索");
 const clueOptions=clues.map(clue=>{const mode=clue.metadata?.grantMode;const suffix=mode&&mode!=="auto"?` · ${grantModeLabel(mode)}`:"";return {id:clue.id,name:`${clue.name}${suffix}`}});
 mountModal(); modalEl.root.className="modal";modalEl.root.innerHTML=`<h2>手动发放线索</h2><p class="wizard-intro">可一次发给多名玩家；每人独立获得 clue_ownership，不会默认公开给全房间。标注「主持确认」的线索通常由规则触发，此处为手动 override。</p><div class="form-group">${studioSelect("线索","grantClue",clueOptions)}<label>目标角色（可多选）</label><div class="member-picker">${players.map(player=>`<label><input type="checkbox" data-grant-role value="${player.role_slot_id}"> <span><b>${escapeHtml(player.player_display_name||"玩家")}</b> · ${escapeHtml(player.role_name)}</span></label>`).join("")}</div>${studioField("日志说明","grantMessage","input","主持人手动发放线索")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-grant-submit>确认发放</button></div>`;
 modalEl.backdrop.classList.add("show");modalEl.root.querySelector("[data-close]").onclick=closeModal;modalEl.root.querySelector("[data-host-grant-submit]").onclick=async()=>{try{const values=studioValues();const roleSlotIds=[...modalEl.root.querySelectorAll("[data-grant-role]:checked")].map(el=>el.value);if(!roleSlotIds.length)return showToast("请至少选择一名玩家");await api.hostGrantClue({roleSlotIds,clueId:values.grantClue,message:values.grantMessage});closeModal();await refreshHostRoom();showToast(`线索已发放给 ${roleSlotIds.length} 名玩家`)}catch(error){showToast(error.message)}};
}

export function openDelayHostEventModal(eventId){
 const event=(state.cloudHostEvents||[]).find(item=>item.id===eventId);
 if(!event)return showToast("找不到待确认事件");
 mountModal(); modalEl.root.className="modal";modalEl.root.innerHTML=`<h2>延迟待确认事件</h2><p class="wizard-intro">「${escapeHtml(event.title)}」将从待办列表移出，到期后自动回到待确认队列。</p><div class="form-group"><label>延迟时长</label><select class="field" data-delay-minutes><option value="5">5 分钟</option><option value="15" selected>15 分钟</option><option value="30">30 分钟</option><option value="60">1 小时</option><option value="120">2 小时</option></select></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-delay-submit>确认延迟</button></div>`;
 modalEl.backdrop.classList.add("show");modalEl.root.querySelector("[data-close]").onclick=closeModal;modalEl.root.querySelector("[data-delay-submit]").onclick=async()=>{try{const delayMinutes=Number(modalEl.root.querySelector("[data-delay-minutes]").value)||15;await api.delayHostEvent(eventId,delayMinutes);closeModal();await refreshHostRoom();showToast(`已延迟 ${delayMinutes} 分钟`)}catch(error){showToast(error.message)}};
}

export function openHostGrantItemModal(){
 const players=(state.cloudHostPlayers||[]).filter(player=>player.joined),items=state.studio?.items||[];
 if(!players.length)return showToast("当前没有已加入的玩家");
 if(!items.length)return showToast("当前世界尚未创建物品");
 mountModal(); modalEl.root.className="modal";modalEl.root.innerHTML=`<h2>手动发放物品</h2><p class="wizard-intro">物品会写入指定角色的背包（inventory），并可能触发 item_owned 规则。</p><div class="form-group">${studioSelect("目标角色","grantRole",players.map(player=>({id:player.role_slot_id,name:`${player.player_display_name||"玩家"} · ${player.role_name}`})))}${studioSelect("物品","grantItem",items.map(item=>({id:item.id,name:item.name})))}${studioField("数量","grantQuantity","input","1")}${studioField("日志说明","grantMessage","input","主持人手动发放物品")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-grant-item-submit>确认发放</button></div>`;
 modalEl.backdrop.classList.add("show");modalEl.root.querySelector("[data-close]").onclick=closeModal;modalEl.root.querySelector("[data-host-grant-item-submit]").onclick=async()=>{try{const values=studioValues();await api.hostGrantItem({roleSlotId:values.grantRole,itemId:values.grantItem,quantity:Math.max(1,Number(values.grantQuantity)||1),message:values.grantMessage});closeModal();await refreshHostRoom();showToast("物品已发放")}catch(error){showToast(error.message)}};
}

export function openHostUnlockSectionModal(){
 const players=(state.cloudHostPlayers||[]).filter(player=>player.joined);if(!players.length)return showToast("当前没有已加入的玩家");
 const sections=(state.studio?.sections||[]);
 mountModal(); modalEl.root.className="modal";modalEl.root.innerHTML=`<h2>手动解锁分幕</h2><p class="wizard-intro">解锁后，对应玩家即可阅读该私人分幕。</p><div class="form-group">${studioSelect("目标角色","unlockRole",players.map(player=>({id:player.role_slot_id,name:`${player.player_display_name||"玩家"} · ${player.role_name}`})))}${studioSelect("分幕","unlockSection",sections.filter(section=>section.role_slot_id===players[0].role_slot_id).map(section=>({id:section.id,name:`${section.sequence}. ${section.title}`})))}${studioField("日志说明","unlockMessage","input","主持人手动解锁分幕")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-unlock-submit>确认解锁</button></div>`;
 modalEl.backdrop.classList.add("show");modalEl.root.querySelector("[data-close]").onclick=closeModal;const roleSelect=modalEl.root.querySelector('[data-studio-field="unlockRole"]'),sectionSelect=modalEl.root.querySelector('[data-studio-field="unlockSection"]');const refreshSections=()=>{const roleId=roleSelect.value;const options=sections.filter(section=>section.role_slot_id===roleId).map(section=>({id:section.id,name:`${section.sequence}. ${section.title}`}));sectionSelect.innerHTML=options.length?studioOptionsHtml(options,""):'<option value="">该角色尚无分幕</option>'};roleSelect.onchange=refreshSections;refreshSections();modalEl.root.querySelector("[data-host-unlock-submit]").onclick=async()=>{try{const values=studioValues();await api.hostUnlockSection({roleSlotId:values.unlockRole,scriptSectionId:values.unlockSection,message:values.unlockMessage});closeModal();await refreshHostRoom();showToast("分幕已解锁")}catch(error){showToast(error.message)}};
}

export function openHostUnlockSceneModal(){
 const scenes=state.studio?.scenes||[];if(!scenes.length)return showToast("当前世界尚未创建场景");
 mountModal(); modalEl.root.className="modal";modalEl.root.innerHTML=`<h2>手动开放场景</h2><p class="wizard-intro">开放后所有已入房玩家可在探索页看到该场景。</p><div class="form-group">${studioSelect("场景","unlockScene",scenes.map(scene=>({id:scene.id,name:scene.name})))}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-scene-submit>确认开放</button></div>`;
 modalEl.backdrop.classList.add("show");modalEl.root.querySelector("[data-close]").onclick=closeModal;modalEl.root.querySelector("[data-host-scene-submit]").onclick=async()=>{try{await api.hostUnlockScene(modalEl.root.querySelector('[data-studio-field="unlockScene"]').value);closeModal();await refreshHostRoom();showToast("场景已开放")}catch(error){showToast(error.message)}};
}

export function openHostLogModal(){
 mountModal(); modalEl.root.className="modal";modalEl.root.innerHTML=`<h2>添加主持日志</h2><p class="wizard-intro">记录会写入本房间的时间线，可在世界运行日志中查看。</p><div class="form-group">${studioSelect("关联角色","logRole",[{id:"",name:"不指定角色"},...(state.cloudHostPlayers||[]).filter(player=>player.joined).map(player=>({id:player.role_slot_id,name:`${player.player_display_name||"玩家"} · ${player.role_name}`}))])}${studioField("日志内容","logMessage","textarea","例如：提醒林夏继续阅读序章")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-log-submit>写入日志</button></div>`;
 modalEl.backdrop.classList.add("show");modalEl.root.querySelector("[data-close]").onclick=closeModal;modalEl.root.querySelector("[data-host-log-submit]").onclick=async()=>{try{const values=studioValues(),payload={message:values.logMessage,eventType:"host_note"};if(values.logRole)payload.roleSlotId=values.logRole;await api.hostAddLog(payload);closeModal();await refreshHostRoom();showToast("主持日志已写入")}catch(error){showToast(error.message)}};
}

export async function dismissHostEvent(eventId){
 const event=(state.cloudHostEvents||[]).find((item)=>item.id===eventId);
 try{
  await api.dismissHostEvent(eventId);
  state.hostEventSelection=(state.hostEventSelection||[]).filter((id)=>id!==eventId);
  await refreshHostRoom(true);
  render();
  showToast(`已拒绝「${event?.title||"待确认事件"}」`);
 }catch(error){showToast(error.message)}
}

export async function executeHostEvent(eventId){
 const event=(state.cloudHostEvents||[]).find((item)=>item.id===eventId);
 try{
  await api.executeHostEvent(eventId);
  state.hostEventSelection=(state.hostEventSelection||[]).filter((id)=>id!==eventId);
  await refreshHostRoom(true);
  render();
  const preview=event?.action_summaries?.slice(0,2).join("；")||"规则动作已写入房间";
  showToast(`已确认「${event?.title||"事件"}」· ${preview}`);
 }catch(error){showToast(error.message)}
}

export function openHostNudgeWaitingModal(){
 const waitingIds=pendingEventRoleIds();
 const players=(state.cloudHostPlayers||[]).filter((player)=>player.joined&&(!waitingIds.size||waitingIds.has(String(player.role_slot_id))));
 if(!players.length)return showToast("当前没有已入房且可能在等待的玩家");
 mountModal(); modalEl.root.className="modal";modalEl.root.innerHTML=`<h2>提醒等待中的玩家</h2><p class="wizard-intro">消息会通过实时推送送达 play 端与玩家视角，不会发送站外私信。</p><div class="form-group"><label>提醒内容</label><textarea class="field" rows="3" data-nudge-message>主持人正在处理待确认事件，请稍候 — 确认后新内容会自动解锁。</textarea><label>通知对象（默认已选可能在等待的玩家）</label><div class="member-picker">${players.map((player)=>`<label><input type="checkbox" data-nudge-role value="${player.role_slot_id}" checked> <span><b>${escapeHtml(player.player_display_name||"玩家")}</b> · ${escapeHtml(player.role_name)}</span></label>`).join("")}</div></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-nudge-submit>发送提醒</button></div>`;
 modalEl.backdrop.classList.add("show");modalEl.root.querySelector("[data-close]").onclick=closeModal;modalEl.root.querySelector("[data-nudge-submit]").onclick=async()=>{try{const message=modalEl.root.querySelector("[data-nudge-message]").value;const roleSlotIds=[...modalEl.root.querySelectorAll("[data-nudge-role]:checked")].map((el)=>el.value);if(!roleSlotIds.length)return showToast("请至少选择一名玩家");const result=await api.hostNudgeWaiting({message,roleSlotIds});closeModal();showToast(`已提醒 ${result.notifiedCount} 名玩家`)}catch(error){showToast(error.message)}};
}

function rulePreviewTraceRows(row) {
  if (row.conditionsMet !== false || !row.failedConditions?.length) return "";
  return `<ul class="rule-trace-list">${row.failedConditions
    .map((leaf) => `<li class="rule-trace-fail">${escapeHtml(leaf.label || leaf.type || "条件未满足")}</li>`)
    .join("")}</ul>`;
}

function directorRulesPreview(){
 const preview=state.cloudRulesPreview;
 if(!preview)return `<div class="empty-state">点击「刷新预览」查看当前房间中启用规则的条件评估结果。</div>`;
 if(!preview.length)return `<div class="empty-state">当前平行房没有启用的运行规则。</div>`;
 const statusLabel=rulePreviewStatusLabel;
 return `<div class="host-detail-list">${preview.map((row)=>`<div class="checkpoint-row"><strong>${escapeHtml(row.name)}</strong><p>${escapeHtml(statusLabel(row.status))}${row.conditionsMet===false?" · 条件未满足":""}</p>${rulePreviewTraceRows(row)}${row.status==="manual_ready"?`<button class="text-btn" data-action="rule-manual-trigger" data-rule="${row.id}">立即触发</button>`:""}</div>`).join("")}</div>`;
}

export async function refreshRulesPreview(){
 if(!activeRuntimeRoom())return showToast("请先选择运行房");
 try{
  const result=await api.previewRoomRules();
  state.cloudRulesPreview=result.rules||[];
  render();
  showToast("规则预览已更新");
 }catch(error){showToast(error.message)}
}

export async function triggerManualRuleFromDirector(ruleId){
 if(!activeRuntimeRoom())return showToast("请先选择运行房");
 try{
  await api.triggerManualRule(ruleId);
  await refreshRulesPreview();
  await refreshHostRoom();
  showToast("手动规则已执行");
 }catch(error){showToast(error.message)}
}
