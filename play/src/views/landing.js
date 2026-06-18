import { FLOW_STEPS } from "../constants.js";
import { escapeHtml } from "../security.js";
import { state } from "../state.js";

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

export function renderLanding() {
  const example = state.platform?.officialExample;
  const openCount = state.publicRooms?.total || 0;
  return `
    <section class="landing-shell">
      <div class="landing-hero-wrap">
        <div class="landing-backdrop" aria-hidden="true">
          <div class="landing-glow landing-glow-a"></div>
          <div class="landing-glow landing-glow-b"></div>
        </div>
        <div class="landing-hero">
          <p class="eyebrow">PLAYER · 纯玩家视角</p>
          <h1>受邀入房，以角色身份进入故事</h1>
          <p class="lede">织幕玩家端只做一件事：让你以<strong>角色</strong>身份阅读分幕、探索场景、管理线索与背包。没有创作台，也没有主持工具。</p>
        </div>
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
        <article class="entry-card entry-card-plaza">
          <div class="entry-card-head">
            <p class="eyebrow">无需在局中</p>
            <h3>玩家广场</h3>
          </div>
          <p class="entry-card-lede">自由讨论、招募队友、约局聊天。没参与剧本时也能和陌生玩家互动。</p>
          <button class="btn primary full" type="button" data-action="go-plaza" ${state.busy ? "disabled" : ""}>进入广场</button>
        </article>

        <article class="entry-card entry-card-lobby">
          <div class="entry-card-head">
            <p class="eyebrow">无需认识主持人</p>
            <h3>找人一起玩</h3>
          </div>
          <p class="entry-card-lede">浏览正在公开的运行房，与陌生玩家在线凑局。</p>
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
