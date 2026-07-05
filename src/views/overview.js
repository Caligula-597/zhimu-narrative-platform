/* Auto-split from app.js — overview.js */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { content, toast, modal, modalBackdrop } from "../dom.js";
import { getRuntime, go, loadCloudData, render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { uiStore, userStore, worldStore, studioStore, roomStore, assetStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as M from "../components/modal.js";
import * as U from "../components/emptyState.js";
import * as S from "../components/ui-semantics.js";
import { overviewHeroTitle, formatCloudPanelError } from "../utils/user-messages.js";
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
  const showError = S.showError;
  const closeModal = M.closeModal || (() => {});
  const openModal = M.openModal || (() => {});
  const studioModal = M.studioModal || (() => {});
  const studioField = M.studioField || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioSelect = M.studioSelect || (() => "");
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});

export function overviewRuntimeProgress() {
  const { cloudHost } = roomStore.get();
  const host = cloudHost || [];
  if (!host.length) return { percent: 0, label: "暂无玩家进度" };
  const totals = host.reduce((acc, item) => {
    acc.completed += item.completed_sections || 0;
    acc.total += item.total_sections || 0;
    return acc;
  }, { completed: 0, total: 0 });
  const percent = totals.total ? Math.round((totals.completed / totals.total) * 100) : 0;
  return { percent, label: totals.total ? `${totals.completed} / ${totals.total} 段私人剧情已完成` : "暂无玩家进度" };
}

function refToUiFields(ref) {
  if (!ref) return {};
  if (ref.type === "action") return { action: ref.action };
  if (ref.type === "view") return { view: ref.view };
  return {};
}

function overviewNextActionFromDashboard(item, index) {
  return { ...refToUiFields(item.ref), title: item.title, detail: item.detail, button: item.button, index: String(index + 1).padStart(2, "0") };
}

function overviewRiskFromDashboard(item) {
  return { level: item.level, title: item.title, detail: item.detail, ...refToUiFields(item.ref), button: item.button };
}

function overviewProductionFromDashboard(item) {
  return { label: item.label, value: item.value, detail: item.detail, done: item.done, ...refToUiFields(item.ref), button: item.button };
}

function overviewProductionItem(item) {
  const actionAttr = item.action ? ` data-action="${escapeHtml(item.action)}"` : ` data-go="${escapeHtml(item.view || "overview")}"`;
  return `<div class="production-item ${item.done ? "is-done" : "is-waiting"}">
    <span class="production-dot">${item.done ? "✓" : "!"}</span>
    <div>
      <b>${escapeHtml(item.label)}</b>
      <strong>${escapeHtml(item.value)}</strong>
      <p>${escapeHtml(item.detail)}</p>
    </div>
    <button type="button"${actionAttr}>${escapeHtml(item.button || "处理")} →</button>
  </div>`;
}

function overviewNextAction(item) {
  const actionAttr = item.action ? ` data-action="${escapeHtml(item.action)}"` : ` data-go="${escapeHtml(item.view || "overview")}"`;
  return `<div class="next-action-row">
    <span>${escapeHtml(item.index)}</span>
    <div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.detail)}</p></div>
    <button type="button"${actionAttr}>${escapeHtml(item.button || "打开")}</button>
  </div>`;
}

function overviewBackendCapability(item) {
  return `<div class="backend-capability ${item.ready ? "is-ready" : "is-waiting"}">
    <span>${item.ready ? "✓" : "!"}</span>
    <div><b>${escapeHtml(item.label)}</b><p>${escapeHtml(item.detail)}</p></div>
  </div>`;
}

function overviewRiskItem(item) {
  const cls = item.level === "error" ? "risk-error" : "risk-warning";
  const icon = item.level === "error" ? "✕" : "!";
  const actionAttr = item.action
    ? ` data-action="${escapeHtml(item.action)}"`
    : item.view
    ? ` data-go="${escapeHtml(item.view)}"`
    : "";
  const button = item.action || item.view
    ? `<button type="button"${actionAttr}>${escapeHtml(item.button || "处理")} →</button>`
    : "";
  return `<div class="risk-item ${cls}">
    <span class="risk-icon">${icon}</span>
    <div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.detail)}</p></div>
    ${button}
  </div>`;
}

export function overview() {
  const { cloudStudio, cloudLoading } = studioStore.get();
  const { cloudWorlds, cloudRules, cloudWorldLogs, cloudCreatorChecks, cloudCreatorDashboard } = worldStore.get();
  const { cloudAssets, storageUsage } = assetStore.get();
  const { apiError } = userStore.get();
  const { cloudHost, cloudHostEvents, cloudHostStuckCount, cloudRecaps, cloudCheckpoints } = roomStore.get();
  const studio = cloudStudio;
  const listedWorld = (cloudWorlds || []).find((world) => world.id === zhimuApi.context.worldId);
  const world = studio?.world || listedWorld;
  const loggedOutDemo=!window.zhimuSessionAuth?.isAuthenticated?.()&&window.zhimuConfig?.demoMode;
  const studioEmpty=!loggedOutDemo&&Boolean(zhimuApi.context.worldId)&&!studio?.roles?.length;
  const studioEmptyBanner=studioEmpty?`<section class="demo-strip" style="margin-bottom:14px;border-color:#e8c4c4;background:#fff8f7"><div><span class="cloud-pill">内容未载入</span><strong style="margin-top:7px">剧本「${escapeHtml(world?.name||"当前")}」暂无角色或分幕</strong><p>${escapeHtml(apiError||"请刷新云端数据，或稍后再试。")}</p></div><button class="primary-btn" data-action="refresh-cloud">刷新云端数据</button></section>`:"";
  const loading = cloudLoading && !studio?.world;
  const roleCount = studio?.roles?.length ?? 0, chapterCount = studio?.chapters?.length ?? 0;
  const uploadCount = cloudAssets?.length ?? 0;
  const sceneCount = studio?.scenes?.length ?? 0;
  const clueCount = studio?.clues?.length ?? 0;
  const pointCount = studio?.investigationPoints?.length ?? 0;
  const sectionCount = studio?.sections?.length ?? 0;
  const rooms = studio?.rooms || [], hasRooms = rooms.length > 0;
  const room = activeRuntimeRoom(), hasActiveRoom = Boolean(room);
  const enabledRules = (cloudRules || []).filter(rule => rule.enabled).length;
  const pendingEvents = hasActiveRoom ? (cloudHostEvents || []).length : 0;
  const runtimeProgress = hasActiveRoom ? overviewRuntimeProgress() : { percent: 0, label: "当前未选中运行房" };
  const activePlayers = hasActiveRoom ? (cloudHost || []).filter(item => (item.completed_sections || 0) > 0 || item.current_scene_id).length : 0;
  const chapterFlow = studio?.chapters?.map(chapter => flow(
    `第 ${chapter.sequence} 章`,
    escapeHtml(chapter.title),
    chapterPublicationLabel(chapter.publication_status),
    chapterFlowClass(chapter.publication_status)
  )).join("") || `<div class="empty-state">尚未创建公共章节。</div>`;
  const logs = cloudWorldLogs || [];
  const activities = logs.length
    ? logs.slice(0, 8).map(log => activity(escapeHtml(log.message), formatRelativeTime(log.created_at), logActivityType(log.event_type))).join("")
    : `<div class="empty-state">${hasActiveRoom ? "暂无最近事件" : hasRooms ? "请选择一个运行房以查看该房间的最近事件。" : "暂无运行房。创建测试房后，阅读、调查和规则触发会记录在这里。"}</div>`;
  const hostByRole = new Map((cloudHost || []).map(item => [item.role_slot_id, item]));
  const roleColors = ["#b9795c", "#587f79", "#706b91", "#9a814f", "#76614d", "#657c91"];
  const roleRows = studio?.roles?.map((role, index) => {
    const sections = studio.sections.filter(section => section.role_slot_id === role.id).length;
    const host = hostByRole.get(role.id);
    if (hasActiveRoom && host) {
      const pct = host.total_sections ? Math.round((host.completed_sections / host.total_sections) * 100) : 0;
      const text = host.current_scene_id ? "已记录当前场景" : host.completed_sections > 0 ? "正在阅读私人章节" : "席位已建立，等待玩家阅读";
      const status = host.total_sections ? `${host.completed_sections}/${host.total_sections} 段 · ${pct}%` : `${sections} 段已编排`;
      return readingRow(role.name[0], escapeHtml(role.name), text, status, pct >= 100 ? "ok" : pct > 0 ? "live" : "", roleColors[index % 6]);
    }
    if (hasActiveRoom) {
      return readingRow(role.name[0], escapeHtml(role.name), "席位已建立，等待玩家加入", `${sections} 段已编排`, "", roleColors[index % 6]);
    }
    return readingRow(role.name[0], escapeHtml(role.name), "尚未加入运行房", `${sections} 段已编排`, "", roleColors[index % 6]);
  }).join("") || `<div class="empty-state">${hasActiveRoom ? "暂无玩家进度" : "尚未创建角色席位。"}</div>`;
  const statusHead = hasActiveRoom ? "● 运行中" : hasRooms ? "○ 运行房已建立" : "○ 尚未开始运行";
  const statusTitle = hasActiveRoom ? escapeHtml(room.name) : hasRooms ? "请选择一个运行房" : "尚未创建测试房";
  const statusKicker = hasActiveRoom ? S.status?.("room", "active")?.label || "RUNTIME ACTIVE" : hasRooms ? S.status?.("room", "ready")?.label || "ROOMS READY" : S.status?.("room", "empty")?.label || "CREATOR MODE";
  const playJoinUrl = hasActiveRoom && room?.invite_code
    ? (window.zhimuInviteLinks?.playerJoinUrl?.(room.invite_code) || `https://play.getzhimu.com/?join=${encodeURIComponent(room.invite_code)}`)
    : "";
  const hostConsoleUrl = window.zhimuInviteLinks?.hostConsoleUrl?.(room?.id) || "https://host.getzhimu.com";
  const worldHealth = [
    { label: "角色席位", value: roleCount, total: Math.max(roleCount, 1), tone: "green" },
    { label: "私人分幕", value: sectionCount, total: Math.max(roleCount * 2, sectionCount, 1), tone: "brass" },
    { label: "剧情场景", value: sceneCount, total: Math.max(sceneCount + 2, 6), tone: "plum" },
    { label: "线索节点", value: clueCount, total: Math.max(clueCount + 3, 8), tone: "clay" }
  ];
  const overviewMapNodes = [
    { label: "世界设定", value: world?.name || "未选择世界", cls: "core" },
    { label: "角色", value: `${roleCount} 个席位`, cls: "role" },
    { label: "章节", value: `${chapterCount} 个公共章节`, cls: "chapter" },
    { label: "场景", value: `${sceneCount} 个场景`, cls: "scene" },
    { label: "线索", value: `${clueCount} 条线索`, cls: "clue" },
    { label: "规则", value: `${enabledRules} 条启用`, cls: "rule" }
  ];
  const storageQuotaPct = storageUsage && storageUsage.maxBytes ? Math.round((storageUsage.usedBytes / storageUsage.maxBytes) * 100) : null;
  const operationCards = [
    { k: "运行房", v: hasRooms ? `${rooms.length} 个` : "未建立", t: hasActiveRoom ? "已选中当前运行房" : "创建测试房后进入主持端" },
    { k: "玩家进度", v: `${runtimeProgress.percent}%`, t: runtimeProgress.label },
    { k: "待确认", v: String(pendingEvents), t: pendingEvents ? "需要主持端处理" : "暂无主持待办" },
    { k: "复盘", v: String(cloudRecaps?.length || 0), t: "checkpoint 与 recap 归档" },
    ...(storageQuotaPct !== null ? [{ k: "云存储", v: `${storageQuotaPct}%`, t: `${formatBytes(storageUsage.usedBytes)} / ${formatBytes(storageUsage.maxBytes)}` }] : [])
  ];
  const creatorChecks = cloudCreatorDashboard?.checks ?? cloudCreatorChecks ?? [];
  const checkErrors = creatorChecks.filter(c => c.level === "error");
  const checkWarnings = creatorChecks.filter(c => c.level === "warning");
  const miniGameTemplates = Array.isArray(world?.settings?.miniGameTemplates) ? world.settings.miniGameTemplates.length : 0;
  const clientProductionItems = [
    { label: "基础内容", value: `${roleCount} 角色 / ${sectionCount} 分幕`, detail: roleCount && sectionCount ? "角色与私人分幕已经可进入玩家端预览。" : "先补齐角色席位和私人分幕。", done: roleCount > 0 && sectionCount > 0, view: "writer", button: "创作" },
    { label: "剧情结构", value: `${chapterCount} 章 / ${sceneCount} 场景`, detail: chapterCount && sceneCount ? "公共章节和场景结构已成型。" : "需要补章节、场景和主线推进关系。", done: chapterCount > 0 && sceneCount > 0, view: "studio", button: "编排" },
    { label: "调查内容", value: `${clueCount} 线索 / ${pointCount} 调查点`, detail: clueCount && pointCount ? "线索和调查点可以支撑玩家行动。" : "线索管理只做审稿与证据链，不再承担完整编排台。", done: clueCount > 0 && pointCount > 0, view: "clues", button: "检查" },
    { label: "自动化规则", value: `${enabledRules} 条启用`, detail: enabledRules ? "规则可在运行房触发，后续补 debug trace。" : "建议至少配置发线索、开放场景或主持确认规则。", done: enabledRules > 0, view: "rules", button: "配置" },
    { label: "运行房", value: hasRooms ? `${rooms.length} 个` : "未建立", detail: hasRooms ? "可以进入主持端跑房和测试。" : "建立运行房后才能验证主持端、玩家端和规则触发。", done: hasRooms, action: "world-rooms", button: hasRooms ? "管理" : "建立" },
    { label: "小游戏测试", value: `${miniGameTemplates} 模板`, detail: miniGameTemplates ? "创作者已保存数字锁模板，可在当前房间测试启动。" : "测试功能：先沉淀数字锁模板，再扩更多玩法。", done: miniGameTemplates > 0, view: "miniGames", button: "设计" }
  ];
  const productionItems = cloudCreatorDashboard?.production?.map(overviewProductionFromDashboard) ?? clientProductionItems;
  const doneProduction = productionItems.filter(item => item.done).length;
  const productionPercent = cloudCreatorDashboard?.readiness?.productionPercent ?? Math.round((doneProduction / productionItems.length) * 100);
  const clientCheckRisks = [...checkErrors, ...checkWarnings].map(check => ({ level: check.level, title: check.title, detail: check.detail }));
  const clientRuntimeRisks = [];
  if (pendingEvents > 5) {
    clientRuntimeRisks.push({ level: "warning", title: "待确认事件积压", detail: `${pendingEvents} 条事件等待主持端处理，可能影响玩家体验。`, action: "open-host-console", button: "打开主持端" });
  }
  if (cloudHostStuckCount > 0) {
    clientRuntimeRisks.push({ level: "warning", title: `${cloudHostStuckCount} 名玩家疑似卡关`, detail: "玩家长时间未推进剧情，建议主持端主动干预或发放线索。", action: "open-host-console", button: "打开主持端" });
  }
  if (hasActiveRoom && !cloudCheckpoints?.length) {
    clientRuntimeRisks.push({ level: "warning", title: "运行房尚未存档", detail: "当前运行进度没有存档点，意外中断后无法恢复。", action: "create-checkpoint", button: "创建存档" });
  }
  const clientQuotaRisks = [];
  if (storageUsage && storageUsage.maxBytes) {
    const quotaPct = storageUsage.usedBytes / storageUsage.maxBytes;
    if (quotaPct > 0.8) {
      clientQuotaRisks.push({ level: quotaPct > 0.95 ? "error" : "warning", title: "云存储空间不足", detail: `已用 ${Math.round(quotaPct * 100)}%（${formatBytes(storageUsage.usedBytes)} / ${formatBytes(storageUsage.maxBytes)}）。请清理附件或申请扩容。`, action: "go-account", button: "管理资产" });
    }
  }
  const riskItems = cloudCreatorDashboard?.risks?.map(overviewRiskFromDashboard)
    ?? [...clientCheckRisks, ...clientRuntimeRisks, ...clientQuotaRisks];
  const riskErrorCount = cloudCreatorDashboard?.riskSummary?.errorCount ?? riskItems.filter(r => r.level === "error").length;
  const riskWarningCount = cloudCreatorDashboard?.riskSummary?.warningCount ?? riskItems.filter(r => r.level === "warning").length;
  const hasRisks = cloudCreatorDashboard?.riskSummary?.hasRisks ?? riskItems.length > 0;
  const readyForPlaytest = cloudCreatorDashboard?.readiness?.readyForPlaytest ?? (checkErrors.length === 0 && roleCount > 0 && sectionCount > 0 && chapterCount > 0);
  const readyForCatalog = cloudCreatorDashboard?.readiness?.readyForCatalog ?? (readyForPlaytest && checkWarnings.length === 0 && hasRooms);
  const readinessLabel = cloudCreatorDashboard?.readiness?.label ?? (readyForCatalog ? "可申请公开库" : readyForPlaytest ? "可内测测试" : "尚未就绪");
  const readinessTone = cloudCreatorDashboard?.readiness?.tone ?? (readyForCatalog ? "published" : readyForPlaytest ? "testing" : "draft");
  const clientNextActions = [
    riskErrorCount ? { title: "处理发布阻塞项", detail: `${riskErrorCount} 项阻塞问题阻止剧本进入内测，请先在风险面板处理。`, action: "creator-check", button: "运行发布检查" } : null,
    cloudHostStuckCount > 0 ? { title: "干预卡关玩家", detail: `${cloudHostStuckCount} 名玩家长时间未推进剧情，建议主动发放线索或引导。`, action: "open-host-console", button: "打开主持端" } : null,
    hasActiveRoom && !cloudCheckpoints?.length ? { title: "为当前运行房创建存档", detail: "运行进度没有存档点，意外中断后无法恢复。", action: "create-checkpoint", button: "创建存档" } : null,
    !roleCount || !sectionCount ? { title: "补齐角色与私人分幕", detail: "玩家端体验从角色席位和私人正文开始。", view: "writer", button: "打开创作台" } : null,
    !chapterCount || !sceneCount ? { title: "整理章节和场景结构", detail: "让主持端和玩家端知道剧情推进到哪里。", view: "studio", button: "打开编排" } : null,
    !clueCount || !pointCount ? { title: "补线索和调查点", detail: "线索管理负责审稿、关联、触发条件和证据链检查。", view: "clues", button: "打开线索" } : null,
    !enabledRules ? { title: "配置至少一条自动化规则", detail: "用已有后端把发线索、开场景、主持确认跑起来。", view: "rules", button: "打开规则" } : null,
    !miniGameTemplates ? { title: "创建小游戏测试模板", detail: "先做数字锁模板，标注测试功能，给主持端启动。", view: "miniGames", button: "打开小游戏" } : null,
    !hasRooms ? { title: "建立运行房做端到端测试", detail: "运行房会串起主持端、玩家端、日志、复盘和规则触发。", action: "world-rooms", button: "管理房间" } : null,
    pendingEvents ? { title: "处理主持待确认事件", detail: `${pendingEvents} 条事件正在等待主持端确认。`, action: "open-host-console", button: "打开主持端" } : null,
    hasRooms && !pendingEvents && !riskErrorCount ? { title: "进入运行控制台检查现场", detail: "确认玩家状态、房间状态和事件日志是否正常。", action: "open-host-console", button: "打开主持端" } : null
  ].filter(Boolean).slice(0, 5).map((item, index) => ({ ...item, index: String(index + 1).padStart(2, "0") }));
  const nextActions = cloudCreatorDashboard?.nextActions?.map(overviewNextActionFromDashboard)
    ?? clientNextActions;
  const backendCapabilities = [
    { label: "云端世界与创作数据", ready: Boolean(studio?.world || listedWorld), detail: "世界、角色、章节、场景、线索和调查点已经从后端读取。" },
    { label: "运行房与邀请码", ready: hasRooms, detail: hasRooms ? "运行实例和玩家邀请链路可用。" : "创建运行房后启用邀请码和玩家进度。" },
    { label: "主持事件与玩家进度", ready: hasActiveRoom, detail: hasActiveRoom ? "当前房间可读取待确认事件与角色进度。" : "选中运行房后展示实时运行信号。" },
    { label: "自动化规则", ready: enabledRules > 0, detail: enabledRules ? "规则引擎已有可启用规则。" : "规则页已有配置入口，缺少当前世界启用项。" },
    { label: "附件资产", ready: uploadCount > 0, detail: uploadCount ? "云端附件已接入，可服务线索和角色材料。" : "账号资产页可上传后绑定内容。" },
    { label: "存档与复盘", ready: Boolean(cloudRecaps?.length), detail: cloudRecaps?.length ? "已有复盘记录可回看。" : "运行房产生 checkpoint/recap 后进入复盘。" }
  ];
  const inviteStrip = hasActiveRoom && room?.invite_code ? `
        <div class="invite-strip">
          <p class="section-kicker">玩家邀请码 · 可随时复制</p>
          <div class="invite-code-row">
            <code class="invite-code-display">${escapeHtml(room.invite_code)}</code>
            <button type="button" class="secondary-btn compact" data-action="copy-invite-code" data-invite-code="${escapeHtml(room.invite_code)}">复制码</button>
            <button type="button" class="secondary-btn compact" data-action="copy-play-link" data-invite-code="${escapeHtml(room.invite_code)}">复制玩家链接</button>
            <button type="button" class="text-btn" data-action="room-invite-current">详情</button>
            <button type="button" class="text-btn" data-action="open-player-portal" data-invite-code="${escapeHtml(room.invite_code)}">打开玩家端</button>
          </div>
          <p class="invite-hint">发给玩家：<a href="${escapeHtml(playJoinUrl)}" target="_blank" rel="noopener">${escapeHtml(playJoinUrl)}</a></p>
        </div>` : hasRooms && !hasActiveRoom ? `
        <p class="invite-hint">已建立 ${rooms.length} 个平行房。请点下方「管理运行房」选中房间，即可查看并复制邀请码。</p>` : "";
  const showCatalogPromo = !loading && !studio && Boolean(window.zhimuSessionAuth?.isAuthenticated?.());
  const firstRunChooser = window.zhimuFirstRun?.renderFirstRunChooser?.() || "";
  const onboardingStrip = firstRunChooser ? "" : (window.zhimuOnboarding?.renderOnboardingStrip?.() || "");
  return `
    ${cloudStatus()}
    ${firstRunChooser}
    ${onboardingStrip}
    ${studioEmptyBanner}
    ${showCatalogPromo ? U.catalogPromoSection?.() || "" : ""}
    <section class="hero">
      <article class="hero-card">
        <p class="eyebrow">CURRENT WORLD · ONLINE</p>
        <h2>${loading ? "正在连接云端…" : escapeHtml(overviewHeroTitle({ loading, worldName: world?.name, apiError }))}</h2>
        <p>${loading ? "正在读取世界基础信息与章节结构，通常只需片刻。" : escapeHtml(world?.summary || (formatCloudPanelError(apiError, { hasStudio: Boolean(world) }) || "世界基础信息加载完成后会显示在这里。"))}</p>
        <div class="hero-stats"><div><strong>${String(roleCount).padStart(2,"0")}</strong><small>角色席位</small></div><div><strong>${String(chapterCount).padStart(2,"0")}</strong><small>公共章节</small></div><div><strong>${String(uploadCount).padStart(2,"0")}</strong><small>云端附件</small></div></div>
      </article>
      <article class="status-card">
        <div class="status-head"><h3>当前进度</h3><span>${statusHead}</span></div>
        <div class="chapter"><p class="section-kicker">${statusKicker}</p><strong>${statusTitle}</strong></div>
        <div class="progress"><i style="width:${hasActiveRoom ? runtimeProgress.percent : 0}%"></i></div>
        <div class="status-meta"><span>${hasActiveRoom ? runtimeProgress.label : hasRooms ? "已建立运行房，请进入房间后查看玩家进度" : "当前仅有创作内容，没有玩家运行状态"}</span><span>${hasActiveRoom ? runtimeProgress.percent : 0}%</span></div>
        <div class="pulse-line"><i></i><span>${hasActiveRoom ? "运行实例已连接" : hasRooms ? "选择一个运行房以读取运行状态" : "完成检查后可建立测试房"}</span></div>
        ${inviteStrip}
      </article>
    </section>
    <section class="production-console ${escapeHtml(S.surface?.("creator")?.className || "")}">
      <article class="production-panel production-main">
        <div class="section-head">
          <div><p class="section-kicker">CREATOR CONTROL</p><h3>制作总控台</h3><p>把已有后端能力翻译成创作者能直接处理的制作状态：内容、规则、运行房、小游戏和复盘都在这里汇总。</p></div>
          <div class="production-score"><span class="status-chip ${readinessTone}">${readinessLabel}</span><strong>${productionPercent}%</strong><span>${doneProduction}/${productionItems.length} 已完成</span></div>
        </div>
        <div class="production-progress"><i style="width:${productionPercent}%"></i></div>
        <div class="production-grid">${productionItems.map(overviewProductionItem).join("")}</div>
      </article>
      <article class="production-panel next-actions-panel">
        <div class="section-head">
          <div><p class="section-kicker">NEXT ACTIONS</p><h3>下一步</h3><p>按当前数据自动排序，优先做能推动三端联调的事。</p></div>
        </div>
        <div class="next-action-list">${nextActions.length ? nextActions.map(overviewNextAction).join("") : `<div class="empty-state">制作状态已经完整。建议进入运行房做主持端和玩家端联调。</div>`}</div>
      </article>
    </section>
    <section class="risk-console">
      <div class="section-head">
        <div><p class="section-kicker">RISKS &amp; ALERTS</p><h3>风险与问题</h3><p>发布检查、运行时异常和配额预警统一汇总在这里。阻塞项必须处理，警告项建议尽快处理。</p></div>
        <div class="risk-summary">
          ${riskErrorCount ? `<span class="risk-count risk-error">${riskErrorCount} 阻塞</span>` : ""}
          ${riskWarningCount ? `<span class="risk-count risk-warning">${riskWarningCount} 警告</span>` : ""}
          ${!hasRisks ? `<span class="risk-count risk-ok">✓ 无风险</span>` : ""}
        </div>
      </div>
      <div class="risk-list">${hasRisks ? riskItems.map(overviewRiskItem).join("") : `<div class="empty-state">当前没有需要处理的风险。点击「运行发布检查」可重新检测发布就绪度。</div>`}</div>
      <button class="secondary-btn" data-action="creator-check">运行发布检查</button>
    </section>
    <section class="backend-console">
      <div class="section-head">
        <div><p class="section-kicker">BACKEND PRODUCTIZED</p><h3>后端能力状态</h3><p>制作总控台风险与下一步已由 <code>creator-dashboard</code> 聚合 API 提供；其余卡片仍来自创作/运行数据。</p></div>
      </div>
      <div class="backend-capability-list">${backendCapabilities.map(overviewBackendCapability).join("")}</div>
    </section>
    <section class="vision-dashboard">
      <article class="vision-panel vision-map">
        <div class="section-head">
          <div><p class="section-kicker">ZHIMU OPERATING VIEW</p><h3>故事运行总览</h3><p>基于当前世界数据重组的创作者视图，用来理解内容、规则和运行状态如何连在一起。</p></div>
          <button class="secondary-btn" data-go="studio">编辑结构</button>
        </div>
        <div class="story-map" aria-label="织幕故事结构图">
          <svg class="story-map-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="story-map-link-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">
                <stop offset="0%" stop-color="rgba(88,127,121,.42)" />
                <stop offset="50%" stop-color="rgba(196,147,77,.55)" />
                <stop offset="100%" stop-color="rgba(112,107,145,.42)" />
              </linearGradient>
            </defs>
            <path class="map-link" d="M 50 16 V 28" />
            <path class="map-link" d="M 16.7 28 H 83.3" />
            <path class="map-link" d="M 16.7 28 V 40" />
            <path class="map-link" d="M 50 28 V 40" />
            <path class="map-link" d="M 83.3 28 V 40" />
            <path class="map-link" d="M 50 40 V 54" />
            <path class="map-link" d="M 33.3 54 H 50" />
            <path class="map-link" d="M 33.3 54 V 68" />
            <path class="map-link" d="M 83.3 40 V 68" />
            <path class="map-link" d="M 33.3 68 H 83.3" />
          </svg>
          ${overviewMapNodes.map((node) => `<div class="map-node ${node.cls}"><small>${escapeHtml(node.label)}</small><strong>${escapeHtml(node.value)}</strong></div>`).join("")}
        </div>
        <div class="map-health-row">
          ${worldHealth.map((item) => {
            const pct = Math.min(100, Math.round((item.value / item.total) * 100));
            return `<div class="map-health ${item.tone}"><span>${escapeHtml(item.label)}</span><strong>${item.value}</strong><i><b style="width:${pct}%"></b></i></div>`;
          }).join("")}
        </div>
      </article>
      <article class="vision-panel vision-ops">
        <div class="section-head">
          <div><p class="section-kicker">RUN SIGNALS</p><h3>运行信号</h3><p>创作者端只保留总览和配置；现场处理交给独立主持端，玩家体验交给独立玩家端。</p></div>
        </div>
        <div class="operation-card-grid">
          ${operationCards.map((card) => `<div class="operation-mini"><span>${escapeHtml(card.k)}</span><strong>${escapeHtml(card.v)}</strong><p>${escapeHtml(card.t)}</p></div>`).join("")}
        </div>
        <div class="external-entry-grid">
          <a class="external-entry host-entry" href="${escapeHtml(hostConsoleUrl)}" target="_blank" rel="noopener">
            <span>HOST</span><strong>打开主持端</strong><small>处理待确认事件、玩家进度与现场干预</small>
          </a>
          <a class="external-entry play-entry" href="${escapeHtml(playJoinUrl || window.zhimuInviteLinks?.playSiteOrigin?.() || "https://play.getzhimu.com")}" target="_blank" rel="noopener">
            <span>PLAY</span><strong>打开玩家端</strong><small>${hasActiveRoom && room?.invite_code ? `邀请码 ${escapeHtml(room.invite_code)}` : "输入邀请码或体验公开入口"}</small>
          </a>
        </div>
      </article>
    </section>
    <section class="stats-grid">
      ${stat("♙",hasActiveRoom ? String(activePlayers) : "0","有进度角色",hasActiveRoom ? "读取当前运行房玩家" : "尚未建立或选中运行房")}
      ${stat("⌘",String(enabledRules),"已启用规则",enabledRules ? "云端规则已配置" : "尚未为当前世界配置规则")}
      ${stat("↑",String(uploadCount),"已上传附件",uploadCount ? "来自 Cloudflare R2" : "暂无上传资产")}
      ${stat("◷",String(pendingEvents),"待确认事件",pendingEvents ? "需要主持人处理" : "暂无待确认事件")}
    </section>
    <section class="dashboard-grid">
      <article class="card">
        <div class="section-head"><div><h3>剧情脉络</h3><p>主线节点的实时运行状态</p></div><button class="text-btn" data-go="studio">打开编排台 →</button></div>
        <div class="flow-list">
          ${chapterFlow}
        </div>
      </article>
      <article class="card">
        <div class="section-head"><div><h3>实时动态</h3><p>最近发生的状态变化</p></div><button class="text-btn" data-go="archive">查看复盘 →</button></div>
        <div class="activity-list">${activities}</div>
      </article>
    </section>
    <section class="workspace-grid">
      <article class="card">
        <div class="section-head"><div><h3>角色阅读状态</h3><p>创作者端只展示聚合状态；完整玩家体验请在独立玩家端验证。</p></div><button class="text-btn" data-action="open-player-portal" data-invite-code="${escapeHtml(room?.invite_code || "")}">打开玩家端 →</button></div>
        <div class="reading-list">${roleRows}</div>
      </article>
      <article class="card">
        <div class="section-head"><div><h3>现在可以做什么</h3><p>从主页面直接进入当前工作</p></div></div>
        <div class="task-list">
          ${task("◇","复核剧情编排",`${studio?.scenes?.length || 0} 个场景、${studio?.investigationPoints?.length || 0} 个调查点和 ${studio?.edges?.length || 0} 条连线已经写入`,"studio","打开编排")}
          ${task("✎","逐角色检查私人剧本",`${roleCount} 个角色席位，共 ${studio?.sections?.length || 0} 段私人正文`,"writer","检查角色稿")}
          ${task("⌘","配置自动化规则",enabledRules ? `当前已有 ${enabledRules} 条启用规则` : "当前世界还没有运行规则","rules","打开规则")}
          ${hasActiveRoom && room?.invite_code ? taskAction("⎘", "邀请玩家入房", `邀请码 ${escapeHtml(room.invite_code)}`, "room-invite-current", "复制/分享") : ""}
          <div class="task-row"><span class="task-icon">▶</span><div><strong>进入独立主持端</strong><p>${hasActiveRoom ? `当前房间：${escapeHtml(room.name)}` : "创作者端不再内置主持控制台，请在主持端处理现场。"}</p></div><button data-action="open-host-console" data-room-id="${escapeHtml(room?.id || "")}">打开主持端 →</button></div>
          ${taskAction(hasRooms ? "◉" : "＋",hasRooms ? "管理运行房" : "建立运行房",hasRooms ? (rooms.length===1?`当前运行房：${escapeHtml((room||rooms[0])?.name||"运行房")}`:`${rooms.length} 个你可访问的运行房`): "当前世界尚未创建运行实例","world-rooms",hasRooms ? "查看房间" : "创建运行房")}
          ${uploadCount ? taskAction("↑","管理云端附件",`${uploadCount} 个文件已上传`,"go-account","打开资产","assets") : taskAction("↑","上传世界附件","当前世界还没有上传资产。你可以上传线索图、音频、角色图或文档。","go-account","前往上传","assets")}
        </div>
      </article>
    </section>
    `;
}

export const overviewViewApi = { overviewRuntimeProgress, overview };
registerView("overview", overviewViewApi);
