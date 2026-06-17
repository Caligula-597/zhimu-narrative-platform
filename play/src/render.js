import { getAppOrigin, getSessionToken } from "./api.js";
import {
  escapeHtml,
  sanitizeImageUrl,
  asArray
} from "./security.js";
import { currentScene, playerProgress, state } from "./state.js";

const JOIN_STEPS = [
  { id: 1, label: "输入邀请码", hint: "主持人开团后分享" },
  { id: 2, label: "选择角色", hint: "每个席位对应一名玩家" },
  { id: 3, label: "进入房间", hint: "开始阅读与探索" }
];

const FLOW_STEPS = [
  { n: "01", title: "收到邀请", text: "主持人把房间邀请码或链接发给你" },
  { n: "02", title: "选择角色", text: "在剧本角色列表里认领你的席位" },
  { n: "03", title: "阅读分幕", text: "按角色阅读私人章节，标记完成" },
  { n: "04", title: "探索推进", text: "调查场景、收集线索、管理背包" }
];

export function renderStepper(activeStep) {
  return `
    <ol class="stepper" aria-label="加入流程">
      ${JOIN_STEPS.map((step) => {
        const done = activeStep > step.id;
        const active = activeStep === step.id;
        return `
          <li class="stepper-item ${done ? "is-done" : ""} ${active ? "is-active" : ""}">
            <span class="stepper-dot">${done ? "✓" : step.id}</span>
            <div>
              <strong>${step.label}</strong>
              <small>${step.hint}</small>
            </div>
          </li>`;
      }).join("")}
    </ol>`;
}

export function renderHeader() {
  const appOrigin = getAppOrigin();
  const roleName = state.home?.role?.name || "";
  const roomName = state.home?.room?.name || "";
  const userLabel = state.user?.displayName || state.user?.email || "";
  return `
    <header class="play-header">
      <a class="brand" href="/" data-action="go-home">
        <span class="brand-mark">织</span>
        <span><strong>织幕</strong><small>玩家端</small></span>
      </a>
      <div class="header-meta">
        ${roomName ? `<span class="pill">${escapeHtml(roomName)}</span>` : ""}
        ${roleName ? `<span class="pill accent">${escapeHtml(roleName)}</span>` : ""}
        ${state.roomEventsConnected ? `<span class="pill live">实时</span>` : ""}
        ${userLabel && !roleName ? `<span class="pill">${escapeHtml(userLabel)}</span>` : ""}
      </div>
      <div class="header-actions">
        ${state.view !== "game" ? `<button class="link-btn quiet" type="button" data-action="go-lobby">找人一起玩</button>` : ""}
        <a class="link-btn quiet" href="${appOrigin}/" target="_blank" rel="noopener">创作者入口</a>
        ${getSessionToken() ? `<button class="link-btn quiet" type="button" data-action="logout">退出</button>` : ""}
      </div>
    </header>`;
}

function renderOfficialExampleCard() {
  const example = state.platform?.officialExample;
  if (!example?.configured) return "";
  const available = example.available;
  return `
    <article class="entry-card entry-card-demo ${available ? "" : "is-disabled"}">
      <div class="entry-card-head">
        <p class="eyebrow">无需邀请码</p>
        <h3>${escapeHtml(example.name || "官方示例剧本")}</h3>
      </div>
      <p class="entry-card-lede">${escapeHtml(example.summary || "快速体验玩家阅读、探索与线索流程。")}</p>
      <dl class="entry-meta">
        <div><dt>角色</dt><dd>${example.roleCount || 0} 个席位</dd></div>
        <div><dt>适合</dt><dd>第一次了解织幕的玩家</dd></div>
      </dl>
      ${available
        ? `<button class="btn primary full" type="button" data-action="join-official" ${state.busy ? "disabled" : ""}>进入示例体验</button>`
        : `<p class="hint warn">${escapeHtml(example.unavailableReason || "示例暂不可用")}</p>`}
      <p class="hint">系统会为你创建独立运行房，再选择角色进入玩家视角。</p>
    </article>`;
}

export function renderLobby() {
  const listing = state.publicRooms;
  const items = listing?.items || [];
  return `
    <section class="lobby-shell">
      <div class="lobby-head">
        <div>
          <p class="eyebrow">PUBLIC LOBBY · 在线凑局</p>
          <h1>正在开放的剧本房间</h1>
          <p class="lede">主持人在织幕里把平行房<strong>公开到大厅</strong>后，会出现在这里。选一间加入，认领角色即可与陌生玩家同局。</p>
          <p class="hint muted">这与「公开剧本库」不同：剧本库是审核上架的模板；这里是<strong>正在运行的实时房间</strong>。</p>
        </div>
        <button class="btn outline" type="button" data-action="refresh-lobby" ${state.busy ? "disabled" : ""}>刷新列表</button>
      </div>

      ${items.length ? `
        <div class="lobby-grid">
          ${items.map((room) => `
            <article class="lobby-card card">
              <div class="lobby-card-head">
                <p class="eyebrow">${escapeHtml(room.worldName)}</p>
                <h3>${escapeHtml(room.roomName)}</h3>
              </div>
              <p class="lobby-summary">${escapeHtml(room.worldSummary || "暂无剧本简介")}</p>
              <dl class="entry-meta lobby-meta">
                <div><dt>主持</dt><dd>${escapeHtml(room.hostDisplayName || "玩家")}</dd></div>
                <div><dt>空席</dt><dd>${room.openSeats} / ${room.roleCount}</dd></div>
                <div><dt>状态</dt><dd>${escapeHtml(room.roomStatus || "运行中")}</dd></div>
              </dl>
              <button class="btn primary full" type="button" data-action="lobby-join" data-invite-code="${escapeHtml(room.inviteCode)}" ${room.openSeats <= 0 || state.busy ? "disabled" : ""}>
                ${room.openSeats <= 0 ? "席位已满" : "加入这局"}
              </button>
            </article>`).join("")}
        </div>` : `
        <article class="card lobby-empty">
          <h3>暂时没有公开房间</h3>
          <p class="muted">主持人可在 app.getzhimu.com → 管理平行房 →「公开到大厅」开放实时房间；或使用下方邀请码 / 官方示例入房。</p>
          <div class="row-actions">
            <button class="btn outline" type="button" data-action="back-landing">输入邀请码</button>
            <button class="btn quiet" type="button" data-action="join-official">体验官方示例</button>
          </div>
        </article>`}

      <button class="text-btn" type="button" data-action="back-landing">← 返回首页</button>
    </section>`;
}

export function renderLanding() {
  const example = state.platform?.officialExample;
  const openCount = state.publicRooms?.total || 0;
  return `
    <section class="landing-shell">
      <div class="landing-hero">
        <p class="eyebrow">PLAYER · 纯玩家视角</p>
        <h1>受邀入房，以角色身份进入故事</h1>
        <p class="lede">织幕玩家端只做一件事：让你以<strong>角色</strong>身份阅读分幕、探索场景、管理线索与背包。没有创作台，也没有主持工具。</p>
      </div>

      <div class="flow-grid" aria-label="玩家流程说明">
        ${FLOW_STEPS.map((step) => `
          <article class="flow-card">
            <span class="flow-num">${step.n}</span>
            <h3>${step.title}</h3>
            <p>${step.text}</p>
          </article>`).join("")}
      </div>

      <div class="entry-grid">
        <article class="entry-card entry-card-lobby">
          <div class="entry-card-head">
            <p class="eyebrow">无需认识主持人</p>
            <h3>找人一起玩</h3>
          </div>
          <p class="entry-card-lede">浏览正在公开的运行房，与陌生玩家在线凑局。主持人在创作者端把平行房公开到大厅后会出现于此。</p>
          <dl class="entry-meta">
            <div><dt>当前开放</dt><dd>${openCount} 个房间</dd></div>
            <div><dt>适合</dt><dd>想随机匹配玩家的线上局</dd></div>
          </dl>
          <button class="btn primary full" type="button" data-action="go-lobby" ${state.busy ? "disabled" : ""}>浏览公开房间</button>
        </article>

        <article class="entry-card entry-card-primary">
          <div class="entry-card-head">
            <p class="eyebrow">我有邀请码</p>
            <h3>加入主持人开的平行房</h3>
          </div>
          <p class="entry-card-lede">输入主持人分享的邀请码，选择你的角色席位，即可进入房间开始游戏。</p>
          <label class="field-label" for="invite-input">房间邀请码</label>
          <div class="join-row">
            <input id="invite-input" class="field" type="text" placeholder="例如：PLAY-ABC12345" value="${escapeHtml(state.inviteCode)}" data-bind="inviteCode" autocomplete="off" />
            <button class="btn primary" type="button" data-action="start-join" ${state.busy ? "disabled" : ""}>下一步：选角色</button>
          </div>
          <p class="hint">也可通过链接直接进入：<code>?join=你的邀请码</code></p>
        </article>

        ${renderOfficialExampleCard()}
      </div>

      <section class="help-panel card">
        <h3>邀请码从哪里来？</h3>
        <ul class="help-list">
          <li>主持人在<strong>织幕应用</strong>里创建平行房后，会获得一串房间邀请码</li>
          <li>把邀请码或 <code>play.getzhimu.com/?join=邀请码</code> 链接发给玩家</li>
          <li>每位玩家选择<strong>不同的角色席位</strong>，进入后只能看到自己的私人分幕与线索</li>
        </ul>
        ${example?.available ? `<button class="btn outline" type="button" data-action="join-official">还没有邀请码？先体验官方示例</button>` : ""}
      </section>

      <div class="landing-actions">
        <button class="btn outline" type="button" data-action="show-auth">登录 / 注册账号</button>
        <button class="btn quiet" type="button" data-action="guest-continue" ${state.busy ? "disabled" : ""}>以访客身份继续</button>
      </div>
    </section>`;
}

export function renderJoin() {
  const preview = state.joinPreview;
  if (!preview) {
    return `
      <section class="panel">
        ${renderStepper(1)}
        <h2>输入房间邀请码</h2>
        <p class="muted">输入主持人分享的邀请码，系统会读取该房间可选的角色席位。</p>
        <div class="join-row">
          <input class="field" type="text" placeholder="房间邀请码" value="${escapeHtml(state.inviteCode)}" data-bind="inviteCode" />
          <button class="btn primary" type="button" data-action="lookup-invite" ${state.busy ? "disabled" : ""}>读取角色列表</button>
        </div>
        <button class="text-btn" type="button" data-action="back-landing">← 返回首页</button>
      </section>`;
  }

  const roles = preview.roles || [];
  const availableCount = roles.filter((r) => !r.occupied || r.occupied_by_current).length;
  const selected = roles.find((r) => r.id === state.selectedRoleId);

  return `
    <section class="join-shell">
      ${renderStepper(state.joinStep)}
      <div class="join-summary card">
        <div>
          <p class="eyebrow">即将进入</p>
          <h2>${escapeHtml(preview.room.name)}</h2>
          <p class="muted">世界 · ${escapeHtml(preview.world.name)} · 房间状态 ${escapeHtml(preview.room.status || "运行中")}</p>
        </div>
        <dl class="join-stats">
          <div><dt>可选角色</dt><dd>${availableCount} / ${roles.length}</dd></div>
          <div><dt>邀请码</dt><dd><code>${escapeHtml(state.inviteCode)}</code></dd></div>
        </dl>
      </div>

      <div class="panel">
        <h3>选择你的角色席位</h3>
        <p class="muted">每个席位对应剧本中的一个角色。已被其他玩家占用的席位无法选择。</p>
        <div class="role-grid">
          ${roles.map((role) => {
            const disabled = role.occupied && !role.occupied_by_current;
            const isSelected = state.selectedRoleId === role.id;
            const status = disabled ? "已被占用" : role.occupied_by_current ? "你的当前角色" : "可选";
            return `
              <button type="button" class="role-card ${isSelected ? "is-selected" : ""}" data-action="pick-role" data-role-id="${role.id}" ${disabled ? "disabled" : ""}>
                <span class="role-avatar">${escapeHtml(String(role.name?.[0] || "?"))}</span>
                <div>
                  <strong>${escapeHtml(role.name)}</strong>
                  <span class="role-status">${status}</span>
                  ${role.public_profile ? `<p>${escapeHtml(role.public_profile)}</p>` : ""}
                </div>
              </button>`;
          }).join("")}
        </div>

        ${selected ? `
          <div class="join-confirm card-soft">
            <p>你将以 <strong>${escapeHtml(selected.name)}</strong> 的身份进入 <strong>${escapeHtml(preview.room.name)}</strong></p>
            <p class="hint">进入后可阅读该角色的私人分幕、探索场景、查看线索与背包。</p>
          </div>` : ""}

        <div class="row-actions">
          <button class="btn primary large" type="button" data-action="confirm-join" ${state.busy || !state.selectedRoleId ? "disabled" : ""}>进入房间，开始游戏</button>
          <button class="btn quiet" type="button" data-action="join-back-code">修改邀请码</button>
          <button class="btn quiet" type="button" data-action="back-landing">返回首页</button>
        </div>
      </div>
    </section>`;
}

export function renderAuth() {
  const oauth = state.authConfig?.oauth || [];
  const isRegister = state.authMode === "register";
  return `
    <section class="panel narrow">
      <p class="eyebrow">账号</p>
      <h2>${isRegister ? "注册织幕账号" : "登录织幕账号"}</h2>
      <p class="muted">登录后可跨设备保留进度；官方示例体验也需要验证邮箱的账号。</p>
      <form class="auth-form" data-form="auth">
        ${isRegister ? `
          <label>显示名称
            <input class="field" name="displayName" type="text" minlength="2" maxlength="40" required placeholder="你在房间里的称呼" />
          </label>` : ""}
        <label>邮箱
          <input class="field" name="email" type="email" autocomplete="email" required />
        </label>
        <label>密码
          <input class="field" name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" minlength="8" required />
        </label>
        <button class="btn primary" type="submit" ${state.busy ? "disabled" : ""}>${isRegister ? "注册" : "登录"}</button>
      </form>
      ${oauth.length ? `
        <div class="oauth-row">
          ${oauth.map((p) => `<button class="btn outline" type="button" data-action="oauth" data-provider="${p.id}">${escapeHtml(p.label)} 登录</button>`).join("")}
        </div>` : ""}
      <button class="text-btn" type="button" data-action="toggle-auth-mode">
        ${isRegister ? "已有账号？去登录" : "没有账号？去注册"}
      </button>
      <button class="text-btn" type="button" data-action="back-landing">返回首页</button>
    </section>`;
}

function renderRoomMembers() {
  const members = state.home?.roomMembers || [];
  if (!members.length) return "";
  return `
    <article class="card members-card">
      <div class="section-head"><h3>房间成员</h3><p>${members.filter((m) => m.online).length} 人已选角色</p></div>
      <div class="member-list">
        ${members.map((member) => `
          <div class="member-row ${member.online ? "is-online" : ""}">
            <span class="member-avatar">${escapeHtml(String(member.role_name?.[0] || "?"))}</span>
            <div>
              <strong>${escapeHtml(member.role_name)}</strong>
              <span>${member.display_name ? escapeHtml(member.display_name) : member.online ? "已加入" : "空席"}</span>
            </div>
          </div>`).join("")}
      </div>
    </article>`;
}

export function renderGameHome() {
  const home = state.home;
  const progress = playerProgress(home);
  const scene = currentScene(state.exploration);
  const role = home?.role;
  const next = progress.nextSection;

  return `
    <div class="home-dashboard">
      <article class="player-hero card">
        <div class="player-hero-copy">
          <p class="eyebrow">${escapeHtml(role?.name || "你的角色")} · 当前场景</p>
          <h2>${escapeHtml(scene.title)}</h2>
          <p>${escapeHtml(scene.text)}</p>
        </div>
        <div class="scene-art" aria-hidden="true">${escapeHtml(scene.art)}</div>
      </article>

      <div class="stat-grid">
        <article class="stat-card"><span>分幕进度</span><strong>${progress.sectionsCompleted} / ${progress.sectionsTotal}</strong></article>
        <article class="stat-card"><span>我的线索</span><strong>${progress.clueCount}</strong></article>
        <article class="stat-card"><span>共享线索</span><strong>${progress.sharedClueCount}</strong></article>
        <article class="stat-card"><span>背包物品</span><strong>${progress.inventoryCount}</strong></article>
      </div>

      ${next ? `
        <article class="next-action card">
          <div>
            <p class="eyebrow">建议下一步</p>
            <h3>${next.completed ? "回顾分幕" : "继续阅读"} · ${escapeHtml(next.title)}</h3>
            <p class="muted">第 ${next.sequence} 幕${next.completed ? "（已完成，可重温）" : "尚未读完"}</p>
          </div>
          <button class="btn primary" type="button" data-action="goto-section" data-section-id="${next.id}">${next.completed ? "打开分幕" : "继续阅读"}</button>
        </article>` : `
        <article class="next-action card card-soft">
          <p class="muted">主持人尚未向你的角色发放可读分幕。请等待主持人推进，或联系主持人确认角色配置。</p>
        </article>`}

      ${(state.exploration?.scenes?.length || 0) > 0 ? `
        <button class="btn outline" type="button" data-action="switch-tab" data-tab="explore">前往探索场景（${state.exploration.scenes.length}）</button>` : ""}
    </div>`;
}

export function renderSections() {
  const sections = state.home?.sections || [];
  const active = sections.find((s) => s.id === state.sectionId) || sections[0];
  if (!sections.length) {
    return `<div class="empty">主持人尚未向你的角色发放可读分幕。回到<strong>概览</strong>查看等待说明，或联系主持人。</div>`;
  }
  const activeIndex = sections.findIndex((section) => section.id === active?.id);
  const body = active?.body || "";
  const pages = active?.pages || [];
  const switcher = sections.length > 1 ? `
    <div class="section-switcher">
      <button type="button" class="btn quiet compact" data-action="section-prev" ${activeIndex <= 0 ? "disabled" : ""} aria-label="上一幕">←</button>
      <label class="section-select-wrap">
        <span class="sr-only">切换分幕</span>
        <select class="field section-select" data-bind="sectionId">
          ${sections.map((section) => `
            <option value="${section.id}" ${section.id === active?.id ? "selected" : ""}>
              第 ${section.sequence} 幕${section.completed ? " · 已完成" : ""}
            </option>`).join("")}
        </select>
      </label>
      <button type="button" class="btn quiet compact" data-action="section-next" ${activeIndex >= sections.length - 1 ? "disabled" : ""} aria-label="下一幕">→</button>
      <span class="section-progress">${Math.max(activeIndex, 0) + 1} / ${sections.length}</span>
    </div>` : "";
  return `
    <div class="sections-layout">
      <article class="reader card reader-full">
        ${switcher}
        <header class="reader-head">
          <p class="eyebrow">分幕 ${active?.sequence ?? ""}</p>
          <h3>${escapeHtml(active?.title || "")}</h3>
        </header>
        <div class="story-body">${escapeHtml(body).replace(/\n/g, "<br>")}</div>
        ${pages.length ? `<div class="story-pages">${pages.map((page) => {
          const src = sanitizeImageUrl(page.url);
          if (!src) return "";
          return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(page.filename || page.caption || active.title)}" loading="lazy" referrerpolicy="no-referrer" /><figcaption>${escapeHtml(page.filename || page.caption || "")}</figcaption></figure>`;
        }).filter(Boolean).join("")}</div>` : ""}
        ${active && !active.completed ? `<button class="btn primary" type="button" data-action="complete-section" data-section-id="${active.id}" ${state.busy ? "disabled" : ""}>标记阅读完成</button>` : active?.completed ? `<p class="done-note">✓ 已完成阅读 — 主持人会收到进度通知</p>` : ""}
      </article>
    </div>`;
}

export function renderClues() {
  const owned = state.home?.clues || [];
  const shared = state.home?.sharedClues || [];
  const all = [...owned, ...shared.filter((c) => !owned.some((o) => o.id === c.id))];
  if (!all.length) {
    return `<div class="empty">还没有获得线索。完成分幕阅读或探索场景中的调查点后，线索会出现在这里。</div>`;
  }
  const active = all.find((c) => c.id === state.clueId) || all[0];
  const list = all.map((clue) => `
    <button type="button" class="list-item ${clue.id === active?.id ? "is-active" : ""}" data-action="pick-clue" data-clue-id="${clue.id}">
      <strong>${escapeHtml(clue.name)}</strong>
      ${clue.read_at ? "<span>已读</span>" : '<span class="tag">未读</span>'}
    </button>`).join("");
  return `
    <div class="split-layout">
      <div class="list">${list}</div>
      <article class="card detail">
        <h3>${escapeHtml(active?.name || "")}</h3>
        <p class="story-body">${escapeHtml(active?.public_text || active?.private_text || "加载中…")}</p>
        ${active && !active.read_at ? `<button class="btn outline" type="button" data-action="read-clue" data-clue-id="${active.id}" ${state.busy ? "disabled" : ""}>标记已读</button>` : ""}
      </article>
    </div>`;
}

export function renderExploration() {
  const scenes = state.exploration?.scenes || [];
  if (!scenes.length) {
    return `<div class="empty">当前还没有开放探索场景。读完分幕并等待主持人解锁后，新地点会出现在这里。</div>`;
  }
  return scenes.map((scene) => `
    <article class="card scene-card">
      <header>
        <p class="eyebrow">场景</p>
        <h3>${escapeHtml(scene.name)}</h3>
      </header>
      <p>${escapeHtml(scene.public_text || "")}</p>
      <div class="point-list">
        ${asArray(scene.investigation_points).map((point) => `
          <div class="point-row">
            <div>
              <strong>${escapeHtml(point.name)}</strong>
              <p>${escapeHtml(point.description || "")}</p>
              ${point.requiredItemName ? `<span class="tag">需要：${escapeHtml(point.requiredItemName)}</span>` : ""}
              ${point.investigated && point.resultText ? `<p class="result-text">${escapeHtml(point.resultText)}</p>` : ""}
            </div>
            <button class="btn ${point.investigated ? "quiet" : "outline"}" type="button"
              data-action="investigate" data-point-id="${point.id}"
              ${point.investigated || !point.hasRequiredItem || state.busy ? "disabled" : ""}>
              ${point.investigated ? "已调查" : "调查"}
            </button>
          </div>`).join("")}
      </div>
    </article>`).join("");
}

export function renderInventory() {
  const items = state.home?.inventory || [];
  if (!items.length) return `<div class="empty">背包是空的。探索场景或完成剧情后，物品会出现在这里。</div>`;
  return `
    <div class="inventory-grid">
      ${items.map((item) => `
        <article class="card inventory-item">
          <strong>${escapeHtml(item.name)}</strong>
          <span>× ${item.quantity}</span>
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
        </article>`).join("")}
    </div>`;
}

export function renderGame() {
  const role = state.home?.role;
  const progress = playerProgress(state.home);
  const tabs = [
    ["home", "概览", ""],
    ["sections", "分幕", progress.sectionsTotal ? `${progress.sectionsCompleted}/${progress.sectionsTotal}` : ""],
    ["explore", "探索", state.exploration?.scenes?.length || ""],
    ["clues", "线索", progress.clueTotal || ""],
    ["inventory", "背包", progress.inventoryCount || ""]
  ];
  let body = "";
  if (state.tab === "home") body = renderGameHome();
  else if (state.tab === "sections") body = renderSections();
  else if (state.tab === "explore") body = renderExploration();
  else if (state.tab === "clues") body = renderClues();
  else body = renderInventory();

  return `
    <section class="game-shell">
      <aside class="game-sidebar">
        <article class="role-card-side card">
          <p class="eyebrow">你的角色</p>
          <h2>${escapeHtml(role?.name || "未选择")}</h2>
          <p>${escapeHtml(role?.private_profile || role?.public_profile || "暂无角色资料")}</p>
        </article>
        ${renderRoomMembers()}
        <div class="sidebar-actions">
          <button class="btn quiet full" type="button" data-action="leave-room">离开房间</button>
        </div>
      </aside>
      <div class="game-main">
        <nav class="tab-bar" aria-label="玩家功能">
          ${tabs.map(([id, label, badge]) => `
            <button type="button" class="tab ${state.tab === id ? "is-active" : ""}" data-action="switch-tab" data-tab="${id}">
              ${label}${badge ? `<span class="tab-badge">${badge}</span>` : ""}
            </button>`).join("")}
        </nav>
        <div class="tab-body">${body}</div>
      </div>
    </section>`;
}

export function renderApp() {
  let main = "";
  if (state.view === "auth") main = renderAuth();
  else if (state.view === "lobby") main = renderLobby();
  else if (state.view === "join") main = renderJoin();
  else if (state.view === "game" && state.home) main = renderGame();
  else main = renderLanding();

  return `
    ${renderHeader()}
    <main class="play-main">
      ${state.error ? `<div class="banner error">${escapeHtml(state.error)}<button type="button" data-action="dismiss-error" aria-label="关闭">×</button></div>` : ""}
      ${state.busy ? `<div class="loading-bar" aria-hidden="true"></div>` : ""}
      ${main}
    </main>
    ${state.toast ? `<div class="toast" role="status">${escapeHtml(state.toast)}</div>` : ""}
  `;
}
