import { escapeHtml } from "../security.js";
import { state } from "../state.js";
import { formatRelativeTime } from "../utils/format.js";
import { isRegisteredUser } from "../utils/user.js";

export function renderPlaza() {
  const items = state.plazaPosts?.items || [];
  const filter = state.plazaFilter || "all";
  const canWrite = isRegisteredUser(state.user);
  const filters = [
    ["all", "全部"],
    ["chat", "自由讨论"],
    ["recruit", "招募队友"]
  ];
  return `
    <section class="plaza-shell">
      <div class="plaza-head">
        <div>
          <p class="eyebrow">PLAYER PLAZA · 玩家广场</p>
          <h1>没进本也能聊，招募队友一起开局</h1>
          <p class="lede">在这里自由讨论、找局、发帖招募。无需先加入某个平行房。</p>
        </div>
        <button class="btn outline" type="button" data-action="refresh-plaza" ${state.busy ? "disabled" : ""}>刷新</button>
      </div>

      <article class="card plaza-compose">
        <h3>发表留言</h3>
        ${canWrite
          ? `
        <form class="plaza-form" data-form="plaza">
          <label>类型
            <select class="field" name="kind" data-bind="plazaKind">
              <option value="chat" ${state.plazaDraftKind !== "recruit" ? "selected" : ""}>自由讨论</option>
              <option value="recruit" ${state.plazaDraftKind === "recruit" ? "selected" : ""}>招募队友</option>
            </select>
          </label>
          <label>内容
            <textarea class="field" name="body" rows="3" maxlength="500" placeholder="聊聊想玩的题材、时间，或招募缺的几号位…" required data-bind="plazaBody">${escapeHtml(state.plazaDraftBody || "")}</textarea>
          </label>
          <label class="plaza-invite-field ${state.plazaDraftKind === "recruit" ? "" : "is-hidden"}">邀请码（选填）
            <input class="field" name="inviteCode" type="text" placeholder="有公开房或熟人局邀请码可填写" value="${escapeHtml(state.plazaDraftInvite || "")}" data-bind="plazaInvite" />
          </label>
          <button class="btn primary" type="submit" ${state.busy ? "disabled" : ""}>发布到广场</button>
        </form>`
          : `
        <div class="auth-gate card-soft">
          <p>发帖、评论、好友与私信需要<strong>注册登录</strong>。</p>
          <button class="btn outline" type="button" data-action="show-auth">登录 / 注册</button>
        </div>`}
        <p class="hint">帖子经 AI 审核，严禁广告。游客可浏览广场与公开房间。</p>
      </article>

      <nav class="plaza-filters" aria-label="广场筛选">
        ${filters
          .map(
            ([id, label]) => `
          <button type="button" class="tab ${filter === id ? "is-active" : ""}" data-action="plaza-filter" data-kind="${id}">${label}</button>`
          )
          .join("")}
      </nav>

      <div class="plaza-feed">
        ${state.plazaPosts === null && !state.plazaError
          ? `<div class="empty enriched-empty"><span class="loading-dots">加载广场中…</span></div>`
          : state.plazaError
            ? `<div class="banner error inline-retry">${escapeHtml(state.plazaError)}<button class="btn outline compact" type="button" data-action="refresh-plaza">重试</button></div>`
            : items.length
          ? items
              .map(
                (post) => `
          <article class="plaza-post card ${post.kind === "recruit" ? "plaza-post-recruit" : ""}">
            <header class="plaza-post-head">
              <div>
                <strong>${escapeHtml(post.authorDisplayName || "玩家")}</strong>
                <span class="plaza-kind">${post.kind === "recruit" ? "招募队友" : "自由讨论"}</span>
              </div>
              <time>${formatRelativeTime(post.createdAt)}</time>
            </header>
            <button class="plaza-open" type="button" data-action="plaza-open" data-post-id="${escapeHtml(post.id)}">
              <p class="plaza-body">${escapeHtml(post.body).replace(/\n/g, "<br>")}</p>
              ${post.replyCount ? `<span class="plaza-reply-count">${post.replyCount} 条评论</span>` : ""}
            </button>
            ${post.kind === "recruit" && post.inviteCode
              ? `
              <div class="plaza-recruit-meta">
                ${post.worldLabel ? `<span>${escapeHtml(post.worldLabel)} · ${escapeHtml(post.roomLabel || "运行房")}</span>` : `<span>邀请码：${escapeHtml(post.inviteCode)}</span>`}
                <button class="btn outline compact" type="button" data-action="plaza-join" data-invite-code="${escapeHtml(post.inviteCode)}">加入这局</button>
              </div>`
              : ""}
          </article>`
              )
              .join("")
          : `
          <article class="card plaza-empty enriched-empty">
            <span class="empty-icon" aria-hidden="true">✦</span>
            <p>广场还没有留言。做第一个发帖的人，或去「找人一起玩」看看公开房间。</p>
          </article>`}
      </div>

      <button class="text-btn" type="button" data-action="back-landing">← 返回首页</button>
    </section>`;
}

export function renderPlazaThread() {
  const post = state.plazaPostDetail;
  const replies = state.plazaReplies?.items || [];
  const canWrite = isRegisteredUser(state.user);
  if (!post) {
    return `
      <section class="plaza-shell">
        <p class="hint">加载帖子中…</p>
        <button class="text-btn" type="button" data-action="plaza-back">← 返回广场</button>
      </section>`;
  }
  return `
    <section class="plaza-shell plaza-thread">
      <button class="text-btn" type="button" data-action="plaza-back">← 返回广场</button>
      <article class="plaza-post card ${post.kind === "recruit" ? "plaza-post-recruit" : ""}">
        <header class="plaza-post-head">
          <div>
            <strong>${escapeHtml(post.authorDisplayName || "玩家")}</strong>
            <span class="plaza-kind">${post.kind === "recruit" ? "招募队友" : "自由讨论"}</span>
          </div>
          <time>${formatRelativeTime(post.createdAt)}</time>
        </header>
        <p class="plaza-body">${escapeHtml(post.body).replace(/\n/g, "<br>")}</p>
        ${post.kind === "recruit" && post.inviteCode
          ? `
          <div class="plaza-recruit-meta">
            ${post.worldLabel ? `<span>${escapeHtml(post.worldLabel)} · ${escapeHtml(post.roomLabel || "运行房")}</span>` : `<span>邀请码：${escapeHtml(post.inviteCode)}</span>`}
            <button class="btn outline compact" type="button" data-action="plaza-join" data-invite-code="${escapeHtml(post.inviteCode)}">加入这局</button>
          </div>`
          : ""}
        <div class="plaza-post-actions">
          ${post.isMine ? `<button class="btn quiet compact" type="button" data-action="plaza-delete-post" data-post-id="${escapeHtml(post.id)}">删除帖子</button>` : ""}
          ${!post.isMine ? `<button class="btn quiet compact" type="button" data-action="plaza-report" data-target-type="post" data-target-id="${escapeHtml(post.id)}">举报</button>` : ""}
        </div>
      </article>

      <section class="plaza-replies card">
        <h3>评论 (${replies.length})</h3>
        <div class="plaza-reply-list">
          ${replies.length
            ? replies
                .map(
                  (reply) => `
            <article class="plaza-reply ${reply.parentReplyId ? "is-nested" : ""}">
              <header>
                <strong>${escapeHtml(reply.authorDisplayName || "玩家")}</strong>
                <time>${formatRelativeTime(reply.createdAt)}</time>
              </header>
              <p>${escapeHtml(reply.body).replace(/\n/g, "<br>")}</p>
              <div class="plaza-reply-actions">
                ${reply.isMine ? `<button class="btn quiet compact" type="button" data-action="plaza-delete-reply" data-reply-id="${escapeHtml(reply.id)}">删除</button>` : ""}
                ${!reply.isMine ? `<button class="btn quiet compact" type="button" data-action="plaza-report" data-target-type="reply" data-target-id="${escapeHtml(reply.id)}">举报</button>` : ""}
              </div>
            </article>`
                )
                .join("")
            : `<p class="hint muted">还没有评论，来做第一个回复的人吧。</p>`}
        </div>
        ${canWrite
          ? `
        <form class="plaza-reply-form" data-form="plaza-reply">
          <textarea class="field" name="body" rows="3" maxlength="500" placeholder="写下你的评论…" required data-bind="plazaReplyBody">${escapeHtml(state.plazaReplyDraft || "")}</textarea>
          <button class="btn primary" type="submit" ${state.busy ? "disabled" : ""}>发表评论</button>
        </form>`
          : `
        <div class="auth-gate card-soft">
          <p>评论需要注册登录。</p>
          <button class="btn outline" type="button" data-action="show-auth">登录 / 注册</button>
        </div>`}
      </section>
    </section>`;
}
