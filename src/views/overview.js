/* Auto-split from app.js — overview.js */
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
  const viewExports = window.zhimuViews.overview = window.zhimuViews.overview || {};
function overviewRuntimeProgress() {
  const host = state.cloudHost || [];
  if (!host.length) return { percent: 0, label: "暂无玩家进度" };
  const totals = host.reduce((acc, item) => {
    acc.completed += item.completed_sections || 0;
    acc.total += item.total_sections || 0;
    return acc;
  }, { completed: 0, total: 0 });
  const percent = totals.total ? Math.round((totals.completed / totals.total) * 100) : 0;
  return { percent, label: totals.total ? `${totals.completed} / ${totals.total} 段私人剧情已完成` : "暂无玩家进度" };
}

function overview() {
  const studio = state.cloudStudio;
  const listedWorld = (state.cloudWorlds || []).find((world) => world.id === zhimuApi.context.worldId);
  const world = studio?.world || listedWorld;
  const loggedOutDemo=!localStorage.getItem("zhimuSessionToken")&&window.zhimuConfig?.demoMode;
  const studioEmpty=!loggedOutDemo&&Boolean(zhimuApi.context.worldId)&&!studio?.roles?.length;
  const studioEmptyBanner=studioEmpty?`<section class="demo-strip" style="margin-bottom:14px;border-color:#e8c4c4;background:#fff8f7"><div><span class="cloud-pill">内容未载入</span><strong style="margin-top:7px">剧本「${escapeHtml(world?.name||"当前")}」暂无角色或分幕</strong><p>${escapeHtml(state.apiError||"请刷新云端数据，或稍后再试。")}</p></div><button class="primary-btn" data-action="refresh-cloud">刷新云端数据</button></section>`:"";
  const loading = state.cloudLoading && !studio?.world;
  const roleCount = studio?.roles?.length ?? 0, chapterCount = studio?.chapters?.length ?? 0;
  const uploadCount = state.cloudAssets?.length ?? 0;
  const rooms = studio?.rooms || [], hasRooms = rooms.length > 0;
  const room = activeRuntimeRoom(), hasActiveRoom = Boolean(room);
  const enabledRules = (state.cloudRules || []).filter(rule => rule.enabled).length;
  const pendingEvents = hasActiveRoom ? (state.cloudHostEvents || []).length : 0;
  const runtimeProgress = hasActiveRoom ? overviewRuntimeProgress() : { percent: 0, label: "当前未选中运行房" };
  const activePlayers = hasActiveRoom ? (state.cloudHost || []).filter(item => (item.completed_sections || 0) > 0 || item.current_scene_id).length : 0;
  const chapterFlow = studio?.chapters?.map(chapter => flow(
    `第 ${chapter.sequence} 章`,
    escapeHtml(chapter.title),
    chapterPublicationLabel(chapter.publication_status),
    chapterFlowClass(chapter.publication_status)
  )).join("") || `<div class="empty-state">尚未创建公共章节。</div>`;
  const logs = state.cloudWorldLogs || [];
  const activities = logs.length
    ? logs.slice(0, 8).map(log => activity(escapeHtml(log.message), formatRelativeTime(log.created_at), logActivityType(log.event_type))).join("")
    : `<div class="empty-state">${hasActiveRoom ? "暂无最近事件" : hasRooms ? "请选择一个运行房以查看该房间的最近事件。" : "暂无运行房。创建测试房后，阅读、调查和规则触发会记录在这里。"}</div>`;
  const hostByRole = new Map((state.cloudHost || []).map(item => [item.role_slot_id, item]));
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
  const statusKicker = hasActiveRoom ? "RUNTIME ACTIVE" : hasRooms ? "ROOMS READY" : "CREATOR MODE";
  const showCatalogPromo = !loading && !studio && Boolean(localStorage.getItem("zhimuSessionToken"));
  const onboardingStrip = window.zhimuOnboarding?.renderOnboardingStrip?.() || "";
  return `
    ${cloudStatus()}
    ${onboardingStrip}
    ${studioEmptyBanner}
    ${showCatalogPromo ? U.catalogPromoSection?.() || "" : ""}
    <section class="hero">
      <article class="hero-card">
        <p class="eyebrow">CURRENT WORLD · ONLINE</p>
        <h2>${loading ? "正在连接云端…" : escapeHtml((window.zhimuUserMessages?.overviewHeroTitle || (() => "未选择世界"))({ loading, worldName: world?.name, apiError: state.apiError }))}</h2>
        <p>${loading ? "正在读取世界基础信息与章节结构，通常只需片刻。" : escapeHtml(world?.summary || (window.zhimuUserMessages?.formatCloudPanelError?.(state.apiError, { hasStudio: Boolean(world) }) || "世界基础信息加载完成后会显示在这里。"))}</p>
        <div class="hero-stats"><div><strong>${String(roleCount).padStart(2,"0")}</strong><small>角色席位</small></div><div><strong>${String(chapterCount).padStart(2,"0")}</strong><small>公共章节</small></div><div><strong>${String(uploadCount).padStart(2,"0")}</strong><small>云端附件</small></div></div>
      </article>
      <article class="status-card">
        <div class="status-head"><h3>当前进度</h3><span>${statusHead}</span></div>
        <div class="chapter"><p class="section-kicker">${statusKicker}</p><strong>${statusTitle}</strong></div>
        <div class="progress"><i style="width:${hasActiveRoom ? runtimeProgress.percent : 0}%"></i></div>
        <div class="status-meta"><span>${hasActiveRoom ? runtimeProgress.label : hasRooms ? "已建立运行房，请进入房间后查看玩家进度" : "当前仅有创作内容，没有玩家运行状态"}</span><span>${hasActiveRoom ? runtimeProgress.percent : 0}%</span></div>
        <div class="pulse-line"><i></i><span>${hasActiveRoom ? "运行实例已连接" : hasRooms ? "选择一个运行房以读取运行状态" : "完成检查后可建立测试房"}</span></div>
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
        <div class="section-head"><div><h3>实时动态</h3><p>最近发生的状态变化</p></div><button class="text-btn" data-go="director">查看全部 →</button></div>
        <div class="activity-list">${activities}</div>
      </article>
    </section>
    <section class="workspace-grid">
      <article class="card">
        <div class="section-head"><div><h3>角色阅读状态</h3><p>玩家主动读完后，系统才会记录状态并判断后续解锁</p></div><button class="text-btn" data-go="player">进入玩家视角 →</button></div>
        <div class="reading-list">${roleRows}</div>
      </article>
      <article class="card">
        <div class="section-head"><div><h3>现在可以做什么</h3><p>从主页面直接进入当前工作</p></div></div>
        <div class="task-list">
          ${task("◇","复核剧情编排",`${studio?.scenes?.length || 0} 个场景、${studio?.investigationPoints?.length || 0} 个调查点和 ${studio?.edges?.length || 0} 条连线已经写入`,"studio","打开编排")}
          ${task("✎","逐角色检查私人剧本",`${roleCount} 个角色席位，共 ${studio?.sections?.length || 0} 段私人正文`,"writer","检查角色稿")}
          ${task("⌘","配置自动化规则",enabledRules ? `当前已有 ${enabledRules} 条启用规则` : "当前世界还没有运行规则","rules","打开规则")}
          ${taskAction(hasRooms ? "◉" : "＋",hasRooms ? "管理运行房" : "建立运行房",hasRooms ? (rooms.length===1?`当前运行房：${escapeHtml((room||rooms[0])?.name||"运行房")}`:`${rooms.length} 个你可访问的运行房`): "当前世界尚未创建运行实例","world-rooms",hasRooms ? "查看房间" : "创建运行房")}
          ${uploadCount ? taskAction("↑","管理云端附件",`${uploadCount} 个文件已上传`,"go-account","打开资产","assets") : taskAction("↑","上传世界附件","当前世界还没有上传资产。你可以上传线索图、音频、角色图或文档。","go-account","前往上传","assets")}
        </div>
      </article>
    </section>
    `;
}
  viewExports.overviewRuntimeProgress = overviewRuntimeProgress;
  viewExports.overview = overview;
})(window);
export {};
